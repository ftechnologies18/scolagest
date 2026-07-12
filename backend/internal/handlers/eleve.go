package handlers

import (
        "net/http"
        "strconv"

        "github.com/gin-gonic/gin"
        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/middleware"
        "github.com/scolagest/backend/internal/models"
        "github.com/scolagest/backend/internal/services"
)

// EleveHandler expose les endpoints de gestion des élèves.
type EleveHandler struct {
        svc *services.EleveService
}

func NewEleveHandler(svc *services.EleveService) *EleveHandler {
        return &EleveHandler{svc: svc}
}

// List gère GET /api/eleves
func (h *EleveHandler) List(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)

        filter := services.EleveFilter{
                Search:          c.Query("search"),
                EtablissementID: etbID,
        }
        if c.Query("classe_id") != "" {
                if id, err := uuid.Parse(c.Query("classe_id")); err == nil {
                        filter.ClasseID = &id
                }
        }
        if c.Query("cycle_id") != "" {
                if id, err := uuid.Parse(c.Query("cycle_id")); err == nil {
                        filter.CycleID = &id
                }
        }
        if n := c.Query("niveau"); n != "" {
                if niveau, err := strconv.Atoi(n); err == nil {
                        filter.Niveau = &niveau
                }
        }
        if cat := c.Query("categorie"); cat != "" {
                catVal := models.CategorieEleve(cat)
                filter.Categorie = &catVal
        }
        if st := c.Query("statut"); st != "" {
                stVal := models.StatutEleve(st)
                filter.Statut = &stVal
        }
        if p, err := strconv.Atoi(c.DefaultQuery("page", "1")); err == nil {
                filter.Page = p
        }
        if ps, err := strconv.Atoi(c.DefaultQuery("page_size", "20")); err == nil {
                filter.PageSize = ps
        }

        result, err := h.svc.List(filter)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "erreur lors de la récupération des élèves", "details": err.Error()})
                return
        }
        c.JSON(http.StatusOK, result)
}

// Export gère GET /api/eleves/export — retourne TOUS les élèves correspondant
// aux filtres (sans pagination), pour génération PDF/Excel/CSV côté frontend.
// Mêmes filtres que List (cycle_id, niveau, classe_id, categorie, statut, search).
func (h *EleveHandler) Export(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)

        filter := services.EleveFilter{
                Search:          c.Query("search"),
                EtablissementID: etbID,
        }
        if c.Query("classe_id") != "" {
                if id, err := uuid.Parse(c.Query("classe_id")); err == nil {
                        filter.ClasseID = &id
                }
        }
        if c.Query("cycle_id") != "" {
                if id, err := uuid.Parse(c.Query("cycle_id")); err == nil {
                        filter.CycleID = &id
                }
        }
        if n := c.Query("niveau"); n != "" {
                if niveau, err := strconv.Atoi(n); err == nil {
                        filter.Niveau = &niveau
                }
        }
        if cat := c.Query("categorie"); cat != "" {
                catVal := models.CategorieEleve(cat)
                filter.Categorie = &catVal
        }
        if st := c.Query("statut"); st != "" {
                stVal := models.StatutEleve(st)
                filter.Statut = &stVal
        }

        eleves, err := h.svc.Export(filter)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "erreur lors de l'export des élèves", "details": err.Error()})
                return
        }
        c.JSON(http.StatusOK, eleves)
}

// Stats gère GET /api/eleves/stats — retourne des statistiques agrégées
// (total, garçons/filles, redoublants) contextualisées aux filtres.
func (h *EleveHandler) Stats(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)

        filter := services.EleveFilter{
                Search:          c.Query("search"),
                EtablissementID: etbID,
        }
        if c.Query("classe_id") != "" {
                if id, err := uuid.Parse(c.Query("classe_id")); err == nil {
                        filter.ClasseID = &id
                }
        }
        if c.Query("cycle_id") != "" {
                if id, err := uuid.Parse(c.Query("cycle_id")); err == nil {
                        filter.CycleID = &id
                }
        }
        if n := c.Query("niveau"); n != "" {
                if niveau, err := strconv.Atoi(n); err == nil {
                        filter.Niveau = &niveau
                }
        }
        if cat := c.Query("categorie"); cat != "" {
                catVal := models.CategorieEleve(cat)
                filter.Categorie = &catVal
        }
        if st := c.Query("statut"); st != "" {
                stVal := models.StatutEleve(st)
                filter.Statut = &stVal
        }

        stats, err := h.svc.Stats(filter)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "erreur lors du calcul des statistiques", "details": err.Error()})
                return
        }
        c.JSON(http.StatusOK, stats)
}

// Get gère GET /api/eleves/:id
func (h *EleveHandler) Get(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        eleve, err := h.svc.Get(id)
        if err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, eleve)
}

// Create gère POST /api/eleves
func (h *EleveHandler) Create(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement non sélectionné dans la session"})
                return
        }

        var dto services.EleveDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide", "details": err.Error()})
                return
        }
        if dto.Nom == "" {
                c.JSON(http.StatusBadRequest, gin.H{"error": "le nom est obligatoire"})
                return
        }

        eleve, err := h.svc.Create(dto, *etbID)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusCreated, eleve)
}

// Update gère PUT /api/eleves/:id
func (h *EleveHandler) Update(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        var dto services.EleveDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide", "details": err.Error()})
                return
        }
        eleve, err := h.svc.Update(id, dto)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, eleve)
}

// Delete gère DELETE /api/eleves/:id
func (h *EleveHandler) Delete(c *gin.Context) {
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

// RegisterRoutes enregistre les routes élèves (toutes protégées par auth).
func (h *EleveHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
        eleves := rg.Group("/eleves", authMW)
        {
                eleves.GET("", h.List)
                eleves.GET("/export", h.Export)
                eleves.GET("/stats", h.Stats)
                eleves.GET("/:id", h.Get)
                eleves.POST("", h.Create)
                eleves.PUT("/:id", h.Update)
                eleves.DELETE("/:id", h.Delete)
        }
}
