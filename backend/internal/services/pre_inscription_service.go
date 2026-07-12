package services

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
	"gorm.io/gorm"
)

// PreInscriptionService gère le cycle de vie des pré-inscriptions en ligne
// soumises par les parents (sans compte) : soumission publique, consultation
// par token de suivi, listing staff, validation (conversion en élève).
type PreInscriptionService struct {
	workflowSvc *InscriptionWorkflowService
}

func NewPreInscriptionService(workflowSvc *InscriptionWorkflowService) *PreInscriptionService {
	return &PreInscriptionService{workflowSvc: workflowSvc}
}

// PreInscriptionDTO : payload de soumission publique (parent).
type PreInscriptionDTO struct {
	EtablissementID string `json:"etablissement_id"`

	EleveNom           string `json:"eleve_nom"`
	ElevePrenoms       string `json:"eleve_prenoms"`
	EleveDateNaissance string `json:"eleve_date_naissance"` // YYYY-MM-DD
	EleveLieuNaissance string `json:"eleve_lieu_naissance"`
	EleveSexe          string `json:"eleve_sexe"`
	EleveCategorie     string `json:"eleve_categorie"`

	TuteurNom         string `json:"tuteur_nom"`
	TuteurPrenoms     string `json:"tuteur_prenoms"`
	TuteurTelephone   string `json:"tuteur_telephone"`
	TuteurEmail       string `json:"tuteur_email"`
	TuteurLienParente string `json:"tuteur_lien_parente"`

	ClasseID   string `json:"classe_id"`
	NotesParent string `json:"notes_parent"`
}

// Submit crée une nouvelle pré-inscription (route publique, sans auth).
// Génère un token de suivi unique pour que le parent consulte l'état.
func (s *PreInscriptionService) Submit(dto PreInscriptionDTO) (*models.PreInscription, string, error) {
	etbID, err := uuid.Parse(dto.EtablissementID)
	if err != nil {
		return nil, "", errors.New("établissement invalide")
	}

	// Validations basiques
	if dto.EleveNom == "" || dto.TuteurNom == "" || dto.TuteurTelephone == "" {
		return nil, "", errors.New("nom de l'élève, nom et téléphone du tuteur sont requis")
	}

	// Vérifier que l'établissement existe et est actif
	var etb models.Etablissement
	if err := database.Current().First(&etb, "id = ? AND actif = ?", etbID, true).Error; err != nil {
		return nil, "", errors.New("établissement introuvable ou inactif")
	}

	// Parse date naissance
	var dateNaiss *time.Time
	if dto.EleveDateNaissance != "" {
		if t, err := time.Parse("2006-01-02", dto.EleveDateNaissance); err == nil {
			dateNaiss = &t
		}
	}

	// Catégorie : forcer NON_APPLICABLE si l'établissement n'applique pas
	categorie := models.CategorieEleve(dto.EleveCategorie)
	if !etb.AppliqueCategorieAffecte {
		categorie = models.CategorieNonApplicable
	}

	// Classe optionnelle
	var classeID *uuid.UUID
	if dto.ClasseID != "" {
		if id, err := uuid.Parse(dto.ClasseID); err == nil {
			classeID = &id
		}
	}

	token, err := generateToken(16)
	if err != nil {
		return nil, "", err
	}

	pre := models.PreInscription{
		EtablissementID:    etbID,
		Statut:             models.StatutPreSoumise,
		TokenSuivi:         token,
		DateSoumission:     time.Now(),
		EleveNom:           dto.EleveNom,
		ElevePrenoms:       dto.ElevePrenoms,
		EleveDateNaissance: dateNaiss,
		EleveLieuNaissance: dto.EleveLieuNaissance,
		EleveSexe:          models.Sexe(dto.EleveSexe),
		EleveCategorie:     categorie,
		TuteurNom:          dto.TuteurNom,
		TuteurPrenoms:      dto.TuteurPrenoms,
		TuteurTelephone:    dto.TuteurTelephone,
		TuteurEmail:        dto.TuteurEmail,
		TuteurLienParente:  models.LienParente(dto.TuteurLienParente),
		ClasseID:           classeID,
		NotesParent:        dto.NotesParent,
	}

	if err := database.Current().Create(&pre).Error; err != nil {
		return nil, "", fmt.Errorf("création pré-inscription: %w", err)
	}

	return &pre, token, nil
}

// GetByToken retourne une pré-inscription par son token de suivi (route
// publique pour le suivi parent). Ne renvoie pas les notes staff.
func (s *PreInscriptionService) GetByToken(token string) (*models.PreInscription, error) {
	var pre models.PreInscription
	if err := database.Current().
		Preload("Etablissement").
		Preload("Classe").
		First(&pre, "token_suivi = ?", token).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("pré-inscription introuvable")
		}
		return nil, err
	}
	return &pre, nil
}

// List retourne les pré-inscriptions d'un établissement (route staff).
// Filtre optionnel par statut.
func (s *PreInscriptionService) List(etablissementID uuid.UUID, statut *models.StatutPreInscription) ([]models.PreInscription, error) {
	q := database.Current().Model(&models.PreInscription{}).
		Where("etablissement_id = ?", etablissementID)
	if statut != nil {
		q = q.Where("statut = ?", *statut)
	}
	var pres []models.PreInscription
	if err := q.Preload("Classe").
		Order("date_soumission DESC").
		Find(&pres).Error; err != nil {
		return nil, err
	}
	return pres, nil
}

// Get retourne une pré-inscription par ID (route staff).
func (s *PreInscriptionService) Get(id uuid.UUID) (*models.PreInscription, error) {
	var pre models.PreInscription
	if err := database.Current().
		Preload("Etablissement").
		Preload("Classe").
		First(&pre, "id = ?", id).Error; err != nil {
		return nil, errors.New("pré-inscription introuvable")
	}
	return &pre, nil
}

// Valider convertit une pré-inscription en élève + inscription réels via le
// workflow existant. Le staff peut ajuster la classe et l'année avant validation.
// La pré-inscription passe au statut VALIDEE et est liée à l'élève créé.
func (s *PreInscriptionService) Valider(id uuid.UUID, classeID uuid.UUID, anneeID uuid.UUID, userID uuid.UUID, notes string) (*WorkflowResult, error) {
	pre, err := s.Get(id)
	if err != nil {
		return nil, err
	}
	if pre.Statut == models.StatutPreValidee {
		return nil, errors.New("cette pré-inscription a déjà été validée")
	}

	// Construire le DTO du workflow à partir des données de la pré-inscription
	workflowDTO := WorkflowDTO{
		Eleve: WorkflowEleveDTO{
			Nom:               pre.EleveNom,
			Prenoms:           pre.ElevePrenoms,
			DateNaissance:     pre.EleveDateNaissance,
			LieuNaissance:     pre.EleveLieuNaissance,
			Sexe:              pre.EleveSexe,
			Categorie:         pre.EleveCategorie,
		},
		Tuteur: WorkflowTuteurDTO{
			Nom:         pre.TuteurNom,
			Prenoms:     pre.TuteurPrenoms,
			Telephone:   pre.TuteurTelephone,
			Email:       pre.TuteurEmail,
			LienParente: pre.TuteurLienParente,
		},
		Inscription: WorkflowInscriptionDTO{
			ClasseID:        classeID,
			AnneeScolaireID: anneeID,
			Statut:          models.StatutInscrit,
		},
	}

	// Exécuter le workflow transactionnel
	result, err := s.workflowSvc.Create(workflowDTO, pre.EtablissementID, userID)
	if err != nil {
		return nil, err
	}

	// Marquer la pré-inscription comme validée
	now := time.Now()
	updates := map[string]interface{}{
		"statut":         models.StatutPreValidee,
		"date_traitement": &now,
		"traite_par":      userID,
		"eleve_cree_id":   result.Eleve.ID,
		"notes_staff":     notes,
	}
	database.Current().Model(&models.PreInscription{}).Where("id = ?", id).Updates(updates)

	return result, nil
}

// Rejeter marque une pré-inscription comme rejetée (avec motif).
func (s *PreInscriptionService) Rejeter(id uuid.UUID, userID uuid.UUID, motif string) error {
	now := time.Now()
	return database.Current().Model(&models.PreInscription{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"statut":          models.StatutPreRejetee,
			"date_traitement": &now,
			"traite_par":      userID,
			"notes_staff":     motif,
		}).Error
}

// generateToken génère un token hexadécimal aléatoire sécurisé.
func generateToken(bytes int) (string, error) {
	b := make([]byte, bytes)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
