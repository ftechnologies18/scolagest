package models

import (
        "time"

        "github.com/google/uuid"
)

// ===== Domaine 3 — Facturation =====

// Frais : configuration d'un type de frais par établissement + année + cycle/classe.
type Frais struct {
        BaseModel
        EtablissementID    uuid.UUID       `gorm:"type:uuid;index;not null" json:"etablissement_id"`
        Etablissement      *Etablissement  `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
        AnneeScolaireID    uuid.UUID       `gorm:"type:uuid;index;not null" json:"annee_scolaire_id"`
        AnneeScolaire      *AnneeScolaire  `gorm:"foreignKey:AnneeScolaireID" json:"annee_scolaire,omitempty"`
        CycleID            *uuid.UUID      `gorm:"type:uuid;index" json:"cycle_id"`
        Cycle              *Cycle          `gorm:"foreignKey:CycleID" json:"cycle,omitempty"`
        ClasseID           *uuid.UUID      `gorm:"type:uuid;index" json:"classe_id"`
        Classe             *Classe         `gorm:"foreignKey:ClasseID" json:"classe,omitempty"`
        TypeFrais          TypeFrais       `gorm:"not null" json:"type_frais"`
        Categorie          *CategorieEleve `json:"categorie"`
        Libelle            string          `gorm:"not null" json:"libelle"`
        MontantTotal       float64         `gorm:"type:decimal(14,2);not null" json:"montant_total"`
        NbVersementsDefaut int             `gorm:"not null;default:1" json:"nb_versements_defaut"`
        Actif              bool            `gorm:"not null;default:true" json:"actif"`
        // Echeances : tranches d'échéancier (modèle générique, eleve_id IS NULL)
        Echeances          []Echeance      `gorm:"foreignKey:FraisID" json:"echeances,omitempty"`
}

func (Frais) TableName() string { return "frais" }

// Echeance : tranche d'un échéancier (générique par frais, ou dérogatoire par élève).
type Echeance struct {
        BaseModel
        FraisID          uuid.UUID       `gorm:"type:uuid;index;not null" json:"frais_id"`
        Frais            *Frais          `gorm:"foreignKey:FraisID" json:"frais,omitempty"`
        EleveID          *uuid.UUID      `gorm:"type:uuid;index" json:"eleve_id"`
        Eleve            *Eleve          `gorm:"foreignKey:EleveID" json:"eleve,omitempty"`
        Rang             int             `gorm:"not null" json:"rang"`
        Libelle          string          `gorm:"not null" json:"libelle"`
        Montant          float64         `gorm:"type:decimal(14,2);not null" json:"montant"`
        DateLimite       time.Time       `gorm:"not null" json:"date_limite"`
        MotifDerogation  string          `json:"motif_derogation"`
}

func (Echeance) TableName() string { return "echeances" }
