package services

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
	"gorm.io/gorm"
)

// EnseignantService gère l'annuaire des enseignants, les matières, les
// associations prof/matière (avec taux horaire) et les affectations de cours
// (prof/matière/classe/année).
type EnseignantService struct{}

func NewEnseignantService() *EnseignantService { return &EnseignantService{} }

// ─────────────────────────────────────────────────────────────────────────────
// Enseignants
// ─────────────────────────────────────────────────────────────────────────────

// EnseignantDTO : payload de création/modification d'un enseignant.
type EnseignantDTO struct {
	Nom               string                 `json:"nom"`
	Prenoms           string                 `json:"prenoms"`
	DateNaissance     *time.Time             `json:"date_naissance"`
	Sexe              models.Sexe            `json:"sexe"`
	PhotoURL          string                 `json:"photo_url"`
	Telephone         string                 `json:"telephone"`
	Email             string                 `json:"email"`
	Adresse           string                 `json:"adresse"`
	Statut            models.StatutEnseignant `json:"statut"`
	TypeContrat       models.TypeContrat     `json:"type_contrat"`
	DateEmbauche      *time.Time             `json:"date_embauche"`
	Diplome           string                 `json:"diplome"`
	Specialite        string                 `json:"specialite"`
	CVURL             string                 `json:"cv_url"`
	TauxHoraireDefaut float64                `json:"taux_horaire_defaut"`
}

// List retourne les enseignants d'un établissement avec filtres optionnels.
func (s *EnseignantService) List(etablissementID uuid.UUID, search string, statut *models.StatutEnseignant) ([]models.Enseignant, error) {
	q := database.Current().Model(&models.Enseignant{}).
		Where("etablissement_id = ?", etablissementID).
		Preload("Matieres.Matiere")

	if search != "" {
		like := "%" + strings.ToLower(search) + "%"
		q = q.Where("LOWER(nom) LIKE ? OR LOWER(prenoms) LIKE ? OR matricule LIKE ? OR telephone LIKE ?",
			like, like, like, like)
	}
	if statut != nil {
		q = q.Where("statut = ?", *statut)
	}

	var ens []models.Enseignant
	if err := q.Order("nom ASC, prenoms ASC").Find(&ens).Error; err != nil {
		return nil, err
	}
	return ens, nil
}

// Get retourne un enseignant par ID avec ses relations.
func (s *EnseignantService) Get(id uuid.UUID) (*models.Enseignant, error) {
	var ens models.Enseignant
	if err := database.Current().
		Preload("Etablissement").
		Preload("Matieres.Matiere").
		Preload("Affectations.Classe").
		Preload("Affectations.Matiere").
		Preload("Affectations.AnneeScolaire").
		First(&ens, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("enseignant introuvable")
		}
		return nil, err
	}
	return &ens, nil
}

// Create crée un nouvel enseignant + génère un matricule automatique.
func (s *EnseignantService) Create(dto EnseignantDTO, etablissementID uuid.UUID) (*models.Enseignant, error) {
	if dto.Nom == "" {
		return nil, errors.New("le nom est requis")
	}

	matricule, err := s.generateMatricule(etablissementID)
	if err != nil {
		return nil, err
	}

	statut := dto.Statut
	if statut == "" {
		statut = models.StatutEnsActif
	}
	contrat := dto.TypeContrat
	if contrat == "" {
		contrat = models.ContratCDI
	}

	ens := models.Enseignant{
		EtablissementID:   etablissementID,
		Matricule:         matricule,
		Nom:               dto.Nom,
		Prenoms:           dto.Prenoms,
		DateNaissance:     dto.DateNaissance,
		Sexe:              dto.Sexe,
		PhotoURL:          dto.PhotoURL,
		Telephone:         dto.Telephone,
		Email:             dto.Email,
		Adresse:           dto.Adresse,
		Statut:            statut,
		TypeContrat:       contrat,
		DateEmbauche:      dto.DateEmbauche,
		Diplome:           dto.Diplome,
		Specialite:        dto.Specialite,
		CVURL:             dto.CVURL,
		TauxHoraireDefaut: dto.TauxHoraireDefaut,
	}

	if err := database.Current().Create(&ens).Error; err != nil {
		return nil, fmt.Errorf("création enseignant: %w", err)
	}

	return s.Get(ens.ID)
}

// Update modifie un enseignant existant.
func (s *EnseignantService) Update(id uuid.UUID, dto EnseignantDTO) (*models.Enseignant, error) {
	var ens models.Enseignant
	if err := database.Current().First(&ens, "id = ?", id).Error; err != nil {
		return nil, errors.New("enseignant introuvable")
	}

	updates := map[string]interface{}{
		"nom":                 dto.Nom,
		"prenoms":             dto.Prenoms,
		"date_naissance":      dto.DateNaissance,
		"sexe":                dto.Sexe,
		"photo_url":           dto.PhotoURL,
		"telephone":           dto.Telephone,
		"email":               dto.Email,
		"adresse":             dto.Adresse,
		"diplome":             dto.Diplome,
		"specialite":          dto.Specialite,
		"cv_url":              dto.CVURL,
		"taux_horaire_defaut": dto.TauxHoraireDefaut,
	}
	if dto.Statut != "" {
		updates["statut"] = dto.Statut
	}
	if dto.TypeContrat != "" {
		updates["type_contrat"] = dto.TypeContrat
	}
	if dto.DateEmbauche != nil {
		updates["date_embauche"] = dto.DateEmbauche
	}

	if err := database.Current().Model(&ens).Updates(updates).Error; err != nil {
		return nil, err
	}

	return s.Get(id)
}

// Delete supprime un enseignant (soft delete via BaseModel).
func (s *EnseignantService) Delete(id uuid.UUID) error {
	return database.Current().Delete(&models.Enseignant{}, "id = ?", id).Error
}

// generateMatricule génère un matricule unique (format: ENS-{YEAR}-{SEQ}).
func (s *EnseignantService) generateMatricule(etablissementID uuid.UUID) (string, error) {
	year := time.Now().Year()
	var count int64
	database.Current().Model(&models.Enseignant{}).Where("etablissement_id = ?", etablissementID).Count(&count)
	sequence := count + 1
	for {
		matricule := fmt.Sprintf("ENS-%d-%04d", year, sequence)
		var exists int64
		database.Current().Model(&models.Enseignant{}).Where("matricule = ?", matricule).Count(&exists)
		if exists == 0 {
			return matricule, nil
		}
		sequence++
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Matières
// ─────────────────────────────────────────────────────────────────────────────

// MatiereDTO : payload de création/modification d'une matière.
type MatiereDTO struct {
	Code        string     `json:"code"`
	Libelle     string     `json:"libelle"`
	Coefficient float64    `json:"coefficient"`
	CycleID     *uuid.UUID `json:"cycle_id"`
	Couleur     string     `json:"couleur"`
	Actif       *bool      `json:"actif"`
}

func (s *EnseignantService) ListMatieres(etablissementID uuid.UUID) ([]models.Matiere, error) {
	var matieres []models.Matiere
	if err := database.Current().
		Where("etablissement_id = ?", etablissementID).
		Preload("Cycle").
		Order("libelle ASC").
		Find(&matieres).Error; err != nil {
		return nil, err
	}
	return matieres, nil
}

func (s *EnseignantService) CreateMatiere(dto MatiereDTO, etablissementID uuid.UUID) (*models.Matiere, error) {
	if dto.Code == "" || dto.Libelle == "" {
		return nil, errors.New("code et libellé sont requis")
	}

	m := models.Matiere{
		EtablissementID: etablissementID,
		Code:            strings.ToUpper(dto.Code),
		Libelle:         dto.Libelle,
		Coefficient:     dto.Coefficient,
		CycleID:         dto.CycleID,
		Couleur:         dto.Couleur,
		Actif:           true,
	}
	if dto.Actif != nil {
		m.Actif = *dto.Actif
	}
	if m.Coefficient == 0 {
		m.Coefficient = 1
	}

	if err := database.Current().Create(&m).Error; err != nil {
		return nil, fmt.Errorf("création matière: %w", err)
	}
	return &m, nil
}

func (s *EnseignantService) UpdateMatiere(id uuid.UUID, dto MatiereDTO) (*models.Matiere, error) {
	var m models.Matiere
	if err := database.Current().First(&m, "id = ?", id).Error; err != nil {
		return nil, errors.New("matière introuvable")
	}

	updates := map[string]interface{}{
		"code":        strings.ToUpper(dto.Code),
		"libelle":     dto.Libelle,
		"coefficient": dto.Coefficient,
		"cycle_id":    dto.CycleID,
		"couleur":     dto.Couleur,
	}
	if dto.Actif != nil {
		updates["actif"] = *dto.Actif
	}

	if err := database.Current().Model(&m).Updates(updates).Error; err != nil {
		return nil, err
	}
	return &m, nil
}

func (s *EnseignantService) DeleteMatiere(id uuid.UUID) error {
	return database.Current().Delete(&models.Matiere{}, "id = ?", id).Error
}

// ─────────────────────────────────────────────────────────────────────────────
// EnseignantMatiere (association N:N avec taux horaire)
// ─────────────────────────────────────────────────────────────────────────────

// EnseignantMatiereDTO : payload pour associer une matière à un enseignant.
type EnseignantMatiereDTO struct {
	MatiereID     uuid.UUID `json:"matiere_id"`
	TauxHoraire   float64   `json:"taux_horaire"`
	EstPrincipale bool      `json:"est_principale"`
}

// AddMatiereToEnseignant associe une matière à un enseignant avec un taux horaire.
func (s *EnseignantService) AddMatiereToEnseignant(enseignantID uuid.UUID, dto EnseignantMatiereDTO) error {
	// Vérifier unicité
	var count int64
	database.Current().Model(&models.EnseignantMatiere{}).
		Where("enseignant_id = ? AND matiere_id = ?", enseignantID, dto.MatiereID).
		Count(&count)
	if count > 0 {
		return errors.New("cette matière est déjà associée à cet enseignant")
	}

	// Si est_principale, retirer le flag des autres matières du prof
	if dto.EstPrincipale {
		database.Current().Model(&models.EnseignantMatiere{}).
			Where("enseignant_id = ?", enseignantID).
			Update("est_principale", false)
	}

	em := models.EnseignantMatiere{
		EnseignantID:  enseignantID,
		MatiereID:     dto.MatiereID,
		TauxHoraire:   dto.TauxHoraire,
		EstPrincipale: dto.EstPrincipale,
	}
	return database.Current().Create(&em).Error
}

// RemoveMatiereFromEnseignant retire une matière d'un enseignant.
func (s *EnseignantService) RemoveMatiereFromEnseignant(enseignantID, matiereID uuid.UUID) error {
	return database.Current().
		Where("enseignant_id = ? AND matiere_id = ?", enseignantID, matiereID).
		Delete(&models.EnseignantMatiere{}).Error
}

// ─────────────────────────────────────────────────────────────────────────────
// AffectationCours (assignation prof/matière/classe/année)
// ─────────────────────────────────────────────────────────────────────────────

// AffectationDTO : payload de création d'une affectation de cours.
type AffectationDTO struct {
	EnseignantID       uuid.UUID `json:"enseignant_id"`
	MatiereID          uuid.UUID `json:"matiere_id"`
	ClasseID           uuid.UUID `json:"classe_id"`
	AnneeScolaireID    uuid.UUID `json:"annee_scolaire_id"`
	VolumeHoraireHebdo float64   `json:"volume_horaire_hebdo"`
	EstTitulaire       bool      `json:"est_titulaire"`
}

// AffectationResult : résultat de création d'affectation, avec alertes de charge.
type AffectationResult struct {
	Affectation     *models.AffectationCours `json:"affectation"`
	ChargeTotaleHebdo float64                `json:"charge_totale_hebdo"`
	AlerteSurcharge   bool                   `json:"alerte_surcharge"` // > 25h/sem
}

// ListAffectations retourne les affectations d'un établissement pour une année.
func (s *EnseignantService) ListAffectations(etablissementID, anneeScolaireID uuid.UUID) ([]models.AffectationCours, error) {
	var affs []models.AffectationCours
	if err := database.Current().
		Where("etablissement_id = ? AND annee_scolaire_id = ?", etablissementID, anneeScolaireID).
		Preload("Enseignant").
		Preload("Matiere").
		Preload("Classe").
		Preload("AnneeScolaire").
		Order("enseignant_id ASC, matiere_id ASC").
		Find(&affs).Error; err != nil {
		return nil, err
	}
	return affs, nil
}

// CreateAffectation assigne un enseignant à une matière + classe pour une année.
// Vérifie : pas de doublon (prof/matière/classe/année), charge horaire du prof.
func (s *EnseignantService) CreateAffectation(dto AffectationDTO, etablissementID uuid.UUID) (*AffectationResult, error) {
	// Vérifier unicité (prof/matière/classe/année)
	var count int64
	database.Current().Model(&models.AffectationCours{}).
		Where("enseignant_id = ? AND matiere_id = ? AND classe_id = ? AND annee_scolaire_id = ?",
			dto.EnseignantID, dto.MatiereID, dto.ClasseID, dto.AnneeScolaireID).
		Count(&count)
	if count > 0 {
		return nil, errors.New("cette affectation existe déjà (prof/matière/classe/année)")
	}

	// Si est_titulaire, retirer le flag des autres affectations de la même classe
	if dto.EstTitulaire {
		database.Current().Model(&models.AffectationCours{}).
			Where("classe_id = ? AND annee_scolaire_id = ? AND est_titulaire = ?",
				dto.ClasseID, dto.AnneeScolaireID, true).
			Update("est_titulaire", false)
	}

	aff := models.AffectationCours{
		EnseignantID:       dto.EnseignantID,
		MatiereID:          dto.MatiereID,
		ClasseID:           dto.ClasseID,
		EtablissementID:    etablissementID,
		AnneeScolaireID:    dto.AnneeScolaireID,
		VolumeHoraireHebdo: dto.VolumeHoraireHebdo,
		EstTitulaire:       dto.EstTitulaire,
		Actif:              true,
	}

	if err := database.Current().Create(&aff).Error; err != nil {
		return nil, fmt.Errorf("création affectation: %w", err)
	}

	// Calculer la charge totale du prof (toutes affectations actives de l'année)
	chargeTotale, _ := s.GetChargeHebdoEnseignant(dto.EnseignantID, dto.AnneeScolaireID)

	// Charger avec relations
	database.Current().
		Preload("Enseignant").
		Preload("Matiere").
		Preload("Classe").
		Preload("AnneeScolaire").
		First(&aff, "id = ?", aff.ID)

	return &AffectationResult{
		Affectation:       &aff,
		ChargeTotaleHebdo: chargeTotale,
		AlerteSurcharge:   chargeTotale > 25, // seuil configurable
	}, nil
}

// DeleteAffectation supprime une affectation.
func (s *EnseignantService) DeleteAffectation(id uuid.UUID) error {
	return database.Current().Delete(&models.AffectationCours{}, "id = ?", id).Error
}

// GetChargeHebdoEnseignant calcule la charge horaire hebdomadaire totale
// d'un enseignant pour une année (somme des volumes horaires des affectations).
func (s *EnseignantService) GetChargeHebdoEnseignant(enseignantID, anneeScolaireID uuid.UUID) (float64, error) {
	var result struct {
		Total float64
	}
	err := database.Current().Model(&models.AffectationCours{}).
		Select("COALESCE(SUM(volume_horaire_hebdo), 0) as total").
		Where("enseignant_id = ? AND annee_scolaire_id = ? AND actif = ?",
			enseignantID, anneeScolaireID, true).
		Scan(&result).Error
	if err != nil {
		return 0, err
	}
	return result.Total, nil
}
