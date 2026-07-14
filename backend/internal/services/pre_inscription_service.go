package services

import (
        "crypto/rand"
        "encoding/hex"
        "errors"
        "fmt"
        "time"

        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/database"
        "github.com/scolagest/backend/internal/models"
        "gorm.io/gorm"
)

// PreInscriptionService gère le cycle de vie des pré-inscriptions en ligne
// soumises par les parents (sans compte) : soumission publique, consultation
// par token de suivi, listing staff, validation (conversion en élève).
type PreInscriptionService struct {
        workflowSvc *InscriptionWorkflowService
        notifSvc    *NotificationService
}

func NewPreInscriptionService(workflowSvc *InscriptionWorkflowService, notifSvc *NotificationService) *PreInscriptionService {
        return &PreInscriptionService{workflowSvc: workflowSvc, notifSvc: notifSvc}
}

// PreInscriptionDTO : payload de soumission publique (parent).
type PreInscriptionDTO struct {
        EtablissementID string `json:"etablissement_id"`

        EleveNom           string `json:"eleve_nom"`
        ElevePrenoms       string `json:"eleve_prenoms"`
        EleveDateNaissance string `json:"eleve_date_naissance"` // YYYY-MM-DD
        EleveLieuNaissance string `json:"eleve_lieu_naissance"`
        EleveSexe          string `json:"eleve_sexe"`
        EleveCategorie     string `json:"eleve_categorie"`
        EleveNationalite   string `json:"eleve_nationalite"`

        // Scolarité antérieure (transfert)
        EleveAncienEtablissement   string `json:"eleve_ancien_etablissement"`
        EleveStatutAnneePrecedente string `json:"eleve_statut_annee_precedente"`

        // Santé
        EleveAllergies  string `json:"eleve_allergies"`
        EleveNotesSante string `json:"eleve_notes_sante"`

        TuteurNom         string `json:"tuteur_nom"`
        TuteurPrenoms     string `json:"tuteur_prenoms"`
        TuteurTelephone   string `json:"tuteur_telephone"`
        TuteurTelephone2  string `json:"tuteur_telephone_urgence"` // contact d'urgence
        TuteurEmail       string `json:"tuteur_email"`
        TuteurLienParente string `json:"tuteur_lien_parente"`
        TuteurAdresse     string `json:"tuteur_adresse"`     // quartier d'habitation
        TuteurProfession  string `json:"tuteur_profession"`

        ClasseID       string `json:"classe_id"` // @deprecated : non envoyé par le wizard depuis la réforme 2026-07 (classe attribuée par le staff). Conservé pour compat ascendante.
        CycleID        string `json:"cycle_id"`  // cycle souhaité par le parent (UUID)
        Niveau         string `json:"niveau"`    // niveau souhaité dans le cycle (ordinal 1..n, en string)
        NotesParent    string `json:"notes_parent"`
}

// Submit crée une nouvelle pré-inscription (route publique, sans auth).
// Génère un token de suivi unique pour que le parent consulte l'état.
func (s *PreInscriptionService) Submit(dto PreInscriptionDTO) (*models.PreInscription, string, error) {
        etbID, err := uuid.Parse(dto.EtablissementID)
        if err != nil {
                return nil, "", errors.New("établissement invalide")
        }

        // Validations basiques
        if dto.EleveNom == "" || dto.TuteurNom == "" || dto.TuteurTelephone == "" {
                return nil, "", errors.New("nom de l'élève, nom et téléphone du tuteur sont requis")
        }

        // Vérifier que l'établissement existe et est actif
        var etb models.Etablissement
        if err := database.Current().First(&etb, "id = ? AND actif = ?", etbID, true).Error; err != nil {
                return nil, "", errors.New("établissement introuvable ou inactif")
        }

        // Parse date naissance
        var dateNaiss *time.Time
        if dto.EleveDateNaissance != "" {
                if t, err := time.Parse("2006-01-02", dto.EleveDateNaissance); err == nil {
                        dateNaiss = &t
                }
        }

        // Catégorie : forcer NON_APPLICABLE si l'établissement n'applique pas
        categorie := models.CategorieEleve(dto.EleveCategorie)
        if !etb.AppliqueCategorieAffecte {
                categorie = models.CategorieNonApplicable
        }

        // Classe optionnelle (@deprecated — non envoyé par le wizard depuis la
        // réforme 2026-07, mais conservé pour compat ascendante)
        var classeID *uuid.UUID
        if dto.ClasseID != "" {
                if id, err := uuid.Parse(dto.ClasseID); err == nil {
                        classeID = &id
                }
        }

        // Préférence cycle + niveau (réforme 2026-07) : le parent exprime une
        // préférence qui sera utilisée par le staff pour pré-filtrer la cascade
        // lors de la validation. Cycle et niveau sont optionnels côté backend
        // (le wizard les rend obligatoires côté UI).
        var cycleID *uuid.UUID
        if dto.CycleID != "" {
                if id, err := uuid.Parse(dto.CycleID); err == nil {
                        cycleID = &id
                }
        }
        var niveauSouhaite *int
        if dto.Niveau != "" {
                var n int
                if _, err := fmt.Sscanf(dto.Niveau, "%d", &n); err == nil && n > 0 {
                        niveauSouhaite = &n
                }
        }

        token, err := generateToken(16)
        if err != nil {
                return nil, "", err
        }

        pre := models.PreInscription{
                EtablissementID:          etbID,
                Statut:                   models.StatutPreSoumise,
                TokenSuivi:               token,
                DateSoumission:           time.Now(),
                EleveNom:                 dto.EleveNom,
                ElevePrenoms:             dto.ElevePrenoms,
                EleveDateNaissance:       dateNaiss,
                EleveLieuNaissance:       dto.EleveLieuNaissance,
                EleveSexe:                models.Sexe(dto.EleveSexe),
                EleveCategorie:           categorie,
                EleveNationalite:         dto.EleveNationalite,
                EleveAncienEtablissement: dto.EleveAncienEtablissement,
                EleveStatutAnneePrecedente: models.StatutAnneePrecedente(dto.EleveStatutAnneePrecedente),
                EleveAllergies:           dto.EleveAllergies,
                EleveNotesSante:          dto.EleveNotesSante,
                TuteurNom:                dto.TuteurNom,
                TuteurPrenoms:            dto.TuteurPrenoms,
                TuteurTelephone:          dto.TuteurTelephone,
                TuteurTelephone2:         dto.TuteurTelephone2,
                TuteurEmail:              dto.TuteurEmail,
                TuteurLienParente:        models.LienParente(dto.TuteurLienParente),
                TuteurAdresse:            dto.TuteurAdresse,
                TuteurProfession:         dto.TuteurProfession,
                ClasseID:                 classeID,
                CycleID:                  cycleID,
                NiveauSouhaite:           niveauSouhaite,
                NotesParent:              dto.NotesParent,
        }

        if err := database.Current().Create(&pre).Error; err != nil {
                return nil, "", fmt.Errorf("création pré-inscription: %w", err)
        }

        // Notification email au parent (si email fourni)
        if s.notifSvc != nil && dto.TuteurEmail != "" {
                suiviURL := "/pre-inscription/suivi?token=" + token
                parentNom := dto.TuteurPrenoms + " " + dto.TuteurNom
                s.notifSvc.NotifyParentPreInscriptionSoumise(dto.TuteurEmail, parentNom, dto.EleveNom, suiviURL)
        }

        return &pre, token, nil
}

// GetByToken retourne une pré-inscription par son token de suivi (route
// publique pour le suivi parent). Ne renvoie pas les notes staff.
func (s *PreInscriptionService) GetByToken(token string) (*models.PreInscription, error) {
        var pre models.PreInscription
        if err := database.Current().
                Preload("Etablissement").
                Preload("Classe").
                Preload("Cycle").
                First(&pre, "token_suivi = ?", token).Error; err != nil {
                if errors.Is(err, gorm.ErrRecordNotFound) {
                        return nil, errors.New("pré-inscription introuvable")
                }
                return nil, err
        }
        return &pre, nil
}

// List retourne les pré-inscriptions d'un établissement (route staff).
// Filtre optionnel par statut. Déclenche aussi l'auto-transition des
// pré-inscriptions SOUMISES de plus de 24h vers EN_REVUE (lazy, sur accès).
func (s *PreInscriptionService) List(etablissementID uuid.UUID, statut *models.StatutPreInscription) ([]models.PreInscription, error) {
        // Auto-transition SOUMISE → EN_REVUE après 24h
        s.autoTransitionEnRevue(etablissementID)

        q := database.Current().Model(&models.PreInscription{}).
                Where("etablissement_id = ?", etablissementID)
        if statut != nil {
                q = q.Where("statut = ?", *statut)
        }
        var pres []models.PreInscription
        if err := q.Preload("Classe").Preload("Cycle").
                Order("date_soumission DESC").
                Find(&pres).Error; err != nil {
                return nil, err
        }
        return pres, nil
}

// CountSoumises retourne le nombre de pré-inscriptions SOUMISES non traitées
// (pour le badge de notifications sur la sidebar staff).
func (s *PreInscriptionService) CountSoumises(etablissementID uuid.UUID) (int64, error) {
        var count int64
        err := database.Current().Model(&models.PreInscription{}).
                Where("etablissement_id = ? AND statut IN ?", etablissementID,
                        []models.StatutPreInscription{models.StatutPreSoumise, models.StatutPreEnRevue}).
                Count(&count).Error
        return count, err
}

// autoTransitionEnRevue fait passer les pré-inscriptions SOUMISES de plus de
// 24h au statut EN_REVUE. Exécuté lazy (sur List), évite d'avoir un cron.
func (s *PreInscriptionService) autoTransitionEnRevue(etablissementID uuid.UUID) {
        seuil := time.Now().Add(-24 * time.Hour)
        database.Current().Model(&models.PreInscription{}).
                Where("etablissement_id = ? AND statut = ? AND date_soumission < ?",
                        etablissementID, models.StatutPreSoumise, seuil).
                Update("statut", models.StatutPreEnRevue)
}

// SearchTuteurByPhone recherche un tuteur existant par téléphone (route
// publique, pour la détection fratrie sur le formulaire de pré-inscription).
// Retourne le tuteur + ses élèves existants (sans données sensibles) si trouvé.
// Permet au parent de pré-remplir les champs tuteur s'il a déjà un enfant inscrit.
func (s *PreInscriptionService) SearchTuteurByPhone(telephone string) (*TuteurFratrieResult, error) {
        if telephone == "" {
                return nil, errors.New("téléphone requis")
        }
        normalizedTel := normalizePhoneReset(telephone)

        var tuteur models.Tuteur
        err := database.Current().Where(
                "REPLACE(REPLACE(REPLACE(REPLACE(telephone, ' ', ''), '+', ''), '-', ''), '.', '') = ? OR telephone = ?",
                normalizedTel, telephone,
        ).First(&tuteur).Error
        if errors.Is(err, gorm.ErrRecordNotFound) {
                return &TuteurFratrieResult{Found: false}, nil
        }
        if err != nil {
                return nil, err
        }

        // Récupérer les élèves de ce tuteur (noms seulement, pas de données sensibles)
        var eleves []models.Eleve
        database.Current().Where("tuteur_id = ?", tuteur.ID).
                Order("nom ASC").Limit(10).
                Find(&eleves)

        elevesLite := make([]EleveLite, 0, len(eleves))
        for _, e := range eleves {
                elevesLite = append(elevesLite, EleveLite{
                        Nom:     e.Nom,
                        Prenoms: e.Prenoms,
                })
        }

        return &TuteurFratrieResult{
                Found:    true,
                Tuteur: TuteurLite{
                        Nom:         tuteur.Nom,
                        Prenoms:     tuteur.Prenoms,
                        Telephone:   tuteur.Telephone,
                        Email:       tuteur.Email,
                        LienParente: string(tuteur.LienParente),
                },
                Eleves: elevesLite,
        }, nil
}

// TuteurFratrieResult : résultat de la recherche fratrie (route publique).
// Ne contient que des données non sensibles (pas d'ID, pas de PIN hash).
type TuteurFratrieResult struct {
        Found  bool         `json:"found"`
        Tuteur TuteurLite   `json:"tuteur"`
        Eleves []EleveLite  `json:"eleves"`
}

type TuteurLite struct {
        Nom         string `json:"nom"`
        Prenoms     string `json:"prenoms"`
        Telephone   string `json:"telephone"`
        Email       string `json:"email"`
        LienParente string `json:"lien_parente"`
}

type EleveLite struct {
        Nom     string `json:"nom"`
        Prenoms string `json:"prenoms"`
}

// Get retourne une pré-inscription par ID (route staff).
func (s *PreInscriptionService) Get(id uuid.UUID) (*models.PreInscription, error) {
        var pre models.PreInscription
        if err := database.Current().
                Preload("Etablissement").
                Preload("Classe").
                Preload("Cycle").
                First(&pre, "id = ?", id).Error; err != nil {
                return nil, errors.New("pré-inscription introuvable")
        }
        return &pre, nil
}

// Valider convertit une pré-inscription en élève + inscription réels via le
// workflow existant. Le staff peut ajuster la classe et l'année avant validation.
// La pré-inscription passe au statut VALIDEE et est liée à l'élève créé.
func (s *PreInscriptionService) Valider(id uuid.UUID, classeID uuid.UUID, anneeID uuid.UUID, userID uuid.UUID, notes string) (*WorkflowResult, error) {
        pre, err := s.Get(id)
        if err != nil {
                return nil, err
        }
        if pre.Statut == models.StatutPreValidee {
                return nil, errors.New("cette pré-inscription a déjà été validée")
        }

        // Construire le DTO du workflow à partir des données de la pré-inscription
        workflowDTO := WorkflowDTO{
                Eleve: WorkflowEleveDTO{
                        Nom:               pre.EleveNom,
                        Prenoms:           pre.ElevePrenoms,
                        DateNaissance:     pre.EleveDateNaissance,
                        LieuNaissance:     pre.EleveLieuNaissance,
                        Sexe:              pre.EleveSexe,
                        Categorie:         pre.EleveCategorie,
                },
                Tuteur: WorkflowTuteurDTO{
                        Nom:         pre.TuteurNom,
                        Prenoms:     pre.TuteurPrenoms,
                        Telephone:   pre.TuteurTelephone,
                        Email:       pre.TuteurEmail,
                        LienParente: pre.TuteurLienParente,
                },
                Inscription: WorkflowInscriptionDTO{
                        ClasseID:        classeID,
                        AnneeScolaireID: anneeID,
                        // PRE_INSCRIT : l'inscription ne devient INSCRIT qu'après
                        // le paiement des frais d'inscription à la caisse.
                        Statut:          models.StatutPreInscrit,
                },
        }

        // Exécuter le workflow transactionnel
        result, err := s.workflowSvc.Create(workflowDTO, pre.EtablissementID, userID)
        if err != nil {
                return nil, err
        }

        // Marquer la pré-inscription comme validée
        now := time.Now()
        updates := map[string]interface{}{
                "statut":         models.StatutPreValidee,
                "date_traitement": &now,
                "traite_par":      userID,
                "eleve_cree_id":   result.Eleve.ID,
                "notes_staff":     notes,
        }
        database.Current().Model(&models.PreInscription{}).Where("id = ?", id).Updates(updates)

        // Notification email au parent (validation)
        if s.notifSvc != nil && pre.TuteurEmail != "" {
                parentNom := pre.TuteurPrenoms + " " + pre.TuteurNom
                classeLibelle := ""
                if result.Inscription != nil && result.Inscription.Classe != nil {
                        classeLibelle = result.Inscription.Classe.Libelle
                }
                s.notifSvc.NotifyParentPreInscriptionValidee(pre.TuteurEmail, parentNom, pre.EleveNom, result.Eleve.IdentifiantInterne, classeLibelle)
        }

        return result, nil
}

// Rejeter marque une pré-inscription comme rejetée (avec motif).
func (s *PreInscriptionService) Rejeter(id uuid.UUID, userID uuid.UUID, motif string) error {
        // Récupérer la pré-inscription AVANT de la marquer rejetée (pour l'email)
        pre, err := s.Get(id)
        if err != nil {
                return err
        }

        now := time.Now()
        if err := database.Current().Model(&models.PreInscription{}).
                Where("id = ?", id).
                Updates(map[string]interface{}{
                        "statut":          models.StatutPreRejetee,
                        "date_traitement": &now,
                        "traite_par":      userID,
                        "notes_staff":     motif,
                }).Error; err != nil {
                return err
        }

        // Notification email au parent (rejet)
        if s.notifSvc != nil && pre.TuteurEmail != "" {
                parentNom := pre.TuteurPrenoms + " " + pre.TuteurNom
                s.notifSvc.NotifyParentPreInscriptionRejetee(pre.TuteurEmail, parentNom, pre.EleveNom, motif)
        }

        return nil
}

// generateToken génère un token hexadécimal aléatoire sécurisé.
func generateToken(bytes int) (string, error) {
        b := make([]byte, bytes)
        if _, err := rand.Read(b); err != nil {
                return "", err
        }
        return hex.EncodeToString(b), nil
}
