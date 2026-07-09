package models

import (
        "time"

        "github.com/google/uuid"
)

// ===== Domaine 7 — Comptabilité générale (V1 étendu, partie double) =====

// ExerciceComptable : exercice annuel par établissement.
type ExerciceComptable struct {
        BaseModel
        EtablissementID  uuid.UUID    `gorm:"type:uuid;index;not null" json:"etablissement_id"`
        Etablissement    *Etablissement `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
        Libelle          string       `gorm:"not null" json:"libelle"`
        DateDebut        time.Time    `gorm:"not null" json:"date_debut"`
        DateFin          time.Time    `gorm:"not null" json:"date_fin"`
        Statut           StatutExercice `gorm:"not null;default:OUVERT" json:"statut"`
        AnneeScolaireID  *uuid.UUID   `gorm:"type:uuid;index" json:"annee_scolaire_id"`
}

func (ExerciceComptable) TableName() string { return "exercices_comptables" }

// CompteComptable : compte du plan comptable (hiérarchique).
type CompteComptable struct {
        BaseModel
        EtablissementID uuid.UUID       `gorm:"type:uuid;index;not null" json:"etablissement_id"`
        Etablissement   *Etablissement  `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
        Numero          string          `gorm:"uniqueIndex:idx_compte_etab_num;not null" json:"numero"`
        Libelle         string          `gorm:"not null" json:"libelle"`
        Type            TypeCompte      `gorm:"not null" json:"type"`
        ParentID        *uuid.UUID      `gorm:"type:uuid;index" json:"parent_id"`
        Parent          *CompteComptable `gorm:"foreignKey:ParentID" json:"parent,omitempty"`
        Actif           bool            `gorm:"not null;default:true" json:"actif"`
}

func (CompteComptable) TableName() string { return "comptes_comptables" }

// JournalComptable : journal comptable (caisse, banque, OD, ventes).
type JournalComptable struct {
        BaseModel
        EtablissementID         uuid.UUID       `gorm:"type:uuid;index;not null" json:"etablissement_id"`
        Etablissement           *Etablissement  `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
        Code                    string          `gorm:"not null" json:"code"`
        Libelle                 string          `gorm:"not null" json:"libelle"`
        Type                    TypeJournal     `gorm:"not null" json:"type"`
        CompteContrepartieID    *uuid.UUID      `gorm:"type:uuid;index" json:"compte_contrepartie_id"`
        CompteContrepartie      *CompteComptable `gorm:"foreignKey:CompteContrepartieID" json:"compte_contrepartie,omitempty"`
}

func (JournalComptable) TableName() string { return "journaux_comptables" }

// EcritureComptable : une écriture comptable (liée optionnellement à un paiement).
type EcritureComptable struct {
        BaseModel
        ExerciceID    uuid.UUID       `gorm:"type:uuid;index;not null" json:"exercice_id"`
        Exercice      *ExerciceComptable `gorm:"foreignKey:ExerciceID" json:"exercice,omitempty"`
        JournalID     uuid.UUID       `gorm:"type:uuid;index;not null" json:"journal_id"`
        Journal       *JournalComptable `gorm:"foreignKey:JournalID" json:"journal,omitempty"`
        PaiementID    *uuid.UUID      `gorm:"type:uuid;index" json:"paiement_id"`
        Paiement      *Paiement       `gorm:"foreignKey:PaiementID" json:"paiement,omitempty"`
        EnvoiMessageID *uuid.UUID     `gorm:"type:uuid;index" json:"envoi_message_id"`
        DateEcriture  time.Time       `gorm:"not null" json:"date_ecriture"`
        NumeroPiece   string          `json:"numero_piece"`
        Libelle       string          `gorm:"not null" json:"libelle"`
        Statut        StatutEcriture  `gorm:"not null;default:BROUILLON" json:"statut"`
        CreatedBy     uuid.UUID       `gorm:"type:uuid;not null" json:"created_by"`
}

func (EcritureComptable) TableName() string { return "ecritures_comptables" }

// LigneEcriture : ligne débit/crédit d'une écriture (partie double).
type LigneEcriture struct {
        BaseModel
        EcritureID uuid.UUID        `gorm:"type:uuid;index;not null" json:"ecriture_id"`
        Ecriture   *EcritureComptable `gorm:"foreignKey:EcritureID" json:"ecriture,omitempty"`
        CompteID   uuid.UUID        `gorm:"type:uuid;index;not null" json:"compte_id"`
        Compte     *CompteComptable `gorm:"foreignKey:CompteID" json:"compte,omitempty"`
        Debit      float64          `gorm:"type:decimal(14,2);not null;default:0" json:"debit"`
        Credit     float64          `gorm:"type:decimal(14,2);not null;default:0" json:"credit"`
        Libelle    string           `json:"libelle"`
}

func (LigneEcriture) TableName() string { return "lignes_ecritures" }
