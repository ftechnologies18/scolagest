package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/models"
	"github.com/scolagest/backend/internal/services"
)

// SaasBillingHandler expose les endpoints de facturation SaaS.
type SaasBillingHandler struct {
	svc *services.SaasBillingService
}

func NewSaasBillingHandler(svc *services.SaasBillingService) *SaasBillingHandler {
	return &SaasBillingHandler{svc: svc}
}

// ===== Plans =====

func (h *SaasBillingHandler) ListPlans(c *gin.Context) {
	plans, err := h.svc.ListPlans()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, plans)
}

func (h *SaasBillingHandler) CreatePlan(c *gin.Context) {
	var dto services.PlanDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
		return
	}
	plan, err := h.svc.CreatePlan(dto)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, plan)
}

func (h *SaasBillingHandler) UpdatePlan(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	var dto services.PlanDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
		return
	}
	plan, err := h.svc.UpdatePlan(id, dto)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, plan)
}

// ===== Abonnements =====

func (h *SaasBillingHandler) ListSubscriptions(c *gin.Context) {
	subs, err := h.svc.ListSubscriptions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, subs)
}

func (h *SaasBillingHandler) CreateSubscription(c *gin.Context) {
	var dto services.SubscriptionDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
		return
	}
	sub, err := h.svc.CreateSubscription(dto)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, sub)
}

func (h *SaasBillingHandler) CancelSubscription(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	sub, err := h.svc.CancelSubscription(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sub)
}

// ===== Factures =====

func (h *SaasBillingHandler) ListInvoices(c *gin.Context) {
	var etbID *uuid.UUID
	if v := c.Query("etablissement_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			etbID = &id
		}
	}
	var statut *models.StatutInvoice
	if v := c.Query("statut"); v != "" {
		s := models.StatutInvoice(v)
		statut = &s
	}
	invoices, err := h.svc.ListInvoices(etbID, statut)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, invoices)
}

func (h *SaasBillingHandler) GenerateInvoice(c *gin.Context) {
	var body struct {
		SubscriptionID uuid.UUID `json:"subscription_id"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "subscription_id requis"})
		return
	}
	inv, err := h.svc.GenerateInvoice(body.SubscriptionID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, inv)
}

func (h *SaasBillingHandler) PayInvoice(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	var body struct {
		ModePaiement      string `json:"mode_paiement"`
		ReferencePaiement string `json:"reference_paiement"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
		return
	}
	inv, err := h.svc.PayInvoice(id, body.ModePaiement, body.ReferencePaiement)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, inv)
}

// ===== Stats =====

func (h *SaasBillingHandler) GetBillingStats(c *gin.Context) {
	stats, err := h.svc.GetBillingStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

func (h *SaasBillingHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
	billing := rg.Group("/saas/billing", authMW, RequireSuperAdmin())
	{
		// Plans
		billing.GET("/plans", h.ListPlans)
		billing.POST("/plans", h.CreatePlan)
		billing.PUT("/plans/:id", h.UpdatePlan)
		// Abonnements
		billing.GET("/subscriptions", h.ListSubscriptions)
		billing.POST("/subscriptions", h.CreateSubscription)
		billing.POST("/subscriptions/:id/cancel", h.CancelSubscription)
		// Factures
		billing.GET("/invoices", h.ListInvoices)
		billing.POST("/invoices", h.GenerateInvoice)
		billing.POST("/invoices/:id/pay", h.PayInvoice)
		// Stats
		billing.GET("/stats", h.GetBillingStats)
	}
}
