package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/middleware"
	"github.com/scolagest/backend/internal/models"
	"github.com/scolagest/backend/internal/services"
)

// StatsHandler expose les endpoints du tableau de bord.
type StatsHandler struct {
	svc *services.StatsService
}

func NewStatsHandler(svc *services.StatsService) *StatsHandler {
	return &StatsHandler{svc: svc}
}

// Dashboard gère GET /api/dashboard
func (h *StatsHandler) Dashboard(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
		return
	}
	var dateDebut, dateFin *time.Time
	if v := c.Query("date_debut"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			dateDebut = &t
		}
	}
	if v := c.Query("date_fin"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			end := t.Add(24 * time.Hour)
			dateFin = &end
		}
	}
	data, err := h.svc.GetDashboard(*etbID, dateDebut, dateFin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, data)
}

func (h *StatsHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
	rg.GET("/dashboard", authMW, h.Dashboard)
}

// ===== Rapports =====

type RapportHandler struct {
	svc *services.RapportService
}

func NewRapportHandler(svc *services.RapportService) *RapportHandler {
	return &RapportHandler{svc: svc}
}

// RapportPaiements gère GET /api/rapports/paiements?format=csv|excel|json
func (h *RapportHandler) RapportPaiements(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
		return
	}

	filter := services.RapportPaiementFilter{EtablissementID: etbID}
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
	if v := c.Query("cycle_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			filter.CycleID = &id
		}
	}
	if v := c.Query("classe_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			filter.ClasseID = &id
		}
	}
	if v := c.Query("categorie"); v != "" {
		cat := models.CategorieEleve(v)
		filter.Categorie = &cat
	}
	if v := c.Query("mode_paiement"); v != "" {
		m := models.ModePaiement(v)
		filter.ModePaiement = &m
	}
	if v := c.Query("caissier_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			filter.CaissierID = &id
		}
	}

	format := c.DefaultQuery("format", "json")
	if format == "csv" || format == "excel" {
		content, filename, err := h.svc.RapportPaiementsCSV(filter)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		contentType := "text/csv; charset=utf-8"
		if format == "excel" {
			contentType = "application/vnd.ms-excel"
			filename = filename[:len(filename)-4] + ".xls"
		}
		c.Header("Content-Type", contentType)
		c.Header("Content-Disposition", "attachment; filename=\""+filename+"\"")
		c.Data(http.StatusOK, contentType, content)
		return
	}

	result, err := h.svc.RapportPaiements(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// RapportSoldes gère GET /api/rapports/soldes
func (h *RapportHandler) RapportSoldes(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
		return
	}
	var classeID *uuid.UUID
	if v := c.Query("classe_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			classeID = &id
		}
	}
	var categorie *models.CategorieEleve
	if v := c.Query("categorie"); v != "" {
		cat := models.CategorieEleve(v)
		categorie = &cat
	}
	result, err := h.svc.RapportSoldes(*etbID, classeID, categorie)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

// RapportRecouvrement gère GET /api/rapports/recouvrement
func (h *RapportHandler) RapportRecouvrement(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
		return
	}
	var cycleID *uuid.UUID
	if v := c.Query("cycle_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			cycleID = &id
		}
	}
	result, err := h.svc.RapportRecouvrement(*etbID, cycleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *RapportHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
	rapports := rg.Group("/rapports", authMW)
	{
		rapports.GET("/paiements", h.RapportPaiements)
		rapports.GET("/soldes", h.RapportSoldes)
		rapports.GET("/recouvrement", h.RapportRecouvrement)
	}
}

// ===== Impayés & relances =====

type ImpayeHandler struct {
	svc *services.ImpayeService
}

func NewImpayeHandler(svc *services.ImpayeService) *ImpayeHandler {
	return &ImpayeHandler{svc: svc}
}

// List gère GET /api/impayes
func (h *ImpayeHandler) List(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	filter := services.ImpayeFilter{EtablissementID: etbID}
	if v := c.Query("classe_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			filter.ClasseID = &id
		}
	}
	if v := c.Query("categorie"); v != "" {
		cat := models.CategorieEleve(v)
		filter.Categorie = &cat
	}
	filter.EcheancePassee = c.Query("echeance_passee") == "true"

	impayes, err := h.svc.List(filter)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, impayes)
}

// Bordereau gère POST /api/relances/bordereau
func (h *ImpayeHandler) Bordereau(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
		return
	}
	var body struct {
		EleveIDs []uuid.UUID `json:"eleve_ids"`
		Message  string      `json:"message"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
		return
	}
	if len(body.EleveIDs) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sélectionnez au moins un élève"})
		return
	}
	bordereau, err := h.svc.GenerateBordereau(*etbID, body.EleveIDs)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, bordereau)
}

func (h *ImpayeHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
	rg.GET("/impayes", authMW, h.List)
	relances := rg.Group("/relances", authMW)
	{
		relances.POST("/bordereau", h.Bordereau)
	}
}
