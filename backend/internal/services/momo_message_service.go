package services

import (
        "encoding/json"
        "errors"
        "fmt"
        "time"

        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/database"
        "github.com/scolagest/backend/internal/models"
)

// MomoService gère les transactions Mobile Money.
type MomoService struct{}

func NewMomoService() *MomoService { return &MomoService{} }

// MomoInitierDTO pour initier une transaction.
type MomoInitierDTO struct {
        EleveID         uuid.UUID            `json:"eleve_id"`
        FraisID         *uuid.UUID           `json:"frais_id"`
        Montant         float64              `json:"montant"`
        Provider        models.ProviderMomo  `json:"provider"`
        TelephoneClient string               `json:"telephone_client"`
}

// MomoFilter filtre les transactions.
type MomoFilter struct {
        EtablissementID *uuid.UUID
        Statut          *models.StatutTransactionMomo
        Provider        *models.ProviderMomo
        DateDebut       *time.Time
        DateFin         *time.Time
        Page            int
        PageSize        int
}

// MomoResult est le résultat paginé.
type MomoResult struct {
        Data     []models.TransactionMobileMoney `json:"data"`
        Total    int64                            `json:"total"`
        Page     int                              `json:"page"`
        PageSize int                              `json:"page_size"`
}

// List retourne les transactions paginées.
func (s *MomoService) List(filter MomoFilter) (*MomoResult, error) {
        if filter.Page < 1 {
                filter.Page = 1
        }
        if filter.PageSize < 1 || filter.PageSize > 100 {
                filter.PageSize = 20
        }
        q := database.DB.Model(&models.TransactionMobileMoney{}).Preload("Eleve")
        if filter.EtablissementID != nil {
                q = q.Where("etablissement_id = ?", *filter.EtablissementID)
        }
        if filter.Statut != nil {
                q = q.Where("statut = ?", *filter.Statut)
        }
        if filter.Provider != nil {
                q = q.Where("provider = ?", *filter.Provider)
        }
        if filter.DateDebut != nil {
                q = q.Where("date_initiation >= ?", *filter.DateDebut)
        }
        if filter.DateFin != nil {
                q = q.Where("date_initiation <= ?", *filter.DateFin)
        }
        var total int64
        q.Count(&total)
        var txs []models.TransactionMobileMoney
        offset := (filter.Page - 1) * filter.PageSize
        q.Order("date_initiation DESC").Offset(offset).Limit(filter.PageSize).Find(&txs)
        return &MomoResult{Data: txs, Total: total, Page: filter.Page, PageSize: filter.PageSize}, nil
}

// Initier crée une transaction MoMo (sandbox : simule l'initiation auprès du provider).
func (s *MomoService) Initier(dto MomoInitierDTO, etablissementID uuid.UUID) (*models.TransactionMobileMoney, error) {
        if dto.Montant <= 0 {
                return nil, errors.New("le montant doit être positif")
        }
        if dto.TelephoneClient == "" {
                return nil, errors.New("le téléphone client est obligatoire")
        }
        // Vérifier l'élève
        var eleve models.Eleve
        if err := database.DB.First(&eleve, "id = ?", dto.EleveID).Error; err != nil {
                return nil, errors.New("élève introuvable")
        }

        // Simuler l'appel au provider (sandbox)
        payloadReq, _ := json.Marshal(map[string]interface{}{
                "provider":   dto.Provider,
                "montant":    dto.Montant,
                "telephone":  dto.TelephoneClient,
                "reference":  fmt.Sprintf("SCOL-%s", time.Now().Format("20060102150405")),
                "callback_url": "/api/mobile-money/webhooks",
        })

        tx := models.TransactionMobileMoney{
                EleveID:         dto.EleveID,
                EtablissementID: etablissementID,
                Provider:        dto.Provider,
                Montant:         dto.Montant,
                TelephoneClient: dto.TelephoneClient,
                ReferenceExterne: fmt.Sprintf("MOMO-%s-%d", dto.Provider, time.Now().Unix()),
                Statut:          models.StatutMomoInitiee,
                PayloadRequete:  string(payloadReq),
                DateInitiation:  time.Now(),
        }
        // En sandbox, on simule une réponse du provider
        payloadResp, _ := json.Marshal(map[string]interface{}{
                "status":  "PENDING",
                "message": "Transaction initiée — en attente de confirmation du client",
                "ref":     tx.ReferenceExterne,
        })
        tx.PayloadReponse = string(payloadResp)

        if err := database.DB.Create(&tx).Error; err != nil {
                return nil, err
        }
        return &tx, nil
}

// Confirmer simule la confirmation d'une transaction (webhook sandbox).
// En production, cette méthode serait appelée par le webhook du provider.
func (s *MomoService) Confirmer(id uuid.UUID) (*models.TransactionMobileMoney, error) {
        var tx models.TransactionMobileMoney
        if err := database.DB.First(&tx, "id = ?", id).Error; err != nil {
                return nil, errors.New("transaction introuvable")
        }
        if tx.Statut == models.StatutMomoReussie {
                return nil, errors.New("transaction déjà confirmée")
        }

        now := time.Now()
        // Simuler un succès (en sandbox)
        updates := map[string]interface{}{
                "statut":            models.StatutMomoReussie,
                "date_confirmation": now,
        }
        payloadResp, _ := json.Marshal(map[string]interface{}{
                "status":  "SUCCESS",
                "message": "Transaction confirmée par le client",
                "ref":     tx.ReferenceExterne,
                "date":    now,
        })
        updates["payload_reponse"] = string(payloadResp)
        database.DB.Model(&tx).Updates(updates)

        // Créer le paiement associé
        var eleve models.Eleve
        database.DB.First(&eleve, "id = ?", tx.EleveID)
        var annee models.AnneeScolaire
        database.DB.Where("est_active = ?", true).First(&annee)
        var inscription models.Inscription
        database.DB.Where("eleve_id = ? AND annee_scolaire_id = ?", tx.EleveID, annee.ID).First(&inscription)

        // Numéro de reçu
        numeroRecu := fmt.Sprintf("REC-MOMO-%s-%06d", time.Now().Format("2006"), time.Now().Unix()%1000000)
        providerCopy := tx.Provider
        paiement := models.Paiement{
                EleveID:          tx.EleveID,
                InscriptionID:    inscription.ID,
                EtablissementID:  tx.EtablissementID,
                FraisID:          tx.FraisID,
                Montant:          tx.Montant,
                ModePaiement:     models.ModeMobileMoney,
                ProviderMomo:     &providerCopy,
                ReferenceExterne: tx.ReferenceExterne,
                DatePaiement:     now,
                CaissierID:       uuid.Nil, // système (pas de caissier pour MoMo)
                Statut:           models.StatutPaiementValide,
                NumeroRecu:       numeroRecu,
        }
        database.DB.Create(&paiement)

        // Lier le paiement à la transaction
        database.DB.Model(&tx).Update("paiement_id", paiement.ID)

        database.DB.First(&tx, "id = ?", id)
        return &tx, nil
}

// WebhookLog représente un événement webhook reçu.
type WebhookLog struct {
        ID           uuid.UUID              `json:"id"`
        Provider     models.ProviderMomo    `json:"provider"`
        Reference    string                 `json:"reference"`
        Statut       string                 `json:"statut"`
        Payload      string                 `json:"payload"`
        DateReception time.Time             `json:"date_reception"`
        TransactionID *uuid.UUID            `json:"transaction_id"`
        Reconcilie   bool                   `json:"reconcilie"`
}

// ListWebhooks retourne les webhooks récents (simulés pour V1).
func (s *MomoService) ListWebhooks(etablissementID uuid.UUID) ([]WebhookLog, error) {
        // En V1 sandbox, on simule les webhooks en listant les transactions avec payload_reponse
        var txs []models.TransactionMobileMoney
        database.DB.Where("etablissement_id = ?", etablissementID).
                Order("date_initiation DESC").Limit(20).Find(&txs)

        var webhooks []WebhookLog
        for _, tx := range txs {
                webhooks = append(webhooks, WebhookLog{
                        ID:            tx.ID,
                        Provider:      tx.Provider,
                        Reference:     tx.ReferenceExterne,
                        Statut:        string(tx.Statut),
                        Payload:       tx.PayloadReponse,
                        DateReception: tx.DateInitiation,
                        TransactionID: &tx.ID,
                        Reconcilie:    tx.Statut == models.StatutMomoReussie,
                })
        }
        return webhooks, nil
}

// Reconcilier tente de réconcilier un webhook avec une transaction.
func (s *MomoService) Reconcilier(txID uuid.UUID) (*models.TransactionMobileMoney, error) {
        return s.Confirmer(txID) // en sandbox, reconcilier = confirmer
}

// ===== Messages (SMS/Email) =====

// MessageService gère les templates et envois de messages.
type MessageService struct{}

func NewMessageService() *MessageService { return &MessageService{} }

// ListTemplates retourne les templates (globaux + établissement).
func (s *MessageService) ListTemplates(etablissementID uuid.UUID) ([]models.TemplateMessage, error) {
        var t []models.TemplateMessage
        database.DB.Where("etablissement_id IS NULL OR etablissement_id = ?", etablissementID).
                Order("code ASC").Find(&t)
        return t, nil
}

// TemplateDTO pour création.
type TemplateDTO struct {
        Code          string             `json:"code"`
        Type          models.TypeMessage `json:"type"`
        Sujet         string             `json:"sujet"`
        Corps         string             `json:"corps"`
        EtablissementID *uuid.UUID       `json:"etablissement_id"`
}

// CreateTemplate crée un template.
func (s *MessageService) CreateTemplate(dto TemplateDTO) (*models.TemplateMessage, error) {
        if dto.Code == "" || dto.Corps == "" {
                return nil, errors.New("code et corps obligatoires")
        }
        t := models.TemplateMessage{
                EtablissementID: dto.EtablissementID,
                Code:            dto.Code,
                Type:            dto.Type,
                Sujet:           dto.Sujet,
                Corps:           dto.Corps,
                Actif:           true,
        }
        if err := database.DB.Create(&t).Error; err != nil {
                return nil, err
        }
        return &t, nil
}

// UpdateTemplate modifie un template.
func (s *MessageService) UpdateTemplate(id uuid.UUID, dto TemplateDTO) (*models.TemplateMessage, error) {
        var t models.TemplateMessage
        if err := database.DB.First(&t, "id = ?", id).Error; err != nil {
                return nil, errors.New("template introuvable")
        }
        database.DB.Model(&t).Updates(map[string]interface{}{
                "code":  dto.Code,
                "type":  dto.Type,
                "sujet": dto.Sujet,
                "corps": dto.Corps,
        })
        database.DB.First(&t, "id = ?", id)
        return &t, nil
}

// EnvoiFilter filtre les envois.
type EnvoiFilter struct {
        EtablissementID *uuid.UUID
        Statut          *models.StatutEnvoi
        Type            *models.TypeMessage
        DateDebut       *time.Time
        DateFin         *time.Time
}

// ListEnvois retourne les envois.
func (s *MessageService) ListEnvois(filter EnvoiFilter) ([]models.EnvoiMessage, error) {
        q := database.DB.Model(&models.EnvoiMessage{}).
                Preload("Eleve").Preload("Tuteur").Preload("Template")
        if filter.EtablissementID != nil {
                q = q.Where("etablissement_id = ?", *filter.EtablissementID)
        }
        if filter.Statut != nil {
                q = q.Where("statut = ?", *filter.Statut)
        }
        if filter.Type != nil {
                q = q.Where("type = ?", *filter.Type)
        }
        if filter.DateDebut != nil {
                q = q.Where("date_creation >= ?", *filter.DateDebut)
        }
        if filter.DateFin != nil {
                q = q.Where("date_creation <= ?", *filter.DateFin)
        }
        var envois []models.EnvoiMessage
        q.Order("date_creation DESC").Limit(100).Find(&envois)
        return envois, nil
}

// EnvoyerDTO pour envoyer un message.
type EnvoyerDTO struct {
        EleveID           uuid.UUID `json:"eleve_id"`
        TemplateID        uuid.UUID `json:"template_id"`
        Type              *models.TypeMessage `json:"type"`
        DestinataireOverride string `json:"destinataire_override"`
}

// Envoyer envoie un message à un élève (via son tuteur). Sandbox : log only.
func (s *MessageService) Envoyer(dto EnvoyerDTO, etablissementID uuid.UUID) (*models.EnvoiMessage, error) {
        // Récupérer l'élève + tuteur
        var eleve models.Eleve
        if err := database.DB.Preload("Tuteur").First(&eleve, "id = ?", dto.EleveID).Error; err != nil {
                return nil, errors.New("élève introuvable")
        }
        if eleve.TuteurID == nil {
                return nil, errors.New("cet élève n'a pas de tuteur rattaché")
        }
        var tuteur models.Tuteur
        database.DB.First(&tuteur, "id = ?", *eleve.TuteurID)

        // Récupérer le template
        var tmpl models.TemplateMessage
        if err := database.DB.First(&tmpl, "id = ?", dto.TemplateID).Error; err != nil {
                return nil, errors.New("template introuvable")
        }

        // Déterminer le type + destinataire
        msgType := tmpl.Type
        if dto.Type != nil {
                msgType = *dto.Type
        }
        destinataire := dto.DestinataireOverride
        if destinataire == "" {
                if msgType == models.TypeMessageSMS {
                        destinataire = tuteur.Telephone
                } else {
                        destinataire = tuteur.Email
                }
        }

        // Générer le contenu (fusion des variables)
        contenu := s.renderTemplate(tmpl.Corps, &eleve, &tuteur)

        envoi := models.EnvoiMessage{
                EleveID:         dto.EleveID,
                TuteurID:        *eleve.TuteurID,
                EtablissementID: etablissementID,
                TemplateID:      &dto.TemplateID,
                Type:            msgType,
                Destinataire:    destinataire,
                ContenuGenere:   contenu,
                Statut:          models.StatutEnvoiEnvoye, // sandbox : marqué envoyé
                Provider:        "sandbox",
                DateCreation:    time.Now(),
        }
        now := time.Now()
        envoi.DateEnvoi = &now
        database.DB.Create(&envoi)
        return &envoi, nil
}

// RelanceMasseDTO pour envoyer une relance à plusieurs élèves.
type RelanceMasseDTO struct {
        EleveIDs   []uuid.UUID `json:"eleve_ids"`
        TemplateID uuid.UUID   `json:"template_id"`
}

// RelanceMasseResult est le résultat de l'envoi en masse.
type RelanceMasseResult struct {
        Count   int       `json:"count"`
        EnvoiIDs []uuid.UUID `json:"envoi_ids"`
}

// RelanceMasse envoie une relance à plusieurs élèves.
func (s *MessageService) RelanceMasse(dto RelanceMasseDTO, etablissementID uuid.UUID) (*RelanceMasseResult, error) {
        result := &RelanceMasseResult{}
        for _, eid := range dto.EleveIDs {
                envoi, err := s.Envoyer(EnvoyerDTO{EleveID: eid, TemplateID: dto.TemplateID}, etablissementID)
                if err != nil {
                        continue
                }
                result.EnvoiIDs = append(result.EnvoiIDs, envoi.ID)
                result.Count++
        }
        return result, nil
}

// renderTemplate remplace les variables {{eleve_nom}}, {{tuteur_nom}}, etc.
func (s *MessageService) renderTemplate(corps string, eleve *models.Eleve, tuteur *models.Tuteur) string {
        // Récupérer le solde de l'élève
        soldeSvc := NewSoldeService()
        solde, _ := soldeSvc.GetSoldeEleve(eleve.ID)
        soldeStr := "0 FCFA"
        if solde != nil {
                soldeStr = fmt.Sprintf("%.0f FCFA", solde.SoldeDu)
        }

        // Substitutions simples
        replacements := map[string]string{
                "{{eleve_nom}}":     eleve.Nom + " " + eleve.Prenoms,
                "{{tuteur_nom}}":    tuteur.Nom + " " + tuteur.Prenoms,
                "{{solde_du}}":      soldeStr,
                "{{classe}}":        "", // à compléter si besoin
        }
        result := corps
        for k, v := range replacements {
                result = replaceAll(result, k, v)
        }
        return result
}

func replaceAll(s, old, new string) string {
        for {
                i := indexOf(s, old)
                if i < 0 {
                        return s
                }
                s = s[:i] + new + s[i+len(old):]
        }
}

func indexOf(s, sub string) int {
        for i := 0; i <= len(s)-len(sub); i++ {
                if s[i:i+len(sub)] == sub {
                        return i
                }
        }
        return -1
}
