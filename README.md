# 🎓 ScolaGest — Application Web de Gestion & de Caisse Scolaire

Application web de digitalisation du cycle d'encaissement scolaire pour le **Groupe Scolaire Le Chandelier** (Dabou, Côte d'Ivoire) — du dossier d'inscription de l'élève jusqu'au solde complet de sa scolarité.

> **Cas d'usage de référence** : Collège Privé Le Chandelier — Dabou
> **Version** : 1.0
> **Auteur** : Freelance Technologies Côte d'Ivoire

---

## 📋 Table des matières

- [Aperçu](#aperçu)
- [Fonctionnalités V1](#fonctionnalités-v1)
- [Architecture technique](#architecture-technique)
- [Structure du monorepo](#structure-du-monorepo)
- [Prérequis](#prérequis)
- [Installation & démarrage](#installation--démarrage)
- [Comptes de démonstration](#comptes-de-démonstration)
- [Documentation](#documentation)
- [Roadmap](#roadmap)

---

## Aperçu

ScolaGest couvre l'ensemble du parcours éducatif (Préscolaire → Primaire → Collège → Lycée) avec une gestion multi-établissements. Le Groupe est composé de deux entités distinctes opérant sur le même site :

| Établissement | Cycles | Code officiel | Distinction affecté/non-affecté |
|---|---|---|---|
| Collège Privé Le Chandelier | Collège + Lycée | `013062` | ✅ Active |
| École Primaire Privée Le Chandelier / EPV | Préscolaire + Primaire | `0103105091` | ❌ Tarif unique |

---

## Fonctionnalités V1

### Module de base
- ✅ **Gestion des élèves** : fiches complètes, matricule ministériel / identifiant interne provisoire, tuteurs, inscriptions par classe/année
- ✅ **Catégories d'élèves** : affecté (exonéré scolarité) / non-affecté / non-applicable (préscolaire/primaire)
- ✅ **Paramétrage des frais** : inscription, scolarité (échelonnée 5 ou 4 tranches), examen, annexes — par cycle/classe/catégorie
- ✅ **Module de caisse** : encaissement multi-mode (espèces, chèque, virement, Mobile Money), reçus PDF numérotés, soldes temps réel, clôture journalière
- ✅ **Tableaux de bord & rapports** : KPIs, répartitions, évolution mensuelle, exports CSV/Excel, taux de recouvrement
- ✅ **Gestion utilisateurs + RBAC** : 7 rôles, accès multi-établissements, journal d'audit
- ✅ **Portail parents** : consultation enfants, soldes, historique paiements, reçus téléchargeables, échéances

### Modules avancés (ex-§3.2 intégrés au périmètre V1)
- ✅ **Comptabilité générale** : exercices, plan comptable, journaux, écritures en partie double générées automatiquement depuis les paiements, grand livre, bilan
- ✅ **Mobile Money** : intégration Orange Money / MTN Money / Wave (sandbox), webhook de confirmation, réconciliation
- ✅ **Relances SMS / Email** : templates avec variables, envoi individuel ou en masse, bordereaux de relance imprimables
- ✅ **Multi-sites simultanés** : exploitation opérationnelle de plusieurs établissements avec rôles distincts par site

### Hors périmètre V1
- ❌ Gestion pédagogique (notes, bulletins, emplois du temps) — évolution future

---

## Architecture technique

| Composant | Technologie |
|---|---|
| **Frontend** | Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui |
| **Backend / API** | Go (Gin + GORM + golang-migrate) |
| **Base de données (dev)** | SQLite (pure-Go via glebarez/sqlite) |
| **Base de données (prod)** | PostgreSQL managé — Neon (serverless) |
| **Authentification** | JWT (access + refresh tokens), bcrypt, RBAC |
| **Stockage fichiers** | Cloudflare R2 (compatible S3) — URLs signées |
| **State management** | Zustand (auth) + TanStack Query (server state) |
| **Communication inter-services** | Gateway Caddy (`?XTransformPort=8080` en dev) |

---

## Structure du monorepo

```
scolagest/
├── apps/
│   ├── web/                      # Frontend Next.js (port 3000)
│   │   ├── src/
│   │   │   ├── app/              #   App Router (route / unique)
│   │   │   ├── components/       #   Composants UI + wireframes + vues
│   │   │   │   ├── ui/           #     shadcn/ui
│   │   │   │   ├── auth/         #     Authentification
│   │   │   │   ├── dashboard/    #     Layout + vues staff
│   │   │   │   ├── eleves/       #     Module élèves
│   │   │   │   ├── caisse/       #     Module caisse
│   │   │   │   ├── frais/        #     Module frais
│   │   │   │   ├── comptabilite/ #     Module comptabilité
│   │   │   │   ├── mobile-money/ #     Module MoMo
│   │   │   │   ├── parametres/   #     Paramètres + multi-sites
│   │   │   │   ├── parent/       #     Portail parents
│   │   │   │   ├── phase0/       #     Présentation Phase 0
│   │   │   │   ├── reports/      #     Composants rapports (KPIs, charts)
│   │   │   │   └── wireframes/   #     Maquettes Phase 0
│   │   │   ├── lib/              #   Client API, stores, types, utils
│   │   │   └── instrumentation.ts #  Hook démarrage backend Go
│   │   ├── public/
│   │   ├── prisma/
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.ts
│   │   └── .env.example
│   │
│   └── api/                      # Backend Go (port 8080)
│       ├── cmd/server/main.go    #   Point d'entrée
│       ├── internal/
│       │   ├── config/           #   Configuration (env)
│       │   ├── database/         #   Connexion DB + migrations
│       │   ├── models/           #   25 modèles GORM (7 domaines)
│       │   ├── services/         #   17 services métier
│       │   ├── handlers/         #   14 handlers HTTP (~50 endpoints)
│       │   ├── middleware/       #   Auth JWT, RBAC, CORS
│       │   ├── utils/            #   JWT, bcrypt, normalize
│       │   └── seed/             #   Données de démonstration
│       ├── go.mod
│       └── .env.example
│
├── docs/
│   └── data-model.md             # Modèle de données (MCD/MLD)
├── mini-services/                # Wrappers de démarrage (sandbox)
├── package.json                  # Package racine (scripts monorepo)
├── .gitignore
├── .env.example
└── README.md
```

---

## Prérequis

- **Go** 1.23+ ([téléchargement](https://go.dev/dl/))
- **Node.js** 20+ et **Bun** ([téléchargement](https://bun.sh/))
- **Git**

---

## Installation & démarrage

### 1. Cloner le dépôt

```bash
git clone https://github.com/ftechnologies18/scolagest.git
cd scolagest
```

### 2. Configuration

```bash
# Frontend (apps/web)
cp apps/web/.env.example apps/web/.env

# Backend (apps/api)
cp apps/api/.env.example apps/api/.env
# Éditer apps/api/.env : changer JWT_SECRET en production
```

### 3. Démarrage du frontend (Next.js)

```bash
# Depuis la racine du monorepo
bun install    # installe les dépendances de apps/web
bun run dev    # lance le dev server Next.js sur le port 3000
# → http://localhost:3000
```

> ℹ️ Le hook `apps/web/src/instrumentation.ts` démarre automatiquement le backend Go au lancement du dev server Next.js (compile le backend si nécessaire, puis le lance en processus enfant sur le port 8080).

### 4. Démarrage manuel du backend (optionnel)

```bash
cd apps/api
go mod tidy
go run ./cmd/server/
# → http://localhost:8080/api/health
```

### 5. Accès à l'application

L'application est accessible sur `http://localhost:3000`. En développement, le gateway Caddy (port 81) route les appels API vers le backend Go via le paramètre `?XTransformPort=8080`.

---

## Comptes de démonstration

Le seed crée automatiquement ces comptes au premier démarrage :

| Rôle | Email | Mot de passe | Accès |
|---|---|---|---|
| Administrateur | `admin@scolagest.ci` | `admin123` | Dashboard staff (toutes les vues) |
| Caissier(ère) | `caissier@scolagest.ci` | `caissier123` | Dashboard staff (caisse) |
| Comptable | `comptable@scolagest.ci` | `comptable123` | Dashboard staff (comptabilité) |
| Direction | `direction@scolagest.ci` | `direction123` | Dashboard staff (rapports) |
| Censeur | `censeur@scolagest.ci` | `censeur123` | Dashboard staff (cycle) |
| Secrétariat | `secretariat@scolagest.ci` | `secretariat123` | Dashboard staff (élèves) |
| Parent | `parent@scolagest.ci` | `parent123` | Portail parent (2 enfants) |

> ⚠️ **Production** : changez impérativement ces mots de passe et le `JWT_SECRET` après le premier démarrage.

---

## Documentation

- [`docs/data-model.md`](docs/data-model.md) — Modèle de données complet (MCD/MLD, 25 entités, 7 domaines, 11 règles métier, plan de migration SQLite → PostgreSQL)
- Code source commenté (Go + TypeScript)

---

## Roadmap (évolutions futures)

- 📝 Gestion pédagogique (notes, bulletins, emplois du temps)
- 💳 Intégration réelle Mobile Money (Orange Money, MTN, Wave — API production)
- 📱 Envoi réel SMS (passerelle ivoirienne) / Email (SMTP)
- ☁️ Stockage Cloudflare R2 (photos élèves, pièces justificatives)
- 🚀 Déploiement production : Vercel (frontend) + Render (backend) + Neon (PostgreSQL) + R2

---

## 📄 Licence

Projet privé — Freelance Technologies Côte d'Ivoire © 2026
