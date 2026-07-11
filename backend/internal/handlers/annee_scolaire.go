package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/middleware"
	"github.com/scolagest/backend/internal/services"
)

// AnneeScolaireHandler expose les endpoints de gestion des années scolaires.
type AnneeScolaireHandler struct {
	svc *services.AnneeScolaireService
}

func NewAnneeScolaireHandler(svc *services.AnneeScolaireService) *AnneeScolaireHandler {
	return &AnneeScolaireHandler{svc: svc}
}

// Create gère POST /api/annees-scolaires
func (h *AnneeScolaireHandler) Create(c *gin.Context) {
	var dto services.AnneeDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide", "details": err.Error()})
		return
	}
	annee, err := h.svc.Create(dto)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, annee)
}

// Activate gère POST /api/annees-scolaires/:id/activate
func (h *AnneeScolaireHandler) Activate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	annee, err := h.svc.Activate(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, annee)
}

// Close gère POST /api/annees-scolaires/:id/close
func (h *AnneeScolaireHandler) Close(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	annee, err := h.svc.Close(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, annee)
}

// PromoteStudents gère POST /api/annees-scolaires/promote
func (h *AnneeScolaireHandler) PromoteStudents(c *gin.Context) {
	var body struct {
		AncienneAnneeID  uuid.UUID `json:"ancienne_annee_id"`
		NouvelleAnneeID  uuid.UUID `json:"nouvelle_annee_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ancienne_annee_id et nouvelle_annee_id requis"})
		return
	}
	result, err := h.svc.PromoteStudents(body.AncienneAnneeID, body.NouvelleAnneeID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// GetStats gère GET /api/annees-scolaires/:id/stats
func (h *AnneeScolaireHandler) GetStats(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	stats, err := h.svc.GetStats(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// RegisterRoutes enregistre les routes années scolaires.
// Les routes GET existantes (List, GetActive) restent dans ReferentielHandler.
func (h *AnneeScolaireHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
	annees := rg.Group("/annees-scolaires", authMW)
	{
		annees.POST("", h.Create)
		annees.POST("/:id/activate", h.Activate)
		annees.POST("/:id/close", h.Close)
		annees.POST("/promote", h.PromoteStudents)
		annees.GET("/:id/stats", h.GetStats)
	}
	_ = middleware.CurrentUserID // import pour éviter unused
	_ = time.Now
}
