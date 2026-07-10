package models

import (
        "time"

        "github.com/google/uuid"
)

// ===== Domaine 6 — Communication (SMS/Email de relance — V1 étendu) =====

// TemplateMessage : modèle de message avec variables ({{eleve_nom}}, {{montant}}, etc.).
type TemplateMessage struct {
        BaseModel
        EtablissementID *uuid.UUID   `gorm:"type:uuid;index" json:"etablissement_id"`
        Code            string       `gorm:"not null" json:"code"`
        Type            TypeMessage  `gorm:"not null" json:"type"`
        Sujet           string       `json:"sujet"`
        Corps           string       `gorm:"not null" json:"corps"`
        Actif           bool         `gorm:"not null;default:true" json:"actif"`
}

func (TemplateMessage) TableName() string { return "template_messages" }

// EnvoiMessage : un envoi effectif d'un message à un tuteur (parent).
type EnvoiMessage struct {
        BaseModel
        EleveID          uuid.UUID    `gorm:"type:uuid;index;not null" json:"eleve_id"`
        Eleve            *Eleve       `gorm:"foreignKey:EleveID" json:"eleve,omitempty"`
        TuteurID         uuid.UUID    `gorm:"type:uuid;index;not null" json:"tuteur_id"`
        Tuteur           *Tuteur      `gorm:"foreignKey:TuteurID" json:"tuteur,omitempty"`
        EtablissementID  uuid.UUID    `gorm:"type:uuid;index;not null" json:"etablissement_id"`
        TemplateID       *uuid.UUID   `gorm:"type:uuid;index" json:"template_id"`
        Template         *TemplateMessage `gorm:"foreignKey:TemplateID" json:"template,omitempty"`
        Type             TypeMessage  `gorm:"not null" json:"type"`
        Destinataire     string       `gorm:"not null" json:"destinataire"`
        ContenuGenere    string       `gorm:"not null" json:"contenu_genere"`
        Statut           StatutEnvoi  `gorm:"not null;default:EN_ATTENTE" json:"statut"`
        Provider         string       `json:"provider"`
        ReferenceExterne string       `json:"reference_externe"`
        DateCreation     time.Time    `gorm:"not null" json:"date_creation"`
        DateEnvoi        *time.Time   `json:"date_envoi"`
        Erreur           string       `json:"erreur"`
}

func (EnvoiMessage) TableName() string { return "envoi_messages" }
