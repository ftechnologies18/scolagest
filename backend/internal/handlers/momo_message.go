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

// MomoHandler expose les endpoints Mobile Money.
type MomoHandler struct {
	svc *services.MomoService
}

func NewMomoHandler(svc *services.MomoService) *MomoHandler {
	return &MomoHandler{svc: svc}
}

func (h *MomoHandler) List(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	filter := services.MomoFilter{EtablissementID: etbID}
	if v := c.Query("statut"); v != "" {
		s := models.StatutTransactionMomo(v)
		filter.Statut = &s
	}
	if v := c.Query("provider"); v != "" {
		p := models.ProviderMomo(v)
		filter.Provider = &p
	}
	if v := c.Query("date_debut"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			filter.DateDebut = &t
		}
	}
	if v := c.Query("date_fin"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			filter.DateFin = &t
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

func (h *MomoHandler) Initier(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
		return
	}
	var dto services.MomoInitierDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
		return
	}
	tx, err := h.svc.Initier(dto, *etbID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, tx)
}

func (h *MomoHandler) Confirmer(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	tx, err := h.svc.Confirmer(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tx)
}

func (h *MomoHandler) Webhooks(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
		return
	}
	webhooks, err := h.svc.ListWebhooks(*etbID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, webhooks)
}

func (h *MomoHandler) Reconcilier(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	tx, err := h.svc.Reconcilier(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tx)
}

func (h *MomoHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
	m := rg.Group("/mobile-money", authMW)
	{
		m.GET("/transactions", h.List)
		m.POST("/initier", h.Initier)
		m.POST("/transactions/:id/confirmer", h.Confirmer)
		m.GET("/webhooks", h.Webhooks)
		m.POST("/webhooks/:id/reconcilier", h.Reconcilier)
	}
}

// ===== Messages (SMS/Email) =====

type MessageHandler struct {
	svc *services.MessageService
}

func NewMessageHandler(svc *services.MessageService) *MessageHandler {
	return &MessageHandler{svc: svc}
}

func (h *MessageHandler) ListTemplates(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}
	t, err := h.svc.ListTemplates(*etbID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, t)
}

func (h *MessageHandler) CreateTemplate(c *gin.Context) {
	var dto services.TemplateDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
		return
	}
	etbID := middleware.CurrentEtablissementID(c)
	dto.EtablissementID = etbID
	t, err := h.svc.CreateTemplate(dto)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, t)
}

func (h *MessageHandler) UpdateTemplate(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	var dto services.TemplateDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
		return
	}
	t, err := h.svc.UpdateTemplate(id, dto)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, t)
}

func (h *MessageHandler) ListEnvois(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	filter := services.EnvoiFilter{EtablissementID: etbID}
	if v := c.Query("statut"); v != "" {
		s := models.StatutEnvoi(v)
		filter.Statut = &s
	}
	if v := c.Query("type"); v != "" {
		t := models.TypeMessage(v)
		filter.Type = &t
	}
	if v := c.Query("date_debut"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			filter.DateDebut = &t
		}
	}
	if v := c.Query("date_fin"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			filter.DateFin = &t
		}
	}
	envois, err := h.svc.ListEnvois(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, envois)
}

func (h *MessageHandler) Envoyer(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
		return
	}
	var dto services.EnvoyerDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
		return
	}
	envoi, err := h.svc.Envoyer(dto, *etbID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, envoi)
}

func (h *MessageHandler) RelanceMasse(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
		return
	}
	var dto services.RelanceMasseDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
		return
	}
	result, err := h.svc.RelanceMasse(dto, *etbID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *MessageHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
	msg := rg.Group("/messages", authMW)
	{
		msg.GET("/templates", h.ListTemplates)
		msg.POST("/templates", h.CreateTemplate)
		msg.PUT("/templates/:id", h.UpdateTemplate)
		msg.GET("/envois", h.ListEnvois)
		msg.POST("/envoyer", h.Envoyer)
		msg.POST("/relance-masse", h.RelanceMasse)
	}
}
