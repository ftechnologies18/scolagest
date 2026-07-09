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

// List retourne une liste paginée d'élèves selon les filtres.
func (s *EleveService) List(filter EleveFilter) (*EleveResult, error) {
        db := database.DB

        if filter.Page < 1 {
                filter.Page = 1
        }
        if filter.PageSize < 1 || filter.PageSize > 100 {
                filter.PageSize = 20
        }

        q := db.Model(&models.Eleve{})

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

        // Filtre par classe : nécessite une jointure sur la dernière inscription
        if filter.ClasseID != nil {
                q = q.Joins("JOIN inscriptions ON inscriptions.eleve_id = eleves.id").
                        Where("inscriptions.classe_id = ?", *filter.ClasseID)
        }

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

// Get retourne un élève par son ID, avec ses relations.
func (s *EleveService) Get(id uuid.UUID) (*models.Eleve, error) {
        var eleve models.Eleve
        if err := database.DB.
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
        if err := database.DB.First(&etb, "id = ?", etablissementID).Error; err != nil {
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
                database.DB.Model(&models.Eleve{}).Where("matricule_ministere = ?", *dto.MatriculeMinistere).Count(&count)
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

        if err := database.DB.Create(&eleve).Error; err != nil {
                return nil, fmt.Errorf("création élève: %w", err)
        }

        // Recharger avec relations
        return s.Get(eleve.ID)
}

// Update modifie un élève existant.
func (s *EleveService) Update(id uuid.UUID, dto EleveDTO) (*models.Eleve, error) {
        var eleve models.Eleve
        if err := database.DB.First(&eleve, "id = ?", id).Error; err != nil {
                return nil, errors.New("élève introuvable")
        }

        // Vérifier l'établissement pour la cohérence catégorie
        var etb models.Etablissement
        database.DB.First(&etb, "id = ?", eleve.EtablissementID)

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
                database.DB.Model(&models.Eleve{}).
                        Where("matricule_ministere = ? AND id != ?", *dto.MatriculeMinistere, id).
                        Count(&count)
                if count > 0 {
                        return nil, errors.New("matricule ministériel déjà attribué à un autre élève")
                }
                updates["matricule_ministere"] = *dto.MatriculeMinistere
        } else if dto.MatriculeMinistere == nil || *dto.MatriculeMinistere == "" {
                updates["matricule_ministere"] = ""
        }

        if err := database.DB.Model(&eleve).Updates(updates).Error; err != nil {
                return nil, fmt.Errorf("mise à jour élève: %w", err)
        }

        // Recalculer le search_vector (qui dépend des champs modifiés)
        var updated models.Eleve
        database.DB.First(&updated, "id = ?", id)
        updated.SearchVector = s.buildSearchVector(&updated)
        database.DB.Model(&updated).Update("search_vector", updated.SearchVector)

        return s.Get(id)
}

// Delete supprime un élève (soft delete via GORM DeletedAt).
func (s *EleveService) Delete(id uuid.UUID) error {
        result := database.DB.Delete(&models.Eleve{}, "id = ?", id)
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
        if err := database.DB.First(&etb, "id = ?", etablissementID).Error; err != nil {
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
        database.DB.Model(&models.Eleve{}).Where("etablissement_id = ?", etablissementID).Count(&count)
        sequence := count + 1

        identifiant := fmt.Sprintf("%s-%d-%04d", prefix, year, sequence)

        // Vérifier l'unicité (au cas où) et incrémenter si besoin
        for {
                var exists int64
                database.DB.Model(&models.Eleve{}).Where("identifiant_interne = ?", identifiant).Count(&exists)
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
