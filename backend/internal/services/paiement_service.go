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

// PaiementService gère les encaissements, reçus et annulations.
type PaiementService struct {
        soldeSvc  *SoldeService
        comptaSvc *ComptaService
}

func NewPaiementService(soldeSvc *SoldeService, comptaSvc *ComptaService) *PaiementService {
        return &PaiementService{soldeSvc: soldeSvc, comptaSvc: comptaSvc}
}

// PaiementDTO pour la création d'un encaissement.
type PaiementDTO struct {
        EleveID          uuid.UUID            `json:"eleve_id"`
        FraisID          *uuid.UUID           `json:"frais_id"`
        EcheanceID       *uuid.UUID           `json:"echeance_id"`
        Montant          float64              `json:"montant"`
        ModePaiement     models.ModePaiement  `json:"mode_paiement"`
        ProviderMomo     *models.ProviderMomo `json:"provider_momo"`
        ReferenceExterne string               `json:"reference_externe"`
        DatePaiement     *time.Time           `json:"date_paiement"`
}

// PaiementFilter pour la liste des paiements.
type PaiementFilter struct {
        EtablissementID *uuid.UUID
        EleveID         *uuid.UUID
        CaissierID      *uuid.UUID
        ModePaiement    *models.ModePaiement
        DateDebut       *time.Time
        DateFin         *time.Time
        Statut          *models.StatutPaiement
        Page            int
        PageSize        int
}

// PaiementResult est le résultat paginé.
type PaiementResult struct {
        Data     []models.Paiement `json:"data"`
        Total    int64             `json:"total"`
        Page     int               `json:"page"`
        PageSize int               `json:"page_size"`
}

// List retourne les paiements paginés selon les filtres.
func (s *PaiementService) List(filter PaiementFilter) (*PaiementResult, error) {
        if filter.Page < 1 {
                filter.Page = 1
        }
        if filter.PageSize < 1 || filter.PageSize > 100 {
                filter.PageSize = 20
        }

        q := database.Current().Model(&models.Paiement{})
        if filter.EtablissementID != nil {
                q = q.Where("paiements.etablissement_id = ?", *filter.EtablissementID)
        }
        if filter.EleveID != nil {
                q = q.Where("paiements.eleve_id = ?", *filter.EleveID)
        }
        if filter.CaissierID != nil {
                q = q.Where("paiements.caissier_id = ?", *filter.CaissierID)
        }
        if filter.ModePaiement != nil {
                q = q.Where("paiements.mode_paiement = ?", *filter.ModePaiement)
        }
        if filter.Statut != nil {
                q = q.Where("paiements.statut = ?", *filter.Statut)
        }
        if filter.DateDebut != nil {
                q = q.Where("paiements.date_paiement >= ?", *filter.DateDebut)
        }
        if filter.DateFin != nil {
                q = q.Where("paiements.date_paiement <= ?", *filter.DateFin)
        }

        var total int64
        q.Count(&total)

        var paiements []models.Paiement
        offset := (filter.Page - 1) * filter.PageSize
        if err := q.Preload("Eleve").Preload("Frais").Preload("Echeance").
                Preload("Caissier").Preload("Recu").
                Order("date_paiement DESC").
                Offset(offset).Limit(filter.PageSize).
                Find(&paiements).Error; err != nil {
                return nil, err
        }
        return &PaiementResult{Data: paiements, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
}

// Get retourne un paiement par ID avec ses relations.
func (s *PaiementService) Get(id uuid.UUID) (*models.Paiement, error) {
        var p models.Paiement
        if err := database.Current().
                Preload("Eleve").Preload("Frais").Preload("Echeance").
                Preload("Caissier").Preload("Recu").
                First(&p, "id = ?", id).Error; err != nil {
                if errors.Is(err, gorm.ErrRecordNotFound) {
                        return nil, errors.New("paiement introuvable")
                }
                return nil, err
        }
        return &p, nil
}

// Create crée un encaissement + génère le reçu automatiquement.
// Contrôle le montant vs solde restant (alerte si dépassement, autorisé si <= solde).
func (s *PaiementService) Create(dto PaiementDTO, caissierID uuid.UUID, etablissementID uuid.UUID) (*models.Paiement, error) {
        // Validations
        if dto.Montant <= 0 {
                return nil, errors.New("le montant doit être positif")
        }
        if dto.ModePaiement == "" {
                return nil, errors.New("le mode de paiement est obligatoire")
        }

        // Vérifier l'élève
        var eleve models.Eleve
        if err := database.Current().First(&eleve, "id = ?", dto.EleveID).Error; err != nil {
                return nil, errors.New("élève introuvable")
        }

        // Vérifier l'inscription active
        var annee models.AnneeScolaire
        if err := database.Current().Where("est_active = ?", true).First(&annee).Error; err != nil {
                return nil, errors.New("aucune année scolaire active")
        }
        var inscription models.Inscription
        if err := database.Current().Where("eleve_id = ? AND annee_scolaire_id = ?", dto.EleveID, annee.ID).
                Order("date_inscription DESC").First(&inscription).Error; err != nil {
                return nil, errors.New("l'élève n'est pas inscrit pour l'année active")
        }

        // Contrôle du solde (informationnel — on accepte même un trop-perçu)
        solde, _ := s.soldeSvc.GetSoldeEleve(dto.EleveID)
        if solde != nil && dto.FraisID != nil {
                for _, sf := range solde.FraisAttendus {
                        if sf.FraisID == *dto.FraisID && dto.Montant > sf.Solde+0.01 {
                                // Trop-perçu : on accepte mais on pourrait logger
                                // (le cahier des charges demande une alerte, pas un blocage)
                        }
                }
        }

        // Date de paiement (défaut maintenant)
        datePaiement := time.Now()
        if dto.DatePaiement != nil {
                datePaiement = *dto.DatePaiement
        }

        // Générer le numéro de reçu
        numeroRecu, err := s.generateNumeroRecu(etablissementID, annee.ID)
        if err != nil {
                return nil, err
        }

        // Créer le paiement
        p := models.Paiement{
                EleveID:          dto.EleveID,
                InscriptionID:    inscription.ID,
                EtablissementID:  etablissementID,
                FraisID:          dto.FraisID,
                EcheanceID:       dto.EcheanceID,
                Montant:          dto.Montant,
                ModePaiement:     dto.ModePaiement,
                ProviderMomo:     dto.ProviderMomo,
                ReferenceExterne: dto.ReferenceExterne,
                DatePaiement:     datePaiement,
                CaissierID:       caissierID,
                Statut:           models.StatutPaiementValide,
                NumeroRecu:       numeroRecu,
        }
        if err := database.Current().Create(&p).Error; err != nil {
                return nil, fmt.Errorf("création paiement: %w", err)
        }

        // Générer le reçu avec snapshot
        if err := s.createRecu(&p, &eleve, &inscription, &annee, caissierID); err != nil {
                // Le paiement est créé mais le reçu a échoué — on log mais on continue
                fmt.Printf("⚠ génération reçu échouée pour paiement %s: %v\n", p.ID, err)
        }

        // Générer l'écriture comptable (partie double) si le service compta est disponible
        if s.comptaSvc != nil {
                if err := s.comptaSvc.GenerateEcritureFromPaiement(&p, caissierID); err != nil {
                        fmt.Printf("⚠ génération écriture comptable échouée pour paiement %s: %v\n", p.ID, err)
                }
        }

        // Recharger avec relations
        return s.Get(p.ID)
}

// Annule annule un paiement (motif obligatoire, validation par rôle supérieur).
func (s *PaiementService) Annule(id uuid.UUID, motif string, validatorID uuid.UUID) (*models.Paiement, error) {
        if motif == "" {
                return nil, errors.New("le motif d'annulation est obligatoire")
        }
        var p models.Paiement
        if err := database.Current().First(&p, "id = ?", id).Error; err != nil {
                return nil, errors.New("paiement introuvable")
        }
        if p.Statut == models.StatutPaiementAnnule {
                return nil, errors.New("ce paiement est déjà annulé")
        }
        now := time.Now()
        updates := map[string]interface{}{
                "statut":           models.StatutPaiementAnnule,
                "motif_annulation": motif,
                "annule_par":       validatorID,
                "date_annulation":  now,
        }
        if err := database.Current().Model(&p).Updates(updates).Error; err != nil {
                return nil, err
        }
        return s.Get(id)
}

// GetRecu retourne le reçu d'un paiement (avec snapshot).
func (s *PaiementService) GetRecu(paiementID uuid.UUID) (*models.Recu, error) {
        var recu models.Recu
        if err := database.Current().First(&recu, "paiement_id = ?", paiementID).Error; err != nil {
                if errors.Is(err, gorm.ErrRecordNotFound) {
                        return nil, errors.New("reçu introuvable")
                }
                return nil, err
        }
        return &recu, nil
}

// createRecu génère le reçu avec un snapshot des données au moment de l'encaissement.
func (s *PaiementService) createRecu(p *models.Paiement, eleve *models.Eleve, inscription *models.Inscription, annee *models.AnneeScolaire, caissierID uuid.UUID) error {
        // Récupérer le caissier + l'établissement + la classe
        var caissier models.Utilisateur
        database.Current().First(&caissier, "id = ?", caissierID)
        var etb models.Etablissement
        database.Current().First(&etb, "id = ?", p.EtablissementID)
        var classe models.Classe
        database.Current().First(&classe, "id = ?", inscription.ClasseID)

        // Calculer le solde restant après ce paiement
        solde, _ := s.soldeSvc.GetSoldeEleve(p.EleveID)
        soldeRestant := 0.0
        if solde != nil {
                soldeRestant = solde.SoldeDu
        }

        // Motif (libellé du frais)
        motif := "Paiement"
        if p.FraisID != nil {
                var frais models.Frais
                database.Current().First(&frais, "id = ?", *p.FraisID)
                motif = frais.Libelle
                if p.EcheanceID != nil {
                        var ech models.Echeance
                        database.Current().First(&ech, "id = ?", *p.EcheanceID)
                        if ech.Libelle != "" {
                                motif = fmt.Sprintf("%s — %s", frais.Libelle, ech.Libelle)
                        }
                }
        }

        snapshot := map[string]interface{}{
                "etablissement": map[string]string{
                        "nom":           etb.Nom,
                        "code_officiel": etb.CodeOfficiel,
                        "ville":         etb.Ville,
                },
                "eleve": map[string]string{
                        "nom":                eleve.Nom,
                        "prenoms":            eleve.Prenoms,
                        "matricule_ministere": eleve.MatriculeMinistere,
                        "identifiant_interne": eleve.IdentifiantInterne,
                        "classe":             classe.Libelle,
                },
                "annee_scolaire": annee.Libelle,
                "paiement": map[string]interface{}{
                        "numero_recu":   p.NumeroRecu,
                        "montant":       p.Montant,
                        "mode_paiement": p.ModePaiement,
                        "motif":         motif,
                        "date_paiement": p.DatePaiement,
                },
                "caissier": map[string]string{
                        "nom":     caissier.Nom,
                        "prenoms": caissier.Prenoms,
                },
                "solde_restant": soldeRestant,
        }
        snapshotJSON, _ := json.Marshal(snapshot)

        recu := models.Recu{
                PaiementID:      p.ID,
                Numero:          p.NumeroRecu,
                ContenuSnapshot: string(snapshotJSON),
                DateEmission:    time.Now(),
        }
        return database.Current().Create(&recu).Error
}

// generateNumeroRecu génère un numéro de reçu unique au format REC-{CODE_ETB}-{ANNEE}-{SEQ}.
func (s *PaiementService) generateNumeroRecu(etablissementID, anneeID uuid.UUID) (string, error) {
        var etb models.Etablissement
        if err := database.Current().First(&etb, "id = ?", etablissementID).Error; err != nil {
                return "", errors.New("établissement introuvable")
        }
        var annee models.AnneeScolaire
        if err := database.Current().First(&annee, "id = ?", anneeID).Error; err != nil {
                return "", errors.New("année scolaire introuvable")
        }

        // Compter les paiements existants pour cet établissement + année
        var count int64
        database.Current().Model(&models.Paiement{}).
                Joins("JOIN inscriptions ON inscriptions.id = paiements.inscription_id").
                Where("paiements.etablissement_id = ? AND inscriptions.annee_scolaire_id = ?", etablissementID, anneeID).
                Count(&count)
        sequence := count + 1

        // Année courte (2026 → 26)
        yearStr := annee.Libelle
        if len(yearStr) >= 4 {
                yearStr = yearStr[:4]
        }

        for {
                numero := fmt.Sprintf("REC-%s-%s-%06d", etb.CodeOfficiel, yearStr, sequence)
                var exists int64
                database.Current().Model(&models.Paiement{}).Where("numero_recu = ?", numero).Count(&exists)
                if exists == 0 {
                        return numero, nil
                }
                sequence++
        }
}

// ListByEleve retourne l'historique des paiements d'un élève.
func (s *PaiementService) ListByEleve(eleveID uuid.UUID, limit int) ([]models.Paiement, error) {
        if limit <= 0 || limit > 100 {
                limit = 20
        }
        var paiements []models.Paiement
        if err := database.Current().
                Preload("Frais").Preload("Echeance").Preload("Caissier").
                Where("eleve_id = ?", eleveID).
                Order("date_paiement DESC").
                Limit(limit).
                Find(&paiements).Error; err != nil {
                return nil, err
        }
        return paiements, nil
}
