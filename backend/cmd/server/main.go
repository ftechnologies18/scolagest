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
        // En production (PostgreSQL/Neon), le seed est non-bloquant (goroutine)
        // pour que le serveur démarre immédiatement. En dev (SQLite), il est synchrone.
        if cfg.IsPostgreSQL() {
            log.Println("⏳ Seed en arrière-plan (PostgreSQL)...")
            go func() {
                seed.Seed()
                log.Println("✓ Seed terminé (arrière-plan)")
            }()
        } else {
            seed.Seed()
        }

        // 4. Services
        jwtSvc := services.NewJWTService(cfg)
        authSvc := services.NewAuthService(jwtSvc)
        eleveSvc := services.NewEleveService()
        tuteurSvc := services.NewTuteurService()
        inscriptionSvc := services.NewInscriptionService()
        referentielSvc := services.NewReferentielService()
        fraisSvc := services.NewFraisService()
        anneeSvc := services.NewAnneeScolaireService(fraisSvc)
        soldeSvc := services.NewSoldeService()
        comptaSvc := services.NewComptaService()
        paiementSvc := services.NewPaiementService(soldeSvc, comptaSvc)
        clotureSvc := services.NewClotureService()
        statsSvc := services.NewStatsService(soldeSvc)
        rapportSvc := services.NewRapportService(soldeSvc)
        impayeSvc := services.NewImpayeService(soldeSvc)
        momoSvc := services.NewMomoService()
        messageSvc := services.NewMessageService()
        userSvc := services.NewUserService()
        parentSvc := services.NewParentService(soldeSvc)
        parentAccessSvc := services.NewParentAccessService(jwtSvc)
        saasSvc := services.NewSaasService(jwtSvc)
        saasBillingSvc := services.NewSaasBillingService()

        // 5. Handlers
        authHandler := handlers.NewAuthHandler(authSvc)
        etbHandler := handlers.NewEtablissementHandler()
        healthHandler := handlers.NewHealthHandler()
        eleveHandler := handlers.NewEleveHandler(eleveSvc)
        tuteurHandler := handlers.NewTuteurHandler(tuteurSvc)
        inscriptionHandler := handlers.NewInscriptionHandler(inscriptionSvc)
        referentielHandler := handlers.NewReferentielHandler(referentielSvc)
        anneeHandler := handlers.NewAnneeScolaireHandler(anneeSvc)
        fraisHandler := handlers.NewFraisHandler(fraisSvc)
        soldeHandler := handlers.NewSoldeHandler(soldeSvc)
        paiementHandler := handlers.NewPaiementHandler(paiementSvc)
        clotureHandler := handlers.NewClotureHandler(clotureSvc)
        statsHandler := handlers.NewStatsHandler(statsSvc)
        rapportHandler := handlers.NewRapportHandler(rapportSvc)
        impayeHandler := handlers.NewImpayeHandler(impayeSvc)
        comptaHandler := handlers.NewComptaHandler(comptaSvc)
        momoHandler := handlers.NewMomoHandler(momoSvc)
        messageHandler := handlers.NewMessageHandler(messageSvc)
        userHandler := handlers.NewUserHandler(userSvc)
        parentHandler := handlers.NewParentHandler(parentSvc, parentAccessSvc, momoSvc)
        saasHandler := handlers.NewSaasHandler(saasSvc)
        saasBillingHandler := handlers.NewSaasBillingHandler(saasBillingSvc)

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

        // Routes Phase 2 : élèves, tuteurs, inscriptions, référentiel
        eleveHandler.RegisterRoutes(api, authMW)
        tuteurHandler.RegisterRoutes(api, authMW)
        inscriptionHandler.RegisterRoutes(api, authMW)
        referentielHandler.RegisterRoutes(api, authMW)
        anneeHandler.RegisterRoutes(api, authMW)

        // Routes Phase 3 : frais, soldes, paiements, clôtures
        fraisHandler.RegisterRoutes(api, authMW)
        soldeHandler.RegisterRoutes(api, authMW)
        paiementHandler.RegisterRoutes(api, authMW)
        clotureHandler.RegisterRoutes(api, authMW)

        // Routes Phase 4 : tableau de bord, rapports, impayés & relances
        statsHandler.RegisterRoutes(api, authMW)
        rapportHandler.RegisterRoutes(api, authMW)
        impayeHandler.RegisterRoutes(api, authMW)

        // Routes Phase 5 : comptabilité, mobile money, messages, utilisateurs/audit
        comptaHandler.RegisterRoutes(api, authMW)
        momoHandler.RegisterRoutes(api, authMW)
        messageHandler.RegisterRoutes(api, authMW)
        userHandler.RegisterRoutes(api, authMW)

        // Routes Phase 6 : portail parent (réservé au rôle PARENT)
        parentHandler.RegisterRoutes(api)

        // Routes SaaS : gestion plateforme (SUPER_ADMIN uniquement)
        saasHandler.RegisterRoutes(api, authMW)
        saasBillingHandler.RegisterRoutes(api, authMW)

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
