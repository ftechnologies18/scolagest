package services

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
)

// AuditService fournit des helpers pour tracer les actions sensibles dans
// le journal d'audit (table journal_audit).
//
// Toutes les actions sensibles doivent être tracées :
//   - Création/modification/suppression d'entités critiques (élèves, paiements,
//     inscriptions, utilisateurs)
//   - Changements de rôle ou d'accès établissement
//   - Réinitialisation de mot de passe
//   - Validation/rejet de pré-inscriptions
//   - Annulation de paiements, clôtures de caisse
//   - Activations du mode support (SaaS)
//
// L'audit est "best-effort" : si l'insert échoue, on logge l'erreur mais on
// ne fait pas échouer l'action métier (l'audit ne doit pas bloquer le flux).
type AuditService struct{}

// NewAuditService construit un AuditService.
func NewAuditService() *AuditService {
	return &AuditService{}
}

// Log enregistre une entrée dans le journal d'audit.
//   - userID : utilisateur qui effectue l'action (0 si anonyme/system)
//   - etablissementID : établissement concerné (nil si global/SaaS)
//   - action : CREATE, UPDATE, DELETE, CANCEL, LOGIN, LOGOUT, EXPORT
//   - entite : nom de l'entité (ex: "eleve", "paiement", "utilisateur")
//   - entiteID : ID de l'entité (string, ex: UUID)
//   - ip : adresse IP du client
//   - details : struct ou map sérialisée en JSON (peut être nil)
func (s *AuditService) Log(
	userID uuid.UUID,
	etablissementID *uuid.UUID,
	action models.ActionAudit,
	entite, entiteID, ip string,
	details interface{},
) {
	var detailsJSON string
	if details != nil {
		if b, err := json.Marshal(details); err == nil {
			detailsJSON = string(b)
		}
	}

	entry := models.JournalAudit{
		BaseModel:       models.BaseModel{ID: uuid.New()},
		UtilisateurID:   &userID,
		EtablissementID: etablissementID,
		Action:          action,
		Entite:          entite,
		EntiteID:        entiteID,
		Date:            time.Now(),
		Details:         detailsJSON,
		IPAdresse:       ip,
	}

	// Best-effort : ne pas bloquer l'action métier si l'audit échoue.
	if err := database.Current().Create(&entry).Error; err != nil {
		// Logger l'erreur mais ne pas la propager (l'audit ne doit pas casser le flux).
		// Utiliser fmt.Println pour éviter une dépendance circulaire avec log.
		println("[AUDIT] erreur enregistrement:", err.Error())
	}
}

// LogFromContext helper pour les handlers Gin — extrait userID + etablissementID
// depuis le contexte et logge l'action.
// Usage dans un handler :
//   auditSvc.LogFromContext(c, models.AuditDelete, "eleve", eleveID, map[string]any{"nom": eleve.Nom})
func (s *AuditService) LogFromContext(
	c interface {
		Get(string) (interface{}, bool)
		ClientIP() string
	},
	action models.ActionAudit,
	entite, entiteID string,
	details interface{},
) {
	var userID uuid.UUID
	if v, ok := c.Get("user_id"); ok {
		if id, ok := v.(uuid.UUID); ok {
			userID = id
		}
	}

	var etbID *uuid.UUID
	if v, ok := c.Get("etablissement_id"); ok {
		if id, ok := v.(uuid.UUID); ok {
			etbID = &id
		}
	}

	ip := c.ClientIP()

	s.Log(userID, etbID, action, entite, entiteID, ip, details)
}

// LogAudit est une fonction package-level pour faciliter l'audit depuis les
// handlers sans nécessiter d'injection du service. Equivalent à NewAuditService().Log().
//
// Usage :
//   services.LogAudit(userID, etbID, models.AuditDelete, "eleve", eleveID, ip, details)
func LogAudit(
	userID uuid.UUID,
	etablissementID *uuid.UUID,
	action models.ActionAudit,
	entite, entiteID, ip string,
	details interface{},
) {
	NewAuditService().Log(userID, etablissementID, action, entite, entiteID, ip, details)
}
