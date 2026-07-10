package middleware

import (
        "net/http"

        "github.com/gin-gonic/gin"
        "github.com/scolagest/backend/internal/config"
)

// CORS autorise le frontend à appeler l'API Go.
// En production, CORS_ORIGINS (env var) définit les origines autorisées
// (séparées par des virgules). La valeur "*" autorise toutes les origines.
func CORS(cfg *config.Config) gin.HandlerFunc {
        origins := make(map[string]bool)
        allowAll := false
        for _, o := range cfg.CORSOrigins {
                if o == "*" {
                        allowAll = true
                }
                origins[o] = true
        }
        return func(c *gin.Context) {
                origin := c.GetHeader("Origin")
                allowed := allowAll || origins[origin] || cfg.IsDev()
                if allowed {
                        if origin == "" {
                                c.Header("Access-Control-Allow-Origin", "*")
                        } else {
                                c.Header("Access-Control-Allow-Origin", origin)
                        }
                        c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
                        c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, X-Requested-With")
                        // Allow-Credentials seulement si origin spécifique (pas wildcard)
                        if !allowAll {
                                c.Header("Access-Control-Allow-Credentials", "true")
                        }
                        c.Header("Access-Control-Max-Age", "86400")
                }
                if c.Request.Method == http.MethodOptions {
                        c.AbortWithStatus(http.StatusNoContent)
                        return
                }
                c.Next()
        }
}
