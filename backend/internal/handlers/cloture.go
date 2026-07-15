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

// ClotureHandler expose les endpoints de clôture de caisse.
type ClotureHandler struct {
        svc *services.ClotureService
}

func NewClotureHandler(svc *services.ClotureService) *ClotureHandler {
        return &ClotureHandler{svc: svc}
}

// GetAujourdhui gère GET /api/clotures/aujourdhui
func (h *ClotureHandler) GetAujourdhui(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
                return
        }
        caissierID := middleware.CurrentUserID(c)
        cloture, err := h.svc.GetAujourdhui(caissierID, *etbID)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, cloture)
}

// List gère GET /api/clotures?date=&caissier_id=
func (h *ClotureHandler) List(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        var caissierID *uuid.UUID
        if v := c.Query("caissier_id"); v != "" {
                if id, err := uuid.Parse(v); err == nil {
                        caissierID = &id
                }
        }
        var date *time.Time
        if v := c.Query("date"); v != "" {
                if t, err := time.Parse("2006-01-02", v); err == nil {
                        date = &t
                }
        }
        clotures, err := h.svc.List(etbID, caissierID, date)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, clotures)
}

// Create gère POST /api/clotures
func (h *ClotureHandler) Create(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
                return
        }
        var dto services.ClotureDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide", "details": err.Error()})
                return
        }
        caissierID := middleware.CurrentUserID(c)
        cloture, err := h.svc.Create(dto, caissierID, *etbID)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        // Audit : création d'une clôture de caisse (action financière)
        services.LogAudit(
                caissierID, etbID,
                models.AuditCreate, "cloture_caisse", cloture.ID.String(), c.ClientIP(),
                map[string]interface{}{"total_remis": dto.TotalRemis},
        )
        c.JSON(http.StatusCreated, cloture)
}

// Valider gère POST /api/clotures/:id/valider
func (h *ClotureHandler) Valider(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        validatorID := middleware.CurrentUserID(c)
        cloture, err := h.svc.Valider(id, validatorID)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, cloture)
}

func (h *ClotureHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
        // Clôture de caisse : réservée au CAISSIER et au COMPTABLE. La direction
        // n'y accède pas (elle ne tient pas la caisse au quotidien).
        clotures := rg.Group("/clotures", authMW, middleware.RequireRole(
                models.RoleCaissier,
                models.RoleComptable,
        ))
        {
                clotures.GET("/aujourdhui", h.GetAujourdhui)
                clotures.GET("", h.List)
                clotures.POST("", h.Create)
                clotures.POST("/:id/valider", h.Valider)
        }
}
