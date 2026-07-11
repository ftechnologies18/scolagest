package database

import (
	"context"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// txKey est la clé de contexte pour stocker la transaction RLS.
type txKey struct{}

// BeginRLSTx démarre une transaction et configure les variables RLS.
// Établit le contexte tenant pour la requête en cours.
// Retourne la transaction et une fonction de finalisation (commit/rollback).
func BeginRLSTx(ctx context.Context, tenantID string, isSuperAdmin bool) (*gorm.DB, func(commit bool)) {
	tx := DB.WithContext(ctx).Begin()

	if isSuperAdmin {
		tx.Exec("SET LOCAL app.is_super_admin = 'true'")
	} else if tenantID != "" {
		tx.Exec("SET LOCAL app.current_tenant_id = ?", tenantID)
	}

	return tx, func(commit bool) {
		if commit {
			tx.Commit()
		} else {
			tx.Rollback()
		}
	}
}

// GetDB récupère la transaction RLS depuis le contexte Gin.
// Si aucune transaction n'est trouvée, retourne la connexion globale (sans RLS).
func GetDB(c *gin.Context) *gorm.DB {
	if tx, exists := c.Get("db_tx"); exists {
		if db, ok := tx.(*gorm.DB); ok && db != nil {
			return db
		}
	}
	return DB
}

// WithTx stocke une transaction dans un context.Context (pour propagation).
func WithTx(ctx context.Context, tx *gorm.DB) context.Context {
	return context.WithValue(ctx, txKey{}, tx)
}

// TxFromContext récupère une transaction depuis un context.Context.
func TxFromContext(ctx context.Context) *gorm.DB {
	if tx, ok := ctx.Value(txKey{}).(*gorm.DB); ok && tx != nil {
		return tx
	}
	return DB
}
