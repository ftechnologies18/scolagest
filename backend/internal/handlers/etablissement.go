package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
)

// EtablissementHandler expose les endpoints de gestion des établissements.
type EtablissementHandler struct{}

// NewEtablissementHandler construit un EtablissementHandler.
func NewEtablissementHandler() *EtablissementHandler { return &EtablissementHandler{} }

// List gère GET /api/etablissements (publique — utilisée par la page de login)
func (h *EtablissementHandler) List(c *gin.Context) {
	var etabs []models.Etablissement
	// Sur la page de login on ne renvoie que les établissements actifs
	query := database.DB.Where("actif = ?", true)
	if err := query.Find(&etabs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erreur base de données"})
		return
	}
	c.JSON(http.StatusOK, etabs)
}

// Get gère GET /api/etablissements/:id
func (h *EtablissementHandler) Get(c *gin.Context) {
	id := c.Param("id")
	var etb models.Etablissement
	if err := database.DB.First(&etb, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "établissement introuvable"})
		return
	}
	c.JSON(http.StatusOK, etb)
}

// RegisterRoutes enregistre les routes établissements.
func (h *EtablissementHandler) RegisterRoutes(rg *gin.RouterGroup) {
	etb := rg.Group("/etablissements")
	{
		etb.GET("", h.List)
		etb.GET("/:id", h.Get)
	}
}
