package services

import (
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
	"gorm.io/gorm"
)

// SaasBillingService gère la facturation SaaS (plans, abonnements, factures).
type SaasBillingService struct{}

func NewSaasBillingService() *SaasBillingService { return &SaasBillingService{} }

// ===== Plans =====

// ListPlans retourne tous les plans d'abonnement.
func (s *SaasBillingService) ListPlans() ([]models.SaaPlan, error) {
	var plans []models.SaaPlan
	database.DB.Order("prix_mensuel ASC").Find(&plans)
	return plans, nil
}

// PlanDTO pour création/modification.
type PlanDTO struct {
	Code        string  `json:"code"`
	Nom         string  `json:"nom"`
	Description string  `json:"description"`
	PrixMensuel float64 `json:"prix_mensuel"`
	PrixAnnuel  float64 `json:"prix_annuel"`
	NbElevesMax int     `json:"nb_eleves_max"`
	NbUsersMax  int     `json:"nb_users_max"`
	Actif       bool    `json:"actif"`
}

// CreatePlan crée un plan d'abonnement.
func (s *SaasBillingService) CreatePlan(dto PlanDTO) (*models.SaaPlan, error) {
	if dto.Code == "" || dto.Nom == "" {
		return nil, errors.New("code et nom obligatoires")
	}
	plan := models.SaaPlan{
		Code:        dto.Code,
		Nom:         dto.Nom,
		Description: dto.Description,
		PrixMensuel: dto.PrixMensuel,
		PrixAnnuel:  dto.PrixAnnuel,
		NbElevesMax: dto.NbElevesMax,
		NbUsersMax:  dto.NbUsersMax,
		Actif:       true,
	}
	if err := database.DB.Create(&plan).Error; err != nil {
		return nil, err
	}
	return &plan, nil
}

// UpdatePlan modifie un plan.
func (s *SaasBillingService) UpdatePlan(id uuid.UUID, dto PlanDTO) (*models.SaaPlan, error) {
	var plan models.SaaPlan
	if err := database.DB.First(&plan, "id = ?", id).Error; err != nil {
		return nil, errors.New("plan introuvable")
	}
	database.DB.Model(&plan).Updates(map[string]interface{}{
		"nom":          dto.Nom,
		"description":  dto.Description,
		"prix_mensuel": dto.PrixMensuel,
		"prix_annuel":  dto.PrixAnnuel,
		"nb_eleves_max": dto.NbElevesMax,
		"nb_users_max":  dto.NbUsersMax,
		"actif":         dto.Actif,
	})
	database.DB.First(&plan, "id = ?", id)
	return &plan, nil
}

// ===== Abonnements =====

// SubscriptionDTO pour créer/modifier un abonnement.
type SubscriptionDTO struct {
	EtablissementID  uuid.UUID `json:"etablissement_id"`
	PlanID           uuid.UUID `json:"plan_id"`
	CycleFacturation string    `json:"cycle_facturation"` // MONTHLY | YEARLY
	DureeEssaiJours  int       `json:"duree_essai_jours"` // 0 = pas d'essai
}

// CreateSubscription crée un abonnement pour un établissement.
func (s *SaasBillingService) CreateSubscription(dto SubscriptionDTO) (*models.SaaSubscription, error) {
	// Vérifier qu'il n'y a pas déjà un abonnement actif
	var count int64
	database.DB.Model(&models.SaaSubscription{}).
		Where("etablissement_id = ? AND statut IN ?", dto.EtablissementID,
			[]models.StatutSubscription{models.SubActive, models.SubTrialing}).Count(&count)
	if count > 0 {
		return nil, errors.New("cet établissement a déjà un abonnement actif")
	}

	// Vérifier le plan
	var plan models.SaaPlan
	if err := database.DB.First(&plan, "id = ?", dto.PlanID).Error; err != nil {
		return nil, errors.New("plan introuvable")
	}

	now := time.Now()
	sub := models.SaaSubscription{
		EtablissementID:  dto.EtablissementID,
		PlanID:           dto.PlanID,
		Statut:           models.SubTrialing,
		CycleFacturation: dto.CycleFacturation,
		DateDebut:        now,
		AutoRenouvellement: true,
	}

	if dto.DureeEssaiJours > 0 {
		finEssai := now.AddDate(0, 0, dto.DureeEssaiJours)
		sub.DateFinEssai = &finEssai
		sub.ProchaineFacture = finEssai
	} else {
		sub.Statut = models.SubActive
		if dto.CycleFacturation == "YEARLY" {
			sub.ProchaineFacture = now.AddDate(1, 0, 0)
		} else {
			sub.ProchaineFacture = now.AddDate(0, 1, 0)
		}
	}

	if err := database.DB.Create(&sub).Error; err != nil {
		return nil, err
	}
	return &sub, nil
}

// ListSubscriptions retourne tous les abonnements.
func (s *SaasBillingService) ListSubscriptions() ([]models.SaaSubscription, error) {
	var subs []models.SaaSubscription
	database.DB.Preload("Etablissement").Preload("Plan").Order("date_debut DESC").Find(&subs)
	return subs, nil
}

// GetSubscription retourne l'abonnement d'un établissement.
func (s *SaasBillingService) GetSubscription(etablissementID uuid.UUID) (*models.SaaSubscription, error) {
	var sub models.SaaSubscription
	if err := database.DB.Preload("Plan").Preload("Etablissement").
		Where("etablissement_id = ?", etablissementID).
		Order("date_debut DESC").First(&sub).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &sub, nil
}

// CancelSubscription annule un abonnement.
func (s *SaasBillingService) CancelSubscription(id uuid.UUID) (*models.SaaSubscription, error) {
	var sub models.SaaSubscription
	if err := database.DB.First(&sub, "id = ?", id).Error; err != nil {
		return nil, errors.New("abonnement introuvable")
	}
	database.DB.Model(&sub).Updates(map[string]interface{}{
		"statut":             models.SubCancelled,
		"auto_renouvellement": false,
	})
	database.DB.First(&sub, "id = ?", id)
	return &sub, nil
}

// ===== Factures =====

// GenerateInvoice génère une facture pour un abonnement.
func (s *SaasBillingService) GenerateInvoice(subID uuid.UUID) (*models.SaaInvoice, error) {
	var sub models.SaaSubscription
	if err := database.DB.Preload("Plan").First(&sub, "id = ?", subID).Error; err != nil {
		return nil, errors.New("abonnement introuvable")
	}

	// Calculer le montant
	montant := sub.Plan.PrixMensuel
	periodeDebut := time.Now()
	var periodeFin time.Time
	if sub.CycleFacturation == "YEARLY" {
		montant = sub.Plan.PrixAnnuel
		periodeFin = periodeDebut.AddDate(1, 0, 0)
	} else {
		periodeFin = periodeDebut.AddDate(0, 1, 0)
	}

	// Générer le numéro de facture
	var count int64
	database.DB.Model(&models.SaaInvoice{}).Count(&count)
	numero := fmt.Sprintf("INV-%d-%04d", time.Now().Year(), count+1)

	inv := models.SaaInvoice{
		SubscriptionID: subID,
		EtablissementID: sub.EtablissementID,
		Numero:         numero,
		PeriodeDebut:   periodeDebut,
		PeriodeFin:     periodeFin,
		MontantHT:      montant,
		TauxTVA:        0, // 0% — services digitaux en CI
		MontantTVA:     0,
		MontantTTC:     montant,
		Statut:         models.InvoiceSent,
		DateEmission:   periodeDebut,
		DateEcheance:   periodeDebut.AddDate(0, 0, 15), // 15 jours pour payer
	}
	if err := database.DB.Create(&inv).Error; err != nil {
		return nil, err
	}

	// Mettre à jour la prochaine facture
	nextDate := periodeFin
	database.DB.Model(&sub).Update("prochaine_facture", nextDate)

	return &inv, nil
}

// ListInvoices retourne les factures (filtrables par établissement/statut).
func (s *SaasBillingService) ListInvoices(etablissementID *uuid.UUID, statut *models.StatutInvoice) ([]models.SaaInvoice, error) {
	q := database.DB.Model(&models.SaaInvoice{}).
		Preload("Etablissement").Preload("Subscription.Plan")
	if etablissementID != nil {
		q = q.Where("etablissement_id = ?", *etablissementID)
	}
	if statut != nil {
		q = q.Where("statut = ?", *statut)
	}
	var invoices []models.SaaInvoice
	q.Order("date_emission DESC").Find(&invoices)
	return invoices, nil
}

// PayInvoice marque une facture comme payée.
func (s *SaasBillingService) PayInvoice(id uuid.UUID, modePaiement, reference string) (*models.SaaInvoice, error) {
	var inv models.SaaInvoice
	if err := database.DB.First(&inv, "id = ?", id).Error; err != nil {
		return nil, errors.New("facture introuvable")
	}
	now := time.Now()
	database.DB.Model(&inv).Updates(map[string]interface{}{
		"statut":             models.InvoicePaid,
		"date_paiement":      now,
		"mode_paiement":      modePaiement,
		"reference_paiement": reference,
	})

	// Réactiver l'abonnement si nécessaire
	var sub models.SaaSubscription
	database.DB.First(&sub, "id = ?", inv.SubscriptionID)
	if sub.Statut == models.SubPastDue || sub.Statut == models.SubSuspended {
		database.DB.Model(&sub).Update("statut", models.SubActive)
	}

	database.DB.First(&inv, "id = ?", id)
	return &inv, nil
}

// ===== Dashboard facturation =====

// BillingStats représente les statistiques de facturation SaaS.
type BillingStats struct {
	RevenuMensuel      float64 `json:"revenu_mensuel"`
	RevenuAnnuel       float64 `json:"revenu_annuel"`
	RevenuEnAttente    float64 `json:"revenu_en_attente"`  // factures impayées
	NbAbonnementsActifs int64  `json:"nb_abonnements_actifs"`
	NbAbonnementsEssai  int64  `json:"nb_abonnements_essai"`
	NbFacturesImpayees  int64  `json:"nb_factures_impayees"`
	NbFacturesPayees    int64  `json:"nb_factures_payees"`
}

// GetBillingStats calcule les statistiques de facturation.
func (s *SaasBillingService) GetBillingStats() (*BillingStats, error) {
	stats := &BillingStats{}

	// Abonnements
	database.DB.Model(&models.SaaSubscription{}).Where("statut = ?", models.SubActive).Count(&stats.NbAbonnementsActifs)
	database.DB.Model(&models.SaaSubscription{}).Where("statut = ?", models.SubTrialing).Count(&stats.NbAbonnementsEssai)

	// Revenu mensuel (somme des factures payées ce mois)
	now := time.Now()
	startMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	database.DB.Model(&models.SaaInvoice{}).
		Where("statut = ? AND date_paiement >= ?", models.InvoicePaid, startMonth).
		Select("COALESCE(SUM(montant_ttc), 0)").Scan(&stats.RevenuMensuel)

	// Revenu annuel
	startYear := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
	database.DB.Model(&models.SaaInvoice{}).
		Where("statut = ? AND date_paiement >= ?", models.InvoicePaid, startYear).
		Select("COALESCE(SUM(montant_ttc), 0)").Scan(&stats.RevenuAnnuel)

	// Revenu en attente (factures impayées)
	database.DB.Model(&models.SaaInvoice{}).
		Where("statut IN ?", []models.StatutInvoice{models.InvoiceSent, models.InvoiceOverdue}).
		Select("COALESCE(SUM(montant_ttc), 0)").Scan(&stats.RevenuEnAttente)

	// Compteurs factures
	database.DB.Model(&models.SaaInvoice{}).Where("statut = ?", models.InvoicePaid).Count(&stats.NbFacturesPayees)
	database.DB.Model(&models.SaaInvoice{}).Where("statut IN ?", []models.StatutInvoice{models.InvoiceSent, models.InvoiceOverdue}).Count(&stats.NbFacturesImpayees)

	return stats, nil
}
