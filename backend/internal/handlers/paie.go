package handlers

import (
        "net/http"
        "strconv"

        "github.com/gin-gonic/gin"
        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/database"
        "github.com/scolagest/backend/internal/middleware"
        "github.com/scolagest/backend/internal/models"
        "github.com/scolagest/backend/internal/services"
)

// PaieHandler expose les routes de paie enseignants.
//   - Routes staff (DIRECTION, DIRECTEUR_*) : bulletins, avances, génération
//   - Routes prof (ENSEIGNANT) : mes bulletins
type PaieHandler struct {
        svc *services.PaieService
}

func NewPaieHandler(svc *services.PaieService) *PaieHandler {
        return &PaieHandler{svc: svc}
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes staff
// ─────────────────────────────────────────────────────────────────────────────

// ListBulletins gère GET /api/paie/bulletins?mois=&annee=
func (h *PaieHandler) ListBulletins(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
                return
        }

        var mois, annee *int
        if m := c.Query("mois"); m != "" {
                if n, err := parseInt(m); err == nil {
                        mois = &n
                }
        }
        if a := c.Query("annee"); a != "" {
                if n, err := parseInt(a); err == nil {
                        annee = &n
                }
        }

        bulletins, err := h.svc.ListBulletins(*etbID, mois, annee)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, bulletins)
}

// GetBulletin gère GET /api/paie/bulletins/:id
func (h *PaieHandler) GetBulletin(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        b, err := h.svc.GetBulletin(id)
        if err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, b)
}

// GenerateBulletin gère POST /api/paie/bulletins/generate
// Body: { enseignant_id, mois, annee }
func (h *PaieHandler) GenerateBulletin(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
                return
        }

        var body struct {
                EnseignantID string `json:"enseignant_id"`
                Mois         int    `json:"mois"`
                Annee        int    `json:"annee"`
        }
        if err := c.ShouldBindJSON(&body); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "payload invalide"})
                return
        }

        ensID, err := uuid.Parse(body.EnseignantID)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "enseignant_id invalide"})
                return
        }

        // Récupérer l'année active
        var annee models.AnneeScolaire
        _ = database.Current().Where("est_active = ?", true).First(&annee).Error

        result, err := h.svc.GenerateBulletin(ensID, *etbID, annee.ID, body.Mois, body.Annee)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusCreated, result)
}

// ValiderBulletin gère POST /api/paie/bulletins/:id/valider
func (h *PaieHandler) ValiderBulletin(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }

        var body struct {
                Cotisations float64 `json:"cotisations"`
        }
        _ = c.ShouldBindJSON(&body)

        adminID := middleware.CurrentUserID(c)
        b, err := h.svc.ValiderBulletin(id, adminID, body.Cotisations)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, b)
}

// PayerBulletin gère POST /api/paie/bulletins/:id/payer
func (h *PaieHandler) PayerBulletin(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }

        var body struct {
                Reference string `json:"reference"`
        }
        _ = c.ShouldBindJSON(&body)

        adminID := middleware.CurrentUserID(c)
        b, err := h.svc.PayerBulletin(id, adminID, body.Reference)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, b)
}

// ─────────────────────────────────────────────────────────────────────────────
// Avances
// ─────────────────────────────────────────────────────────────────────────────

func (h *PaieHandler) ListAvances(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
                return
        }

        var statut *models.StatutAvance
        if s := c.Query("statut"); s != "" {
                st := models.StatutAvance(s)
                statut = &st
        }

        avances, err := h.svc.ListAvances(*etbID, statut)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, avances)
}

func (h *PaieHandler) CreateAvance(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
                return
        }

        var body struct {
                EnseignantID string  `json:"enseignant_id"`
                Montant      float64 `json:"montant"`
                Motif        string  `json:"motif"`
        }
        if err := c.ShouldBindJSON(&body); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "payload invalide"})
                return
        }

        ensID, err := uuid.Parse(body.EnseignantID)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "enseignant_id invalide"})
                return
        }

        a, err := h.svc.CreateAvance(ensID, *etbID, services.AvanceDTO{
                Montant: body.Montant,
                Motif:   body.Motif,
        })
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusCreated, a)
}

func (h *PaieHandler) TraiterAvance(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }

        var body struct {
                Approuver  bool   `json:"approuver"`
                MotifRejet string `json:"motif_rejet"`
        }
        _ = c.ShouldBindJSON(&body)

        adminID := middleware.CurrentUserID(c)
        a, err := h.svc.TraiterAvance(id, adminID, body.Approuver, body.MotifRejet)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, a)
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes prof (mes bulletins)
// ─────────────────────────────────────────────────────────────────────────────

// GetMesBulletins gère GET /api/prof/bulletins
func (h *PaieHandler) GetMesBulletins(c *gin.Context) {
        userID := middleware.CurrentUserID(c)

        ensID, err := services.NewPointageService().GetEnseignantIDFromUtilisateur(userID)
        if err != nil {
                c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
                return
        }

        bulletins, err := h.svc.GetBulletinsEnseignant(*ensID)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, bulletins)
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

func (h *PaieHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
        // Routes staff (DIRECTION, DIRECTEUR_*)
        paie := rg.Group("/paie", authMW, middleware.RequireRole(
                models.RoleDirection, models.RoleDirecteurEtudes, models.RoleDirecteurSuperviseur,
        ))
        {
                paie.GET("/bulletins", h.ListBulletins)
                paie.GET("/bulletins/:id", h.GetBulletin)
                paie.POST("/bulletins/generate", h.GenerateBulletin)
                paie.POST("/bulletins/:id/valider", h.ValiderBulletin)
                paie.POST("/bulletins/:id/payer", h.PayerBulletin)
                paie.GET("/avances", h.ListAvances)
                paie.POST("/avances", h.CreateAvance)
                paie.POST("/avances/:id/traiter", h.TraiterAvance)
        }

        // Routes prof (ENSEIGNANT)
        prof := rg.Group("/prof", authMW, middleware.RequireRole(models.RoleEnseignant))
        {
                prof.GET("/bulletins", h.GetMesBulletins)
        }
}

// parseInt helper
func parseInt(s string) (int, error) {
        return strconv.Atoi(s)
}
