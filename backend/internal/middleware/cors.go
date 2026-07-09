package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/scolagest/backend/internal/config"
)

// CORS autorise le frontend Next.js (port 3000) à appeler l'API Go (port 8080).
func CORS(cfg *config.Config) gin.HandlerFunc {
	origins := make(map[string]bool)
	for _, o := range cfg.CORSOrigins {
		origins[o] = true
	}
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if origins[origin] || cfg.IsDev() {
			c.Header("Access-Control-Allow-Origin", origin)
			if origin == "" {
				c.Header("Access-Control-Allow-Origin", "*")
			}
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
			c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, X-Requested-With")
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Max-Age", "86400")
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		// Aussi gérer les requêtes préflight sans Origin exacte (dev)
		if strings.EqualFold(c.Request.Method, "OPTIONS") {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
