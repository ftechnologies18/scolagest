package services

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
	"gorm.io/gorm"
)

// TuteurService gère les tuteurs/parents d'élèves.
type TuteurService struct{}

func NewTuteurService() *TuteurService { return &TuteurService{} }

// TuteurDTO pour création/modification.
type TuteurDTO struct {
	Nom          string             `json:"nom"`
	Prenoms      string             `json:"prenoms"`
	Telephone    string             `json:"telephone"`
	Telephone2   string             `json:"telephone2"`
	Email        string             `json:"email"`
	Adresse      string             `json:"adresse"`
	LienParente  models.LienParente `json:"lien_parente"`
	Profession   string             `json:"profession"`
	Actif        *bool              `json:"actif"`
}

// List retourne les tuteurs, avec recherche optionnelle.
func (s *TuteurService) List(search string, etablissementID *uuid.UUID) ([]models.Tuteur, error) {
	q := database.DB.Model(&models.Tuteur{})

	if search != "" {
		like := "%" + strings.ToLower(search) + "%"
		q = q.Where(
			"LOWER(nom) LIKE ? OR LOWER(prenoms) LIKE ? OR telephone LIKE ? OR LOWER(email) LIKE ?",
			like, like, like, like,
		)
	}

	// Si un établissement est fourni, on filtre les tuteurs ayant au moins un élève dans cet établissement
	if etablissementID != nil {
		q = q.Joins("JOIN eleves ON eleves.tuteur_id = tuteurs.id").
			Where("eleves.etablissement_id = ?", *etablissementID).
			Group("tuteurs.id")
	}

	var tuteurs []models.Tuteur
	if err := q.Order("nom ASC, prenoms ASC").Find(&tuteurs).Error; err != nil {
		return nil, err
	}
	return tuteurs, nil
}

// Get retourne un tuteur par ID, avec ses élèves.
func (s *TuteurService) Get(id uuid.UUID) (*models.Tuteur, error) {
	var tuteur models.Tuteur
	if err := database.DB.
		Preload("Eleve").
		First(&tuteur, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("tuteur introuvable")
		}
		return nil, err
	}
	return &tuteur, nil
}

// Create crée un nouveau tuteur.
func (s *TuteurService) Create(dto TuteurDTO) (*models.Tuteur, error) {
	tuteur := models.Tuteur{
		Nom:         dto.Nom,
		Prenoms:     dto.Prenoms,
		Telephone:   dto.Telephone,
		Telephone2:  dto.Telephone2,
		Email:       dto.Email,
		Adresse:     dto.Adresse,
		LienParente: dto.LienParente,
		Profession:  dto.Profession,
		Actif:       true,
	}
	if dto.Actif != nil {
		tuteur.Actif = *dto.Actif
	}
	if err := database.DB.Create(&tuteur).Error; err != nil {
		return nil, err
	}
	return &tuteur, nil
}

// Update modifie un tuteur.
func (s *TuteurService) Update(id uuid.UUID, dto TuteurDTO) (*models.Tuteur, error) {
	var tuteur models.Tuteur
	if err := database.DB.First(&tuteur, "id = ?", id).Error; err != nil {
		return nil, errors.New("tuteur introuvable")
	}
	updates := map[string]interface{}{
		"nom":          dto.Nom,
		"prenoms":      dto.Prenoms,
		"telephone":    dto.Telephone,
		"telephone2":   dto.Telephone2,
		"email":        dto.Email,
		"adresse":      dto.Adresse,
		"lien_parente": dto.LienParente,
		"profession":   dto.Profession,
	}
	if dto.Actif != nil {
		updates["actif"] = *dto.Actif
	}
	if err := database.DB.Model(&tuteur).Updates(updates).Error; err != nil {
		return nil, err
	}
	return s.Get(id)
}

// Delete supprime un tuteur (soft delete). Refusé s'il a des élèves rattachés.
func (s *TuteurService) Delete(id uuid.UUID) error {
	var count int64
	database.DB.Model(&models.Eleve{}).Where("tuteur_id = ?", id).Count(&count)
	if count > 0 {
		return errors.New("impossible de supprimer un tuteur ayant des élèves rattachés")
	}
	result := database.DB.Delete(&models.Tuteur{}, "id = ?", id)
	if result.RowsAffected == 0 {
		return errors.New("tuteur introuvable")
	}
	return result.Error
}

// ===== Inscriptions =====

// InscriptionService gère les inscriptions des élèves par année/classe.
type InscriptionService struct{}

func NewInscriptionService() *InscriptionService { return &InscriptionService{} }

// InscriptionDTO pour création.
type InscriptionDTO struct {
	ClasseID             uuid.UUID                `json:"classe_id"`
	AnneeScolaireID      uuid.UUID                `json:"annee_scolaire_id"`
	Statut               models.StatutInscription `json:"statut"`
	DerogationInscription bool                     `json:"derogation_inscription"`
	MotifDerogation      string                   `json:"motif_derogation"`
}

// ListByEleve retourne toutes les inscriptions d'un élève (historique).
func (s *InscriptionService) ListByEleve(eleveID uuid.UUID) ([]models.Inscription, error) {
	var inscriptions []models.Inscription
	if err := database.DB.
		Preload("Classe").
		Preload("AnneeScolaire").
		Preload("Etablissement").
		Where("eleve_id = ?", eleveID).
		Order("date_inscription DESC").
		Find(&inscriptions).Error; err != nil {
		return nil, err
	}
	return inscriptions, nil
}

// Create crée une inscription pour un élève.
func (s *InscriptionService) Create(eleveID uuid.UUID, dto InscriptionDTO, userID uuid.UUID) (*models.Inscription, error) {
	// Récupérer l'élève pour déterminer l'établissement
	var eleve models.Eleve
	if err := database.DB.First(&eleve, "id = ?", eleveID).Error; err != nil {
		return nil, errors.New("élève introuvable")
	}

	// Vérifier l'unicité (élève + année scolaire)
	var count int64
	database.DB.Model(&models.Inscription{}).
		Where("eleve_id = ? AND annee_scolaire_id = ?", eleveID, dto.AnneeScolaireID).
		Count(&count)
	if count > 0 {
		return nil, errors.New("cet élève est déjà inscrit pour cette année scolaire")
	}

	// Vérifier la cohérence dérogation : seulement pour les élèves AFFECTE
	if dto.DerogationInscription && eleve.Categorie != models.CategorieAffecte {
		return nil, errors.New("la dérogation 3 tranches ne s'applique qu'aux élèves affectés")
	}

	statut := dto.Statut
	if statut == "" {
		statut = models.StatutInscrit
	}

	inscription := models.Inscription{
		EleveID:               eleveID,
		EtablissementID:       eleve.EtablissementID,
		ClasseID:              dto.ClasseID,
		AnneeScolaireID:       dto.AnneeScolaireID,
		DateInscription:       time.Now(),
		Statut:                statut,
		DerogationInscription: dto.DerogationInscription,
		MotifDerogation:       dto.MotifDerogation,
	}
	if dto.DerogationInscription {
		inscription.AccordeePar = &userID
		now := time.Now()
		inscription.DateDerogation = &now
	}

	if err := database.DB.Create(&inscription).Error; err != nil {
		return nil, err
	}

	// Recharger avec relations
	var result models.Inscription
	database.DB.
		Preload("Classe").
		Preload("AnneeScolaire").
		Preload("Etablissement").
		First(&result, "id = ?", inscription.ID)
	return &result, nil
}

// Update modifie une inscription (statut, dérogation).
func (s *InscriptionService) Update(id uuid.UUID, dto InscriptionDTO, userID uuid.UUID) (*models.Inscription, error) {
	var inscription models.Inscription
	if err := database.DB.First(&inscription, "id = ?", id).Error; err != nil {
		return nil, errors.New("inscription introuvable")
	}

	updates := map[string]interface{}{
		"classe_id":              dto.ClasseID,
		"annee_scolaire_id":      dto.AnneeScolaireID,
		"statut":                 dto.Statut,
		"derogation_inscription": dto.DerogationInscription,
		"motif_derogation":       dto.MotifDerogation,
	}
	if dto.DerogationInscription && !inscription.DerogationInscription {
		updates["accordee_par"] = userID
		now := time.Now()
		updates["date_derogation"] = now
	}

	if err := database.DB.Model(&inscription).Updates(updates).Error; err != nil {
		return nil, err
	}

	var result models.Inscription
	database.DB.
		Preload("Classe").
		Preload("AnneeScolaire").
		First(&result, "id = ?", id)
	return &result, nil
}
