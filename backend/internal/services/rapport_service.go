package services

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
)

// RapportService génère les rapports filtrables et exports.
type RapportService struct {
	soldeSvc *SoldeService
}

func NewRapportService(soldeSvc *SoldeService) *RapportService {
	return &RapportService{soldeSvc: soldeSvc}
}

// RapportPaiementFilter filtre les paiements pour le rapport.
type RapportPaiementFilter struct {
	EtablissementID *uuid.UUID
	DateDebut       *time.Time
	DateFin         *time.Time
	CycleID         *uuid.UUID
	ClasseID        *uuid.UUID
	Categorie       *models.CategorieEleve
	ModePaiement    *models.ModePaiement
	CaissierID      *uuid.UUID
}

// RapportPaiementsResult est le résultat du rapport des paiements.
type RapportPaiementsResult struct {
	Data         []models.Paiement `json:"data"`
	TotalMontant float64           `json:"total_montant"`
	Count        int               `json:"count"`
}

// RapportPaiements génère le rapport des paiements filtré.
func (s *RapportService) RapportPaiements(filter RapportPaiementFilter) (*RapportPaiementsResult, error) {
	q := database.DB.Model(&models.Paiement{}).
		Preload("Eleve").Preload("Frais").Preload("Echeance").Preload("Caissier").
		Where("paiements.statut = ?", models.StatutPaiementValide)

	if filter.EtablissementID != nil {
		q = q.Where("paiements.etablissement_id = ?", *filter.EtablissementID)
	}
	if filter.DateDebut != nil {
		q = q.Where("paiements.date_paiement >= ?", *filter.DateDebut)
	}
	if filter.DateFin != nil {
		q = q.Where("paiements.date_paiement <= ?", *filter.DateFin)
	}
	if filter.ModePaiement != nil {
		q = q.Where("paiements.mode_paiement = ?", *filter.ModePaiement)
	}
	if filter.CaissierID != nil {
		q = q.Where("paiements.caissier_id = ?", *filter.CaissierID)
	}
	// Filtres cycle/classe/catégorie → jointure sur eleve + inscriptions
	if filter.CycleID != nil || filter.ClasseID != nil || filter.Categorie != nil {
		q = q.Joins("JOIN eleves ON eleves.id = paiements.eleve_id").
			Joins("JOIN inscriptions ON inscriptions.id = paiements.inscription_id")
		if filter.CycleID != nil {
			q = q.Joins("JOIN classes ON classes.id = inscriptions.classe_id").
				Where("classes.cycle_id = ?", *filter.CycleID)
		}
		if filter.ClasseID != nil {
			q = q.Where("inscriptions.classe_id = ?", *filter.ClasseID)
		}
		if filter.Categorie != nil {
			q = q.Where("eleves.categorie = ?", *filter.Categorie)
		}
	}

	var paiements []models.Paiement
	if err := q.Order("paiements.date_paiement DESC").Find(&paiements).Error; err != nil {
		return nil, err
	}

	total := 0.0
	for _, p := range paiements {
		total += p.Montant
	}
	return &RapportPaiementsResult{Data: paiements, TotalMontant: total, Count: len(paiements)}, nil
}

// RapportPaiementsCSV génère le rapport des paiements en CSV.
func (s *RapportService) RapportPaiementsCSV(filter RapportPaiementFilter) ([]byte, string, error) {
	result, err := s.RapportPaiements(filter)
	if err != nil {
		return nil, "", err
	}

	var buf bytes.Buffer
	// BOM UTF-8 pour Excel
	buf.Write([]byte{0xEF, 0xBB, 0xBF})
	w := csv.NewWriter(&buf)

	// En-tête
	w.Write([]string{"N° Reçu", "Date", "Élève", "Matricule", "Classe", "Motif", "Montant (FCFA)", "Mode", "Caissier", "Statut"})

	for _, p := range result.Data {
		eleveNom := ""
		matricule := ""
		classe := ""
		motif := ""
		caissier := ""
		if p.Eleve != nil {
			eleveNom = fmt.Sprintf("%s %s", p.Eleve.Nom, p.Eleve.Prenoms)
			matricule = p.Eleve.MatriculeMinistere
			if matricule == "" {
				matricule = p.Eleve.IdentifiantInterne
			}
		}
		if p.Frais != nil {
			motif = p.Frais.Libelle
		}
		if p.Caissier != nil {
			caissier = fmt.Sprintf("%s %s", p.Caissier.Nom, p.Caissier.Prenoms)
		}
		// Classe via inscription (non préchargée — on la récupère)
		if p.InscriptionID != uuid.Nil {
			var ins models.Inscription
			database.DB.Preload("Classe").First(&ins, "id = ?", p.InscriptionID)
			if ins.Classe != nil {
				classe = ins.Classe.Libelle
			}
		}
		dateStr := p.DatePaiement.Format("02/01/2006 15:04")
		w.Write([]string{
			p.NumeroRecu,
			dateStr,
			eleveNom,
			matricule,
			classe,
			motif,
			fmt.Sprintf("%.0f", p.Montant),
			string(p.ModePaiement),
			caissier,
			string(p.Statut),
		})
	}
	// Ligne total
	w.Write([]string{"", "", "", "", "", "TOTAL", fmt.Sprintf("%.0f", result.TotalMontant), "", "", ""})
	w.Flush()

	filename := fmt.Sprintf("rapport_paiements_%s.csv", time.Now().Format("20060102"))
	return buf.Bytes(), filename, nil
}

// RapportSoldesResult est le résultat du rapport des soldes.
type RapportSoldesResult struct {
	Data         []SoldeListItem `json:"data"`
	TotalAttendu float64         `json:"total_attendu"`
	TotalPaye    float64         `json:"total_paye"`
	TotalSoldeDu float64         `json:"total_solde_du"`
	Count        int             `json:"count"`
}

// RapportSoldes génère le rapport des soldes par élève.
func (s *RapportService) RapportSoldes(etablissementID uuid.UUID, classeID *uuid.UUID, categorie *models.CategorieEleve) (*RapportSoldesResult, error) {
	soldes, err := s.soldeSvc.ListSoldes(etablissementID, classeID, categorie)
	if err != nil {
		return nil, err
	}
	result := &RapportSoldesResult{Data: soldes, Count: len(soldes)}
	for _, sl := range soldes {
		result.TotalAttendu += sl.TotalAttendu
		result.TotalPaye += sl.TotalPaye
		result.TotalSoldeDu += sl.SoldeDu
	}
	return result, nil
}

// RecouvrementItem représente une ligne du rapport de recouvrement par classe.
type RecouvrementItem struct {
	Classe     string  `json:"classe"`
	Attendu    float64 `json:"attendu"`
	Encaisse   float64 `json:"encaisse"`
	Taux       float64 `json:"taux"`
	NbEleves   int     `json:"nb_eleves"`
	NbImpayes  int     `json:"nb_impayes"`
}

// RecouvrementResult est le rapport de recouvrement.
type RecouvrementResult struct {
	Data   []RecouvrementItem `json:"data"`
	Resume RecouvrementResume `json:"resume"`
}

// RecouvrementResume est le résumé du rapport de recouvrement.
type RecouvrementResume struct {
	Attendu  float64 `json:"attendu"`
	Encaisse float64 `json:"encaisse"`
	Taux     float64 `json:"taux"`
}

// RapportRecouvrement génère le rapport de recouvrement par classe.
func (s *RapportService) RapportRecouvrement(etablissementID uuid.UUID, cycleID *uuid.UUID) (*RecouvrementResult, error) {
	// Récupérer les classes (filtrées par cycle si fourni)
	q := database.DB.Model(&models.Classe{}).
		Joins("JOIN cycles ON cycles.id = classes.cycle_id").
		Where("cycles.etablissement_id = ?", etablissementID)
	if cycleID != nil {
		q = q.Where("classes.cycle_id = ?", *cycleID)
	}
	var classes []models.Classe
	q.Preload("Cycle").Order("cycles.ordre, classes.niveau, classes.libelle").Find(&classes)

	var annee models.AnneeScolaire
	database.DB.Where("est_active = ?", true).First(&annee)

	result := &RecouvrementResult{}
	for _, c := range classes {
		// Récupérer les élèves de cette classe
		var eleveIDs []uuid.UUID
		database.DB.Model(&models.Inscription{}).
			Where("classe_id = ? AND annee_scolaire_id = ?", c.ID, annee.ID).
			Pluck("eleve_id", &eleveIDs)
		if len(eleveIDs) == 0 {
			continue
		}
		var attendu, encaisse float64
		nbImpayes := 0
		for _, eid := range eleveIDs {
			solde, _ := s.soldeSvc.GetSoldeEleve(eid)
			if solde != nil {
				attendu += solde.TotalAttendu
				encaisse += solde.TotalPaye
				if solde.SoldeDu > 0.01 {
					nbImpayes++
				}
			}
		}
		taux := 0.0
		if attendu > 0 {
			taux = (encaisse / attendu) * 100
		}
		result.Data = append(result.Data, RecouvrementItem{
			Classe:    c.Libelle,
			Attendu:   attendu,
			Encaisse:  encaisse,
			Taux:      taux,
			NbEleves:  len(eleveIDs),
			NbImpayes: nbImpayes,
		})
		result.Resume.Attendu += attendu
		result.Resume.Encaisse += encaisse
	}
	if result.Resume.Attendu > 0 {
		result.Resume.Taux = (result.Resume.Encaisse / result.Resume.Attendu) * 100
	}
	return result, nil
}
