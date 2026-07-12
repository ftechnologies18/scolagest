package services

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/scolagest/backend/internal/database"
	"github.com/scolagest/backend/internal/models"
	"gorm.io/gorm"
)

// IncidentService gère les tickets d'incident disciplinaire : signalement
// par les enseignants, traitement par l'administration, agrégations pour
// détecter les élèves à risque.
type IncidentService struct{}

func NewIncidentService() *IncidentService { return &IncidentService{} }

// ─────────────────────────────────────────────────────────────────────────────
// CRUD Tickets
// ─────────────────────────────────────────────────────────────────────────────

// TicketDTO : payload de création d'un ticket par un enseignant.
type TicketDTO struct {
	EleveID      uuid.UUID              `json:"eleve_id"`
	ClasseID     *uuid.UUID             `json:"classe_id,omitempty"`
	MatiereID    *uuid.UUID             `json:"matiere_id,omitempty"`
	Categorie    models.CategorieIncident `json:"categorie"`
	Gravite      models.GraviteIncident  `json:"gravite"`
	Description  string                  `json:"description"`
	DateIncident time.Time               `json:"date_incident"`
	Anonyme      bool                    `json:"anonyme"`
	PhotoURL     string                  `json:"photo_url"`
}

// ListTickets retourne les tickets d'un établissement avec filtres optionnels.
func (s *IncidentService) ListTickets(etablissementID uuid.UUID, statut *models.StatutTicket, eleveID *uuid.UUID) ([]models.TicketIncident, error) {
	q := database.Current().Model(&models.TicketIncident{}).
		Where("etablissement_id = ?", etablissementID)

	if statut != nil {
		q = q.Where("statut = ?", *statut)
	}
	if eleveID != nil {
		q = q.Where("eleve_id = ?", *eleveID)
	}

	var tickets []models.TicketIncident
	if err := q.Preload("Eleve").
		Preload("Enseignant").
		Preload("Classe").
		Preload("Matiere").
		Order("created_at DESC").
		Find(&tickets).Error; err != nil {
		return nil, err
	}

	// Si le ticket est anonyme, masquer l'enseignant dans la réponse
	for i := range tickets {
		if tickets[i].Anonyme {
			tickets[i].EnseignantID = uuid.Nil
			tickets[i].Enseignant = nil
		}
	}

	return tickets, nil
}

// GetTicket retourne un ticket par ID.
func (s *IncidentService) GetTicket(id uuid.UUID) (*models.TicketIncident, error) {
	var ticket models.TicketIncident
	if err := database.Current().
		Preload("Eleve").
		Preload("Enseignant").
		Preload("Classe").
		Preload("Matiere").
		First(&ticket, "id = ?", id).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("ticket introuvable")
		}
		return nil, err
	}
	if ticket.Anonyme {
		ticket.EnseignantID = uuid.Nil
		ticket.Enseignant = nil
	}
	return &ticket, nil
}

// CreateTicket crée un nouveau ticket d'incident (par un enseignant).
func (s *IncidentService) CreateTicket(dto TicketDTO, enseignantID, etablissementID uuid.UUID) (*models.TicketIncident, error) {
	if dto.EleveID == uuid.Nil {
		return nil, errors.New("l'élève est requis")
	}
	if dto.Categorie == "" {
		return nil, errors.New("la catégorie est requise")
	}
	if dto.Gravite == "" {
		return nil, errors.New("la gravité est requise")
	}
	if strings.TrimSpace(dto.Description) == "" {
		return nil, errors.New("la description est requise")
	}

	if dto.DateIncident.IsZero() {
		dto.DateIncident = time.Now()
	}

	ticket := models.TicketIncident{
		EtablissementID: etablissementID,
		EleveID:         dto.EleveID,
		EnseignantID:    enseignantID,
		ClasseID:        dto.ClasseID,
		MatiereID:       dto.MatiereID,
		Categorie:       dto.Categorie,
		Gravite:         dto.Gravite,
		Description:     dto.Description,
		DateIncident:    dto.DateIncident,
		Anonyme:         dto.Anonyme,
		PhotoURL:        dto.PhotoURL,
		Statut:          models.StatutTicketOuvert,
	}

	if err := database.Current().Create(&ticket).Error; err != nil {
		return nil, err
	}

	return s.GetTicket(ticket.ID)
}

// TraiterTicket met à jour le statut d'un ticket (par l'administration).
func (s *IncidentService) TraiterTicket(id, adminID uuid.UUID, statut models.StatutTicket, actionPrise string) (*models.TicketIncident, error) {
	var ticket models.TicketIncident
	if err := database.Current().First(&ticket, "id = ?", id).Error; err != nil {
		return nil, errors.New("ticket introuvable")
	}

	updates := map[string]interface{}{
		"statut":       statut,
		"traite_par":   adminID,
		"action_prise": actionPrise,
	}
	if statut == models.StatutTicketTraite || statut == models.StatutTicketCloture || statut == models.StatutTicketRejete {
		now := time.Now()
		updates["date_traitement"] = &now
	}

	if err := database.Current().Model(&ticket).Updates(updates).Error; err != nil {
		return nil, err
	}

	return s.GetTicket(id)
}

// ─────────────────────────────────────────────────────────────────────────────
// Détection des élèves à risque (tableau de bord discipline)
// ─────────────────────────────────────────────────────────────────────────────

// EleveRisque : élève avec un compte de signalements (pour le tableau de bord).
type EleveRisque struct {
	EleveID        uuid.UUID `json:"eleve_id"`
	EleveNom       string    `json:"eleve_nom"`
	ElevePrenoms   string    `json:"eleve_prenoms"`
	ClasseLibelle  string    `json:"classe_libelle"`
	NbTickets      int       `json:"nb_tickets"`
	NbProfsDifferents int    `json:"nb_profs_differents"` // key metric : multi-prof signalements
	NbCritiques    int       `json:"nb_critiques"`
	DernierTicket  *time.Time `json:"dernier_ticket,omitempty"`
	AConvoquer    bool       `json:"a_convoquer"` // 3+ signalements ou 1 critique
}

// GetElevesRisque retourne les élèves les plus signalés sur une période,
// avec le nombre de professeurs différents qui les ont signalés (métrique clé
// pour distinguer un conflit ponctuel d'un profil problématique).
func (s *IncidentService) GetElevesRisque(etablissementID uuid.UUID, depuis time.Time) ([]EleveRisque, error) {
	// Récupérer tous les tickets OUVERT/EN_COURS/TRAITE (pas REJETE) depuis la date
	var tickets []models.TicketIncident
	database.Current().
		Where("etablissement_id = ? AND created_at >= ? AND statut != ?",
			etablissementID, depuis, models.StatutTicketRejete).
		Find(&tickets)

	// Agréger par élève
	type agg struct {
		nbTickets       int
		nbCritiques     int
		profs           map[uuid.UUID]bool
		dernierTicket   time.Time
	}
	aggs := make(map[uuid.UUID]*agg)

	for _, t := range tickets {
		a, ok := aggs[t.EleveID]
		if !ok {
			a = &agg{profs: make(map[uuid.UUID]bool)}
			aggs[t.EleveID] = a
		}
		a.nbTickets++
		if t.Gravite == models.GraviteCritique {
			a.nbCritiques++
		}
		a.profs[t.EnseignantID] = true
		if t.CreatedAt.After(a.dernierTicket) {
			a.dernierTicket = t.CreatedAt
		}
	}

	// Charger les infos élèves
	result := make([]EleveRisque, 0, len(aggs))
	for eleveID, a := range aggs {
		var eleve models.Eleve
		if err := database.Current().First(&eleve, "id = ?", eleveID).Error; err != nil {
			continue
		}

		// Récupérer la classe courante
		classeLibelle := "—"
		var annee models.AnneeScolaire
		if database.Current().Where("est_active = ?", true).First(&annee).Error == nil {
			var ins models.Inscription
			if database.Current().Preload("Classe").Where("eleve_id = ? AND annee_scolaire_id = ?", eleveID, annee.ID).First(&ins).Error == nil && ins.Classe != nil {
				classeLibelle = ins.Classe.Libelle
			}
		}

		dernier := a.dernierTicket
		er := EleveRisque{
			EleveID:           eleveID,
			EleveNom:          eleve.Nom,
			ElevePrenoms:      eleve.Prenoms,
			ClasseLibelle:     classeLibelle,
			NbTickets:         a.nbTickets,
			NbProfsDifferents: len(a.profs),
			NbCritiques:       a.nbCritiques,
			DernierTicket:     &dernier,
			AConvoquer:        a.nbTickets >= 3 || a.nbCritiques >= 1,
		}
		result = append(result, er)
	}

	// Trier par nb tickets décroissant
	for i := 0; i < len(result); i++ {
		for j := i + 1; j < len(result); j++ {
			if result[j].NbTickets > result[i].NbTickets {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	return result, nil
}

// GetTicketsEleve retourne l'historique des tickets d'un élève (pour sa fiche).
func (s *IncidentService) GetTicketsEleve(eleveID uuid.UUID) ([]models.TicketIncident, error) {
	var tickets []models.TicketIncident
	if err := database.Current().
		Where("eleve_id = ?", eleveID).
		Preload("Enseignant").
		Preload("Classe").
		Preload("Matiere").
		Order("created_at DESC").
		Find(&tickets).Error; err != nil {
		return nil, err
	}
	// Masquer les profs anonymes
	for i := range tickets {
		if tickets[i].Anonyme {
			tickets[i].EnseignantID = uuid.Nil
			tickets[i].Enseignant = nil
		}
	}
	return tickets, nil
}
