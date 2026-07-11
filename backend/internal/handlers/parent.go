package handlers

import (
        "net/http"

        "github.com/gin-gonic/gin"
        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/models"
        "github.com/scolagest/backend/internal/services"
)

// ParentHandler expose les endpoints du portail parent.
type ParentHandler struct {
        svc        *services.ParentService
        accessSvc  *services.ParentAccessService
        momoSvc    *services.MomoService
}

func NewParentHandler(svc *services.ParentService, accessSvc *services.ParentAccessService, momoSvc *services.MomoService) *ParentHandler {
        return &ParentHandler{svc: svc, accessSvc: accessSvc, momoSvc: momoSvc}
}

// ParentAuthMiddleware valide le token parent temporaire et injecte le tuteur_id.
func ParentAuthMiddleware(accessSvc *services.ParentAccessService) gin.HandlerFunc {
        return func(c *gin.Context) {
                authHeader := c.GetHeader("Authorization")
                if authHeader == "" || len(authHeader) < 8 || authHeader[:7] != "Bearer " {
                        c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token parent manquant"})
                        return
                }
                tokenStr := authHeader[7:]
                claims, err := accessSvc.ValidateParentToken(tokenStr)
                if err != nil {
                        c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "token parent invalide ou expiré"})
                        return
                }
                c.Set("tuteur_id", claims.TuteurID)
                c.Next()
        }
}

// currentTuteurID extrait le tuteur_id du contexte.
func currentTuteurID(c *gin.Context) uuid.UUID {
        if v, ok := c.Get("tuteur_id"); ok {
                return v.(uuid.UUID)
        }
        return uuid.Nil
}

// Access gère POST /api/parent/access (PUBLIC — pas d'auth requis)
func (h *ParentHandler) Access(c *gin.Context) {
        var body struct {
                Telephone string `json:"telephone"`
                Pin       string `json:"pin"`
        }
        if err := c.ShouldBindJSON(&body); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
                return
        }
        result, err := h.accessSvc.Access(body.Telephone, body.Pin)
        if err != nil {
                c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, result)
}

// ListEnfants gère GET /api/parent/enfants
func (h *ParentHandler) ListEnfants(c *gin.Context) {
        tuteurID := currentTuteurID(c)
        enfants, err := h.svc.ListEnfants(tuteurID)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, enfants)
}

// GetSoldeEnfant gère GET /api/parent/enfants/:id/solde
func (h *ParentHandler) GetSoldeEnfant(c *gin.Context) {
        tuteurID := currentTuteurID(c)
        eleveID, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        solde, err := h.svc.GetSoldeEnfant(eleveID, tuteurID)
        if err != nil {
                c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, solde)
}

// ListPaiements gère GET /api/parent/paiements
func (h *ParentHandler) ListPaiements(c *gin.Context) {
        tuteurID := currentTuteurID(c)
        var eleveID *uuid.UUID
        if v := c.Query("eleve_id"); v != "" {
                if id, err := uuid.Parse(v); err == nil {
                        eleveID = &id
                }
        }
        paiements, err := h.svc.ListPaiements(tuteurID, eleveID, 50)
        if err != nil {
                c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, paiements)
}

// ListEcheances gère GET /api/parent/echeances
func (h *ParentHandler) ListEcheances(c *gin.Context) {
        tuteurID := currentTuteurID(c)
        echeances, err := h.svc.ListEcheances(tuteurID)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, echeances)
}

// GetRecu gère GET /api/parent/paiements/:id/recu
func (h *ParentHandler) GetRecu(c *gin.Context) {
        tuteurID := currentTuteurID(c)
        paiementID, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        recu, err := h.svc.GetRecu(paiementID, tuteurID)
        if err != nil {
                c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, recu)
}

// PayerMobileMoney gère POST /api/parent/payer/mobile-money
func (h *ParentHandler) PayerMobileMoney(c *gin.Context) {
        tuteurID := currentTuteurID(c)
        var body struct {
                EleveID         uuid.UUID           `json:"eleve_id"`
                FraisID         *uuid.UUID          `json:"frais_id"`
                Montant         float64             `json:"montant"`
                Provider        models.ProviderMomo `json:"provider"`
                TelephoneClient string              `json:"telephone_client"`
        }
        if err := c.ShouldBindJSON(&body); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
                return
        }

        // Vérifier que l'élève appartient bien à ce tuteur
        if !h.svc.CanAccessEleve(body.EleveID, tuteurID) {
                c.JSON(http.StatusForbidden, gin.H{"error": "cet élève n'est pas votre enfant"})
                return
        }

        // Récupérer l'établissement de l'élève
        etbID := h.svc.GetEleveEtablissementID(body.EleveID)
        if etbID == uuid.Nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement introuvable"})
                return
        }

        dto := services.MomoInitierDTO{
                EleveID:         body.EleveID,
                FraisID:         body.FraisID,
                Montant:         body.Montant,
                Provider:        body.Provider,
                TelephoneClient: body.TelephoneClient,
        }
        tx, err := h.momoSvc.Initier(dto, etbID)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusCreated, tx)
}

// RecapCaisse gère GET /api/parent/recap-caisse?eleve_id=
func (h *ParentHandler) RecapCaisse(c *gin.Context) {
        tuteurID := currentTuteurID(c)
        eleveID, err := uuid.Parse(c.Query("eleve_id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "eleve_id requis"})
                return
        }
        if !h.svc.CanAccessEleve(eleveID, tuteurID) {
                c.JSON(http.StatusForbidden, gin.H{"error": "cet élève n'est pas votre enfant"})
                return
        }
        recap, err := h.svc.GetRecapCaisse(eleveID, tuteurID)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, recap)
}

// RegisterRoutes enregistre les routes du portail parent.
func (h *ParentHandler) RegisterRoutes(rg *gin.RouterGroup) {
        // Route publique (pas d'auth) : authentification téléphone + PIN
        rg.POST("/parent/access", h.Access)

        // Routes protégées par token parent temporaire
        parentAuth := ParentAuthMiddleware(h.accessSvc)
        parent := rg.Group("/parent", parentAuth)
        {
                parent.GET("/enfants", h.ListEnfants)
                parent.GET("/enfants/:id/solde", h.GetSoldeEnfant)
                parent.GET("/paiements", h.ListPaiements)
                parent.GET("/echeances", h.ListEcheances)
                parent.GET("/paiements/:id/recu", h.GetRecu)
                parent.POST("/payer/mobile-money", h.PayerMobileMoney)
                parent.GET("/recap-caisse", h.RecapCaisse)
        }
}
