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

// EmploiTempsService gère l'emploi du temps d'un établissement : création de
// créneaux fixes (jour + heure + salle), détection de conflits (2 profs dans
// la même classe au même moment, ou 1 prof dans 2 classes au même moment),
// et génération automatique des SessionCours depuis l'emploi du temps.
type EmploiTempsService struct{}

func NewEmploiTempsService() *EmploiTempsService { return &EmploiTempsService{} }

// ─────────────────────────────────────────────────────────────────────────────
// CRUD Créneaux
// ─────────────────────────────────────────────────────────────────────────────

// CreneauDTO : payload de création/modification d'un créneau.
type CreneauDTO struct {
	AffectationCoursID uuid.UUID        `json:"affectation_cours_id"`
	JourSemaine        models.JourSemaine `json:"jour_semaine"`
	HeureDebut         string           `json:"heure_debut"` // "08:00"
	HeureFin           string           `json:"heure_fin"`   // "10:00"
	Salle              string           `json:"salle"`
	SemaineType        models.SemaineType `json:"semaine_type"`
}

// ConflitResult : résultat de création d'un créneau, avec conflits détectés.
type ConflitResult struct {
	Creneau      *models.CreneauEmploiTemps `json:"creneau"`
	Conflits     []ConflitInfo              `json:"conflits"`
}

// ConflitInfo : décrit un conflit détecté (même prof ou même classe au même
// moment).
type ConflitInfo struct {
	Type        string `json:"type"` // PROF_CONFLIT / CLASSE_CONFLIT
	Message     string `json:"message"`
	CreneauID   string `json:"creneau_id_existant"`
	Description string `json:"description"` // ex: "M. KOUADIO a déjà Maths en 5e 1"
}

// ListCreneaux retourne tous les créneaux d'un établissement, optionnellement
// filtrés par classe ou enseignant.
func (s *EmploiTempsService) ListCreneaux(etablissementID uuid.UUID, classeID, enseignantID *uuid.UUID) ([]models.CreneauEmploiTemps, error) {
	q := database.Current().Model(&models.CreneauEmploiTemps{}).
		Where("etablissement_id = ? AND actif = ?", etablissementID, true)

	if classeID != nil {
		q = q.Where("classe_id = ?", *classeID)
	}
	if enseignantID != nil {
		q = q.Where("enseignant_id = ?", *enseignantID)
	}

	var creneaux []models.CreneauEmploiTemps
	if err := q.Preload("Affectation").
		Preload("Affectation.Enseignant").
		Preload("Affectation.Matiere").
		Preload("Affectation.Classe").
		Order("jour_semaine ASC, heure_debut ASC").
		Find(&creneaux).Error; err != nil {
		return nil, err
	}
	return creneaux, nil
}

// CreateCreneau crée un nouveau créneau et vérifie les conflits.
func (s *EmploiTempsService) CreateCreneau(dto CreneauDTO, etablissementID uuid.UUID) (*ConflitResult, error) {
	db := database.Current()

	// Récupérer l'affectation pour dénormaliser enseignant/matiere/classe
	var aff models.AffectationCours
	if err := db.First(&aff, "id = ?", dto.AffectationCoursID).Error; err != nil {
		return nil, errors.New("affectation introuvable")
	}
	if aff.EtablissementID != etablissementID {
		return nil, errors.New("cette affectation n'appartient pas à votre établissement")
	}

	// Validation heures
	if dto.HeureDebut == "" || dto.HeureFin == "" {
		return nil, errors.New("heures de début et fin requises")
	}
	if dto.HeureDebut >= dto.HeureFin {
		return nil, errors.New("l'heure de début doit être avant l'heure de fin")
	}

	semaineType := dto.SemaineType
	if semaineType == "" {
		semaineType = models.SemaineToutes
	}

	creneau := models.CreneauEmploiTemps{
		EtablissementID:    etablissementID,
		AffectationCoursID: dto.AffectationCoursID,
		EnseignantID:       aff.EnseignantID,
		MatiereID:          aff.MatiereID,
		ClasseID:           aff.ClasseID,
		JourSemaine:        dto.JourSemaine,
		HeureDebut:         dto.HeureDebut,
		HeureFin:           dto.HeureFin,
		Salle:              dto.Salle,
		SemaineType:        semaineType,
		Actif:              true,
	}

	// Vérifier les conflits AVANT création
	conflits := s.detectConflits(db, etablissementID, creneau)

	if err := db.Create(&creneau).Error; err != nil {
		return nil, fmt.Errorf("création créneau: %w", err)
	}

	// Recharger avec relations
	db.Preload("Affectation.Enseignant").
		Preload("Affectation.Matiere").
		Preload("Affectation.Classe").
		First(&creneau, "id = ?", creneau.ID)

	return &ConflitResult{Creneau: &creneau, Conflits: conflits}, nil
}

// DeleteCreneau supprime un créneau.
func (s *EmploiTempsService) DeleteCreneau(id uuid.UUID) error {
	return database.Current().Delete(&models.CreneauEmploiTemps{}, "id = ?", id).Error
}

// detectConflits vérifie si un créneau entre en conflit avec des créneaux
// existants (même prof ou même classe, même jour, même tranche horaire).
func (s *EmploiTempsService) detectConflits(db *gorm.DB, etablissementID uuid.UUID, creneau models.CreneauEmploiTemps) []ConflitInfo {
	var conflits []ConflitInfo

	// Conflit PROF : le prof a déjà un cours à ce moment
	var profConflits []models.CreneauEmploiTemps
	db.Where("etablissement_id = ? AND enseignant_id = ? AND jour_semaine = ? AND actif = ?",
		etablissementID, creneau.EnseignantID, creneau.JourSemaine, true).
		Where("(semaine_type = ? OR semaine_type = ? OR ? = ?)",
			models.SemaineToutes, creneau.SemaineType, creneau.SemaineType, models.SemaineToutes).
		Where("heure_debut < ? AND heure_fin > ?", creneau.HeureFin, creneau.HeureDebut).
		Preload("Affectation.Classe").
		Preload("Affectation.Matiere").
		Find(&profConflits)

	for _, c := range profConflits {
		classeLib := "—"
		matLib := "—"
		if c.Affectation != nil {
			if c.Affectation.Classe != nil {
				classeLib = c.Affectation.Classe.Libelle
			}
			if c.Affectation.Matiere != nil {
				matLib = c.Affectation.Matiere.Libelle
			}
		}
		conflits = append(conflits, ConflitInfo{
			Type:        "PROF_CONFLIT",
			Message:     fmt.Sprintf("Ce prof a déjà %s en %s (%s %s-%s)", matLib, classeLib, c.JourSemaine, c.HeureDebut, c.HeureFin),
			CreneauID:   c.ID.String(),
			Description: fmt.Sprintf("%s %s-%s | %s en %s", c.JourSemaine, c.HeureDebut, c.HeureFin, matLib, classeLib),
		})
	}

	// Conflit CLASSE : la classe a déjà un cours à ce moment
	var classeConflits []models.CreneauEmploiTemps
	db.Where("etablissement_id = ? AND classe_id = ? AND jour_semaine = ? AND actif = ?",
		etablissementID, creneau.ClasseID, creneau.JourSemaine, true).
		Where("(semaine_type = ? OR semaine_type = ? OR ? = ?)",
			models.SemaineToutes, creneau.SemaineType, creneau.SemaineType, models.SemaineToutes).
		Where("heure_debut < ? AND heure_fin > ?", creneau.HeureFin, creneau.HeureDebut).
		Preload("Affectation.Enseignant").
		Preload("Affectation.Matiere").
		Find(&classeConflits)

	for _, c := range classeConflits {
		ensNom := "—"
		matLib := "—"
		if c.Affectation != nil {
			if c.Affectation.Enseignant != nil {
				ensNom = c.Affectation.Enseignant.Nom
			}
			if c.Affectation.Matiere != nil {
				matLib = c.Affectation.Matiere.Libelle
			}
		}
		conflits = append(conflits, ConflitInfo{
			Type:        "CLASSE_CONFLIT",
			Message:     fmt.Sprintf("Cette classe a déjà %s avec M. %s (%s %s-%s)", matLib, ensNom, c.JourSemaine, c.HeureDebut, c.HeureFin),
			CreneauID:   c.ID.String(),
			Description: fmt.Sprintf("%s %s-%s | %s par %s", c.JourSemaine, c.HeureDebut, c.HeureFin, matLib, ensNom),
		})
	}

	return conflits
}

// ─────────────────────────────────────────────────────────────────────────────
// Génération automatique des SessionCours depuis l'emploi du temps
// ─────────────────────────────────────────────────────────────────────────────

// GenerateSessionsFromDate génère les SessionCours pour une date donnée en
// lisant l'emploi du temps réel (CreneauEmploiTemps). Remplace l'ancienne
// génération avec créneaux fixes arbitraires.
//
// Logique :
// 1. Déterminer le jour de la semaine de la date (LUNDI...SAMEDI)
// 2. Récupérer l'année active
// 3. Récupérer tous les créneaux actifs pour ce jour de semaine
// 4. Filtrer par semaine paire/impaire si applicable
// 5. Pour chaque créneau, créer une SessionCours (si pas déjà existante)
func (s *EmploiTempsService) GenerateSessionsFromDate(etablissementID uuid.UUID, date time.Time) (int, error) {
	db := database.Current()

	// Récupérer l'année active
	var annee models.AnneeScolaire
	if err := db.Where("est_active = ?", true).First(&annee).Error; err != nil {
		return 0, errors.New("aucune année active")
	}

	// Déterminer le jour de la semaine
	jourSemaine := jourSemaineFromDate(date)

	// Calculer le numéro de semaine pour la parité (paire/impaire)
	_, weekNum := date.ISOWeek()
	semainePaire := weekNum%2 == 0

	dateOnly := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())

	// Vérifier si des sessions existent déjà pour cette date
	var existingCount int64
	db.Model(&models.SessionCours{}).
		Where("etablissement_id = ? AND date_cours = ?", etablissementID, dateOnly).
		Count(&existingCount)
	if existingCount > 0 {
		return 0, nil // déjà généré
	}

	// Récupérer les créneaux actifs pour ce jour
	var creneaux []models.CreneauEmploiTemps
	db.Where("etablissement_id = ? AND jour_semaine = ? AND actif = ?",
		etablissementID, jourSemaine, true).Find(&creneaux)

	count := 0
	for _, cr := range creneaux {
		// Filtrer par semaine paire/impaire
		if cr.SemaineType == models.SemainePaire && !semainePaire {
			continue
		}
		if cr.SemaineType == models.SemaineImpaire && semainePaire {
			continue
		}

		// Parser les heures
		hDebut, _ := time.Parse("15:04", cr.HeureDebut)
		hFin, _ := time.Parse("15:04", cr.HeureFin)

		heureDebut := time.Date(date.Year(), date.Month(), date.Day(),
			hDebut.Hour(), hDebut.Minute(), 0, 0, date.Location())
		heureFin := time.Date(date.Year(), date.Month(), date.Day(),
			hFin.Hour(), hFin.Minute(), 0, 0, date.Location())

		session := models.SessionCours{
			AffectationCoursID: cr.AffectationCoursID,
			EtablissementID:    etablissementID,
			EnseignantID:       cr.EnseignantID,
			MatiereID:          cr.MatiereID,
			ClasseID:           cr.ClasseID,
			AnneeScolaireID:    annee.ID,
			DateCours:          dateOnly,
			HeureDebut:         heureDebut,
			HeureFin:           heureFin,
			Salle:              cr.Salle,
			Statut:             models.StatutSessionPlanifiee,
		}
		if err := db.Create(&session).Error; err == nil {
			count++
		}
	}

	return count, nil
}

// jourSemaineFromDate convertit une date en JourSemaine (LUNDI...SAMEDI).
// Dimanche = pas de cours (retourne une chaîne vide qui ne matchera aucun
// créneau — les écoles ivoiriennes ne fonctionnent pas le dimanche).
func jourSemaineFromDate(date time.Time) models.JourSemaine {
	switch date.Weekday() {
	case time.Monday:
		return models.JourLundi
	case time.Tuesday:
		return models.JourMardi
	case time.Wednesday:
		return models.JourMercredi
	case time.Thursday:
		return models.JourJeudi
	case time.Friday:
		return models.JourVendredi
	case time.Saturday:
		return models.JourSamedi
	default:
		return models.JourSemaine("") // dimanche = pas de cours
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Vue calendrier (pour la page emploi du temps)
// ─────────────────────────────────────────────────────────────────────────────

// CalendrierSemaine : vue d'emploi du temps d'une semaine complète.
// Organisé par jour → liste des créneaux.
type CalendrierSemaine struct {
	Jours []CalendrierJour `json:"jours"`
}

type CalendrierJour struct {
	Jour     models.JourSemaine       `json:"jour"`
	Label    string                   `json:"label"`
	Creneaux []models.CreneauEmploiTemps `json:"creneaux"`
}

// GetCalendrierSemaine retourne l'emploi du temps complet de l'établissement,
// organisé par jour de la semaine (pour affichage calendrier grille).
func (s *EmploiTempsService) GetCalendrierSemaine(etablissementID uuid.UUID, classeID *uuid.UUID) (*CalendrierSemaine, error) {
	creneaux, err := s.ListCreneaux(etablissementID, classeID, nil)
	if err != nil {
		return nil, err
	}

	joursOrder := []struct {
		jour  models.JourSemaine
		label string
	}{
		{models.JourLundi, "Lundi"},
		{models.JourMardi, "Mardi"},
		{models.JourMercredi, "Mercredi"},
		{models.JourJeudi, "Jeudi"},
		{models.JourVendredi, "Vendredi"},
		{models.JourSamedi, "Samedi"},
	}

	cal := &CalendrierSemaine{}
	for _, j := range joursOrder {
		jourCren := CalendrierJour{Jour: j.jour, Label: j.label}
		for _, c := range creneaux {
			if c.JourSemaine == j.jour {
				jourCren.Creneaux = append(jourCren.Creneaux, c)
			}
		}
		cal.Jours = append(cal.Jours, jourCren)
	}

	return cal, nil
}

// Formattage helper pour l'affichage des conflits
func FormatConflits(conflits []ConflitInfo) string {
	if len(conflits) == 0 {
		return ""
	}
	var msgs []string
	for _, c := range conflits {
		msgs = append(msgs, c.Message)
	}
	return strings.Join(msgs, " ; ")
}
