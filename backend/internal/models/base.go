package models

import (
        "time"

        "github.com/google/uuid"
        "gorm.io/gorm"
)

// BaseModel fournit un ID UUID généré automatiquement et des timestamps d'audit.
// Toutes les entités métier l'embarquent par composition.
//
// L'UUID est généré côté Go (hook BeforeCreate) pour être compatible avec
// SQLite ET PostgreSQL (qui n'ont pas la même fonction UUID par défaut).
type BaseModel struct {
        ID        uuid.UUID      `gorm:"type:uuid;primaryKey" json:"id"`
        CreatedAt time.Time      `json:"created_at"`
        UpdatedAt time.Time      `json:"updated_at"`
        DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
}

// BeforeCreate génère un UUID avant l'insertion si l'ID est nul.
// Garanti côté application — compatible SQLite et PostgreSQL.
func (b *BaseModel) BeforeCreate(tx *gorm.DB) error {
        if b.ID == uuid.Nil {
                b.ID = uuid.New()
        }
        return nil
}
