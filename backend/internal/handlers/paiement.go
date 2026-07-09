package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/middleware"
	"github.com/scolagest/backend/internal/models"
	"github.com/scolagest/backend/internal/services"
)

// PaiementHandler expose les endpoints d'encaissement.
type PaiementHandler struct {
	svc *services.PaiementService
}

func NewPaiementHandler(svc *services.PaiementService) *PaiementHandler {
	return &PaiementHandler{svc: svc}
}

// List gère GET /api/paiements
func (h *PaiementHandler) List(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	filter := services.PaiementFilter{EtablissementID: etbID}

	if v := c.Query("eleve_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			filter.EleveID = &id
		}
	}
	if v := c.Query("caissier_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			filter.CaissierID = &id
		}
	}
	if v := c.Query("mode"); v != "" {
		m := models.ModePaiement(v)
		filter.ModePaiement = &m
	}
	if v := c.Query("statut"); v != "" {
		s := models.StatutPaiement(v)
		filter.Statut = &s
	}
	if v := c.Query("date_debut"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			filter.DateDebut = &t
		}
	}
	if v := c.Query("date_fin"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			end := t.Add(24 * time.Hour)
			filter.DateFin = &end
		}
	}
	if p, err := strconv.Atoi(c.DefaultQuery("page", "1")); err == nil {
		filter.Page = p
	}
	if ps, err := strconv.Atoi(c.DefaultQuery("page_size", "20")); err == nil {
		filter.PageSize = ps
	}

	result, err := h.svc.List(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// Get gère GET /api/paiements/:id
func (h *PaiementHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	p, err := h.svc.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, p)
}

// Create gère POST /api/paiements
func (h *PaiementHandler) Create(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
		return
	}
	var dto services.PaiementDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide", "details": err.Error()})
		return
	}
	caissierID := middleware.CurrentUserID(c)
	p, err := h.svc.Create(dto, caissierID, *etbID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, p)
}

// Annule gère POST /api/paiements/:id/annuler
func (h *PaiementHandler) Annule(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	var body struct {
		Motif string `json:"motif"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || body.Motif == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "le motif est obligatoire"})
		return
	}
	validatorID := middleware.CurrentUserID(c)
	p, err := h.svc.Annule(id, body.Motif, validatorID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, p)
}

// GetRecu gère GET /api/paiements/:id/recu
func (h *PaiementHandler) GetRecu(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	recu, err := h.svc.GetRecu(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, recu)
}

// ListByEleve gère GET /api/eleves/:id/paiements?limit=
func (h *PaiementHandler) ListByEleve(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	paiements, err := h.svc.ListByEleve(id, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, paiements)
}

func (h *PaiementHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
	paiements := rg.Group("/paiements", authMW)
	{
		paiements.GET("", h.List)
		paiements.GET("/:id", h.Get)
		paiements.POST("", h.Create)
		paiements.POST("/:id/annuler", h.Annule)
		paiements.GET("/:id/recu", h.GetRecu)
	}
	// Route imbriquée sous eleves
	rg.Group("/eleves", authMW).GET("/:id/paiements", h.ListByEleve)
}
