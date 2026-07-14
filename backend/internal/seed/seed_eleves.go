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

// SeedEleves crée des élèves de démonstration dans les deux établissements,
// avec tuteurs et inscriptions pour l'année active.
// Idempotent : ne recrée pas si des élèves existent déjà.
func SeedEleves() {
        db := database.DB

        var count int64
        db.Model(&models.Eleve{}).Count(&count)
        if count > 0 {
                log.Printf("  ℹ %d élèves déjà présents — seed élèves ignoré", count)
                return
        }

        // Récupérer les établissements + année active + classes
        var college, epv models.Etablissement
        db.Where("code_officiel = ?", "013062").First(&college)
        db.Where("code_officiel = ?", "0103105091").First(&epv)

        var annee models.AnneeScolaire
        db.Where("est_active = ?", true).First(&annee)

        // Classes du Collège Privé Le Chandelier (premier cycle + second cycle)
        var classe6e1, classe3e1, classeTermD1 models.Classe
        db.Joins("JOIN cycles ON cycles.id = classes.cycle_id").
                Where("cycles.etablissement_id = ? AND classes.libelle = ?", college.ID, "6e 1").First(&classe6e1)
        db.Joins("JOIN cycles ON cycles.id = classes.cycle_id").
                Where("cycles.etablissement_id = ? AND classes.libelle = ?", college.ID, "3e 1").First(&classe3e1)
        db.Joins("JOIN cycles ON cycles.id = classes.cycle_id").
                Where("cycles.etablissement_id = ? AND classes.libelle = ?", college.ID, "Terminale D 1").First(&classeTermD1)

        // Classes de l'EPV
        var classeCP1, classeCM2 models.Classe
        db.Joins("JOIN cycles ON cycles.id = classes.cycle_id").
                Where("cycles.etablissement_id = ? AND classes.libelle = ?", epv.ID, "CP1").First(&classeCP1)
        db.Joins("JOIN cycles ON cycles.id = classes.cycle_id").
                Where("cycles.etablissement_id = ? AND classes.libelle = ?", epv.ID, "CM2").First(&classeCM2)

        // ===== Tuteurs =====
        tuteurs := []models.Tuteur{
                {Nom: "Kouassi", Prenoms: "Jean", Telephone: "+225 0701020304", Email: "kouassi.jean@gmail.com", LienParente: models.LienPere, Profession: "Commerçant", Actif: true},
                {Nom: "Traoré", Prenoms: "Aminata", Telephone: "+225 0505060708", Email: "traore.aminata@gmail.com", LienParente: models.LienMere, Profession: "Couturière", Actif: true},
                {Nom: "Brou", Prenoms: "Marc", Telephone: "+225 0109080706", Email: "brou.marc@yahoo.fr", LienParente: models.LienPere, Profession: "Chauffeur", Actif: true},
                {Nom: "Diabaté", Prenoms: "Fatou", Telephone: "+225 0706050403", LienParente: models.LienMere, Profession: "Ménagère", Actif: true},
                {Nom: "Yapi", Prenoms: "Koffi", Telephone: "+225 0504030201", Email: "yapi.koffi@outlook.com", LienParente: models.LienTuteurLegal, Profession: "Enseignant", Actif: true},
        }
        for i := range tuteurs {
                tuteurs[i].ID = uuid.New()
                db.Create(&tuteurs[i])
        }
        log.Printf("  + %d tuteurs créés", len(tuteurs))

        // ===== Élèves du Collège (avec catégorie affecté/non-affecté) =====
        dates := []time.Time{
                mustDate("2014-03-15"),
                mustDate("2013-07-22"),
                mustDate("2010-11-05"),
                mustDate("2009-04-18"),
                mustDate("2008-09-30"),
        }
        elevesCollege := []models.Eleve{
                {EtablissementID: college.ID, MatriculeMinistere: "CI-00245-MEN-001", IdentifiantInterne: "COL-2026-0001", Nom: "Kouassi", Prenoms: "Yann", DateNaissance: &dates[0], LieuNaissance: "Dabou", Sexe: models.SexeM, Categorie: models.CategorieNonAffecte, Statut: models.StatutEleveActif, TuteurID: &tuteurs[0].ID},
                {EtablissementID: college.ID, MatriculeMinistere: "CI-00245-MEN-002", IdentifiantInterne: "COL-2026-0002", Nom: "Traoré", Prenoms: "Awa", DateNaissance: &dates[1], LieuNaissance: "Abidjan", Sexe: models.SexeF, Categorie: models.CategorieAffecte, Statut: models.StatutEleveActif, TuteurID: &tuteurs[1].ID},
                {EtablissementID: college.ID, MatriculeMinistere: "CI-00245-MEN-003", IdentifiantInterne: "COL-2026-0003", Nom: "Brou", Prenoms: "David", DateNaissance: &dates[2], LieuNaissance: "Dabou", Sexe: models.SexeM, Categorie: models.CategorieNonAffecte, Statut: models.StatutEleveActif, TuteurID: &tuteurs[2].ID},
                {EtablissementID: college.ID, MatriculeMinistere: "CI-00245-MEN-004", IdentifiantInterne: "COL-2026-0004", Nom: "Diabaté", Prenoms: "Mariam", DateNaissance: &dates[3], LieuNaissance: "Grand-Bassam", Sexe: models.SexeF, Categorie: models.CategorieAffecte, Statut: models.StatutEleveActif, TuteurID: &tuteurs[3].ID},
                {EtablissementID: college.ID, MatriculeMinistere: "CI-00245-MEN-005", IdentifiantInterne: "COL-2026-0005", Nom: "Yapi", Prenoms: "Olivier", DateNaissance: &dates[4], LieuNaissance: "Dabou", Sexe: models.SexeM, Categorie: models.CategorieNonAffecte, Statut: models.StatutEleveActif, TuteurID: &tuteurs[4].ID},
        }

        // ===== Élèves de l'EPV (préscolaire/primaire — catégorie NON_APPLICABLE) =====
        elevesEPV := []models.Eleve{
                {EtablissementID: epv.ID, IdentifiantInterne: "EPV-2026-0001", Nom: "Kouassi", Prenoms: "Sarah", DateNaissance: &dates[0], LieuNaissance: "Dabou", Sexe: models.SexeF, Categorie: models.CategorieNonApplicable, Statut: models.StatutEleveActif, TuteurID: &tuteurs[0].ID},
                {EtablissementID: epv.ID, IdentifiantInterne: "EPV-2026-0002", Nom: "Traoré", Prenoms: "Ibrahim", DateNaissance: &dates[1], LieuNaissance: "Abidjan", Sexe: models.SexeM, Categorie: models.CategorieNonApplicable, Statut: models.StatutEleveActif, TuteurID: &tuteurs[1].ID},
                {EtablissementID: epv.ID, IdentifiantInterne: "EPV-2026-0003", Nom: "Brou", Prenoms: "Grace", DateNaissance: &dates[2], LieuNaissance: "Dabou", Sexe: models.SexeF, Categorie: models.CategorieNonApplicable, Statut: models.StatutEleveActif, TuteurID: &tuteurs[2].ID},
        }

        // Création des élèves avec récupération des IDs générés
        createEleveWithVector := func(e *models.Eleve) {
                e.ID = uuid.New()
                e.SearchVector = utils.BuildSearchVector(e.Nom, e.Prenoms, e.MatriculeMinistere, e.IdentifiantInterne)
                if err := db.Create(e).Error; err != nil {
                        log.Printf("  ⚠ création élève %s %s: %v", e.Nom, e.Prenoms, err)
                }
        }
        for i := range elevesCollege {
                createEleveWithVector(&elevesCollege[i])
        }
        for i := range elevesEPV {
                createEleveWithVector(&elevesEPV[i])
        }
        totalEleves := len(elevesCollege) + len(elevesEPV)
        log.Printf("  + %d élèves créés (%d collège + %d EPV)", totalEleves, len(elevesCollege), len(elevesEPV))

        // ===== Inscriptions pour l'année active =====
        // Premier cycle : Yann(6e 1), Awa(6e 1), David(3e 1), Mariam(3e 1)
        // Second cycle : Olivier(Terminale D 1)
        inscriptions := []models.Inscription{
                {EleveID: elevesCollege[0].ID, EtablissementID: college.ID, ClasseID: classe6e1.ID, AnneeScolaireID: annee.ID, DateInscription: time.Now(), Statut: models.StatutInscrit},
                {EleveID: elevesCollege[1].ID, EtablissementID: college.ID, ClasseID: classe6e1.ID, AnneeScolaireID: annee.ID, DateInscription: time.Now(), Statut: models.StatutInscrit, DerogationInscription: true, MotifDerogation: "Raison sociale — échelonnement accordé"},
                {EleveID: elevesCollege[2].ID, EtablissementID: college.ID, ClasseID: classe3e1.ID, AnneeScolaireID: annee.ID, DateInscription: time.Now(), Statut: models.StatutInscrit},
                {EleveID: elevesCollege[3].ID, EtablissementID: college.ID, ClasseID: classe3e1.ID, AnneeScolaireID: annee.ID, DateInscription: time.Now(), Statut: models.StatutInscrit},
                {EleveID: elevesCollege[4].ID, EtablissementID: college.ID, ClasseID: classeTermD1.ID, AnneeScolaireID: annee.ID, DateInscription: time.Now(), Statut: models.StatutInscrit},
                // EPV : Sarah(CP1), Ibrahim(CP1), Grace(CM2)
                {EleveID: elevesEPV[0].ID, EtablissementID: epv.ID, ClasseID: classeCP1.ID, AnneeScolaireID: annee.ID, DateInscription: time.Now(), Statut: models.StatutInscrit},
                {EleveID: elevesEPV[1].ID, EtablissementID: epv.ID, ClasseID: classeCP1.ID, AnneeScolaireID: annee.ID, DateInscription: time.Now(), Statut: models.StatutInscrit},
                {EleveID: elevesEPV[2].ID, EtablissementID: epv.ID, ClasseID: classeCM2.ID, AnneeScolaireID: annee.ID, DateInscription: time.Now(), Statut: models.StatutInscrit},
        }
        for i := range inscriptions {
                inscriptions[i].ID = uuid.New()
                db.Create(&inscriptions[i])
        }
        log.Printf("  + %d inscriptions créées", len(inscriptions))
}

func mustDate(s string) time.Time {
        t, err := time.Parse("2006-01-02", s)
        if err != nil {
                log.Fatalf("date invalide %s: %v", s, err)
        }
        return t
}

// AssertEtablissementExists est un helper pour vérifier qu'un établissement existe.
func AssertEtablissementExists(db *gorm.DB, id uuid.UUID) bool {
        var count int64
        db.Model(&models.Etablissement{}).Where("id = ?", id).Count(&count)
        return count > 0
}
