package models

import (
	"github.com/google/uuid"
)

// ===== Domaine 7b — Emploi du temps (Phase A étendue) =====

// JourSemaine : jours de la semaine scolaire (lundi à samedi).
type JourSemaine string

const (
	JourLundi    JourSemaine = "LUNDI"
	JourMardi    JourSemaine = "MARDI"
	JourMercredi JourSemaine = "MERCREDI"
	JourJeudi    JourSemaine = "JEUDI"
	JourVendredi JourSemaine = "VENDREDI"
	JourSamedi   JourSemaine = "SAMEDI"
)

// SemaineType : pour les emplois du temps alternés (semaines paires/impaires).
type SemaineType string

const (
	SemaineToutes  SemaineType = "TOUTES"
	SemainePaire   SemaineType = "PAIRE"
	SemaineImpaire SemaineType = "IMPAIRE"
)

// CreneauEmploiTemps : un créneau fixe dans l'emploi du temps d'un
// établissement. Définit qu'un enseignant donne une matière à une classe,
// à un jour et une heure fixes, dans une salle donnée.
//
// Ces créneaux sont la source de vérité pour la génération automatique des
// SessionCours chaque nuit (cron) ou à la demande.
type CreneauEmploiTemps struct {
	BaseModel
	EtablissementID    uuid.UUID       `gorm:"type:uuid;index;not null" json:"etablissement_id"`
	Etablissement      *Etablissement  `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
	AffectationCoursID uuid.UUID       `gorm:"type:uuid;index;not null" json:"affectation_cours_id"`
	Affectation        *AffectationCours `gorm:"foreignKey:AffectationCoursID" json:"affectation,omitempty"`
	// Dénormalisé pour requêtes plus simples (évite de join Affectation à chaque fois)
	EnseignantID uuid.UUID `gorm:"type:uuid;index;not null" json:"enseignant_id"`
	MatiereID    uuid.UUID `gorm:"type:uuid;index;not null" json:"matiere_id"`
	ClasseID     uuid.UUID `gorm:"type:uuid;index;not null" json:"classe_id"`
	// Planning
	JourSemaine  JourSemaine `gorm:"not null;index" json:"jour_semaine"`
	HeureDebut   string      `gorm:"not null;type:time" json:"heure_debut"` // "08:00"
	HeureFin     string      `gorm:"not null;type:time" json:"heure_fin"`   // "10:00"
	Salle        string      `json:"salle"`
	SemaineType  SemaineType `gorm:"not null;default:TOUTES" json:"semaine_type"`
	Actif        bool        `gorm:"not null;default:true" json:"actif"`
}

func (CreneauEmploiTemps) TableName() string { return "creneau_emploi_temps" }
