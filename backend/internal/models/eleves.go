package models

import (
        "time"

        "github.com/google/uuid"
)

// ===== Domaine 2 — Élèves & tuteurs =====

// Tuteur (parent/tuteur légal) d'un ou plusieurs élèves.
type Tuteur struct {
        BaseModel
        Nom          string       `gorm:"not null" json:"nom"`
        Prenoms      string       `json:"prenoms"`
        Telephone    string       `gorm:"not null" json:"telephone"`
        Telephone2   string       `json:"telephone2"`
        Email        string       `json:"email"`
        Adresse      string       `json:"adresse"`
        LienParente  LienParente  `json:"lien_parente"`
        Profession   string       `json:"profession"`
        Actif        bool         `gorm:"not null;default:true" json:"actif"`
        // Eleves : liste des élèves dont ce tuteur est le tuteur principal (has-many)
        Eleves       []Eleve      `gorm:"foreignKey:TuteurID" json:"eleves,omitempty"`
}

func (Tuteur) TableName() string { return "tuteurs" }

// Eleve représente un élève inscrit dans un établissement.
type Eleve struct {
        BaseModel
        EtablissementID      uuid.UUID        `gorm:"type:uuid;index;not null" json:"etablissement_id"`
        Etablissement        *Etablissement   `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
        MatriculeMinistere   string           `gorm:"uniqueIndex" json:"matricule_ministere"`
        IdentifiantInterne   string           `gorm:"uniqueIndex;not null" json:"identifiant_interne"`
        Nom                  string           `gorm:"not null" json:"nom"`
        Prenoms              string           `json:"prenoms"`
        DateNaissance        *time.Time       `json:"date_naissance"`
        LieuNaissance        string           `json:"lieu_naissance"`
        Sexe                 Sexe             `json:"sexe"`
        PhotoURL             string           `json:"photo_url"`
        Categorie            CategorieEleve   `gorm:"not null;default:NON_APPLICABLE" json:"categorie"`
        Statut               StatutEleve      `gorm:"not null;default:ACTIF" json:"statut"`
        TuteurID             *uuid.UUID       `gorm:"type:uuid;index" json:"tuteur_id"`
        Tuteur               *Tuteur          `gorm:"foreignKey:TuteurID" json:"tuteur,omitempty"`
        // Inscriptions : historique des inscriptions de l'élève par année (has-many)
        Inscriptions         []Inscription    `gorm:"foreignKey:EleveID" json:"inscriptions,omitempty"`
        // SearchVector : vecteur de recherche normalisé (sans accents, minuscules)
        // pour une recherche insensible aux accents. Mis à jour à chaque create/update.
        SearchVector string `gorm:"index" json:"-"`
}

func (Eleve) TableName() string { return "eleves" }

// TuteurEleve associe plusieurs tuteurs à un élève (relation N:N).
type TuteurEleve struct {
        EleveID     uuid.UUID `gorm:"type:uuid;primaryKey" json:"eleve_id"`
        Eleve       *Eleve    `gorm:"foreignKey:EleveID" json:"eleve,omitempty"`
        TuteurID    uuid.UUID `gorm:"type:uuid;primaryKey" json:"tuteur_id"`
        Tuteur      *Tuteur   `gorm:"foreignKey:TuteurID" json:"tuteur,omitempty"`
        EstPrincipal bool     `gorm:"not null;default:false" json:"est_principal"`
        Note         string    `json:"note"`
}

func (TuteurEleve) TableName() string { return "tuteur_eleves" }

// Inscription : inscription d'un élève dans une classe pour une année scolaire.
// Entité pivot qui historise le parcours (réinscription = nouvelle ligne).
type Inscription struct {
        BaseModel
        EleveID              uuid.UUID          `gorm:"type:uuid;index;not null" json:"eleve_id"`
        Eleve                *Eleve             `gorm:"foreignKey:EleveID" json:"eleve,omitempty"`
        EtablissementID      uuid.UUID          `gorm:"type:uuid;index;not null" json:"etablissement_id"`
        Etablissement        *Etablissement     `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
        ClasseID             uuid.UUID          `gorm:"type:uuid;index;not null" json:"classe_id"`
        Classe               *Classe            `gorm:"foreignKey:ClasseID" json:"classe,omitempty"`
        AnneeScolaireID      uuid.UUID          `gorm:"type:uuid;index;not null" json:"annee_scolaire_id"`
        AnneeScolaire        *AnneeScolaire     `gorm:"foreignKey:AnneeScolaireID" json:"annee_scolaire,omitempty"`
        DateInscription      time.Time          `gorm:"not null" json:"date_inscription"`
        Statut               StatutInscription  `gorm:"not null;default:INSCRIT" json:"statut"`
        DerogationInscription bool              `gorm:"not null;default:false" json:"derogation_inscription"`
        MotifDerogation      string             `json:"motif_derogation"`
        AccordeePar          *uuid.UUID         `gorm:"type:uuid;index" json:"accordee_par"`
        DateDerogation       *time.Time         `json:"date_derogation"`
        Notes                string             `json:"notes"`
}

func (Inscription) TableName() string { return "inscriptions" }

// Document : fichier stocké (photo, extrait de naissance, etc.).
type Document struct {
        BaseModel
        EleveID         *uuid.UUID    `gorm:"type:uuid;index" json:"eleve_id"`
        Eleve           *Eleve        `gorm:"foreignKey:EleveID" json:"eleve,omitempty"`
        EtablissementID uuid.UUID     `gorm:"type:uuid;index;not null" json:"etablissement_id"`
        Etablissement   *Etablissement `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
        Type            TypeDocument  `gorm:"not null" json:"type"`
        NomFichier      string        `gorm:"not null" json:"nom_fichier"`
        CleStockage     string        `gorm:"not null" json:"cle_stockage"`
        URLSignee       string        `json:"url_signee"`
        Taille          int64         `json:"taille"`
        MimeType        string        `json:"mime_type"`
        UploadedBy      uuid.UUID     `gorm:"type:uuid;not null" json:"uploaded_by"`
}

func (Document) TableName() string { return "documents" }
