package seed

import (
        "log"
        "time"

        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/database"
        "github.com/scolagest/backend/internal/models"
)

// SeedFrais crée les frais et échéanciers pour l'année active,
// selon les grilles tarifaires du cahier des charges (§5.3).
// Idempotent : ne recrée pas si des frais existent déjà.
func SeedFrais() {
        db := database.DB

        var count int64
        db.Model(&models.Frais{}).Count(&count)
        if count > 0 {
                log.Printf("  ℹ %d frais déjà présents — seed frais ignoré", count)
                return
        }

        var college, epv models.Etablissement
        db.Where("code_officiel = ?", "013062").First(&college)
        db.Where("code_officiel = ?", "0103105091").First(&epv)

        var annee models.AnneeScolaire
        db.Where("est_active = ?", true).First(&annee)

        // ===== COLLÈGE / LYCÉE (distinction affecté / non-affecté) =====

        // Cycles du collège
        var cycleCollege, cycleLycee models.Cycle
        db.Where("etablissement_id = ? AND libelle = ?", college.ID, models.CycleCollege).First(&cycleCollege)
        db.Where("etablissement_id = ? AND libelle = ?", college.ID, models.CycleLycee).First(&cycleLycee)

        // --- Frais d'inscription (Collège + Lycée) ---
        // Non affecté : 60 000 F ; Affecté : 85 000 F (en 1 versement)
        catNA := models.CategorieNonAffecte
        catA := models.CategorieAffecte

        createFrais(college.ID, annee.ID, &cycleCollege.ID, nil, models.TypeFraisInscription, &catNA,
                "Frais d'inscription — Collège (non affecté)", 60000, 1, []echeanceDef{
                        {1, "Inscription (1 versement)", 60000, "2026-09-15"},
                })
        createFrais(college.ID, annee.ID, &cycleCollege.ID, nil, models.TypeFraisInscription, &catA,
                "Frais d'inscription — Collège (affecté)", 85000, 1, []echeanceDef{
                        {1, "Inscription (1 versement)", 85000, "2026-09-15"},
                })
        createFrais(college.ID, annee.ID, &cycleLycee.ID, nil, models.TypeFraisInscription, &catNA,
                "Frais d'inscription — Lycée (non affecté)", 60000, 1, []echeanceDef{
                        {1, "Inscription (1 versement)", 60000, "2026-09-15"},
                })
        createFrais(college.ID, annee.ID, &cycleLycee.ID, nil, models.TypeFraisInscription, &catA,
                "Frais d'inscription — Lycée (affecté)", 85000, 1, []echeanceDef{
                        {1, "Inscription (1 versement)", 85000, "2026-09-15"},
                })

        // --- Scolarité (non affectés uniquement) ---
        // 1er cycle (6e-3e) : 160 000 F en 5 tranches (oct→fév) : 40k, 40k, 35k, 35k, 10k
        createFrais(college.ID, annee.ID, &cycleCollege.ID, nil, models.TypeFraisScolarite, &catNA,
                "Scolarité annuelle — 1er cycle (6e-3e)", 160000, 5, []echeanceDef{
                        {1, "1er versement", 40000, "2026-10-05"},
                        {2, "2e versement", 40000, "2026-11-05"},
                        {3, "3e versement", 35000, "2026-12-05"},
                        {4, "4e versement", 35000, "2027-01-05"},
                        {5, "5e versement", 10000, "2027-02-05"},
                })
        // 2nd cycle (2nde-Tle) : 180 000 F en 5 tranches : 50k, 50k, 35k, 35k, 10k
        createFrais(college.ID, annee.ID, &cycleLycee.ID, nil, models.TypeFraisScolarite, &catNA,
                "Scolarité annuelle — 2nd cycle (2nde-Tle)", 180000, 5, []echeanceDef{
                        {1, "1er versement", 50000, "2026-10-05"},
                        {2, "2e versement", 50000, "2026-11-05"},
                        {3, "3e versement", 35000, "2026-12-05"},
                        {4, "4e versement", 35000, "2027-01-05"},
                        {5, "5e versement", 10000, "2027-02-05"},
                })

        // --- Frais d'examen (classes d'examen) ---
        // 3e : 3 000 F ; Terminale : 6 000 F
        var classe3e, classeTerm models.Classe
        db.Joins("JOIN cycles ON cycles.id = classes.cycle_id").
                Where("cycles.etablissement_id = ? AND classes.libelle = ?", college.ID, "3e A").First(&classe3e)
        db.Joins("JOIN cycles ON cycles.id = classes.cycle_id").
                Where("cycles.etablissement_id = ? AND classes.libelle LIKE ?", college.ID, "Terminale%").First(&classeTerm)
        if classe3e.ID != uuid.Nil {
                createFrais(college.ID, annee.ID, nil, &classe3e.ID, models.TypeFraisExamen, nil,
                        "Frais d'examen — 3e", 3000, 1, []echeanceDef{
                                {1, "Examen (1 versement)", 3000, "2027-01-15"},
                        })
        }
        if classeTerm.ID != uuid.Nil {
                createFrais(college.ID, annee.ID, nil, &classeTerm.ID, models.TypeFraisExamen, nil,
                        "Frais d'examen — Terminale", 6000, 1, []echeanceDef{
                                {1, "Examen (1 versement)", 6000, "2027-01-15"},
                        })
        }

        // ===== EPV (préscolaire + primaire — tarif unique, pas de catégorie) =====
        var cyclePresc, cyclePrim models.Cycle
        db.Where("etablissement_id = ? AND libelle = ?", epv.ID, models.CyclePrescolaire).First(&cyclePresc)
        db.Where("etablissement_id = ? AND libelle = ?", epv.ID, models.CyclePrimaire).First(&cyclePrim)

        // --- Inscription ---
        // Primaire : 20 000 F (1 versement) ; Préscolaire : 15 000 F (1 versement)
        createFrais(epv.ID, annee.ID, &cyclePrim.ID, nil, models.TypeFraisInscription, nil,
                "Frais d'inscription — Primaire (CP1-CM2)", 20000, 1, []echeanceDef{
                        {1, "Inscription (1 versement)", 20000, "2026-09-15"},
                })
        createFrais(epv.ID, annee.ID, &cyclePresc.ID, nil, models.TypeFraisInscription, nil,
                "Frais d'inscription — Préscolaire (PS-GS)", 15000, 1, []echeanceDef{
                        {1, "Inscription (1 versement)", 15000, "2026-09-15"},
                })

        // --- Scolarité (écolage) en 4 tranches (nov→fév) ---
        // Primaire CP-CE : 55 000 F → 15k, 15k, 15k, 10k
        // Primaire CM : 60 000 F → 15k, 15k, 15k, 15k
        // Préscolaire : 50 000 F → 15k, 15k, 10k, 10k
        var classeCPCE, classeCM models.Classe
        db.Joins("JOIN cycles ON cycles.id = classes.cycle_id").
                Where("cycles.etablissement_id = ? AND classes.libelle = ?", epv.ID, "CP1").First(&classeCPCE)
        // Pour CP-CE, on crée au niveau cycle (tarif unique pour tout le primaire CP-CE)
        // Sauf CM qui a un tarif différent — on crée au niveau classe
        db.Joins("JOIN cycles ON cycles.id = classes.cycle_id").
                Where("cycles.etablissement_id = ? AND classes.libelle = ?", epv.ID, "CM2").First(&classeCM)

        // CP-CE au niveau cycle (55 000)
        createFrais(epv.ID, annee.ID, &cyclePrim.ID, nil, models.TypeFraisScolarite, nil,
                "Scolarité annuelle — Primaire (CP1-CE2)", 55000, 4, []echeanceDef{
                        {1, "1er versement", 15000, "2026-11-05"},
                        {2, "2e versement", 15000, "2026-12-05"},
                        {3, "3e versement", 15000, "2027-01-05"},
                        {4, "4e versement", 10000, "2027-02-05"},
                })
        // CM au niveau classe (60 000) — surclasse le tarif cycle
        if classeCM.ID != uuid.Nil {
                createFrais(epv.ID, annee.ID, nil, &classeCM.ID, models.TypeFraisScolarite, nil,
                        "Scolarité annuelle — Primaire (CM1-CM2)", 60000, 4, []echeanceDef{
                                {1, "1er versement", 15000, "2026-11-05"},
                                {2, "2e versement", 15000, "2026-12-05"},
                                {3, "3e versement", 15000, "2027-01-05"},
                                {4, "4e versement", 15000, "2027-02-05"},
                        })
        }
        // Préscolaire (50 000)
        createFrais(epv.ID, annee.ID, &cyclePresc.ID, nil, models.TypeFraisScolarite, nil,
                "Scolarité annuelle — Préscolaire (PS-GS)", 50000, 4, []echeanceDef{
                        {1, "1er versement", 15000, "2026-11-05"},
                        {2, "2e versement", 15000, "2026-12-05"},
                        {3, "3e versement", 10000, "2027-01-05"},
                        {4, "4e versement", 10000, "2027-02-05"},
                })

        // --- Droit d'examen CM2 (2 000 F) ---
        if classeCM.ID != uuid.Nil {
                createFrais(epv.ID, annee.ID, nil, &classeCM.ID, models.TypeFraisExamen, nil,
                        "Droit d'examen — CM2", 2000, 1, []echeanceDef{
                                {1, "Examen (1 versement)", 2000, "2027-01-15"},
                        })
        }

        log.Println("  + Frais & échéanciers créés selon grilles tarifaires §5.3")
}

type echeanceDef struct {
        rang       int
        libelle    string
        montant    float64
        dateLimite string
}

func createFrais(etbID, anneeID uuid.UUID, cycleID, classeID *uuid.UUID,
        typeFrais models.TypeFrais, categorie *models.CategorieEleve,
        libelle string, montantTotal float64, nbVers int, echeances []echeanceDef) {

        frais := models.Frais{
                EtablissementID:    etbID,
                AnneeScolaireID:    anneeID,
                CycleID:            cycleID,
                ClasseID:           classeID,
                TypeFrais:          typeFrais,
                Categorie:          categorie,
                Libelle:            libelle,
                MontantTotal:       montantTotal,
                NbVersementsDefaut: nbVers,
                Actif:              true,
        }
        if err := database.DB.Create(&frais).Error; err != nil {
                log.Printf("  ⚠ création frais '%s': %v", libelle, err)
                return
        }

        for _, e := range echeances {
                dateLimite, _ := time.Parse("2006-01-02", e.dateLimite)
                database.DB.Create(&models.Echeance{
                        FraisID:    frais.ID,
                        Rang:       e.rang,
                        Libelle:    e.libelle,
                        Montant:    e.montant,
                        DateLimite: dateLimite,
                })
        }
}
