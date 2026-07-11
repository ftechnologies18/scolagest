package handlers

import (
        "net/http"
        "strconv"
        "time"

        "github.com/gin-gonic/gin"
        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/middleware"
        "github.com/scolagest/backend/internal/models"
        "github.com/scolagest/backend/internal/services"
)

// ComptaHandler expose les endpoints de comptabilité.
type ComptaHandler struct {
        svc *services.ComptaService
}

func NewComptaHandler(svc *services.ComptaService) *ComptaHandler {
        return &ComptaHandler{svc: svc}
}

func (h *ComptaHandler) ListExercices(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
                return
        }
        ex, err := h.svc.ListExercices(*etbID)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, ex)
}

func (h *ComptaHandler) CreateExercice(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
                return
        }
        var dto services.ExerciceDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
                return
        }
        ex, err := h.svc.CreateExercice(dto, *etbID)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusCreated, ex)
}

func (h *ComptaHandler) CloturerExercice(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        ex, err := h.svc.CloturerExercice(id)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, ex)
}

func (h *ComptaHandler) ListComptes(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
                return
        }
        comptes, err := h.svc.ListComptes(*etbID)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, comptes)
}

func (h *ComptaHandler) CreateCompte(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
                return
        }
        var dto services.CompteDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
                return
        }
        compte, err := h.svc.CreateCompte(dto, *etbID)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusCreated, compte)
}

func (h *ComptaHandler) ListJournaux(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
                return
        }
        j, err := h.svc.ListJournaux(*etbID)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, j)
}

func (h *ComptaHandler) ListEcritures(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        filter := services.EcritureFilter{EtablissementID: etbID}
        if v := c.Query("exercice_id"); v != "" {
                if id, err := uuid.Parse(v); err == nil {
                        filter.ExerciceID = &id
                }
        }
        if v := c.Query("journal_id"); v != "" {
                if id, err := uuid.Parse(v); err == nil {
                        filter.JournalID = &id
                }
        }
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
        if p, err := strconv.Atoi(c.DefaultQuery("page", "1")); err == nil {
                filter.Page = p
        }
        if ps, err := strconv.Atoi(c.DefaultQuery("page_size", "20")); err == nil {
                filter.PageSize = ps
        }
        result, err := h.svc.ListEcritures(filter)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, result)
}

func (h *ComptaHandler) GetEcriture(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        e, err := h.svc.GetEcriture(id)
        if err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, e)
}

func (h *ComptaHandler) GrandLivre(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
                return
        }
        var exerciceID uuid.UUID
        if v := c.Query("exercice_id"); v != "" {
                exerciceID, _ = uuid.Parse(v)
        }
        var compteID *uuid.UUID
        if v := c.Query("compte_id"); v != "" {
                if id, err := uuid.Parse(v); err == nil {
                        compteID = &id
                }
        }
        var dateDebut, dateFin *time.Time
        if v := c.Query("date_debut"); v != "" {
                if t, err := time.Parse("2006-01-02", v); err == nil {
                        dateDebut = &t
                }
        }
        if v := c.Query("date_fin"); v != "" {
                if t, err := time.Parse("2006-01-02", v); err == nil {
                        dateFin = &t
                }
        }
        result, err := h.svc.GrandLivre(*etbID, exerciceID, compteID, dateDebut, dateFin)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, result)
}

func (h *ComptaHandler) Bilan(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné"})
                return
        }
        exerciceID, err := uuid.Parse(c.Query("exercice_id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "exercice_id requis"})
                return
        }
        result, err := h.svc.Bilan(*etbID, exerciceID)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, result)
}

func (h *ComptaHandler) JournalCaisse(c *gin.Context) {
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
                        dateFin = &t
                }
        }
        result, err := h.svc.JournalCaisse(*etbID, dateDebut, dateFin)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, result)
}

func (h *ComptaHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
        // Comptabilité générale : réservée au COMPTABLE seul (séparation des
        // responsabilités). Le middleware RequireRole renvoie 403 aux autres rôles.
        c := rg.Group("/comptabilite", authMW, middleware.RequireRole(models.RoleComptable))
        {
                c.GET("/exercices", h.ListExercices)
                c.POST("/exercices", h.CreateExercice)
                c.POST("/exercices/:id/cloturer", h.CloturerExercice)
                c.GET("/comptes", h.ListComptes)
                c.POST("/comptes", h.CreateCompte)
                c.GET("/journaux", h.ListJournaux)
                c.GET("/ecritures", h.ListEcritures)
                c.GET("/ecritures/:id", h.GetEcriture)
                c.GET("/grand-livre", h.GrandLivre)
                c.GET("/bilan", h.Bilan)
                c.GET("/journal-caisse", h.JournalCaisse)
        }
}
