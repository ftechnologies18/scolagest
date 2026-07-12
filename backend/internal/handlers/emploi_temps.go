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

// EmploiTempsHandler expose les routes de l'emploi du temps.
type EmploiTempsHandler struct {
	svc *services.EmploiTempsService
}

func NewEmploiTempsHandler(svc *services.EmploiTempsService) *EmploiTempsHandler {
	return &EmploiTempsHandler{svc: svc}
}

// ListCreneaux gère GET /api/emploi-temps?classe_id=&enseignant_id=
func (h *EmploiTempsHandler) ListCreneaux(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
		return
	}

	var classeID, enseignantID *uuid.UUID
	if v := c.Query("classe_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			classeID = &id
		}
	}
	if v := c.Query("enseignant_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			enseignantID = &id
		}
	}

	creneaux, err := h.svc.ListCreneaux(*etbID, classeID, enseignantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, creneaux)
}

// GetCalendrier gère GET /api/emploi-temps/calendrier?classe_id=
func (h *EmploiTempsHandler) GetCalendrier(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
		return
	}

	var classeID *uuid.UUID
	if v := c.Query("classe_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			classeID = &id
		}
	}

	cal, err := h.svc.GetCalendrierSemaine(*etbID, classeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cal)
}

// CreateCreneau gère POST /api/emploi-temps
func (h *EmploiTempsHandler) CreateCreneau(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
		return
	}

	var dto services.CreneauDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "payload invalide"})
		return
	}

	result, err := h.svc.CreateCreneau(dto, *etbID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Si conflits, on retourne 201 (créé) mais avec les conflits en warning
	c.JSON(http.StatusCreated, result)
}

// DeleteCreneau gère DELETE /api/emploi-temps/:id
func (h *EmploiTempsHandler) DeleteCreneau(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	if err := h.svc.DeleteCreneau(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GenerateSessionsFromDate gère POST /api/emploi-temps/generate-sessions
// Body: { "date": "2026-07-15" } (optionnel, défaut = aujourd'hui)
// Génère les SessionCours pour cette date à partir de l'emploi du temps réel.
func (h *EmploiTempsHandler) GenerateSessionsFromDate(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
		return
	}

	date := time.Now()
	var body struct {
		Date string `json:"date"`
	}
	if c.ShouldBindJSON(&body) == nil && body.Date != "" {
		if parsed, err := time.Parse("2006-01-02", body.Date); err == nil {
			date = parsed
		}
	}

	count, err := h.svc.GenerateSessionsFromDate(*etbID, date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"sessions_generees": count,
		"date":          date.Format("2006-01-02"),
	})
}

// GenerateSemaine gère POST /api/emploi-temps/generate-semaine
// Génère les sessions pour toute la semaine (lundi → samedi) à partir
// de l'emploi du temps. Utile pour pré-générer en début de semaine.
func (h *EmploiTempsHandler) GenerateSemaine(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
		return
	}

	now := time.Now()
	// Trouver le lundi de la semaine courante
	offset := int(time.Monday - now.Weekday())
	if offset > 0 {
		offset -= 7
	}
	lundi := now.AddDate(0, 0, offset)

	total := 0
	for i := 0; i < 6; i++ { // lundi à samedi
		date := lundi.AddDate(0, 0, i)
		count, _ := h.svc.GenerateSessionsFromDate(*etbID, date)
		total += count
	}

	c.JSON(http.StatusOK, gin.H{
		"success":          true,
		"sessions_generees": total,
		"semaine_du":       lundi.Format("2006-01-02"),
	})
}

func (h *EmploiTempsHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
	edt := rg.Group("/emploi-temps", authMW, middleware.RequireRole(
		models.RoleDirection, models.RoleDirecteurEtudes, models.RoleDirecteurSuperviseur, models.RoleSecretariat,
	))
	{
		edt.GET("", h.ListCreneaux)
		edt.GET("/calendrier", h.GetCalendrier)
		edt.POST("", h.CreateCreneau)
		edt.DELETE("/:id", h.DeleteCreneau)
		edt.POST("/generate-sessions", h.GenerateSessionsFromDate)
		edt.POST("/generate-semaine", h.GenerateSemaine)
	}
}
