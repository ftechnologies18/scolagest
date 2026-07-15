package database

import (
        "fmt"
        "log"
        "os"
        "path/filepath"

        "github.com/glebarez/sqlite"
        "github.com/scolagest/backend/internal/config"
        "github.com/scolagest/backend/internal/models"
        "gorm.io/driver/postgres"
        "gorm.io/gorm"
        "gorm.io/gorm/logger"
)

// DB est la connexion globale à la base de données.
var DB *gorm.DB

// Connect initialise la connexion à la base de données et exécute les migrations.
// Détecte automatiquement le driver :
//   - si DATABASE_URL est défini (commence par "postgres") → PostgreSQL (Neon)
//   - sinon → SQLite (fichier local, dev)
func Connect() (*gorm.DB, error) {
        cfg := config.App

        logLevel := logger.Warn
        if cfg.IsDev() {
                logLevel = logger.Info
        }

        var db *gorm.DB
        var err error

        if cfg.IsPostgreSQL() {
                // PostgreSQL (Neon)
                fmt.Printf("🔌 Connexion à PostgreSQL (Neon)...\n")
                db, err = gorm.Open(postgres.Open(cfg.DatabaseURL), &gorm.Config{
                        Logger: logger.Default.LogMode(logLevel),
                })
                if err != nil {
                        return nil, fmt.Errorf("ouverture PostgreSQL: %w", err)
                }
                fmt.Printf("✓ Connecté à PostgreSQL\n")
        } else {
                // SQLite (dev local)
                fmt.Printf("🔌 Connexion à SQLite (%s)...\n", cfg.DBPath)
                // S'assurer que le dossier parent du fichier DB existe
                if dir := filepath.Dir(cfg.DBPath); dir != "" {
                        if err := os.MkdirAll(dir, 0755); err != nil {
                                return nil, fmt.Errorf("création dossier DB: %w", err)
                        }
                }
                db, err = gorm.Open(sqlite.Open(cfg.DBPath+"?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)"), &gorm.Config{
                        Logger: logger.Default.LogMode(logLevel),
                })
                if err != nil {
                        return nil, fmt.Errorf("ouverture SQLite: %w", err)
                }
                // Activer les contraintes de clé étrangère (SQLite ne le fait pas par défaut)
                db.Exec("PRAGMA foreign_keys = ON")
                fmt.Printf("✓ Connecté à SQLite\n")
        }

        DB = db

        if err := migrate(db); err != nil {
                return nil, fmt.Errorf("migration: %w", err)
        }

        if err := createIndexes(db); err != nil {
                return nil, fmt.Errorf("createIndexes: %w", err)
        }

        // Activer RLS (Row Level Security) sur PostgreSQL uniquement.
        // Sur SQLite, RLS n'est pas supporté — l'isolation repose sur le code Go.
        if config.App.IsPostgreSQL() {
                if err := enableRLS(db); err != nil {
                        log.Printf("⚠️  RLS: %v (l'isolation repose sur le code applicatif)", err)
                }
        }

        // Logger la répartition des owners pour diagnostiquer les problèmes
        // d'ownership AutoMigrate (ex: Neon avec multiples roles).
        LogSchemaInfo(db)

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
                // SaaS Billing
                &models.SaaPlan{},
                &models.SaaSubscription{},
                &models.SaaInvoice{},
                // Pré-inscription en ligne (Phase 3)
                &models.PreInscription{},
                // Réinitialisation mot de passe staff
                &models.PasswordResetToken{},
                // Enseignants & pédagogie (Phase A)
                &models.Enseignant{},
                &models.Matiere{},
                &models.EnseignantMatiere{},
                &models.AffectationCours{},
                // Pointage & discipline (Phase B)
                &models.SessionCours{},
                &models.Pointage{},
                &models.TicketIncident{},
                // Paie enseignants (Phase C)
                &models.BulletinPaie{},
                &models.AvanceSalaire{},
                // Emploi du temps (Phase A étendue)
                &models.CreneauEmploiTemps{},
        }

        // AutoMigrate par modèle (au lieu de tout-en-un) pour qu'une erreur sur
        // une table (ex: problème d'ownership Neon) ne bloque pas les autres.
        // Les erreurs sont loggées mais ne font pas échouer toute la migration.
        failed := 0
        succeeded := 0
        for _, model := range modelsList {
                if err := db.AutoMigrate(model); err != nil {
                        tableName := ""
                        if t, ok := model.(interface{ TableName() string }); ok {
                                tableName = t.TableName()
                        }
                        log.Printf("⚠️  AutoMigrate échec sur %s: %v", tableName, err)
                        failed++
                } else {
                        succeeded++
                }
        }
        if failed > 0 {
                log.Printf("⚠️  Migration: %d succès, %d échecs (voir logs ci-dessus)", succeeded, failed)
                // Ne pas retourner d'erreur : le serveur démarre en mode dégradé
                // mais les tables valides sont utilisables. Les erreurs sont loggées.
        } else {
                log.Printf("✓ Migration: %d tables à jour", succeeded)
        }
        return nil
}

// createIndexes crée les index personnalisés non gérables par tags GORM.
func createIndexes(db *gorm.DB) error {
        // Index unique partiel sur matricule_ministere : unique seulement si non vide.
        // Permet aux élèves du préscolaire/primaire (sans matricule) d'avoir "" sans conflit.
        // Compatible SQLite ET PostgreSQL (syntaxe CREATE UNIQUE INDEX ... WHERE ...).
        return db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_eleves_matricule_unique 
                ON eleves(matricule_ministere) WHERE matricule_ministere != ''`).Error
}

// LogSchemaInfo logge le user DB courant et la répartition des owners de tables.
// Utile pour diagnostiquer les problèmes d'ownership AutoMigrate (ex: Neon avec
// multiples roles). Uniquement sur PostgreSQL — no-op sur SQLite.
func LogSchemaInfo(db *gorm.DB) {
        if !config.App.IsPostgreSQL() {
                return
        }
        var currentUser string
        db.Raw("SELECT current_user").Scan(&currentUser)
        log.Printf("🔌 DB user: %s", currentUser)

        type OwnerCount struct {
                TableOwner string
                Count      int64
        }
        var counts []OwnerCount
        db.Raw(`SELECT tableowner, count(*) as count 
                FROM pg_tables 
                WHERE schemaname = 'public' 
                GROUP BY tableowner 
                ORDER BY count DESC`).Scan(&counts)

        if len(counts) <= 1 {
                log.Printf("✓ Schema: toutes les tables ont le même owner (%s)", currentUser)
                return
        }

        log.Printf("⚠️  Schema: %d owners différents détectés:", len(counts))
        for _, oc := range counts {
                marker := ""
                if oc.TableOwner != currentUser {
                        marker = " ← AutoMigrate NE PEUT PAS modifier ces tables"
                }
                log.Printf("     - %s: %d tables%s", oc.TableOwner, oc.Count, marker)
        }
        log.Printf("⚠️  Si des colonnes sont ajoutées aux modèles des tables avec un owner ≠ %s,", currentUser)
        log.Printf("     AutoMigrate échouera sur ces tables. Solution: uniformiser l'ownership")
        log.Printf("     (ALTER TABLE ... OWNER TO %s — nécessite d'être owner ou superuser).", currentUser)
}

// enableRLS active Row Level Security sur les tables contenant des données
// sensibles (élèves, finances) et crée les policies consommant les variables
// de session définies par AuthMiddleware :
//   - app.current_tenant_id : UUID de l'établissement de l'utilisateur connecté
//   - app.is_super_admin    : 'true' pour SUPER_ADMIN (voit tout)
//
// Tables PROTÉGÉES par RLS (isolation multi-tenant stricte) :
//   eleves, tuteurs, inscriptions, classes, cycles, frais, echeances,
//   paiements, recus, clotures_caisse, transactions_momo, enseignants,
//   matieres, affectation_cours, session_cours, pointages, ticket_incidents,
//   bulletin_paies, avance_salaires, ecritures_comptables, lignes_ecritures,
//   comptes_comptables, journaux_comptables, exercices_comptables.
//
// Tables NON protégées (accès public requis) :
//   - etablissements : lu par /api/etablissements (route publique, select login)
//   - pre_inscriptions : écrit par /api/public/pre-inscriptions (route publique)
//     → policy dédiée autorisant l'INSERT public + SELECT staff
//
// Sans RLS, l'isolation repose entièrement sur le code Go (WHERE etablissement_id).
// RLS ajoute une défense en profondeur : même si un service oublie le filtre,
// Postgres bloque la fuite.
//
// Idempotent (DO $$ ... EXCEPTION WHEN duplicate_object). En cas d'échec
// (ex: pas owner), logge un warning mais ne fait pas crasher le serveur.
func enableRLS(db *gorm.DB) error {
        // Tables avec isolation tenant stricte (tenant = etablissement_id)
        strictTables := []string{
                "eleves", "tuteurs", "inscriptions", "classes", "cycles",
                "frais", "echeances", "paiements", "recus", "clotures_caisse",
                "transactions_momo", "enseignants", "matieres", "affectation_cours",
                "session_cours", "pointages", "ticket_incidents", "bulletin_paies",
                "avance_salaires", "ecritures_comptables", "lignes_ecritures",
                "comptes_comptables", "journaux_comptables", "exercices_comptables",
        }

        enabled := 0
        failed := 0

        // Policy template pour tables strictes :
        // USING (lecture) + WITH CHECK (écriture) = tenant match OU super_admin
        policySQL := func(table string) string {
                return fmt.Sprintf(`DO $$ BEGIN
                        CREATE POLICY %s_tenant ON %s FOR ALL
                                USING (
                                        etablissement_id::text = current_setting('app.current_tenant_id', true)
                                        OR current_setting('app.is_super_admin', true) = 'true'
                                )
                                WITH CHECK (
                                        etablissement_id::text = current_setting('app.current_tenant_id', true)
                                        OR current_setting('app.is_super_admin', true) = 'true'
                                );
                        EXCEPTION WHEN duplicate_object THEN NULL;
                        END $$;`, table, table)
        }

        for _, table := range strictTables {
                if err := db.Exec("ALTER TABLE " + table + " ENABLE ROW LEVEL SECURITY").Error; err != nil {
                        log.Printf("  ⚠️  RLS %s: %v", table, err)
                        failed++
                        continue
                }
                db.Exec("ALTER TABLE " + table + " FORCE ROW LEVEL SECURITY")
                if err := db.Exec(policySQL(table)).Error; err != nil {
                        log.Printf("  ⚠️  Policy %s: %v", table, err)
                        failed++
                        continue
                }
                enabled++
        }

        // pre_inscriptions : politique hybride
        //   - INSERT public (route /api/public/pre-inscriptions sans auth)
        //   - SELECT/UPDATE staff uniquement (tenant match OU super_admin)
        if err := db.Exec("ALTER TABLE pre_inscriptions ENABLE ROW LEVEL SECURITY").Error; err == nil {
                db.Exec("ALTER TABLE pre_inscriptions FORCE ROW LEVEL SECURITY")
                // Policy INSERT : autoriser tout le monde (parent soumet sans auth)
                db.Exec(`DO $$ BEGIN
                        CREATE POLICY pre_inscriptions_public_insert ON pre_inscriptions
                                FOR INSERT WITH CHECK (true);
                        EXCEPTION WHEN duplicate_object THEN NULL;
                        END $$;`)
                // Policy SELECT/UPDATE/DELETE : staff uniquement (tenant match OU super_admin)
                db.Exec(`DO $$ BEGIN
                        CREATE POLICY pre_inscriptions_staff ON pre_inscriptions
                                FOR SELECT, UPDATE, DELETE
                                USING (
                                        etablissement_id::text = current_setting('app.current_tenant_id', true)
                                        OR current_setting('app.is_super_admin', true) = 'true'
                                );
                        EXCEPTION WHEN duplicate_object THEN NULL;
                        END $$;`)
                // Permissive policy (la plus permissive l'emporte en PostgreSQL)
                enabled++
        } else {
                log.Printf("  ⚠️  RLS pre_inscriptions: %v", err)
                failed++
        }

        if failed > 0 {
                log.Printf("⚠️  RLS: %d tables protégées, %d échecs", enabled, failed)
        } else {
                log.Printf("✓ RLS: %d tables protégées (défense en profondeur multi-tenant active)", enabled)
        }
        return nil
}
