package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/middleware"
	"github.com/scolagest/backend/internal/services"
)

// ReferentielHandler expose les cycles, classes, années scolaires (lecture).
type ReferentielHandler struct {
	svc *services.ReferentielService
}

func NewReferentielHandler(svc *services.ReferentielService) *ReferentielHandler {
	return &ReferentielHandler{svc: svc}
}

// ListCycles gère GET /api/cycles?etablissement_id=
func (h *ReferentielHandler) ListCycles(c *gin.Context) {
	var etbID *uuid.UUID
	if v := c.Query("etablissement_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			etbID = &id
		}
	}
	// Si pas d'établissement fourni dans la query, utiliser celui de la session
	if etbID == nil {
		etbID = middleware.CurrentEtablissementID(c)
	}
	cycles, err := h.svc.ListCycles(etbID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, cycles)
}

// ListClasses gère GET /api/classes?cycle_id=&etablissement_id=
func (h *ReferentielHandler) ListClasses(c *gin.Context) {
	var etbID *uuid.UUID
	if v := c.Query("etablissement_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			etbID = &id
		}
	}
	if etbID == nil {
		etbID = middleware.CurrentEtablissementID(c)
	}
	var cycleID *uuid.UUID
	if v := c.Query("cycle_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			cycleID = &id
		}
	}
	classes, err := h.svc.ListClasses(etbID, cycleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, classes)
}

// ListAnnees gère GET /api/annees-scolaires
func (h *ReferentielHandler) ListAnnees(c *gin.Context) {
	annees, err := h.svc.ListAnneesScolaires()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, annees)
}

// GetActiveAnnee gère GET /api/annees-scolaires/active
func (h *ReferentielHandler) GetActiveAnnee(c *gin.Context) {
	annee, err := h.svc.GetActiveAnnee()
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "aucune année scolaire active"})
		return
	}
	c.JSON(http.StatusOK, annee)
}

func (h *ReferentielHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
	rg.GET("/cycles", authMW, h.ListCycles)
	rg.GET("/classes", authMW, h.ListClasses)
	rg.GET("/annees-scolaires", authMW, h.ListAnnees)
	rg.GET("/annees-scolaires/active", authMW, h.GetActiveAnnee)
}
