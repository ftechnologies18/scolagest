package services

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
	"github.com/scolagest/backend/internal/utils"
	"gorm.io/gorm"
)

// UserService gère les utilisateurs et leurs accès multi-établissements.
type UserService struct{}

func NewUserService() *UserService { return &UserService{} }

// UtilisateurDTO pour création.
type UtilisateurDTO struct {
	Nom      string                `json:"nom"`
	Prenoms  string                `json:"prenoms"`
	Email    string                `json:"email"`
	Password string                `json:"password"`
	RoleGlobal *models.RoleUtilisateur `json:"role_global"`
}

// List retourne les utilisateurs (filtrés par établissement si fourni).
func (s *UserService) List(etablissementID *uuid.UUID) ([]models.Utilisateur, error) {
	q := database.DB.Model(&models.Utilisateur{}).Preload("Tuteur")
	if etablissementID != nil {
		// Utilisateurs ayant accès à cet établissement OU admin global
		q = q.Joins("LEFT JOIN etablissement_access ON etablissement_access.utilisateur_id = utilisateurs.id").
			Where("etablissement_access.etablissement_id = ? OR utilisateurs.role_global = ?",
				*etablissementID, models.RoleSuperAdmin).
			Group("utilisateurs.id")
	}
	var users []models.Utilisateur
	q.Order("nom ASC, prenoms ASC").Find(&users)
	// Charger les accès pour chaque utilisateur
	for i := range users {
		database.DB.Where("utilisateur_id = ?", users[i].ID).Find(&users[i].EtablissementAccess)
	}
	_ = gorm.ErrRecordNotFound
	return users, nil
}

// Create crée un utilisateur.
func (s *UserService) Create(dto UtilisateurDTO) (*models.Utilisateur, error) {
	if dto.Nom == "" || dto.Email == "" || dto.Password == "" {
		return nil, errors.New("nom, email et mot de passe obligatoires")
	}
	// Vérifier unicité email
	var count int64
	database.DB.Model(&models.Utilisateur{}).Where("email = ?", dto.Email).Count(&count)
	if count > 0 {
		return nil, errors.New("email déjà utilisé")
	}
	hash, _ := utils.HashPassword(dto.Password)
	u := models.Utilisateur{
		Nom:            dto.Nom,
		Prenoms:        dto.Prenoms,
		Email:          dto.Email,
		MotDePasseHash: hash,
		RoleGlobal:     dto.RoleGlobal,
		Statut:         models.StatutUserActif,
	}
	if err := database.DB.Create(&u).Error; err != nil {
		return nil, err
	}
	return &u, nil
}

// Update modifie un utilisateur (sans le mot de passe).
func (s *UserService) Update(id uuid.UUID, dto UtilisateurDTO) (*models.Utilisateur, error) {
	var u models.Utilisateur
	if err := database.DB.First(&u, "id = ?", id).Error; err != nil {
		return nil, errors.New("utilisateur introuvable")
	}
	updates := map[string]interface{}{
		"nom":     dto.Nom,
		"prenoms": dto.Prenoms,
		"email":   dto.Email,
	}
	if dto.RoleGlobal != nil {
		updates["role_global"] = *dto.RoleGlobal
	}
	if err := database.DB.Model(&u).Updates(updates).Error; err != nil {
		return nil, err
	}
	// Si password fourni, le mettre à jour
	if dto.Password != "" {
		hash, _ := utils.HashPassword(dto.Password)
		database.DB.Model(&u).Update("mot_de_passe_hash", hash)
	}
	database.DB.First(&u, "id = ?", id)
	return &u, nil
}

// AccessDTO pour ajouter un accès établissement.
type AccessDTO struct {
	EtablissementID uuid.UUID              `json:"etablissement_id"`
	Role            models.RoleUtilisateur `json:"role"`
}

// AddAccess ajoute un accès établissement à un utilisateur.
func (s *UserService) AddAccess(userID uuid.UUID, dto AccessDTO) (*models.EtablissementAccess, error) {
	// Vérifier que l'accès n'existe pas déjà
	var count int64
	database.DB.Model(&models.EtablissementAccess{}).
		Where("utilisateur_id = ? AND etablissement_id = ?", userID, dto.EtablissementID).Count(&count)
	if count > 0 {
		return nil, errors.New("accès déjà existant")
	}
	access := models.EtablissementAccess{
		UtilisateurID:   userID,
		EtablissementID: dto.EtablissementID,
		Role:            dto.Role,
	}
	if err := database.DB.Create(&access).Error; err != nil {
		return nil, err
	}
	return &access, nil
}

// RemoveAccess supprime un accès établissement.
func (s *UserService) RemoveAccess(userID, etablissementID uuid.UUID) error {
	result := database.DB.Where("utilisateur_id = ? AND etablissement_id = ?", userID, etablissementID).
		Delete(&models.EtablissementAccess{})
	if result.RowsAffected == 0 {
		return errors.New("accès introuvable")
	}
	return result.Error
}

// ===== Audit =====

// AuditFilter filtre le journal d'audit.
type AuditFilter struct {
	EtablissementID *uuid.UUID
	UtilisateurID   *uuid.UUID
	Entite          string
	DateDebut       *time.Time
	DateFin         *time.Time
	Page            int
	PageSize        int
}

// AuditResult est le résultat paginé.
type AuditResult struct {
	Data     []models.JournalAudit `json:"data"`
	Total    int64                 `json:"total"`
	Page     int                   `json:"page"`
	PageSize int                   `json:"page_size"`
}

// ListAudit retourne les entrées du journal d'audit.
func (s *UserService) ListAudit(filter AuditFilter) (*AuditResult, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.PageSize < 1 || filter.PageSize > 100 {
		filter.PageSize = 20
	}
	q := database.DB.Model(&models.JournalAudit{}).Preload("Utilisateur")
	if filter.EtablissementID != nil {
		q = q.Where("etablissement_id = ?", *filter.EtablissementID)
	}
	if filter.UtilisateurID != nil {
		q = q.Where("utilisateur_id = ?", *filter.UtilisateurID)
	}
	if filter.Entite != "" {
		q = q.Where("entite = ?", filter.Entite)
	}
	if filter.DateDebut != nil {
		q = q.Where("date >= ?", *filter.DateDebut)
	}
	if filter.DateFin != nil {
		q = q.Where("date <= ?", *filter.DateFin)
	}
	var total int64
	q.Count(&total)
	var entries []models.JournalAudit
	offset := (filter.Page - 1) * filter.PageSize
	q.Order("date DESC").Offset(offset).Limit(filter.PageSize).Find(&entries)
	return &AuditResult{Data: entries, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
}

// ===== Établissements (extension) =====

// EtablissementDTO pour création/modification.
type EtablissementDTO struct {
	Nom                      string `json:"nom"`
	CodeOfficiel             string `json:"code_officiel"`
	Adresse                  string `json:"adresse"`
	Ville                    string `json:"ville"`
	Telephone                string `json:"telephone"`
	Email                    string `json:"email"`
	AppliqueCategorieAffecte bool   `json:"applique_categorie_affecte"`
	CouleurTheme             string `json:"couleur_theme"`
	Actif                    bool   `json:"actif"`
}

// CreateEtablissement crée un établissement.
func (s *UserService) CreateEtablissement(dto EtablissementDTO) (*models.Etablissement, error) {
	if dto.Nom == "" || dto.CodeOfficiel == "" {
		return nil, errors.New("nom et code officiel obligatoires")
	}
	var count int64
	database.DB.Model(&models.Etablissement{}).Where("code_officiel = ?", dto.CodeOfficiel).Count(&count)
	if count > 0 {
		return nil, errors.New("code officiel déjà utilisé")
	}
	e := models.Etablissement{
		Nom:                      dto.Nom,
		CodeOfficiel:             dto.CodeOfficiel,
		Adresse:                  dto.Adresse,
		Ville:                    dto.Ville,
		Telephone:                dto.Telephone,
		Email:                    dto.Email,
		AppliqueCategorieAffecte: dto.AppliqueCategorieAffecte,
		CouleurTheme:             dto.CouleurTheme,
		Actif:                    true,
	}
	if err := database.DB.Create(&e).Error; err != nil {
		return nil, err
	}
	return &e, nil
}

// UpdateEtablissement modifie un établissement.
func (s *UserService) UpdateEtablissement(id uuid.UUID, dto EtablissementDTO) (*models.Etablissement, error) {
	var e models.Etablissement
	if err := database.DB.First(&e, "id = ?", id).Error; err != nil {
		return nil, errors.New("établissement introuvable")
	}
	// Vérifier unicité du code si changé
	if dto.CodeOfficiel != e.CodeOfficiel {
		var count int64
		database.DB.Model(&models.Etablissement{}).
			Where("code_officiel = ? AND id != ?", dto.CodeOfficiel, id).Count(&count)
		if count > 0 {
			return nil, errors.New("code officiel déjà utilisé")
		}
	}
	database.DB.Model(&e).Updates(map[string]interface{}{
		"nom":                        dto.Nom,
		"code_officiel":              dto.CodeOfficiel,
		"adresse":                    dto.Adresse,
		"ville":                      dto.Ville,
		"telephone":                  dto.Telephone,
		"email":                      dto.Email,
		"applique_categorie_affecte": dto.AppliqueCategorieAffecte,
		"couleur_theme":              dto.CouleurTheme,
		"actif":                      dto.Actif,
	})
	database.DB.First(&e, "id = ?", id)
	return &e, nil
}

// search helper (non utilisé directement mais utile)
func searchContains(haystack, needle string) bool {
	return strings.Contains(strings.ToLower(haystack), strings.ToLower(needle))
}