package services

import (
        "fmt"
        "time"

        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/database"
        "github.com/scolagest/backend/internal/models"
)

// CaisseService gère les fonctionnalités avancées de la caisse : file d'attente
// des élèves PRE_INSCRIT en attente de paiement, tableau de bord avec KPIs
// temps réel, et statistiques de paiement.
type CaisseService struct{}

func NewCaisseService() *CaisseService { return &CaisseService{} }

// ─────────────────────────────────────────────────────────────────────────────
// File d'attente — élèves PRE_INSCRIT en attente de paiement
// ─────────────────────────────────────────────────────────────────────────────

// EleveFileAttente : élève en attente de paiement des frais d'inscription.
type EleveFileAttente struct {
        EleveID            string  `json:"eleve_id"`
        IdentifiantInterne string  `json:"identifiant_interne"`
        Nom                string  `json:"nom"`
        Prenoms            string  `json:"prenoms"`
        ClasseLibelle      string  `json:"classe_libelle"`
        ClasseID           string  `json:"classe_id"`
        Categorie          string  `json:"categorie"`
        InscriptionID      string  `json:"inscription_id"`
        DateInscription    string  `json:"date_inscription"`
        Source             string  `json:"source"` // "PRE_INSCRIPTION" ou "INSCRIPTION_MANUELLE"
        // Montant des frais d'inscription attendus (depuis la grille tarifaire)
        FraisInscriptionID  *string  `json:"frais_inscription_id,omitempty"`
        MontantAttendu      float64  `json:"montant_attendu"`
        MontantDejaPaye     float64  `json:"montant_deja_paye"`
        SoldeDu             float64  `json:"solde_du"`
}

// GetFileAttente retourne tous les élèves PRE_INSCRIT d'un établissement,
// avec le montant des frais d'inscription attendus et déjà payés.
func (s *CaisseService) GetFileAttente(etablissementID uuid.UUID) ([]EleveFileAttente, error) {
        db := database.Current()

        // Récupérer l'année active
        var annee models.AnneeScolaire
        if err := db.Where("est_active = ?", true).First(&annee).Error; err != nil {
                return nil, fmt.Errorf("aucune année active")
        }

        // Récupérer les inscriptions PRE_INSCRIT de l'année active
        var inscriptions []models.Inscription
        if err := db.
                Where("etablissement_id = ? AND annee_scolaire_id = ? AND statut = ?",
                        etablissementID, annee.ID, models.StatutPreInscrit).
                Order("date_inscription ASC").
                Find(&inscriptions).Error; err != nil {
                return nil, err
        }

        // Récupérer le frais d'inscription de l'établissement pour l'année active
        var fraisInscription models.Frais
        db.Where("etablissement_id = ? AND annee_scolaire_id = ? AND type_frais = ?",
                etablissementID, annee.ID, models.TypeFraisInscription).First(&fraisInscription)

        result := make([]EleveFileAttente, 0, len(inscriptions))

        for _, ins := range inscriptions {
                // Récupérer l'élève
                var eleve models.Eleve
                if err := db.First(&eleve, "id = ?", ins.EleveID).Error; err != nil {
                        continue
                }

                // Récupérer la classe
                classeLibelle := "—"
                var classe models.Classe
                if err := db.First(&classe, "id = ?", ins.ClasseID).Error; err == nil {
                        classeLibelle = classe.Libelle
                }

                // Calculer le montant déjà payé pour les frais d'inscription
                montantDejaPaye := 0.0
                if fraisInscription.ID != uuid.Nil {
                        var sum struct {
                                Total float64
                        }
                        db.Model(&models.Paiement{}).
                                Select("COALESCE(SUM(montant), 0) as total").
                                Where("eleve_id = ? AND frais_id = ? AND statut = ?",
                                        eleve.ID, fraisInscription.ID, models.StatutPaiementValide).
                                Scan(&sum)
                        montantDejaPaye = sum.Total
                }

                // Déterminer la source (pré-inscription ou manuelle)
                source := "INSCRIPTION_MANUELLE"
                var preIns models.PreInscription
                if err := db.Where("eleve_cree_id = ?", eleve.ID).First(&preIns).Error; err == nil {
                        source = "PRE_INSCRIPTION"
                }

                fraisIDStr := ""
                if fraisInscription.ID != uuid.Nil {
                        fraisIDStr = fraisInscription.ID.String()
                }

                montantAttendu := fraisInscription.MontantTotal
                soldeDu := montantAttendu - montantDejaPaye

                result = append(result, EleveFileAttente{
                        EleveID:            eleve.ID.String(),
                        IdentifiantInterne: eleve.IdentifiantInterne,
                        Nom:                eleve.Nom,
                        Prenoms:            eleve.Prenoms,
                        ClasseLibelle:      classeLibelle,
                        ClasseID:           ins.ClasseID.String(),
                        Categorie:          string(eleve.Categorie),
                        InscriptionID:      ins.ID.String(),
                        DateInscription:    ins.DateInscription.Format("2006-01-02 15:04"),
                        Source:             source,
                        FraisInscriptionID: &fraisIDStr,
                        MontantAttendu:     montantAttendu,
                        MontantDejaPaye:    montantDejaPaye,
                        SoldeDu:            soldeDu,
                })
        }

        return result, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Tableau de bord caisse — KPIs temps réel
// ─────────────────────────────────────────────────────────────────────────────

// DashboardCaisse : KPIs de la caisse pour une date donnée.
type DashboardCaisse struct {
        Date             string             `json:"date"`
        TotalEncaisse    float64            `json:"total_encaisse"`
        NbTransactions   int                `json:"nb_transactions"`
        NbAnnulations    int                `json:"nb_annulations"`
        FileAttenteCount int                `json:"file_attente_count"`
        RepartitionModes []RepartitionModeCaisse  `json:"repartition_modes"`
        DerniersPaiements []DernierPaiement `json:"derniers_paiements"`
}

// RepartitionModeCaisse : répartition des encaissements par mode de paiement.
type RepartitionModeCaisse struct {
        Mode        string  `json:"mode"`
        Label       string  `json:"label"`
        Montant     float64 `json:"montant"`
        Nb          int     `json:"nb"`
        Pourcentage float64 `json:"pourcentage"`
}

// DernierPaiement : les derniers encaissements du jour.
type DernierPaiement struct {
        ID            string  `json:"id"`
        NumeroRecu    string  `json:"numero_recu"`
        EleveNom      string  `json:"eleve_nom"`
        ElevePrenoms  string  `json:"eleve_prenoms"`
        Montant       float64 `json:"montant"`
        ModePaiement  string  `json:"mode_paiement"`
        Heure         string  `json:"heure"`
        FraisLibelle  string  `json:"frais_libelle"`
}

// GetDashboard retourne les KPIs de la caisse pour aujourd'hui (ou une date
// donnée).
func (s *CaisseService) GetDashboard(etablissementID uuid.UUID, date time.Time) (*DashboardCaisse, error) {
        db := database.Current()

        dateOnly := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
        debutJour := dateOnly
        finJour := dateOnly.Add(24 * time.Hour).Add(-time.Second)

        // Total encaissé + nb transactions (VALIDE)
        var totalResult struct {
                Total float64
                Nb    int
        }
        db.Model(&models.Paiement{}).
                Select("COALESCE(SUM(montant), 0) as total, COUNT(*) as nb").
                Where("etablissement_id = ? AND statut = ? AND date_paiement BETWEEN ? AND ?",
                        etablissementID, models.StatutPaiementValide, debutJour, finJour).
                Scan(&totalResult)

        // Nb annulations
        var nbAnnul int64
        db.Model(&models.Paiement{}).
                Where("etablissement_id = ? AND statut = ? AND date_paiement BETWEEN ? AND ?",
                        etablissementID, models.StatutPaiementAnnule, debutJour, finJour).
                Count(&nbAnnul)

        // File d'attente count
        fileAttente, _ := s.GetFileAttente(etablissementID)

        // Répartition par mode de paiement
        type modeRow struct {
                Mode    string
                Montant float64
                Nb      int
        }
        var modeRows []modeRow
        db.Model(&models.Paiement{}).
                Select("mode_paiement as mode, SUM(montant) as montant, COUNT(*) as nb").
                Where("etablissement_id = ? AND statut = ? AND date_paiement BETWEEN ? AND ?",
                        etablissementID, models.StatutPaiementValide, debutJour, finJour).
                Group("mode_paiement").
                Scan(&modeRows)

        modeLabels := map[string]string{
                "ESPECES":     "Espèces",
                "CHEQUE":      "Chèque",
                "VIREMENT":    "Virement",
                "MOBILE_MONEY": "Mobile Money",
        }

        repartition := make([]RepartitionModeCaisse, 0, len(modeRows))
        totalForPct := totalResult.Total
        for _, m := range modeRows {
                pct := 0.0
                if totalForPct > 0 {
                        pct = (m.Montant / totalForPct) * 100
                }
                label := modeLabels[m.Mode]
                if label == "" {
                        label = m.Mode
                }
                repartition = append(repartition, RepartitionModeCaisse{
                        Mode:        m.Mode,
                        Label:       label,
                        Montant:     m.Montant,
                        Nb:          m.Nb,
                        Pourcentage: pct,
                })
        }

        // Derniers paiements (5)
        var paiements []models.Paiement
        db.Where("etablissement_id = ? AND statut = ? AND date_paiement BETWEEN ? AND ?",
                etablissementID, models.StatutPaiementValide, debutJour, finJour).
                Order("date_paiement DESC").
                Limit(5).
                Find(&paiements)

        derniers := make([]DernierPaiement, 0, len(paiements))
        for _, p := range paiements {
                // Récupérer le nom de l'élève
                var eleve models.Eleve
                db.First(&eleve, "id = ?", p.EleveID)

                // Récupérer le libellé du frais
                fraisLibelle := "—"
                if p.FraisID != nil {
                        var frais models.Frais
                        db.First(&frais, "id = ?", *p.FraisID)
                        if frais.Libelle != "" {
                                fraisLibelle = frais.Libelle
                        }
                }

                derniers = append(derniers, DernierPaiement{
                        ID:           p.ID.String(),
                        NumeroRecu:   p.NumeroRecu,
                        EleveNom:     eleve.Nom,
                        ElevePrenoms: eleve.Prenoms,
                        Montant:      p.Montant,
                        ModePaiement: string(p.ModePaiement),
                        Heure:        p.DatePaiement.Format("15:04"),
                        FraisLibelle: fraisLibelle,
                })
        }

        return &DashboardCaisse{
                Date:             dateOnly.Format("2006-01-02"),
                TotalEncaisse:    totalResult.Total,
                NbTransactions:   totalResult.Nb,
                NbAnnulations:    int(nbAnnul),
                FileAttenteCount: len(fileAttente),
                RepartitionModes: repartition,
                DerniersPaiements: derniers,
        }, nil
}
