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

// PaieService gère les bulletins de paie enseignants : génération automatique
// depuis les pointages validés, calcul du salaire (heures × taux), gestion des
// avances sur salaire, validation et marquage comme payé.
type PaieService struct{}

func NewPaieService() *PaieService { return &PaieService{} }

// ─────────────────────────────────────────────────────────────────────────────
// Génération automatique des bulletins
// ─────────────────────────────────────────────────────────────────────────────

// GenerateBulletinResult : résultat de la génération d'un bulletin.
type GenerateBulletinResult struct {
        Bulletin     *models.BulletinPaie `json:"bulletin"`
        AlerteEcart  string               `json:"alerte_ecart,omitempty"` // si heures pointées < 80% planifiées
}

// GenerateBulletin génère ou régénère le bulletin de paie d'un enseignant
// pour un mois donné. Calcule automatiquement :
// - Heures pointées (depuis les pointages VALIDE + VALIDE_MANUEL du mois)
// - Heures planifiées (depuis les sessions du mois)
// - Taux horaire moyen (pondéré par les matières enseignées)
// - Salaire brut (heures pointées × taux moyen)
// - Total avances déduites (avances APPROUVEE non encore déduites)
// - Salaire net (brut - avances - cotisations)
//
// Si un bulletin existe déjà pour ce mois (BROUILLON), il est régénéré.
// Si VALIDE ou PAYE, erreur (ne peut pas régénérer).
func (s *PaieService) GenerateBulletin(enseignantID, etablissementID, anneeScolaireID uuid.UUID, mois, annee int) (*GenerateBulletinResult, error) {
        db := database.Current()

        // Vérifier qu'un bulletin n'existe pas déjà en statut VALIDE/PAYE
        var existing models.BulletinPaie
        err := db.Where("enseignant_id = ? AND mois = ? AND annee = ?",
                enseignantID, mois, annee).First(&existing).Error
        if err == nil && (existing.Statut == models.StatutBulletinValide || existing.Statut == models.StatutBulletinPaye) {
                return nil, fmt.Errorf("un bulletin %s existe déjà pour %02d/%d — impossible de régénérer", existing.Statut, mois, annee)
        }

        // Récupérer les pointages validés du mois
        debutMois := time.Date(annee, time.Month(mois), 1, 0, 0, 0, 0, time.UTC)
        finMois := debutMois.AddDate(0, 1, 0).Add(-time.Second)

        var pointages []models.Pointage
        db.Preload("SessionCours").
                Where("enseignant_id = ? AND date_heure_serveur BETWEEN ? AND ? AND statut IN ?",
                        enseignantID, debutMois, finMois,
                        []models.StatutPointage{models.StatutPointValide, models.StatutPointValideManuel}).
                Find(&pointages)

        // Calculer heures pointées (somme des durées entrée→sortie par session)
        sessionsPointees := make(map[uuid.UUID]float64) // session_id → durée en heures
        for _, p := range pointages {
                if p.SessionCours != nil {
                        if p.Type == models.TypePointageEntree {
                                // Marquer le début — on compte la session comme pointée
                                sessionsPointees[p.SessionCoursID] = 0
                        }
                }
        }
        heuresPointees := 0.0
        // Calculer les heures pointées : somme des durées réelles des sessions
        // pointées (heure_fin - heure_debut de chaque SessionCours).
        // On récupère les sessions pointées avec leurs horaires.
        var sessionsPointeesList []models.SessionCours
        sessionIDs := make([]uuid.UUID, 0, len(sessionsPointees))
        for sid := range sessionsPointees {
                sessionIDs = append(sessionIDs, sid)
        }
        if len(sessionIDs) > 0 {
                db.Where("id IN ?", sessionIDs).Find(&sessionsPointeesList)
        }
        for _, s := range sessionsPointeesList {
                duree := s.HeureFin.Sub(s.HeureDebut).Hours()
                if duree > 0 {
                        heuresPointees += duree
                }
        }

        nbSessionsPointees := len(sessionsPointees)

        // Récupérer les sessions planifiées du mois
        var sessions []models.SessionCours
        db.Where("enseignant_id = ? AND date_cours BETWEEN ? AND ?",
                enseignantID, debutMois, finMois).Find(&sessions)
        nbSessionsTotal := len(sessions)

        // Heures planifiées (théorique) : volume hebdo × semaines dans le mois
        // On récupère le volume hebdo depuis les affectations actives
        var affectations []models.AffectationCours
        db.Where("enseignant_id = ? AND annee_scolaire_id = ? AND actif = ?",
                enseignantID, anneeScolaireID, true).Find(&affectations)
        volumeHebdoTotal := 0.0
        for _, a := range affectations {
                volumeHebdoTotal += a.VolumeHoraireHebdo
        }
        // Nombre de semaines dans le mois (approximatif)
        semainesMois := 4.33 // moyenne
        heuresPlanifiees := volumeHebdoTotal * semainesMois

        // Taux horaire moyen (pondéré par les matières enseignées)
        var ensMatieres []models.EnseignantMatiere
        db.Preload("Matiere").Where("enseignant_id = ?", enseignantID).Find(&ensMatieres)
        tauxMoyen := 0.0
        if len(ensMatieres) > 0 {
                sommeTaux := 0.0
                for _, em := range ensMatieres {
                        sommeTaux += em.TauxHoraire
                }
                tauxMoyen = sommeTaux / float64(len(ensMatieres))
        } else {
                // Fallback : taux horaire défaut de l'enseignant
                var ens models.Enseignant
                db.First(&ens, "id = ?", enseignantID)
                tauxMoyen = ens.TauxHoraireDefaut
        }

        // Salaire brut
        salaireBrut := heuresPointees * tauxMoyen

        // Total avances à déduire (APPROUVEE non encore déduites)
        var avances []models.AvanceSalaire
        db.Where("enseignant_id = ? AND statut = ? AND date_demande BETWEEN ? AND ?",
                enseignantID, models.StatutAvanceApprouvee, debutMois, finMois).Find(&avances)
        totalAvances := 0.0
        for _, a := range avances {
                totalAvances += a.Montant
        }

        // Salaire net
        salaireNet := salaireBrut - totalAvances

        // Créer ou mettre à jour le bulletin
        bulletin := models.BulletinPaie{
                EtablissementID:    etablissementID,
                EnseignantID:       enseignantID,
                AnneeScolaireID:    anneeScolaireID,
                Mois:               mois,
                Annee:              annee,
                HeuresPointees:     heuresPointees,
                HeuresPlanifiees:   heuresPlanifiees,
                NbSessionsPointees: nbSessionsPointees,
                NbSessionsTotal:    nbSessionsTotal,
                TauxHoraireMoyen:   tauxMoyen,
                SalaireBrut:        salaireBrut,
                TotalAvances:       totalAvances,
                SalaireNet:         salaireNet,
                Statut:             models.StatutBulletinBrouillon,
        }

        if existing.ID != uuid.Nil {
                // Régénérer un brouillon existant
                bulletin.ID = existing.ID
                bulletin.Cotisations = existing.Cotisations // conserver les cotisations saisies manuellement
                bulletin.SalaireNet = salaireBrut - totalAvances - existing.Cotisations
                db.Model(&bulletin).Updates(map[string]interface{}{
                        "heures_pointees":      heuresPointees,
                        "heures_planifiees":    heuresPlanifiees,
                        "nb_sessions_pointees": nbSessionsPointees,
                        "nb_sessions_total":    nbSessionsTotal,
                        "taux_horaire_moyen":   tauxMoyen,
                        "salaire_brut":         salaireBrut,
                        "total_avances":        totalAvances,
                        "salaire_net":          bulletin.SalaireNet,
                })
        } else {
                if err := db.Create(&bulletin).Error; err != nil {
                        return nil, fmt.Errorf("création bulletin: %w", err)
                }
        }

        // Marquer les avances comme déduites
        for _, a := range avances {
                db.Model(&a).Updates(map[string]interface{}{
                        "statut":           models.StatutAvanceDeduite,
                        "bulletin_paie_id": bulletin.ID,
                })
        }

        // Alerte écart (heures pointées < 80% planifiées)
        alerte := ""
        if heuresPlanifiees > 0 && heuresPointees < heuresPlanifiees*0.8 {
                pct := (heuresPointees / heuresPlanifiees) * 100
                alerte = fmt.Sprintf("Écart important : %.0f%% des heures planifiées ont été pointées (%.1fh/%.1fh)", pct, heuresPointees, heuresPlanifiees)
        }

        // Recharger avec relations
        db.Preload("Enseignant").
                Preload("Etablissement").
                First(&bulletin, "id = ?", bulletin.ID)

        return &GenerateBulletinResult{Bulletin: &bulletin, AlerteEcart: alerte}, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// CRUD Bulletins
// ─────────────────────────────────────────────────────────────────────────────

func (s *PaieService) ListBulletins(etablissementID uuid.UUID, mois, annee *int) ([]models.BulletinPaie, error) {
        q := database.Current().Model(&models.BulletinPaie{}).
                Where("etablissement_id = ?", etablissementID)
        if mois != nil {
                q = q.Where("mois = ?", *mois)
        }
        if annee != nil {
                q = q.Where("annee = ?", *annee)
        }

        var bulletins []models.BulletinPaie
        if err := q.Preload("Enseignant").
                Order("annee DESC, mois DESC, enseignant_id ASC").
                Find(&bulletins).Error; err != nil {
                return nil, err
        }
        return bulletins, nil
}

func (s *PaieService) GetBulletin(id uuid.UUID) (*models.BulletinPaie, error) {
        var b models.BulletinPaie
        if err := database.Current().
                Preload("Enseignant").
                Preload("Etablissement").
                Preload("AnneeScolaire").
                First(&b, "id = ?", id).Error; err != nil {
                if errors.Is(err, gorm.ErrRecordNotFound) {
                        return nil, errors.New("bulletin introuvable")
                }
                return nil, err
        }
        return &b, nil
}

// ValiderBulletin passe un bulletin de BROUILLON à VALIDE (direction valide).
func (s *PaieService) ValiderBulletin(id, adminID uuid.UUID, cotisations float64) (*models.BulletinPaie, error) {
        var b models.BulletinPaie
        if err := database.Current().First(&b, "id = ?", id).Error; err != nil {
                return nil, errors.New("bulletin introuvable")
        }
        if b.Statut != models.StatutBulletinBrouillon {
                return nil, errors.New("seul un brouillon peut être validé")
        }

        now := time.Now()
        // Recalculer le net avec les cotisations saisies
        net := b.SalaireBrut - b.TotalAvances - cotisations
        if err := database.Current().Model(&b).Updates(map[string]interface{}{
                "statut":          models.StatutBulletinValide,
                "valide_par":      adminID,
                "date_validation": &now,
                "cotisations":     cotisations,
                "salaire_net":     net,
        }).Error; err != nil {
                return nil, err
        }
        return s.GetBulletin(id)
}

// PayerBulletin marque un bulletin comme PAYE (paiement effectué).
func (s *PaieService) PayerBulletin(id, adminID uuid.UUID, reference string) (*models.BulletinPaie, error) {
        var b models.BulletinPaie
        if err := database.Current().First(&b, "id = ?", id).Error; err != nil {
                return nil, errors.New("bulletin introuvable")
        }
        if b.Statut != models.StatutBulletinValide {
                return nil, errors.New("seul un bulletin validé peut être marqué comme payé")
        }

        now := time.Now()
        if err := database.Current().Model(&b).Updates(map[string]interface{}{
                "statut":             models.StatutBulletinPaye,
                "paye_par":           adminID,
                "date_paie":          &now,
                "reference_paiement": reference,
        }).Error; err != nil {
                return nil, err
        }
        return s.GetBulletin(id)
}

// GetBulletinsEnseignant retourne les bulletins d'un enseignant (portail prof).
func (s *PaieService) GetBulletinsEnseignant(enseignantID uuid.UUID) ([]models.BulletinPaie, error) {
        var bulletins []models.BulletinPaie
        if err := database.Current().
                Where("enseignant_id = ?", enseignantID).
                Preload("Etablissement").
                Order("annee DESC, mois DESC").
                Find(&bulletins).Error; err != nil {
                return nil, err
        }
        return bulletins, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Avances sur salaire
// ─────────────────────────────────────────────────────────────────────────────

type AvanceDTO struct {
        Montant float64 `json:"montant"`
        Motif   string  `json:"motif"`
}

func (s *PaieService) ListAvances(etablissementID uuid.UUID, statut *models.StatutAvance) ([]models.AvanceSalaire, error) {
        q := database.Current().Model(&models.AvanceSalaire{}).
                Where("etablissement_id = ?", etablissementID)
        if statut != nil {
                q = q.Where("statut = ?", *statut)
        }
        var avances []models.AvanceSalaire
        if err := q.Preload("Enseignant").
                Order("date_demande DESC").
                Find(&avances).Error; err != nil {
                return nil, err
        }
        return avances, nil
}

func (s *PaieService) CreateAvance(enseignantID, etablissementID uuid.UUID, dto AvanceDTO) (*models.AvanceSalaire, error) {
        if dto.Montant <= 0 {
                return nil, errors.New("le montant doit être positif")
        }
        a := models.AvanceSalaire{
                EtablissementID: etablissementID,
                EnseignantID:    enseignantID,
                Montant:         dto.Montant,
                DateDemande:     time.Now(),
                Motif:           dto.Motif,
                Statut:          models.StatutAvanceDemandee,
        }
        if err := database.Current().Create(&a).Error; err != nil {
                return nil, err
        }
        return &a, nil
}

func (s *PaieService) TraiterAvance(id, adminID uuid.UUID, approuver bool, motifRejet string) (*models.AvanceSalaire, error) {
        var a models.AvanceSalaire
        if err := database.Current().First(&a, "id = ?", id).Error; err != nil {
                return nil, errors.New("avance introuvable")
        }
        if a.Statut != models.StatutAvanceDemandee {
                return nil, errors.New("cette avance a déjà été traitée")
        }

        now := time.Now()
        if approuver {
                database.Current().Model(&a).Updates(map[string]interface{}{
                        "statut":            models.StatutAvanceApprouvee,
                        "approuve_par":      adminID,
                        "date_approbation":  &now,
                        "date_versement":    &now,
                })
        } else {
                database.Current().Model(&a).Updates(map[string]interface{}{
                        "statut":       models.StatutAvanceRejetee,
                        "approuve_par": adminID,
                        "motif_rejet":  motifRejet,
                })
        }
        return &a, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Dû courant — montant déjà gagné par l'enseignant ce mois-ci
// ─────────────────────────────────────────────────────────────────────────────

// DuCourantResult : montant déjà gagné par l'enseignant ce mois-ci (heures
// enseignées × taux moyen), moins les avances déjà demandées/approuvées.
type DuCourantResult struct {
	Mois             int     `json:"mois"`
	Annee            int     `json:"annee"`
	HeuresEnseignees float64 `json:"heures_enseignees"`
	NbSessions       int     `json:"nb_sessions"`
	TauxMoyen        float64 `json:"taux_moyen"`
	SalaireDu        float64 `json:"salaire_du"`
	AvancesEnCours   float64 `json:"avances_en_cours"`
	DuDisponible     float64 `json:"du_disponible"`
}

// GetDuCourant calcule le montant déjà gagné par l'enseignant pour le mois
// en cours (du 1er du mois à maintenant), basé sur les pointages validés.
// C'est le plafond maximal pour une demande d'avance — empêche un enseignant
// de demander une avance supérieure à ce qu'il a réellement gagné.
func (s *PaieService) GetDuCourant(enseignantID uuid.UUID) (*DuCourantResult, error) {
	db := database.Current()
	now := time.Now()
	debutMois := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	// 1. Pointages validés du mois (du 1er à maintenant)
	var pointages []models.Pointage
	db.Preload("SessionCours").
		Where("enseignant_id = ? AND date_heure_serveur BETWEEN ? AND ? AND statut IN ?",
			enseignantID, debutMois, now,
			[]models.StatutPointage{models.StatutPointValide, models.StatutPointValideManuel}).
		Find(&pointages)

	// 2. Heures enseignées (durée réelle des sessions pointées)
	sessionsPointees := make(map[uuid.UUID]bool)
	for _, p := range pointages {
		if p.Type == models.TypePointageEntree {
			sessionsPointees[p.SessionCoursID] = true
		}
	}
	var sessionsList []models.SessionCours
	sessionIDs := make([]uuid.UUID, 0, len(sessionsPointees))
	for sid := range sessionsPointees {
		sessionIDs = append(sessionIDs, sid)
	}
	if len(sessionIDs) > 0 {
		db.Where("id IN ?", sessionIDs).Find(&sessionsList)
	}
	heuresEnseignees := 0.0
	for _, s := range sessionsList {
		duree := s.HeureFin.Sub(s.HeureDebut).Hours()
		if duree > 0 {
			heuresEnseignees += duree
		}
	}

	// 3. Taux horaire moyen
	var ensMatieres []models.EnseignantMatiere
	db.Where("enseignant_id = ?", enseignantID).Find(&ensMatieres)
	tauxMoyen := 0.0
	if len(ensMatieres) > 0 {
		sommeTaux := 0.0
		for _, em := range ensMatieres {
			sommeTaux += em.TauxHoraire
		}
		tauxMoyen = sommeTaux / float64(len(ensMatieres))
	} else {
		var ens models.Enseignant
		db.First(&ens, "id = ?", enseignantID)
		tauxMoyen = ens.TauxHoraireDefaut
	}

	// 4. Salaire dû = heures × taux
	salaireDu := heuresEnseignees * tauxMoyen

	// 5. Avances en cours (DEMANDEE + APPROUVEE non déduites ce mois)
	var avances []models.AvanceSalaire
	db.Where("enseignant_id = ? AND statut IN ? AND date_demande >= ?",
		enseignantID,
		[]models.StatutAvance{models.StatutAvanceDemandee, models.StatutAvanceApprouvee},
		debutMois).Find(&avances)
	avancesEnCours := 0.0
	for _, a := range avances {
		avancesEnCours += a.Montant
	}

	// 6. Dû disponible = salaire dû - avances en cours
	duDisponible := salaireDu - avancesEnCours
	if duDisponible < 0 {
		duDisponible = 0
	}

	return &DuCourantResult{
		Mois:             int(now.Month()),
		Annee:            now.Year(),
		HeuresEnseignees: heuresEnseignees,
		NbSessions:       len(sessionsPointees),
		TauxMoyen:        tauxMoyen,
		SalaireDu:        salaireDu,
		AvancesEnCours:   avancesEnCours,
		DuDisponible:     duDisponible,
	}, nil
}
