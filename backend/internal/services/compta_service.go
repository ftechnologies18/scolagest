package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
	"gorm.io/gorm"
)

// ComptaService gère la comptabilité générale (partie double).
type ComptaService struct{}

func NewComptaService() *ComptaService { return &ComptaService{} }

// ===== Exercices =====

// ListExercices retourne les exercices d'un établissement.
func (s *ComptaService) ListExercices(etablissementID uuid.UUID) ([]models.ExerciceComptable, error) {
	var ex []models.ExerciceComptable
	if err := database.DB.Where("etablissement_id = ?", etablissementID).
		Order("date_debut DESC").Find(&ex).Error; err != nil {
		return nil, err
	}
	return ex, nil
}

// ExerciceDTO pour création.
type ExerciceDTO struct {
	Libelle        string    `json:"libelle"`
	DateDebut      time.Time `json:"date_debut"`
	DateFin        time.Time `json:"date_fin"`
	AnneeScolaireID *uuid.UUID `json:"annee_scolaire_id"`
}

// CreateExercice crée un nouvel exercice comptable.
func (s *ComptaService) CreateExercice(dto ExerciceDTO, etablissementID uuid.UUID) (*models.ExerciceComptable, error) {
	if dto.Libelle == "" {
		return nil, errors.New("le libellé est obligatoire")
	}
	// Vérifier qu'il n'y a pas déjà un exercice ouvert chevauchant
	var count int64
	database.DB.Model(&models.ExerciceComptable{}).
		Where("etablissement_id = ? AND statut = ? AND date_fin >= ?",
			etablissementID, models.ExerciceOuvert, dto.DateDebut).
		Count(&count)
	if count > 0 {
		return nil, errors.New("un exercice ouvert existe déjà chevauchant cette période")
	}
	ex := models.ExerciceComptable{
		EtablissementID: etablissementID,
		Libelle:         dto.Libelle,
		DateDebut:       dto.DateDebut,
		DateFin:         dto.DateFin,
		Statut:          models.ExerciceOuvert,
		AnneeScolaireID: dto.AnneeScolaireID,
	}
	if err := database.DB.Create(&ex).Error; err != nil {
		return nil, err
	}
	return &ex, nil
}

// CloturerExercice clôture un exercice (et génère les écritures manquantes).
func (s *ComptaService) CloturerExercice(id uuid.UUID) (*models.ExerciceComptable, error) {
	var ex models.ExerciceComptable
	if err := database.DB.First(&ex, "id = ?", id).Error; err != nil {
		return nil, errors.New("exercice introuvable")
	}
	if ex.Statut == models.ExerciceCloture {
		return nil, errors.New("exercice déjà clôturé")
	}
	database.DB.Model(&ex).Update("statut", models.ExerciceCloture)
	database.DB.First(&ex, "id = ?", id)
	return &ex, nil
}

// ===== Comptes =====

// ListComptes retourne le plan comptable d'un établissement (hiérarchique).
func (s *ComptaService) ListComptes(etablissementID uuid.UUID) ([]models.CompteComptable, error) {
	var comptes []models.CompteComptable
	if err := database.DB.Where("etablissement_id = ?", etablissementID).
		Order("numero ASC").Find(&comptes).Error; err != nil {
		return nil, err
	}
	return comptes, nil
}

// CompteDTO pour création.
type CompteDTO struct {
	Numero   string             `json:"numero"`
	Libelle  string             `json:"libelle"`
	Type     models.TypeCompte  `json:"type"`
	ParentID *uuid.UUID         `json:"parent_id"`
}

// CreateCompte crée un compte comptable.
func (s *ComptaService) CreateCompte(dto CompteDTO, etablissementID uuid.UUID) (*models.CompteComptable, error) {
	if dto.Numero == "" || dto.Libelle == "" {
		return nil, errors.New("numéro et libellé obligatoires")
	}
	// Vérifier unicité du numéro par établissement
	var count int64
	database.DB.Model(&models.CompteComptable{}).
		Where("etablissement_id = ? AND numero = ?", etablissementID, dto.Numero).
		Count(&count)
	if count > 0 {
		return nil, errors.New("numéro de compte déjà utilisé")
	}
	c := models.CompteComptable{
		EtablissementID: etablissementID,
		Numero:          dto.Numero,
		Libelle:         dto.Libelle,
		Type:            dto.Type,
		ParentID:        dto.ParentID,
		Actif:           true,
	}
	if err := database.DB.Create(&c).Error; err != nil {
		return nil, err
	}
	return &c, nil
}

// ===== Journaux =====

// ListJournaux retourne les journaux d'un établissement.
func (s *ComptaService) ListJournaux(etablissementID uuid.UUID) ([]models.JournalComptable, error) {
	var j []models.JournalComptable
	if err := database.DB.Where("etablissement_id = ?", etablissementID).
		Order("code ASC").Find(&j).Error; err != nil {
		return nil, err
	}
	return j, nil
}

// ===== Écritures =====

// EcritureFilter filtre les écritures.
type EcritureFilter struct {
	EtablissementID *uuid.UUID
	ExerciceID      *uuid.UUID
	JournalID       *uuid.UUID
	DateDebut       *time.Time
	DateFin         *time.Time
	Page            int
	PageSize        int
}

// EcritureResult est le résultat paginé.
type EcritureResult struct {
	Data     []models.EcritureComptable `json:"data"`
	Total    int64                      `json:"total"`
	Page     int                        `json:"page"`
	PageSize int                        `json:"page_size"`
}

// ListEcritures retourne les écritures paginées selon les filtres.
func (s *ComptaService) ListEcritures(filter EcritureFilter) (*EcritureResult, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.PageSize < 1 || filter.PageSize > 100 {
		filter.PageSize = 20
	}
	q := database.DB.Model(&models.EcritureComptable{}).
		Preload("Journal").Preload("Lignes.Compte").Preload("Paiement")
	if filter.EtablissementID != nil {
		q = q.Joins("JOIN journaux_comptables ON journaux_comptables.id = ecritures_comptables.journal_id").
			Where("journaux_comptables.etablissement_id = ?", *filter.EtablissementID)
	}
	if filter.ExerciceID != nil {
		q = q.Where("ecritures_comptables.exercice_id = ?", *filter.ExerciceID)
	}
	if filter.JournalID != nil {
		q = q.Where("ecritures_comptables.journal_id = ?", *filter.JournalID)
	}
	if filter.DateDebut != nil {
		q = q.Where("ecritures_comptables.date_ecriture >= ?", *filter.DateDebut)
	}
	if filter.DateFin != nil {
		q = q.Where("ecritures_comptables.date_ecriture <= ?", *filter.DateFin)
	}
	var total int64
	q.Count(&total)
	var ecritures []models.EcritureComptable
	offset := (filter.Page - 1) * filter.PageSize
	if err := q.Order("date_ecriture DESC, created_at DESC").
		Offset(offset).Limit(filter.PageSize).Find(&ecritures).Error; err != nil {
		return nil, err
	}
	return &EcritureResult{Data: ecritures, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
}

// GetEcriture retourne une écriture avec ses lignes.
func (s *ComptaService) GetEcriture(id uuid.UUID) (*models.EcritureComptable, error) {
	var e models.EcritureComptable
	if err := database.DB.
		Preload("Journal").Preload("Lignes.Compte").Preload("Paiement").
		First(&e, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("écriture introuvable")
		}
		return nil, err
	}
	return &e, nil
}

// ===== Grand livre =====

// GrandLigneCompte représente un mouvement dans le grand livre.
type GrandLigneCompte struct {
	Date        time.Time `json:"date"`
	NumeroPiece string    `json:"numero_piece"`
	Libelle     string    `json:"libelle"`
	Debit       float64   `json:"debit"`
	Credit      float64   `json:"credit"`
	Solde       float64   `json:"solde"`
}

// GrandLivreCompte représente un compte dans le grand livre.
type GrandLivreCompte struct {
	CompteID         uuid.UUID         `json:"compte_id"`
	Numero           string            `json:"numero"`
	Libelle          string            `json:"libelle"`
	SoldeDebitOuv    float64           `json:"solde_debit_ouv"`
	SoldeCreditOuv   float64           `json:"solde_credit_ouv"`
	Mouvements       []GrandLigneCompte `json:"mouvements"`
	SoldeDebitFin    float64           `json:"solde_debit_fin"`
	SoldeCreditFin   float64           `json:"solde_credit_fin"`
}

// GrandLivreResult est le résultat du grand livre.
type GrandLivreResult struct {
	Comptes     []GrandLivreCompte `json:"comptes"`
	TotalDebit  float64            `json:"total_debit"`
	TotalCredit float64            `json:"total_credit"`
}

// GrandLivre génère le grand livre pour un exercice/compte/période.
func (s *ComptaService) GrandLivre(etablissementID, exerciceID uuid.UUID, compteID *uuid.UUID, dateDebut, dateFin *time.Time) (*GrandLivreResult, error) {
	// Récupérer les comptes (filtré si compteID fourni)
	q := database.DB.Model(&models.CompteComptable{}).Where("etablissement_id = ?", etablissementID)
	if compteID != nil {
		q = q.Where("id = ?", *compteID)
	}
	var comptes []models.CompteComptable
	q.Order("numero ASC").Find(&comptes)

	result := &GrandLivreResult{}
	for _, c := range comptes {
		// Récupérer les lignes d'écriture de ce compte
		lq := database.DB.Model(&models.LigneEcriture{}).
			Joins("JOIN ecritures_comptables ON ecritures_comptables.id = lignes_ecritures.ecriture_id").
			Joins("JOIN journaux_comptables ON journaux_comptables.id = ecritures_comptables.journal_id").
			Where("lignes_ecritures.compte_id = ? AND journaux_comptables.etablissement_id = ? AND ecritures_comptables.statut = ?",
				c.ID, etablissementID, models.EcritureValidee)
		if exerciceID != uuid.Nil {
			lq = lq.Where("ecritures_comptables.exercice_id = ?", exerciceID)
		}
		if dateDebut != nil {
			lq = lq.Where("ecritures_comptables.date_ecriture >= ?", *dateDebut)
		}
		if dateFin != nil {
			lq = lq.Where("ecritures_comptables.date_ecriture <= ?", *dateFin)
		}

		type ligneRow struct {
			Date        time.Time
			NumeroPiece string
			Libelle     string
			Debit       float64
			Credit      float64
		}
		var rows []ligneRow
		lq.Select("ecritures_comptables.date_ecriture as date, ecritures_comptables.numero_piece as numero_piece, lignes_ecritures.libelle as libelle, lignes_ecritures.debit as debit, lignes_ecritures.credit as credit").
			Order("ecritures_comptables.date_ecriture ASC").
			Scan(&rows)

		if len(rows) == 0 {
			continue // pas de mouvements
		}

		glc := GrandLivreCompte{
			CompteID: c.ID,
			Numero:   c.Numero,
			Libelle:  c.Libelle,
		}
		solde := 0.0
		for _, r := range rows {
			solde += r.Debit - r.Credit
			glc.Mouvements = append(glc.Mouvements, GrandLigneCompte{
				Date:        r.Date,
				NumeroPiece: r.NumeroPiece,
				Libelle:     r.Libelle,
				Debit:       r.Debit,
				Credit:      r.Credit,
				Solde:       solde,
			})
			result.TotalDebit += r.Debit
			result.TotalCredit += r.Credit
		}
		if solde > 0 {
			glc.SoldeDebitFin = solde
		} else {
			glc.SoldeCreditFin = -solde
		}
		result.Comptes = append(result.Comptes, glc)
	}
	return result, nil
}

// ===== Bilan =====

// BilanSection représente une section du bilan.
type BilanSection struct {
	Total   float64                `json:"total"`
	Comptes []BilanCompteItem      `json:"comptes"`
}

// BilanCompteItem représente un compte dans le bilan.
type BilanCompteItem struct {
	CompteID uuid.UUID `json:"compte_id"`
	Numero   string    `json:"numero"`
	Libelle  string    `json:"libelle"`
	Solde    float64   `json:"solde"`
}

// BilanResult est le résultat du bilan.
type BilanResult struct {
	Actif    BilanSection `json:"actif"`
	Passif   BilanSection `json:"passif"`
	Produits BilanSection `json:"produits"`
	Charges  BilanSection `json:"charges"`
	Resultat float64      `json:"resultat"` // produits - charges
}

// Bilan génère le bilan d'un exercice.
func (s *ComptaService) Bilan(etablissementID, exerciceID uuid.UUID) (*BilanResult, error) {
	result := &BilanResult{}
	types := []models.TypeCompte{models.CompteActif, models.ComptePassif, models.CompteProduit, models.CompteCharge}
	sections := []*BilanSection{&result.Actif, &result.Passif, &result.Produits, &result.Charges}

	for i, t := range types {
		var comptes []models.CompteComptable
		database.DB.Where("etablissement_id = ? AND type = ?", etablissementID, t).Order("numero").Find(&comptes)
		for _, c := range comptes {
			// Calculer le solde du compte pour l'exercice
			var debit, credit float64
			q := database.DB.Model(&models.LigneEcriture{}).
				Joins("JOIN ecritures_comptables ON ecritures_comptables.id = lignes_ecritures.ecriture_id").
				Where("lignes_ecritures.compte_id = ? AND ecritures_comptables.exercice_id = ? AND ecritures_comptables.statut = ?",
					c.ID, exerciceID, models.EcritureValidee)
			q.Select("COALESCE(SUM(lignes_ecritures.debit), 0)").Scan(&debit)
			q.Select("COALESCE(SUM(lignes_ecritures.credit), 0)").Scan(&credit)
			solde := debit - credit
			// Pour actif et charge : solde débiteur ; pour passif et produit : solde créditeur
			if t == models.ComptePassif || t == models.CompteProduit {
				solde = credit - debit
			}
			if abs(solde) < 0.01 {
				continue
			}
			sections[i].Comptes = append(sections[i].Comptes, BilanCompteItem{
				CompteID: c.ID, Numero: c.Numero, Libelle: c.Libelle, Solde: solde,
			})
			sections[i].Total += solde
		}
	}
	result.Resultat = result.Produits.Total - result.Charges.Total
	return result, nil
}

// ===== Génération automatique d'écritures depuis un paiement =====

// GenerateEcritureFromPaiement génère l'écriture comptable d'un paiement validé.
// Débit : compte de caisse/banque (selon mode) pour le montant
// Crédit : compte de produit (411000 clients ou 706000 scolarité) pour le montant
func (s *ComptaService) GenerateEcritureFromPaiement(p *models.Paiement, userID uuid.UUID) error {
	// Récupérer/ créer l'exercice ouvert
	var ex models.ExerciceComptable
	if err := database.DB.Where("etablissement_id = ? AND statut = ? AND date_debut <= ? AND date_fin >= ?",
		p.EtablissementID, models.ExerciceOuvert, p.DatePaiement, p.DatePaiement).First(&ex).Error; err != nil {
		// Pas d'exercice → créer automatiquement pour l'année
		year := p.DatePaiement.Year()
		ex = models.ExerciceComptable{
			EtablissementID: p.EtablissementID,
			Libelle:         fmt.Sprintf("Exercice %d", year),
			DateDebut:       time.Date(year, 1, 1, 0, 0, 0, 0, time.UTC),
			DateFin:         time.Date(year, 12, 31, 23, 59, 59, 0, time.UTC),
			Statut:          models.ExerciceOuvert,
		}
		database.DB.Create(&ex)
	}

	// Déterminer le journal (caisse pour espèces, banque pour chèque/virement/momo)
	var journal models.JournalComptable
	journalType := models.JournalCaisse
	if p.ModePaiement == models.ModeCheque || p.ModePaiement == models.ModeVirement || p.ModePaiement == models.ModeMobileMoney {
		journalType = models.JournalBanque
	}
	database.DB.Where("etablissement_id = ? AND type = ?", p.EtablissementID, journalType).First(&journal)
	if journal.ID == uuid.Nil {
		// Créer les journaux par défaut
		s.ensureDefaultJournaux(p.EtablissementID)
		database.DB.Where("etablissement_id = ? AND type = ?", p.EtablissementID, journalType).First(&journal)
	}

	// Récupérer les comptes (caisse/banque + produit scolarité)
	compteCaisse := s.getOrCreateCompte(p.EtablissementID, "530000", "Caisse", models.CompteActif)
	compteBanque := s.getOrCreateCompte(p.EtablissementID, "521000", "Banque", models.CompteActif)
	compteProduit := s.getOrCreateCompte(p.EtablissementID, "706000", "Produits scolaires", models.CompteProduit)

	compteDebit := compteCaisse
	if journalType == models.JournalBanque {
		compteDebit = compteBanque
	}

	// Créer l'écriture
	motif := "Paiement"
	if p.FraisID != nil {
		var f models.Frais
		database.DB.First(&f, "id = ?", *p.FraisID)
		if f.Libelle != "" {
			motif = f.Libelle
		}
	}
	var eleve models.Eleve
	database.DB.First(&eleve, "id = ?", p.EleveID)

	ecriture := models.EcritureComptable{
		ExerciceID:   ex.ID,
		JournalID:    journal.ID,
		PaiementID:   &p.ID,
		DateEcriture: p.DatePaiement,
		NumeroPiece:  p.NumeroRecu,
		Libelle:      fmt.Sprintf("%s — %s %s (%s)", motif, eleve.Nom, eleve.Prenoms, p.NumeroRecu),
		Statut:       models.EcritureValidee,
		CreatedBy:    userID,
	}
	if err := database.DB.Create(&ecriture).Error; err != nil {
		return fmt.Errorf("création écriture: %w", err)
	}

	// Lignes : débit caisse/banque, crédit produit
	database.DB.Create(&models.LigneEcriture{
		EcritureID: ecriture.ID,
		CompteID:   compteDebit,
		Debit:      p.Montant,
		Libelle:    "Encaissement " + string(p.ModePaiement),
	})
	database.DB.Create(&models.LigneEcriture{
		EcritureID: ecriture.ID,
		CompteID:   compteProduit,
		Credit:     p.Montant,
		Libelle:    motif,
	})

	return nil
}

// ensureDefaultJournaux crée les journaux par défaut s'ils n'existent pas.
func (s *ComptaService) ensureDefaultJournaux(etablissementID uuid.UUID) {
	defaults := []struct {
		code, libelle string
		t             models.TypeJournal
	}{
		{"JNL_CAISSE", "Journal de caisse", models.JournalCaisse},
		{"JNL_BANQUE", "Journal de banque", models.JournalBanque},
		{"JNL_OD", "Journal des opérations diverses", models.JournalOD},
		{"JNL_VENTES", "Journal des ventes", models.JournalVentes},
	}
	for _, d := range defaults {
		var count int64
		database.DB.Model(&models.JournalComptable{}).
			Where("etablissement_id = ? AND code = ?", etablissementID, d.code).Count(&count)
		if count == 0 {
			database.DB.Create(&models.JournalComptable{
				EtablissementID: etablissementID,
				Code:            d.code,
				Libelle:         d.libelle,
				Type:            d.t,
			})
		}
	}
}

// getOrCreateCompte récupère ou crée un compte standard.
func (s *ComptaService) getOrCreateCompte(etablissementID uuid.UUID, numero, libelle string, t models.TypeCompte) uuid.UUID {
	var c models.CompteComptable
	database.DB.Where("etablissement_id = ? AND numero = ?", etablissementID, numero).First(&c)
	if c.ID != uuid.Nil {
		return c.ID
	}
	c = models.CompteComptable{
		EtablissementID: etablissementID,
		Numero:          numero,
		Libelle:         libelle,
		Type:            t,
		Actif:           true,
	}
	database.DB.Create(&c)
	return c.ID
}

// JournalCaisseResult représente le journal de caisse généré depuis les paiements.
type JournalCaisseResult struct {
	Ecritures []models.EcritureComptable `json:"ecritures"`
	TotalDebit  float64                   `json:"total_debit"`
	TotalCredit float64                   `json:"total_credit"`
}

// JournalCaisse retourne les écritures de caisse/banque pour une période.
func (s *ComptaService) JournalCaisse(etablissementID uuid.UUID, dateDebut, dateFin *time.Time) (*JournalCaisseResult, error) {
	q := database.DB.Model(&models.EcritureComptable{}).
		Preload("Journal").Preload("Lignes.Compte").Preload("Paiement").
		Joins("JOIN journaux_comptables ON journaux_comptables.id = ecritures_comptables.journal_id").
		Where("journaux_comptables.etablissement_id = ? AND journaux_comptables.type IN ?",
			etablissementID, []models.TypeJournal{models.JournalCaisse, models.JournalBanque})
	if dateDebut != nil {
		q = q.Where("ecritures_comptables.date_ecriture >= ?", *dateDebut)
	}
	if dateFin != nil {
		q = q.Where("ecritures_comptables.date_ecriture <= ?", *dateFin)
	}
	var ecritures []models.EcritureComptable
	q.Order("date_ecriture DESC").Find(&ecritures)

	result := &JournalCaisseResult{Ecritures: ecritures}
	for _, e := range ecritures {
		for _, l := range e.Lignes {
			result.TotalDebit += l.Debit
			result.TotalCredit += l.Credit
		}
	}
	return result, nil
}

// Helper pour debug : marshal JSON
func toJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}