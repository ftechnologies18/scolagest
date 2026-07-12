package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/scolagest/backend/internal/middleware"
	"github.com/scolagest/backend/internal/models"
	"github.com/scolagest/backend/internal/services"
)

// CaisseHandler expose les routes avancées de la caisse : file d'attente
// PRE_INSCRIT et tableau de bord temps réel.
type CaisseHandler struct {
	svc *services.CaisseService
}

func NewCaisseHandler(svc *services.CaisseService) *CaisseHandler {
	return &CaisseHandler{svc: svc}
}

// GetFileAttente gère GET /api/caisse/file-attente
// Retourne les élèves PRE_INSCRIT en attente de paiement des frais d'inscription.
func (h *CaisseHandler) GetFileAttente(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
		return
	}

	file, err := h.svc.GetFileAttente(*etbID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, file)
}

// GetDashboard gère GET /api/caisse/dashboard?date=YYYY-MM-DD
// Retourne les KPIs de la caisse pour aujourd'hui (ou une date donnée).
func (h *CaisseHandler) GetDashboard(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
		return
	}

	date := time.Now()
	if d := c.Query("date"); d != "" {
		if parsed, err := time.Parse("2006-01-02", d); err == nil {
			date = parsed
		}
	}

	dashboard, err := h.svc.GetDashboard(*etbID, date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, dashboard)
}

func (h *CaisseHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
	caisse := rg.Group("/caisse", authMW, middleware.RequireRole(
		models.RoleCaissier, models.RoleComptable, models.RoleDirection,
	))
	{
		caisse.GET("/file-attente", h.GetFileAttente)
		caisse.GET("/dashboard", h.GetDashboard)
	}
}
