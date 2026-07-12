package models

import (
	"time"

	"github.com/google/uuid"
)

// ===== Domaine — Pré-inscription en ligne (Phase 3) =====

// StatutPreInscription : cycle de vie d'une pré-inscription soumise par un
// parent en ligne (sans compte staff).
type StatutPreInscription string

const (
	StatutPreSoumise   StatutPreInscription = "SOUMISE"   // parent a soumis le formulaire
	StatutPreEnRevue   StatutPreInscription = "EN_REVUE"  // staff regarde
	StatutPreValidee   StatutPreInscription = "VALIDEE"   // convertie en élève + inscription
	StatutPreRejetee   StatutPreInscription = "REJETEE"   // refusée (doublon, dossier incomplet)
)

// PreInscription : demande d'inscription soumise en ligne par un parent.
// Les données sont saisies par le parent sur la page publique /pre-inscription
// (sans auth). Le staff valide ensuite la demande, ce qui crée un vrai élève +
// inscription via le workflow existant.
//
// Le TokenSuivi permet au parent de suivre l'état de sa demande via un lien
// sécurisé (sans compte).
type PreInscription struct {
	BaseModel

	// ── Établissement cible & statut ──
	EtablissementID uuid.UUID             `gorm:"type:uuid;index;not null" json:"etablissement_id"`
	Etablissement   *Etablissement        `gorm:"foreignKey:EtablissementID" json:"etablissement,omitempty"`
	Statut          StatutPreInscription  `gorm:"not null;default:SOUMISE;index" json:"statut"`
	TokenSuivi      string                `gorm:"uniqueIndex;not null" json:"-"` // masqué dans le JSON public
	DateSoumission  time.Time             `gorm:"not null" json:"date_soumission"`
	DateTraitement  *time.Time            `json:"date_traitement,omitempty"`

	// ── Identité de l'élève (saisie par le parent) ──
	EleveNom             string             `gorm:"not null" json:"eleve_nom"`
	ElevePrenoms         string             `json:"eleve_prenoms"`
	EleveDateNaissance   *time.Time         `json:"eleve_date_naissance"`
	EleveLieuNaissance   string             `json:"eleve_lieu_naissance"`
	EleveSexe            Sexe               `json:"eleve_sexe"`
	EleveCategorie       CategorieEleve     `gorm:"default:NON_APPLICABLE" json:"eleve_categorie"`

	// ── Tuteur (saisie par le parent) ──
	TuteurNom         string     `gorm:"not null" json:"tuteur_nom"`
	TuteurPrenoms     string     `json:"tuteur_prenoms"`
	TuteurTelephone   string     `gorm:"not null" json:"tuteur_telephone"`
	TuteurEmail       string     `json:"tuteur_email"`
	TuteurLienParente LienParente `gorm:"default:AUTRE" json:"tuteur_lien_parente"`

	// ── Classe souhaitée ──
	ClasseID *uuid.UUID `gorm:"type:uuid;index" json:"classe_id,omitempty"`
	Classe   *Classe    `gorm:"foreignKey:ClasseID" json:"classe,omitempty"`

	// ── Méta ──
	NotesParent string `json:"notes_parent"`        // message du parent
	NotesStaff  string `json:"notes_staff"`         // remarques du staff
	TraitePar   *uuid.UUID `gorm:"type:uuid;index" json:"traite_par,omitempty"`
	EleveCreeID *uuid.UUID `gorm:"type:uuid;index" json:"eleve_cree_id,omitempty"` // lien vers l'élève créé après validation
}

func (PreInscription) TableName() string { return "pre_inscriptions" }
