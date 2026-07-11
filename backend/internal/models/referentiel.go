package models

import (
        "time"

        "github.com/google/uuid"
)

// ===== Domaine 1 — Référentiel & multi-sites =====

// Etablissement représente une entité administrative du Groupe
// (ex. Collège Privé Le Chandelier, École Primaire Privée Le Chandelier / EPV).
type Etablissement struct {
        BaseModel
        Nom                     string `gorm:"not null" json:"nom"`
        CodeOfficiel            string `gorm:"uniqueIndex;not null" json:"code_officiel"`
        Adresse                 string `json:"adresse"`
        Ville                   string `json:"ville"`
        Telephone               string `json:"telephone"`
        Email                   string `json:"email"`
        AppliqueCategorieAffecte bool  `gorm:"not null;default:false" json:"applique_categorie_affecte"`
        LogoURL                 string `json:"logo_url"`
        CouleurTheme            string `json:"couleur_theme"`
        Actif                   bool   `gorm:"not null;default:true" json:"actif"`
        // QuotaClasse : nombre maximum d'élèves par classe (défaut 45).
        // Quand le quota est atteint, une nouvelle classe est créée automatiquement
        // (ex: 6e A rempli → 6e B créée). Configurable dans les réglages.
        QuotaClasse             int    `gorm:"not null;default:45" json:"quota_classe"`
}

func (Etablissement) TableName() string { return "etablissements" }

// AnneeScolaire représente une année scolaire (calendrier ivoirien : septembre→juillet).
// Commune à tous les établissements.
type AnneeScolaire struct {
        BaseModel
        Libelle    string      `gorm:"uniqueIndex;not null" json:"libelle"`
        DateDebut  time.Time   `gorm:"not null" json:"date_debut"`
        DateFin    time.Time   `gorm:"not null" json:"date_fin"`
        Statut     StatutAnnee `gorm:"not null;default:PREPARATION" json:"statut"`
        EstActive  bool        `gorm:"not null;default:false" json:"est_active"`
}

func (AnneeScolaire) TableName() string { return "annees_scolaires" }

// Cycle représente un cycle scolaire (préscolaire, primaire, collège, lycée)
// rattaché à un établissement.
type Cycle struct {
        BaseModel
        EtablissementID uuid.UUID    `gorm:"type:uuid;index;not null" json:"etablissement_id"`
        Etablissement   *Etablissement `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
        Libelle         LibelleCycle `gorm:"not null" json:"libelle"`
        Ordre           int          `gorm:"not null" json:"ordre"`
        Actif           bool         `gorm:"not null;default:true" json:"actif"`
}

func (Cycle) TableName() string { return "cycles" }

// Classe représente une classe (ex. CP1, 6e A, Terminale D) rattachée à un cycle.
type Classe struct {
        BaseModel
        CycleID          uuid.UUID `gorm:"type:uuid;index;not null" json:"cycle_id"`
        Cycle            *Cycle    `gorm:"foreignKey:CycleID" json:"cycle,omitempty"`
        Libelle          string    `gorm:"not null" json:"libelle"`
        Niveau           int       `gorm:"not null" json:"niveau"`
        EstClasseExamen  bool      `gorm:"not null;default:false" json:"est_classe_examen"`
        EffectifMax      int       `json:"effectif_max"`
        Actif            bool      `gorm:"not null;default:true" json:"actif"`
}

func (Classe) TableName() string { return "classes" }
