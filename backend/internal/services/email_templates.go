package services

import (
	"fmt"
	"strings"
)

// email_templates.go — Génération des templates HTML/texte des emails ScolaGest.
//
// Charte graphique "Forêt EdTech" :
//   - Fond blanc, typographie sans-serif system stack (Arial/Helvetica).
//   - Bande supérieure "kente" : gradient emerald → amber → gold → emerald
//     (clin d'œil aux tissus kente ouest-africains, identité ivoirienne).
//   - Couleurs : emerald #047857 (principal), amber #F59E0B (accents),
//     gold #D4AF37 (touches premium), slate #475569 (texte).
//   - Pas d'indigo/bleu (palette interdite — règle projet).
//   - Responsive : max-width 600px, padding adaptatif, bouton large sur mobile.
//   - CSS inline (requis par la plupart des clients email ; pas de <style>).
//
// Toutes les fonctions retournent (subject, text, html) :
//   - subject : sujet court et explicite
//   - text   : version plain-text (pour clients sans HTML / accessibilité)
//   - html   : version HTML riche (Forêt EdTech)

// Palette Forêt EdTech (constantes pour cohérence).
const (
	emailColorEmerald = "#047857"
	emailColorEmeraldDark = "#065F46"
	emailColorAmber      = "#F59E0B"
	emailColorGold       = "#D4AF37"
	emailColorSlate      = "#475569"
	emailColorSlateLight = "#94A3B8"
	emailColorBg         = "#F8FAFC"
	emailColorCard       = "#FFFFFF"
	emailColorBorder     = "#E2E8F0"
)

// emailTemplateBase génère l'enveloppe HTML commune à tous les emails.
// `content` est injecté dans le corps (déjà formaté en HTML).
func emailTemplateBase(title, content string) string {
	// Bande kente simulée : gradient horizontal multi-couleurs Forêt EdTech.
	kenteStrip := `<tr>
		<td style="height:6px;line-height:6px;font-size:6px;background:linear-gradient(90deg, #047857 0%, #F59E0B 35%, #D4AF37 55%, #047857 100%);background-color:#047857;">
			&nbsp;
		</td>
	</tr>`

	// Header brand
	header := fmt.Sprintf(`<tr>
		<td style="background:%s;padding:24px 32px;text-align:center;">
			<div style="font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:%s;letter-spacing:-0.3px;">
				Scola<span style="color:%s;">Gest</span>
			</div>
			<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:%s;margin-top:4px;letter-spacing:1px;text-transform:uppercase;">
				Gestion scolaire &middot; Côte d'Ivoire
			</div>
		</td>
	</tr>`, emailColorCard, emailColorEmerald, emailColorAmber, emailColorSlateLight)

	// Title block + content
	body := fmt.Sprintf(`<tr>
		<td style="background:%s;padding:32px 32px 24px 32px;">
			<h1 style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:%s;line-height:1.3;">
				%s
			</h1>
			<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:%s;line-height:1.6;">
				%s
			</div>
		</td>
	</tr>`, emailColorBg, emailColorEmeraldDark, title, emailColorSlate, content)

	// Footer
	footer := fmt.Sprintf(`<tr>
		<td style="background:%s;padding:24px 32px;border-top:1px solid %s;">
			<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;color:%s;line-height:1.6;">
				Cordialement,<br/>
				<strong style="color:%s;">L'équipe ScolaGest</strong>
			</div>
			<div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:%s;margin-top:16px;line-height:1.5;">
				Cet email a été envoyé automatiquement par la plateforme ScolaGest.<br/>
				Merci de ne pas répondre — pour toute question, contactez le secrétariat de votre établissement.
			</div>
		</td>
	</tr>`, emailColorBg, emailColorBorder, emailColorSlate, emailColorEmerald, emailColorSlateLight)

	return `<!DOCTYPE html>
<html lang="fr">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width,initial-scale=1.0">
	<meta http-equiv="X-UA-Compatible" content="IE=edge">
	<title>` + title + `</title>
</head>
<body style="margin:0;padding:0;background:` + emailColorBg + `;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:` + emailColorBg + `;padding:24px 0;">
		<tr>
			<td align="center" style="padding:0 12px;">
				<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:` + emailColorCard + `;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);border:1px solid ` + emailColorBorder + `;">
					` + kenteStrip + `
					` + header + `
					` + body + `
					` + footer + `
				</table>
			</td>
		</tr>
	</table>
</body>
</html>`
}

// emailButton génère un bouton-lien stylisé (emerald) pour les CTA email.
func emailButton(label, url string) string {
	return fmt.Sprintf(`<div style="margin:24px 0;text-align:center;">
		<a href="%s" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 32px;background:%s;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;letter-spacing:0.2px;">
			%s
		</a>
	</div>
	<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:%s;line-height:1.5;word-break:break-all;">
		Si le bouton ne fonctionne pas, copiez ce lien :<br/>
		<a href="%s" style="color:%s;">%s</a>
	</div>`, url, emailColorEmerald, label, emailColorSlateLight, url, emailColorEmerald, url)
}

// emailInfoRow génère une ligne "libellé : valeur" stylisée pour les récapitulatifs.
func emailInfoRow(label, value string) string {
	return fmt.Sprintf(`<tr>
		<td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:%s;padding:6px 0;vertical-align:top;width:50%%;">
			%s
		</td>
		<td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:%s;padding:6px 0;font-weight:600;vertical-align:top;">
			%s
		</td>
	</tr>`, emailColorSlateLight, label, emailColorSlate, value)
}

// emailInfoTable génère un tableau récapitulatif (libellé → valeur).
func emailInfoTable(rows ...[2]string) string {
	var b strings.Builder
	b.WriteString(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;background:#FFFFFF;border:1px solid ` + emailColorBorder + `;border-radius:8px;padding:8px 16px;">`)
	for _, r := range rows {
		b.WriteString(emailInfoRow(r[0], r[1]))
	}
	b.WriteString(`</table>`)
	return b.String()
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates métier
// ─────────────────────────────────────────────────────────────────────────────

// TemplatePreInscriptionSoumise : accusé de réception d'une pré-inscription
// parent, avec lien de suivi.
func TemplatePreInscriptionSoumise(parentNom, eleveNom, suiviURL string) (subject, text, html string) {
	subject = "ScolaGest — Votre pré-inscription a bien été reçue"
	text = fmt.Sprintf(`Bonjour %s,

Votre pré-inscription pour %s a bien été enregistrée.

Vous pouvez suivre l'état de votre demande à tout moment via ce lien :
%s

Le secrétariat de l'établissement examinera votre demande dans les plus brefs délais.

Cordialement,
L'équipe ScolaGest`, parentNom, eleveNom, suiviURL)

	content := fmt.Sprintf(`<p style="margin:0 0 16px 0;">Bonjour <strong>%s</strong>,</p>
		<p style="margin:0 0 16px 0;">Votre pré-inscription pour <strong style="color:%s;">%s</strong> a bien été enregistrée. Le secrétariat de l'établissement examinera votre demande dans les plus brefs délais.</p>
		<p style="margin:0 0 8px 0;">Vous pouvez suivre l'état de votre demande à tout moment via ce lien :</p>
		%s`, escapeHTML(parentNom), emailColorEmerald, escapeHTML(eleveNom), emailButton("Suivre ma demande", suiviURL))

	html = emailTemplateBase("Pré-inscription reçue ✓", content)
	return
}

// TemplatePreInscriptionValidee : confirmation de validation de la
// pré-inscription (élève créé en base + affecté à une classe).
func TemplatePreInscriptionValidee(parentNom, eleveNom, identifiantInterne, classeLibelle string) (subject, text, html string) {
	subject = "ScolaGest — Pré-inscription validée ✓"
	text = fmt.Sprintf(`Bonjour %s,

Bonne nouvelle ! La pré-inscription de %s a été validée par le secrétariat.

Récapitulatif :
- Identifiant interne de l'élève : %s
- Classe : %s

Le secrétariat vous contactera prochainement pour finaliser le dossier (paiement des frais d'inscription, photos, etc.).

Cordialement,
L'équipe ScolaGest`, parentNom, eleveNom, identifiantInterne, classeLibelle)

	content := fmt.Sprintf(`<p style="margin:0 0 16px 0;">Bonjour <strong>%s</strong>,</p>
		<p style="margin:0 0 16px 0;">Bonne nouvelle ! La pré-inscription de <strong style="color:%s;">%s</strong> a été <strong>validée</strong> par le secrétariat.</p>
		%s
		<p style="margin:16px 0 0 0;">Le secrétariat vous contactera prochainement pour finaliser le dossier (paiement des frais d'inscription, photos, etc.).</p>`,
		escapeHTML(parentNom),
		emailColorEmerald,
		escapeHTML(eleveNom),
		emailInfoTable(
			[2]string{"Identifiant interne", escapeHTML(identifiantInterne)},
			[2]string{"Classe", escapeHTML(classeLibelle)},
		),
	)

	html = emailTemplateBase("Pré-inscription validée ✓", content)
	return
}

// TemplatePreInscriptionRejetee : notifie le parent d'un rejet/complément
// demandé, avec le motif.
func TemplatePreInscriptionRejetee(parentNom, eleveNom, motif string) (subject, text, html string) {
	subject = "ScolaGest — Pré-inscription : complément demandé"
	text = fmt.Sprintf(`Bonjour %s,

Votre pré-inscription pour %s n'a pas pu être validée dans l'immédiat.

Motif : %s

Nous vous invitons à contacter le secrétariat de l'établissement pour plus d'informations ou à corriger votre demande.

Cordialement,
L'équipe ScolaGest`, parentNom, eleveNom, motif)

	content := fmt.Sprintf(`<p style="margin:0 0 16px 0;">Bonjour <strong>%s</strong>,</p>
		<p style="margin:0 0 16px 0;">Votre pré-inscription pour <strong>%s</strong> n'a pas pu être validée dans l'immédiat.</p>
		<div style="margin:16px 0;padding:16px;background:#FEF3C7;border-left:4px solid %s;border-radius:6px;">
			<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#92400E;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:600;">Motif</div>
			<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:%s;line-height:1.5;">%s</div>
		</div>
		<p style="margin:16px 0 0 0;">Nous vous invitons à contacter le secrétariat de l'établissement pour plus d'informations ou à corriger votre demande.</p>`,
		escapeHTML(parentNom),
		escapeHTML(eleveNom),
		emailColorAmber,
		emailColorSlate,
		escapeHTML(motif),
	)

	html = emailTemplateBase("Complément demandé", content)
	return
}

// TemplatePasswordReset : email de réinitialisation de mot de passe staff.
// Bouton "Réinitialiser mon mot de passe" pointant vers resetURL.
func TemplatePasswordReset(userNom, resetURL string) (subject, text, html string) {
	subject = "ScolaGest — Réinitialisation de votre mot de passe"
	text = fmt.Sprintf(`Bonjour %s,

Vous avez demandé la réinitialisation de votre mot de passe ScolaGest.

Cliquez sur le lien suivant pour définir un nouveau mot de passe (valide 1 heure) :
%s

Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email — votre mot de passe restera inchangé.

Cordialement,
L'équipe ScolaGest`, userNom, resetURL)

	content := fmt.Sprintf(`<p style="margin:0 0 16px 0;">Bonjour <strong>%s</strong>,</p>
		<p style="margin:0 0 16px 0;">Vous avez demandé la réinitialisation de votre mot de passe ScolaGest. Cliquez sur le bouton ci-dessous pour en définir un nouveau :</p>
		%s
		<div style="margin:16px 0;padding:12px 16px;background:#FEF3C7;border-radius:6px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#92400E;line-height:1.5;">
			⏱ Ce lien est valable <strong>1 heure</strong>. Passé ce délai, il faudra refaire une demande.
		</div>
		<p style="margin:16px 0 0 0;font-size:13px;color:%s;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email — votre mot de passe restera inchangé.</p>`,
		escapeHTML(userNom),
		emailButton("Réinitialiser mon mot de passe", resetURL),
		emailColorSlateLight,
	)

	html = emailTemplateBase("Réinitialisation de mot de passe", content)
	return
}

// TemplateTestEmail : email de test pour l'endpoint POST /api/notifications/test.
// Permet de vérifier que Resend (ou SMTP) est correctement configuré.
func TemplateTestEmail(to string) (subject, text, html string) {
	subject = "ScolaGest — Email de test ✓"
	text = fmt.Sprintf(`Bonjour,

Ceci est un email de test envoyé depuis la plateforme ScolaGest.

Destinataire : %s

Si vous recevez cet email, cela signifie que la configuration de l'envoi d'emails (Resend ou SMTP) est correcte.

Cordialement,
L'équipe ScolaGest`, to)

	content := fmt.Sprintf(`<p style="margin:0 0 16px 0;">Bonjour,</p>
		<p style="margin:0 0 16px 0;">Ceci est un <strong>email de test</strong> envoyé depuis la plateforme ScolaGest. Si vous le recevez, la configuration de l'envoi d'emails est correcte.</p>
		%s
		<p style="margin:16px 0 0 0;">Vous pouvez supprimer cet email.</p>`,
		emailInfoTable([2]string{"Destinataire", escapeHTML(to)}),
	)

	html = emailTemplateBase("Email de test ✓", content)
	return
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// escapeHTML échappe les caractères HTML pour éviter les injections dans les
// templates et garantir un rendu correct des données utilisateur.
func escapeHTML(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, "\"", "&quot;")
	s = strings.ReplaceAll(s, "'", "&#39;")
	return s
}
