package seed

import (
        "fmt"
        "log"
        "time"

        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/database"
        "github.com/scolagest/backend/internal/models"
)

// SeedPaiements crée des paiements de démonstration pour que les KPIs et rapports
// soient significatifs. Idempotent : ne recrée pas si des paiements existent déjà.
func SeedPaiements() {
        db := database.DB

        var count int64
        db.Model(&models.Paiement{}).Count(&count)
        if count > 0 {
                log.Printf("  ℹ %d paiements déjà présents — seed paiements ignoré", count)
                return
        }

        var college models.Etablissement
        db.Where("code_officiel = ?", "013062").First(&college)

        var annee models.AnneeScolaire
        db.Where("est_active = ?", true).First(&annee)

        // Récupérer le caissier du collège
        var caissier models.Utilisateur
        db.Where("email = ?", "caissier@scolagest.ci").First(&caissier)

        // Récupérer les élèves du collège
        var eleves []models.Eleve
        db.Where("etablissement_id = ?", college.ID).Find(&eleves)
        if len(eleves) == 0 {
                log.Println("  ⚠ aucun élève collège — seed paiements ignoré")
                return
        }

        // Récupérer les frais du collège
        var fraisList []models.Frais
        db.Where("etablissement_id = ? AND annee_scolaire_id = ?", college.ID, annee.ID).Find(&fraisList)
        fraisByID := make(map[uuid.UUID]models.Frais)
        for _, f := range fraisList {
                fraisByID[f.ID] = f
        }

        // Récupérer les inscriptions
        var inscriptions []models.Inscription
        db.Where("etablissement_id = ?", college.ID).Find(&inscriptions)
        inscByEleve := make(map[uuid.UUID]models.Inscription)
        for _, i := range inscriptions {
                inscByEleve[i.EleveID] = i
        }

        // Générer des paiements réalistes sur les 3 derniers mois
        now := time.Now()
        paiementsCrees := 0

        for _, eleve := range eleves {
                insc, ok := inscByEleve[eleve.ID]
                if !ok {
                        continue
                }

                // Trouver les frais applicables à cet élève (par catégorie)
                for _, f := range fraisList {
                        // Filtrer par catégorie
                        if f.Categorie != nil && *f.Categorie != eleve.Categorie {
                                continue
                        }
                        // Filtrer par cycle : le frais doit correspondre au cycle de la classe
                        if f.CycleID != nil {
                                var classe models.Classe
                                db.First(&classe, "id = ?", insc.ClasseID)
                                if *f.CycleID != classe.CycleID {
                                        continue
                                }
                        }
                        // Filtrer par classe
                        if f.ClasseID != nil && *f.ClasseID != insc.ClasseID {
                                continue
                        }

                        // Récupérer les échéances
                        var echeances []models.Echeance
                        db.Where("frais_id = ? AND eleve_id IS NULL", f.ID).Order("rang").Find(&echeances)

                        if len(echeances) == 0 {
                                continue
                        }

                        // Payer les échéances dont la date limite est passée (simulation réaliste)
                        for i, ech := range echeances {
                                if ech.DateLimite.After(now) {
                                        // Échéance future : ne pas payer (sauf parfois en avance)
                                        if i > 0 && (eleve.Nom == "Kouassi" || eleve.Nom == "Traoré") {
                                                // Kouassi et Traoré payent en avance parfois
                                                createDemoPaiement(db, eleve, insc, college, f, ech, caissier, now.AddDate(0, 0, -2), models.ModeEspeces)
                                                paiementsCrees++
                                        }
                                        continue
                                }
                                // Échéance passée : payer (sauf Brou qui est en retard)
                                if eleve.Nom == "Brou" && i >= 1 {
                                        // Brou est en retard sur les échéances 2+
                                        continue
                                }
                                // Date de paiement : quelques jours après la date limite
                                datePaie := ech.DateLimite.AddDate(0, 0, 3)
                                if datePaie.After(now) {
                                        datePaie = now.AddDate(0, 0, -1)
                                }
                                mode := models.ModeEspeces
                                if i%3 == 1 {
                                        mode = models.ModeMobileMoney
                                } else if i%3 == 2 {
                                        mode = models.ModeCheque
                                }
                                createDemoPaiement(db, eleve, insc, college, f, ech, caissier, datePaie, mode)
                                paiementsCrees++
                        }
                }
        }

        log.Printf("  + %d paiements de démonstration créés", paiementsCrees)
}

func createDemoPaiement(db interface{}, eleve models.Eleve, insc models.Inscription,
        etb models.Etablissement, frais models.Frais, ech models.Echeance,
        caissier models.Utilisateur, datePaie time.Time, mode models.ModePaiement) {

        numeroRecu := generateDemoRecu(etb.CodeOfficiel, datePaie)

        p := models.Paiement{
                EleveID:          eleve.ID,
                InscriptionID:    insc.ID,
                EtablissementID:  etb.ID,
                FraisID:          &frais.ID,
                EcheanceID:       &ech.ID,
                Montant:          ech.Montant,
                ModePaiement:     mode,
                DatePaiement:     datePaie,
                CaissierID:       caissier.ID,
                Statut:           models.StatutPaiementValide,
                NumeroRecu:       numeroRecu,
        }
        database.DB.Create(&p)

        // Créer le reçu
        database.DB.Create(&models.Recu{
                PaiementID:      p.ID,
                Numero:          numeroRecu,
                ContenuSnapshot: "{}",
                DateEmission:    datePaie,
        })
}

func generateDemoRecu(codeOfficiel string, date time.Time) string {
        var count int64
        database.DB.Model(&models.Paiement{}).Count(&count)
        sequence := count + 1
        year := date.Year()
        return fmt.Sprintf("REC-%s-%04d-%06d", codeOfficiel, year, sequence)
}
