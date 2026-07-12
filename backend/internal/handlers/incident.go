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

// IncidentHandler expose les routes des tickets d'incident disciplinaire.
//   - Routes prof (auth, rôle ENSEIGNANT) : signalement
//   - Routes staff (auth, DIRECTION/DIRECTEUR_*) : liste, traitement, tableau de bord
type IncidentHandler struct {
        svc *services.IncidentService
}

func NewIncidentHandler(svc *services.IncidentService) *IncidentHandler {
        return &IncidentHandler{svc: svc}
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes prof (rôle ENSEIGNANT)
// ─────────────────────────────────────────────────────────────────────────────

// CreateIncident gère POST /api/prof/incidents
// Le prof signale un incident depuis son téléphone.
func (h *IncidentHandler) CreateIncident(c *gin.Context) {
        userID := middleware.CurrentUserID(c)
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
                return
        }

        // Récupérer l'enseignant lié à cet utilisateur
        ensID, err := services.NewPointageService().GetEnseignantIDFromUtilisateur(userID)
        if err != nil {
                c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
                return
        }

        var dto services.TicketDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "payload invalide"})
                return
        }

        ticket, err := h.svc.CreateTicket(dto, *ensID, *etbID)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusCreated, ticket)
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes staff (DIRECTION, DIRECTEUR_*, SECRETARIAT, EDUCATEUR)
// L'éducateur accède aux tickets disciplinaires (lecture + traitement) dans
// le cadre de son périmètre vie scolaire.
// ─────────────────────────────────────────────────────────────────────────────

// ListIncidents gère GET /api/incidents?statut=...&eleve_id=...
func (h *IncidentHandler) ListIncidents(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
                return
        }

        var statut *models.StatutTicket
        if s := c.Query("statut"); s != "" {
                st := models.StatutTicket(s)
                statut = &st
        }

        var eleveID *uuid.UUID
        if e := c.Query("eleve_id"); e != "" {
                if id, err := uuid.Parse(e); err == nil {
                        eleveID = &id
                }
        }

        tickets, err := h.svc.ListTickets(*etbID, statut, eleveID)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, tickets)
}

// GetIncident gère GET /api/incidents/:id
func (h *IncidentHandler) GetIncident(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        ticket, err := h.svc.GetTicket(id)
        if err != nil {
                c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, ticket)
}

// TraiterIncident gère PUT /api/incidents/:id/traiter
// L'admin met à jour le statut + l'action prise.
func (h *IncidentHandler) TraiterIncident(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }

        var body struct {
                Statut      models.StatutTicket `json:"statut"`
                ActionPrise string              `json:"action_prise"`
        }
        if err := c.ShouldBindJSON(&body); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "payload invalide"})
                return
        }

        adminID := middleware.CurrentUserID(c)
        ticket, err := h.svc.TraiterTicket(id, adminID, body.Statut, body.ActionPrise)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, ticket)
}

// GetElevesRisque gère GET /api/discipline/eleves-risque?periode=30
// Retourne les élèves les plus signalés (tableau de bord discipline).
func (h *IncidentHandler) GetElevesRisque(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        if etbID == nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "établissement requis"})
                return
        }

        // Période en jours (défaut 30)
        periode := 30
        if p := c.Query("periode"); p != "" {
                if n, err := time.ParseDuration(p + "h"); err == nil {
                        periode = int(n.Hours() / 24)
                }
        }
        depuis := time.Now().AddDate(0, 0, -periode)

        eleves, err := h.svc.GetElevesRisque(*etbID, depuis)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, eleves)
}

// GetIncidentsEleve gère GET /api/eleves/:id/incidents
// Historique des incidents d'un élève (pour sa fiche).
func (h *IncidentHandler) GetIncidentsEleve(c *gin.Context) {
        eleveID, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }

        tickets, err := h.svc.GetTicketsEleve(eleveID)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, tickets)
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

func (h *IncidentHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
        // Routes prof (rôle ENSEIGNANT) — signalement
        prof := rg.Group("/prof", authMW, middleware.RequireRole(models.RoleEnseignant))
        {
                prof.POST("/incidents", h.CreateIncident)
        }

        // Routes staff (DIRECTION, DIRECTEUR_*, SECRETARIAT, EDUCATEUR) — gestion
        staff := rg.Group("/incidents", authMW, middleware.RequireRole(
                models.RoleDirection, models.RoleDirecteurEtudes, models.RoleDirecteurSuperviseur, models.RoleSecretariat, models.RoleEducateur,
        ))
        {
                staff.GET("", h.ListIncidents)
                staff.GET("/:id", h.GetIncident)
                staff.PUT("/:id/traiter", h.TraiterIncident)
        }

        // Discipline (tableau de bord)
        discipline := rg.Group("/discipline", authMW, middleware.RequireRole(
                models.RoleDirection, models.RoleDirecteurEtudes, models.RoleDirecteurSuperviseur, models.RoleSecretariat, models.RoleEducateur,
        ))
        {
                discipline.GET("/eleves-risque", h.GetElevesRisque)
        }

        // Historique incidents d'un élève (accessible à tout le staff)
        rg.Group("/eleves", authMW).GET("/:id/incidents", h.GetIncidentsEleve)
}
