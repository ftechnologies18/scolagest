package handlers

import (
        "net/http"
        "strconv"
        "time"

        "github.com/gin-gonic/gin"
        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/middleware"
        "github.com/scolagest/backend/internal/models"
        "github.com/scolagest/backend/internal/services"
)

// UserHandler expose les endpoints de gestion des utilisateurs et audit.
type UserHandler struct {
        svc *services.UserService
}

func NewUserHandler(svc *services.UserService) *UserHandler {
        return &UserHandler{svc: svc}
}

func (h *UserHandler) List(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        users, err := h.svc.List(etbID)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, users)
}

func (h *UserHandler) Create(c *gin.Context) {
        var dto services.UtilisateurDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
                return
        }

        // ── Gouvernance SaaS : contrôle des rôles créables ──
        // SUPER_ADMIN → peut créer DIRECTION (lié à la souscription d'abonnement)
        // DIRECTION → peut créer CAISSIER, COMPTABLE, SECRETARIAT
        // Personne ne peut créer SUPER_ADMIN via cette API
        requesterRole, _ := c.Get("user_role")
        requesterRoleTyped, _ := requesterRole.(models.RoleUtilisateur)
        requestedRole := dto.RoleGlobal

        if requestedRole != nil {
                switch *requestedRole {
                case models.RoleSuperAdmin:
                        c.JSON(http.StatusForbidden, gin.H{"error": "création de SUPER_ADMIN interdite — contactez le support SaaS"})
                        return
                case models.RoleDirection, models.RoleDirecteurEtudes, models.RoleDirecteurSuperviseur:
                        if requesterRoleTyped != models.RoleSuperAdmin {
                                c.JSON(http.StatusForbidden, gin.H{"error": "seul le SUPER_ADMIN peut créer un compte Direction (lié à la souscription d'abonnement)"})
                                return
                        }
                default:
                        // CAISSIER, COMPTABLE, SECRETARIAT : seul DIRECTION (ou SUPER_ADMIN) peut créer
                        if !models.IsDirectorRole(requesterRoleTyped) && requesterRoleTyped != models.RoleSuperAdmin {
                                c.JSON(http.StatusForbidden, gin.H{"error": "seul la Direction peut créer des utilisateurs staff"})
                                return
                        }
                }
        }

        u, err := h.svc.Create(dto)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusCreated, u)
}

func (h *UserHandler) Update(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        var dto services.UtilisateurDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
                return
        }

        // ── Anti-escalade de rôle ──
        // Mêmes règles que la création : seul SUPER_ADMIN peut attribuer DIRECTION
        requesterRole, _ := c.Get("user_role")
        requesterRoleTyped, _ := requesterRole.(models.RoleUtilisateur)
        if dto.RoleGlobal != nil {
                switch *dto.RoleGlobal {
                case models.RoleSuperAdmin:
                        c.JSON(http.StatusForbidden, gin.H{"error": "modification vers SUPER_ADMIN interdite"})
                        return
                case models.RoleDirection, models.RoleDirecteurEtudes, models.RoleDirecteurSuperviseur:
                        if requesterRoleTyped != models.RoleSuperAdmin {
                                c.JSON(http.StatusForbidden, gin.H{"error": "seul le SUPER_ADMIN peut attribuer le rôle Direction"})
                                return
                        }
                }
        }

        u, err := h.svc.Update(id, dto)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, u)
}

func (h *UserHandler) AddAccess(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        var dto services.AccessDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
                return
        }
        access, err := h.svc.AddAccess(id, dto)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusCreated, access)
}

func (h *UserHandler) RemoveAccess(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        etbID, err := uuid.Parse(c.Param("etablissement_id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        if err := h.svc.RemoveAccess(id, etbID); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, gin.H{"success": true})
}

func (h *UserHandler) ListAudit(c *gin.Context) {
        etbID := middleware.CurrentEtablissementID(c)
        filter := services.AuditFilter{EtablissementID: etbID}
        if v := c.Query("utilisateur_id"); v != "" {
                if id, err := uuid.Parse(v); err == nil {
                        filter.UtilisateurID = &id
                }
        }
        if v := c.Query("entite"); v != "" {
                filter.Entite = v
        }
        if v := c.Query("date_debut"); v != "" {
                if t, err := time.Parse("2006-01-02", v); err == nil {
                        filter.DateDebut = &t
                }
        }
        if v := c.Query("date_fin"); v != "" {
                if t, err := time.Parse("2006-01-02", v); err == nil {
                        filter.DateFin = &t
                }
        }
        if p, err := strconv.Atoi(c.DefaultQuery("page", "1")); err == nil {
                filter.Page = p
        }
        if ps, err := strconv.Atoi(c.DefaultQuery("page_size", "20")); err == nil {
                filter.PageSize = ps
        }
        result, err := h.svc.ListAudit(filter)
        if err != nil {
                c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, result)
}

// ===== Établissements (CRUD) =====

func (h *UserHandler) CreateEtablissement(c *gin.Context) {
        var dto services.EtablissementDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
                return
        }
        e, err := h.svc.CreateEtablissement(dto)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusCreated, e)
}

func (h *UserHandler) UpdateEtablissement(c *gin.Context) {
        id, err := uuid.Parse(c.Param("id"))
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "ID invalide"})
                return
        }
        var dto services.EtablissementDTO
        if err := c.ShouldBindJSON(&dto); err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": "requête invalide"})
                return
        }
        e, err := h.svc.UpdateEtablissement(id, dto)
        if err != nil {
                c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
                return
        }
        c.JSON(http.StatusOK, e)
}

func (h *UserHandler) RegisterRoutes(rg *gin.RouterGroup, authMW gin.HandlerFunc) {
        users := rg.Group("/utilisateurs", authMW)
        {
                users.GET("", h.List)
                users.POST("", h.Create)
                users.PUT("/:id", h.Update)
                users.POST("/:id/access", h.AddAccess)
                users.DELETE("/:id/access/:etablissement_id", h.RemoveAccess)
        }
        audit := rg.Group("/audit", authMW)
        {
                audit.GET("", h.ListAudit)
        }
        // Établissements CRUD (en plus du GET existant dans EtablissementHandler)
        etb := rg.Group("/etablissements", authMW)
        {
                etb.POST("", h.CreateEtablissement)
                etb.PUT("/:id", h.UpdateEtablissement)
        }
}
