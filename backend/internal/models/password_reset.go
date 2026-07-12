package models

import (
	"time"

	"github.com/google/uuid"
)

// PasswordResetToken : token de réinitialisation de mot de passe staff.
// Généré quand un utilisateur demande "mot de passe oublié". Le token est
// envoyé par email (ou affiché en mode démo sans SMTP) et permet de reset
// le mot de passe via /reset-password?token=XXX.
//
// Expiration : 1 heure. À usage unique (UsedAt non-null = consommé).
type PasswordResetToken struct {
	BaseModel
	UserID    uuid.UUID  `gorm:"type:uuid;index;not null" json:"user_id"`
	User      *Utilisateur `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Token     string     `gorm:"uniqueIndex;not null" json:"-"`
	ExpiresAt time.Time  `gorm:"not null" json:"expires_at"`
	UsedAt    *time.Time `json:"used_at,omitempty"`
	IP        string     `json:"ip"`
}

func (PasswordResetToken) TableName() string { return "password_reset_tokens" }
