package services

import (
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
	"github.com/scolagest/backend/internal/utils"
	"gorm.io/gorm"
)

// InscriptionWorkflowService gère la création complète d'une inscription en
// une seule transaction atomique : élève + tuteur (nouveau ou existant) +
// inscription dans une classe pour une année scolaire.
//
// Ce service est utilisé par le wizard d'inscription (Phase 2) qui collecte
// toutes les données en 4 étapes côté frontend, puis soumet tout en une passe.
// L'atomicité garantit qu'aucun enregistrement partiel n'est persisté en cas
// d'erreur (ex : élève créé sans inscription si la classe est pleine).
type InscriptionWorkflowService struct {
	eleveSvc *EleveService
}

// NewInscriptionWorkflowService construit le service de workflow.
func NewInscriptionWorkflowService(eleveSvc *EleveService) *InscriptionWorkflowService {
	return &InscriptionWorkflowService{eleveSvc: eleveSvc}
}

// WorkflowTuteurDTO représente un tuteur dans le workflow. Soit on référence
// un tuteur existant via TuteurID, soit on en crée un nouveau via les champs
// ci-dessous.
type WorkflowTuteurDTO struct {
	// TuteurID : si non nil, référence un tuteur existant (ex : fratrie).
	// Si nil, un nouveau tuteur est créé avec les champs ci-dessous.
	TuteurID *uuid.UUID `json:"tuteur_id"`
	// Champs pour un nouveau tuteur (ignorés si TuteurID est défini).
	Nom         string             `json:"nom"`
	Prenoms     string             `json:"prenoms"`
	Telephone   string             `json:"telephone"`
	Telephone2  string             `json:"telephone2"`
	Email       string             `json:"email"`
	Adresse     string             `json:"adresse"`
	LienParente models.LienParente `json:"lien_parente"`
	Profession  string             `json:"profession"`
}

// WorkflowEleveDTO représente l'élève à inscrire.
type WorkflowEleveDTO struct {
	Nom                string                `json:"nom"`
	Prenoms            string                `json:"prenoms"`
	DateNaissance      *time.Time            `json:"date_naissance"`
	LieuNaissance      string                `json:"lieu_naissance"`
	Sexe               models.Sexe           `json:"sexe"`
	Categorie          models.CategorieEleve `json:"categorie"`
	MatriculeMinistere *string               `json:"matricule_ministere"`
	// Champs complémentaires (nationalité, scolarité antérieure, santé) —
	// alignés sur le wizard de pré-inscription publique.
	Nationalite           string `json:"nationalite"`
	AncienEtablissement   string `json:"ancien_etablissement"`
	StatutAnneePrecedente string `json:"statut_annee_precedente"`
	Allergies             string `json:"allergies"`
	NotesSante            string `json:"notes_sante"`
}

// WorkflowInscriptionDTO représente l'inscription (classe + année).
type WorkflowInscriptionDTO struct {
	ClasseID              uuid.UUID                `json:"classe_id"`
	AnneeScolaireID       uuid.UUID                `json:"annee_scolaire_id"`
	Statut                models.StatutInscription `json:"statut"`
	DerogationInscription bool                     `json:"derogation_inscription"`
	MotifDerogation       string                   `json:"motif_derogation"`
	Notes                 string                   `json:"notes"`
}

// WorkflowDTO est le payload complet du wizard d'inscription.
type WorkflowDTO struct {
	Eleve       WorkflowEleveDTO       `json:"eleve"`
	Tuteur      WorkflowTuteurDTO      `json:"tuteur"`
	Inscription WorkflowInscriptionDTO `json:"inscription"`
}

// WorkflowResult est la réponse du workflow : l'élève créé avec ses relations,
// plus l'inscription créée.
type WorkflowResult struct {
	Eleve       *models.Eleve       `json:"eleve"`
	Inscription *models.Inscription `json:"inscription"`
}

// Create exécute le workflow d'inscription complet en une transaction.
// Étapes (atomiques) :
//  1. Valider l'établissement + cohérence catégorie
//  2. Résoudre le tuteur (existant par ID ou nouveau créé)
//  3. Créer l'élève (avec identifiant interne auto-généré + search_vector)
//  4. Valider l'unicité de l'inscription (élève + année)
//  5. Vérifier la cohérence dérogation (seulement pour AFFECTE)
//  6. Auto-création de classe si quota atteint (réutilisé du InscriptionService)
//  7. Créer l'inscription
//  8. Commit
func (s *InscriptionWorkflowService) Create(dto WorkflowDTO, etablissementID uuid.UUID, userID uuid.UUID) (*WorkflowResult, error) {
	db := database.Current()

	// ── Validation préalable (hors transaction, lecture seule) ──
	var etb models.Etablissement
	if err := db.First(&etb, "id = ?", etablissementID).Error; err != nil {
		return nil, errors.New("établissement introuvable")
	}

	// Cohérence catégorie / établissement
	cat := dto.Eleve.Categorie
	if !etb.AppliqueCategorieAffecte {
		cat = models.CategorieNonApplicable
	} else if cat == models.CategorieNonApplicable {
		return nil, errors.New("catégorie invalide pour cet établissement (AFFECTE ou NON_AFFECTE requis)")
	}

	// Unicité du matricule ministériel si fourni
	if dto.Eleve.MatriculeMinistere != nil && *dto.Eleve.MatriculeMinistere != "" {
		var count int64
		db.Model(&models.Eleve{}).Where("matricule_ministere = ?", *dto.Eleve.MatriculeMinistere).Count(&count)
		if count > 0 {
			return nil, errors.New("matricule ministériel déjà attribué à un autre élève")
		}
	}

	// Vérifier unicité inscription (élève + année) AVANT la transaction — mais
	// l'élève n'existe pas encore, donc on ne peut pas. On le fera après création
	// de l'élève, dans la transaction.

	// ── Transaction atomique ──
	var result WorkflowResult
	err := db.Transaction(func(tx *gorm.DB) error {
		// 2. Résoudre le tuteur
		var tuteurID uuid.UUID
		if dto.Tuteur.TuteurID != nil {
			// Tuteur existant : vérifier qu'il existe
			var t models.Tuteur
			if err := tx.First(&t, "id = ?", *dto.Tuteur.TuteurID).Error; err != nil {
				return errors.New("tuteur introuvable")
			}
			tuteurID = *dto.Tuteur.TuteurID
		} else {
			// Nouveau tuteur : valider les champs requis
			if dto.Tuteur.Nom == "" || dto.Tuteur.Telephone == "" {
				return errors.New("nom et téléphone du tuteur sont requis")
			}
			tuteur := models.Tuteur{
				Nom:         dto.Tuteur.Nom,
				Prenoms:     dto.Tuteur.Prenoms,
				Telephone:   dto.Tuteur.Telephone,
				Telephone2:  dto.Tuteur.Telephone2,
				Email:       dto.Tuteur.Email,
				Adresse:     dto.Tuteur.Adresse,
				LienParente: dto.Tuteur.LienParente,
				Profession:  dto.Tuteur.Profession,
				Actif:       true,
			}
			if err := tx.Create(&tuteur).Error; err != nil {
				return fmt.Errorf("création tuteur: %w", err)
			}
			tuteurID = tuteur.ID
		}

		// 3. Créer l'élève (identifiant interne auto-généré)
		identifiant, err := s.generateIdentifiantTx(tx, etablissementID, &etb)
		if err != nil {
			return err
		}

		statut := models.StatutEleveActif
		eleve := models.Eleve{
			EtablissementID:    etablissementID,
			IdentifiantInterne: identifiant,
			Nom:                dto.Eleve.Nom,
			Prenoms:            dto.Eleve.Prenoms,
			DateNaissance:      dto.Eleve.DateNaissance,
			LieuNaissance:      dto.Eleve.LieuNaissance,
			Sexe:               dto.Eleve.Sexe,
			Categorie:          cat,
			Statut:             statut,
			TuteurID:           &tuteurID,
			// Champs complémentaires (nationalité, scolarité antérieure, santé)
			Nationalite:           dto.Eleve.Nationalite,
			AncienEtablissement:   dto.Eleve.AncienEtablissement,
			StatutAnneePrecedente: models.StatutAnneePrecedente(dto.Eleve.StatutAnneePrecedente),
			Allergies:             dto.Eleve.Allergies,
			NotesSante:            dto.Eleve.NotesSante,
		}
		if dto.Eleve.MatriculeMinistere != nil && *dto.Eleve.MatriculeMinistere != "" {
			eleve.MatriculeMinistere = *dto.Eleve.MatriculeMinistere
		}
		eleve.SearchVector = utils.BuildSearchVector(eleve.Nom, eleve.Prenoms, eleve.MatriculeMinistere, eleve.IdentifiantInterne)

		if err := tx.Create(&eleve).Error; err != nil {
			return fmt.Errorf("création élève: %w", err)
		}

		// 4. Unicité inscription (élève + année)
		var count int64
		tx.Model(&models.Inscription{}).
			Where("eleve_id = ? AND annee_scolaire_id = ?", eleve.ID, dto.Inscription.AnneeScolaireID).
			Count(&count)
		if count > 0 {
			return errors.New("cet élève est déjà inscrit pour cette année scolaire")
		}

		// 5. Cohérence dérogation
		if dto.Inscription.DerogationInscription && cat != models.CategorieAffecte {
			return errors.New("la dérogation 3 tranches ne s'applique qu'aux élèves affectés")
		}

		// 6. Auto-création de classe si quota atteint
		classeID := dto.Inscription.ClasseID
		quota := etb.QuotaClasse
		if quota <= 0 {
			quota = 45
		}
		var nbInscrits int64
		tx.Model(&models.Inscription{}).
			Where("classe_id = ? AND annee_scolaire_id = ?", classeID, dto.Inscription.AnneeScolaireID).
			Count(&nbInscrits)

		if int(nbInscrits) >= quota {
			newClasse, err := s.createNextClasseTx(tx, classeID)
			if err != nil {
				return fmt.Errorf("auto-création classe: %w", err)
			}
			classeID = newClasse.ID
		}

		// 7. Créer l'inscription
		// Règle métier : une inscription est PRE_INSCRIT tant que les frais
		// d'inscription n'ont pas été payés à la caisse. Le passage à
		// INSCRIT se fait automatiquement lors du paiement des frais
		// d'inscription (voir PaiementService.Create).
		statutIns := dto.Inscription.Statut
		if statutIns == "" {
			statutIns = models.StatutPreInscrit
		}
		inscription := models.Inscription{
			EleveID:               eleve.ID,
			EtablissementID:       etablissementID,
			ClasseID:              classeID,
			AnneeScolaireID:       dto.Inscription.AnneeScolaireID,
			DateInscription:       time.Now(),
			Statut:                statutIns,
			DerogationInscription: dto.Inscription.DerogationInscription,
			MotifDerogation:       dto.Inscription.MotifDerogation,
			Notes:                 dto.Inscription.Notes,
			AccordeePar:           &userID,
		}
		if dto.Inscription.DerogationInscription {
			now := time.Now()
			inscription.DateDerogation = &now
		}
		if err := tx.Create(&inscription).Error; err != nil {
			return fmt.Errorf("création inscription: %w", err)
		}

		// Charger les relations pour la réponse
		if err := tx.Preload("Etablissement").
			Preload("Tuteur").
			Preload("Inscriptions.Classe.Cycle").
			Preload("Inscriptions.AnneeScolaire").
			First(&eleve, "id = ?", eleve.ID).Error; err != nil {
			return err
		}
		if err := tx.Preload("Classe.Cycle").
			Preload("AnneeScolaire").
			First(&inscription, "id = ?", inscription.ID).Error; err != nil {
			return err
		}

		result.Eleve = &eleve
		result.Inscription = &inscription
		return nil
	})

	if err != nil {
		return nil, err
	}
	return &result, nil
}

// generateIdentifiantTx génère un identifiant interne dans la transaction.
// Format : {PREFIX}-{YEAR}-{SEQUENCE:04d} (ex: COL-2026-0001).
func (s *InscriptionWorkflowService) generateIdentifiantTx(tx *gorm.DB, etablissementID uuid.UUID, etb *models.Etablissement) (string, error) {
	prefix := "EPV"
	if etb.AppliqueCategorieAffecte {
		prefix = "COL"
	}
	year := time.Now().Year()

	var count int64
	tx.Model(&models.Eleve{}).Where("etablissement_id = ?", etablissementID).Count(&count)
	sequence := count + 1

	for {
		identifiant := fmt.Sprintf("%s-%d-%04d", prefix, year, sequence)
		var exists int64
		tx.Model(&models.Eleve{}).Where("identifiant_interne = ?", identifiant).Count(&exists)
		if exists == 0 {
			return identifiant, nil
		}
		sequence++
	}
}

// createNextClasseTx crée une nouvelle section de classe quand le quota est
// atteint (ex: "6e 1" pleine → "6e 2" créée). Dans la transaction.
//
// Convention de nommage ScolaGest (depuis 2026-07) :
//   - si le libellé finit par " <nombre>" (ex: "6e 1", "Terminale D 1"), on
//     incrémente ce nombre ;
//   - sinon (ex: "CP1", "CM2"), on ajoute " 2" (première section créée).
func (s *InscriptionWorkflowService) createNextClasseTx(tx *gorm.DB, classeID uuid.UUID) (*models.Classe, error) {
	var classe models.Classe
	if err := tx.First(&classe, "id = ?", classeID).Error; err != nil {
		return nil, errors.New("classe introuvable")
	}

	// Déléguer la génération du libellé au helper commun. siblingCount est
	// ignoré ici (on est en transaction, on ne recompte pas les siblings) :
	// on se fie à l'incrémentation du suffixe numérique du libellé courant.
	newLibelle := utils.NextClasseLibelle(classe.Libelle, 0)

	newClasse := models.Classe{
		CycleID:         classe.CycleID,
		Libelle:         newLibelle,
		Niveau:          classe.Niveau,
		EstClasseExamen: classe.EstClasseExamen,
		EffectifMax:     classe.EffectifMax,
		Actif:           true,
	}
	if err := tx.Create(&newClasse).Error; err != nil {
		return nil, err
	}
	return &newClasse, nil
}

// CheckDoublon vérifie si un élève similaire existe déjà (même nom + prénoms +
// date de naissance, ou même matricule ministériel). Retourne les élèves
// correspondants pour affichage d'alerte côté frontend.
func (s *InscriptionWorkflowService) CheckDoublon(nom, prenoms string, dateNaiss *time.Time, matricule string, etablissementID *uuid.UUID) ([]models.Eleve, error) {
	db := database.Current()
	q := db.Model(&models.Eleve{})

	if etablissementID != nil {
		q = q.Where("etablissement_id = ?", *etablissementID)
	}

	if nom != "" && dateNaiss != nil {
		// Recherche normalisée sur le nom + date naissance
		normNom := utils.Normalize(nom)
		q = q.Where("(search_vector LIKE ? AND date_naissance = ?)",
			"%"+normNom+"%", *dateNaiss)
	} else if matricule != "" {
		q = q.Where("matricule_ministere = ?", matricule)
	} else {
		return []models.Eleve{}, nil
	}

	var eleves []models.Eleve
	if err := q.Preload("Etablissement").
		Preload("Inscriptions.Classe").
		Limit(5).
		Find(&eleves).Error; err != nil {
		return nil, err
	}
	return eleves, nil
}

// NextIdentifiant génère un aperçu du prochain identifiant interne (pour
// affichage temps réel dans le wizard, avant soumission). Le numéro réel est
// potentiellement différent si un autre élève est créé entre-temps.
func (s *InscriptionWorkflowService) NextIdentifiant(etablissementID uuid.UUID) (string, error) {
	var etb models.Etablissement
	if err := database.Current().First(&etb, "id = ?", etablissementID).Error; err != nil {
		return "", errors.New("établissement introuvable")
	}
	prefix := "EPV"
	if etb.AppliqueCategorieAffecte {
		prefix = "COL"
	}
	year := time.Now().Year()
	var count int64
	database.Current().Model(&models.Eleve{}).Where("etablissement_id = ?", etablissementID).Count(&count)
	return fmt.Sprintf("%s-%d-%04d", prefix, year, count+1), nil
}
