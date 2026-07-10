package models

import (
        "time"

        "github.com/google/uuid"
)

// ===== Domaine 4 — Caisse & paiements =====

// Paiement : un encaissement effectué par un caissier pour un élève.
type Paiement struct {
        BaseModel
        EleveID          uuid.UUID         `gorm:"type:uuid;index;not null" json:"eleve_id"`
        Eleve            *Eleve            `gorm:"foreignKey:EleveID" json:"eleve,omitempty"`
        InscriptionID    uuid.UUID         `gorm:"type:uuid;index;not null" json:"inscription_id"`
        Inscription      *Inscription      `gorm:"foreignKey:InscriptionID" json:"inscription,omitempty"`
        EtablissementID  uuid.UUID         `gorm:"type:uuid;index;not null" json:"etablissement_id"`
        Etablissement    *Etablissement    `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
        FraisID          *uuid.UUID        `gorm:"type:uuid;index" json:"frais_id"`
        Frais            *Frais            `gorm:"foreignKey:FraisID" json:"frais,omitempty"`
        EcheanceID       *uuid.UUID        `gorm:"type:uuid;index" json:"echeance_id"`
        Echeance         *Echeance         `gorm:"foreignKey:EcheanceID" json:"echeance,omitempty"`
        Montant          float64           `gorm:"type:decimal(14,2);not null" json:"montant"`
        ModePaiement     ModePaiement      `gorm:"not null" json:"mode_paiement"`
        ProviderMomo     *ProviderMomo     `json:"provider_momo"`
        ReferenceExterne string            `json:"reference_externe"`
        DatePaiement     time.Time         `gorm:"not null" json:"date_paiement"`
        CaissierID       uuid.UUID         `gorm:"type:uuid;index;not null" json:"caissier_id"`
        Caissier         *Utilisateur      `gorm:"foreignKey:CaissierID" json:"caissier,omitempty"`
        Statut           StatutPaiement    `gorm:"not null;default:VALIDE" json:"statut"`
        NumeroRecu       string            `gorm:"uniqueIndex" json:"numero_recu"`
        // Recu : reçu généré automatiquement (has-one)
        Recu             *Recu             `gorm:"foreignKey:PaiementID" json:"recu,omitempty"`
        MotifAnnulation  string            `json:"motif_annulation"`
        AnnulePar        *uuid.UUID        `gorm:"type:uuid;index" json:"annule_par"`
        DateAnnulation   *time.Time        `json:"date_annulation"`
}

func (Paiement) TableName() string { return "paiements" }

// Recu : reçu de paiement (1 par paiement), avec PDF généré.
type Recu struct {
        BaseModel
        PaiementID       uuid.UUID `gorm:"type:uuid;uniqueIndex;not null" json:"paiement_id"`
        Paiement         *Paiement `gorm:"foreignKey:PaiementID" json:"paiement,omitempty"`
        Numero           string    `gorm:"uniqueIndex;not null" json:"numero"`
        PDFURL           string    `json:"pdf_url"`
        ContenuSnapshot  string    `gorm:"type:json" json:"contenu_snapshot"`
        DateEmission     time.Time `gorm:"not null" json:"date_emission"`
}

func (Recu) TableName() string { return "recus" }

// ClotureCaisse : clôture journalière par caissier/établissement.
type ClotureCaisse struct {
        BaseModel
        CaissierID      uuid.UUID    `gorm:"type:uuid;index;not null" json:"caissier_id"`
        Caissier        *Utilisateur `gorm:"foreignKey:CaissierID" json:"caissier,omitempty"`
        EtablissementID uuid.UUID    `gorm:"type:uuid;index;not null" json:"etablissement_id"`
        Etablissement   *Etablissement `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
        DateCloture     time.Time    `gorm:"not null" json:"date_cloture"`
        TotalTheorique  float64      `gorm:"type:decimal(14,2);not null" json:"total_theorique"`
        TotalRemis      float64      `gorm:"type:decimal(14,2);not null" json:"total_remis"`
        Ecart           float64      `gorm:"type:decimal(14,2);not null" json:"ecart"`
        Statut          StatutCloture `gorm:"not null;default:OUVERTE" json:"statut"`
        ValidePar       *uuid.UUID   `gorm:"type:uuid;index" json:"valide_par"`
        Notes           string       `json:"notes"`
}

func (ClotureCaisse) TableName() string { return "clotures_caisse" }

// TransactionMobileMoney : trace des transactions Momo initiées (V1 étendu).
type TransactionMobileMoney struct {
        BaseModel
        PaiementID         *uuid.UUID          `gorm:"type:uuid;index" json:"paiement_id"`
        Paiement           *Paiement           `gorm:"foreignKey:PaiementID" json:"paiement,omitempty"`
        EleveID            uuid.UUID           `gorm:"type:uuid;index;not null" json:"eleve_id"`
        Eleve              *Eleve              `gorm:"foreignKey:EleveID" json:"eleve,omitempty"`
        EtablissementID    uuid.UUID           `gorm:"type:uuid;index;not null" json:"etablissement_id"`
        Etablissement      *Etablissement      `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
        FraisID            *uuid.UUID          `gorm:"type:uuid;index" json:"frais_id"`
        Provider           ProviderMomo        `gorm:"not null" json:"provider"`
        Montant            float64             `gorm:"type:decimal(14,2);not null" json:"montant"`
        TelephoneClient    string              `gorm:"not null" json:"telephone_client"`
        ReferenceExterne   string              `json:"reference_externe"`
        Statut             StatutTransactionMomo `gorm:"not null;default:INITIEE" json:"statut"`
        PayloadRequete     string              `gorm:"type:json" json:"payload_requete"`
        PayloadReponse     string              `gorm:"type:json" json:"payload_reponse"`
        DateInitiation     time.Time           `gorm:"not null" json:"date_initiation"`
        DateConfirmation   *time.Time          `json:"date_confirmation"`
        Erreur             string              `json:"erreur"`
}

func (TransactionMobileMoney) TableName() string { return "transactions_momo" }
