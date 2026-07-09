package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/scolagest/backend/internal/config"
)

// HealthHandler expose le endpoint de health-check.
type HealthHandler struct{}

func NewHealthHandler() *HealthHandler { return &HealthHandler{} }

// Health gère GET /api/health
func (h *HealthHandler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"version": "1.0.0",
		"env":     config.App.Env,
		"service": "scolagest-backend",
	})
}

func (h *HealthHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/health", h.Health)
}
