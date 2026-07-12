package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/scolagest/backend/internal/services"
)

// PasswordResetHandler expose les routes de récupération de mot de passe
// staff et de code PIN parent. Toutes publiques (sans auth).
type PasswordResetHandler struct {
	svc *services.PasswordResetService
}

func NewPasswordResetHandler(svc *services.PasswordResetService) *PasswordResetHandler {
	return &PasswordResetHandler{svc: svc}
}

// RequestPasswordReset gère POST /api/auth/password-reset/request
// Body: { "email": "user@example.com" }
// Ne révèle pas si l'email existe (sécurité). En mode démo, retourne reset_url.
func (h *PasswordResetHandler) RequestPasswordReset(c *gin.Context) {
	var body struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email requis"})
		return
	}

	result, err := h.svc.RequestPasswordReset(body.Email)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// ResetPassword gère POST /api/auth/password-reset/confirm
// Body: { "token": "xxx", "new_password": "yyy" }
func (h *PasswordResetHandler) ResetPassword(c *gin.Context) {
	var body struct {
		Token       string `json:"token"`
		NewPassword string `json:"new_password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token et nouveau mot de passe requis"})
		return
	}

	if err := h.svc.ResetPassword(body.Token, body.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// ResetParentPIN gère POST /api/parent/reset-pin
// Body: { "telephone": "...", "eleve_nom": "...", "eleve_prenoms": "..." }
// Vérifie l'identité du parent (téléphone + enfant) et régénère le PIN.
func (h *PasswordResetHandler) ResetParentPIN(c *gin.Context) {
	var body services.PINResetRequestDTO
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "payload invalide"})
		return
	}

	result, err := h.svc.ResetParentPIN(body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

// RegisterRoutes enregistre les routes (toutes publiques, sans auth).
func (h *PasswordResetHandler) RegisterRoutes(rg *gin.RouterGroup) {
	auth := rg.Group("/auth")
	{
		auth.POST("/password-reset/request", h.RequestPasswordReset)
		auth.POST("/password-reset/confirm", h.ResetPassword)
	}
	parent := rg.Group("/parent")
	{
		parent.POST("/reset-pin", h.ResetParentPIN)
	}
}
