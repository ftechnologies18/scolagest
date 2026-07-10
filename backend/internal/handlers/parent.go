package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/middleware"
	"github.com/scolagest/backend/internal/models"
	"github.com/scolagest/backend/internal/services"
)

// ParentHandler expose les endpoints du portail parent.
type ParentHandler struct {
	svc *services.ParentService
}

func NewParentHandler(svc *services.ParentService) *ParentHandler {
	return &ParentHandler{svc: svc}
}

// RequireParent est un middleware qui vérifie que l'utilisateur a le rôle PARENT.
func RequireParent() gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("user_role")
		if !exists {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "rôle non déterminé"})
			return
		}
		userRole, ok := role.(models.RoleUtilisateur)
		if !ok || userRole != models.RoleParent {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "accès réservé aux parents"})
			return
		}
		c.Next()
	}
}

// ListEnfants gère GET /api/parent/enfants
func (h *ParentHandler) ListEnfants(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	tuteurID, err := h.svc.GetTuteurIDFromUser(userID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	enfants, err := h.svc.ListEnfants(*tuteurID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, enfants)
}

// GetSoldeEnfant gère GET /api/parent/enfants/:id/solde
func (h *ParentHandler) GetSoldeEnfant(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	tuteurID, err := h.svc.GetTuteurIDFromUser(userID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	eleveID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	solde, err := h.svc.GetSoldeEnfant(eleveID, *tuteurID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, solde)
}

// ListPaiements gère GET /api/parent/paiements?eleve_id=&limit=
func (h *ParentHandler) ListPaiements(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	tuteurID, err := h.svc.GetTuteurIDFromUser(userID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	var eleveID *uuid.UUID
	if v := c.Query("eleve_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			eleveID = &id
		}
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	paiements, err := h.svc.ListPaiements(*tuteurID, eleveID, limit)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, paiements)
}

// ListEcheances gère GET /api/parent/echeances
func (h *ParentHandler) ListEcheances(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	tuteurID, err := h.svc.GetTuteurIDFromUser(userID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	echeances, err := h.svc.ListEcheances(*tuteurID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, echeances)
}

// GetRecu gère GET /api/parent/paiements/:id/recu
func (h *ParentHandler) GetRecu(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	tuteurID, err := h.svc.GetTuteurIDFromUser(userID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	paiementID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	recu, err := h.svc.GetRecu(paiementID, *tuteurID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, recu)
}

// RegisterRoutes enregistre les routes du portail parent (auth + RequireParent).
func (h *ParentHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
	parent := rg.Group("/parent", authMW, RequireParent())
	{
		parent.GET("/enfants", h.ListEnfants)
		parent.GET("/enfants/:id/solde", h.GetSoldeEnfant)
		parent.GET("/paiements", h.ListPaiements)
		parent.GET("/echeances", h.ListEcheances)
		parent.GET("/paiements/:id/recu", h.GetRecu)
	}
}
