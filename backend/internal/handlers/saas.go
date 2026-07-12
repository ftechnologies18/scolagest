package handlers

import (
        "net/http"

        "github.com/gin-gonic/gin"
        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/database"
        "github.com/scolagest/backend/internal/middleware"
        "github.com/scolagest/backend/internal/models"
        "github.com/scolagest/backend/internal/services"
)

// SaasHandler expose les endpoints plateforme (SUPER_ADMIN uniquement).
type SaasHandler struct {
        svc *services.SaasService
}

func NewSaasHandler(svc *services.SaasService) *SaasHandler {
        return &SaasHandler{svc: svc}
}

// RequireSuperAdmin bloque l'accès aux non-SUPER_ADMIN.
func RequireSuperAdmin() gin.HandlerFunc {
        return func(c *gin.Context) {
                role, exists := c.Get("user_role")
                if !exists {
                        c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "rôle non déterminé"})
                        return
                }
                userRole, ok := role.(models.RoleUtilisateur)
                if !ok || userRole != models.RoleSuperAdmin {
                        c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "accès réservé au SUPER_ADMIN"})
                        return
                }
                c.Next()
        }
}

// ListEstablishments gère GET /api/saas/establishments
func (h *SaasHandler) ListEstablishments(c *gin.Context) {
        etabs, err := h.svc.ListEstablishments()
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, etabs)
}

// GetStats gère GET /api/saas/stats
func (h *SaasHandler) GetStats(c *gin.Context) {
        stats, err := h.svc.GetStats()
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, stats)
}

// ActivateSupport gère POST /api/saas/support/activate
func (h *SaasHandler) ActivateSupport(c *gin.Context) {
        userID := middleware.CurrentUserID(c)
        var body struct {
                EtablissementID uuid.UUID `json:"etablissement_id"`
        }
        if err := c.ShouldBindJSON(&body); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "etablissement_id requis"})
                return
        }
        token, err := h.svc.ActivateSupport(userID, body.EtablissementID)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, gin.H{
                "support_token":         token,
                "etablissement_id":      body.EtablissementID,
                "expires_in":            3600,
                "message":               "Mode support activé pour 1h — accès aux données de l'établissement",
        })
}

// DeactivateSupport gère POST /api/saas/support/deactivate
func (h *SaasHandler) DeactivateSupport(c *gin.Context) {
        userID := middleware.CurrentUserID(c)
        h.svc.DeactivateSupport(userID, nil)
        c.JSON(http.StatusOK, gin.H{"success": true, "message": "Mode support désactivé"})
}

// ListAudit gère GET /api/saas/audit (audit global plateforme)
func (h *SaasHandler) ListAudit(c *gin.Context) {
        // Réutilise le UserService pour l'audit
        // Ici on retourne l'audit global (pas filtré par établissement)
        var entries []models.JournalAudit
        database.DB.Preload("Utilisateur").Order("date DESC").Limit(50).Find(&entries)
        c.JSON(http.StatusOK, entries)
}

func (h *SaasHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
        saas := rg.Group("/saas", authMW, RequireSuperAdmin())
        {
                saas.GET("/establishments", h.ListEstablishments)
                saas.GET("/stats", h.GetStats)
                saas.POST("/support/activate", h.ActivateSupport)
                saas.POST("/support/deactivate", h.DeactivateSupport)
                saas.GET("/audit", h.ListAudit)
        }
}
