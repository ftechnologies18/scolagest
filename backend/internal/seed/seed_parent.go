package seed

import (
	"log"
	"math/rand"

	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
	"github.com/scolagest/backend/internal/utils"
	"gorm.io/gorm"
)

// SeedParent génère des codes PIN pour les tuteurs existants (accès portail parent).
// Le compte utilisateur parent@scolagest.ci est supprimé (le parent n'est plus
// un utilisateur du RBAC mais un utilisateur temporaire via téléphone + PIN).
// Idempotent : ne regénère pas les PIN existants.
func SeedParent() {
	db := database.DB

	// 1. Supprimer l'ancien compte utilisateur parent (n'est plus un rôle RBAC)
	db.Where("email = ?", "parent@scolagest.ci").Delete(&models.Utilisateur{})
	log.Println("  + Ancien compte parent@scolagest.ci supprimé (rôle PARENT retiré du RBAC)")

	// 2. Générer des PIN pour les tuteurs qui n'en ont pas
	var tuteurs []models.Tuteur
	db.Find(&tuteurs)
	pinCount := 0
	for i := range tuteurs {
		if tuteurs[i].PinHash == "" {
			pin := generateDemoPin(i)
			hash, _ := utils.HashPassword(pin)
			tuteurs[i].PinHash = hash
			db.Model(&tuteurs[i]).Update("pin_hash", hash)
			log.Printf("  + PIN généré pour %s %s (%s): %s", tuteurs[i].Nom, tuteurs[i].Prenoms, tuteurs[i].Telephone, pin)
			pinCount++
		}
	}
	if pinCount > 0 {
		log.Printf("  + %d PIN générés pour les tuteurs", pinCount)
	} else {
		log.Println("  ℹ Tous les tuteurs ont déjà un PIN — génération ignorée")
	}
}

// generateDemoPin génère un PIN déterministe pour la démo.
// Tuteur 0 (Kouassi Jean, +225 0701020304) → PIN 1234
// Tuteur 1 (Traoré Aminata, +225 0505060708) → PIN 2345
// etc.
func generateDemoPin(index int) string {
	pins := []string{"1234", "2345", "3456", "4567", "5678"}
	if index < len(pins) {
		return pins[index]
	}
	return "9999"
}

// keep import for random (unused but may be needed later)
var _ = rand.Intn
var _ = uuid.New
var _ = gorm.ErrRecordNotFound
