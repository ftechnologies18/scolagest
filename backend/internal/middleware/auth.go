package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/models"
	"github.com/scolagest/backend/internal/services"
)

// AuthMiddleware valide le JWT d'accès et injecte l'utilisateur dans le contexte.
func AuthMiddleware(jwtSvc *services.JWTService) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token manquant"})
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "en-tête Authorization malformé"})
			return
		}

		claims, err := jwtSvc.ValidateToken(parts[1])
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token invalide ou expiré"})
			return
		}

		// Injecter les infos dans le contexte
		c.Set("user_id", claims.UserID)
		c.Set("user_email", claims.Email)
		c.Set("user_role", claims.Role)
		if claims.EtablissementID != nil {
			c.Set("etablissement_id", *claims.EtablissementID)
		}
		c.Next()
	}
}

// RequireRole restreint l'accès à certains rôles.
func RequireRole(roles ...models.RoleUtilisateur) gin.HandlerFunc {
	allowed := make(map[models.RoleUtilisateur]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(c *gin.Context) {
		role, exists := c.Get("user_role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "rôle non déterminé"})
			return
		}
		userRole, ok := role.(models.RoleUtilisateur)
		if !ok || !allowed[userRole] {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "accès refusé — rôle insuffisant"})
			return
		}
		c.Next()
	}
}

// RequireEtablissement vérifie qu'un établissement est sélectionné dans la session.
func RequireEtablissement() gin.HandlerFunc {
	return func(c *gin.Context) {
		etbID, exists := c.Get("etablissement_id")
		if !exists {
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné dans la session"})
			return
		}
		c.Set("etablissement_id_resolved", etbID.(uuid.UUID))
		c.Next()
	}
}

// CurrentUserID extrait l'ID utilisateur du contexte Gin.
func CurrentUserID(c *gin.Context) uuid.UUID {
	if v, ok := c.Get("user_id"); ok {
		return v.(uuid.UUID)
	}
	return uuid.Nil
}

// CurrentEtablissementID extrait l'ID établissement du contexte (si présent).
func CurrentEtablissementID(c *gin.Context) *uuid.UUID {
	if v, ok := c.Get("etablissement_id"); ok {
		id := v.(uuid.UUID)
		return &id
	}
	return nil
}
