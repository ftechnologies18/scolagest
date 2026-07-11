package services

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
	"gorm.io/gorm"
)

// ClotureService gère les clôtures journalières de caisse.
type ClotureService struct{}

func NewClotureService() *ClotureService { return &ClotureService{} }

// ClotureDTO pour créer/modifier une clôture.
type ClotureDTO struct {
	TotalRemis float64 `json:"total_remis"`
	Notes      string  `json:"notes"`
}

// GetAujourdhui retourne la clôture du jour pour un caissier/établissement (ou null).
func (s *ClotureService) GetAujourdhui(caissierID, etablissementID uuid.UUID) (*models.ClotureCaisse, error) {
	var cloture models.ClotureCaisse
	today := time.Now()
	start := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	end := start.Add(24 * time.Hour)
	err := database.Current().Where("caissier_id = ? AND etablissement_id = ? AND date_cloture >= ? AND date_cloture < ?",
		caissierID, etablissementID, start, end).First(&cloture).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &cloture, nil
}

// Create crée ou met à jour la clôture du jour.
// Calcule le total théorique à partir des paiements valides du jour.
func (s *ClotureService) Create(dto ClotureDTO, caissierID, etablissementID uuid.UUID) (*models.ClotureCaisse, error) {
	totalTheorique, err := s.computeTotalTheorique(caissierID, etablissementID)
	if err != nil {
		return nil, err
	}

	// Vérifier si une clôture existe déjà aujourd'hui
	existing, err := s.GetAujourdhui(caissierID, etablissementID)
	if err != nil {
		return nil, err
	}

	if existing != nil {
		// Mettre à jour
		updates := map[string]interface{}{
			"total_theorique": totalTheorique,
			"total_remis":     dto.TotalRemis,
			"ecart":           dto.TotalRemis - totalTheorique,
			"notes":           dto.Notes,
			"statut":          models.StatutClotureCloturee,
		}
		if err := database.Current().Model(existing).Updates(updates).Error; err != nil {
			return nil, err
		}
		return s.GetAujourdhui(caissierID, etablissementID)
	}

	// Créer
	cloture := models.ClotureCaisse{
		CaissierID:      caissierID,
		EtablissementID: etablissementID,
		DateCloture:     time.Now(),
		TotalTheorique:  totalTheorique,
		TotalRemis:      dto.TotalRemis,
		Ecart:           dto.TotalRemis - totalTheorique,
		Statut:          models.StatutClotureCloturee,
		Notes:           dto.Notes,
	}
	if err := database.Current().Create(&cloture).Error; err != nil {
		return nil, err
	}
	return &cloture, nil
}

// Valider valide une clôture (par un superviseur COMPTABLE/ADMINISTRATEUR).
func (s *ClotureService) Valider(id, validatorID uuid.UUID) (*models.ClotureCaisse, error) {
	var cloture models.ClotureCaisse
	if err := database.Current().First(&cloture, "id = ?", id).Error; err != nil {
		return nil, errors.New("clôture introuvable")
	}
	if err := database.Current().Model(&cloture).Updates(map[string]interface{}{
		"statut":     models.StatutClotureValidee,
		"valide_par": validatorID,
	}).Error; err != nil {
		return nil, err
	}
	database.Current().First(&cloture, "id = ?", id)
	return &cloture, nil
}

// List retourne les clôtures selon les filtres.
func (s *ClotureService) List(etablissementID *uuid.UUID, caissierID *uuid.UUID, date *time.Time) ([]models.ClotureCaisse, error) {
	q := database.Current().Model(&models.ClotureCaisse{}).Preload("Caissier")
	if etablissementID != nil {
		q = q.Where("etablissement_id = ?", *etablissementID)
	}
	if caissierID != nil {
		q = q.Where("caissier_id = ?", *caissierID)
	}
	if date != nil {
		start := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
		end := start.Add(24 * time.Hour)
		q = q.Where("date_cloture >= ? AND date_cloture < ?", start, end)
	}
	var clotures []models.ClotureCaisse
	if err := q.Order("date_cloture DESC").Find(&clotures).Error; err != nil {
		return nil, err
	}
	return clotures, nil
}

// computeTotalTheorique calcule la somme des paiements valides du jour.
func (s *ClotureService) computeTotalTheorique(caissierID, etablissementID uuid.UUID) (float64, error) {
	today := time.Now()
	start := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
	end := start.Add(24 * time.Hour)
	var total float64
	err := database.Current().Model(&models.Paiement{}).
		Where("caissier_id = ? AND etablissement_id = ? AND statut = ? AND date_paiement >= ? AND date_paiement < ?",
			caissierID, etablissementID, models.StatutPaiementValide, start, end).
		Select("COALESCE(SUM(montant), 0)").Scan(&total).Error
	return total, err
}
