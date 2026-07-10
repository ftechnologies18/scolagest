package models

import (
        "time"

        "github.com/google/uuid"
)

// ===== Domaine 5 — Utilisateurs & sécurité =====

// Utilisateur : compte d'accès à l'application (staff interne ou parent).
type Utilisateur struct {
        BaseModel
        Nom                string           `gorm:"not null" json:"nom"`
        Prenoms            string           `json:"prenoms"`
        Email              string           `gorm:"uniqueIndex;not null" json:"email"`
        MotDePasseHash     string           `gorm:"not null" json:"-"`
        RoleGlobal         *RoleUtilisateur `json:"role_global"`
        TuteurID           *uuid.UUID       `gorm:"type:uuid;index" json:"tuteur_id"`
        Tuteur             *Tuteur          `gorm:"foreignKey:TuteurID" json:"tuteur,omitempty"`
        Statut             StatutUtilisateur `gorm:"not null;default:ACTIF" json:"statut"`
        DerniereConnexion  *time.Time       `json:"derniere_connexion"`
        TentativesEchouees int              `gorm:"not null;default:0" json:"-"`
        // EtablissementAccess : accès par établissement (multi-sites)
        EtablissementAccess []EtablissementAccess `gorm:"foreignKey:UtilisateurID" json:"etablissement_access,omitempty"`
}

func (Utilisateur) TableName() string { return "utilisateurs" }

// EtablissementAccess : rôle spécifique d'un utilisateur sur un établissement (multi-sites).
type EtablissementAccess struct {
        UtilisateurID   uuid.UUID       `gorm:"type:uuid;primaryKey" json:"utilisateur_id"`
        Utilisateur     *Utilisateur    `gorm:"foreignKey:UtilisateurID" json:"utilisateur,omitempty"`
        EtablissementID uuid.UUID       `gorm:"type:uuid;primaryKey" json:"etablissement_id"`
        Etablissement   *Etablissement  `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
        Role            RoleUtilisateur `gorm:"not null" json:"role"`
}

func (EtablissementAccess) TableName() string { return "etablissement_access" }

// Session : token JWT (access ou refresh) émis pour un utilisateur.
type Session struct {
        BaseModel
        UtilisateurID   uuid.UUID    `gorm:"type:uuid;index;not null" json:"utilisateur_id"`
        Utilisateur     *Utilisateur `gorm:"foreignKey:UtilisateurID" json:"utilisateur,omitempty"`
        TokenHash       string       `gorm:"uniqueIndex;not null" json:"-"`
        Type            TypeSession  `gorm:"not null" json:"type"`
        ExpiresAt       time.Time    `gorm:"not null" json:"expires_at"`
        Revoked         bool         `gorm:"not null;default:false" json:"revoked"`
        IPAdresse       string       `json:"ip_adresse"`
        UserAgent       string       `json:"user_agent"`
        EtablissementID *uuid.UUID   `gorm:"type:uuid;index" json:"etablissement_id"`
}

func (Session) TableName() string { return "sessions" }

// JournalAudit : trace des actions sensibles (paiements, catégories, frais, connexions).
type JournalAudit struct {
        BaseModel
        UtilisateurID   *uuid.UUID  `gorm:"type:uuid;index" json:"utilisateur_id"`
        Utilisateur     *Utilisateur `gorm:"foreignKey:UtilisateurID" json:"utilisateur,omitempty"`
        EtablissementID *uuid.UUID  `gorm:"type:uuid;index" json:"etablissement_id"`
        Action          ActionAudit `gorm:"not null" json:"action"`
        Entite          string      `gorm:"not null" json:"entite"`
        EntiteID        string      `json:"entite_id"`
        Date            time.Time   `gorm:"not null" json:"date"`
        Details         string      `gorm:"type:json" json:"details"`
        IPAdresse       string      `json:"ip_adresse"`
}

func (JournalAudit) TableName() string { return "journal_audit" }
