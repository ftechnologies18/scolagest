package seed

import (
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
	"gorm.io/gorm"
)

// SeedSaasBilling crée les plans d'abonnement SaaS et les abonnements de démo.
// Idempotent.
func SeedSaasBilling() {
	db := database.DB

	var count int64
	db.Model(&models.SaaPlan{}).Count(&count)
	if count > 0 {
		log.Printf("  ℹ %d plans SaaS déjà présents — seed ignoré", count)
		return
	}

	// ===== Plans =====
	plans := []models.SaaPlan{
		{Code: "BASIC", Nom: "Basique", Description: "Pour les petites écoles (< 200 élèves)", PrixMensuel: 25000, PrixAnnuel: 250000, NbElevesMax: 200, NbUsersMax: 5, Actif: true},
		{Code: "PRO", Nom: "Professionnel", Description: "Pour les établissements moyens (200-1000 élèves)", PrixMensuel: 50000, PrixAnnuel: 500000, NbElevesMax: 1000, NbUsersMax: 20, Actif: true},
		{Code: "ENTERPRISE", Nom: "Entreprise", Description: "Pour les groupes scolaires (+1000 élèves)", PrixMensuel: 100000, PrixAnnuel: 1000000, NbElevesMax: 0, NbUsersMax: 0, Actif: true},
	}
	for i := range plans {
		plans[i].ID = uuid.New()
		db.Create(&plans[i])
		log.Printf("  + Plan: %s (%s) — %v FCFA/mois", plans[i].Nom, plans[i].Code, plans[i].PrixMensuel)
	}

	// ===== Abonnements de démo =====
	var college, epv models.Etablissement
	db.Where("code_officiel = ?", "013062").First(&college)
	db.Where("code_officiel = ?", "0103105091").First(&epv)

	// Collège → plan PRO (mensuel, essai 14 jours)
	var planPro models.SaaPlan
	db.Where("code = ?", "PRO").First(&planPro)
	now := time.Now()
	finEssai := now.AddDate(0, 0, 14)
	db.Create(&models.SaaSubscription{
		EtablissementID:  college.ID,
		PlanID:           planPro.ID,
		Statut:           models.SubTrialing,
		CycleFacturation: "MONTHLY",
		DateDebut:        now,
		DateFinEssai:     &finEssai,
		ProchaineFacture: finEssai,
		AutoRenouvellement: true,
	})
	log.Printf("  + Abonnement Collège → PRO (essai 14j)")

	// EPV → plan BASIC (annuel, actif)
	var planBasic models.SaaPlan
	db.Where("code = ?", "BASIC").First(&planBasic)
	db.Create(&models.SaaSubscription{
		EtablissementID:  epv.ID,
		PlanID:           planBasic.ID,
		Statut:           models.SubActive,
		CycleFacturation: "YEARLY",
		DateDebut:        now.AddDate(0, -2, 0), // commencé il y a 2 mois
		ProchaineFacture: now.AddDate(0, 10, 0), // prochaine dans 10 mois
		AutoRenouvellement: true,
	})
	log.Printf("  + Abonnement EPV → BASIC (annuel, actif)")

	// ===== Facture de démo (EPV — payée) =====
	db.Create(&models.SaaInvoice{
		SubscriptionID:  uuid.Nil, // sera mis à jour
		EtablissementID:  epv.ID,
		Numero:           "INV-2026-0001",
		PeriodeDebut:     now.AddDate(0, -2, 0),
		PeriodeFin:       now.AddDate(0, 10, 0),
		MontantHT:        planBasic.PrixAnnuel,
		MontantTTC:       planBasic.PrixAnnuel,
		Statut:           models.InvoicePaid,
		DateEmission:     now.AddDate(0, -2, 0),
		DateEcheance:     now.AddDate(0, -2, 0).AddDate(0, 0, 15),
		ModePaiement:     "MOBILE_MONEY",
		ReferencePaiement: "ORANGE-INV001",
	})
	// Mettre à jour la date de paiement
	var inv models.SaaInvoice
	db.Where("numero = ?", "INV-2026-0001").First(&inv)
	paidDate := now.AddDate(0, -2, 0).AddDate(0, 0, 3)
	db.Model(&inv).Update("date_paiement", paidDate)
	// Lier à l'abonnement EPV
	var subEPV models.SaaSubscription
	db.Where("etablissement_id = ?", epv.ID).First(&subEPV)
	db.Model(&inv).Update("subscription_id", subEPV.ID)
	log.Printf("  + Facture INV-2026-0001 (EPV, %v FCFA, PAYÉE)", planBasic.PrixAnnuel)

	_ = gorm.ErrRecordNotFound
}
