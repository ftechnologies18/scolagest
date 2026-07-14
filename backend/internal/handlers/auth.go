package handlers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/middleware"
	"github.com/scolagest/backend/internal/services"
)

// AuthHandler expose les endpoints d'authentification.
type AuthHandler struct {
	auth *services.AuthService
}

// NewAuthHandler construit un AuthHandler.
func NewAuthHandler(auth *services.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

type loginRequest struct {
	Email          string  `json:"email" binding:"required,email"`
	Password       string  `json:"password" binding:"required"`
	EtablissementID *string `json:"etablissement_id"`
}

// Login gère POST /api/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide", "details": err.Error()})
		return
	}

	var etbID *uuid.UUID
	if req.EtablissementID != nil && *req.EtablissementID != "" {
		id, err := uuid.Parse(*req.EtablissementID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "etablissement_id invalide"})
			return
		}
		etbID = &id
	}

	ip := c.ClientIP()
	ua := c.GetHeader("User-Agent")

	result, err := h.auth.Login(req.Email, req.Password, etbID, ip, ua)
	if err != nil {
		if errors.Is(err, errors.New("identifiants invalides")) || err.Error() == "identifiants invalides" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Identifiants invalides"})
			return
		}
		if err.Error() == "compte désactivé ou bloqué" || err.Error() == "accès à cet établissement non autorisé" || err.Error() == "aucun rôle attribué — contactez l'administrateur" || err.Error() == "le SUPER_ADMIN ne peut pas sélectionner d'établissement — utilisez le mode support pour la maintenance" {
			c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erreur serveur", "details": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

// Refresh gère POST /api/auth/refresh
func (h *AuthHandler) Refresh(c *gin.Context) {
	var req refreshRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
		return
	}
	access, refresh, err := h.auth.Refresh(req.RefreshToken, c.ClientIP(), c.GetHeader("User-Agent"))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"access_token": access, "refresh_token": refresh})
}

// Logout gère POST /api/auth/logout (auth requis)
func (h *AuthHandler) Logout(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	if err := h.auth.Logout(userID, c.ClientIP()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "erreur lors de la déconnexion"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true})
}

// Me gère GET /api/auth/me (auth requis)
func (h *AuthHandler) Me(c *gin.Context) {
	userID := middleware.CurrentUserID(c)
	etbID := middleware.CurrentEtablissementID(c)

	user, etb, role, err := h.auth.GetMe(userID, etbID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "utilisateur introuvable"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"user":          user,
		"etablissement": etb,
		"role":          role,
	})
}

// RegisterRoutes enregistre les routes d'auth sur le router.
func (h *AuthHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
	auth := rg.Group("/auth")
	{
		auth.POST("/login", h.Login)
		auth.POST("/refresh", h.Refresh)
		auth.POST("/logout", authMW, h.Logout)
		auth.GET("/me", authMW, h.Me)
	}
}
