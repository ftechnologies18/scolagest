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

// InscriptionWorkflowHandler expose le workflow d'inscription complet
// (POST /api/inscriptions/workflow) + la détection de doublon
// (GET /api/eleves/check-doublon) + l'aperçu d'identifiant interne
// (GET /api/eleves/next-identifiant).
type InscriptionWorkflowHandler struct {
        svc *services.InscriptionWorkflowService
}

// NewInscriptionWorkflowHandler construit le handler.
func NewInscriptionWorkflowHandler(svc *services.InscriptionWorkflowService) *InscriptionWorkflowHandler {
        return &InscriptionWorkflowHandler{svc: svc}
}

// Create gère POST /api/inscriptions/workflow
// Crée en une transaction atomique : élève + tuteur (nouveau ou existant) +
// inscription dans une classe pour une année scolaire.
func (h *InscriptionWorkflowHandler) Create(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
                return
        }

        userID := middleware.CurrentUserID(c)

        var dto services.WorkflowDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "payload invalide", "details": err.Error()})
                return
        }

        // Validations basiques
        if dto.Eleve.Nom == "" {
                c.JSON(http.StatusBadRequest, gin.H{"error": "le nom de l'élève est requis"})
                return
        }
        if dto.Inscription.ClasseID == uuid.Nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "la classe est requise"})
                return
        }
        if dto.Inscription.AnneeScolaireID == uuid.Nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "l'année scolaire est requise"})
                return
        }

        result, err := h.svc.Create(dto, *etbID, userID)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }

        c.JSON(http.StatusCreated, result)
}

// CheckDoublon gère GET /api/eleves/check-doublon?nom=...&prenoms=...&date_naissance=...&matricule=...
// Retourne les élèves similaires (pour alerte temps réel dans le wizard).
func (h *InscriptionWorkflowHandler) CheckDoublon(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)

        nom := c.Query("nom")
        prenoms := c.Query("prenoms")
        matricule := c.Query("matricule")

        var dateNaiss *time.Time
        if d := c.Query("date_naissance"); d != "" {
                if parsed, err := time.Parse("2006-01-02", d); err == nil {
                        dateNaiss = &parsed
                }
        }

        eleves, err := h.svc.CheckDoublon(nom, prenoms, dateNaiss, matricule, etbID)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": "erreur lors de la vérification", "details": err.Error()})
                return
        }
        // Pour ne pas renvoyer null (le frontend attend un tableau, éventuellement vide)
        if eleves == nil {
                eleves = []models.Eleve{}
        }
        c.JSON(http.StatusOK, gin.H{"doublons": eleves})
}

// NextIdentifiant gère GET /api/eleves/next-identifiant
// Retourne un aperçu du prochain identifiant interne généré.
func (h *InscriptionWorkflowHandler) NextIdentifiant(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
                return
        }

        identifiant, err := h.svc.NextIdentifiant(*etbID)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }

        c.JSON(http.StatusOK, gin.H{"identifiant": identifiant})
}

// RegisterRoutes enregistre les routes du workflow d'inscription.
func (h *InscriptionWorkflowHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
        rg.POST("/inscriptions/workflow", authMW, h.Create)
        rg.GET("/eleves/check-doublon", authMW, h.CheckDoublon)
        rg.GET("/eleves/next-identifiant", authMW, h.NextIdentifiant)
}
