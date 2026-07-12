package handlers

import (
        "net/http"

        "github.com/gin-gonic/gin"
        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/database"
        "github.com/scolagest/backend/internal/middleware"
        "github.com/scolagest/backend/internal/models"
        "github.com/scolagest/backend/internal/services"
)

// EnseignantHandler expose les routes du module enseignant (gestion staff).
type EnseignantHandler struct {
        svc *services.EnseignantService
}

func NewEnseignantHandler(svc *services.EnseignantService) *EnseignantHandler {
        return &EnseignantHandler{svc: svc}
}

// ─────────────────────────────────────────────────────────────────────────────
// Enseignants
// ─────────────────────────────────────────────────────────────────────────────

// List gère GET /api/enseignants?search=...&statut=...
func (h *EnseignantHandler) List(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
                return
        }

        search := c.Query("search")
        var statut *models.StatutEnseignant
        if s := c.Query("statut"); s != "" {
                st := models.StatutEnseignant(s)
                statut = &st
        }

        ens, err := h.svc.List(*etbID, search, statut)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, ens)
}

// Get gère GET /api/enseignants/:id
func (h *EnseignantHandler) Get(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        ens, err := h.svc.Get(id)
        if err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, ens)
}

// Create gère POST /api/enseignants
func (h *EnseignantHandler) Create(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
                return
        }
        var dto services.EnseignantDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "payload invalide"})
                return
        }
        ens, err := h.svc.Create(dto, *etbID)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusCreated, ens)
}

// Update gère PUT /api/enseignants/:id
func (h *EnseignantHandler) Update(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        var dto services.EnseignantDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "payload invalide"})
                return
        }
        ens, err := h.svc.Update(id, dto)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, ens)
}

// Delete gère DELETE /api/enseignants/:id
func (h *EnseignantHandler) Delete(c *gin.Context) {
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

// ─────────────────────────────────────────────────────────────────────────────
// Matières
// ─────────────────────────────────────────────────────────────────────────────

func (h *EnseignantHandler) ListMatieres(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
                return
        }
        matieres, err := h.svc.ListMatieres(*etbID)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, matieres)
}

func (h *EnseignantHandler) CreateMatiere(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
                return
        }
        var dto services.MatiereDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "payload invalide"})
                return
        }
        m, err := h.svc.CreateMatiere(dto, *etbID)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusCreated, m)
}

func (h *EnseignantHandler) UpdateMatiere(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        var dto services.MatiereDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "payload invalide"})
                return
        }
        m, err := h.svc.UpdateMatiere(id, dto)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, m)
}

func (h *EnseignantHandler) DeleteMatiere(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        if err := h.svc.DeleteMatiere(id); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, gin.H{"success": true})
}

// ─────────────────────────────────────────────────────────────────────────────
// EnseignantMatiere (association prof/matière + taux)
// ─────────────────────────────────────────────────────────────────────────────

// AddMatiere gère POST /api/enseignants/:id/matieres
func (h *EnseignantHandler) AddMatiere(c *gin.Context) {
        ensID, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        var dto services.EnseignantMatiereDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "payload invalide"})
                return
        }
        if err := h.svc.AddMatiereToEnseignant(ensID, dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusCreated, gin.H{"success": true})
}

// RemoveMatiere gère DELETE /api/enseignants/:id/matieres/:matiereId
func (h *EnseignantHandler) RemoveMatiere(c *gin.Context) {
        ensID, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        matID, err := uuid.Parse(c.Param("matiereId"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID matière invalide"})
                return
        }
        if err := h.svc.RemoveMatiereFromEnseignant(ensID, matID); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, gin.H{"success": true})
}

// ─────────────────────────────────────────────────────────────────────────────
// Affectations
// ─────────────────────────────────────────────────────────────────────────────

// ListAffectations gère GET /api/affectations?annee_scolaire_id=...
func (h *EnseignantHandler) ListAffectations(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
                return
        }
        anneeIDStr := c.Query("annee_scolaire_id")
        var anneeID uuid.UUID
        if anneeIDStr != "" {
                var err error
                anneeID, err = uuid.Parse(anneeIDStr)
                if err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "annee_scolaire_id invalide"})
                        return
                }
        } else {
                // défaut : année active
                var annee models.AnneeScolaire
                if err := database.Current().Where("est_active = ?", true).First(&annee).Error; err != nil {
                        c.JSON(http.StatusBadRequest, gin.H{"error": "aucune année active"})
                        return
                }
                anneeID = annee.ID
        }

        affs, err := h.svc.ListAffectations(*etbID, anneeID)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, affs)
}

// CreateAffectation gère POST /api/affectations
func (h *EnseignantHandler) CreateAffectation(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
                return
        }
        var dto services.AffectationDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "payload invalide"})
                return
        }
        result, err := h.svc.CreateAffectation(dto, *etbID)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusCreated, result)
}

// DeleteAffectation gère DELETE /api/affectations/:id
func (h *EnseignantHandler) DeleteAffectation(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        if err := h.svc.DeleteAffectation(id); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, gin.H{"success": true})
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

func (h *EnseignantHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
        // Gestion enseignants (DIRECTION, DIRECTEUR_*, SECRETARIAT)
        ens := rg.Group("/enseignants", authMW, middleware.RequireRole(
                models.RoleDirection, models.RoleDirecteurEtudes, models.RoleDirecteurSuperviseur, models.RoleSecretariat,
        ))
        {
                ens.GET("", h.List)
                ens.GET("/:id", h.Get)
                ens.POST("", h.Create)
                ens.PUT("/:id", h.Update)
                ens.DELETE("/:id", h.Delete)
                // Association prof/matière
                ens.POST("/:id/matieres", h.AddMatiere)
                ens.DELETE("/:id/matieres/:matiereId", h.RemoveMatiere)
        }

        // Gestion matières
        matieres := rg.Group("/matieres", authMW, middleware.RequireRole(
                models.RoleDirection, models.RoleDirecteurEtudes, models.RoleDirecteurSuperviseur, models.RoleSecretariat,
        ))
        {
                matieres.GET("", h.ListMatieres)
                matieres.POST("", h.CreateMatiere)
                matieres.PUT("/:id", h.UpdateMatiere)
                matieres.DELETE("/:id", h.DeleteMatiere)
        }

        // Affectations (assignation prof/matière/classe)
        affs := rg.Group("/affectations", authMW, middleware.RequireRole(
                models.RoleDirection, models.RoleDirecteurEtudes, models.RoleDirecteurSuperviseur, models.RoleSecretariat,
        ))
        {
                affs.GET("", h.ListAffectations)
                affs.POST("", h.CreateAffectation)
                affs.DELETE("/:id", h.DeleteAffectation)
        }
}
