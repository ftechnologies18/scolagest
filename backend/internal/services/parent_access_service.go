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
	"github.com/scolagest/backend/internal/utils"
	"gorm.io/gorm"
)

// ParentAccessService gère l'accès parent par téléphone + PIN (sans compte utilisateur).
type ParentAccessService struct {
	jwt *JWTService
}

func NewParentAccessService(jwtSvc *JWTService) *ParentAccessService {
	return &ParentAccessService{jwt: jwtSvc}
}

// ParentAccessResult est retourné après une authentification parent réussie.
type ParentAccessResult struct {
	AccessToken string `json:"access_token"`
	Tuteur      struct {
		ID        uuid.UUID `json:"id"`
		Nom       string    `json:"nom"`
		Prenoms   string    `json:"prenoms"`
		Telephone string    `json:"telephone"`
	} `json:"tuteur"`
}

// Access authentifie un parent par numéro de téléphone + PIN.
// Retourne un token JWT temporaire (2h, scope "parent_temp").
func (s *ParentAccessService) Access(telephone, pin string) (*ParentAccessResult, error) {
	if telephone == "" || pin == "" {
		return nil, errors.New("numéro de téléphone et PIN obligatoires")
	}

	// Normaliser le téléphone (retirer espaces, +, etc.)
	normalizedTel := normalizePhone(telephone)

	// Chercher le tuteur par téléphone
	var tuteur models.Tuteur
	err := database.Current().Where(
		"REPLACE(REPLACE(REPLACE(REPLACE(telephone, ' ', ''), '+', ''), '-', ''), '.', '') = ? OR telephone = ?",
		normalizedTel, telephone,
	).First(&tuteur).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("numéro de téléphone ou PIN incorrect")
		}
		return nil, err
	}

	// Vérifier le PIN
	if tuteur.PinHash == "" {
		return nil, errors.New("aucun PIN configuré pour ce numéro — contactez l'établissement")
	}
	if !utils.CheckPassword(pin, tuteur.PinHash) {
		return nil, errors.New("numéro de téléphone ou PIN incorrect")
	}

	// Générer un token JWT temporaire (2h, scope parent_temp)
	token, err := s.generateParentToken(tuteur.ID)
	if err != nil {
		return nil, fmt.Errorf("génération token: %w", err)
	}

	result := &ParentAccessResult{
		AccessToken: token,
	}
	result.Tuteur.ID = tuteur.ID
	result.Tuteur.Nom = tuteur.Nom
	result.Tuteur.Prenoms = tuteur.Prenoms
	result.Tuteur.Telephone = tuteur.Telephone

	return result, nil
}

// ParentTempClaims : claims JWT pour un token parent temporaire.
type ParentTempClaims struct {
	TuteurID uuid.UUID `json:"tuteur_id"`
	jwt.RegisteredClaims
}

// generateParentToken génère un JWT temporaire pour le parent (valide 2h).
func (s *ParentAccessService) generateParentToken(tuteurID uuid.UUID) (string, error) {
	claims := ParentTempClaims{
		TuteurID: tuteurID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(2 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "scolagest-parent",
			Subject:   tuteurID.String(),
			ID:        uuid.New().String(),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(config.App.JWTSecret))
}

// ValidateParentToken valide un token parent temporaire et retourne le tuteur_id.
func (s *ParentAccessService) ValidateParentToken(tokenStr string) (*ParentTempClaims, error) {
	claims := &ParentTempClaims{}
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
		return nil, errors.New("token parent invalide")
	}
	return claims, nil
}

// GeneratePin génère un PIN aléatoire à 4 chiffres.
func GeneratePin() string {
	return fmt.Sprintf("%04d", uuid.New().ID()%10000)
}

// HashPin hashe un PIN avec bcrypt.
func HashPin(pin string) (string, error) {
	return utils.HashPassword(pin)
}

// normalizePhone retire les espaces, +, -, . d'un numéro de téléphone.
func normalizePhone(tel string) string {
	var result []byte
	for i := 0; i < len(tel); i++ {
		c := tel[i]
		if c >= '0' && c <= '9' {
			result = append(result, c)
		}
	}
	return string(result)
}
