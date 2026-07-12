package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/smtp"
	"os"
	"strings"
	"time"
)

// NotificationService gère l'envoi d'emails (et à terme SMS) aux parents et
// au staff. Plusieurs transports sont supportés, par ordre de priorité :
//
//  1. Resend (API REST https://api.resend.com/emails) — RESEND_API_KEY non vide.
//     Recommandé en production : délivrabilité excellente, pas de config SMTP,
//     gestion des rebonds, etc.
//  2. SMTP classique — SMTP_HOST/SMTP_PORT/SMTP_FROM configurés (fallback).
//  3. Mode dev (log only) — si ni Resend ni SMTP n'est configuré.
//
// Configuration via variables d'environnement :
//
//   - RESEND_API_KEY : clé API Resend (ex: re_xxx) — JAMAIS dans le code source.
//   - RESEND_FROM    : adresse expéditeur au format "Nom <email@domaine>"
//                      (défaut : "ScolaGest <noreply@scolagest.ci>").
//                      ⚠ Le domaine doit être vérifié dans le dashboard Resend.
//
//   - SMTP_HOST     : hôte du serveur SMTP (ex: smtp.gmail.com)
//   - SMTP_PORT     : port (ex: 587)
//   - SMTP_USER     : identifiant
//   - SMTP_PASSWORD : mot de passe (ou mot de passe d'application)
//   - SMTP_FROM     : adresse expéditeur (ex: noreply@scolagest.ci)
type NotificationService struct {
	// Transport Resend (prioritaire si configuré)
	resendAPIKey string
	resendFrom   string // format "ScolaGest <noreply@scolagest.ci>"

	// Transport SMTP (fallback)
	host     string
	port     string
	user     string
	password string
	from     string

	// Client HTTP réutilisé (Resend)
	httpClient *http.Client
}

// NewNotificationService construit le service depuis les variables d'env.
func NewNotificationService() *NotificationService {
	from := os.Getenv("RESEND_FROM")
	if from == "" {
		from = "ScolaGest <noreply@scolagest.ci>"
	}
	return &NotificationService{
		resendAPIKey: os.Getenv("RESEND_API_KEY"),
		resendFrom:   from,

		host:     os.Getenv("SMTP_HOST"),
		port:     os.Getenv("SMTP_PORT"),
		user:     os.Getenv("SMTP_USER"),
		password: os.Getenv("SMTP_PASSWORD"),
		from:     os.Getenv("SMTP_FROM"),

		httpClient: &http.Client{Timeout: 15 * time.Second},
	}
}

// IsResendConfigured indique si le transport Resend est configuré (mode prod recommandé).
func (s *NotificationService) IsResendConfigured() bool {
	return s.resendAPIKey != ""
}

// IsConfigured indique si le SMTP est configuré (mode production — fallback).
func (s *NotificationService) IsConfigured() bool {
	return s.host != "" && s.port != "" && s.from != ""
}

// Transport renvoie le nom du transport actif : "resend" | "smtp" | "dev".
// Utile pour les handlers qui veulent informer l'appelant du canal utilisé.
func (s *NotificationService) Transport() string {
	if s.IsResendConfigured() {
		return "resend"
	}
	if s.IsConfigured() {
		return "smtp"
	}
	return "dev"
}

// SendEmail envoie un email en texte brut (backward compatible).
// Délègue à SendEmailHTML avec htmlBody="".
func (s *NotificationService) SendEmail(to, subject, body string) error {
	return s.SendEmailHTML(to, subject, body, "")
}

// SendEmailHTML envoie un email avec corps texte ET HTML.
// Si htmlBody est vide, seul le texte plain est envoyé.
// Priorité des transports : Resend → SMTP → dev (log only).
func (s *NotificationService) SendEmailHTML(to, subject, textBody, htmlBody string) error {
	// 1. Resend (prioritaire)
	if s.IsResendConfigured() {
		if err := s.sendViaResend(to, subject, textBody, htmlBody); err != nil {
			// On logge mais on ne fallback PAS sur SMTP automatiquement :
			// si Resend est configuré, c'est le transport souhaité. Le fallback
			// masquerait les erreurs Resend (domaine non vérifié, quota, etc.).
			log.Printf("⚠ Échec envoi Resend à %s: %v", to, err)
			return err
		}
		return nil
	}

	// 2. SMTP (fallback)
	if s.IsConfigured() {
		return s.sendViaSMTP(to, subject, textBody, htmlBody)
	}

	// 3. Mode dev : log only
	mode := "EMAIL-DEV"
	if htmlBody != "" {
		log.Printf("📧 [%s] To: %s | Subject: %s\n--TEXT--\n%s\n--HTML--\n%s", mode, to, subject, textBody, htmlBody)
	} else {
		log.Printf("📧 [%s] To: %s | Subject: %s\n%s", mode, to, subject, textBody)
	}
	return nil
}

// sendViaSMTP envoie via net/smtp (PlainAuth). Si htmlBody est fourni,
// construit un message multipart/alternative ; sinon texte plain.
func (s *NotificationService) sendViaSMTP(to, subject, textBody, htmlBody string) error {
	addr := fmt.Sprintf("%s:%s", s.host, s.port)
	auth := smtp.PlainAuth("", s.user, s.password, s.host)

	headers := []string{
		fmt.Sprintf("From: %s", s.from),
		fmt.Sprintf("To: %s", to),
		fmt.Sprintf("Subject: %s", subject),
		"MIME-Version: 1.0",
	}

	var msg string
	if htmlBody == "" {
		headers = append(headers, "Content-Type: text/plain; charset=UTF-8")
		msg = strings.Join(headers, "\r\n") + "\r\n\r\n" + textBody
	} else {
		boundary := "scolagestboundary_" + fmt.Sprintf("%d", time.Now().UnixNano())
		headers = append(headers,
			"Content-Type: multipart/alternative; boundary=\""+boundary+"\"",
		)
		msg = strings.Join(headers, "\r\n") + "\r\n\r\n" +
			"--" + boundary + "\r\n" +
			"Content-Type: text/plain; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: 8bit\r\n\r\n" +
			textBody + "\r\n\r\n" +
			"--" + boundary + "\r\n" +
			"Content-Type: text/html; charset=UTF-8\r\n" +
			"Content-Transfer-Encoding: 8bit\r\n\r\n" +
			htmlBody + "\r\n\r\n" +
			"--" + boundary + "--\r\n"
	}

	return smtp.SendMail(addr, auth, s.from, []string{to}, []byte(msg))
}

// resendEmailRequest payload POST vers https://api.resend.com/emails.
type resendEmailRequest struct {
	From    string   `json:"from"`
	To      []string `json:"to"`
	Subject string   `json:"subject"`
	Text    string   `json:"text,omitempty"`
	HTML    string   `json:"html,omitempty"`
}

// resendEmailResponse payload de réponse (succès) — Resend renvoie {"id":"re_xxx"}.
type resendEmailResponse struct {
	ID      string `json:"id"`
	Message string `json:"message"` // présent seulement en cas d'erreur
}

// sendViaResend envoie via l'API REST Resend (POST https://api.resend.com/emails).
// Authentification : Authorization: Bearer <RESEND_API_KEY>.
// Réponse 200 = succès (on lit l'ID Resend), sinon erreur avec le message Resend.
func (s *NotificationService) sendViaResend(to, subject, textBody, htmlBody string) error {
	payload := resendEmailRequest{
		From:    s.resendFrom,
		To:      []string{to},
		Subject: subject,
		Text:    textBody,
	}
	if htmlBody != "" {
		payload.HTML = htmlBody
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("encodage payload Resend: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("création requête Resend: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+s.resendAPIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("appel API Resend: %w", err)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		var ok resendEmailResponse
		_ = json.Unmarshal(respBody, &ok)
		log.Printf("✓ Email Resend envoyé à %s (id=%s)", to, ok.ID)
		return nil
	}

	// Erreur Resend : on essaie de parser le message
	var errResp resendEmailResponse
	if json.Unmarshal(respBody, &errResp) == nil && errResp.Message != "" {
		return fmt.Errorf("Resend HTTP %d: %s", resp.StatusCode, errResp.Message)
	}
	return fmt.Errorf("Resend HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
}

// ─────────────────────────────────────────────────────────────────────────────
// Notifications métier (pré-inscription)
// ─────────────────────────────────────────────────────────────────────────────

// NotifyParentPreInscriptionSoumise : email au parent confirmant sa soumission
// + lui rappelant son lien de suivi.
func (s *NotificationService) NotifyParentPreInscriptionSoumise(parentEmail, parentNom, eleveNom, suiviURL string) {
	if parentEmail == "" {
		return
	}
	subject, text, html := TemplatePreInscriptionSoumise(parentNom, eleveNom, suiviURL)
	if err := s.SendEmailHTML(parentEmail, subject, text, html); err != nil {
		log.Printf("⚠ Échec envoi email soumission à %s: %v", parentEmail, err)
	}
}

// NotifyParentPreInscriptionValidee : email au parent l'informant que sa
// demande a été validée (élève créé).
func (s *NotificationService) NotifyParentPreInscriptionValidee(parentEmail, parentNom, eleveNom, identifiantInterne, classeLibelle string) {
	if parentEmail == "" {
		return
	}
	subject, text, html := TemplatePreInscriptionValidee(parentNom, eleveNom, identifiantInterne, classeLibelle)
	if err := s.SendEmailHTML(parentEmail, subject, text, html); err != nil {
		log.Printf("⚠ Échec envoi email validation à %s: %v", parentEmail, err)
	}
}

// NotifyParentPreInscriptionRejetee : email au parent l'informant du rejet
// avec le motif.
func (s *NotificationService) NotifyParentPreInscriptionRejetee(parentEmail, parentNom, eleveNom, motif string) {
	if parentEmail == "" {
		return
	}
	subject, text, html := TemplatePreInscriptionRejetee(parentNom, eleveNom, motif)
	if err := s.SendEmailHTML(parentEmail, subject, text, html); err != nil {
		log.Printf("⚠ Échec envoi email rejet à %s: %v", parentEmail, err)
	}
}
