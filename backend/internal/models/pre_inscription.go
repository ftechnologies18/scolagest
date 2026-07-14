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
        // Nationalité de l'élève (texte libre — ex: "Ivoirienne", "Malienne").
        // Vide par défaut pour les pré-inscriptions héritées (avant l'ajout du champ).
        EleveNationalite     string             `json:"eleve_nationalite"`

        // ── Scolarité antérieure (transfert) ──
        // EleveAncienEtablissement : nom de l'établissement précédent (si transfert).
        // EleveStatutAnneePrecedente : décision de fin d'année dans l'ancien établissement
        //   (PROMU / REDOUBLANT / AUTRE / NON_APPLICABLE pour les nouveaux entrants).
        EleveAncienEtablissement    string                 `json:"eleve_ancien_etablissement"`
        EleveStatutAnneePrecedente  StatutAnneePrecedente  `gorm:"default:NON_APPLICABLE" json:"eleve_statut_annee_precedente"`

        // ── Santé (confidentiel) ──
        EleveAllergies           string `json:"eleve_allergies"`             // infos santé (allergies, conditions particulières)
        EleveNotesSante          string `json:"eleve_notes_sante"`           // autres notes santé

        // ── Tuteur (saisie par le parent) ──
        TuteurNom         string     `gorm:"not null" json:"tuteur_nom"`
        TuteurPrenoms     string     `json:"tuteur_prenoms"`
        TuteurTelephone   string     `gorm:"not null" json:"tuteur_telephone"`
        TuteurEmail       string     `json:"tuteur_email"`
        TuteurLienParente LienParente `gorm:"default:AUTRE" json:"tuteur_lien_parente"`
        TuteurAdresse     string     `json:"tuteur_adresse"`     // quartier d'habitation
        TuteurProfession  string     `json:"tuteur_profession"`

        // ── Classe souhaitée ──
        // Depuis la réforme pré-inscription (2026-07) : le parent ne choisit plus
        // une classe précise (elle est attribuée par l'établissement lors de la
        // validation staff / finalisation à la caisse). Il exprime uniquement une
        // préférence cycle + niveau. Le champ ClasseID reste présent (nullable)
        // pour compat ascendante et est désormais toujours NULL à la soumission.
        ClasseID *uuid.UUID `gorm:"type:uuid;index" json:"classe_id,omitempty"`
        Classe   *Classe    `gorm:"foreignKey:ClasseID" json:"classe,omitempty"`

        // ── Préférence cycle + niveau (choix du parent) ──
        // CycleID       : cycle souhaité (FK vers cycles). Nullable car non requis
        //                 pour les pré-inscriptions héritées (avant la réforme).
        // NiveauSouhaite : ordinal du niveau dans le cycle (1, 2, 3...). Nullable.
        // Le staff utilise cette préférence pour pré-filtrer la cascade
        // Cycle → Niveau → Classe dans le ValiderDialog.
        CycleID        *uuid.UUID `gorm:"type:uuid;index" json:"cycle_id,omitempty"`
        Cycle          *Cycle     `gorm:"foreignKey:CycleID" json:"cycle,omitempty"`
        NiveauSouhaite *int       `json:"niveau_souhaite,omitempty"`

        // ── Méta ──
        NotesParent string `json:"notes_parent"`        // message du parent
        NotesStaff  string `json:"notes_staff"`         // remarques du staff
        TraitePar   *uuid.UUID `gorm:"type:uuid;index" json:"traite_par,omitempty"`
        EleveCreeID *uuid.UUID `gorm:"type:uuid;index" json:"eleve_cree_id,omitempty"` // lien vers l'élève créé après validation
}

func (PreInscription) TableName() string { return "pre_inscriptions" }
