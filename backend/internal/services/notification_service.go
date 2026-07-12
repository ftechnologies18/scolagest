package services

import (
	"fmt"
	"log"
	"net/smtp"
	"os"
	"strings"
)

// NotificationService gère l'envoi d'emails (et à terme SMS) aux parents et
// au staff. En mode production (SMTP_HOST configuré), envoie de vrais emails.
// En mode développement (pas de SMTP), logge le contenu dans la console —
// utile pour tester le workflow sans infrastructure email.
//
// Configuration via variables d'environnement :
//   - SMTP_HOST     : hôte du serveur SMTP (ex: smtp.gmail.com)
//   - SMTP_PORT     : port (ex: 587)
//   - SMTP_USER     : identifiant
//   - SMTP_PASSWORD : mot de passe (ou mot de passe d'application)
//   - SMTP_FROM     : adresse expéditeur (ex: noreply@scolagest.ci)
//
// Si SMTP_HOST est vide → mode dev (log only).
type NotificationService struct {
	host     string
	port     string
	user     string
	password string
	from     string
}

// NewNotificationService construit le service depuis les variables d'env.
func NewNotificationService() *NotificationService {
	return &NotificationService{
		host:     os.Getenv("SMTP_HOST"),
		port:     os.Getenv("SMTP_PORT"),
		user:     os.Getenv("SMTP_USER"),
		password: os.Getenv("SMTP_PASSWORD"),
		from:     os.Getenv("SMTP_FROM"),
	}
}

// IsConfigured indique si le SMTP est configuré (mode production).
func (s *NotificationService) IsConfigured() bool {
	return s.host != "" && s.port != "" && s.from != ""
}

// SendEmail envoie un email. Si SMTP n'est pas configuré, logge le contenu
// (mode dev). Retourne nil en mode dev (succès factice).
func (s *NotificationService) SendEmail(to, subject, body string) error {
	if !s.IsConfigured() {
		// Mode dev : logger
		log.Printf("📧 [EMAIL-DEV] To: %s | Subject: %s\n%s", to, subject, body)
		return nil
	}

	addr := fmt.Sprintf("%s:%s", s.host, s.port)
	auth := smtp.PlainAuth("", s.user, s.password, s.host)

	msg := strings.Join([]string{
		fmt.Sprintf("From: %s", s.from),
		fmt.Sprintf("To: %s", to),
		fmt.Sprintf("Subject: %s", subject),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		body,
	}, "\r\n")

	return smtp.SendMail(addr, auth, s.from, []string{to}, []byte(msg))
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
	subject := "ScolaGest — Votre pré-inscription a bien été reçue"
	body := fmt.Sprintf(`Bonjour %s,

Votre pré-inscription pour %s a bien été enregistrée.

Vous pouvez suivre l'état de votre demande à tout moment via ce lien :
%s

Le secrétariat de l'établissement examinera votre demande dans les plus brefs délais.

Cordialement,
L'équipe ScolaGest`, parentNom, eleveNom, suiviURL)

	if err := s.SendEmail(parentEmail, subject, body); err != nil {
		log.Printf("⚠ Échec envoi email soumission à %s: %v", parentEmail, err)
	}
}

// NotifyParentPreInscriptionValidee : email au parent l'informant que sa
// demande a été validée (élève créé).
func (s *NotificationService) NotifyParentPreInscriptionValidee(parentEmail, parentNom, eleveNom, identifiantInterne, classeLibelle string) {
	if parentEmail == "" {
		return
	}
	subject := "ScolaGest — Pré-inscription validée ✓"
	body := fmt.Sprintf(`Bonjour %s,

Bonne nouvelle ! La pré-inscription de %s a été validée par le secrétariat.

Récapitulatif :
- Identifiant interne de l'élève : %s
- Classe : %s

Le secrétariat vous contactera prochainement pour finaliser le dossier (paiement des frais d'inscription, photos, etc.).

Cordialement,
L'équipe ScolaGest`, parentNom, eleveNom, identifiantInterne, classeLibelle)

	if err := s.SendEmail(parentEmail, subject, body); err != nil {
		log.Printf("⚠ Échec envoi email validation à %s: %v", parentEmail, err)
	}
}

// NotifyParentPreInscriptionRejetee : email au parent l'informant du rejet
// avec le motif.
func (s *NotificationService) NotifyParentPreInscriptionRejetee(parentEmail, parentNom, eleveNom, motif string) {
	if parentEmail == "" {
		return
	}
	subject := "ScolaGest — Pré-inscription : complément demandé"
	body := fmt.Sprintf(`Bonjour %s,

Votre pré-inscription pour %s n'a pas pu être validée dans l'immédiat.

Motif : %s

Nous vous invitons à contacter le secrétariat de l'établissement pour plus d'informations ou à corriger votre demande.

Cordialement,
L'équipe ScolaGest`, parentNom, eleveNom, motif)

	if err := s.SendEmail(parentEmail, subject, body); err != nil {
		log.Printf("⚠ Échec envoi email rejet à %s: %v", parentEmail, err)
	}
}
