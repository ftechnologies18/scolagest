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

// ParentService gère le portail parents (consultation des enfants, soldes, paiements).
type ParentService struct {
        soldeSvc *SoldeService
}

func NewParentService(soldeSvc *SoldeService) *ParentService {
        return &ParentService{soldeSvc: soldeSvc}
}

// EnfantParent représente un enfant vu côté parent (avec solde + classe actuelle).
type EnfantParent struct {
        ID                uuid.UUID                     `json:"id"`
        Nom               string                        `json:"nom"`
        Prenoms           string                        `json:"prenoms"`
        MatriculeMinistere string                       `json:"matricule_ministere"`
        IdentifiantInterne string                       `json:"identifiant_interne"`
        DateNaissance     *time.Time                    `json:"date_naissance"`
        Sexe              models.Sexe                   `json:"sexe"`
        PhotoURL          string                        `json:"photo_url"`
        Categorie         models.CategorieEleve         `json:"categorie"`
        Etablissement     struct {
                ID   uuid.UUID `json:"id"`
                Nom  string    `json:"nom"`
                Ville string   `json:"ville"`
        } `json:"etablissement"`
        ClasseActuelle string `json:"classe_actuelle"`
        // InscriptionStatut : statut de l'inscription courante. Si PRE_INSCRIT,
        // la classe n'est pas communiquée au parent (règle métier : la classe
        // n'est révélée qu'après paiement des frais d'inscription).
        InscriptionStatut string `json:"inscription_statut"`
        Solde          struct {
                TotalAttendu float64 `json:"total_attendu"`
                TotalPaye    float64 `json:"total_paye"`
                SoldeDu      float64 `json:"solde_du"`
        } `json:"solde"`
}

// GetTuteurIDFromUser récupère le tuteur_id d'un utilisateur (role PARENT).
func (s *ParentService) GetTuteurIDFromUser(userID uuid.UUID) (*uuid.UUID, error) {
        var user models.Utilisateur
        if err := database.Current().First(&user, "id = ?", userID).Error; err != nil {
                return nil, errors.New("utilisateur introuvable")
        }
        if user.TuteurID == nil {
                return nil, errors.New("ce compte n'est pas lié à un tuteur — accès parent refusé")
        }
        return user.TuteurID, nil
}

// ListEnfants retourne les enfants d'un parent (tuteur).
func (s *ParentService) ListEnfants(tuteurID uuid.UUID) ([]EnfantParent, error) {
        // Récupérer les élèves dont le tuteur principal est ce tuteur
        // + ceux liés via TuteurEleve (N:N)
        var eleves []models.Eleve
        database.Current().
                Preload("Etablissement").
                Where("tuteur_id = ? OR id IN (SELECT eleve_id FROM tuteur_eleves WHERE tuteur_id = ?)",
                        tuteurID, tuteurID).
                Find(&eleves)

        var result []EnfantParent
        for _, e := range eleves {
                ep := EnfantParent{
                        ID:                 e.ID,
                        Nom:                e.Nom,
                        Prenoms:            e.Prenoms,
                        MatriculeMinistere: e.MatriculeMinistere,
                        IdentifiantInterne: e.IdentifiantInterne,
                        DateNaissance:      e.DateNaissance,
                        Sexe:               e.Sexe,
                        PhotoURL:           e.PhotoURL,
                        Categorie:          e.Categorie,
                }
                if e.Etablissement != nil {
                        ep.Etablissement.ID = e.Etablissement.ID
                        ep.Etablissement.Nom = e.Etablissement.Nom
                        ep.Etablissement.Ville = e.Etablissement.Ville
                }
                // Classe actuelle (inscription de l'année active)
                // Règle métier : si l'inscription est PRE_INSCRIT (frais d'inscription
                // non payés), la classe n'est PAS communiquée au parent. Elle ne
                // sera révélée qu'après le paiement des frais d'inscription
                // (promotion PRE_INSCRIT → INSCRIT automatique au paiement).
                var annee models.AnneeScolaire
                if err := database.Current().Where("est_active = ?", true).First(&annee).Error; err == nil {
                        var ins models.Inscription
                        if err := database.Current().Preload("Classe").
                                Where("eleve_id = ? AND annee_scolaire_id = ?", e.ID, annee.ID).
                                Order("date_inscription DESC").First(&ins).Error; err == nil {
                                ep.InscriptionStatut = string(ins.Statut)
                                if ins.Classe != nil && ins.Statut != models.StatutPreInscrit {
                                        ep.ClasseActuelle = ins.Classe.Libelle
                                }
                        }
                }
                // Solde
                solde, _ := s.soldeSvc.GetSoldeEleve(e.ID)
                if solde != nil {
                        ep.Solde.TotalAttendu = solde.TotalAttendu
                        ep.Solde.TotalPaye = solde.TotalPaye
                        ep.Solde.SoldeDu = solde.SoldeDu
                }
                result = append(result, ep)
        }
        return result, nil
}

// SoldeDetailParent est le solde détaillé d'un enfant pour le parent.
type SoldeDetailParent struct {
        EleveID          uuid.UUID                    `json:"eleve_id"`
        FraisAttendus    []SoldeFrais                 `json:"frais_attendus"`
        TotalAttendu     float64                      `json:"total_attendu"`
        TotalPaye        float64                      `json:"total_paye"`
        SoldeDu          float64                      `json:"solde_du"`
        EcheancesAVenir  []EcheanceStatut             `json:"echeances_a_venir"`
}

// GetSoldeEnfant retourne le solde détaillé d'un enfant (vérifie l'accès parent).
func (s *ParentService) GetSoldeEnfant(eleveID, tuteurID uuid.UUID) (*SoldeDetailParent, error) {
        if !s.canAccessEleve(eleveID, tuteurID) {
                return nil, errors.New("accès refusé — cet élève n'est pas votre enfant")
        }
        solde, err := s.soldeSvc.GetSoldeEleve(eleveID)
        if err != nil {
                return nil, err
        }
        return &SoldeDetailParent{
                EleveID:         eleveID,
                FraisAttendus:   solde.FraisAttendus,
                TotalAttendu:    solde.TotalAttendu,
                TotalPaye:       solde.TotalPaye,
                SoldeDu:         solde.SoldeDu,
                EcheancesAVenir: solde.EcheancesAVenir,
        }, nil
}

// PaiementParent représente un paiement vu côté parent.
type PaiementParent struct {
        ID            uuid.UUID `json:"id"`
        EleveID       uuid.UUID `json:"eleve_id"`
        EleveNom      string    `json:"eleve_nom"`
        ElevePrenoms  string    `json:"eleve_prenoms"`
        Classe        string    `json:"classe"`
        Montant       float64   `json:"montant"`
        ModePaiement  string    `json:"mode_paiement"`
        DatePaiement  time.Time `json:"date_paiement"`
        NumeroRecu    string    `json:"numero_recu"`
        Statut        string    `json:"statut"`
        FraisLibelle  string    `json:"frais_libelle"`
}

// ListPaiements retourne les paiements des enfants du parent (filtrable par eleve_id).
func (s *ParentService) ListPaiements(tuteurID uuid.UUID, eleveID *uuid.UUID, limit int) ([]PaiementParent, error) {
        if limit <= 0 || limit > 100 {
                limit = 50
        }

        // Récupérer les IDs des enfants du parent
        enfants, _ := s.ListEnfants(tuteurID)
        if len(enfants) == 0 {
                return []PaiementParent{}, nil
        }
        enfantIDs := make([]uuid.UUID, len(enfants))
        enfantMap := make(map[uuid.UUID]EnfantParent)
        for i, e := range enfants {
                enfantIDs[i] = e.ID
                enfantMap[e.ID] = e
        }

        // Si eleveID fourni, vérifier l'accès et filtrer
        if eleveID != nil {
                if _, ok := enfantMap[*eleveID]; !ok {
                        return nil, errors.New("accès refusé — cet élève n'est pas votre enfant")
                }
                enfantIDs = []uuid.UUID{*eleveID}
        }

        // Récupérer les paiements
        var paiements []models.Paiement
        q := database.Current().
                Preload("Frais").
                Preload("Inscription.Classe").
                Where("eleve_id IN ?", enfantIDs).
                Order("date_paiement DESC").
                Limit(limit)
        if err := q.Find(&paiements).Error; err != nil {
                return nil, err
        }

        var result []PaiementParent
        for _, p := range paiements {
                pp := PaiementParent{
                        ID:           p.ID,
                        EleveID:      p.EleveID,
                        Montant:      p.Montant,
                        ModePaiement: string(p.ModePaiement),
                        DatePaiement: p.DatePaiement,
                        NumeroRecu:   p.NumeroRecu,
                        Statut:       string(p.Statut),
                }
                if e, ok := enfantMap[p.EleveID]; ok {
                        pp.EleveNom = e.Nom
                        pp.ElevePrenoms = e.Prenoms
                        pp.Classe = e.ClasseActuelle
                }
                if p.Frais != nil {
                        pp.FraisLibelle = p.Frais.Libelle
                }
                result = append(result, pp)
        }
        return result, nil
}

// EcheanceParent représente une échéance à venir pour un enfant du parent.
type EcheanceParent struct {
        EcheanceID   uuid.UUID `json:"echeance_id"`
        EleveID      uuid.UUID `json:"eleve_id"`
        EleveNom     string    `json:"eleve_nom"`
        Classe       string    `json:"classe"`
        Libelle      string    `json:"libelle"`
        Montant      float64   `json:"montant"`
        DateLimite   time.Time `json:"date_limite"`
        MontantPaye  float64   `json:"montant_paye"`
        Statut       string    `json:"statut"`
        JoursAvant   int       `json:"jours_avant"` // négatif si en retard
}

// ListEcheances retourne les prochaines échéances des enfants du parent.
func (s *ParentService) ListEcheances(tuteurID uuid.UUID) ([]EcheanceParent, error) {
        enfants, _ := s.ListEnfants(tuteurID)
        if len(enfants) == 0 {
                return []EcheanceParent{}, nil
        }
        enfantMap := make(map[uuid.UUID]EnfantParent)
        for _, e := range enfants {
                enfantMap[e.ID] = e
        }

        now := time.Now()
        var result []EcheanceParent
        for _, e := range enfants {
                solde, _ := s.soldeSvc.GetSoldeEleve(e.ID)
                if solde == nil {
                        continue
                }
                for _, ech := range solde.EcheancesAVenir {
                        jours := int(ech.DateLimite.Sub(now).Hours() / 24)
                        result = append(result, EcheanceParent{
                                EcheanceID:  ech.EcheanceID,
                                EleveID:     e.ID,
                                EleveNom:    e.Nom + " " + e.Prenoms,
                                Classe:      e.ClasseActuelle,
                                Libelle:     ech.Libelle,
                                Montant:     ech.Montant,
                                DateLimite:  ech.DateLimite,
                                MontantPaye: ech.MontantPaye,
                                Statut:      ech.Statut,
                                JoursAvant:  jours,
                        })
                }
        }

        // Trier par date_limite croissante et limiter à 10
        // (tri simple par insertion pour éviter d'importer sort)
        for i := 1; i < len(result); i++ {
                for j := i; j > 0 && result[j].DateLimite.Before(result[j-1].DateLimite); j-- {
                        result[j], result[j-1] = result[j-1], result[j]
                }
        }
        if len(result) > 10 {
                result = result[:10]
        }
        return result, nil
}

// GetRecu retourne le reçu d'un paiement (vérifie l'accès parent).
func (s *ParentService) GetRecu(paiementID, tuteurID uuid.UUID) (*models.Recu, error) {
        // Vérifier que le paiement appartient à un enfant du parent
        var p models.Paiement
        if err := database.Current().First(&p, "id = ?", paiementID).Error; err != nil {
                if errors.Is(err, gorm.ErrRecordNotFound) {
                        return nil, errors.New("paiement introuvable")
                }
                return nil, err
        }
        if !s.canAccessEleve(p.EleveID, tuteurID) {
                return nil, errors.New("accès refusé — ce paiement ne concerne pas votre enfant")
        }
        var recu models.Recu
        if err := database.Current().First(&recu, "paiement_id = ?", paiementID).Error; err != nil {
                return nil, fmt.Errorf("reçu introuvable: %w", err)
        }
        return &recu, nil
}

// canAccessEleve vérifie qu'un tuteur a accès à un élève (tuteur principal ou via TuteurEleve).
func (s *ParentService) canAccessEleve(eleveID, tuteurID uuid.UUID) bool {
        var count int64
        database.Current().Model(&models.Eleve{}).
                Where("id = ? AND (tuteur_id = ? OR id IN (SELECT eleve_id FROM tuteur_eleves WHERE tuteur_id = ?))",
                        eleveID, tuteurID, tuteurID).
                Count(&count)
        return count > 0
}

// CanAccessEleve vérifie qu'un tuteur a accès à un élève (public pour le handler).
func (s *ParentService) CanAccessEleve(eleveID, tuteurID uuid.UUID) bool {
        return s.canAccessEleve(eleveID, tuteurID)
}

// GetEleveEtablissementID retourne l'ID de l'établissement d'un élève.
func (s *ParentService) GetEleveEtablissementID(eleveID uuid.UUID) uuid.UUID {
        var eleve models.Eleve
        if err := database.Current().First(&eleve, "id = ?", eleveID).Error; err != nil {
                return uuid.Nil
        }
        return eleve.EtablissementID
}

// RecapCaisseData contient les données d'un récapitulatif pour paiement à l'école.
type RecapCaisseData struct {
        Etablissement struct {
                Nom          string `json:"nom"`
                CodeOfficiel string `json:"code_officiel"`
                Ville        string `json:"ville"`
                Telephone    string `json:"telephone"`
        } `json:"etablissement"`
        Eleve struct {
                Nom                string `json:"nom"`
                Prenoms            string `json:"prenoms"`
                MatriculeMinistere string `json:"matricule_ministere"`
                IdentifiantInterne string `json:"identifiant_interne"`
                Classe             string `json:"classe"`
                Categorie          string `json:"categorie"`
        } `json:"eleve"`
        Tuteur struct {
                Nom       string `json:"nom"`
                Prenoms   string `json:"prenoms"`
                Telephone string `json:"telephone"`
        } `json:"tuteur"`
        Solde struct {
                TotalAttendu float64 `json:"total_attendu"`
                TotalPaye    float64 `json:"total_paye"`
                SoldeDu      float64 `json:"solde_du"`
        } `json:"solde"`
        FraisDetail []SoldeFrais `json:"frais_detail"`
        Date        string       `json:"date"`
}

// GetRecapCaisse génère un récapitulatif imprimable pour paiement à l'école.
func (s *ParentService) GetRecapCaisse(eleveID, tuteurID uuid.UUID) (*RecapCaisseData, error) {
        if !s.canAccessEleve(eleveID, tuteurID) {
                return nil, errors.New("accès refusé — cet élève n'est pas votre enfant")
        }

        var eleve models.Eleve
        database.Current().Preload("Etablissement").First(&eleve, "id = ?", eleveID)

        var annee models.AnneeScolaire
        database.Current().Where("est_active = ?", true).First(&annee)

        var ins models.Inscription
        var classe models.Classe
        database.Current().Where("eleve_id = ? AND annee_scolaire_id = ?", eleveID, annee.ID).First(&ins)
        database.Current().First(&classe, "id = ?", ins.ClasseID)

        var tuteur models.Tuteur
        if eleve.TuteurID != nil {
                database.Current().First(&tuteur, "id = ?", *eleve.TuteurID)
        }

        solde, _ := s.soldeSvc.GetSoldeEleve(eleveID)

        recap := &RecapCaisseData{}
        recap.Date = time.Now().Format("02/01/2006")
        if eleve.Etablissement != nil {
                recap.Etablissement.Nom = eleve.Etablissement.Nom
                recap.Etablissement.CodeOfficiel = eleve.Etablissement.CodeOfficiel
                recap.Etablissement.Ville = eleve.Etablissement.Ville
                recap.Etablissement.Telephone = eleve.Etablissement.Telephone
        }
        recap.Eleve.Nom = eleve.Nom
        recap.Eleve.Prenoms = eleve.Prenoms
        recap.Eleve.MatriculeMinistere = eleve.MatriculeMinistere
        recap.Eleve.IdentifiantInterne = eleve.IdentifiantInterne
        recap.Eleve.Classe = classe.Libelle
        recap.Eleve.Categorie = string(eleve.Categorie)
        recap.Tuteur.Nom = tuteur.Nom
        recap.Tuteur.Prenoms = tuteur.Prenoms
        recap.Tuteur.Telephone = tuteur.Telephone
        if solde != nil {
                recap.Solde.TotalAttendu = solde.TotalAttendu
                recap.Solde.TotalPaye = solde.TotalPaye
                recap.Solde.SoldeDu = solde.SoldeDu
                recap.FraisDetail = solde.FraisAttendus
        }
        return recap, nil
}
