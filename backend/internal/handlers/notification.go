package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/scolagest/backend/internal/models"
	"github.com/scolagest/backend/internal/services"
)

// NotificationHandler expose les endpoints liés aux notifications (emails, SMS).
// Actuellement : test d'envoi d'email (SUPER_ADMIN uniquement).
type NotificationHandler struct {
	notifSvc *services.NotificationService
}

// NewNotificationHandler construit un NotificationHandler.
func NewNotificationHandler(notifSvc *services.NotificationService) *NotificationHandler {
	return &NotificationHandler{notifSvc: notifSvc}
}

// testEmailRequest : payload optionnel de POST /api/notifications/test.
// Si "to" est vide, l'email est envoyé à l'utilisateur connecté.
type testEmailRequest struct {
	To string `json:"to"`
}

// testEmail gère POST /api/notifications/test (SUPER_ADMIN uniquement).
//
// Body (optionnel) : { "to": "destinataire@example.com" }
//
// Réponse :
//   - Si un transport est configuré (Resend ou SMTP) :
//     { "sent": true, "to": "...", "transport": "resend"|"smtp" }
//   - Sinon (mode dev) :
//     { "sent": false, "transport": "dev", "message": "Aucun transport email configuré (RESEND_API_KEY ou SMTP_*)." }
//
// Permet de vérifier que la configuration email (Resend ou SMTP) fonctionne
// avant de mettre en production.
func (h *NotificationHandler) testEmail(c *gin.Context) {
	// 1. Vérifier le rôle SUPER_ADMIN
	roleVal, exists := c.Get("user_role")
	if !exists {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "rôle non déterminé"})
		return
	}
	role, ok := roleVal.(models.RoleUtilisateur)
	if !ok || role != models.RoleSuperAdmin {
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "accès refusé — SUPER_ADMIN uniquement"})
		return
	}

	// 2. Déterminer le destinataire (body optionnel, défaut = email du user connecté)
	var req testEmailRequest
	_ = c.ShouldBindJSON(&req) // optionnel — pas d'erreur si body vide
	to := req.To
	if to == "" {
		to = c.GetString("user_email")
	}
	if to == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "destinataire requis (body 'to' ou utilisateur connecté)"})
		return
	}

	// 3. Vérifier qu'un transport est configuré
	transport := h.notifSvc.Transport()
	if transport == "dev" {
		c.JSON(http.StatusOK, gin.H{
			"sent":      false,
			"transport": "dev",
			"message":   "Aucun transport email configuré (RESEND_API_KEY ou SMTP_*).",
		})
		return
	}

	// 4. Envoyer l'email de test
	subject, text, html := services.TemplateTestEmail(to)
	if err := h.notifSvc.SendEmailHTML(to, subject, text, html); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{
			"sent":      false,
			"transport": transport,
			"to":        to,
			"error":     err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"sent":      true,
		"to":        to,
		"transport": transport,
	})
}

// RegisterRoutes enregistre les routes notifications sur le router.
// Toutes les routes sont protégées par authMW.
func (h *NotificationHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
	notif := rg.Group("/notifications")
	{
		notif.POST("/test", authMW, h.testEmail)
	}
}
