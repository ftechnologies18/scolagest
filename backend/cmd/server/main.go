package main

import (
	"fmt"
	"log"

	"github.com/gin-gonic/gin"
	"github.com/scolagest/backend/internal/config"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/handlers"
	"github.com/scolagest/backend/internal/middleware"
	"github.com/scolagest/backend/internal/seed"
	"github.com/scolagest/backend/internal/services"
)

func main() {
	// 1. Charger la configuration
	cfg := config.Load()
	log.Printf("🚀 ScolaGest backend — env=%s port=%s", cfg.Env, cfg.Port)

	if cfg.IsDev() {
		gin.SetMode(gin.DebugMode)
	} else {
		gin.SetMode(gin.ReleaseMode)
	}

	// 2. Connexion base de données + migrations
	if _, err := database.Connect(); err != nil {
		log.Fatalf("❌ Échec connexion DB: %v", err)
	}
	log.Println("✓ Base de données connectée + migrations appliquées")

	// 3. Seed des données de démonstration (idempotent)
	seed.Seed()

	// 4. Services
	jwtSvc := services.NewJWTService(cfg)
	authSvc := services.NewAuthService(jwtSvc)

	// 5. Handlers
	authHandler := handlers.NewAuthHandler(authSvc)
	etbHandler := handlers.NewEtablissementHandler()
	healthHandler := handlers.NewHealthHandler()

	// 6. Router Gin
	r := gin.Default()

	// CORS (avant les routes)
	r.Use(middleware.CORS(cfg))

	// Groupe API
	api := r.Group("/api")

	// Routes publiques
	healthHandler.RegisterRoutes(api)
	etbHandler.RegisterRoutes(api)

	// Routes d'authentification (login/refresh publiques, logout/me protégés)
	authMW := middleware.AuthMiddleware(jwtSvc)
	authHandler.RegisterRoutes(api, authMW)

	// Route de bienvenue
	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"service": "scolagest-backend",
			"version": "1.0.0",
			"status":  "running",
			"docs":    "/api/health",
		})
	})

	// 7. Démarrage du serveur
	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("✅ Serveur démarré sur http://localhost:%s", cfg.Port)
	if err := r.Run(addr); err != nil {
		log.Fatalf("❌ Échec démarrage serveur: %v", err)
	}
}
