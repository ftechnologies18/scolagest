package handlers

import (
        "net/http"

        "github.com/gin-gonic/gin"
        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/middleware"
        "github.com/scolagest/backend/internal/models"
        "github.com/scolagest/backend/internal/services"
)

// FraisHandler expose les endpoints de gestion des frais.
type FraisHandler struct {
        svc *services.FraisService
}

func NewFraisHandler(svc *services.FraisService) *FraisHandler {
        return &FraisHandler{svc: svc}
}

// List gère GET /api/frais?annee_scolaire_id=
func (h *FraisHandler) List(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        var anneeID *uuid.UUID
        if v := c.Query("annee_scolaire_id"); v != "" {
                if id, err := uuid.Parse(v); err == nil {
                        anneeID = &id
                }
        }
        frais, err := h.svc.List(etbID, anneeID)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, frais)
}

// Get gère GET /api/frais/:id
func (h *FraisHandler) Get(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        frais, err := h.svc.Get(id)
        if err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, frais)
}

// Create gère POST /api/frais
func (h *FraisHandler) Create(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
                return
        }
        var dto services.FraisDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide", "details": err.Error()})
                return
        }
        frais, err := h.svc.Create(dto, *etbID)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusCreated, frais)
}

// Update gère PUT /api/frais/:id
func (h *FraisHandler) Update(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        var dto services.FraisDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide", "details": err.Error()})
                return
        }
        frais, err := h.svc.Update(id, dto)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, frais)
}

// Delete gère DELETE /api/frais/:id
func (h *FraisHandler) Delete(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        if err := h.svc.Delete(id); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, gin.H{"success": true})
}

// ListEcheances gère GET /api/frais/:id/echeances
func (h *FraisHandler) ListEcheances(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        echeances, err := h.svc.ListEcheances(id)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, echeances)
}

func (h *FraisHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
        frais := rg.Group("/frais", authMW)
        {
                frais.GET("", h.List)
                frais.GET("/:id", h.Get)
                frais.POST("", h.Create)
                frais.PUT("/:id", h.Update)
                frais.DELETE("/:id", h.Delete)
                frais.GET("/:id/echeances", h.ListEcheances)
        }
}

// ===== Soldes =====

type SoldeHandler struct {
        svc *services.SoldeService
}

func NewSoldeHandler(svc *services.SoldeService) *SoldeHandler {
        return &SoldeHandler{svc: svc}
}

// GetSoldeEleve gère GET /api/eleves/:id/solde
func (h *SoldeHandler) GetSoldeEleve(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        solde, err := h.svc.GetSoldeEleve(id)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, solde)
}

// ListSoldes gère GET /api/soldes?classe_id=&categorie=&statut=
func (h *SoldeHandler) ListSoldes(c *gin.Context) {
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
        soldes, err := h.svc.ListSoldes(*etbID, classeID, categorie)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, soldes)
}

func (h *SoldeHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
        rg.Group("/eleves", authMW).GET("/:id/solde", h.GetSoldeEleve)
        rg.Group("/soldes", authMW).GET("", h.ListSoldes)
}
