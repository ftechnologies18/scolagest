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
        // Cycles & classes : lecture publique (référentiel nécessaire au formulaire
        // public de pré-inscription /pre-inscription). Comme pour /api/etablissements,
        // ces endpoints exposent uniquement des données de structure (noms de cycles,
        // classes, niveaux) — aucune donnée sensible. Le handler filtre par
        // etablissement_id (pas de fuite cross-établissement).
        // Les routes authMW restent disponibles pour les contextes staff authentifiés
        // (le middleware est juste retiré sur le GET lecture).
        rg.GET("/cycles", h.ListCycles)
        rg.GET("/classes", h.ListClasses)
        // Années scolaires : auth requise (données plus sensibles — statut, dates).
        rg.GET("/annees-scolaires", authMW, h.ListAnnees)
        rg.GET("/annees-scolaires/active", authMW, h.GetActiveAnnee)
}
