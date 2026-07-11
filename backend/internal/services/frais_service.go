package services

import (
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
	"gorm.io/gorm"
)

// FraisService gère le paramétrage des frais et échéanciers.
type FraisService struct{}

func NewFraisService() *FraisService { return &FraisService{} }

// EcheanceDTO représente une tranche d'échéancier (création/modification).
type EcheanceDTO struct {
	Rang       int        `json:"rang"`
	Libelle    string     `json:"libelle"`
	Montant    float64    `json:"montant"`
	DateLimite time.Time  `json:"date_limite"`
}

// FraisDTO pour création/modification d'un frais (avec ses échéances).
type FraisDTO struct {
	AnneeScolaireID    uuid.UUID              `json:"annee_scolaire_id"`
	CycleID            *uuid.UUID             `json:"cycle_id"`
	ClasseID           *uuid.UUID             `json:"classe_id"`
	TypeFrais          models.TypeFrais       `json:"type_frais"`
	Categorie          *models.CategorieEleve `json:"categorie"`
	Libelle            string                 `json:"libelle"`
	MontantTotal       float64                `json:"montant_total"`
	NbVersementsDefaut int                    `json:"nb_versements_defaut"`
	Echeances          []EcheanceDTO          `json:"echeances"`
}

// List retourne les frais d'un établissement pour une année, avec échéances.
func (s *FraisService) List(etablissementID, anneeScolaireID *uuid.UUID) ([]models.Frais, error) {
	q := database.Current().Model(&models.Frais{}).
		Preload("Echeances").
		Preload("Cycle").
		Preload("Classe").
		Preload("AnneeScolaire")
	if etablissementID != nil {
		q = q.Where("etablissement_id = ?", *etablissementID)
	}
	if anneeScolaireID != nil {
		q = q.Where("annee_scolaire_id = ?", *anneeScolaireID)
	}
	var frais []models.Frais
	if err := q.Order("type_frais ASC, categorie ASC, libelle ASC").Find(&frais).Error; err != nil {
		return nil, err
	}
	return frais, nil
}

// Get retourne un frais par ID avec ses échéances.
func (s *FraisService) Get(id uuid.UUID) (*models.Frais, error) {
	var frais models.Frais
	if err := database.Current().
		Preload("Echeances", "eleve_id IS NULL").
		Preload("Cycle").
		Preload("Classe").
		Preload("AnneeScolaire").
		First(&frais, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("frais introuvable")
		}
		return nil, err
	}
	return &frais, nil
}

// Create crée un frais + ses échéances (modèle générique).
func (s *FraisService) Create(dto FraisDTO, etablissementID uuid.UUID) (*models.Frais, error) {
	// Validations
	if dto.Libelle == "" {
		return nil, errors.New("le libellé est obligatoire")
	}
	if dto.MontantTotal <= 0 {
		return nil, errors.New("le montant total doit être positif")
	}
	if dto.NbVersementsDefaut < 1 {
		dto.NbVersementsDefaut = 1
	}
	if len(dto.Echeances) == 0 {
		return nil, errors.New("au moins une échéance est requise")
	}

	// Vérifier l'établissement
	var etb models.Etablissement
	if err := database.Current().First(&etb, "id = ?", etablissementID).Error; err != nil {
		return nil, errors.New("établissement introuvable")
	}

	// Cohérence catégorie / établissement
	if !etb.AppliqueCategorieAffecte && dto.Categorie != nil {
		dto.Categorie = nil // forcer tarif unique
	}

	// Vérifier l'unicité (etablissement + année + type + classe + categorie)
	if err := s.checkUnicity(etablissementID, dto, uuid.Nil); err != nil {
		return nil, err
	}

	// Vérifier la somme des échéances = montant_total
	totalEcheances := 0.0
	for _, e := range dto.Echeances {
		totalEcheances += e.Montant
	}
	if abs(totalEcheances-dto.MontantTotal) > 0.01 {
		return nil, fmt.Errorf("la somme des échéances (%.2f) ne correspond pas au montant total (%.2f)", totalEcheances, dto.MontantTotal)
	}

	// Créer le frais
	frais := models.Frais{
		EtablissementID:    etablissementID,
		AnneeScolaireID:    dto.AnneeScolaireID,
		CycleID:            dto.CycleID,
		ClasseID:           dto.ClasseID,
		TypeFrais:          dto.TypeFrais,
		Categorie:          dto.Categorie,
		Libelle:            dto.Libelle,
		MontantTotal:       dto.MontantTotal,
		NbVersementsDefaut: dto.NbVersementsDefaut,
		Actif:              true,
	}
	if err := database.Current().Create(&frais).Error; err != nil {
		return nil, fmt.Errorf("création frais: %w", err)
	}

	// Créer les échéances (modèle générique, eleve_id = NULL)
	for _, e := range dto.Echeances {
		echeance := models.Echeance{
			FraisID:    frais.ID,
			Rang:       e.Rang,
			Libelle:    e.Libelle,
			Montant:    e.Montant,
			DateLimite: e.DateLimite,
		}
		if err := database.Current().Create(&echeance).Error; err != nil {
			return nil, fmt.Errorf("création échéance %d: %w", e.Rang, err)
		}
	}

	return s.Get(frais.ID)
}

// Update modifie un frais + remplace ses échéances.
func (s *FraisService) Update(id uuid.UUID, dto FraisDTO) (*models.Frais, error) {
	var frais models.Frais
	if err := database.Current().First(&frais, "id = ?", id).Error; err != nil {
		return nil, errors.New("frais introuvable")
	}

	// Vérifier unicité (excluant l'ID courant)
	if err := s.checkUnicity(frais.EtablissementID, dto, id); err != nil {
		return nil, err
	}

	// Vérifier somme échéances
	totalEcheances := 0.0
	for _, e := range dto.Echeances {
		totalEcheances += e.Montant
	}
	if abs(totalEcheances-dto.MontantTotal) > 0.01 {
		return nil, fmt.Errorf("la somme des échéances (%.2f) ne correspond pas au montant total (%.2f)", totalEcheances, dto.MontantTotal)
	}

	// Mettre à jour le frais
	updates := map[string]interface{}{
		"cycle_id":             dto.CycleID,
		"classe_id":            dto.ClasseID,
		"type_frais":           dto.TypeFrais,
		"categorie":            dto.Categorie,
		"libelle":              dto.Libelle,
		"montant_total":        dto.MontantTotal,
		"nb_versements_defaut": dto.NbVersementsDefaut,
	}
	if err := database.Current().Model(&frais).Updates(updates).Error; err != nil {
		return nil, err
	}

	// Remplacer les échéances génériques (eleve_id IS NULL)
	// NB: on ne supprime pas les échéances dérogatoires (eleve_id NOT NULL)
	database.Current().Where("frais_id = ? AND eleve_id IS NULL", id).Delete(&models.Echeance{})
	for _, e := range dto.Echeances {
		echeance := models.Echeance{
			FraisID:    id,
			Rang:       e.Rang,
			Libelle:    e.Libelle,
			Montant:    e.Montant,
			DateLimite: e.DateLimite,
		}
		database.Current().Create(&echeance)
	}

	return s.Get(id)
}

// Delete supprime un frais + ses échéances génériques.
// Refusé si des paiements y sont rattachés.
func (s *FraisService) Delete(id uuid.UUID) error {
	var count int64
	database.Current().Model(&models.Paiement{}).Where("frais_id = ?", id).Count(&count)
	if count > 0 {
		return errors.New("impossible de supprimer un frais ayant des paiements rattachés")
	}
	// Supprimer les échéances génériques
	database.Current().Where("frais_id = ? AND eleve_id IS NULL", id).Delete(&models.Echeance{})
	result := database.Current().Delete(&models.Frais{}, "id = ?", id)
	if result.RowsAffected == 0 {
		return errors.New("frais introuvable")
	}
	return result.Error
}

// ListEcheances retourne les échéances d'un frais (modèle générique uniquement).
func (s *FraisService) ListEcheances(fraisID uuid.UUID) ([]models.Echeance, error) {
	var echeances []models.Echeance
	if err := database.Current().Where("frais_id = ? AND eleve_id IS NULL", fraisID).
		Order("rang ASC").Find(&echeances).Error; err != nil {
		return nil, err
	}
	return echeances, nil
}

// checkUnicity vérifie qu'il n'existe pas déjà un frais identique.
func (s *FraisService) checkUnicity(etablissementID uuid.UUID, dto FraisDTO, excludeID uuid.UUID) error {
	q := database.Current().Model(&models.Frais{}).
		Where("etablissement_id = ? AND annee_scolaire_id = ? AND type_frais = ?",
			etablissementID, dto.AnneeScolaireID, dto.TypeFrais)
	if excludeID != uuid.Nil {
		q = q.Where("id != ?", excludeID)
	}
	if dto.ClasseID != nil {
		q = q.Where("classe_id = ?", *dto.ClasseID)
	} else if dto.CycleID != nil {
		q = q.Where("cycle_id = ? AND classe_id IS NULL", *dto.CycleID)
	} else {
		q = q.Where("cycle_id IS NULL AND classe_id IS NULL")
	}
	if dto.Categorie != nil {
		q = q.Where("categorie = ?", *dto.Categorie)
	} else {
		q = q.Where("categorie IS NULL")
	}
	var count int64
	q.Count(&count)
	if count > 0 {
		return errors.New("un frais identique existe déjà pour ce périmètre (établissement + année + type + classe + catégorie)")
	}
	return nil
}

func abs(x float64) float64 {
	if x < 0 {
		return -x
	}
	return x
}
