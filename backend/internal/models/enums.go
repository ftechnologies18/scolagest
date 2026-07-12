package models

// ===== Types ENUM du modèle de données ScolaGest =====
// GORM sérialise ces types en TEXT côté SQLite (avec contrainte applicative).
// En production (PostgreSQL/Neon), ils seront convertis en vrais types ENUM.

// CategorieEleve : catégorie de l'élève vis-à-vis de l'affectation par l'État.
// NON_APPLICABLE est utilisée pour le préscolaire et le primaire (pas d'affectation).
type CategorieEleve string

const (
        CategorieAffecte         CategorieEleve = "AFFECTE"
        CategorieNonAffecte      CategorieEleve = "NON_AFFECTE"
        CategorieNonApplicable   CategorieEleve = "NON_APPLICABLE"
)

// TypeFrais : nature d'un frais facturé.
type TypeFrais string

const (
        TypeFraisInscription TypeFrais = "INSCRIPTION"
        TypeFraisScolarite   TypeFrais = "SCOLARITE"
        TypeFraisExamen      TypeFrais = "EXAMEN"
        TypeFraisAnnexe      TypeFrais = "ANNEXE"
)

// ModePaiement : moyen de paiement d'un encaissement.
type ModePaiement string

const (
        ModeEspeces      ModePaiement = "ESPECES"
        ModeCheque       ModePaiement = "CHEQUE"
        ModeVirement     ModePaiement = "VIREMENT"
        ModeMobileMoney  ModePaiement = "MOBILE_MONEY"
)

// StatutPaiement : cycle de vie d'un paiement.
type StatutPaiement string

const (
        StatutPaiementValide     StatutPaiement = "VALIDE"
        StatutPaiementAnnule     StatutPaiement = "ANNULE"
        StatutPaiementEnAttente  StatutPaiement = "EN_ATTENTE"
)

// StatutInscription : état d'une inscription d'élève pour une année.
type StatutInscription string

const (
        // StatutPreInscrit : élève créé + inscription enregistrée, MAIS les frais
        // d'inscription n'ont pas encore été payés à la caisse. L'inscription
        // n'est définitivement validée (→ INSCRIT) qu'après le paiement des
        // frais d'inscription. C'est le statut par défaut après le workflow
        // d'inscription ou la validation d'une pré-inscription.
        StatutPreInscrit StatutInscription = "PRE_INSCRIT"
        StatutInscrit    StatutInscription = "INSCRIT"
        StatutReinscrit  StatutInscription = "REINSCRIT"
        StatutTransfere  StatutInscription = "TRANSFERE"
        StatutAbandon    StatutInscription = "ABANDON"
)

// DecisionPromotion : décision de fin d'année pour le passage de classe.
// Utilisée lors de la réinscription massive pour distinguer les élèves
// qui passent, qui redoublent ou qui ne sont pas réinscrits.
type DecisionPromotion string

const (
        DecisionPromu        DecisionPromotion = "PROMU"         // passe en classe supérieure (défaut)
        DecisionRedoublant   DecisionPromotion = "REDOUBLANT"    // reste dans la même classe
        DecisionNonReinscrit DecisionPromotion = "NON_REINSCRIT" // abandon / transfert (pas de nouvelle inscription)
)

// StatutEleve : état général d'un élève.
type StatutEleve string

const (
        StatutEleveActif     StatutEleve = "ACTIF"
        StatutEleveInactif   StatutEleve = "INACTIF"
        StatutEleveTransfere StatutEleve = "TRANSFERE"
        StatutEleveDiplome   StatutEleve = "DIPLOME"
)

// RoleUtilisateur : rôles RBAC de l'application.
// SUPER_ADMIN = propriétaire SaaS (gère la plateforme, pas les établissements)
// DIRECTION = admin d'établissement (gère son établissement)
type RoleUtilisateur string

const (
        RoleSuperAdmin       RoleUtilisateur = "SUPER_ADMIN"
        RoleCaissier         RoleUtilisateur = "CAISSIER"
        RoleComptable        RoleUtilisateur = "COMPTABLE"
        RoleDirecteurEtudes  RoleUtilisateur = "DIRECTEUR_ETUDES"
        RoleDirecteurSuperviseur RoleUtilisateur = "DIRECTEUR_SUPERVISEUR"
        RoleSecretariat      RoleUtilisateur = "SECRETARIAT"
        RoleEnseignant       RoleUtilisateur = "ENSEIGNANT"
        // RoleEducateur : éducateur (vie scolaire, suivi & discipline des élèves).
        // Rôle staff d'établissement au même titre que CAISSIER / COMPTABLE /
        // SECRETARIAT, mais au périmètre restreint (dashboard, élèves en lecture,
        // discipline, rapports). Pas d'accès caisse / compta / frais / paramètres.
        RoleEducateur        RoleUtilisateur = "EDUCATEUR"
        // RoleDirection : legacy (migré vers DIRECTEUR_ETUDES / DIRECTEUR_SUPERVISEUR)
        RoleDirection        RoleUtilisateur = "DIRECTION"
)

// ProviderMomo : opéérateurs Mobile Money supportés (contexte ivoirien).
type ProviderMomo string

const (
        ProviderOrangeMoney ProviderMomo = "ORANGE_MONEY"
        ProviderMTNMoney    ProviderMomo = "MTN_MONEY"
        ProviderWave        ProviderMomo = "WAVE"
)

// TypeMessage : canal de communication.
type TypeMessage string

const (
        TypeMessageSMS   TypeMessage = "SMS"
        TypeMessageEmail TypeMessage = "EMAIL"
)

// StatutEnvoi : cycle de vie d'un envoi de message.
type StatutEnvoi string

const (
        StatutEnvoiEnAttente StatutEnvoi = "EN_ATTENTE"
        StatutEnvoiEnvoye    StatutEnvoi = "ENVOYE"
        StatutEnvoiEchec     StatutEnvoi = "ECHEC"
        StatutEnvoiDelivre   StatutEnvoi = "DELIVRE"
)

// TypeDocument : nature d'un document stocké.
type TypeDocument string

const (
        DocPhoto              TypeDocument = "PHOTO"
        DocExtraitNaissance   TypeDocument = "EXTRAIT_NAISSANCE"
        DocCertificatScolarite TypeDocument = "CERTIFICAT_SCOLARITE"
        DocAutre              TypeDocument = "AUTRE"
)

// LienParente : relation d'un tuteur avec l'élève.
type LienParente string

const (
        LienPere        LienParente = "PERE"
        LienMere        LienParente = "MERE"
        LienTuteurLegal LienParente = "TUTEUR_LEGAL"
        LienAutre       LienParente = "AUTRE"
)

// Sexe : sexe de l'élève.
type Sexe string

const (
        SexeM Sexe = "M"
        SexeF Sexe = "F"
)

// LibelleCycle : libellés des cycles scolaires.
type LibelleCycle string

const (
        CyclePrescolaire LibelleCycle = "PRESCOLAIRE"
        CyclePrimaire    LibelleCycle = "PRIMAIRE"
        CycleCollege     LibelleCycle = "COLLEGE"
        CycleLycee       LibelleCycle = "LYCEE"
)

// StatutCloture : état d'une clôture de caisse.
type StatutCloture string

const (
        StatutClotureOuverte   StatutCloture = "OUVERTE"
        StatutClotureCloturee  StatutCloture = "CLOTUREE"
        StatutClotureValidee   StatutCloture = "VALIDEE"
)

// StatutTransactionMomo : cycle de vie d'une transaction Mobile Money.
type StatutTransactionMomo string

const (
        StatutMomoInitiee    StatutTransactionMomo = "INITIEE"
        StatutMomoEnCours    StatutTransactionMomo = "EN_COURS"
        StatutMomoReussie    StatutTransactionMomo = "REUSSIE"
        StatutMomoEchec      StatutTransactionMomo = "ECHEC"
        StatutMomoRemboursee StatutTransactionMomo = "REMBOURSEE"
)

// StatutUtilisateur : état d'un compte utilisateur.
type StatutUtilisateur string

const (
        StatutUserActif   StatutUtilisateur = "ACTIF"
        StatutUserInactif StatutUtilisateur = "INACTIF"
        StatutUserBloque  StatutUtilisateur = "BLOQUE"
)

// TypeSession : type de token JWT.
type TypeSession string

const (
        SessionAccess  TypeSession = "ACCESS"
        SessionRefresh TypeSession = "REFRESH"
)

// ActionAudit : actions tracées dans le journal d'audit.
type ActionAudit string

const (
        AuditCreate  ActionAudit = "CREATE"
        AuditUpdate  ActionAudit = "UPDATE"
        AuditDelete  ActionAudit = "DELETE"
        AuditCancel  ActionAudit = "CANCEL"
        AuditLogin   ActionAudit = "LOGIN"
        AuditLogout  ActionAudit = "LOGOUT"
        AuditExport  ActionAudit = "EXPORT"
)

// StatutAnnee : état d'une année scolaire.
type StatutAnnee string

const (
        AnneePreparation StatutAnnee = "PREPARATION"
        AnneeEnCours     StatutAnnee = "EN_COURS"
        AnneeCloturee    StatutAnnee = "CLOTUREE"
)

// TypeCompte : type de compte comptable.
type TypeCompte string

const (
        CompteActif   TypeCompte = "ACTIF"
        ComptePassif  TypeCompte = "PASSIF"
        CompteProduit TypeCompte = "PRODUIT"
        CompteCharge  TypeCompte = "CHARGE"
)

// TypeJournal : type de journal comptable.
type TypeJournal string

const (
        JournalCaisse  TypeJournal = "CAISSE"
        JournalBanque  TypeJournal = "BANQUE"
        JournalOD      TypeJournal = "OD"
        JournalVentes  TypeJournal = "VENTES"
)

// StatutEcriture : état d'une écriture comptable.
type StatutEcriture string

const (
        EcritureBrouillon StatutEcriture = "BROUILLON"
        EcritureValidee   StatutEcriture = "VALIDEE"
)

// StatutExercice : état d'un exercice comptable.
type StatutExercice string

const (
        ExerciceOuvert   StatutExercice = "OUVERT"
        ExerciceCloture  StatutExercice = "CLOTURE"
)

// IsDirectorRole vérifie si un rôle est un rôle de direction
// (DIRECTEUR_ETUDES, DIRECTEUR_SUPERVISEUR, ou DIRECTION legacy).
func IsDirectorRole(role RoleUtilisateur) bool {
        return role == RoleDirecteurEtudes ||
                role == RoleDirecteurSuperviseur ||
                role == RoleDirection
}
