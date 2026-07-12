package services

import (
	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
)

// EffectifsService calcule des statistiques d'effectifs par classe et par
// établissement : remplissage, genre, redoublants. Utilisé par le tableau de
// bord Effectifs (Phase 3) pour visualiser la capacité et la répartition.
type EffectifsService struct{}

func NewEffectifsService() *EffectifsService { return &EffectifsService{} }

// EffectifClasse représente l'effectif d'une classe pour une année donnée.
type EffectifClasse struct {
	ClasseID       uuid.UUID `json:"classe_id"`
	ClasseLibelle  string    `json:"classe_libelle"`
	CycleLibelle   string    `json:"cycle_libelle"`
	Niveau         int       `json:"niveau"`
	Effectif       int       `json:"effectif"`
	EffectifMax    int       `json:"effectif_max"`
	QuotaEtabliss  int       `json:"quota_etablissement"`
	TauxRempliss   float64   `json:"taux_remplissage"` // 0-100
	Garcons        int       `json:"garcons"`
	Filles         int       `json:"filles"`
	Redoublants    int       `json:"redoublants"`
	EstClasseExamen bool     `json:"est_classe_examen"`
}

// EffectifsResult est le résultat complet : KPIs globaux + détails par classe.
type EffectifsResult struct {
	KPIs    EffectifsKPIs    `json:"kpis"`
	Classes []EffectifClasse `json:"classes"`
}

// EffectifsKPIs contient les indicateurs globaux agrégés.
type EffectifsKPIs struct {
	TotalEleves    int     `json:"total_eleves"`
	TotalClasses   int     `json:"total_classes"`
	Garcons        int     `json:"garcons"`
	Filles         int     `json:"filles"`
	Redoublants    int     `json:"redoublants"`
	TauxRempliss   float64 `json:"taux_remplissage_global"` // moyenne pondérée
	ClassesPleines int     `json:"classes_pleines"`         // >= quota
}

// GetEffectifs retourne les statistiques d'effectifs d'un établissement pour
// une année scolaire donnée. Si anneeID est nil, utilise l'année active.
func (s *EffectifsService) GetEffectifs(etablissementID uuid.UUID, anneeID *uuid.UUID) (*EffectifsResult, error) {
	db := database.Current()

	// Résoudre l'année : fournie ou active
	var anneeIDResolved uuid.UUID
	if anneeID != nil {
		anneeIDResolved = *anneeID
	} else {
		var annee models.AnneeScolaire
		if err := db.Where("est_active = ?", true).First(&annee).Error; err != nil {
			return nil, err
		}
		anneeIDResolved = annee.ID
	}

	// Récupérer le quota de l'établissement
	var etb models.Etablissement
	db.First(&etb, "id = ?", etablissementID)
	quotaEtab := etb.QuotaClasse
	if quotaEtab <= 0 {
		quotaEtab = 45
	}

	// Récupérer les classes du établissement (via cycles)
	var classes []models.Classe
	db.Preload("Cycle").
		Joins("JOIN cycles ON cycles.id = classes.cycle_id").
		Where("cycles.etablissement_id = ?", etablissementID).
		Order("cycles.ordre ASC, classes.niveau ASC, classes.libelle ASC").
		Find(&classes)

	// Compter les inscrits par classe pour l'année
	type countRow struct {
		ClasseID uuid.UUID
		Count    int64
	}
	var counts []countRow
	db.Model(&models.Inscription{}).
		Select("classe_id, COUNT(*) as count").
		Where("annee_scolaire_id = ?", anneeIDResolved).
		Group("classe_id").
		Find(&counts)
	countByClasse := make(map[uuid.UUID]int)
	for _, r := range counts {
		countByClasse[r.ClasseID] = int(r.Count)
	}

	// Compter les garçons/filles par classe (jointure inscriptions → eleves)
	type genreRow struct {
		ClasseID uuid.UUID
		Sexe     models.Sexe
		Count    int64
	}
	var genres []genreRow
	db.Model(&models.Inscription{}).
		Select("inscriptions.classe_id, eleves.sexe as sexe, COUNT(*) as count").
		Joins("JOIN eleves ON eleves.id = inscriptions.eleve_id").
		Where("inscriptions.annee_scolaire_id = ?", anneeIDResolved).
		Group("inscriptions.classe_id, eleves.sexe").
		Find(&genres)
	garconsByClasse := make(map[uuid.UUID]int)
	fillesByClasse := make(map[uuid.UUID]int)
	for _, g := range genres {
		if g.Sexe == models.SexeM {
			garconsByClasse[g.ClasseID] = int(g.Count)
		} else if g.Sexe == models.SexeF {
			fillesByClasse[g.ClasseID] = int(g.Count)
		}
	}

	// Compter les redoublants par classe (decision_promotion = REDOUBLANT sur
	// l'inscription de l'année — un redoublant a son inscription courante
	// marquée REDOUBLANT suite au passage de classe précédent)
	type redoublantRow struct {
		ClasseID uuid.UUID
		Count    int64
	}
	var redoublants []redoublantRow
	db.Model(&models.Inscription{}).
		Select("classe_id, COUNT(*) as count").
		Where("annee_scolaire_id = ? AND decision_promotion = ?", anneeIDResolved, models.DecisionRedoublant).
		Group("classe_id").
		Find(&redoublants)
	redoublantsByClasse := make(map[uuid.UUID]int)
	for _, r := range redoublants {
		redoublantsByClasse[r.ClasseID] = int(r.Count)
	}

	// Construire le résultat
	result := &EffectifsResult{Classes: []EffectifClasse{}}
	kpis := EffectifsKPIs{TotalClasses: len(classes)}

	for _, c := range classes {
		effectif := countByClasse[c.ID]
		effectifMax := c.EffectifMax
		if effectifMax <= 0 {
			effectifMax = quotaEtab
		}
		taux := 0.0
		if effectifMax > 0 {
			taux = float64(effectif) / float64(effectifMax) * 100
		}
		garcons := garconsByClasse[c.ID]
		filles := fillesByClasse[c.ID]
		redoublants := redoublantsByClasse[c.ID]

		ec := EffectifClasse{
			ClasseID:       c.ID,
			ClasseLibelle:  c.Libelle,
			CycleLibelle:   string(c.Cycle.Libelle),
			Niveau:         c.Niveau,
			Effectif:       effectif,
			EffectifMax:    effectifMax,
			QuotaEtabliss:  quotaEtab,
			TauxRempliss:   taux,
			Garcons:        garcons,
			Filles:         filles,
			Redoublants:    redoublants,
			EstClasseExamen: c.EstClasseExamen,
		}
		result.Classes = append(result.Classes, ec)

		kpis.TotalEleves += effectif
		kpis.Garcons += garcons
		kpis.Filles += filles
		kpis.Redoublants += redoublants
		if effectif >= effectifMax {
			kpis.ClassesPleines++
		}
	}

	// Taux de remplissage global (moyenne pondérée par effectif)
	if kpis.TotalEleves > 0 {
		var totalCapa int
		for _, c := range result.Classes {
			totalCapa += c.EffectifMax
		}
		if totalCapa > 0 {
			kpis.TauxRempliss = float64(kpis.TotalEleves) / float64(totalCapa) * 100
		}
	}

	result.KPIs = kpis
	return result, nil
}
