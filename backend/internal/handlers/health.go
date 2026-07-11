package handlers

import (
        "net/http"

        "github.com/gin-gonic/gin"
        "github.com/scolagest/backend/internal/config"
        "github.com/scolagest/backend/internal/database"
)

// HealthHandler expose le endpoint de health-check.
type HealthHandler struct{}

func NewHealthHandler() *HealthHandler { return &HealthHandler{} }

// Health gère GET /api/health
//
// Renvoie status="ok" si la DB est connectée, status="starting" sinon.
// Render (et autres PaaS) utilisent ce endpoint pour déterminer si le
// service est prêt à recevoir du trafic. Au démarrage, la connexion DB
// (Neon + AutoMigrate) peut prendre 30-60s — on répond quand même 200
// avec status="starting" pour ne pas faire crasher le conteneur.
func (h *HealthHandler) Health(c *gin.Context) {
        dbReady := database.Current() != nil
        status := "ok"
        httpCode := http.StatusOK
        if !dbReady {
                status = "starting"
                // On renvoie 200 même en "starting" pour que Render ne tue pas le
                // conteneur. Les endpoints métier renverront 503 tant que la DB
                // n'est pas prête (géré par le middleware RLS).
        }
        c.JSON(httpCode, gin.H{
                "status":  status,
                "db":      dbReady,
                "version": "1.0.0",
                "env":     config.App.Env,
                "service": "scolagest-backend",
        })
}

func (h *HealthHandler) RegisterRoutes(rg *gin.RouterGroup) {
        rg.GET("/health", h.Health)
}
