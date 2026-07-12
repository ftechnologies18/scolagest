package services

import (
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
	"gorm.io/gorm"
)

// PointageService gère le pointage des enseignants : génération des sessions
// de cours, enregistrement des pointages (avec GPS offline-first), validation
// par geofencing, et écran temps réel pour le secrétariat.
type PointageService struct{}

func NewPointageService() *PointageService { return &PointageService{} }

// ─────────────────────────────────────────────────────────────────────────────
// Geofencing — calcul de distance Haversine + validation GPS
// ─────────────────────────────────────────────────────────────────────────────

// haversineDistance calcule la distance en mètres entre deux points GPS
// (formule de Haversine — prend en compte la courbure terrestre).
func haversineDistance(lat1, lng1, lat2, lng2 float64) float64 {
	const earthRadius = 6371000 // mètres
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadius * c
}

// validateGPS vérifie si le pointage est dans la zone de l'établissement.
// Retourne le statut de validation + un motif si rejeté.
//
// Règles :
// - Si distance <= rayon → VALIDE
// - Si distance <= rayon + 100m → VALIDATION_REQUISE (GPS borderline, tolérance)
// - Si distance > rayon + 300m → FRAUDE_SUSPECTEE
func validateGPS(lat, lng float64, etb models.Etablissement) (models.StatutPointage, string) {
	if etb.GeoLat == 0 || etb.GeoLng == 0 {
		// Pas de GPS configuré sur l'établissement → on accepte sans validation
		return models.StatutPointValide, ""
	}

	rayon := etb.GeoRayon
	if rayon <= 0 {
		rayon = 200
	}

	distance := haversineDistance(lat, lng, etb.GeoLat, etb.GeoLng)

	if distance <= float64(rayon) {
		return models.StatutPointValide, ""
	}
	if distance <= float64(rayon)+300 {
		return models.StatutPointValidationRequise, fmt.Sprintf("GPS borderline (%.0fm de l'établissement, rayon %dm)", distance, rayon)
	}
	return models.StatutPointFraudeSuspectee, fmt.Sprintf("GPS hors zone (%.0fm de l'établissement)", distance)
}

// ─────────────────────────────────────────────────────────────────────────────
// Sessions de cours
// ─────────────────────────────────────────────────────────────────────────────

// GenerateSessionsForDate génère les sessions de cours pour une date donnée
// à partir des affectations actives. À appeler chaque matin (ou à la demande).
func (s *PointageService) GenerateSessionsForDate(etablissementID uuid.UUID, date time.Time) error {
	db := database.Current()

	// Récupérer l'année active
	var annee models.AnneeScolaire
	if err := db.Where("est_active = ?", true).First(&annee).Error; err != nil {
		return errors.New("aucune année active")
	}

	// Récupérer les affectations actives
	var affectations []models.AffectationCours
	db.Where("etablissement_id = ? AND annee_scolaire_id = ? AND actif = ?",
		etablissementID, annee.ID, true).Find(&affectations)

	// Vérifier si les sessions existent déjà pour cette date
	dateOnly := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	var existingCount int64
	db.Model(&models.SessionCours{}).
		Where("etablissement_id = ? AND date_cours = ?", etablissementID, dateOnly).
		Count(&existingCount)
	if existingCount > 0 {
		return nil // déjà généré
	}

	// Heures de cours par défaut (8h-10h, 10h-12h, 15h-17h — simplifié)
	// TODO: dans une vraie implémentation, lire l'emploi du temps réel
	creneaux := []struct {
		debut int
		fin   int
	}{
		{8, 10},
		{10, 12},
		{15, 17},
	}

	for _, aff := range affectations {
		for _, cr := range creneaux {
			session := models.SessionCours{
				AffectationCoursID: aff.ID,
				EtablissementID:    etablissementID,
				EnseignantID:       aff.EnseignantID,
				MatiereID:          aff.MatiereID,
				ClasseID:           aff.ClasseID,
				AnneeScolaireID:    aff.AnneeScolaireID,
				DateCours:          dateOnly,
				HeureDebut:         time.Date(date.Year(), date.Month(), date.Day(), cr.debut, 0, 0, 0, date.Location()),
				HeureFin:           time.Date(date.Year(), date.Month(), date.Day(), cr.fin, 0, 0, 0, date.Location()),
				Statut:             models.StatutSessionPlanifiee,
			}
			db.Create(&session)
		}
	}

	return nil
}

// GetSessionsEnseignant retourne les sessions de cours d'un enseignant pour
// une date donnée (pour le portail prof — "mes cours du jour").
func (s *PointageService) GetSessionsEnseignant(enseignantID uuid.UUID, date time.Time) ([]models.SessionCours, error) {
	dateOnly := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())

	var sessions []models.SessionCours
	err := database.Current().
		Where("enseignant_id = ? AND date_cours = ?", enseignantID, dateOnly).
		Preload("Pointages").
		Preload("Affectation.Matiere").
		Preload("Affectation.Classe").
		Order("heure_debut ASC").
		Find(&sessions).Error
	if err != nil {
		return nil, err
	}
	return sessions, nil
}

// GetSessionsEtablissement retourne toutes les sessions d'un établissement
// pour une date (pour l'écran secrétariat temps réel).
func (s *PointageService) GetSessionsEtablissement(etablissementID uuid.UUID, date time.Time) ([]models.SessionCours, error) {
	dateOnly := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())

	var sessions []models.SessionCours
	err := database.Current().
		Where("etablissement_id = ? AND date_cours = ?", etablissementID, dateOnly).
		Preload("Enseignant").
		Preload("Pointages").
		Preload("Affectation.Matiere").
		Preload("Affectation.Classe").
		Order("heure_debut ASC").
		Find(&sessions).Error
	if err != nil {
		return nil, err
	}
	return sessions, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Pointage (enregistrement + validation GPS)
// ─────────────────────────────────────────────────────────────────────────────

// PointageDTO : payload de pointage depuis le smartphone du prof.
type PointageDTO struct {
	SessionCoursID  uuid.UUID  `json:"session_cours_id"`
	Type            models.TypePointage `json:"type"` // ENTREE / SORTIE
	DateHeureClient time.Time  `json:"date_heure_client"` // heure du clic sur le téléphone
	GeoLat          float64    `json:"geo_lat"`
	GeoLng          float64    `json:"geo_lng"`
	GeoPrecision    float64    `json:"geo_precision"` // précision GPS en mètres
	Methode         string     `json:"methode"`       // GPS_ONLINE / GPS_OFFLINE
}

// PointageResult : résultat de l'enregistrement d'un pointage.
type PointageResult struct {
	Pointage *models.Pointage `json:"pointage"`
	Alerte   string           `json:"alerte,omitempty"` // message si validation requise ou fraude
}

// CreatePointage enregistre un pointage d'enseignant et le valide par geofencing.
func (s *PointageService) CreatePointage(dto PointageDTO, enseignantID uuid.UUID) (*PointageResult, error) {
	db := database.Current()

	// Récupérer la session
	var session models.SessionCours
	if err := db.First(&session, "id = ?", dto.SessionCoursID).Error; err != nil {
		return nil, errors.New("session de cours introuvable")
	}

	// Vérifier que c'est bien le prof de la session
	if session.EnseignantID != enseignantID {
		return nil, errors.New("ce n'est pas votre session de cours")
	}

	// Récupérer l'établissement pour le geofencing
	var etb models.Etablissement
	db.First(&etb, "id = ?", session.EtablissementID)

	// Valider le GPS
	statutGPS, motif := validateGPS(dto.GeoLat, dto.GeoLng, etb)

	// Détection horodatage suspect (écart > 5 min entre client et serveur)
	now := time.Now()
	ecartHorodatage := now.Sub(dto.DateHeureClient)
	if ecartHorodatage < 0 {
		ecartHorodatage = -ecartHorodatage
	}
	if ecartHorodatage > 5*time.Minute {
		statutGPS = models.StatutPointFraudeSuspectee
		motif = fmt.Sprintf("Horodatage suspect (écart de %.0f min entre le téléphone et le serveur)", ecartHorodatage.Minutes())
	}

	// Créer le pointage
	p := models.Pointage{
		SessionCoursID:   dto.SessionCoursID,
		EnseignantID:     enseignantID,
		EtablissementID:  session.EtablissementID,
		Type:             dto.Type,
		DateHeureClient:  dto.DateHeureClient,
		DateHeureServeur: now,
		GeoLat:           dto.GeoLat,
		GeoLng:           dto.GeoLng,
		GeoPrecision:     dto.GeoPrecision,
		Statut:           statutGPS,
		Methode:          dto.Methode,
		MotifRejet:       motif,
	}

	if err := db.Create(&p).Error; err != nil {
		return nil, fmt.Errorf("création pointage: %w", err)
	}

	// Mettre à jour le statut de la session
	if dto.Type == models.TypePointageEntree {
		db.Model(&session).Update("statut", models.StatutSessionEnCours)
	} else {
		db.Model(&session).Update("statut", models.StatutSessionTerminee)
	}

	// Construire l'alerte
	alerte := ""
	if statutGPS == models.StatutPointValidationRequise {
		alerte = "Pointage enregistré. GPS en attente de validation (position borderline)."
	} else if statutGPS == models.StatutPointFraudeSuspectee {
		alerte = "Pointage rejeté. " + motif
	}

	return &PointageResult{Pointage: &p, Alerte: alerte}, nil
}

// ValidePointageManuel permet au surveillant de valider manuellement un
// pointage en attente (régularisation — le prof était là mais pas de GPS
// ou problème technique).
func (s *PointageService) ValidePointageManuel(pointageID, adminID uuid.UUID) error {
	now := time.Now()
	return database.Current().Model(&models.Pointage{}).
		Where("id = ?", pointageID).
		Updates(map[string]interface{}{
			"statut":          models.StatutPointValideManuel,
			"valide_par":      adminID,
			"date_validation": &now,
		}).Error
}

// ─────────────────────────────────────────────────────────────────────────────
// Statistiques temps réel (écran secrétariat)
// ─────────────────────────────────────────────────────────────────────────────

// SessionAvecStatut : session avec son statut de pointage dérivé pour l'affichage.
type SessionAvecStatut struct {
	models.SessionCours
	StatutAffichage string `json:"statut_affichage"` // VERT / JAUNE / ROUGE / ORANGE
	PointageEntree  *models.Pointage `json:"pointage_entree,omitempty"`
}

// GetSessionsAvecStatut retourne les sessions du jour avec un statut couleur
// pour l'écran secrétariat :
// - VERT 🟢 : prof a pointé, GPS validé
// - JAUNE 🟡 : pointage en attente de sync (offline)
// - ROUGE 🔴 : aucun pointage reçu
// - ORANGE 🟠 : validation requise (GPS borderline)
func (s *PointageService) GetSessionsAvecStatut(etablissementID uuid.UUID, date time.Time) ([]SessionAvecStatut, error) {
	sessions, err := s.GetSessionsEtablissement(etablissementID, date)
	if err != nil {
		return nil, err
	}

	result := make([]SessionAvecStatut, 0, len(sessions))
	now := time.Now()

	for _, sess := range sessions {
		sws := SessionAvecStatut{SessionCours: sess}

		// Chercher le pointage d'entrée
		for _, p := range sess.Pointages {
			if p.Type == models.TypePointageEntree {
				sws.PointageEntree = &p
				break
			}
		}

		// Déterminer le statut d'affichage
		if sws.PointageEntree != nil {
			switch sws.PointageEntree.Statut {
			case models.StatutPointValide, models.StatutPointValideManuel:
				sws.StatutAffichage = "VERT"
			case models.StatutPointSyncEnAttente:
				sws.StatutAffichage = "JAUNE"
			case models.StatutPointValidationRequise:
				sws.StatutAffichage = "ORANGE"
			case models.StatutPointFraudeSuspectee:
				sws.StatutAffichage = "ROUGE"
			default:
				sws.StatutAffichage = "JAUNE"
			}
		} else {
			// Pas de pointage — vérifier si le cours a commencé
			if now.After(sess.HeureDebut.Add(10 * time.Minute)) {
				sws.StatutAffichage = "ROUGE" // cours commencé depuis +10 min, pas de pointage
			} else {
				sws.StatutAffichage = "ROUGE" // en attente
			}
		}

		result = append(result, sws)
	}

	return result, nil
}

// GetEnseignantIDFromUtilisateur récupère l'ID enseignant depuis l'ID utilisateur.
func (s *PointageService) GetEnseignantIDFromUtilisateur(utilisateurID uuid.UUID) (*uuid.UUID, error) {
	var ens models.Enseignant
	if err := database.Current().Where("utilisateur_id = ?", utilisateurID).First(&ens).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("aucun profil enseignant lié à ce compte")
		}
		return nil, err
	}
	return &ens.ID, nil
}
