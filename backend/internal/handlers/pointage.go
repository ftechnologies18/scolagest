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

// PointageHandler expose les routes de pointage enseignant.
//   - Routes prof (auth, rôle ENSEIGNANT) : mes sessions, pointer
//   - Routes staff (auth, DIRECTION/DIRECTEUR_*) : écran temps réel, validation manuelle
type PointageHandler struct {
	svc *services.PointageService
}

func NewPointageHandler(svc *services.PointageService) *PointageHandler {
	return &PointageHandler{svc: svc}
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes prof (rôle ENSEIGNANT)
// ─────────────────────────────────────────────────────────────────────────────

// GetMesSessions gère GET /api/prof/sessions?date=YYYY-MM-DD
// Retourne les sessions de cours du prof pour une date (défaut: aujourd'hui).
func (h *PointageHandler) GetMesSessions(c *gin.Context) {
	userID := middleware.CurrentUserID(c)

	ensID, err := h.svc.GetEnseignantIDFromUtilisateur(userID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	date := time.Now()
	if d := c.Query("date"); d != "" {
		if parsed, err := time.Parse("2006-01-02", d); err == nil {
			date = parsed
		}
	}

	sessions, err := h.svc.GetSessionsEnseignant(*ensID, date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sessions)
}

// CreatePointage gère POST /api/prof/pointage
// Le prof pointe depuis son téléphone (entrée ou sortie de cours).
func (h *PointageHandler) CreatePointage(c *gin.Context) {
	userID := middleware.CurrentUserID(c)

	ensID, err := h.svc.GetEnseignantIDFromUtilisateur(userID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
		return
	}

	var dto services.PointageDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "payload invalide"})
		return
	}

	result, err := h.svc.CreatePointage(dto, *ensID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, result)
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes staff (DIRECTION, DIRECTEUR_*, SECRETARIAT)
// ─────────────────────────────────────────────────────────────────────────────

// GetSessionsEcran gère GET /api/pointage/ecran?date=YYYY-MM-DD
// Retourne les sessions du jour avec statut couleur pour l'écran secrétariat.
func (h *PointageHandler) GetSessionsEcran(c *gin.Context) {
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

	sessions, err := h.svc.GetSessionsAvecStatut(*etbID, date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, sessions)
}

// ValidePointageManuel gère POST /api/pointage/:id/valider
// Le surveillant valide manuellement un pointage (régularisation).
func (h *PointageHandler) ValidePointageManuel(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}

	adminID := middleware.CurrentUserID(c)
	if err := h.svc.ValidePointageManuel(id, adminID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// GenerateSessions gère POST /api/pointage/generate-sessions
// Génère les sessions de cours pour la date du jour (à appeler le matin).
func (h *PointageHandler) GenerateSessions(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
		return
	}

	if err := h.svc.GenerateSessionsForDate(*etbID, time.Now()); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

func (h *PointageHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
	// Routes prof (rôle ENSEIGNANT)
	prof := rg.Group("/prof", authMW, middleware.RequireRole(models.RoleEnseignant))
	{
		prof.GET("/sessions", h.GetMesSessions)
		prof.POST("/pointage", h.CreatePointage)
	}

	// Routes staff (DIRECTION, DIRECTEUR_*, SECRETARIAT)
	staff := rg.Group("/pointage", authMW, middleware.RequireRole(
		models.RoleDirection, models.RoleDirecteurEtudes, models.RoleDirecteurSuperviseur, models.RoleSecretariat,
	))
	{
		staff.GET("/ecran", h.GetSessionsEcran)
		staff.POST("/:id/valider", h.ValidePointageManuel)
		staff.POST("/generate-sessions", h.GenerateSessions)
	}
}
