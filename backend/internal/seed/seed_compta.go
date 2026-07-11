package seed

import (
	"log"

	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
	"github.com/scolagest/backend/internal/services"
	"github.com/scolagest/backend/internal/utils"
)

// SeedCompta génère les écritures comptables pour les paiements existants.
// À appeler après SeedPaiements.
func SeedCompta() {
	db := database.DB

	var count int64
	db.Model(&models.EcritureComptable{}).Count(&count)
	if count > 0 {
		log.Printf("  ℹ %d écritures comptables déjà présentes — seed compta ignoré", count)
		return
	}

	// Créer le service comptabilité
	comptaSvc := services.NewComptaService()

	// Récupérer tous les paiements validés
	var paiements []models.Paiement
	db.Where("statut = ?", models.StatutPaiementValide).Find(&paiements)

	if len(paiements) == 0 {
		log.Println("  ℹ Aucun paiement validé — seed compta ignoré")
		return
	}

	// ID utilisateur système pour les écritures
	systemUserID := utils.GetSystemUserID()

	generated := 0
	for _, p := range paiements {
		// GenerateEcritureFromPaiement crée : exercice + journaux + comptes + écriture + lignes
		if err := comptaSvc.GenerateEcritureFromPaiement(&p, systemUserID); err != nil {
			log.Printf("  ⚠ écriture pour paiement %s: %v", p.NumeroRecu, err)
			continue
		}
		generated++
	}

	log.Printf("  + %d écritures comptables générées (exercices, journaux, comptes auto-créés)", generated)
}
