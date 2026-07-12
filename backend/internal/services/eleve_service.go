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

// EleveService contient la logique métier de gestion des élèves.
type EleveService struct{}

// NewEleveService construit un EleveService.
func NewEleveService() *EleveService { return &EleveService{} }

// EleveFilter contient les critères de recherche/filtrage des élèves.
type EleveFilter struct {
        Search         string // nom, prénoms ou matricule (recherche partielle)
        ClasseID       *uuid.UUID
        CycleID        *uuid.UUID // filtre par cycle (via inscriptions → classes)
        Niveau         *int       // filtre par niveau (via inscriptions → classes)
        Categorie      *models.CategorieEleve
        Statut         *models.StatutEleve
        EtablissementID *uuid.UUID
        Page           int
        PageSize       int
}

// EleveResult est le résultat paginé d'une recherche d'élèves.
type EleveResult struct {
        Data     []models.Eleve `json:"data"`
        Total    int64          `json:"total"`
        Page     int            `json:"page"`
        PageSize int            `json:"page_size"`
}

// EleveStats contient des statistiques agrégées sur un ensemble d'élèves
// (contextualisées aux filtres appliqués).
type EleveStats struct {
        Total       int64 `json:"total"`
        Garcons    int64 `json:"garcons"`
        Filles     int64 `json:"filles"`
        Redoublants int64 `json:"redoublants"`
}

// applyFilter applique tous les critères de filtrage sur une requête GORM
// et retourne la requête modifiée. Utilisé par List, Export et Stats pour
// garantir une logique de filtrage unique et cohérente.
//
// Les filtres ClasseID, CycleID et Niveau utilisent des sous-requêtes IN
// (plutôt que des JOIN) pour éviter le double-comptage des redoublants
// (un élève ayant deux inscriptions dans la même classe).
func applyFilter(q *gorm.DB, filter EleveFilter) *gorm.DB {
        if filter.EtablissementID != nil {
                q = q.Where("etablissement_id = ?", *filter.EtablissementID)
        }

        if filter.Search != "" {
                normalized := utils.Normalize(filter.Search)
                like := "%" + normalized + "%"
                q = q.Where("search_vector LIKE ?", like)
        }

        if filter.Categorie != nil {
                q = q.Where("categorie = ?", *filter.Categorie)
        }

        if filter.Statut != nil {
                q = q.Where("statut = ?", *filter.Statut)
        }

        // Filtre par classe : sous-requête sur inscriptions (évite les
        // doublons liés aux redoublants qui ont plusieurs inscriptions).
        if filter.ClasseID != nil {
                q = q.Where("eleves.id IN (SELECT eleve_id FROM inscriptions WHERE classe_id = ?)", *filter.ClasseID)
        }

        // Filtre par cycle : sous-requête inscriptions → classes.
        if filter.CycleID != nil {
                q = q.Where("eleves.id IN (SELECT i.eleve_id FROM inscriptions i JOIN classes c ON c.id = i.classe_id WHERE c.cycle_id = ?)", *filter.CycleID)
        }

        // Filtre par niveau : sous-requête inscriptions → classes.
        if filter.Niveau != nil {
                q = q.Where("eleves.id IN (SELECT i.eleve_id FROM inscriptions i JOIN classes c ON c.id = i.classe_id WHERE c.niveau = ?)", *filter.Niveau)
        }

        return q
}

// List retourne une liste paginée d'élèves selon les filtres.
func (s *EleveService) List(filter EleveFilter) (*EleveResult, error) {
        db := database.Current()

        if filter.Page < 1 {
                filter.Page = 1
        }
        if filter.PageSize < 1 || filter.PageSize > 100 {
                filter.PageSize = 20
        }

        q := applyFilter(db.Model(&models.Eleve{}), filter)

        var total int64
        if err := q.Count(&total).Error; err != nil {
                return nil, err
        }

        var eleves []models.Eleve
        offset := (filter.Page - 1) * filter.PageSize
        if err := q.Preload("Etablissement").
                Preload("Tuteur").
                Order("nom ASC, prenoms ASC").
                Offset(offset).
                Limit(filter.PageSize).
                Find(&eleves).Error; err != nil {
                return nil, err
        }

        return &EleveResult{Data: eleves, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
}

// Export retourne TOUS les élèves correspondant aux filtres (sans pagination).
// Utilisé pour les exports PDF/Excel/CSV côté frontend. Inclut les relations
// nécessaires (tuteur, inscriptions avec classe/cycle/année) pour un export
// complet.
func (s *EleveService) Export(filter EleveFilter) ([]models.Eleve, error) {
        db := database.Current()

        q := applyFilter(db.Model(&models.Eleve{}), filter)

        var eleves []models.Eleve
        if err := q.Preload("Etablissement").
                Preload("Tuteur").
                Preload("Inscriptions.Classe").
                Preload("Inscriptions.Classe.Cycle").
                Preload("Inscriptions.AnneeScolaire").
                Order("nom ASC, prenoms ASC").
                Find(&eleves).Error; err != nil {
                return nil, err
        }

        return eleves, nil
}

// Stats retourne des statistiques agrégées sur les élèves correspondant aux
// filtres : total, garçons/filles, redoublants. Utilisé pour les mini-stats
// contextuelles affichées au-dessus de la liste.
func (s *EleveService) Stats(filter EleveFilter) (*EleveStats, error) {
        db := database.Current()

        base := func() *gorm.DB {
                return applyFilter(db.Model(&models.Eleve{}), filter)
        }

        var total int64
        if err := base().Count(&total).Error; err != nil {
                return nil, err
        }

        var garcons int64
        if err := base().Where("sexe = ?", models.SexeM).Count(&garcons).Error; err != nil {
                return nil, err
        }

        var filles int64
        if err := base().Where("sexe = ?", models.SexeF).Count(&filles).Error; err != nil {
                return nil, err
        }

        var redoublants int64
        if err := base().
                Where("eleves.id IN (SELECT eleve_id FROM inscriptions WHERE decision_promotion = ?)", models.DecisionRedoublant).
                Count(&redoublants).Error; err != nil {
                return nil, err
        }

        return &EleveStats{Total: total, Garcons: garcons, Filles: filles, Redoublants: redoublants}, nil
}

// Get retourne un élève par son ID, avec ses relations.
func (s *EleveService) Get(id uuid.UUID) (*models.Eleve, error) {
        var eleve models.Eleve
        if err := database.Current().
                Preload("Etablissement").
                Preload("Tuteur").
                Preload("Inscriptions.Classe").
                Preload("Inscriptions.AnneeScolaire").
                First(&eleve, "id = ?", id).Error; err != nil {
                if errors.Is(err, gorm.ErrRecordNotFound) {
                        return nil, errors.New("élève introuvable")
                }
                return nil, err
        }
        return &eleve, nil
}

// EleveDTO représente les données reçues pour créer/modifier un élève.
type EleveDTO struct {
        Nom                string                 `json:"nom"`
        Prenoms            string                 `json:"prenoms"`
        DateNaissance      *time.Time             `json:"date_naissance"`
        LieuNaissance      string                 `json:"lieu_naissance"`
        Sexe               models.Sexe            `json:"sexe"`
        Categorie          models.CategorieEleve  `json:"categorie"`
        MatriculeMinistere *string                `json:"matricule_ministere"`
        PhotoURL           string                 `json:"photo_url"`
        TuteurID           *uuid.UUID             `json:"tuteur_id"`
        Statut             models.StatutEleve     `json:"statut"`
}

// Create crée un nouvel élève dans un établissement.
// L'identifiant interne est auto-généré si non fourni.
func (s *EleveService) Create(dto EleveDTO, etablissementID uuid.UUID) (*models.Eleve, error) {
        // Vérifier l'établissement
        var etb models.Etablissement
        if err := database.Current().First(&etb, "id = ?", etablissementID).Error; err != nil {
                return nil, errors.New("établissement introuvable")
        }

        // Vérifier la cohérence catégorie / établissement
        if !etb.AppliqueCategorieAffecte && dto.Categorie != models.CategorieNonApplicable {
                // Forcer NON_APPLICABLE si l'établissement n'applique pas la distinction
                dto.Categorie = models.CategorieNonApplicable
        }
        if etb.AppliqueCategorieAffecte && dto.Categorie == models.CategorieNonApplicable {
                return nil, errors.New("catégorie invalide pour cet établissement (AFFECTE ou NON_AFFECTE requis)")
        }

        // Unicité du matricule ministériel si fourni
        if dto.MatriculeMinistere != nil && *dto.MatriculeMinistere != "" {
                var count int64
                database.Current().Model(&models.Eleve{}).Where("matricule_ministere = ?", *dto.MatriculeMinistere).Count(&count)
                if count > 0 {
                        return nil, errors.New("matricule ministériel déjà attribué à un autre élève")
                }
        }

        // Générer l'identifiant interne
        identifiantInterne, err := s.generateIdentifiantInterne(etablissementID)
        if err != nil {
                return nil, err
        }

        statut := dto.Statut
        if statut == "" {
                statut = models.StatutEleveActif
        }

        eleve := models.Eleve{
                EtablissementID:    etablissementID,
                IdentifiantInterne: identifiantInterne,
                Nom:                dto.Nom,
                Prenoms:            dto.Prenoms,
                DateNaissance:      dto.DateNaissance,
                LieuNaissance:      dto.LieuNaissance,
                Sexe:               dto.Sexe,
                PhotoURL:           dto.PhotoURL,
                Categorie:          dto.Categorie,
                Statut:             statut,
                TuteurID:           dto.TuteurID,
        }
        if dto.MatriculeMinistere != nil && *dto.MatriculeMinistere != "" {
                eleve.MatriculeMinistere = *dto.MatriculeMinistere
        }
        eleve.SearchVector = s.buildSearchVector(&eleve)

        if err := database.Current().Create(&eleve).Error; err != nil {
                return nil, fmt.Errorf("création élève: %w", err)
        }

        // Recharger avec relations
        return s.Get(eleve.ID)
}

// Update modifie un élève existant.
func (s *EleveService) Update(id uuid.UUID, dto EleveDTO) (*models.Eleve, error) {
        var eleve models.Eleve
        if err := database.Current().First(&eleve, "id = ?", id).Error; err != nil {
                return nil, errors.New("élève introuvable")
        }

        // Vérifier l'établissement pour la cohérence catégorie
        var etb models.Etablissement
        database.Current().First(&etb, "id = ?", eleve.EtablissementID)

        updates := map[string]interface{}{
                "nom":         dto.Nom,
                "prenoms":     dto.Prenoms,
                "date_naissance": dto.DateNaissance,
                "lieu_naissance": dto.LieuNaissance,
                "sexe":        dto.Sexe,
                "photo_url":   dto.PhotoURL,
                "tuteur_id":   dto.TuteurID,
        }

        // Catégorie : forcer NON_APPLICABLE si l'établissement n'applique pas
        if etb.AppliqueCategorieAffecte && dto.Categorie != "" {
                if dto.Categorie == models.CategorieNonApplicable {
                        return nil, errors.New("catégorie invalide pour cet établissement")
                }
                updates["categorie"] = dto.Categorie
        } else {
                updates["categorie"] = models.CategorieNonApplicable
        }

        if dto.Statut != "" {
                updates["statut"] = dto.Statut
        }

        // Matricule ministériel : vérifier l'unicité si changement
        if dto.MatriculeMinistere != nil && *dto.MatriculeMinistere != "" && *dto.MatriculeMinistere != eleve.MatriculeMinistere {
                var count int64
                database.Current().Model(&models.Eleve{}).
                        Where("matricule_ministere = ? AND id != ?", *dto.MatriculeMinistere, id).
                        Count(&count)
                if count > 0 {
                        return nil, errors.New("matricule ministériel déjà attribué à un autre élève")
                }
                updates["matricule_ministere"] = *dto.MatriculeMinistere
        } else if dto.MatriculeMinistere == nil || *dto.MatriculeMinistere == "" {
                updates["matricule_ministere"] = ""
        }

        if err := database.Current().Model(&eleve).Updates(updates).Error; err != nil {
                return nil, fmt.Errorf("mise à jour élève: %w", err)
        }

        // Recalculer le search_vector (qui dépend des champs modifiés)
        var updated models.Eleve
        database.Current().First(&updated, "id = ?", id)
        updated.SearchVector = s.buildSearchVector(&updated)
        database.Current().Model(&updated).Update("search_vector", updated.SearchVector)

        return s.Get(id)
}

// Delete supprime un élève (soft delete via GORM DeletedAt).
func (s *EleveService) Delete(id uuid.UUID) error {
        result := database.Current().Delete(&models.Eleve{}, "id = ?", id)
        if result.Error != nil {
                return result.Error
        }
        if result.RowsAffected == 0 {
                return errors.New("élève introuvable")
        }
        return nil
}

// generateIdentifiantInterne génère un identifiant interne unique au format
// {PREFIX-ETB}-{ANNEE}-{SEQUENCE}, ex. "COL-2026-0001", "EPV-2026-0002".
func (s *EleveService) generateIdentifiantInterne(etablissementID uuid.UUID) (string, error) {
        var etb models.Etablissement
        if err := database.Current().First(&etb, "id = ?", etablissementID).Error; err != nil {
                return "", errors.New("établissement introuvable")
        }

        // Préfixe basé sur le type d'établissement
        prefix := "ETB"
        if etb.AppliqueCategorieAffecte {
                prefix = "COL" // collège/lycée
        } else {
                prefix = "EPV" // école primaire
        }

        // Année courante
        year := time.Now().Year()

        // Compter les élèves existants pour la séquence
        var count int64
        database.Current().Model(&models.Eleve{}).Where("etablissement_id = ?", etablissementID).Count(&count)
        sequence := count + 1

        identifiant := fmt.Sprintf("%s-%d-%04d", prefix, year, sequence)

        // Vérifier l'unicité (au cas où) et incrémenter si besoin
        for {
                var exists int64
                database.Current().Model(&models.Eleve{}).Where("identifiant_interne = ?", identifiant).Count(&exists)
                if exists == 0 {
                        return identifiant, nil
                }
                sequence++
                identifiant = fmt.Sprintf("%s-%d-%04d", prefix, year, sequence)
        }
}

// buildSearchVector construit le vecteur de recherche normalisé d'un élève.
// Concatène nom, prénoms, matricule ministériel et identifiant interne,
// en retirant les accents et en minuscules, pour une recherche insensible
// aux accents (ex. "traore" trouve "Traoré").
func (s *EleveService) buildSearchVector(e *models.Eleve) string {
        matricule := e.MatriculeMinistere
        return utils.BuildSearchVector(e.Nom, e.Prenoms, matricule, e.IdentifiantInterne)
}
