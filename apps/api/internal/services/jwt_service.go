package services

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/config"
	"github.com/scolagest/backend/internal/models"
)

// JWTService gère la création et la validation des tokens JWT.
type JWTService struct {
	secret       []byte
	accessExpHr  int
	refreshExpHr int
}

// NewJWTService construit un JWTService depuis la configuration.
func NewJWTService(cfg *config.Config) *JWTService {
	return &JWTService{
		secret:       []byte(cfg.JWTSecret),
		accessExpHr:  cfg.JWTAccessExpHr,
		refreshExpHr: cfg.JWTRefreshExpHr,
	}
}

// Claims personnalisés pour ScolaGest.
type Claims struct {
	UserID         uuid.UUID              `json:"uid"`
	Email          string                 `json:"email"`
	Role           models.RoleUtilisateur `json:"role"`
	EtablissementID *uuid.UUID            `json:"etb,omitempty"`
	jwt.RegisteredClaims
}

// GenerateAccessToken crée un access token JWT (courte durée).
func (s *JWTService) GenerateAccessToken(user *models.Utilisateur, etablissementID *uuid.UUID, role models.RoleUtilisateur) (string, time.Time, error) {
	expiresAt := time.Now().Add(time.Duration(s.accessExpHr) * time.Hour)
	claims := Claims{
		UserID:          user.ID,
		Email:           user.Email,
		Role:            role,
		EtablissementID: etablissementID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "scolagest",
			Subject:   user.ID.String(),
			ID:        uuid.New().String(),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.secret)
	return signed, expiresAt, err
}

// GenerateRefreshToken crée un refresh token JWT (longue durée).
func (s *JWTService) GenerateRefreshToken(user *models.Utilisateur) (string, time.Time, error) {
	expiresAt := time.Now().Add(time.Duration(s.refreshExpHr) * time.Hour)
	claims := Claims{
		UserID: user.ID,
		Email:  user.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expiresAt),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "scolagest-refresh",
			Subject:   user.ID.String(),
			ID:        uuid.New().String(),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.secret)
	return signed, expiresAt, err
}

// ValidateToken vérifie un token JWT et retourne les claims.
func (s *JWTService) ValidateToken(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("méthode de signature inattendue: %v", t.Header["alg"])
		}
		return s.secret, nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, errors.New("token invalide")
	}
	return claims, nil
}

// HashToken renvoie le hash SHA-256 d'un token (pour stockage en base sans le secret en clair).
func HashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
