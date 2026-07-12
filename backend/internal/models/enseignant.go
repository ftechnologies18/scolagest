package models

import (
	"time"

	"github.com/google/uuid"
)

// ===== Domaine 7 — Enseignants & pédagogie =====

// StatutEnseignant : statut professionnel d'un enseignant.
type StatutEnseignant string

const (
	StatutEnsActif   StatutEnseignant = "ACTIF"
	StatutEnsInactif StatutEnseignant = "INACTIF"
	StatutEnsConge   StatutEnseignant = "CONGE"
)

// TypeContrat : type de contrat de l'enseignant.
type TypeContrat string

const (
	ContratCDI        TypeContrat = "CDI"
	ContratCDD        TypeContrat = "CDD"
	ContratVacataire  TypeContrat = "VACATAIRE"
	ContratStagiaire  TypeContrat = "STAGIAIRE"
)

// Enseignant : profil d'un enseignant rattaché à un établissement.
// Lié à un compte Utilisateur (rôle ENSEIGNANT) pour l'authentification et
// l'accès au portail enseignant.
type Enseignant struct {
	BaseModel
	EtablissementID   uuid.UUID         `gorm:"type:uuid;index;not null" json:"etablissement_id"`
	Etablissement     *Etablissement    `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
	UtilisateurID     *uuid.UUID        `gorm:"type:uuid;index" json:"utilisateur_id,omitempty"`
	Utilisateur       *Utilisateur      `gorm:"foreignKey:UtilisateurID" json:"utilisateur,omitempty"`
	Matricule         string            `gorm:"uniqueIndex;not null" json:"matricule"`
	Nom               string            `gorm:"not null" json:"nom"`
	Prenoms           string            `json:"prenoms"`
	DateNaissance     *time.Time        `json:"date_naissance"`
	Sexe              Sexe              `json:"sexe"`
	PhotoURL          string            `json:"photo_url"`
	Telephone         string            `json:"telephone"`
	Email             string            `json:"email"`
	Adresse           string            `json:"adresse"`
	Statut            StatutEnseignant  `gorm:"not null;default:ACTIF" json:"statut"`
	TypeContrat       TypeContrat       `gorm:"not null;default:CDI" json:"type_contrat"`
	DateEmbauche      *time.Time        `json:"date_embauche"`
	Diplome           string            `json:"diplome"`
	Specialite        string            `json:"specialite"`
	CVURL             string            `json:"cv_url"`
	// TauxHoraireDefaut : taux par défaut (peut être surchargé par matière via EnseignantMatiere)
	TauxHoraireDefaut float64           `gorm:"type:decimal(14,2)" json:"taux_horaire_defaut"`
	// Matieres : matières enseignées par ce prof (N:N via EnseignantMatiere)
	Matieres          []EnseignantMatiere `gorm:"foreignKey:EnseignantID" json:"matieres,omitempty"`
	// Affectations : cours assignés (has-many)
	Affectations      []AffectationCours  `gorm:"foreignKey:EnseignantID" json:"affectations,omitempty"`
}

func (Enseignant) TableName() string { return "enseignants" }

// Matiere : matière enseignée (ex: Mathématiques, Physique, Français).
// Rattachée à un établissement (les matières peuvent différer entre collège et primaire).
type Matiere struct {
	BaseModel
	EtablissementID uuid.UUID       `gorm:"type:uuid;index;not null" json:"etablissement_id"`
	Etablissement   *Etablissement  `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
	Code            string          `gorm:"not null;index" json:"code"` // ex: MATH, PHYS, FR
	Libelle         string          `gorm:"not null" json:"libelle"`
	Coefficient     float64         `gorm:"type:decimal(4,2);default:1" json:"coefficient"`
	CycleID         *uuid.UUID      `gorm:"type:uuid;index" json:"cycle_id,omitempty"` // optionnel : matière par cycle
	Cycle           *Cycle          `gorm:"foreignKey:CycleID" json:"cycle,omitempty"`
	Couleur         string          `json:"couleur"` // pour affichage calendrier (hex)
	Actif           bool            `gorm:"not null;default:true" json:"actif"`
}

func (Matiere) TableName() string { return "matieres" }

// EnseignantMatiere : association N:N entre enseignant et matière, avec taux
// horaire spécifique à ce couple (un prof peut avoir un taux différent selon
// la matière qu'il enseigne).
type EnseignantMatiere struct {
	BaseModel
	EnseignantID  uuid.UUID  `gorm:"type:uuid;uniqueIndex:idx_ens_mat" json:"enseignant_id"`
	Enseignant    *Enseignant `gorm:"foreignKey:EnseignantID" json:"enseignant,omitempty"`
	MatiereID     uuid.UUID  `gorm:"type:uuid;uniqueIndex:idx_ens_mat" json:"matiere_id"`
	Matiere       *Matiere   `gorm:"foreignKey:MatiereID" json:"matiere,omitempty"`
	TauxHoraire   float64    `gorm:"type:decimal(14,2);not null" json:"taux_horaire"`
	EstPrincipale bool       `gorm:"not null;default:false" json:"est_principale"`
}

func (EnseignantMatiere) TableName() string { return "enseignant_matieres" }

// AffectationCours : assignation d'un enseignant à une matière + classe pour
// une année scolaire. C'est l'unité de base du planning pédagogique.
type AffectationCours struct {
	BaseModel
	EnseignantID    uuid.UUID      `gorm:"type:uuid;index;not null" json:"enseignant_id"`
	Enseignant      *Enseignant    `gorm:"foreignKey:EnseignantID" json:"enseignant,omitempty"`
	MatiereID       uuid.UUID      `gorm:"type:uuid;index;not null" json:"matiere_id"`
	Matiere         *Matiere       `gorm:"foreignKey:MatiereID" json:"matiere,omitempty"`
	ClasseID        uuid.UUID      `gorm:"type:uuid;index;not null" json:"classe_id"`
	Classe          *Classe        `gorm:"foreignKey:ClasseID" json:"classe,omitempty"`
	EtablissementID uuid.UUID      `gorm:"type:uuid;index;not null" json:"etablissement_id"`
	Etablissement   *Etablissement `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
	AnneeScolaireID uuid.UUID      `gorm:"type:uuid;index;not null" json:"annee_scolaire_id"`
	AnneeScolaire   *AnneeScolaire `gorm:"foreignKey:AnneeScolaireID" json:"annee_scolaire,omitempty"`
	VolumeHoraireHebdo float64     `gorm:"type:decimal(4,1);not null" json:"volume_horaire_hebdo"` // heures/semaine
	EstTitulaire       bool        `gorm:"not null;default:false" json:"est_titulaire"` // prof principal de la classe
	Actif              bool        `gorm:"not null;default:true" json:"actif"`
}

func (AffectationCours) TableName() string { return "affectation_cours" }
