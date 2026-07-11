package services

import (
        "errors"
        "fmt"
        "time"

        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/database"
        "github.com/scolagest/backend/internal/models"
        "gorm.io/gorm"
)

// AnneeScolaireService gère les années scolaires (création, activation, clôture, réinscription).
type AnneeScolaireService struct {
        fraisSvc *FraisService
}

func NewAnneeScolaireService(fraisSvc *FraisService) *AnneeScolaireService {
        return &AnneeScolaireService{fraisSvc: fraisSvc}
}

// AnneeDTO pour création d'une année scolaire.
type AnneeDTO struct {
        Libelle       string    `json:"libelle"`
        DateDebut     time.Time `json:"date_debut"`
        DateFin       time.Time `json:"date_fin"`
        CopierFraisDe *uuid.UUID `json:"copier_frais_de"` // ID de l'année source pour reprise des frais
}

// Create crée une nouvelle année scolaire.
// Si CopierFraisDe est fourni, copie tous les frais et échéances de l'année source.
func (s *AnneeScolaireService) Create(dto AnneeDTO) (*models.AnneeScolaire, error) {
        if dto.Libelle == "" {
                return nil, errors.New("le libellé est obligatoire")
        }
        if dto.DateDebut.IsZero() || dto.DateFin.IsZero() {
                return nil, errors.New("les dates de début et fin sont obligatoires")
        }
        if !dto.DateFin.After(dto.DateDebut) {
                return nil, errors.New("la date de fin doit être postérieure à la date de début")
        }

        // Vérifier l'unicité du libellé
        var count int64
        database.Current().Model(&models.AnneeScolaire{}).Where("libelle = ?", dto.Libelle).Count(&count)
        if count > 0 {
                return nil, errors.New("une année scolaire avec ce libellé existe déjà")
        }

        annee := models.AnneeScolaire{
                Libelle:   dto.Libelle,
                DateDebut: dto.DateDebut,
                DateFin:   dto.DateFin,
                Statut:    models.AnneePreparation,
                EstActive: false,
        }
        if err := database.Current().Create(&annee).Error; err != nil {
                return nil, fmt.Errorf("création année scolaire: %w", err)
        }

        // Copier les frais de l'année source si demandé
        if dto.CopierFraisDe != nil {
                if err := s.copyFrais(*dto.CopierFraisDe, annee.ID); err != nil {
                        return nil, fmt.Errorf("copie frais: %w", err)
                }
        }

        return &annee, nil
}

// copyFrais copie tous les frais et échéances d'une année source vers la nouvelle année.
func (s *AnneeScolaireService) copyFrais(sourceAnneeID, targetAnneeID uuid.UUID) error {
        db := database.Current()

        // Récupérer les frais de l'année source (modèles génériques, eleve_id IS NULL)
        var sourceFrais []models.Frais
        db.Where("annee_scolaire_id = ?", sourceAnneeID).Find(&sourceFrais)

        copied := 0
        for _, sf := range sourceFrais {
                // Créer le nouveau frais
                newFrais := models.Frais{
                        EtablissementID:    sf.EtablissementID,
                        AnneeScolaireID:    targetAnneeID,
                        CycleID:            sf.CycleID,
                        ClasseID:           sf.ClasseID,
                        TypeFrais:          sf.TypeFrais,
                        Categorie:          sf.Categorie,
                        Libelle:            sf.Libelle,
                        MontantTotal:       sf.MontantTotal,
                        NbVersementsDefaut: sf.NbVersementsDefaut,
                        Actif:              true,
                }
                if err := db.Create(&newFrais).Error; err != nil {
                        continue // skip si doublon
                }

                // Copier les échéances
                var sourceEcheances []models.Echeance
                db.Where("frais_id = ? AND eleve_id IS NULL", sf.ID).Find(&sourceEcheances)
                for _, se := range sourceEcheances {
                        db.Create(&models.Echeance{
                                FraisID:    newFrais.ID,
                                Rang:       se.Rang,
                                Libelle:    se.Libelle,
                                Montant:    se.Montant,
                                DateLimite: se.DateLimite,
                        })
                }
                copied++
        }

        if copied == 0 {
                return errors.New("aucun frais trouvé dans l'année source")
        }
        return nil
}

// Activate définit une année comme active (désactive les autres).
func (s *AnneeScolaireService) Activate(id uuid.UUID) (*models.AnneeScolaire, error) {
        var annee models.AnneeScolaire
        if err := database.Current().First(&annee, "id = ?", id).Error; err != nil {
                return nil, errors.New("année scolaire introuvable")
        }
        if annee.Statut == models.AnneeCloturee {
                return nil, errors.New("impossible d'activer une année clôturée")
        }

        // Désactiver l'année actuellement active
        database.Current().Model(&models.AnneeScolaire{}).Where("est_active = ?", true).Update("est_active", false)

        // Activer la nouvelle
        database.Current().Model(&annee).Updates(map[string]interface{}{
                "est_active": true,
                "statut":     models.AnneeEnCours,
        })

        database.Current().First(&annee, "id = ?", id)
        return &annee, nil
}

// Close clôture une année scolaire (archivage).
func (s *AnneeScolaireService) Close(id uuid.UUID) (*models.AnneeScolaire, error) {
        var annee models.AnneeScolaire
        if err := database.Current().First(&annee, "id = ?", id).Error; err != nil {
                return nil, errors.New("année scolaire introuvable")
        }
        if annee.Statut == models.AnneeCloturee {
                return nil, errors.New("année déjà clôturée")
        }
        if annee.EstActive {
                return nil, errors.New("impossible de clôturer l'année active — activez d'abord une autre année")
        }

        database.Current().Model(&annee).Update("statut", models.AnneeCloturee)
        database.Current().First(&annee, "id = ?", id)
        return &annee, nil
}

// PromoteStudents fait passer les élèves dans la classe supérieure pour la nouvelle année.
// Accepte une liste de décisions individuelles (PROMU/REDOUBLANT/NON_REINSCRIT) par élève.
// Si decisions est vide, tous les élèves sont promus par défaut (comportement précédent).
func (s *AnneeScolaireService) PromoteStudents(ancienneAnneeID, nouvelleAnneeID uuid.UUID, decisions []EleveDecision) (*PromoteResult, error) {
        db := database.Current()

        // Vérifier les années
        var ancienne, nouvelle models.AnneeScolaire
        if err := db.First(&ancienne, "id = ?", ancienneAnneeID).Error; err != nil {
                return nil, errors.New("année source introuvable")
        }
        if err := db.First(&nouvelle, "id = ?", nouvelleAnneeID).Error; err != nil {
                return nil, errors.New("année cible introuvable")
        }

        // Récupérer toutes les classes avec leur cycle et niveau
        var classes []models.Classe
        db.Preload("Cycle").Find(&classes)

        // Construire la map de passage
        promotionMap := s.buildPromotionMap(classes)

        // Construire la map des décisions (eleve_id → décision)
        decisionMap := make(map[uuid.UUID]models.DecisionPromotion)
        for _, d := range decisions {
                decisionMap[d.EleveID] = d.Decision
        }

        // Récupérer les inscriptions de l'ancienne année
        var inscriptions []models.Inscription
        db.Where("annee_scolaire_id = ?", ancienneAnneeID).Find(&inscriptions)

        result := &PromoteResult{}
        now := time.Now()

        for _, ins := range inscriptions {
                // Vérifier que l'élève n'est pas déjà inscrit dans la nouvelle année
                var count int64
                db.Model(&models.Inscription{}).
                        Where("eleve_id = ? AND annee_scolaire_id = ?", ins.EleveID, nouvelleAnneeID).Count(&count)
                if count > 0 {
                        result.Skipped++
                        continue
                }

                // Récupérer la décision (défaut = PROMU)
                decision, hasDecision := decisionMap[ins.EleveID]
                if !hasDecision {
                        decision = models.DecisionPromu
                }

                var eleve models.Eleve
                db.First(&eleve, "id = ?", ins.EleveID)

                // Sauvegarder la décision sur l'inscription de l'ancienne année
                db.Model(&ins).Update("decision_promotion", decision)

                // Traiter selon la décision
                switch decision {
                case models.DecisionNonReinscrit:
                        // Abandon / transfert → pas de nouvelle inscription
                        result.NonReinscrits++
                        continue

                case models.DecisionRedoublant:
                        // Redoublant → réinscrit dans la MÊME classe
                        newIns := models.Inscription{
                                EleveID:         ins.EleveID,
                                EtablissementID: ins.EtablissementID,
                                ClasseID:        ins.ClasseID, // même classe
                                AnneeScolaireID: nouvelleAnneeID,
                                DateInscription: now,
                                Statut:          models.StatutReinscrit,
                        }
                        if err := db.Create(&newIns).Error; err != nil {
                                result.Erreurs++
                                continue
                        }
                        result.Redoublants++
                        continue

                case models.DecisionPromu:
                        // Promotion normale → classe supérieure
                        promo := promotionMap[ins.ClasseID]

                        if promo.IsDiplome {
                                // Classe d'examen (3e, Terminale, CM2) → diplômé
                                db.Model(&eleve).Update("statut", models.StatutEleveDiplome)
                                result.Diplomes++
                                continue
                        }

                        if promo.NouvelleClasse == uuid.Nil {
                                result.Skipped++
                                continue
                        }

                        newIns := models.Inscription{
                                EleveID:         ins.EleveID,
                                EtablissementID: ins.EtablissementID,
                                ClasseID:        promo.NouvelleClasse,
                                AnneeScolaireID: nouvelleAnneeID,
                                DateInscription: now,
                                Statut:          models.StatutReinscrit,
                        }
                        if err := db.Create(&newIns).Error; err != nil {
                                result.Erreurs++
                                continue
                        }
                        result.Promus++
                }
        }

        return result, nil
}

// EleveDecision : décision de promotion pour un élève spécifique.
type EleveDecision struct {
        EleveID  uuid.UUID                  `json:"eleve_id"`
        Decision models.DecisionPromotion   `json:"decision"` // PROMU | REDOUBLANT | NON_REINSCRIT
}

// PromoteResult contient le résultat de la promotion des élèves.
type PromoteResult struct {
        Promus         int `json:"promus"`
        Diplomes       int `json:"diplomes"`
        Redoublants    int `json:"redoublants"`
        NonReinscrits  int `json:"non_reinscrits"`
        Skipped        int `json:"skipped"`
        Erreurs        int `json:"erreurs"`
}

// PreviewPromotion génère un aperçu des élèves avec leur décision par défaut (PROMU).
// Permet à la Direction de voir tous les élèves et d'ajuster les décisions avant validation.
type PreviewEleve struct {
        EleveID        uuid.UUID `json:"eleve_id"`
        EleveNom       string    `json:"eleve_nom"`
        ElevePrenoms   string    `json:"eleve_prenoms"`
        ClasseActuelle string    `json:"classe_actuelle"`
        ClasseSuivante string    `json:"classe_suivante"` // vide si diplôme
        EstDiplome     bool       `json:"est_diplome"`
        Decision       string     `json:"decision"` // PROMU (défaut)
}

// PreviewPromotion retourne la liste de tous les élèves avec leur classe actuelle et suivante.
func (s *AnneeScolaireService) PreviewPromotion(ancienneAnneeID uuid.UUID) ([]PreviewEleve, error) {
        db := database.Current()

        // Récupérer les classes
        var classes []models.Classe
        db.Preload("Cycle").Find(&classes)
        promotionMap := s.buildPromotionMap(classes)
        classeByID := make(map[uuid.UUID]models.Classe)
        for _, c := range classes {
                classeByID[c.ID] = c
        }

        // Récupérer les inscriptions de l'ancienne année
        var inscriptions []models.Inscription
        db.Where("annee_scolaire_id = ?", ancienneAnneeID).Find(&inscriptions)

        var result []PreviewEleve
        for _, ins := range inscriptions {
                var eleve models.Eleve
                if err := db.First(&eleve, "id = ?", ins.EleveID).Error; err != nil {
                        continue
                }
                if eleve.Statut != models.StatutEleveActif {
                        continue
                }

                classeActuelle := classeByID[ins.ClasseID]
                promo := promotionMap[ins.ClasseID]

                pe := PreviewEleve{
                        EleveID:        eleve.ID,
                        EleveNom:       eleve.Nom,
                        ElevePrenoms:   eleve.Prenoms,
                        ClasseActuelle: classeActuelle.Libelle,
                        Decision:       string(models.DecisionPromu),
                }

                if promo.IsDiplome {
                        pe.EstDiplome = true
                        pe.ClasseSuivante = "(diplôme)"
                } else if promo.NouvelleClasse != uuid.Nil {
                        pe.ClasseSuivante = classeByID[promo.NouvelleClasse].Libelle
                }

                result = append(result, pe)
        }

        return result, nil
}

// buildPromotionMap construit la map de passage de classe.
// Retourne: map[classeID] → {nouvelleClasseID, isDiplome}
// isDiplome = true si l'élève est en classe d'examen (dernière du cycle).
func (s *AnneeScolaireService) buildPromotionMap(classes []models.Classe) map[uuid.UUID]struct {
        NouvelleClasse uuid.UUID
        IsDiplome      bool
} {
        // Grouper par cycle et trier par niveau
        byCycle := make(map[uuid.UUID][]models.Classe)
        for _, c := range classes {
                byCycle[c.CycleID] = append(byCycle[c.CycleID], c)
        }

        result := make(map[uuid.UUID]struct {
                NouvelleClasse uuid.UUID
                IsDiplome      bool
        })

        for cycleID, cycleClasses := range byCycle {
                // Trier par niveau croissant
                for i := 0; i < len(cycleClasses); i++ {
                        for j := i + 1; j < len(cycleClasses); j++ {
                                if cycleClasses[j].Niveau < cycleClasses[i].Niveau {
                                        cycleClasses[i], cycleClasses[j] = cycleClasses[j], cycleClasses[i]
                                }
                        }
                }

                for i, c := range cycleClasses {
                        if i < len(cycleClasses)-1 {
                                // Passer à la classe suivante
                                result[c.ID] = struct {
                                        NouvelleClasse uuid.UUID
                                        IsDiplome      bool
                                }{cycleClasses[i+1].ID, false}
                        } else {
                                // Dernière classe du cycle → diplôme
                                result[c.ID] = struct {
                                        NouvelleClasse uuid.UUID
                                        IsDiplome      bool
                                }{uuid.Nil, true}
                        }
                }
                _ = cycleID
        }

        return result
}

// GetStats retourne les statistiques d'une année scolaire.
type AnneeStats struct {
        NbEleves     int64 `json:"nb_eleves"`
        NbInscriptions int64 `json:"nb_inscriptions"`
        NbClasses    int64 `json:"nb_classes"`
        NbFrais      int64 `json:"nb_frais"`
}

// GetStats calcule les statistiques d'une année scolaire.
func (s *AnneeScolaireService) GetStats(anneeID uuid.UUID) (*AnneeStats, error) {
        stats := &AnneeStats{}
        db := database.Current()

        db.Model(&models.Inscription{}).Where("annee_scolaire_id = ?", anneeID).Count(&stats.NbInscriptions)
        db.Model(&models.Inscription{}).Where("annee_scolaire_id = ?", anneeID).Distinct("eleve_id").Count(&stats.NbEleves)
        db.Model(&models.Frais{}).Where("annee_scolaire_id = ?", anneeID).Count(&stats.NbFrais)

        return stats, nil
}

// s'assurer que gorm est importé
var _ = gorm.ErrRecordNotFound
