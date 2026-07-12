package services

import (
        "crypto/rand"
        "encoding/hex"
        "errors"
        "fmt"
        "log"
        "os"
        "strings"
        "time"

        "github.com/scolagest/backend/internal/database"
        "github.com/scolagest/backend/internal/models"
        "github.com/scolagest/backend/internal/utils"
        "gorm.io/gorm"
)

// PasswordResetService gère la réinitialisation du mot de passe staff et du
// code PIN parent (fonctionnalité "mot de passe oublié" / "code oublié").
//
// Comportement selon la configuration email :
//   - Resend OU SMTP configuré (notifSvc.IsResendConfigured() ||
//     notifSvc.IsConfigured()) : le lien de reset est envoyé par email au
//     parent/utilisateur ; l'API ne retourne PAS le reset_url (sécurité — on
//     ne divulgue pas le token à l'écran).
//   - Sinon (mode dev, ni Resend ni SMTP) : le reset_url est retourné dans la
//     réponse pour affichage direct à l'écran (utile pour démo / dev locale).
//
// Configuration supplémentaire :
//
//      FRONTEND_URL : base URL du frontend pour construire le lien absolu envoyé
//                     par email (défaut : http://localhost:3000).
type PasswordResetService struct {
        notifSvc *NotificationService
}

func NewPasswordResetService(notifSvc *NotificationService) *PasswordResetService {
        return &PasswordResetService{notifSvc: notifSvc}
}

// frontendBaseURL renvoie la base URL du frontend (pour construire des liens
// absolus dans les emails). Defaut : http://localhost:3000 (dev local).
func frontendBaseURL() string {
        u := strings.TrimRight(strings.TrimSpace(os.Getenv("FRONTEND_URL")), "/")
        if u == "" {
                u = "http://localhost:3000"
        }
        return u
}

// userDisplayNom construit le nom affichable d'un utilisateur (Nom + Prénoms).
func userDisplayNom(u models.Utilisateur) string {
        nom := strings.TrimSpace(u.Nom)
        prenoms := strings.TrimSpace(u.Prenoms)
        if nom == "" && prenoms == "" {
                return "utilisateur"
        }
        if prenoms != "" {
                return nom + " " + prenoms
        }
        return nom
}

// ─────────────────────────────────────────────────────────────────────────────
// Staff — Mot de passe oublié
// ─────────────────────────────────────────────────────────────────────────────

// RequestResetResult : résultat de la demande de reset staff.
// ResetURL contient le lien de reset (en mode démo ; en prod ce serait envoyé
// par email et ResetURL serait vide pour ne pas le divulguer à l'écran).
type RequestResetResult struct {
        ResetURL string `json:"reset_url"`           // mode démo seulement
        Email    string `json:"email"`               // masqué partiellement
        Sent     bool   `json:"sent"`                // true si email envoyé (prod) ou affiché (démo)
}

// RequestPasswordReset génère un token de reset pour un utilisateur staff.
// Ne révèle pas si l'email existe ou non (sécurité : évite l'énumération).
// En mode démo (pas de SMTP), retourne le reset_url pour affichage direct.
func (s *PasswordResetService) RequestPasswordReset(email string) (*RequestResetResult, error) {
        email = strings.ToLower(strings.TrimSpace(email))
        if email == "" {
                return nil, errors.New("email requis")
        }

        var user models.Utilisateur
        err := database.Current().Where("LOWER(email) = ?", email).First(&user).Error
        if errors.Is(err, gorm.ErrRecordNotFound) {
                // Sécurité : on ne révèle pas que l'email n'existe pas. On retourne
                // un résultat "sent: true" factice pour ne pas donner d'indice.
                return &RequestResetResult{
                        ResetURL: "",
                        Email:    maskEmail(email),
                        Sent:     true,
                }, nil
        }
        if err != nil {
                return nil, err
        }

        // Invalider les tokens précédents non utilisés pour cet user
        database.Current().Model(&models.PasswordResetToken{}).
                Where("user_id = ? AND used_at IS NULL", user.ID).
                Update("used_at", time.Now())

        token, err := generateResetToken(20)
        if err != nil {
                return nil, err
        }

        reset := models.PasswordResetToken{
                UserID:    user.ID,
                Token:     token,
                ExpiresAt: time.Now().Add(1 * time.Hour),
        }
        if err := database.Current().Create(&reset).Error; err != nil {
                return nil, fmt.Errorf("création token reset: %w", err)
        }

        // Construction du lien de reset absolu (pour l'email) ou relatif (démo).
        resetURLAbs := frontendBaseURL() + "/reset-password?token=" + token

        // Si un transport email est configuré (Resend ou SMTP) → envoyer le lien
        // par email et NE PAS retourner reset_url (sécurité : le token ne doit
        // pas transiter par l'API/écran en production).
        if s.notifSvc != nil && (s.notifSvc.IsResendConfigured() || s.notifSvc.IsConfigured()) {
                userNom := userDisplayNom(user)
                subject, text, html := TemplatePasswordReset(userNom, resetURLAbs)
                if err := s.notifSvc.SendEmailHTML(user.Email, subject, text, html); err != nil {
                        // On logge l'erreur côté serveur mais on ne la révèle pas au
                        // client (sécurité : on ne veut pas que l'attaquant sache si
                        // l'email existe / a été envoyé). On renvoie Sent: true.
                        log.Printf("⚠ Échec envoi email reset à %s: %v", user.Email, err)
                }
                return &RequestResetResult{
                        ResetURL: "",
                        Email:    maskEmail(user.Email),
                        Sent:     true,
                }, nil
        }

        // Mode dev (aucun transport configuré) : on retourne le reset_url pour
        // affichage direct à l'écran (utile pour démo / dev locale sans email).
        return &RequestResetResult{
                ResetURL: "/reset-password?token=" + token,
                Email:    maskEmail(user.Email),
                Sent:     true,
        }, nil
}

// ResetPassword consomme un token et définit un nouveau mot de passe.
func (s *PasswordResetService) ResetPassword(token, newPassword string) error {
        if len(newPassword) < 6 {
                return errors.New("le mot de passe doit faire au moins 6 caractères")
        }

        var reset models.PasswordResetToken
        err := database.Current().First(&reset, "token = ?", token).Error
        if errors.Is(err, gorm.ErrRecordNotFound) {
                return errors.New("token invalide ou expiré")
        }
        if err != nil {
                return nil
        }

        if reset.UsedAt != nil {
                return errors.New("ce token a déjà été utilisé — demandez un nouveau lien")
        }
        if time.Now().After(reset.ExpiresAt) {
                return errors.New("ce token a expiré — demandez un nouveau lien")
        }

        // Hasher le nouveau mot de passe
        hash, err := utils.HashPassword(newPassword)
        if err != nil {
                return fmt.Errorf("hashage: %w", err)
        }

        // Transaction : update password + marquer token comme utilisé
        return database.Current().Transaction(func(tx *gorm.DB) error {
                if err := tx.Model(&models.Utilisateur{}).Where("id = ?", reset.UserID).
                        Update("mot_de_passe_hash", hash).Error; err != nil {
                        return err
                }
                now := time.Now()
                return tx.Model(&reset).Update("used_at", now).Error
        })
}

// ─────────────────────────────────────────────────────────────────────────────
// Parent — Code PIN oublié
// ─────────────────────────────────────────────────────────────────────────────

// PINResetRequestDTO : vérification d'identité du parent.
// Le parent doit fournir son téléphone + le nom + prénoms d'un de ses enfants
// (vérification croisée pour éviter quiconque connaît juste le téléphone).
type PINResetRequestDTO struct {
        Telephone       string `json:"telephone"`
        EleveNom        string `json:"eleve_nom"`
        ElevePrenoms    string `json:"eleve_prenoms"`
}

// PINResetResult : résultat de la régénération du PIN.
// NewPIN contient le nouveau code (mode démo ; en prod ce serait envoyé par SMS).
type PINResetResult struct {
        NewPIN  string `json:"new_pin"`   // mode démo seulement
        Sent    bool   `json:"sent"`      // true si SMS envoyé (prod) ou affiché (démo)
        Telephone string `json:"telephone"` // masqué partiellement
}

// ResetParentPIN vérifie l'identité du parent (téléphone + enfant) et régénère
// un nouveau PIN à 4 chiffres. Le nouveau PIN est hashé en DB (bcrypt) et
// retourné en clair (mode démo) pour affichage immédiat.
func (s *PasswordResetService) ResetParentPIN(dto PINResetRequestDTO) (*PINResetResult, error) {
        telephone := strings.TrimSpace(dto.Telephone)
        eleveNom := strings.ToUpper(strings.TrimSpace(dto.EleveNom))
        elevePrenoms := strings.TrimSpace(dto.ElevePrenoms)

        if telephone == "" || eleveNom == "" {
                return nil, errors.New("téléphone et nom de l'élève sont requis")
        }

        normalizedTel := normalizePhoneReset(telephone)

        // Trouver le tuteur par téléphone
        var tuteur models.Tuteur
        err := database.Current().Where(
                "REPLACE(REPLACE(REPLACE(REPLACE(telephone, ' ', ''), '+', ''), '-', ''), '.', '') = ? OR telephone = ?",
                normalizedTel, telephone,
        ).First(&tuteur).Error
        if errors.Is(err, gorm.ErrRecordNotFound) {
                return nil, errors.New("aucun compte parent trouvé pour ce numéro — contactez l'établissement")
        }
        if err != nil {
                return nil, err
        }

        // Vérifier qu'au moins un élève associé à ce tuteur porte ce nom + prénoms
        var count int64
        eleveQ := database.Current().Model(&models.Eleve{}).Where("tuteur_id = ?", tuteur.ID)
        if elevePrenoms != "" {
                eleveQ = eleveQ.Where("UPPER(nom) = ? AND LOWER(prenoms) LIKE ?", eleveNom, "%"+strings.ToLower(elevePrenoms)+"%")
        } else {
                eleveQ = eleveQ.Where("UPPER(nom) = ?", eleveNom)
        }
        eleveQ.Count(&count)
        if count == 0 {
                return nil, errors.New("vérification d'identité échouée — le nom de l'élève ne correspond pas à ce numéro de téléphone")
        }

        // Générer un nouveau PIN à 4 chiffres
        pin, err := generateNumericPIN(4)
        if err != nil {
                return nil, err
        }

        // Hasher et sauvegarder
        pinHash, err := utils.HashPassword(pin)
        if err != nil {
                return nil, fmt.Errorf("hashage PIN: %w", err)
        }
        if err := database.Current().Model(&tuteur).Update("pin_hash", pinHash).Error; err != nil {
                return nil, err
        }

        // Mode démo : on retourne le PIN (en prod : envoi SMS + return sans PIN)
        // TODO(prod) : remplacer par sms.Send(tuteur.Telephone, "Votre nouveau code ScolaGest: "+pin)
        return &PINResetResult{
                NewPIN:     pin,
                Sent:       true,
                Telephone:  maskPhone(tuteur.Telephone),
        }, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

func generateResetToken(bytes int) (string, error) {
        b := make([]byte, bytes)
        if _, err := rand.Read(b); err != nil {
                return "", err
        }
        return hex.EncodeToString(b), nil
}

func generateNumericPIN(digits int) (string, error) {
        const nums = "0123456789"
        b := make([]byte, digits)
        if _, err := rand.Read(b); err != nil {
                return "", err
        }
        for i := range b {
                b[i] = nums[int(b[i])%len(nums)]
        }
        return string(b), nil
}

func normalizePhoneReset(s string) string {
        s = strings.TrimSpace(s)
        s = strings.ReplaceAll(s, " ", "")
        s = strings.ReplaceAll(s, "+", "")
        s = strings.ReplaceAll(s, "-", "")
        s = strings.ReplaceAll(s, ".", "")
        return s
}

func maskEmail(email string) string {
        at := strings.Index(email, "@")
        if at <= 0 || at >= len(email)-1 {
                return email
        }
        local := email[:at]
        domain := email[at:]
        if len(local) <= 2 {
                return local[:1] + "***" + domain
        }
        return local[:2] + "***" + domain
}

func maskPhone(phone string) string {
        if len(phone) <= 4 {
                return phone
        }
        return phone[:4] + " ** " + phone[len(phone)-2:]
}
