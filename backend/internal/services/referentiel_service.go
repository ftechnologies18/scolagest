package services

import (
        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/database"
        "github.com/scolagest/backend/internal/models"
)

// ReferentielService gère les lectures sur les cycles, classes, années scolaires.
type ReferentielService struct{}

func NewReferentielService() *ReferentielService { return &ReferentielService{} }

// ListCycles retourne les cycles d'un établissement, avec leurs classes.
func (s *ReferentielService) ListCycles(etablissementID *uuid.UUID) ([]models.Cycle, error) {
        q := database.DB.Model(&models.Cycle{}).Preload("Classes")
        if etablissementID != nil {
                q = q.Where("etablissement_id = ?", *etablissementID)
        }
        var cycles []models.Cycle
        if err := q.Order("ordre ASC").Find(&cycles).Error; err != nil {
                return nil, err
        }
        return cycles, nil
}

// ListClasses retourne les classes (filtrées par cycle ou établissement).
func (s *ReferentielService) ListClasses(etablissementID *uuid.UUID, cycleID *uuid.UUID) ([]models.Classe, error) {
        q := database.DB.Model(&models.Classe{}).Preload("Cycle")

        if cycleID != nil {
                q = q.Where("classes.cycle_id = ?", *cycleID)
        }

        if etablissementID != nil {
                // Sous-requête pour filtrer les classes dont le cycle appartient à l'établissement
                q = q.Where("classes.cycle_id IN (SELECT id FROM cycles WHERE etablissement_id = ?)", *etablissementID)
        }

        var classes []models.Classe
        if err := q.Order("niveau ASC, libelle ASC").Find(&classes).Error; err != nil {
                return nil, err
        }
        return classes, nil
}

// ListAnneesScolaires retourne toutes les années scolaires.
func (s *ReferentielService) ListAnneesScolaires() ([]models.AnneeScolaire, error) {
        var annees []models.AnneeScolaire
        if err := database.DB.Order("date_debut DESC").Find(&annees).Error; err != nil {
                return nil, err
        }
        return annees, nil
}

// GetActiveAnnee retourne l'année scolaire active.
func (s *ReferentielService) GetActiveAnnee() (*models.AnneeScolaire, error) {
        var annee models.AnneeScolaire
        if err := database.DB.Where("est_active = ?", true).First(&annee).Error; err != nil {
                return nil, err
        }
        return &annee, nil
}
