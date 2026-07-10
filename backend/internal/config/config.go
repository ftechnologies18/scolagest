package config

import (
        "os"
        "strconv"
        "strings"

        "github.com/joho/godotenv"
)

// Config contient la configuration de l'application chargée depuis l'environnement.
type Config struct {
        Port            string
        DBPath          string // chemin SQLite (dev local) — ignoré si DatabaseURL est défini
        DatabaseURL     string // URL PostgreSQL (production Neon) — si défini, utilise PostgreSQL
        JWTSecret       string
        JWTAccessExpHr  int    // durée de vie du access token (heures)
        JWTRefreshExpHr int    // durée de vie du refresh token (heures)
        Env             string // development | production
        CORSOrigins     []string
}

var App *Config

// Load charge la configuration depuis un fichier .env (si présent) puis les variables d'environnement.
func Load() *Config {
        // Le .env est optionnel en production (variables injectées directement)
        _ = godotenv.Load("/home/z/my-project/backend/.env")

        App = &Config{
                Port:            getEnv("PORT", "8080"),
                DBPath:          getEnv("DB_PATH", "/home/z/my-project/backend/data/scolagest.db"),
                DatabaseURL:     getEnv("DATABASE_URL", ""),
                JWTSecret:       getEnv("JWT_SECRET", "scolagest-dev-secret-change-in-production"),
                JWTAccessExpHr:  getEnvInt("JWT_ACCESS_EXP_HR", 1),
                JWTRefreshExpHr: getEnvInt("JWT_REFRESH_EXP_HR", 168), // 7 jours
                Env:             getEnv("APP_ENV", "development"),
                CORSOrigins:     parseCORSOrigins(getEnv("CORS_ORIGINS", "")),
        }
        // Fallback : si CORS_ORIGINS n'est pas défini, utiliser les valeurs par défaut
        if len(App.CORSOrigins) == 0 {
                App.CORSOrigins = []string{"http://localhost:3000", "http://127.0.0.1:3000"}
        }
        return App
}

// parseCORSOrigins parse une liste d'origins séparées par des virgules.
// Ex: "https://app1.com,https://app2.com" → ["https://app1.com", "https://app2.com"]
func parseCORSOrigins(raw string) []string {
        if raw == "" {
                return nil
        }
        var origins []string
        for _, o := range strings.Split(raw, ",") {
                o = strings.TrimSpace(o)
                if o != "" {
                        origins = append(origins, o)
                }
        }
        return origins
}

func getEnv(key, fallback string) string {
        if v := os.Getenv(key); v != "" {
                return v
        }
        return fallback
}

func getEnvInt(key string, fallback int) int {
        if v := os.Getenv(key); v != "" {
                if n, err := strconv.Atoi(v); err == nil {
                        return n
                }
        }
        return fallback
}

// IsDev indique si l'application tourne en mode développement.
func (c *Config) IsDev() bool { return c.Env == "development" }

// IsPostgreSQL indique si la base de données est PostgreSQL (vs SQLite).
// Détecte via DATABASE_URL qui commence par "postgres".
func (c *Config) IsPostgreSQL() bool {
        return strings.HasPrefix(strings.ToLower(c.DatabaseURL), "postgres")
}
