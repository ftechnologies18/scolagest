package seed

import (
        "log"
        "time"

        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/database"
        "github.com/scolagest/backend/internal/models"
        "github.com/scolagest/backend/internal/utils"
        "gorm.io/gorm"
)

// Seed initialise la base avec les données de démonstration :
// - 2 établissements (Collège Le Chandelier + EPV)
// - 4 cycles + classes pour chaque établissement
// - 1 année scolaire active (2026-2027)
// - 6 utilisateurs (un par rôle RBAC)
// - Pour chaque utilisateur staff : accès à l'établissement approprié
//
// Idempotent : ne recrée pas ce qui existe déjà.
func Seed() {
        db := database.DB

        seedEtablissements(db)
        seedAnneeScolaire(db)
        seedCyclesEtClasses(db)
        seedUtilisateurs(db)
        SeedEleves()
        SeedFrais()
        SeedPaiements()
        SeedParent()
        SeedSaasBilling()

        log.Println("✓ Seed terminé")
}

func seedEtablissements(db *gorm.DB) {
        etabs := []models.Etablissement{
                {
                        BaseModel:               models.BaseModel{ID: uuid.New()},
                        Nom:                     "Collège Privé Le Chandelier",
                        CodeOfficiel:            "013062",
                        Adresse:                 "Dabou",
                        Ville:                   "Dabou",
                        Telephone:               "+225 0103105091",
                        Email:                   "contact@college-lechandelier.ci",
                        AppliqueCategorieAffecte: true,
                        CouleurTheme:            "#059669",
                        Actif:                   true,
                },
                {
                        BaseModel:               models.BaseModel{ID: uuid.New()},
                        Nom:                     "École Primaire Privée Le Chandelier / EPV",
                        CodeOfficiel:            "0103105091",
                        Adresse:                 "Dabou",
                        Ville:                   "Dabou",
                        Telephone:               "+225 0708176273",
                        Email:                   "contact@epv-lechandelier.ci",
                        AppliqueCategorieAffecte: false,
                        CouleurTheme:            "#d97706",
                        Actif:                   true,
                },
        }
        for _, e := range etabs {
                var existing models.Etablissement
                if err := db.Where("code_officiel = ?", e.CodeOfficiel).First(&existing).Error; err == gorm.ErrRecordNotFound {
                        if err := db.Create(&e).Error; err != nil {
                                log.Printf("⚠ création établissement %s: %v", e.Nom, err)
                        } else {
                                log.Printf("  + Établissement: %s (%s)", e.Nom, e.CodeOfficiel)
                        }
                }
        }
}

func seedAnneeScolaire(db *gorm.DB) {
        libelle := "2026-2027"
        var existing models.AnneeScolaire
        if err := db.Where("libelle = ?", libelle).First(&existing).Error; err == gorm.ErrRecordNotFound {
                debut, _ := time.Parse("2006-01-02", "2026-09-15")
                fin, _ := time.Parse("2006-01-02", "2027-07-31")
                annee := models.AnneeScolaire{
                        BaseModel:  models.BaseModel{ID: uuid.New()},
                        Libelle:    libelle,
                        DateDebut:  debut,
                        DateFin:    fin,
                        Statut:     models.AnneeEnCours,
                        EstActive:  true,
                }
                if err := db.Create(&annee).Error; err != nil {
                        log.Printf("⚠ création année scolaire: %v", err)
                } else {
                        log.Printf("  + Année scolaire: %s", libelle)
                }
        }
}

func seedCyclesEtClasses(db *gorm.DB) {
        // Récupérer les établissements
        var college, epv models.Etablissement
        db.Where("code_officiel = ?", "013062").First(&college)
        db.Where("code_officiel = ?", "0103105091").First(&epv)

        // Année active (pour référence)
        var annee models.AnneeScolaire
        db.Where("est_active = ?", true).First(&annee)

        type cycleDef struct {
                libelle models.LibelleCycle
                ordre   int
                classes []struct {
                        libelle string
                        niveau  int
                        examen  bool
                }
        }

        // EPV : préscolaire + primaire
        epvCycles := []cycleDef{
                {models.CyclePrescolaire, 1, []struct {
                        libelle string
                        niveau  int
                        examen  bool
                }{{"Petite Section (PS)", 1, false}, {"Moyenne Section (MS)", 2, false}, {"Grande Section (GS)", 3, false}}},
                {models.CyclePrimaire, 2, []struct {
                        libelle string
                        niveau  int
                        examen  bool
                }{{"CP1", 1, false}, {"CP2", 2, false}, {"CE1", 3, false}, {"CE2", 4, false}, {"CM1", 5, false}, {"CM2", 6, true}}},
        }
        // Collège : collège + lycée
        collegeCycles := []cycleDef{
                {models.CycleCollege, 3, []struct {
                        libelle string
                        niveau  int
                        examen  bool
                }{{"6e A", 1, false}, {"6e B", 1, false}, {"5e A", 2, false}, {"4e A", 3, false}, {"3e A", 4, true}}},
                {models.CycleLycee, 4, []struct {
                        libelle string
                        niveau  int
                        examen  bool
                }{{"2nde A", 1, false}, {"1ère D", 2, false}, {"1ère A", 2, false}, {"Terminale D", 3, true}, {"Terminale A", 3, true}}},
        }

        createCycles := func(etbID uuid.UUID, cycles []cycleDef) {
                for _, cd := range cycles {
                        var cycle models.Cycle
                        if err := db.Where("etablissement_id = ? AND libelle = ?", etbID, cd.libelle).First(&cycle).Error; err == gorm.ErrRecordNotFound {
                                cycle = models.Cycle{
                                        BaseModel:       models.BaseModel{ID: uuid.New()},
                                        EtablissementID: etbID,
                                        Libelle:         cd.libelle,
                                        Ordre:           cd.ordre,
                                        Actif:           true,
                                }
                                db.Create(&cycle)
                        }
                        for _, cl := range cd.classes {
                                var existing models.Classe
                                if err := db.Where("cycle_id = ? AND libelle = ?", cycle.ID, cl.libelle).First(&existing).Error; err == gorm.ErrRecordNotFound {
                                        db.Create(&models.Classe{
                                                BaseModel:         models.BaseModel{ID: uuid.New()},
                                                CycleID:           cycle.ID,
                                                Libelle:           cl.libelle,
                                                Niveau:            cl.niveau,
                                                EstClasseExamen:   cl.examen,
                                                Actif:             true,
                                        })
                                }
                        }
                }
        }

        createCycles(epv.ID, epvCycles)
        createCycles(college.ID, collegeCycles)
        log.Println("  + Cycles et classes créés")
}

func seedUtilisateurs(db *gorm.DB) {
        // Récupérer les établissements
        var college, epv models.Etablissement
        db.Where("code_officiel = ?", "013062").First(&college)
        db.Where("code_officiel = ?", "0103105091").First(&epv)

        type userDef struct {
                nom      string
                prenoms  string
                email    string
                password string
                role     models.RoleUtilisateur
                // établissements auxquels l'utilisateur a accès (avec rôle potentiellement différent)
                accesses []struct {
                        etbID uuid.UUID
                        role  models.RoleUtilisateur
                }
        }

        // SUPER_ADMIN = propriétaire SaaS (pas d'accès établissement)
        adminRole := models.RoleSuperAdmin
        users := []userDef{
                {"Konan", "Super Admin (SaaS)", "admin@scolagest.ci", "admin123", models.RoleSuperAdmin, []struct {
                        etbID uuid.UUID
                        role  models.RoleUtilisateur
                }{}}, // SUPER_ADMIN : aucun accès établissement (rôle plateforme)
                {"Traoré", "Aminata (Caissière)", "caissier@scolagest.ci", "caissier123", models.RoleCaissier, []struct {
                        etbID uuid.UUID
                        role  models.RoleUtilisateur
                }{{college.ID, models.RoleCaissier}}},
                {"Kouassi", "Jean (Comptable)", "comptable@scolagest.ci", "comptable123", models.RoleComptable, []struct {
                        etbID uuid.UUID
                        role  models.RoleUtilisateur
                }{{college.ID, models.RoleComptable}}},
                {"Brou", "Direction", "direction@scolagest.ci", "direction123", models.RoleDirection, []struct {
                        etbID uuid.UUID
                        role  models.RoleUtilisateur
                }{{college.ID, models.RoleDirection}, {epv.ID, models.RoleDirection}}},
                {"Yapi", "Secrétariat", "secretariat@scolagest.ci", "secretariat123", models.RoleSecretariat, []struct {
                        etbID uuid.UUID
                        role  models.RoleUtilisateur
                }{{epv.ID, models.RoleSecretariat}}},
        }

        for _, u := range users {
                var existing models.Utilisateur
                if err := db.Where("email = ?", u.email).First(&existing).Error; err == gorm.ErrRecordNotFound {
                        hash, _ := utils.HashPassword(u.password)
                        roleCopy := u.role
                        user := models.Utilisateur{
                                BaseModel:        models.BaseModel{ID: uuid.New()},
                                Nom:              u.nom,
                                Prenoms:          u.prenoms,
                                Email:            u.email,
                                MotDePasseHash:   hash,
                                RoleGlobal:       &roleCopy,
                                Statut:           models.StatutUserActif,
                        }
                        // L'admin n'a pas de roleGlobal pointant sur un établissement unique — il garde ADMINISTRATEUR global
                        if u.role == models.RoleSuperAdmin {
                                user.RoleGlobal = &adminRole
                        }
                        if err := db.Create(&user).Error; err != nil {
                                log.Printf("⚠ création utilisateur %s: %v", u.email, err)
                                continue
                        }
                        // Créer les accès établissements
                        for _, a := range u.accesses {
                                // Vérifier l'unicité
                                var count int64
                                db.Model(&models.EtablissementAccess{}).
                                        Where("utilisateur_id = ? AND etablissement_id = ?", user.ID, a.etbID).
                                        Count(&count)
                                if count == 0 {
                                        db.Create(&models.EtablissementAccess{
                                                UtilisateurID:   user.ID,
                                                EtablissementID: a.etbID,
                                                Role:            a.role,
                                        })
                                }
                        }
                        log.Printf("  + Utilisateur: %s (%s) — mot de passe: %s", u.email, u.role, u.password)
                }
        }
}
