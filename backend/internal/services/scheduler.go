package services

import (
	"log"
	"time"

	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
)

// Scheduler gère l'auto-génération nocturne des sessions de cours.
// Chaque nuit à 3h00 du matin (heure locale du serveur), il génère les
// SessionCours du lendemain pour tous les établissements actifs, en lisant
// l'emploi du temps réel (CreneauEmploiTemps).
//
// Fonctionnement :
// - Un goroutine tourne en arrière-plan avec un ticker qui se déclenche
//   toutes les heures.
// - À 3h00, il récupère tous les établissements actifs et génère les
//   sessions du lendemain pour chacun.
// - Un flag "dernière exécution" évite les double-exécutions la même nuit.
//
// Si le serveur redémarre, le scheduler reprend automatiquement (le flag
// est en mémoire, donc au pire il régénère — mais GenerateSessionsFromDate
// est idempotent grâce à la vérification existingCount).
type Scheduler struct {
	edtSvc       *EmploiTempsService
	lastRunDate  string // YYYY-MM-DD de la dernière exécution (évite double-run)
	stopChan     chan struct{}
}

// NewScheduler construit un nouveau scheduler.
func NewScheduler(edtSvc *EmploiTempsService) *Scheduler {
	return &Scheduler{
		edtSvc:   edtSvc,
		stopChan: make(chan struct{}),
	}
}

// Start lance le scheduler en arrière-plan. Non bloquant.
func (s *Scheduler) Start() {
	go s.run()
	log.Println("🕐 Scheduler démarré — auto-génération des sessions à 3h00 chaque nuit")
}

// Stop arrête le scheduler proprement.
func (s *Scheduler) Stop() {
	close(s.stopChan)
	log.Println("🕐 Scheduler arrêté")
}

// run est la boucle principale du scheduler. Se déclenche toutes les heures
// et exécute la génération à 3h00.
func (s *Scheduler) run() {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopChan:
			return
		case now := <-ticker.C:
			s.checkAndRun(now)
		}
	}
}

// checkAndRun vérifie s'il est 3h00 (±1h) et si la génération n'a pas déjà
// été faite aujourd'hui. Si oui, génère les sessions du lendemain.
func (s *Scheduler) checkAndRun(now time.Time) {
	hour := now.Hour()
	today := now.Format("2006-01-02")

	// Fenêtre d'exécution : entre 3h00 et 3h59
	if hour != 3 {
		return
	}

	// Éviter la double-exécution le même jour
	if s.lastRunDate == today {
		return
	}
	s.lastRunDate = today

	log.Printf("🕐 [%s] Démarrage de l'auto-génération des sessions du lendemain...", now.Format("2006-01-02 15:04:05"))

	// Date du lendemain
	demain := now.AddDate(0, 0, 1)

	// RLS bypass : le scheduler est un task background (pas de contexte utilisateur).
	// On définit app.is_super_admin=true pour que les policies RLS laissent passer.
	database.DB.Exec("SELECT set_config('app.is_super_admin', 'true', false)")

	// Récupérer tous les établissements actifs
	var etablissements []models.Etablissement
	if err := database.Current().Where("actif = ?", true).Find(&etablissements).Error; err != nil {
		log.Printf("🕐 ❌ Erreur récupération établissements: %v", err)
		return
	}

	totalSessions := 0
	for _, etb := range etablissements {
		count, err := s.edtSvc.GenerateSessionsFromDate(etb.ID, demain)
		if err != nil {
			log.Printf("🕐 ❌ Erreur génération sessions pour %s: %v", etb.Nom, err)
			continue
		}
		if count > 0 {
			log.Printf("🕐 ✅ %s : %d session(s) générée(s) pour le %s", etb.Nom, count, demain.Format("2006-01-02"))
		}
		totalSessions += count
	}

	log.Printf("🕐 [%s] Auto-génération terminée — %d session(s) au total pour le %s",
		now.Format("2006-01-02 15:04:05"), totalSessions, demain.Format("2006-01-02"))
}

// RunOnce exécute la génération manuellement (pour test ou rattrapage).
// Génère les sessions pour une date donnée (défaut = demain).
func (s *Scheduler) RunOnce(targetDate time.Time) (int, error) {
	// RLS bypass : task background sans contexte utilisateur.
	database.DB.Exec("SELECT set_config('app.is_super_admin', 'true', false)")

	var etablissements []models.Etablissement
	if err := database.Current().Where("actif = ?", true).Find(&etablissements).Error; err != nil {
		return 0, err
	}

	total := 0
	for _, etb := range etablissements {
		count, err := s.edtSvc.GenerateSessionsFromDate(etb.ID, targetDate)
		if err != nil {
			log.Printf("🕐 ❌ Erreur manuelle pour %s: %v", etb.Nom, err)
			continue
		}
		total += count
	}

	log.Printf("🕐 Génération manuelle — %d session(s) pour le %s", total, targetDate.Format("2006-01-02"))
	return total, nil
}

// GetLastRunDate retourne la date de la dernière exécution (pour affichage
// dans un endpoint de statut).
func (s *Scheduler) GetLastRunDate() string {
	return s.lastRunDate
}
