package models

import "github.com/google/uuid"

// ===== Domaine 8 — Notification (in-app, bonus) =====

// Notification : notification in-app adressée à un utilisateur.
type Notification struct {
        BaseModel
        UtilisateurID uuid.UUID `gorm:"type:uuid;index;not null" json:"utilisateur_id"`
        Utilisateur   *Utilisateur `gorm:"foreignKey:UtilisateurID" json:"utilisateur,omitempty"`
        Type          string    `gorm:"not null" json:"type"`
        Message       string    `gorm:"not null" json:"message"`
        Lu            bool      `gorm:"not null;default:false" json:"lu"`
        Lien          string    `json:"lien"`
}

func (Notification) TableName() string { return "notifications" }
