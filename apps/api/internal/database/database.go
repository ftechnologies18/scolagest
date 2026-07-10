package database

import (
        "fmt"
        "os"
        "path/filepath"

        "github.com/glebarez/sqlite"
        "github.com/scolagest/backend/internal/config"
        "github.com/scolagest/backend/internal/models"
        "gorm.io/gorm"
        "gorm.io/gorm/logger"
)

// DB est la connexion globale à la base de données.
var DB *gorm.DB

// Connect initialise la connexion à la base SQLite et exécute les migrations automatiques.
func Connect() (*gorm.DB, error) {
        cfg := config.App

        // S'assurer que le dossier parent du fichier DB existe
        if dir := filepath.Dir(cfg.DBPath); dir != "" {
                if err := os.MkdirAll(dir, 0755); err != nil {
                        return nil, fmt.Errorf("création dossier DB: %w", err)
                }
        }

        logLevel := logger.Warn
        if cfg.IsDev() {
                logLevel = logger.Info
        }

        db, err := gorm.Open(sqlite.Open(cfg.DBPath+"?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)"), &gorm.Config{
                Logger: logger.Default.LogMode(logLevel),
        })
        if err != nil {
                return nil, fmt.Errorf("ouverture base: %w", err)
        }

        // Activer les contraintes de clé étrangère (SQLite ne le fait pas par défaut)
        db.Exec("PRAGMA foreign_keys = ON")

        DB = db

        if err := migrate(db); err != nil {
                return nil, fmt.Errorf("migration: %w", err)
        }

        if err := createIndexes(db); err != nil {
                return nil, fmt.Errorf("createIndexes: %w", err)
        }

        return db, nil
}

// migrate crée/met à jour toutes les tables via GORM AutoMigrate.
// L'ordre respecte les dépendances entre entités (parents avant enfants).
func migrate(db *gorm.DB) error {
        modelsList := []interface{}{
                // Référentiel
                &models.Etablissement{},
                &models.AnneeScolaire{},
                &models.Cycle{},
                &models.Classe{},
                // Élèves & tuteurs
                &models.Tuteur{},
                &models.Eleve{},
                &models.TuteurEleve{},
                &models.Inscription{},
                &models.Document{},
                // Facturation
                &models.Frais{},
                &models.Echeance{},
                // Caisse & paiements
                &models.Paiement{},
                &models.Recu{},
                &models.ClotureCaisse{},
                &models.TransactionMobileMoney{},
                // Utilisateurs & sécurité
                &models.Utilisateur{},
                &models.EtablissementAccess{},
                &models.Session{},
                &models.JournalAudit{},
                // Communication
                &models.TemplateMessage{},
                &models.EnvoiMessage{},
                // Comptabilité
                &models.ExerciceComptable{},
                &models.CompteComptable{},
                &models.JournalComptable{},
                &models.EcritureComptable{},
                &models.LigneEcriture{},
                // Notification
                &models.Notification{},
        }

        return db.AutoMigrate(modelsList...)
}

// createIndexes crée les index personnalisés non gérables par tags GORM.
func createIndexes(db *gorm.DB) error {
        // Index unique partiel sur matricule_ministere : unique seulement si non vide.
        // Permet aux élèves du préscolaire/primaire (sans matricule) d'avoir "" sans conflit.
        // SQLite ne gère pas NULL comme égal dans les index uniques, mais "" est considéré égal.
        return db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_eleves_matricule_unique 
                ON eleves(matricule_ministere) WHERE matricule_ministere != ''`).Error
}
