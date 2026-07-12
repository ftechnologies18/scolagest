package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
)

// RLSMiddleware enveloppe chaque requête authentifiée dans une transaction PostgreSQL
// avec les variables RLS (Row-Level Security) configurées :
//   - app.current_tenant_id = UUID de l'établissement (pour le staff)
//   - app.is_super_admin = 'true' (pour SUPER_ADMIN, bypass RLS)
//
// La transaction est stockée dans le contexte Gin ("db_tx") et doit être utilisée
// par les handlers via database.GetDB(c).
// À la fin de la requête, la transaction est commitée (ou rollback en cas d'erreur).
func RLSMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Récupérer le rôle et l'établissement depuis le contexte (définis par AuthMiddleware)
		role, _ := c.Get("user_role")
		etbID, _ := c.Get("etablissement_id")

		userRole, _ := role.(models.RoleUtilisateur)
		isSuperAdmin := userRole == models.RoleSuperAdmin

		var tenantID string
		if id, ok := etbID.(uuid.UUID); ok {
			tenantID = id.String()
		}

		// Démarrer la transaction RLS
		tx, finalize := database.BeginRLSTx(c.Request.Context(), tenantID, isSuperAdmin)

		// Stocker la transaction dans le contexte Gin
		c.Set("db_tx", tx)

		// Traiter la requête
		c.Next()

		// Finaliser la transaction
		// Si le status code est >= 400, on rollback ; sinon on commit
		commit := c.Writer.Status() < 400
		finalize(commit)
	}
}
