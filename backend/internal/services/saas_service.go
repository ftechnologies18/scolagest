package services

import (
        "errors"
        "fmt"
        "time"

        "github.com/golang-jwt/jwt/v5"
        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/config"
        "github.com/scolagest/backend/internal/database"
        "github.com/scolagest/backend/internal/models"
)

// SaasService gère les opérations plateforme (SUPER_ADMIN).
type SaasService struct {
        jwt *JWTService
}

func NewSaasService(jwtSvc *JWTService) *SaasService {
        return &SaasService{jwt: jwtSvc}
}

// SaasEstablishment représente un établissement vu côté SaaS (sans données sensibles).
type SaasEstablishment struct {
        ID                   uuid.UUID `json:"id"`
        Nom                  string    `json:"nom"`
        CodeOfficiel         string    `json:"code_officiel"`
        Ville                string    `json:"ville"`
        Telephone            string    `json:"telephone"`
        Email                string    `json:"email"`
        AppliqueCategorieAffecte bool   `json:"applique_categorie_affecte"`
        Actif                bool      `json:"actif"`
        NbEleves             int64     `json:"nb_eleves"`
        NbUtilisateurs       int64     `json:"nb_utilisateurs"`
}

// ListEstablishments retourne tous les établissements (vue SaaS, sans données sensibles).
func (s *SaasService) ListEstablishments() ([]SaasEstablishment, error) {
        var etabs []models.Etablissement
        if err := database.DB.Order("nom ASC").Find(&etabs).Error; err != nil {
                return nil, err
        }

        var result []SaasEstablishment
        for _, e := range etabs {
                se := SaasEstablishment{
                        ID:                   e.ID,
                        Nom:                  e.Nom,
                        CodeOfficiel:         e.CodeOfficiel,
                        Ville:                e.Ville,
                        Telephone:            e.Telephone,
                        Email:                e.Email,
                        AppliqueCategorieAffecte: e.AppliqueCategorieAffecte,
                        Actif:                e.Actif,
                }
                // Compter les élèves et utilisateurs (statistiques uniquement)
                database.DB.Model(&models.Eleve{}).Where("etablissement_id = ?", e.ID).Count(&se.NbEleves)
                database.DB.Model(&models.EtablissementAccess{}).Where("etablissement_id = ?", e.ID).Count(&se.NbUtilisateurs)
                result = append(result, se)
        }
        return result, nil
}

// SaasStats représente les statistiques globales de la plateforme.
type SaasStats struct {
        NbEtablissements  int64 `json:"nb_etablissements"`
        NbEtablissementsActifs int64 `json:"nb_etablissements_actifs"`
        NbElevesTotal     int64 `json:"nb_eleves_total"`
        NbUtilisateursTotal int64 `json:"nb_utilisateurs_total"`
        NbPaiementsTotal  int64 `json:"nb_paiements_total"`
        MontantTotalEncaisse float64 `json:"montant_total_encaisse"`
}

// GetStats retourne les statistiques globales de la plateforme.
func (s *SaasService) GetStats() (*SaasStats, error) {
        stats := &SaasStats{}
        database.DB.Model(&models.Etablissement{}).Count(&stats.NbEtablissements)
        database.DB.Model(&models.Etablissement{}).Where("actif = ?", true).Count(&stats.NbEtablissementsActifs)
        database.DB.Model(&models.Eleve{}).Count(&stats.NbElevesTotal)
        database.DB.Model(&models.EtablissementAccess{}).Distinct("utilisateur_id").Count(&stats.NbUtilisateursTotal)
        database.DB.Model(&models.Paiement{}).Where("statut = ?", models.StatutPaiementValide).Count(&stats.NbPaiementsTotal)
        database.DB.Model(&models.Paiement{}).Where("statut = ?", models.StatutPaiementValide).
                Select("COALESCE(SUM(montant), 0)").Scan(&stats.MontantTotalEncaisse)
        return stats, nil
}

// ===== Mode Support =====

// SupportClaims : claims JWT pour le mode support SUPER_ADMIN.
type SupportClaims struct {
        UserID               uuid.UUID  `json:"uid"`
        Role                 models.RoleUtilisateur `json:"role"`
        SupportEtablissementID *uuid.UUID `json:"support_etb,omitempty"`
        jwt.RegisteredClaims
}

// ActivateSupport génère un token JWT avec mode support pour un établissement.
// Le SUPER_ADMIN peut alors accéder temporairement aux données de cet établissement.
func (s *SaasService) ActivateSupport(userID uuid.UUID, etablissementID uuid.UUID) (string, error) {
        // Vérifier que l'établissement existe
        var etb models.Etablissement
        if err := database.DB.First(&etb, "id = ?", etablissementID).Error; err != nil {
                return "", errors.New("établissement introuvable")
        }

        // Journaliser l'activation du mode support (audit)
        database.DB.Create(&models.JournalAudit{
                BaseModel:      models.BaseModel{ID: uuid.New()},
                UtilisateurID:  &userID,
                EtablissementID: &etablissementID,
                Action:         "SUPPORT_MODE_ACTIVATED",
                Entite:         "Etablissement",
                EntiteID:       etablissementID.String(),
                Date:           time.Now(),
                Details:        fmt.Sprintf(`{"action":"activate","etablissement":"%s"}`, etb.Nom),
        })

        // Générer un token JWT avec support claim (1h)
        claims := SupportClaims{
                UserID:               userID,
                Role:                 models.RoleSuperAdmin,
                SupportEtablissementID: &etablissementID,
                RegisteredClaims: jwt.RegisteredClaims{
                        ExpiresAt: jwt.NewNumericDate(time.Now().Add(1 * time.Hour)),
                        IssuedAt:  jwt.NewNumericDate(time.Now()),
                        Issuer:    "scolagest-support",
                        Subject:   userID.String(),
                        ID:        uuid.New().String(),
                },
        }
        token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
        return token.SignedString([]byte(config.App.JWTSecret))
}

// DeactivateSupport journalise la désactivation du mode support.
func (s *SaasService) DeactivateSupport(userID uuid.UUID, etablissementID *uuid.UUID) error {
        database.DB.Create(&models.JournalAudit{
                BaseModel:      models.BaseModel{ID: uuid.New()},
                UtilisateurID:  &userID,
                EtablissementID: etablissementID,
                Action:         "SUPPORT_MODE_DEACTIVATED",
                Entite:         "Etablissement",
                Date:           time.Now(),
        })
        return nil
}

// ValidateSupportToken valide un token support et retourne les claims.
func (s *SaasService) ValidateSupportToken(tokenStr string) (*SupportClaims, error) {
        claims := &SupportClaims{}
        token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
                if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
                        return nil, fmt.Errorf("méthode de signature inattendue: %v", t.Header["alg"])
                }
                return []byte(config.App.JWTSecret), nil
        })
        if err != nil {
                return nil, err
        }
        if !token.Valid {
                return nil, errors.New("token support invalide")
        }
        return claims, nil
}
