package database

import (
        "bytes"
        "context"
        "runtime"
        "strconv"
        "sync"

        "github.com/gin-gonic/gin"
        "gorm.io/gorm"
)

// txKey est la clé de contexte pour stocker la transaction RLS.
type txKey struct{}

// goroutineTxs stocke les transactions RLS par goroutine ID.
// Chaque requête HTTP s'exécute dans son propre goroutine, donc cette approche
// est sûre : chaque goroutine a sa propre transaction, isolée des autres.
var goroutineTxs sync.Map

// getGoroutineID extrait l'ID du goroutine courant (pour le stockage thread-local).
func getGoroutineID() uint64 {
        b := make([]byte, 64)
        b = b[:runtime.Stack(b, false)]
        b = bytes.TrimPrefix(b, []byte("goroutine "))
        b = b[:bytes.IndexByte(b, ' ')]
        n, _ := strconv.ParseUint(string(b), 10, 64)
        return n
}

// SetCurrentTx stocke la transaction RLS pour le goroutine courant.
// Appelé par AuthMiddleware au début de chaque requête.
func SetCurrentTx(tx *gorm.DB) {
        goroutineTxs.Store(getGoroutineID(), tx)
}

// ClearCurrentTx supprime la transaction RLS pour le goroutine courant.
// Appelé par AuthMiddleware à la fin de chaque requête.
func ClearCurrentTx() {
        goroutineTxs.Delete(getGoroutineID())
}

// Current retourne la transaction RLS du goroutine courant, ou la connexion
// globale si aucune transaction n'est active (ex: seed, background tasks).
// Tous les services doivent utiliser database.Current() au lieu de database.DB.
func Current() *gorm.DB {
        if tx, ok := goroutineTxs.Load(getGoroutineID()); ok {
                return tx.(*gorm.DB)
        }
        return DB
}

// BeginRLSTx démarre une transaction et configure les variables RLS.
func BeginRLSTx(ctx context.Context, tenantID string, isSuperAdmin bool) (*gorm.DB, func(commit bool)) {
        tx := DB.WithContext(ctx).Begin()

        // Utiliser set_config() au lieu de SET LOCAL car SET LOCAL ne supporte
        // pas les paramètres bindés dans GORM. set_config(name, value, is_local=true)
        // équivaut à SET LOCAL et est limité à la transaction courante.
        if isSuperAdmin {
                tx.Exec("SELECT set_config('app.is_super_admin', 'true', true)")
        } else if tenantID != "" {
                tx.Exec("SELECT set_config('app.current_tenant_id', ?, true)", tenantID)
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
func GetDB(c *gin.Context) *gorm.DB {
        if tx, exists := c.Get("db_tx"); exists {
                if db, ok := tx.(*gorm.DB); ok && db != nil {
                        return db
                }
        }
        return DB
}

// WithTx stocke une transaction dans un context.Context.
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
