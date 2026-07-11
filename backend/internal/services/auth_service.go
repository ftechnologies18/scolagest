package services

import (
        "errors"
        "time"

        "github.com/google/uuid"
        "github.com/scolagest/backend/internal/database"
        "github.com/scolagest/backend/internal/models"
        "github.com/scolagest/backend/internal/utils"
        "gorm.io/gorm"
)

// AuthService contient la logique métier d'authentification.
type AuthService struct {
        jwt *JWTService
}

// NewAuthService construit un AuthService.
func NewAuthService(jwtSvc *JWTService) *AuthService {
        return &AuthService{jwt: jwtSvc}
}

// LoginResult est retourné après une connexion réussie.
type LoginResult struct {
        AccessToken  string                   `json:"access_token"`
        RefreshToken string                   `json:"refresh_token"`
        User         *models.Utilisateur      `json:"user"`
        Etablissement *models.Etablissement   `json:"etablissement"`
        Role         models.RoleUtilisateur   `json:"role"`
}

// Login authentifie un utilisateur par email/mot de passe et émet des tokens.
// Si etablissementID est fourni, vérifie l'accès et détermine le rôle effectif.
func (s *AuthService) Login(email, password string, etablissementID *uuid.UUID, ip, userAgent string) (*LoginResult, error) {
        db := database.DB

        var user models.Utilisateur
        if err := db.Where("email = ?", email).First(&user).Error; err != nil {
                if errors.Is(err, gorm.ErrRecordNotFound) {
                        return nil, errors.New("identifiants invalides")
                }
                return nil, err
        }

        if user.Statut != models.StatutUserActif {
                return nil, errors.New("compte désactivé ou bloqué")
        }

        if !utils.CheckPassword(password, user.MotDePasseHash) {
                // Incrémenter le compteur d'échecs
                db.Model(&user).UpdateColumn("tentatives_echouees", user.TentativesEchouees+1)
                return nil, errors.New("identifiants invalides")
        }

        // Déterminer le rôle effectif et l'établissement de la session
        var role models.RoleUtilisateur
        var etablissement *models.Etablissement

        // SUPER_ADMIN : ne peut pas sélectionner d'établissement (rôle plateforme)
        if user.RoleGlobal != nil && *user.RoleGlobal == models.RoleSuperAdmin {
                if etablissementID != nil {
                        return nil, errors.New("le SUPER_ADMIN ne peut pas sélectionner d'établissement — utilisez le mode support pour la maintenance")
                }
                role = models.RoleSuperAdmin
                // Pas d'établissement pour le SUPER_ADMIN
        } else if etablissementID != nil {
                // Vérifier l'accès à cet établissement
                var access models.EtablissementAccess
                if err := db.Where("utilisateur_id = ? AND etablissement_id = ?", user.ID, *etablissementID).First(&access).Error; err != nil {
                        return nil, errors.New("accès à cet établissement non autorisé")
                }
                role = access.Role
                if err := db.First(&etablissement, "id = ?", *etablissementID).Error; err != nil {
                        return nil, errors.New("établissement introuvable")
                }
        } else {
                // Pas d'établissement choisi : utiliser le rôle global
                if user.RoleGlobal == nil {
                        return nil, errors.New("aucun rôle attribué — contactez l'administrateur")
                }
                role = *user.RoleGlobal
                // Si l'utilisateur a un seul accès établissement, le présélectionner
                var count int64
                db.Model(&models.EtablissementAccess{}).Where("utilisateur_id = ?", user.ID).Count(&count)
                if count == 1 {
                        var access models.EtablissementAccess
                        db.Where("utilisateur_id = ?", user.ID).First(&access)
                        db.First(&etablissement, "id = ?", access.EtablissementID)
                        etablissementID = &access.EtablissementID
                        role = access.Role
                }
        }

        // Générer les tokens
        accessToken, accessExp, err := s.jwt.GenerateAccessToken(&user, etablissementID, role)
        if err != nil {
                return nil, err
        }
        refreshToken, refreshExp, err := s.jwt.GenerateRefreshToken(&user)
        if err != nil {
                return nil, err
        }

        // Persister les sessions (access + refresh)
        now := time.Now()
        sessions := []models.Session{
                {
                        UtilisateurID:   user.ID,
                        TokenHash:       HashToken(accessToken),
                        Type:            models.SessionAccess,
                        ExpiresAt:       accessExp,
                        IPAdresse:       ip,
                        UserAgent:       userAgent,
                        EtablissementID: etablissementID,
                },
                {
                        UtilisateurID:   user.ID,
                        TokenHash:       HashToken(refreshToken),
                        Type:            models.SessionRefresh,
                        ExpiresAt:       refreshExp,
                        IPAdresse:       ip,
                        UserAgent:       userAgent,
                        EtablissementID: etablissementID,
                },
        }
        for i := range sessions {
                sessions[i].ID = uuid.New()
        }
        db.Create(&sessions)

        // Mettre à jour la dernière connexion + reset tentatives
        db.Model(&user).Updates(map[string]interface{}{
                "derniere_connexion":   now,
                "tentatives_echouees": 0,
        })

        // Journaliser la connexion
        s.audit(user.ID, etablissementID, models.AuditLogin, "Utilisateur", user.ID.String(), ip)

        return &LoginResult{
                AccessToken:   accessToken,
                RefreshToken:  refreshToken,
                User:          &user,
                Etablissement: etablissement,
                Role:          role,
        }, nil
}

// Refresh renouvelle les tokens à partir d'un refresh token valide.
func (s *AuthService) Refresh(refreshTokenStr string, ip, userAgent string) (string, string, error) {
        claims, err := s.jwt.ValidateToken(refreshTokenStr)
        if err != nil {
                return "", "", errors.New("refresh token invalide ou expiré")
        }

        // Vérifier que la session existe et n'est pas révoquée
        var session models.Session
        if err := database.DB.Where("token_hash = ? AND type = ?", HashToken(refreshTokenStr), models.SessionRefresh).First(&session).Error; err != nil {
                return "", "", errors.New("session introuvable")
        }
        if session.Revoked {
                return "", "", errors.New("session révoquée")
        }

        var user models.Utilisateur
        if err := database.DB.First(&user, "id = ?", claims.UserID).Error; err != nil {
                return "", "", errors.New("utilisateur introuvable")
        }
        if user.Statut != models.StatutUserActif {
                return "", "", errors.New("compte désactivé")
        }

        // Rôle/établissement : reprendre celui de la session refresh
        role := claims.Role
        if role == "" && user.RoleGlobal != nil {
                role = *user.RoleGlobal
        }

        accessToken, accessExp, err := s.jwt.GenerateAccessToken(&user, session.EtablissementID, role)
        if err != nil {
                return "", "", err
        }
        newRefreshToken, refreshExp, err := s.jwt.GenerateRefreshToken(&user)
        if err != nil {
                return "", "", err
        }

        // Révoquer l'ancien refresh, créer le nouveau
        database.DB.Model(&session).Update("revoked", true)
        database.DB.Create(&models.Session{
                BaseModel:      models.BaseModel{ID: uuid.New()},
                UtilisateurID:  user.ID,
                TokenHash:      HashToken(accessToken),
                Type:           models.SessionAccess,
                ExpiresAt:      accessExp,
                IPAdresse:      ip,
                UserAgent:      userAgent,
                EtablissementID: session.EtablissementID,
        })
        database.DB.Create(&models.Session{
                BaseModel:      models.BaseModel{ID: uuid.New()},
                UtilisateurID:  user.ID,
                TokenHash:      HashToken(newRefreshToken),
                Type:           models.SessionRefresh,
                ExpiresAt:      refreshExp,
                IPAdresse:      ip,
                UserAgent:      userAgent,
                EtablissementID: session.EtablissementID,
        })

        return accessToken, newRefreshToken, nil
}

// Logout révoque toutes les sessions actives d'un utilisateur.
func (s *AuthService) Logout(userID uuid.UUID, ip string) error {
        result := database.DB.Model(&models.Session{}).
                Where("utilisateur_id = ? AND revoked = ?", userID, false).
                Update("revoked", true)
        s.audit(userID, nil, models.AuditLogout, "Utilisateur", userID.String(), ip)
        return result.Error
}

// GetMe retourne l'utilisateur courant + son établissement/rôle effectif.
func (s *AuthService) GetMe(userID uuid.UUID, etablissementID *uuid.UUID) (*models.Utilisateur, *models.Etablissement, models.RoleUtilisateur, error) {
        var user models.Utilisateur
        if err := database.DB.First(&user, "id = ?", userID).Error; err != nil {
                return nil, nil, "", err
        }

        var etablissement *models.Etablissement
        var role models.RoleUtilisateur

        if etablissementID != nil {
                var access models.EtablissementAccess
                if err := database.DB.Where("utilisateur_id = ? AND etablissement_id = ?", userID, *etablissementID).First(&access).Error; err == nil {
                        role = access.Role
                } else if user.RoleGlobal != nil {
                        role = *user.RoleGlobal
                }
                if err := database.DB.First(&etablissement, "id = ?", *etablissementID).Error; err != nil {
                        etablissement = nil
                }
        } else if user.RoleGlobal != nil {
                role = *user.RoleGlobal
        }

        return &user, etablissement, role, nil
}

// audit enregistre une entrée dans le journal d'audit.
func (s *AuthService) audit(userID uuid.UUID, etablissementID *uuid.UUID, action models.ActionAudit, entite, entiteID, ip string) {
        database.DB.Create(&models.JournalAudit{
                BaseModel:      models.BaseModel{ID: uuid.New()},
                UtilisateurID:  &userID,
                EtablissementID: etablissementID,
                Action:         action,
                Entite:         entite,
                EntiteID:       entiteID,
                Date:           time.Now(),
                IPAdresse:      ip,
        })
}
