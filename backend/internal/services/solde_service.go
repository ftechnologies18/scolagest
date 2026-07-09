package services

import (
        "time"

        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/database"
        "github.com/scolagest/backend/internal/models"
)

// SoldeService calcule les soldes dus par élève en temps réel.
type SoldeService struct{}

func NewSoldeService() *SoldeService { return &SoldeService{} }

// SoldeFrais représente le solde pour un type de frais d'un élève.
type SoldeFrais struct {
        FraisID          uuid.UUID           `json:"frais_id"`
        TypeFrais        models.TypeFrais    `json:"type_frais"`
        Libelle          string              `json:"libelle"`
        MontantAttendu   float64             `json:"montant_attendu"`
        MontantPaye      float64             `json:"montant_paye"`
        Solde            float64             `json:"solde"`
}

// EcheanceStatut représente le statut d'une échéance pour un élève.
type EcheanceStatut struct {
        EcheanceID   uuid.UUID        `json:"echeance_id"`
        Rang         int              `json:"rang"`
        Libelle      string           `json:"libelle"`
        Montant      float64          `json:"montant"`
        DateLimite   time.Time        `json:"date_limite"`
        MontantPaye  float64          `json:"montant_paye"`
        Statut       string           `json:"statut"` // PAYE | PARTIEL | EN_RETARD | A_VENIR
}

// SoldeEleve est le solde complet d'un élève.
type SoldeEleve struct {
        EleveID          uuid.UUID        `json:"eleve_id"`
        FraisAttendus    []SoldeFrais     `json:"frais_attendus"`
        TotalAttendu     float64          `json:"total_attendu"`
        TotalPaye        float64          `json:"total_paye"`
        SoldeDu          float64          `json:"solde_du"`
        EcheancesAVenir  []EcheanceStatut `json:"echeances_a_venir"`
}

// GetSoldeEleve calcule le solde d'un élève pour l'année active.
func (s *SoldeService) GetSoldeEleve(eleveID uuid.UUID) (*SoldeEleve, error) {
        // 1. Récupérer l'élève + son inscription active (classe + année)
        var eleve models.Eleve
        if err := database.DB.First(&eleve, "id = ?", eleveID).Error; err != nil {
                return nil, err
        }

        // Annee active
        var annee models.AnneeScolaire
        if err := database.DB.Where("est_active = ?", true).First(&annee).Error; err != nil {
                return nil, err
        }

        // Inscription active = la plus récente pour l'année active
        var inscription models.Inscription
        if err := database.DB.Where("eleve_id = ? AND annee_scolaire_id = ?", eleveID, annee.ID).
                Order("date_inscription DESC").First(&inscription).Error; err != nil {
                // Pas d'inscription → solde vide
                return &SoldeEleve{EleveID: eleveID}, nil
        }

        // 2. Trouver les frais applicables : résolution classe → cycle → établissement
        frais, err := s.findApplicableFrais(eleve.EtablissementID, annee.ID, inscription.ClasseID, eleve.Categorie)
        if err != nil {
                return nil, err
        }

        // 3. Pour chaque frais, calculer attendu + payé + échéances
        result := &SoldeEleve{EleveID: eleveID}
        for _, f := range frais {
                // Échéances : dérogatoire (eleve_id renseigné) si existe, sinon générique
                echeances := s.findEcheances(f.ID, eleveID)

                // Montant attendu = somme des échéances (ou montant_total si pas d'échéances)
                attendu := f.MontantTotal
                if len(echeances) > 0 {
                        attendu = 0
                        for _, e := range echeances {
                                attendu += e.Montant
                        }
                }

                // Montant payé = somme des paiements valides pour ce frais
                var paye float64
                database.DB.Model(&models.Paiement{}).
                        Where("eleve_id = ? AND frais_id = ? AND statut = ?", eleveID, f.ID, models.StatutPaiementValide).
                        Select("COALESCE(SUM(montant), 0)").Scan(&paye)

                result.FraisAttendus = append(result.FraisAttendus, SoldeFrais{
                        FraisID:        f.ID,
                        TypeFrais:      f.TypeFrais,
                        Libelle:        f.Libelle,
                        MontantAttendu: attendu,
                        MontantPaye:    paye,
                        Solde:          attendu - paye,
                })
                result.TotalAttendu += attendu
                result.TotalPaye += paye

                // Statut des échéances
                for _, e := range echeances {
                        var echeancePaye float64
                        database.DB.Model(&models.Paiement{}).
                                Where("eleve_id = ? AND echeance_id = ? AND statut = ?", eleveID, e.ID, models.StatutPaiementValide).
                                Select("COALESCE(SUM(montant), 0)").Scan(&echeancePaye)

                        statut := "A_VENIR"
                        if echeancePaye >= e.Montant {
                                statut = "PAYE"
                        } else if echeancePaye > 0 {
                                statut = "PARTIEL"
                        } else if time.Now().After(e.DateLimite) {
                                statut = "EN_RETARD"
                        }

                        // Inclure dans échéances à venir si non payé
                        if statut != "PAYE" {
                                result.EcheancesAVenir = append(result.EcheancesAVenir, EcheanceStatut{
                                        EcheanceID:  e.ID,
                                        Rang:        e.Rang,
                                        Libelle:     e.Libelle,
                                        Montant:     e.Montant,
                                        DateLimite:  e.DateLimite,
                                        MontantPaye: echeancePaye,
                                        Statut:      statut,
                                })
                        }
                }
        }

        result.SoldeDu = result.TotalAttendu - result.TotalPaye
        return result, nil
}

// SoldeListItem est un élément de la liste des soldes (par classe/catégorie/statut).
type SoldeListItem struct {
        EleveID       uuid.UUID `json:"eleve_id"`
        EleveNom      string    `json:"eleve_nom"`
        ElevePrenoms  string    `json:"eleve_prenoms"`
        Classe        string    `json:"classe"`
        TotalAttendu  float64   `json:"total_attendu"`
        TotalPaye     float64   `json:"total_paye"`
        SoldeDu       float64   `json:"solde_du"`
        Statut        string    `json:"statut"` // SOLDE | IMPAYE | AVANCE
}

// ListSoldes retourne les soldes des élèves filtrés par classe/catégorie/statut.
func (s *SoldeService) ListSoldes(etablissementID uuid.UUID, classeID *uuid.UUID, categorie *models.CategorieEleve) ([]SoldeListItem, error) {
        var annee models.AnneeScolaire
        if err := database.DB.Where("est_active = ?", true).First(&annee).Error; err != nil {
                return nil, nil
        }

        // Récupérer les élèves inscrits cette année
        q := database.DB.Model(&models.Eleve{}).
                Select("eleves.id, eleves.nom, eleves.prenoms, eleves.categorie, classes.libelle as classe").
                Joins("JOIN inscriptions ON inscriptions.eleve_id = eleves.id").
                Joins("JOIN classes ON classes.id = inscriptions.classe_id").
                Where("inscriptions.annee_scolaire_id = ? AND eleves.etablissement_id = ?", annee.ID, etablissementID)

        if classeID != nil {
                q = q.Where("inscriptions.classe_id = ?", *classeID)
        }
        if categorie != nil {
                q = q.Where("eleves.categorie = ?", *categorie)
        }

        type eleveRow struct {
                ID        uuid.UUID
                Nom       string
                Prenoms   string
                Classe    string
        }
        var rows []eleveRow
        if err := q.Scan(&rows).Error; err != nil {
                return nil, err
        }

        var result []SoldeListItem
        for _, r := range rows {
                solde, _ := s.GetSoldeEleve(r.ID)
                statut := "SOLDE"
                if solde.SoldeDu > 0.01 {
                        statut = "IMPAYE"
                } else if solde.SoldeDu < -0.01 {
                        statut = "AVANCE"
                }
                result = append(result, SoldeListItem{
                        EleveID:      r.ID,
                        EleveNom:     r.Nom,
                        ElevePrenoms: r.Prenoms,
                        Classe:       r.Classe,
                        TotalAttendu: solde.TotalAttendu,
                        TotalPaye:    solde.TotalPaye,
                        SoldeDu:      solde.SoldeDu,
                        Statut:       statut,
                })
        }
        return result, nil
}

// findApplicableFrais résout les frais applicables à un élève :
// priorité classe > cycle > établissement, filtré par catégorie ET par cycle/classe.
// Un frais de niveau classe ne s'applique qu'à cette classe ;
// un frais de niveau cycle ne s'applique qu'à ce cycle ;
// un frais de niveau établissement s'applique à tous.
func (s *SoldeService) findApplicableFrais(etablissementID, anneeID uuid.UUID, classeID uuid.UUID, categorie models.CategorieEleve) ([]models.Frais, error) {
        // Récupérer le cycle de la classe de l'élève
        var classe models.Classe
        if err := database.DB.First(&classe, "id = ?", classeID).Error; err != nil {
                return nil, err
        }
        eleveCycleID := classe.CycleID

        var allFrais []models.Frais
        database.DB.Where("etablissement_id = ? AND annee_scolaire_id = ? AND actif = ?", etablissementID, anneeID, true).
                Find(&allFrais)

        // Filtrer : ne garder que les frais applicables à cet élève (cycle/classe matchant)
        var applicable []models.Frais
        for _, f := range allFrais {
                if f.ClasseID != nil {
                        // Frais niveau classe → ne s'applique que si la classe matche
                        if *f.ClasseID != classeID {
                                continue
                        }
                } else if f.CycleID != nil {
                        // Frais niveau cycle → ne s'applique que si le cycle matche
                        if *f.CycleID != eleveCycleID {
                                continue
                        }
                }
                // Frais niveau établissement (cycle_id et classe_id null) → s'applique à tous

                // Filtrer par catégorie : si le frais a une catégorie, elle doit matcher l'élève
                if f.Categorie != nil && *f.Categorie != categorie {
                        continue
                }
                applicable = append(applicable, f)
        }

        // Pour chaque (type_frais, categorie), garder le plus spécifique (classe > cycle > établissement)
        type key struct {
                typeFrais models.TypeFrais
                categorie *models.CategorieEleve
        }
        specificity := func(f models.Frais) int {
                if f.ClasseID != nil {
                        return 3
                }
                if f.CycleID != nil {
                        return 2
                }
                return 1
        }

        best := make(map[key]models.Frais)
        for _, f := range applicable {
                k := key{typeFrais: f.TypeFrais, categorie: f.Categorie}
                if existing, ok := best[k]; !ok || specificity(f) > specificity(existing) {
                        best[k] = f
                }
        }

        var result []models.Frais
        for _, f := range best {
                result = append(result, f)
        }
        return result, nil
}

// findEcheances retourne les échéances d'un frais pour un élève :
// dérogatoires (eleve_id = eleveID) si elles existent, sinon génériques.
func (s *SoldeService) findEcheances(fraisID, eleveID uuid.UUID) []models.Echeance {
        // D'abord chercher les échéances dérogatoires
        var derogatory []models.Echeance
        database.DB.Where("frais_id = ? AND eleve_id = ?", fraisID, eleveID).Order("rang ASC").Find(&derogatory)
        if len(derogatory) > 0 {
                return derogatory
        }
        // Sinon les échéances génériques
        var generic []models.Echeance
        database.DB.Where("frais_id = ? AND eleve_id IS NULL", fraisID).Order("rang ASC").Find(&generic)
        return generic
}
