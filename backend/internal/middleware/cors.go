package middleware

import (
        "net/http"

        "github.com/gin-gonic/gin"
        "github.com/scolagest/backend/internal/config"
)

// CORS autorise le frontend à appeler l'API Go.
// En production, CORS_ORIGINS (env var) définit les origines autorisées
// (séparées par des virgules). Le wildcard "*" est INTERDIT en production
// (faille sécurité : permet à n'importe quel site d'appeler l'API avec les
// credentials d'un utilisateur connecté).
func CORS(cfg *config.Config) gin.HandlerFunc {
        origins := make(map[string]bool)
        for _, o := range cfg.CORSOrigins {
                // En production, "*" est refusé par config.Load() (crash au boot).
                // En dev, "*" est toléré pour faciliter les tests locaux.
                if o == "*" && !cfg.IsDev() {
                        continue // ignore silencieusement (config.Load a déjà loggé)
                }
                origins[o] = true
        }
        return func(c *gin.Context) {
                origin := c.GetHeader("Origin")
                // En dev sans CORS_ORIGINS configuré, autoriser localhost.
                // En prod, seule la liste explicite est autorisée.
                allowed := origins[origin] || (cfg.IsDev() && len(origins) == 0)
                if allowed {
                        if origin != "" {
                                c.Header("Access-Control-Allow-Origin", origin)
                                c.Header("Access-Control-Allow-Credentials", "true")
                                c.Header("Vary", "Origin")
                        }
                        c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
                        c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Authorization, X-Requested-With")
                        c.Header("Access-Control-Max-Age", "86400")
                        // Headers de sécurité supplémentaires
                        c.Header("X-Content-Type-Options", "nosniff")
                        c.Header("X-Frame-Options", "DENY")
                        c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
                }
                if c.Request.Method == http.MethodOptions {
                        if !allowed {
                                c.AbortWithStatus(http.StatusForbidden)
                                return
                        }
                        c.AbortWithStatus(http.StatusNoContent)
                        return
                }
                c.Next()
        }
}
