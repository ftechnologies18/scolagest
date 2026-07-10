package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BaseModel fournit un ID UUID généré automatiquement et des timestamps d'audit.
// Toutes les entités métier l'embarquent par composition.
type BaseModel struct {
	ID        uuid.UUID      `gorm:"type:uuid;primaryKey;default:(uuid())" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

// BeforeCreate génère un UUID avant l'insertion si l'ID est nul.
func (b *BaseModel) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}
