package models

import (
	"time"

	"github.com/google/uuid"
)

// ===== Domaine 10 — Paie enseignants (Phase C) =====

// StatutBulletin : cycle de vie d'un bulletin de paie.
type StatutBulletin string

const (
	StatutBulletinBrouillon StatutBulletin = "BROUILLON"
	StatutBulletinValide    StatutBulletin = "VALIDE"
	StatutBulletinPaye      StatutBulletin = "PAYE"
)

// StatutAvance : statut d'une avance sur salaire.
type StatutAvance string

const (
	StatutAvanceDemandee  StatutAvance = "DEMANDEE"
	StatutAvanceApprouvee StatutAvance = "APPROUVEE"
	StatutAvanceRejetee   StatutAvance = "REJETEE"
	StatutAvanceDeduite   StatutAvance = "DEDUITE" // déduite d'un bulletin
)

// BulletinPaie : bulletin mensuel d'un enseignant, calculé automatiquement
// depuis les pointages validés du mois.
//
// Workflow : BROUILLON (généré auto) → VALIDE (direction valide) → PAYE (paiement effectué)
type BulletinPaie struct {
	BaseModel
	EtablissementID uuid.UUID    `gorm:"type:uuid;index;not null" json:"etablissement_id"`
	Etablissement   *Etablissement `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
	EnseignantID    uuid.UUID    `gorm:"type:uuid;index;not null" json:"enseignant_id"`
	Enseignant      *Enseignant  `gorm:"foreignKey:EnseignantID" json:"enseignant,omitempty"`
	AnneeScolaireID uuid.UUID    `gorm:"type:uuid;index;not null" json:"annee_scolaire_id"`
	AnneeScolaire   *AnneeScolaire `gorm:"foreignKey:AnneeScolaireID" json:"annee_scolaire,omitempty"`
	// Période
	Mois int `gorm:"not null" json:"mois"`   // 1-12
	Annee int `gorm:"not null" json:"annee"` // ex: 2026
	// Heures (calculées depuis les pointages validés)
	HeuresPointees    float64 `gorm:"type:decimal(6,2)" json:"heures_pointees"`     // heures réellement pointées
	HeuresPlanifiees  float64 `gorm:"type:decimal(6,2)" json:"heures_planifiees"`   // heures théoriques (volume hebdo × semaines)
	NbSessionsPointees int    `json:"nb_sessions_pointees"`
	NbSessionsTotal    int    `json:"nb_sessions_total"`
	// Taux & salaire
	TauxHoraireMoyen float64 `gorm:"type:decimal(14,2)" json:"taux_horaire_moyen"` // moyenne pondérée des taux par matière
	SalaireBrut      float64 `gorm:"type:decimal(14,2)" json:"salaire_brut"`      // heures pointées × taux moyen
	// Retenues (avances déduites ce mois + cotisations optionnelles)
	TotalAvances     float64 `gorm:"type:decimal(14,2);default:0" json:"total_avances"` // somme des avances déduites
	Cotisations      float64 `gorm:"type:decimal(14,2);default:0" json:"cotisations"`   // CNPS, etc. (saisie manuelle)
	SalaireNet       float64 `gorm:"type:decimal(14,2)" json:"salaire_net"`            // brut - avances - cotisations
	// Statut & validation
	Statut           StatutBulletin `gorm:"not null;default:BROUILLON;index" json:"statut"`
	ValidePar        *uuid.UUID     `gorm:"type:uuid;index" json:"valide_par,omitempty"`
	DateValidation   *time.Time     `json:"date_validation,omitempty"`
	PayePar          *uuid.UUID     `gorm:"type:uuid;index" json:"paye_par,omitempty"`
	DatePaie         *time.Time     `json:"date_paie,omitempty"`
	// Référence paiement (lien caisse si paiement via la caisse)
	ReferencePaiement string `json:"reference_paiement"`
	// PDF généré
	PDFURL           string `json:"pdf_url"`
	Notes            string `json:"notes"`
}

func (BulletinPaie) TableName() string { return "bulletin_paies" }

// AvanceSalaire : avance sur salaire demandée par un enseignant et déduite
// d'un bulletin ultérieur.
type AvanceSalaire struct {
	BaseModel
	EtablissementID uuid.UUID    `gorm:"type:uuid;index;not null" json:"etablissement_id"`
	Etablissement   *Etablissement `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
	EnseignantID    uuid.UUID    `gorm:"type:uuid;index;not null" json:"enseignant_id"`
	Enseignant      *Enseignant  `gorm:"foreignKey:EnseignantID" json:"enseignant,omitempty"`
	Montant         float64      `gorm:"type:decimal(14,2);not null" json:"montant"`
	DateDemande     time.Time    `gorm:"not null" json:"date_demande"`
	DateVersement   *time.Time   `json:"date_versement,omitempty"` // quand l'argent a été versé
	Motif           string       `json:"motif"`
	Statut          StatutAvance `gorm:"not null;default:DEMANDEE;index" json:"statut"`
	// Traitement
	ApprouvePar     *uuid.UUID   `gorm:"type:uuid;index" json:"approuve_par,omitempty"`
	DateApprobation *time.Time   `json:"date_approbation,omitempty"`
	MotifRejet      string       `json:"motif_rejet"`
	// Déduction : lien vers le bulletin sur lequel l'avance a été déduite
	BulletinPaieID  *uuid.UUID   `gorm:"type:uuid;index" json:"bulletin_paie_id,omitempty"`
}

func (AvanceSalaire) TableName() string { return "avance_salaires" }
