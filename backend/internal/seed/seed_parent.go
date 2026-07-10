package seed

import (
	"log"

	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
	"github.com/scolagest/backend/internal/utils"
	"gorm.io/gorm"
)

// SeedParent crée un compte parent de démonstration lié au tuteur Kouassi Jean
// (qui a 2 enfants : Yann au collège et Sarah à l'EPV).
// Idempotent.
func SeedParent() {
	db := database.DB

	// Vérifier si le parent existe déjà
	var count int64
	db.Model(&models.Utilisateur{}).Where("email = ?", "parent@scolagest.ci").Count(&count)
	if count > 0 {
		log.Printf("  ℹ parent@scolagest.ci déjà présent — seed parent ignoré")
		return
	}

	// Récupérer le tuteur Kouassi Jean
	var tuteur models.Tuteur
	if err := db.Where("nom = ? AND prenoms = ?", "Kouassi", "Jean").First(&tuteur).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			log.Println("  ⚠ tuteur Kouassi Jean introuvable — seed parent ignoré")
			return
		}
		return
	}

	// Créer le compte parent
	hash, _ := utils.HashPassword("parent123")
	roleParent := models.RoleParent
	parent := models.Utilisateur{
		BaseModel:    models.BaseModel{ID: uuid.New()},
		Nom:          tuteur.Nom,
		Prenoms:      tuteur.Prenoms,
		Email:        "parent@scolagest.ci",
		MotDePasseHash: hash,
		RoleGlobal:   &roleParent,
		TuteurID:     &tuteur.ID,
		Statut:       models.StatutUserActif,
	}
	if err := db.Create(&parent).Error; err != nil {
		log.Printf("  ⚠ création parent: %v", err)
		return
	}
	log.Printf("  + Utilisateur parent: parent@scolagest.ci (Tuteur: %s %s) — mot de passe: parent123", tuteur.Nom, tuteur.Prenoms)
}
