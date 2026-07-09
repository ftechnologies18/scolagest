package services

import (
	"time"

	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
)

// ImpayeService gère la liste des impayés et les bordereaux de relance.
type ImpayeService struct {
	soldeSvc *SoldeService
}

func NewImpayeService(soldeSvc *SoldeService) *ImpayeService {
	return &ImpayeService{soldeSvc: soldeSvc}
}

// EcheanceEnRetard représente une échéance en retard pour un élève.
type EcheanceEnRetard struct {
	EcheanceID   uuid.UUID `json:"echeance_id"`
	Libelle      string    `json:"libelle"`
	Montant      float64   `json:"montant"`
	DateLimite   time.Time `json:"date_limite"`
	JoursRetard  int       `json:"jours_retard"`
}

// ImpayeItem représente un élève avec un solde débiteur et/ou des échéances en retard.
type ImpayeItem struct {
	EleveID            uuid.UUID           `json:"eleve_id"`
	EleveNom           string              `json:"eleve_nom"`
	ElevePrenoms       string              `json:"eleve_prenoms"`
	Classe             string              `json:"classe"`
	Categorie          string              `json:"categorie"`
	TotalAttendu       float64             `json:"total_attendu"`
	TotalPaye          float64             `json:"total_paye"`
	SoldeDu            float64             `json:"solde_du"`
	EcheancesEnRetard  []EcheanceEnRetard  `json:"echeances_en_retard"`
	NbJoursRetardMax   int                 `json:"nb_jours_retard_max"`
}

// ImpayeFilter filtre les impayés.
type ImpayeFilter struct {
	EtablissementID *uuid.UUID
	ClasseID        *uuid.UUID
	Categorie       *models.CategorieEleve
	EcheancePassee  bool // si true, ne garder que les élèves avec ≥1 échéance en retard
}

// List retourne la liste des élèves impayés.
func (s *ImpayeService) List(filter ImpayeFilter) ([]ImpayeItem, error) {
	if filter.EtablissementID == nil {
		return nil, nil
	}

	// Récupérer tous les élèves inscrits (filtrés par classe/catégorie)
	var annee models.AnneeScolaire
	database.DB.Where("est_active = ?", true).First(&annee)

	q := database.DB.Model(&models.Eleve{}).
		Select("eleves.id, eleves.nom, eleves.prenoms, eleves.categorie, classes.libelle as classe").
		Joins("JOIN inscriptions ON inscriptions.eleve_id = eleves.id").
		Joins("JOIN classes ON classes.id = inscriptions.classe_id").
		Where("inscriptions.annee_scolaire_id = ? AND eleves.etablissement_id = ?", annee.ID, *filter.EtablissementID)

	if filter.ClasseID != nil {
		q = q.Where("inscriptions.classe_id = ?", *filter.ClasseID)
	}
	if filter.Categorie != nil {
		q = q.Where("eleves.categorie = ?", *filter.Categorie)
	}

	type eleveRow struct {
		ID        uuid.UUID
		Nom       string
		Prenoms   string
		Categorie string
		Classe    string
	}
	var rows []eleveRow
	q.Scan(&rows)

	var result []ImpayeItem
	now := time.Now()
	for _, r := range rows {
		solde, _ := s.soldeSvc.GetSoldeEleve(r.ID)
		if solde == nil || solde.SoldeDu <= 0.01 {
			continue // élève à jour
		}

		// Récupérer les échéances en retard
		var echeancesRetard []EcheanceEnRetard
		joursRetardMax := 0
		for _, es := range solde.EcheancesAVenir {
			if es.Statut == "EN_RETARD" {
				jours := int(now.Sub(es.DateLimite).Hours() / 24)
				if jours > joursRetardMax {
					joursRetardMax = jours
				}
				echeancesRetard = append(echeancesRetard, EcheanceEnRetard{
					EcheanceID:  es.EcheanceID,
					Libelle:     es.Libelle,
					Montant:     es.Montant,
					DateLimite:  es.DateLimite,
					JoursRetard: jours,
				})
			}
		}

		// Si filtre échéance passée, ne garder que ceux avec au moins 1 retard
		if filter.EcheancePassee && len(echeancesRetard) == 0 {
			continue
		}

		result = append(result, ImpayeItem{
			EleveID:           r.ID,
			EleveNom:          r.Nom,
			ElevePrenoms:      r.Prenoms,
			Classe:            r.Classe,
			Categorie:         r.Categorie,
			TotalAttendu:      solde.TotalAttendu,
			TotalPaye:         solde.TotalPaye,
			SoldeDu:           solde.SoldeDu,
			EcheancesEnRetard: echeancesRetard,
			NbJoursRetardMax:  joursRetardMax,
		})
	}
	return result, nil
}

// BordereauData contient les données d'un bordereau de relance généré.
type BordereauData struct {
	Etablissement  models.Etablissement `json:"etablissement"`
	AnneeScolaire  models.AnneeScolaire `json:"annee_scolaire"`
	DateGeneration time.Time            `json:"date_generation"`
	Items          []ImpayeItem         `json:"items"`
	TotalSoldeDu   float64              `json:"total_solde_du"`
	Count          int                  `json:"count"`
}

// GenerateBordereau génère un bordereau de relance pour une liste d'élèves.
func (s *ImpayeService) GenerateBordereau(etablissementID uuid.UUID, eleveIDs []uuid.UUID) (*BordereauData, error) {
	var etb models.Etablissement
	if err := database.DB.First(&etb, "id = ?", etablissementID).Error; err != nil {
		return nil, err
	}
	var annee models.AnneeScolaire
	database.DB.Where("est_active = ?", true).First(&annee)

	var items []ImpayeItem
	total := 0.0
	for _, eid := range eleveIDs {
		solde, _ := s.soldeSvc.GetSoldeEleve(eid)
		if solde == nil || solde.SoldeDu <= 0.01 {
			continue
		}
		var eleve models.Eleve
		database.DB.First(&eleve, "id = ?", eid)
		// Classe
		var ins models.Inscription
		var classe models.Classe
		database.DB.Where("eleve_id = ? AND annee_scolaire_id = ?", eid, annee.ID).First(&ins)
		database.DB.First(&classe, "id = ?", ins.ClasseID)

		// Échéances en retard
		var echeancesRetard []EcheanceEnRetard
		now := time.Now()
		for _, es := range solde.EcheancesAVenir {
			if es.Statut == "EN_RETARD" {
				jours := int(now.Sub(es.DateLimite).Hours() / 24)
				echeancesRetard = append(echeancesRetard, EcheanceEnRetard{
					EcheanceID:  es.EcheanceID,
					Libelle:     es.Libelle,
					Montant:     es.Montant,
					DateLimite:  es.DateLimite,
					JoursRetard: jours,
				})
			}
		}

		items = append(items, ImpayeItem{
			EleveID:           eid,
			EleveNom:          eleve.Nom,
			ElevePrenoms:      eleve.Prenoms,
			Classe:            classe.Libelle,
			Categorie:         string(eleve.Categorie),
			TotalAttendu:      solde.TotalAttendu,
			TotalPaye:         solde.TotalPaye,
			SoldeDu:           solde.SoldeDu,
			EcheancesEnRetard: echeancesRetard,
		})
		total += solde.SoldeDu
	}

	return &BordereauData{
		Etablissement:  etb,
		AnneeScolaire:  annee,
		DateGeneration: time.Now(),
		Items:          items,
		TotalSoldeDu:   total,
		Count:          len(items),
	}, nil
}
