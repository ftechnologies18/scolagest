package services

import (
        "time"

        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/database"
        "github.com/scolagest/backend/internal/models"
)

// StatsService calcule les statistiques pour le tableau de bord et les rapports.
type StatsService struct {
        soldeSvc *SoldeService
}

func NewStatsService(soldeSvc *SoldeService) *StatsService {
        return &StatsService{soldeSvc: soldeSvc}
}

// DashboardData est la structure complète du tableau de bord.
type DashboardData struct {
        KPIs             DashboardKPIs       `json:"kpis"`
        ParCycle         []RepartitionItem   `json:"par_cycle"`
        ParClasse        []RepartitionItem   `json:"par_classe"`
        ParCategorie     []RepartitionItem   `json:"par_categorie"`
        ParModePaiement  []RepartitionMode   `json:"par_mode_paiement"`
        EvolutionMensuelle []EvolutionItem   `json:"evolution_mensuelle"`
        DerniersPaiements []models.Paiement  `json:"derniers_paiements"`
}

// DashboardKPIs contient les indicateurs clés du tableau de bord.
type DashboardKPIs struct {
        TotalEncaisse   float64 `json:"total_encaisse"`
        TotalAttendu    float64 `json:"total_attendu"`
        TauxRecouvrement float64 `json:"taux_recouvrement"`
        NbImpayes       int     `json:"nb_impayes"`
        NbEleves        int     `json:"nb_eleves"`
        NbPaiementsJour int     `json:"nb_paiements_jour"`
        MontantJour     float64 `json:"montant_jour"`
}

// RepartitionItem représente une ligne de répartition (par cycle/classe/catégorie).
type RepartitionItem struct {
        Label     string  `json:"label"`
        Attendu   float64 `json:"attendu"`
        Encaisse  float64 `json:"encaisse"`
        Taux      float64 `json:"taux"`
        NbEleves  int     `json:"nb_eleves"`
}

// RepartitionMode représente la répartition par mode de paiement.
type RepartitionMode struct {
        Mode   string  `json:"mode"`
        Montant float64 `json:"montant"`
        Count  int     `json:"count"`
}

// EvolutionItem représente un point de l'évolution mensuelle.
type EvolutionItem struct {
        Mois    string  `json:"mois"`
        Montant float64 `json:"montant"`
}

// GetDashboard calcule toutes les données du tableau de bord.
func (s *StatsService) GetDashboard(etablissementID uuid.UUID, dateDebut, dateFin *time.Time) (*DashboardData, error) {
        var annee models.AnneeScolaire
        if err := database.DB.Where("est_active = ?", true).First(&annee).Error; err != nil {
                return nil, err
        }

        // Période par défaut : depuis le début de l'année civile jusqu'à maintenant
        // (les paiements peuvent dater d'avant la rentrée scolaire de septembre)
        now := time.Now()
        if dateDebut == nil {
                firstDay := time.Date(now.Year(), 1, 1, 0, 0, 0, 0, now.Location())
                dateDebut = &firstDay
        }
        if dateFin == nil {
                dateFin = &now
        }

        data := &DashboardData{}

        // 1. KPIs
        data.KPIs = s.computeKPIs(etablissementID, annee.ID, dateDebut, dateFin)

        // 2. Répartitions
        data.ParCycle = s.computeParCycle(etablissementID, annee.ID)
        data.ParClasse = s.computeParClasse(etablissementID, annee.ID)
        data.ParCategorie = s.computeParCategorie(etablissementID, annee.ID)
        data.ParModePaiement = s.computeParModePaiement(etablissementID, dateDebut, dateFin)
        data.EvolutionMensuelle = s.computeEvolutionMensuelle(etablissementID)

        // 3. Derniers paiements
        var paiements []models.Paiement
        database.DB.
                Preload("Eleve").Preload("Frais").Preload("Caissier").
                Where("etablissement_id = ? AND statut = ?", etablissementID, models.StatutPaiementValide).
                Order("date_paiement DESC").
                Limit(10).
                Find(&paiements)
        data.DerniersPaiements = paiements

        return data, nil
}

// computeKPIs calcule les indicateurs clés.
func (s *StatsService) computeKPIs(etablissementID, anneeID uuid.UUID, dateDebut, dateFin *time.Time) DashboardKPIs {
        kpis := DashboardKPIs{}

        // Total encaissé sur la période
        database.DB.Model(&models.Paiement{}).
                Where("etablissement_id = ? AND statut = ? AND date_paiement BETWEEN ? AND ?",
                        etablissementID, models.StatutPaiementValide, dateDebut, dateFin).
                Select("COALESCE(SUM(montant), 0)").Scan(&kpis.TotalEncaisse)

        // Total attendu = somme des soldes attendus de tous les élèves inscrits
        soldes, _ := s.soldeSvc.ListSoldes(etablissementID, nil, nil)
        for _, sl := range soldes {
                kpis.TotalAttendu += sl.TotalAttendu
                if sl.SoldeDu > 0.01 {
                        kpis.NbImpayes++
                }
        }
        kpis.NbEleves = len(soldes)

        // Taux de recouvrement
        if kpis.TotalAttendu > 0 {
                kpis.TauxRecouvrement = (kpis.TotalEncaisse / kpis.TotalAttendu) * 100
        }

        // Paiements du jour
        today := time.Now()
        startDay := time.Date(today.Year(), today.Month(), today.Day(), 0, 0, 0, 0, today.Location())
        endDay := startDay.Add(24 * time.Hour)
        var countJour int64
        database.DB.Model(&models.Paiement{}).
                Where("etablissement_id = ? AND statut = ? AND date_paiement >= ? AND date_paiement < ?",
                        etablissementID, models.StatutPaiementValide, startDay, endDay).
                Count(&countJour).
                Scan(&kpis.MontantJour)
        kpis.NbPaiementsJour = int(countJour)
        // Montant jour séparé (car Count + Scan ne font pas la somme)
        database.DB.Model(&models.Paiement{}).
                Where("etablissement_id = ? AND statut = ? AND date_paiement >= ? AND date_paiement < ?",
                        etablissementID, models.StatutPaiementValide, startDay, endDay).
                Select("COALESCE(SUM(montant), 0)").Scan(&kpis.MontantJour)

        return kpis
}

// computeParCycle calcule la répartition par cycle.
func (s *StatsService) computeParCycle(etablissementID, anneeID uuid.UUID) []RepartitionItem {
        // Récupérer les élèves inscrits groupés par cycle
        type row struct {
                Label    string
                NbEleves int
        }
        var rows []row
        database.DB.Model(&models.Eleve{}).
                Select("cycles.libelle as label, COUNT(DISTINCT eleves.id) as nb_eleves").
                Joins("JOIN inscriptions ON inscriptions.eleve_id = eleves.id").
                Joins("JOIN classes ON classes.id = inscriptions.classe_id").
                Joins("JOIN cycles ON cycles.id = classes.cycle_id").
                Where("inscriptions.annee_scolaire_id = ? AND eleves.etablissement_id = ?", anneeID, etablissementID).
                Group("cycles.libelle").
                Scan(&rows)

        var result []RepartitionItem
        for _, r := range rows {
                // Calculer attendu + encaissé pour ce cycle
                var attendu, encaisse float64
                // Récupérer les élèves de ce cycle
                var eleveIDs []uuid.UUID
                database.DB.Model(&models.Eleve{}).
                        Select("DISTINCT eleves.id").
                        Joins("JOIN inscriptions ON inscriptions.eleve_id = eleves.id").
                        Joins("JOIN classes ON classes.id = inscriptions.classe_id").
                        Joins("JOIN cycles ON cycles.id = classes.cycle_id").
                        Where("inscriptions.annee_scolaire_id = ? AND eleves.etablissement_id = ? AND cycles.libelle = ?",
                                anneeID, etablissementID, r.Label).
                        Scan(&eleveIDs)
                for _, eid := range eleveIDs {
                        solde, _ := s.soldeSvc.GetSoldeEleve(eid)
                        if solde != nil {
                                attendu += solde.TotalAttendu
                                encaisse += solde.TotalPaye
                        }
                }
                taux := 0.0
                if attendu > 0 {
                        taux = (encaisse / attendu) * 100
                }
                result = append(result, RepartitionItem{
                        Label:    r.Label,
                        Attendu:  attendu,
                        Encaisse: encaisse,
                        Taux:     taux,
                        NbEleves: r.NbEleves,
                })
        }
        return result
}

// computeParClasse calcule la répartition par classe.
func (s *StatsService) computeParClasse(etablissementID, anneeID uuid.UUID) []RepartitionItem {
        type row struct {
                Label    string
                NbEleves int
        }
        var rows []row
        database.DB.Model(&models.Eleve{}).
                Select("classes.libelle as label, COUNT(DISTINCT eleves.id) as nb_eleves").
                Joins("JOIN inscriptions ON inscriptions.eleve_id = eleves.id").
                Joins("JOIN classes ON classes.id = inscriptions.classe_id").
                Where("inscriptions.annee_scolaire_id = ? AND eleves.etablissement_id = ?", anneeID, etablissementID).
                Group("classes.libelle").
                Order("classes.libelle").
                Scan(&rows)

        var result []RepartitionItem
        for _, r := range rows {
                var attendu, encaisse float64
                var eleveIDs []uuid.UUID
                database.DB.Model(&models.Eleve{}).
                        Select("DISTINCT eleves.id").
                        Joins("JOIN inscriptions ON inscriptions.eleve_id = eleves.id").
                        Joins("JOIN classes ON classes.id = inscriptions.classe_id").
                        Where("inscriptions.annee_scolaire_id = ? AND eleves.etablissement_id = ? AND classes.libelle = ?",
                                anneeID, etablissementID, r.Label).
                        Scan(&eleveIDs)
                for _, eid := range eleveIDs {
                        solde, _ := s.soldeSvc.GetSoldeEleve(eid)
                        if solde != nil {
                                attendu += solde.TotalAttendu
                                encaisse += solde.TotalPaye
                        }
                }
                taux := 0.0
                if attendu > 0 {
                        taux = (encaisse / attendu) * 100
                }
                result = append(result, RepartitionItem{
                        Label:    r.Label,
                        Attendu:  attendu,
                        Encaisse: encaisse,
                        Taux:     taux,
                        NbEleves: r.NbEleves,
                })
        }
        return result
}

// computeParCategorie calcule la répartition par catégorie (affecté/non-affecté/non-applicable).
func (s *StatsService) computeParCategorie(etablissementID, anneeID uuid.UUID) []RepartitionItem {
        type row struct {
                Categorie string
        }
        var rows []row
        database.DB.Model(&models.Eleve{}).
                Select("DISTINCT eleves.categorie as categorie").
                Joins("JOIN inscriptions ON inscriptions.eleve_id = eleves.id").
                Where("inscriptions.annee_scolaire_id = ? AND eleves.etablissement_id = ?", anneeID, etablissementID).
                Scan(&rows)

        var result []RepartitionItem
        for _, r := range rows {
                var attendu, encaisse float64
                var count int
                var eleveIDs []uuid.UUID
                database.DB.Model(&models.Eleve{}).
                        Select("DISTINCT eleves.id").
                        Joins("JOIN inscriptions ON inscriptions.eleve_id = eleves.id").
                        Where("inscriptions.annee_scolaire_id = ? AND eleves.etablissement_id = ? AND eleves.categorie = ?",
                                anneeID, etablissementID, r.Categorie).
                        Scan(&eleveIDs)
                count = len(eleveIDs)
                for _, eid := range eleveIDs {
                        solde, _ := s.soldeSvc.GetSoldeEleve(eid)
                        if solde != nil {
                                attendu += solde.TotalAttendu
                                encaisse += solde.TotalPaye
                        }
                }
                taux := 0.0
                if attendu > 0 {
                        taux = (encaisse / attendu) * 100
                }
                result = append(result, RepartitionItem{
                        Label:    r.Categorie,
                        Attendu:  attendu,
                        Encaisse: encaisse,
                        Taux:     taux,
                        NbEleves: count,
                })
        }
        return result
}

// computeParModePaiement calcule la répartition par mode de paiement.
func (s *StatsService) computeParModePaiement(etablissementID uuid.UUID, dateDebut, dateFin *time.Time) []RepartitionMode {
        type row struct {
                Mode    string
                Montant float64
                Count   int
        }
        var rows []row
        database.DB.Model(&models.Paiement{}).
                Select("mode_paiement as mode, COALESCE(SUM(montant), 0) as montant, COUNT(*) as count").
                Where("etablissement_id = ? AND statut = ? AND date_paiement BETWEEN ? AND ?",
                        etablissementID, models.StatutPaiementValide, dateDebut, dateFin).
                Group("mode_paiement").
                Scan(&rows)

        var result []RepartitionMode
        for _, r := range rows {
                result = append(result, RepartitionMode{
                        Mode:    r.Mode,
                        Montant: r.Montant,
                        Count:   r.Count,
                })
        }
        return result
}

// computeEvolutionMensuelle calcule les encaissements des 12 derniers mois.
func (s *StatsService) computeEvolutionMensuelle(etablissementID uuid.UUID) []EvolutionItem {
        type row struct {
                Mois    string
                Montant float64
        }
        var rows []row
        // SQLite : strftime pour extraire le mois
        database.DB.Model(&models.Paiement{}).
                Select("strftime('%Y-%m', date_paiement) as mois, COALESCE(SUM(montant), 0) as montant").
                Where("etablissement_id = ? AND statut = ? AND date_paiement >= ?",
                        etablissementID, models.StatutPaiementValide, time.Now().AddDate(-1, 0, 0)).
                Group("mois").
                Order("mois").
                Scan(&rows)

        // Construire les 12 derniers mois (même si pas de paiement)
        var result []EvolutionItem
        now := time.Now()
        for i := 11; i >= 0; i-- {
                date := now.AddDate(0, -i, 0)
                moisKey := date.Format("2006-01")
                moisLabel := date.Format("01/2006")
                montant := 0.0
                for _, r := range rows {
                        if r.Mois == moisKey {
                                montant = r.Montant
                                break
                        }
                }
                result = append(result, EvolutionItem{Mois: moisLabel, Montant: montant})
        }
        return result
}
