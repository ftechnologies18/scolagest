package services

import (
        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/database"
        "github.com/scolagest/backend/internal/models"
)

// ReferentielService gère les lectures sur les cycles, classes, années scolaires.
type ReferentielService struct{}

func NewReferentielService() *ReferentielService { return &ReferentielService{} }

// ListCycles retourne les cycles d'un établissement.
// Note : on ne Preload pas les classes ici (le modèle Cycle n'a pas de
// relation Classes déclarée). Le frontend récupère les classes séparément
// via ListClasses pour la logique de cascade Cycle → Niveau → Classe.
func (s *ReferentielService) ListCycles(etablissementID *uuid.UUID) ([]models.Cycle, error) {
        q := database.Current().Model(&models.Cycle{})
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
        q := database.Current().Model(&models.Classe{}).Preload("Cycle")

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
        if err := database.Current().Order("date_debut DESC").Find(&annees).Error; err != nil {
                return nil, err
        }
        return annees, nil
}

// GetActiveAnnee retourne l'année scolaire active.
func (s *ReferentielService) GetActiveAnnee() (*models.AnneeScolaire, error) {
        var annee models.AnneeScolaire
        if err := database.Current().Where("est_active = ?", true).First(&annee).Error; err != nil {
                return nil, err
        }
        return &annee, nil
}
