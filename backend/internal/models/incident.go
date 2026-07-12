package models

import (
	"time"

	"github.com/google/uuid"
)

// ===== Domaine 9 — Discipline & tickets d'incident (Phase B) =====

// CategorieIncident : catégorie de signalement d'incident élève.
type CategorieIncident string

const (
	CatAbsentéisme   CategorieIncident = "ABSENTEISME"
	CatImpolitesse   CategorieIncident = "IMPOLITESSE"
	CatComportement  CategorieIncident = "COMPORTEMENT"
	CatTravail       CategorieIncident = "TRAVAIL"
	CatRetard        CategorieIncident = "RETARD"
)

// GraviteIncident : niveau de gravité d'un incident.
type GraviteIncident string

const (
	GraviteMineure   GraviteIncident = "MINEUR"
	GraviteModeree   GraviteIncident = "MODERE"
	GraviteSevere    GraviteIncident = "SEVERE"
	GraviteCritique  GraviteIncident = "CRITIQUE"
)

// StatutTicket : cycle de vie d'un ticket d'incident.
type StatutTicket string

const (
	StatutTicketOuvert   StatutTicket = "OUVERT"
	StatutTicketEnCours  StatutTicket = "EN_COURS"
	StatutTicketTraite   StatutTicket = "TRAITE"
	StatutTicketCloture  StatutTicket = "CLOTURE"
	StatutTicketRejete   StatutTicket = "REJETE"
)

// TicketIncident : signalement d'un incident par un enseignant concernant un
// élève. Le prof ouvre un ticket depuis son téléphone (PWA) quand l'élève
// dépasse les bornes ou accumule trop d'absences. L'administration traite
// ensuite le ticket (convocation, sanction, etc.).
//
// Workflow : OUVERT → EN_COURS → TRAITE → CLOTURE
//                         ↘ REJETE (faux signalement)
type TicketIncident struct {
	BaseModel
	EtablissementID uuid.UUID         `gorm:"type:uuid;index;not null" json:"etablissement_id"`
	Etablissement   *Etablissement    `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
	// Élève concerné
	EleveID         uuid.UUID         `gorm:"type:uuid;index;not null" json:"eleve_id"`
	Eleve           *Eleve            `gorm:"foreignKey:EleveID" json:"eleve,omitempty"`
	// Enseignant qui signale
	EnseignantID    uuid.UUID         `gorm:"type:uuid;index;not null" json:"enseignant_id"`
	Enseignant      *Enseignant       `gorm:"foreignKey:EnseignantID" json:"enseignant,omitempty"`
	// Contexte du cours (optionnel — l'incident peut être hors cours)
	ClasseID        *uuid.UUID        `gorm:"type:uuid;index" json:"classe_id,omitempty"`
	Classe          *Classe           `gorm:"foreignKey:ClasseID" json:"classe,omitempty"`
	MatiereID       *uuid.UUID        `gorm:"type:uuid;index" json:"matiere_id,omitempty"`
	Matiere         *Matiere          `gorm:"foreignKey:MatiereID" json:"matiere,omitempty"`
	SessionCoursID  *uuid.UUID        `gorm:"type:uuid;index" json:"session_cours_id,omitempty"`
	// Détails
	Categorie       CategorieIncident `gorm:"not null;index" json:"categorie"`
	Gravite         GraviteIncident   `gorm:"not null" json:"gravite"`
	Description     string            `gorm:"type:text;not null" json:"description"`
	DateIncident    time.Time         `gorm:"not null" json:"date_incident"`
	// Anonymat : si true, l'admin ne voit pas quel prof a signalé
	Anonyme         bool              `gorm:"not null;default:false" json:"anonyme"`
	// Photo (optionnelle — pour cas graves, stockée sur Cloudflare R2)
	PhotoURL        string            `json:"photo_url"`
	// Statut & traitement
	Statut          StatutTicket      `gorm:"not null;default:OUVERT;index" json:"statut"`
	ActionPrise     string            `gorm:"type:text" json:"action_prise"` // ex: "Convocation parents 15/07"
	TraitePar       *uuid.UUID        `gorm:"type:uuid;index" json:"traite_par,omitempty"` // admin qui a traité
	DateTraitement  *time.Time        `json:"date_traitement,omitempty"`
	// Sync offline (comme les pointages)
	SyncEnAttente   bool              `gorm:"not null;default:false" json:"sync_en_attente"`
}

func (TicketIncident) TableName() string { return "ticket_incidents" }
