package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/middleware"
	"github.com/scolagest/backend/internal/services"
)

// TuteurHandler expose les endpoints de gestion des tuteurs.
type TuteurHandler struct {
	svc *services.TuteurService
}

func NewTuteurHandler(svc *services.TuteurService) *TuteurHandler {
	return &TuteurHandler{svc: svc}
}

// List gère GET /api/tuteurs
func (h *TuteurHandler) List(c *gin.Context) {
	etbID := middleware.CurrentEtablissementID(c)
	tuteurs, err := h.svc.List(c.Query("search"), etbID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tuteurs)
}

// Get gère GET /api/tuteurs/:id
func (h *TuteurHandler) Get(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	tuteur, err := h.svc.Get(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tuteur)
}

// Create gère POST /api/tuteurs
func (h *TuteurHandler) Create(c *gin.Context) {
	var dto services.TuteurDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide", "details": err.Error()})
		return
	}
	if dto.Nom == "" || dto.Telephone == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "nom et téléphone sont obligatoires"})
		return
	}
	tuteur, err := h.svc.Create(dto)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, tuteur)
}

// Update gère PUT /api/tuteurs/:id
func (h *TuteurHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	var dto services.TuteurDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide", "details": err.Error()})
		return
	}
	tuteur, err := h.svc.Update(id, dto)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, tuteur)
}

// Delete gère DELETE /api/tuteurs/:id
func (h *TuteurHandler) Delete(c *gin.Context) {
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

func (h *TuteurHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
	tuteurs := rg.Group("/tuteurs", authMW)
	{
		tuteurs.GET("", h.List)
		tuteurs.GET("/:id", h.Get)
		tuteurs.POST("", h.Create)
		tuteurs.PUT("/:id", h.Update)
		tuteurs.DELETE("/:id", h.Delete)
	}
}

// ===== Inscriptions =====

// InscriptionHandler expose les endpoints d'inscription.
type InscriptionHandler struct {
	svc *services.InscriptionService
}

func NewInscriptionHandler(svc *services.InscriptionService) *InscriptionHandler {
	return &InscriptionHandler{svc: svc}
}

// ListByEleve gère GET /api/eleves/:id/inscriptions
func (h *InscriptionHandler) ListByEleve(c *gin.Context) {
	eleveID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	inscriptions, err := h.svc.ListByEleve(eleveID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, inscriptions)
}

// Create gère POST /api/eleves/:id/inscriptions
func (h *InscriptionHandler) Create(c *gin.Context) {
	eleveID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	var dto services.InscriptionDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide", "details": err.Error()})
		return
	}
	userID := middleware.CurrentUserID(c)
	inscription, err := h.svc.Create(eleveID, dto, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, inscription)
}

// Update gère PUT /api/inscriptions/:id
func (h *InscriptionHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
		return
	}
	var dto services.InscriptionDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide", "details": err.Error()})
		return
	}
	userID := middleware.CurrentUserID(c)
	inscription, err := h.svc.Update(id, dto, userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, inscription)
}

func (h *InscriptionHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
	// Routes imbriquées sous /api/eleves/:id/inscriptions
	rg.Group("/eleves", authMW).POST("/:id/inscriptions", h.Create)
	rg.Group("/eleves", authMW).GET("/:id/inscriptions", h.ListByEleve)
	// Route directe pour update
	rg.Group("/inscriptions", authMW).PUT("/:id", h.Update)
}
