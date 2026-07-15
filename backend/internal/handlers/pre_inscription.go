package handlers

import (
        "net/http"
        "time"

        "github.com/gin-gonic/gin"
        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/middleware"
        "github.com/scolagest/backend/internal/models"
        "github.com/scolagest/backend/internal/services"
)

// PreInscriptionHandler expose les routes de pré-inscription en ligne.
//   - Routes publiques (sans auth) : POST /api/public/pre-inscriptions,
//     GET /api/public/pre-inscriptions/:token
//   - Routes staff (auth) : GET /api/pre-inscriptions, GET /api/pre-inscriptions/:id,
//     POST /api/pre-inscriptions/:id/valider, POST /api/pre-inscriptions/:id/rejeter
type PreInscriptionHandler struct {
        svc *services.PreInscriptionService
}

func NewPreInscriptionHandler(svc *services.PreInscriptionService) *PreInscriptionHandler {
        return &PreInscriptionHandler{svc: svc}
}

// Submit gère POST /api/public/pre-inscriptions (route publique, sans auth).
func (h *PreInscriptionHandler) Submit(c *gin.Context) {
        var dto services.PreInscriptionDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "payload invalide", "details": err.Error()})
                return
        }

        pre, token, err := h.svc.Submit(dto)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        c.JSON(http.StatusCreated, gin.H{
                "pre_inscription": pre,
                "token_suivi":     token,
                "suivi_url":       "/pre-inscription/suivi?token=" + token,
        })
}

// GetByToken gère GET /api/public/pre-inscriptions/:token (route publique).
// Permet au parent de suivre l'état de sa demande via le token reçu.
func (h *PreInscriptionHandler) GetByToken(c *gin.Context) {
        token := c.Param("token")
        if token == "" {
                c.JSON(http.StatusBadRequest, gin.H{"error": "token requis"})
                return
        }

        pre, err := h.svc.GetByToken(token)
        if err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
                return
        }

        c.JSON(http.StatusOK, pre)
}

// List gère GET /api/pre-inscriptions?statut=... (route staff).
func (h *PreInscriptionHandler) List(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
                return
        }

        var statut *models.StatutPreInscription
        if s := c.Query("statut"); s != "" {
                st := models.StatutPreInscription(s)
                statut = &st
        }

        pres, err := h.svc.List(*etbID, statut)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }

        c.JSON(http.StatusOK, pres)
}

// Get gère GET /api/pre-inscriptions/:id (route staff).
func (h *PreInscriptionHandler) Get(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }

        pre, err := h.svc.Get(id)
        if err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
                return
        }

        c.JSON(http.StatusOK, pre)
}

// Valider gère POST /api/pre-inscriptions/:id/valider (route staff).
// Convertit la pré-inscription en élève + inscription réels via le workflow.
func (h *PreInscriptionHandler) Valider(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }

        userID := middleware.CurrentUserID(c)

        var body struct {
                ClasseID       string `json:"classe_id"`
                AnneeScolaireID string `json:"annee_scolaire_id"`
                Notes          string `json:"notes"`
        }
        if err := c.ShouldBindJSON(&body); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "payload invalide", "details": err.Error()})
                return
        }

        classeID, err := uuid.Parse(body.ClasseID)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "classe_id invalide"})
                return
        }
        anneeID, err := uuid.Parse(body.AnneeScolaireID)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "annee_scolaire_id invalide"})
                return
        }

        result, err := h.svc.Valider(id, classeID, anneeID, userID, body.Notes)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        // Audit : validation d'une pré-inscription (création élève + inscription)
        services.LogAudit(
                userID,
                etablissementIDPtr(c),
                models.AuditCreate, "pre_inscription", id.String(), c.ClientIP(),
                map[string]string{"action": "validation", "eleve_cree_id": result.Eleve.ID.String()},
        )
        c.JSON(http.StatusCreated, result)
}

// Rejeter gère POST /api/pre-inscriptions/:id/rejeter (route staff).
func (h *PreInscriptionHandler) Rejeter(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }

        userID := middleware.CurrentUserID(c)

        var body struct {
                Motif string `json:"motif"`
        }
        _ = c.ShouldBindJSON(&body)

        if err := h.svc.Rejeter(id, userID, body.Motif); err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        // Audit : rejet d'une pré-inscription
        services.LogAudit(
                userID,
                etablissementIDPtr(c),
                models.AuditUpdate, "pre_inscription", id.String(), c.ClientIP(),
                map[string]string{"action": "rejet", "motif": body.Motif},
        )
        c.JSON(http.StatusOK, gin.H{"success": true, "date": time.Now()})
}

// SearchTuteur gère GET /api/public/pre-inscriptions/search-tuteur?telephone=...
// Route publique pour la détection fratrie sur le formulaire de pré-inscription.
func (h *PreInscriptionHandler) SearchTuteur(c *gin.Context) {
        telephone := c.Query("telephone")
        result, err := h.svc.SearchTuteurByPhone(telephone)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, result)
}

// CountSoumises gère GET /api/pre-inscriptions/count-soumises (route staff).
// Retourne le nombre de pré-inscriptions en attente (pour le badge sidebar).
func (h *PreInscriptionHandler) CountSoumises(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
                return
        }
        count, err := h.svc.CountSoumises(*etbID)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, gin.H{"count": count})
}

// RegisterPublicRoutes enregistre les routes publiques (sans auth).
func (h *PreInscriptionHandler) RegisterPublicRoutes(rg *gin.RouterGroup) {
        pub := rg.Group("/public")
        {
                pub.POST("/pre-inscriptions", h.Submit)
                pub.GET("/pre-inscriptions/:token", h.GetByToken)
                pub.GET("/pre-inscriptions/search-tuteur", h.SearchTuteur)
        }
}

// RegisterRoutes enregistre les routes staff (avec auth).
func (h *PreInscriptionHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
        pre := rg.Group("/pre-inscriptions", authMW)
        {
                pre.GET("", h.List)
                pre.GET("/count-soumises", h.CountSoumises)
                pre.GET("/:id", h.Get)
                pre.POST("/:id/valider", h.Valider)
                pre.POST("/:id/rejeter", h.Rejeter)
        }
}
