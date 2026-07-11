package models

import (
        "time"

        "github.com/google/uuid"
)

// ===== Domaine SaaS — Facturation multi-tenant =====

// SaaPlan : plan d'abonnement SaaS (Basic, Pro, Enterprise).
type SaaPlan struct {
        BaseModel
        Code          string  `gorm:"uniqueIndex;not null" json:"code"`           // BASIC, PRO, ENTERPRISE
        Nom           string  `gorm:"not null" json:"nom"`                         // "Basique", "Professionnel", "Entreprise"
        Description   string  `json:"description"`
        PrixMensuel   float64 `gorm:"type:decimal(14,2);not null" json:"prix_mensuel"`
        PrixAnnuel    float64 `gorm:"type:decimal(14,2);not null" json:"prix_annuel"`
        NbElevesMax   int     `gorm:"not null;default:0" json:"nb_eleves_max"`    // 0 = illimité
        NbUsersMax    int     `gorm:"not null;default:0" json:"nb_users_max"`     // 0 = illimité
        Actif         bool    `gorm:"not null;default:true" json:"actif"`
}

func (SaaPlan) TableName() string { return "saa_plans" }

// StatutSubscription : état d'un abonnement.
type StatutSubscription string

const (
        SubActive    StatutSubscription = "ACTIVE"
        SubTrialing  StatutSubscription = "TRIALING"
        SubPastDue   StatutSubscription = "PAST_DUE"
        SubCancelled StatutSubscription = "CANCELLED"
        SubSuspended StatutSubscription = "SUSPENDED"
)

// SaaSubscription : abonnement d'un établissement à un plan.
type SaaSubscription struct {
        BaseModel
        EtablissementID  uuid.UUID          `gorm:"type:uuid;uniqueIndex;not null" json:"etablissement_id"`
        Etablissement    *Etablissement     `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
        PlanID           uuid.UUID          `gorm:"type:uuid;index;not null" json:"plan_id"`
        Plan             *SaaPlan           `gorm:"foreignKey:PlanID" json:"plan,omitempty"`
        Statut           StatutSubscription `gorm:"not null;default:TRIALING" json:"statut"`
        CycleFacturation string             `gorm:"not null;default:MONTHLY" json:"cycle_facturation"` // MONTHLY | YEARLY
        DateDebut        time.Time          `gorm:"not null" json:"date_debut"`
        DateFinEssai     *time.Time         `json:"date_fin_essai"`     // période d'essai
        ProchaineFacture time.Time          `gorm:"not null" json:"prochaine_facture"`
        AutoRenouvellement bool             `gorm:"not null;default:true" json:"auto_renouvellement"`
}

func (SaaSubscription) TableName() string { return "saa_subscriptions" }

// StatutInvoice : état d'une facture.
type StatutInvoice string

const (
        InvoiceDraft    StatutInvoice = "DRAFT"
        InvoiceSent     StatutInvoice = "SENT"
        InvoicePaid     StatutInvoice = "PAID"
        InvoiceOverdue  StatutInvoice = "OVERDUE"
        InvoiceCancelled StatutInvoice = "CANCELLED"
)

// SaaInvoice : facture SaaS pour un établissement.
type SaaInvoice struct {
        BaseModel
        SubscriptionID   uuid.UUID    `gorm:"type:uuid;index;not null" json:"subscription_id"`
        Subscription     *SaaSubscription `gorm:"foreignKey:SubscriptionID" json:"subscription,omitempty"`
        EtablissementID  uuid.UUID    `gorm:"type:uuid;index;not null" json:"etablissement_id"`
        Etablissement    *Etablissement `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
        Numero           string       `gorm:"uniqueIndex;not null" json:"numero"`     // INV-2026-0001
        PeriodeDebut     time.Time    `gorm:"not null" json:"periode_debut"`
        PeriodeFin       time.Time    `gorm:"not null" json:"periode_fin"`
        MontantHT        float64      `gorm:"type:decimal(14,2);not null" json:"montant_ht"`
        TauxTVA          float64      `gorm:"type:decimal(5,2);not null;default:0" json:"taux_tva"` // 0% pour Côte d'Ivoire services digitaux
        MontantTVA       float64      `gorm:"type:decimal(14,2);not null;default:0" json:"montant_tva"`
        MontantTTC       float64      `gorm:"type:decimal(14,2);not null" json:"montant_ttc"`
        Statut           StatutInvoice `gorm:"not null;default:DRAFT" json:"statut"`
        DateEmission     time.Time    `gorm:"not null" json:"date_emission"`
        DateEcheance     time.Time    `gorm:"not null" json:"date_echeance"`
        DatePaiement     *time.Time   `json:"date_paiement"`
        ModePaiement     string       `json:"mode_paiement"` // MOBILE_MONEY, VIREMENT, ESPECES
        ReferencePaiement string      `json:"reference_paiement"`
        Notes            string       `json:"notes"`
}

func (SaaInvoice) TableName() string { return "saa_invoices" }
