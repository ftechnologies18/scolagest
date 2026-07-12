package models

import (
	"time"

	"github.com/google/uuid"
)

// ===== Domaine 8 — Pointage enseignant (Phase B) =====

// StatutSession : statut d'une session de cours planifiée.
type StatutSession string

const (
	StatutSessionPlanifiee StatutSession = "PLANIFIEE"
	StatutSessionEnCours   StatutSession = "EN_COURS"
	StatutSessionTerminee  StatutSession = "TERMINEE"
	StatutSessionAnnulee   StatutSession = "ANNULEE"
)

// StatutPointage : statut d'un pointage enseignant.
type StatutPointage string

const (
	// StatutPointSyncEnAttente : pointage enregistré localement (offline),
	// en attente de synchronisation vers le serveur.
	StatutPointSyncEnAttente StatutPointage = "SYNC_EN_ATTENTE"
	// StatutPointValide : pointage reçu, GPS validé (dans le rayon de l'établissement).
	StatutPointValide StatutPointage = "VALIDE"
	// StatutPointValidationRequise : pointage reçu mais GPS borderline
	// (hors rayon mais < 300m) — nécessite validation manuelle du surveillant.
	StatutPointValidationRequise StatutPointage = "VALIDATION_REQUISE"
	// StatutPointFraudeSuspectee : pointage reçu mais GPS très loin (> 500m)
	// ou horodatage suspect — rejeté automatiquement.
	StatutPointFraudeSuspectee StatutPointage = "FRAUDE_SUSPECTEE"
	// StatutPointValideManuel : pointage validé manuellement par le surveillant
	// (régularisation — le prof était là mais pas de GPS ou problème technique).
	StatutPointValideManuel StatutPointage = "VALIDE_MANUEL"
)

// TypePointage : entrée ou sortie de cours.
type TypePointage string

const (
	TypePointageEntree TypePointage = "ENTREE"
	TypePointageSortie TypePointage = "SORTIE"
)

// SessionCours : une session de cours planifiée (instance d'une AffectationCours
// à une date donnée). Générée automatiquement chaque jour pour chaque
// affectation active, ou créée manuellement.
type SessionCours struct {
	BaseModel
	AffectationCoursID uuid.UUID       `gorm:"type:uuid;index;not null" json:"affectation_cours_id"`
	Affectation        *AffectationCours `gorm:"foreignKey:AffectationCoursID" json:"affectation,omitempty"`
	EtablissementID    uuid.UUID       `gorm:"type:uuid;index;not null" json:"etablissement_id"`
	EnseignantID       uuid.UUID       `gorm:"type:uuid;index;not null" json:"enseignant_id"`
	Enseignant         *Enseignant     `gorm:"foreignKey:EnseignantID" json:"enseignant,omitempty"`
	MatiereID          uuid.UUID       `gorm:"type:uuid;not null" json:"matiere_id"`
	ClasseID           uuid.UUID       `gorm:"type:uuid;not null" json:"classe_id"`
	AnneeScolaireID    uuid.UUID       `gorm:"type:uuid;not null" json:"annee_scolaire_id"`
	DateCours          time.Time       `gorm:"type:date;index;not null" json:"date_cours"`
	HeureDebut         time.Time       `gorm:"not null" json:"heure_debut"`
	HeureFin           time.Time       `gorm:"not null" json:"heure_fin"`
	Salle              string          `json:"salle"`
	Statut             StatutSession   `gorm:"not null;default:PLANIFIEE" json:"statut"`
	// Pointages : pointages entrée/sortie de l'enseignant (has-many)
	Pointages          []Pointage      `gorm:"foreignKey:SessionCoursID" json:"pointages,omitempty"`
}

func (SessionCours) TableName() string { return "session_cours" }

// Pointage : un pointage d'enseignant (entrée ou sortie) pour une session.
// Capturé sur le smartphone du prof (PWA offline-first), synchronisé quand
// le réseau est disponible. Validé par geofencing côté serveur.
type Pointage struct {
	BaseModel
	SessionCoursID    uuid.UUID     `gorm:"type:uuid;index;not null" json:"session_cours_id"`
	SessionCours      *SessionCours `gorm:"foreignKey:SessionCoursID" json:"session_cours,omitempty"`
	EnseignantID      uuid.UUID     `gorm:"type:uuid;index;not null" json:"enseignant_id"`
	Enseignant        *Enseignant   `gorm:"foreignKey:EnseignantID" json:"enseignant,omitempty"`
	EtablissementID   uuid.UUID     `gorm:"type:uuid;index;not null" json:"etablissement_id"`
	Type              TypePointage  `gorm:"not null" json:"type"` // ENTREE / SORTIE
	// DateHeureClient : horodatage capturé sur le téléphone au moment du clic
	DateHeureClient   time.Time     `gorm:"not null" json:"date_heure_client"`
	// DateHeureServeur : horodatage de réception par le serveur (pour détection fraude)
	DateHeureServeur  time.Time     `gorm:"not null" json:"date_heure_serveur"`
	// GPS : coordonnées capturées par le téléphone
	GeoLat            float64       `gorm:"type:decimal(10,7)" json:"geo_lat"`
	GeoLng            float64       `gorm:"type:decimal(10,7)" json:"geo_lng"`
	GeoPrecision      float64       `json:"geo_precision"` // précision GPS en mètres
	// Statut : validation serveur (VALIDE / VALIDATION_REQUISE / FRAUDE_SUSPECTEE / VALIDE_MANUEL)
	Statut            StatutPointage `gorm:"not null;default:SYNC_EN_ATTENTE;index" json:"statut"`
	// Methode : comment le pointage a été fait (GPS_OFFLINE / GPS_ONLINE / MANUEL_ADMIN)
	Methode           string        `gorm:"not null;default:GPS_ONLINE" json:"methode"`
	// MotifRejet : si FRAUDE_SUSPECTEE ou VALIDATION_REQUISE, motif
	MotifRejet        string        `json:"motif_rejet"`
	// ValidePar : admin qui a validé manuellement (si VALIDE_MANUEL)
	ValidePar         *uuid.UUID    `gorm:"type:uuid;index" json:"valide_par,omitempty"`
	DateValidation    *time.Time    `json:"date_validation,omitempty"`
}

func (Pointage) TableName() string { return "pointages" }
