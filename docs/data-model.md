# ScolaGest — Modèle de données (MCD / MLD)

> **Phase 0 — Cadrage** — Document de conception v1.0
> À valider avant le démarrage du développement (Phase 1).

Ce document décrit le modèle conceptuel (MCD) et logique (MLD) de données
de l'application **ScolaGest**. Il s'appuie sur l'esquisse du §6 du cahier
des charges et l'étend pour couvrir le **périmètre V1 retenu** :
V1 standard + 4 points ex-§3.2 (Mobile Money, SMS/Email de relance,
Comptabilité générale, Multi-sites), hors gestion pédagogique.

---

## 1. Conventions

| Notation | Signification |
|---|---|
| **PK** | Clé primaire |
| **FK** | Clé étrangère |
| **UQ** | Contrainte d'unicité |
| **NN** | Non nul (NOT NULL) |
| `*` | Champs d'audit (`created_at`, `updated_at`) présents sur toutes les entités |
| Types | `UUID`, `STRING`, `TEXT`, `INT`, `DECIMAL(14,2)` (montants en FCFA), `DATE`, `DATETIME`, `BOOL`, `ENUM`, `JSON` |
| Nommage | Tables en `PascalCase` côté MCD, `snake_case` côté base (GORM convention) |
| Montants | Tous en **FCFA**, type `DECIMAL(14,2)` pour éviter les erreurs de flottants |

### Types ENUM globaux

```
CategorieEleve     = AFFECTE | NON_AFFECTE | NON_APPLICABLE
TypeFrais          = INSCRIPTION | SCOLARITE | EXAMEN | ANNEXE
ModePaiement       = ESPECES | CHEQUE | VIREMENT | MOBILE_MONEY
StatutPaiement     = VALIDE | ANNULE | EN_ATTENTE
StatutInscription  = INSCRIT | REINSCRIT | TRANSFERE | ABANDON
RoleUtilisateur    = ADMINISTRATEUR | CAISSIER | COMPTABLE | DIRECTION
                   | CENSEUR | SECRETARIAT | PARENT
ProviderMomo       = ORANGE_MONEY | MTN_MONEY | WAVE
TypeMessage        = SMS | EMAIL
StatutEnvoi        = EN_ATTENTE | ENVOYE | ECHEC | DELIVRE
TypeDocument       = PHOTO | EXTRAIT_NAISSANCE | CERTIFICAT_SCOLARITE | AUTRE
```

---

## 2. Vue d'ensemble des entités (par domaine fonctionnel)

Le modèle est organisé en **7 domaines** :

1. **Référentiel & multi-sites** — Etablissement, AnneeScolaire, Cycle, Classe
2. **Élèves & tuteurs** — Eleve, Tuteur, Inscription, Document
3. **Facturation** — Frais, Echeance, Derogation
4. **Caisse & paiements** — Paiement, Recu, ClotureCaisse, TransactionMobileMoney
5. **Utilisateurs & sécurité** — Utilisateur, EtablissementAccess, Session, JournalAudit
6. **Communication** — TemplateMessage, EnvoiMessage
7. **Comptabilité** — ExerciceComptable, CompteComptable, JournalComptable, EcritureComptable, LigneEcriture

**Total : 25 entités** (+ Notification pour l'in-app).

---

## 3. Domaine 1 — Référentiel & multi-sites

### 3.1 Etablissement
Représente une entité administrative du Groupe (ex. Collège Privé Le Chandelier,
École Primaire Privée Le Chandelier / EPV). Cœur de l'architecture multi-sites (§7.5).

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| nom | STRING | NN | Ex. « Collège Privé Le Chandelier » |
| code_officiel | STRING | NN, UQ | Ex. « 013062 », « 0103105091 » |
| adresse | STRING | | |
| ville | STRING | | Dabou |
| telephone | STRING | | |
| email | STRING | | |
| applique_categorie_affecte | BOOL | NN | true pour collège/lycée, false pour préscolaire/primaire |
| logo_url | STRING | | |
| couleur_theme | STRING | | code hex pour habillage |
| actif | BOOL | NN | |
| created_at / updated_at | DATETIME | * | |

**Règles métier :**
- `applique_categorie_affecte` pilote la visibilité de la distinction affecté/non-affecté sur les élèves et les frais de l'établissement.
- Un établissement ne peut être supprimé s'il possède des élèves ou paiements ; on le désactive (`actif = false`).

### 3.2 AnneeScolaire
Année scolaire commune aux établissements (calendrier ivoirien : septembre→juillet).

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| libelle | STRING | NN, UQ | Ex. « 2026-2027 » |
| date_debut | DATE | NN | |
| date_fin | DATE | NN | |
| statut | ENUM | NN | PREPARATION | EN_COURS | CLOTUREE |
| est_active | BOOL | NN | une seule année active à la fois |
| created_at / updated_at | DATETIME | * | |

**Note :** La `date_limite_solde` (dernière échéance de scolarité) est portée par les échéances des `Frais` de scolarité (rang le plus élevé), pas par l'année scolaire elle-même, car elle peut différer par cycle.

### 3.3 Cycle

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| etablissement_id | UUID | FK→Etablissement, NN | |
| libelle | ENUM | NN | PRESCOLAIRE | PRIMAIRE | COLLEGE | LYCEE |
| ordre | INT | NN | 1, 2, 3, 4 |
| actif | BOOL | NN | |
| created_at / updated_at | DATETIME | * | |

**UQ :** (etablissement_id, libelle) — pas de doublon de cycle par établissement.

### 3.4 Classe

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| cycle_id | UUID | FK→Cycle, NN | |
| libelle | STRING | NN | Ex. « CP1 », « 6e A », « Terminale D » |
| niveau | INT | NN | ordre dans le cycle (1..n) |
| est_classe_examen | BOOL | NN | true pour CM2, 3e, Terminale |
| effectif_max | INT | | |
| actif | BOOL | NN | |
| created_at / updated_at | DATETIME | * | |

**UQ :** (cycle_id, libelle).

---

## 4. Domaine 2 — Élèves & tuteurs

### 4.1 Tuteur (Parent)

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| nom | STRING | NN | |
| prenoms | STRING | | |
| telephone | STRING | NN | téléphone principal (Mobile Money possible) |
| telephone2 | STRING | | |
| email | STRING | | |
| adresse | TEXT | | |
| lien_parente | ENUM | | PERE | MERE | TUTEUR_LEGAL | AUTRE |
| profession | STRING | | |
| actif | BOOL | NN | |
| created_at / updated_at | DATETIME | * | |

**Note :** Un tuteur peut avoir plusieurs enfants. Un élève peut avoir plusieurs tuteurs (relation N-N via `TuteurEleve`), mais un seul tuteur principal sur `Eleve.tuteur_id`.

### 4.2 TuteurEleve (association N-N)
Permet d'attacher plusieurs tuteurs à un élève (père + mère + oncle…).

| Attribut | Type | Contraintes |
|---|---|---|
| eleve_id | UUID | FK→Eleve, PK |
| tuteur_id | UUID | FK→Tuteur, PK |
| est_principal | BOOL | NN |
| note | STRING | |

### 4.3 Eleve

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| etablissement_id | UUID | FK→Etablissement, NN | |
| matricule_ministere | STRING | UQ, nullable | attribué à partir du CP1 ; null pour préscolaire |
| identifiant_interne | STRING | NN, UQ | auto-généré (ex. `EPV-2026-0001`) ; remplacé par le matricule MEN plus tard |
| nom | STRING | NN | |
| prenoms | STRING | | |
| date_naissance | DATE | | |
| lieu_naissance | STRING | | |
| sexe | ENUM | | M | F |
| photo_url | STRING | | URL signée R2 |
| categorie | ENUM | NN | AFFECTE | NON_AFFECTE | NON_APPLICABLE |
| statut | ENUM | NN | ACTIF | INACTIF | TRANSFERE | DIPLOME |
| tuteur_id | UUID | FK→Tuteur, nullable | tuteur principal |
| created_at / updated_at | DATETIME | * | |

**Règles métier :**
- `categorie = NON_APPLICABLE` quand `etablissement.applique_categorie_affecte = false` (préscolaire/primaire).
- `matricule_ministere` est unique **globalement** (conservé tout au long du parcours primaire→lycée) ; `identifiant_interne` est unique par établissement.
- À l'attribution du matricule MEN (entrée en CP1), l'`identifiant_interne` est conservé pour traçabilité mais les recherches privilégient le matricule MEN.

### 4.4 Inscription (Inscription de l'élève à une classe pour une année)
C'est l'entité pivot qui historise le parcours : un élève est **inscrit** dans une classe pour une année scolaire donnée.

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| eleve_id | UUID | FK→Eleve, NN | |
| etablissement_id | UUID | FK→Etablissement, NN | |
| classe_id | UUID | FK→Classe, NN | |
| annee_scolaire_id | UUID | FK→AnneeScolaire, NN | |
| date_inscription | DATE | NN | |
| statut | ENUM | NN | INSCRIT | REINSCRIT | TRANSFERE | ABANDON |
| derogation_inscription | BOOL | NN | true si dérogation sociale 3 tranches accordée |
| motif_derogation | STRING | | « raison sociale » |
| accordee_par | UUID | FK→Utilisateur, nullable | qui a accordé la dérogation |
| date_derogation | DATE | nullable | |
| notes | TEXT | | |
| created_at / updated_at | DATETIME | * | |

**UQ :** (eleve_id, annee_scolaire_id) — un élève n'a qu'une inscription active par année.

**Règles métier :**
- Le processus de réinscription en fin d'année crée une nouvelle `Inscription` pour l'année suivante (avec `statut = REINSCRIT`), sans toucher à l'historique.
- La dérogation sociale (3 tranches pour frais d'inscription d'un affecté) est tracée ici, élève par élève (§5.2 du cahier des charges).

### 4.5 Document (Fichier stocké)

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| eleve_id | UUID | FK→Eleve, nullable | nullable pour documents d'établissement |
| etablissement_id | UUID | FK→Etablissement, NN | |
| type | ENUM | NN | PHOTO | EXTRAIT_NAISSANCE | CERTIFICAT_SCOLARITE | AUTRE |
| nom_fichier | STRING | NN | |
| cle_stockage | STRING | NN | clé R2 (ou chemin local) |
| url_signee | STRING | | URL signée générée à la demande |
| taille | INT | | octets |
| mime_type | STRING | | |
| uploaded_by | UUID | FK→Utilisateur, NN | |
| created_at | DATETIME | * | |

---

## 5. Domaine 3 — Facturation

### 5.1 Frais (Configuration des frais)
Définit, par établissement + année + cycle/classe, le montant et le découpage d'un type de frais.

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| etablissement_id | UUID | FK→Etablissement, NN | |
| annee_scolaire_id | UUID | FK→AnneeScolaire, NN | |
| cycle_id | UUID | FK→Cycle, nullable | nullable si frais au niveau établissement |
| classe_id | UUID | FK→Classe, nullable | plus spécifique que cycle (prioritaire) |
| type_frais | ENUM | NN | INSCRIPTION | SCOLARITE | EXAMEN | ANNEXE |
| categorie | ENUM | nullable | AFFECTE | NON_AFFECTE ; null si tarif unique |
| libelle | STRING | NN | Ex. « Scolarité annuelle 1er cycle » |
| montant_total | DECIMAL(14,2) | NN | |
| nb_versements_defaut | INT | NN | 1 (inscription), 5 (collège/lycée), 4 (primaire/préscolaire) |
| actif | BOOL | NN | |
| created_at / updated_at | DATETIME | * | |

**Règles de résolution du tarif applicable à un élève :**
1. Rechercher un `Frais` avec `classe_id` = classe de l'élève → sinon `cycle_id` → sinon établissement.
2. Filtrer par `categorie` correspondant à l'élève (si `categorie` est null → tarif unique applicable à toutes les catégories de cet établissement).
3. Le `Frais` d'inscription a `nb_versements_defaut = 1` par défaut ; si l'élève a `derogation_inscription = true`, un échéancier personnalisé de 3 tranches est généré (voir `Echeance` avec `eleve_id` renseigné).

**UQ :** (etablissement_id, annee_scolaire_id, type_frais, classe_id, categorie) — pas de doublon.

### 5.2 Echeance (Tranches d'échéancier)
Modèle d'échéancier (générique par `frais_id`) **ou** échéancier dérogatoire propre à un élève (`eleve_id` renseigné).

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| frais_id | UUID | FK→Frais, NN | |
| eleve_id | UUID | FK→Eleve, nullable | null = modèle générique ; renseigné = dérogation élève |
| rang | INT | NN | 1, 2, 3… |
| libelle | STRING | NN | « 1er versement », « Tranche 1 » |
| montant | DECIMAL(14,2) | NN | |
| date_limite | DATE | NN | |
| motif_derogation | STRING | | si échéancier dérogatoire |
| created_at / updated_at | DATETIME | * | |

**Règle :** Σ `montant` des échéances d'un `Frais` = `Frais.montant_total` (contrôle d'intégrité applicatif).

---

## 6. Domaine 4 — Caisse & paiements

### 6.1 Paiement

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| eleve_id | UUID | FK→Eleve, NN | |
| inscription_id | UUID | FK→Inscription, NN | ancrage année/classe |
| etablissement_id | UUID | FK→Etablissement, NN | |
| frais_id | UUID | FK→Frais, nullable | frais ciblé (inscription, scolarité, examen…) |
| echeance_id | UUID | FK→Echeance, nullable | tranche visée, null si paiement libre |
| montant | DECIMAL(14,2) | NN | |
| mode_paiement | ENUM | NN | ESPECES | CHEQUE | VIREMENT | MOBILE_MONEY |
| provider_momo | ENUM | nullable | ORANGE_MONEY | MTN_MONEY | WAVE |
| reference_externe | STRING | | n° chèque, ID transaction Momo, n° virement |
| date_paiement | DATETIME | NN | |
| caissier_id | UUID | FK→Utilisateur, NN | |
| statut | ENUM | NN | VALIDE | ANNULE | EN_ATTENTE |
| numero_recu | STRING | UQ | généré automatiquement |
| motif_annulation | STRING | | obligatoire si annulation |
| annule_par | UUID | FK→Utilisateur, nullable | validateur supérieur |
| date_annulation | DATETIME | nullable | |
| created_at / updated_at | DATETIME | * | |

**Règles métier :**
- Contrôle automatique du montant vs solde restant dû (alerte si dépassement, gestion des trop-perçus via avoir).
- L'annulation exige un `motif_annulation` et une validation par un rôle supérieur (piste d'audit → `JournalAudit`).
- Le `numero_recu` est séquentiel par établissement+année (ex. `REC-013062-2026-000123`).

### 6.2 Recu

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| paiement_id | UUID | FK→Paiement, NN, UQ | 1 reçu par paiement |
| numero | STRING | NN, UQ | |
| pdf_url | STRING | | clé R2 du PDF généré |
| contenu_snapshot | JSON | | instantané des données au moment de l'émission |
| date_emission | DATETIME | NN | |
| created_at | DATETIME | * | |

### 6.3 ClotureCaisse (Clôture journalière)

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| caissier_id | UUID | FK→Utilisateur, NN | |
| etablissement_id | UUID | FK→Etablissement, NN | |
| date_cloture | DATE | NN | |
| total_theorique | DECIMAL(14,2) | NN | somme des paiements validés du jour |
| total_remis | DECIMAL(14,2) | NN | montant réellement remis |
| ecart | DECIMAL(14,2) | NN | total_remis - total_theorique |
| statut | ENUM | NN | OUVERTE | CLOTUREE | VALIDEE |
| valide_par | UUID | FK→Utilisateur, nullable | |
| notes | TEXT | | |
| created_at / updated_at | DATETIME | * | |

**UQ :** (caissier_id, etablissement_id, date_cloture) — une seule clôture par caissier/établissement/jour.

### 6.4 TransactionMobileMoney (V1 étendu)
Trace des transactions Mobile Money initiées (indépendantes du `Paiement` jusqu'à confirmation).

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| paiement_id | UUID | FK→Paiement, nullable | renseigné à la confirmation |
| eleve_id | UUID | FK→Eleve, NN | |
| etablissement_id | UUID | FK→Etablissement, NN | |
| provider | ENUM | NN | ORANGE_MONEY | MTN_MONEY | WAVE |
| montant | DECIMAL(14,2) | NN | |
| telephone_client | STRING | NN | |
| reference_externe | STRING | | ID transaction provider |
| statut | ENUM | NN | INITIEE | EN_COURS | REUSSIE | ECHEC | REMBOURSEE |
| payload_requete | JSON | | requête envoyée au provider |
| payload_reponse | JSON | | réponse du provider |
| date_initiation | DATETIME | NN | |
| date_confirmation | DATETIME | | |
| erreur | TEXT | | |
| created_at / updated_at | DATETIME | * | |

---

## 7. Domaine 5 — Utilisateurs & sécurité

### 7.1 Utilisateur

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| nom | STRING | NN | |
| prenoms | STRING | | |
| email | STRING | NN, UQ | |
| mot_de_passe_hash | STRING | NN | bcrypt/argon2 |
| role_global | ENUM | | rôle par défaut ; surchargeable par `EtablissementAccess` |
| tuteur_id | UUID | FK→Tuteur, nullable | si role = PARENT |
| statut | ENUM | NN | ACTIF | INACTIF | BLOQUE |
| derniere_connexion | DATETIME | | |
| tentatives_echouees | INT | | anti-brute-force |
| created_at / updated_at | DATETIME | * | |

### 7.2 EtablissementAccess (Multi-sites RBAC)
Permet à un utilisateur d'avoir un rôle **spécifique par établissement** et d'accéder à plusieurs sites.

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| utilisateur_id | UUID | FK→Utilisateur, PK | |
| etablissement_id | UUID | FK→Etablissement, PK | |
| role | ENUM | NN | rôle effectif dans cet établissement |
| created_at | DATETIME | * | |

**Règle :** À la connexion, l'utilisateur choisit son établissement de travail ; le rôle appliqué est celui de `EtablissementAccess`, sinon `role_global`. Un super-administrateur (tous établissements) a `role_global = ADMINISTRATEUR` sans `EtablissementAccess`.

### 7.3 Session (JWT / Refresh tokens)

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| utilisateur_id | UUID | FK→Utilisateur, NN | |
| token_hash | STRING | NN, UQ | hash du refresh token |
| type | ENUM | NN | ACCESS | REFRESH |
| expires_at | DATETIME | NN | |
| revoked | BOOL | NN | |
| ip_adresse | STRING | | |
| user_agent | STRING | | |
| etablissement_id | UUID | FK | établissement de la session |
| created_at | DATETIME | * | |

### 7.4 JournalAudit

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| utilisateur_id | UUID | FK→Utilisateur, nullable | null si action système |
| etablissement_id | UUID | FK→Etablissement, nullable | |
| action | ENUM | NN | CREATE | UPDATE | DELETE | CANCEL | LOGIN | LOGOUT | EXPORT |
| entite | STRING | NN | nom de l'entité concernée |
| entite_id | STRING | | |
| date | DATETIME | NN | |
| details | JSON | | avant/après, montant, etc. |
| ip_adresse | STRING | | |

**Règle :** Toute action sensible (création/modification/annulation de paiement, modification de catégorie d'élève, modification de frais, connexion) génère une entrée d'audit.

---

## 8. Domaine 6 — Communication (SMS/Email de relance — V1 étendu)

### 8.1 TemplateMessage

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| etablissement_id | UUID | FK→Etablissement, nullable | null = template global |
| code | STRING | NN | RELANCE_ECHEANCE | CONFIRMATION_PAIEMENT | RELANCE_SOLDE |
| type | ENUM | NN | SMS | EMAIL |
| sujet | STRING | | pour EMAIL |
| corps | TEXT | NN | avec variables `{{eleve_nom}}`, `{{montant}}`, `{{date_limite}}` |
| actif | BOOL | NN | |
| created_at / updated_at | DATETIME | * | |

### 8.2 EnvoiMessage

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| eleve_id | UUID | FK→Eleve, NN | |
| tuteur_id | UUID | FK→Tuteur, NN | destinataire (parent) |
| etablissement_id | UUID | FK→Etablissement, NN | |
| template_id | UUID | FK→TemplateMessage, nullable | |
| type | ENUM | NN | SMS | EMAIL |
| destinataire | STRING | NN | téléphone ou email |
| contenu_genere | TEXT | NN | après fusion des variables |
| statut | ENUM | NN | EN_ATTENTE | ENVOYE | ECHEC | DELIVRE |
| provider | STRING | | Orange SMS API, SMTP, etc. |
| reference_externe | STRING | | ID provider |
| date_creation | DATETIME | NN | |
| date_envoi | DATETIME | | |
| erreur | TEXT | | |
| created_at | DATETIME | * | |

---

## 9. Domaine 7 — Comptabilité générale (V1 étendu)

### 9.1 ExerciceComptable

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| etablissement_id | UUID | FK→Etablissement, NN | |
| libelle | STRING | NN | « Exercice 2026-2027 » |
| date_debut | DATE | NN | |
| date_fin | DATE | NN | |
| statut | ENUM | NN | OUVERT | CLOTURE |
| annee_scolaire_id | UUID | FK→AnneeScolaire, nullable | |
| created_at / updated_at | DATETIME | * | |

### 9.2 CompteComptable (Plan comptable)

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| etablissement_id | UUID | FK→Etablissement, NN | |
| numero | STRING | NN | ex. « 411000 » (clients), « 706000 » (scolarité) |
| libelle | STRING | NN | |
| type | ENUM | NN | ACTIF | PASSIF | PRODUIT | CHARGE |
| parent_id | UUID | FK→CompteComptable, nullable | hiérarchie |
| actif | BOOL | NN | |
| created_at / updated_at | DATETIME | * | |

**UQ :** (etablissement_id, numero).

### 9.3 JournalComptable

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| etablissement_id | UUID | FK→Etablissement, NN | |
| code | STRING | NN | JNL_CAISSE | JNL_BANQUE | JNL_OD | JNL_VENTES |
| libelle | STRING | NN | |
| type | ENUM | NN | CAISSE | BANQUE | OD | VENTES |
| compte_contrepartie_id | UUID | FK→CompteComptable | |
| created_at / updated_at | DATETIME | * | |

### 9.4 EcritureComptable

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| exercice_id | UUID | FK→ExerciceComptable, NN | |
| journal_id | UUID | FK→JournalComptable, NN | |
| paiement_id | UUID | FK→Paiement, nullable | écriture générée depuis un paiement |
| envoi_message_id | UUID | FK→EnvoiMessage, nullable | si coût de communication à imputer |
| date_ecriture | DATE | NN | |
| numero_piece | STRING | | n° reçu ou n° interne |
| libelle | STRING | NN | |
| statut | ENUM | NN | BROUILLON | VALIDEE |
| created_by | UUID | FK→Utilisateur, NN | |
| created_at / updated_at | DATETIME | * | |

### 9.5 LigneEcriture (lignes débit/crédit)

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| ecriture_id | UUID | FK→EcritureComptable, NN | |
| compte_id | UUID | FK→CompteComptable, NN | |
| debit | DECIMAL(14,2) | NN, default 0 | |
| credit | DECIMAL(14,2) | NN, default 0 | |
| libelle | STRING | | |
| created_at | DATETIME | * | |

**Règle d'équilibre :** Σ `debit` = Σ `credit` pour une `EcritureComptable` (partie double).

---

## 10. Domaine 8 — Notification (in-app, bonus)

### 10.1 Notification

| Attribut | Type | Contraintes | Description |
|---|---|---|---|
| id | UUID | PK | |
| utilisateur_id | UUID | FK→Utilisateur, NN | |
| type | STRING | NN | PAIEMENT_RECU | RELANCE | CLOTURE | SYSTEME |
| message | TEXT | NN | |
| lu | BOOL | NN | |
| lien | STRING | | route interne |
| created_at | DATETIME | * | |

---

## 11. Schéma des relations (vue d'ensemble)

```
Etablissement (1) ──< (N) Cycle (1) ──< (N) Classe
     │                    │
     │ (1)                │
     │                    └─< Frais >─ Classe / Cycle
     │
     ├──< (N) Eleve >── Tuteur (N) ── via TuteurEleve (N:N)
     │      │
     │      └──< (N) Inscription >── Classe, AnneeScolaire
     │             │
     │             └──< (N) Paiement >── Echeance (nullable), Frais (nullable)
     │                    │
     │                    ├──< (1) Recu
     │                    ├──< (0..1) TransactionMobileMoney
     │                    └──< (0..1) EcritureComptable >── LigneEcriture (N)
     │
     ├──< (N) Utilisateur ── via EtablissementAccess (N:N)
     │      │
     │      ├──< (N) Session
     │      └──< (N) JournalAudit
     │
     ├──< (N) ProviderPaiementConfig (Mobile Money)
     ├──< (N) ClotureCaisse
     ├──< (N) TemplateMessage
     ├──< (N) EnvoiMessage
     ├──< (N) ExerciceComptable ──< (N) EcritureComptable
     ├──< (N) CompteComptable (hiérarchique)
     ├──< (N) JournalComptable
     └──< (N) Document

AnneeScolaire (globale) ──< Frais, Inscription, ExerciceComptable
Echeance ── Frais (+ Eleve nullable pour dérogation)
```

---

## 12. Règles métier clés (récapitulatif)

1. **Catégorie d'élève** : `NON_APPLICABLE` quand l'établissement n'applique pas la distinction (préscolaire/primaire). Les frais de ces établissements ont `categorie = null` (tarif unique).
2. **Matricule** : `matricule_ministere` unique globalement, attribué à partir du CP1 ; `identifiant_interne` auto-généré pour le préscolaire, conservé en complément.
3. **Frais d'inscription** : `nb_versements_defaut = 1` par défaut. Dérogation sociale possible (3 tranches) **uniquement** pour les élèves `AFFECTE`, accordée cas par cas par un administrateur (tracée dans `Inscription` + échéancier `Echeance` avec `eleve_id` renseigné).
4. **Scolarité** : échelonnée — 5 tranches (collège/lycée, octobre→février) ou 4 tranches (primaire/préscolaire, novembre→février). Configurable par année.
5. **Paiement** : contrôle du montant vs solde restant dû ; génération immédiate d'un `Recu` numéroté ; annulation avec motif + validation supérieure + audit.
6. **Clôture de caisse** : une par caissier/établissement/jour ; rapprochement théorique vs remis avec écart.
7. **Multi-sites** : `etablissement_id` présent sur toutes les entités structurantes ; `EtablissementAccess` gère le rôle par établissement.
8. **Comptabilité** : chaque `Paiement` valide génère une `EcritureComptable` (débit caisse/banque, crédit produit scolarité) dans l'exercice en cours ; partie double contrôlée.
9. **Mobile Money** : `TransactionMobileMoney` suit le cycle provider (initiée→réussie) ; un `Paiement` n'est créé qu'à la confirmation.
10. **Relances** : `EnvoiMessage` généré depuis un `TemplateMessage` ; cible le `Tuteur` de l'élève en retard.
11. **Audit** : `JournalAudit` sur toute action sensible (paiement, catégorie, frais, connexion).

---

## 13. Index recommandés

| Table | Index | Usage |
|---|---|---|
| Eleve | (etablissement_id), (matricule_ministere), (nom, prenoms) | recherche |
| Inscription | (eleve_id, annee_scolaire_id), (classe_id, annee_scolaire_id) | listing classe |
| Paiement | (eleve_id), (etablissement_id, date_paiement), (caissier_id, date_paiement) | caisse, rapports |
| Echeance | (frais_id, rang), (eleve_id) | solde élève |
| JournalAudit | (etablissement_id, date), (utilisateur_id, date) | consultation |
| EcritureComptable | (exercice_id, date_ecriture), (paiement_id) | grand livre |

---

## 14. Migration SQLite → PostgreSQL (Neon)

### Compatibilité
- Les types UUID seront stockés en `TEXT` sous SQLite, `UUID` sous PostgreSQL.
- `DECIMAL(14,2)` est supporté nativement par les deux.
- Les `JSON` sont stockés en `TEXT` sous SQLite, `JSONB` sous PostgreSQL (indexables).
- Les `ENUM` : sous SQLite, GORM les sérialise en `TEXT` avec contrainte applicative ; sous PostgreSQL, vrais types ENUM.

### Plan de migration
1. **Développement local** : SQLite (`file:./scolagest.db`) via GORM AutoMigrate.
2. **Recette/Production** : bascule `DATABASE_URL` vers Neon (PostgreSQL) ; GORM détecte le dialecte. Les migrations GORM sont compatibles.
3. **Migration des données** : export SQLite → transformation (UUID strict, JSONB) → import PostgreSQL, via un script Go dédié.

### Points d'attention
- Sensibilité à la casse : PostgreSQL est sensible à la casse par défaut (SQLite aussi) — uniformiser les recherches avec `LOWER()`.
- Contraintes FK : SQLite ne les vérifie pas par défaut sauf `PRAGMA foreign_keys=ON` ; PostgreSQL les vérifie strictement.
- Transactions : SQLite supporte les transactions mais en mode sérialisé ; PostgreSQL gère la concurrence native.

---

## 15. À valider avant la Phase 1

- [ ] Validation des **25 entités** et de leurs attributs.
- [ ] Validation des **règles métier** (§12), notamment la dérogation 3 tranches et la catégorie `NON_APPLICABLE`.
- [ ] Validation du modèle **comptable** (partie double, exercice par établissement).
- [ ] Validation de la stratégie **multi-sites** (`EtablissementAccess`).
- [ ] Arbitrage : faut-il une table `Role`/`Permission` explicite (RBAC granulaire) ou se contenter des rôles ENUM ? → **Proposition V1 : rôles ENUM** (simplification), évolution possible en V2.
- [ ] Arbitrage : les frais annexes (cantine, transport) — table `Frais` avec `type_frais = ANNEXE` ou entité dédiée ? → **Proposition V1 : réutiliser `Frais`**.

Une fois ces points validés, le schéma sera implémenté en modèles GORM (Go) au démarrage de la Phase 1.
