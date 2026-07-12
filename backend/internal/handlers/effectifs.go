package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/middleware"
	"github.com/scolagest/backend/internal/services"
)

// EffectifsHandler expose les statistiques d'effectifs par classe.
type EffectifsHandler struct {
	svc *services.EffectifsService
}

func NewEffectifsHandler(svc *services.EffectifsService) *EffectifsHandler {
	return &EffectifsHandler{svc: svc}
}

// GetEffectifs gère GET /api/effectifs?annee_scolaire_id=...
// Retourne les KPIs globaux + détails par classe (effectif, taux remplissage,
// genre, redoublants). Filtre par l'établissement de la session.
func (h *EffectifsHandler) GetEffectifs(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	if etbID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
		return
	}

	var anneeID *uuid.UUID
	if v := c.Query("annee_scolaire_id"); v != "" {
		if id, err := uuid.Parse(v); err == nil {
			anneeID = &id
		}
	}

	result, err := h.svc.GetEffectifs(*etbID, anneeID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erreur lors du calcul des effectifs", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *EffectifsHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
	rg.GET("/effectifs", authMW, h.GetEffectifs)
}
