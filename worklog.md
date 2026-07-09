# ScolaGest — Journal de bord du projet

Projet : Application Web de Gestion & de Caisse Scolaire (ScolaGest)
Tuteur/Assistant : Z.ai Code
Établissement pilote : Collège Privé Le Chandelier — Dabou (Côte d'Ivoire)

## Décisions validées (Phase 0 — Cadrage)

- **Stack** : Backend Go (Gin + GORM) + Frontend Next.js 16 + TypeScript + Tailwind + shadcn/ui
- **Base de données** : SQLite en local (développement), migration vers Neon (PostgreSQL) en production
- **Périmètre V1** : V1 standard du cahier des charges + 4 points de la §3.2 (Mobile Money, SMS/Email relances, Comptabilité générale, Multi-sites) — **hors gestion pédagogique**
- **Devise/Localisation** : Francs CFA (FCFA), interface en français, dates au format ivoirien
- **Architecture communication frontend→backend** : Next.js appelle le backend Go via `?XTransformPort=8080` (gateway Caddy)

## Environnement technique

- Go 1.23.4 installé en espace utilisateur : `/home/z/.local/go`
- PATH configuré dans `/home/z/.bashrc`
- Next.js 16.1.3 sur port 3000 (déjà initialisé)
- Backend Go prévu sur port 8080 dans `/home/z/my-project/backend/`
- Documentation dans `/home/z/my-project/docs/`

## Phasage retenu

- **Phase 0 — Cadrage** : Modèle de données (MCD/MLD) + maquettes (wireframes) + validation ← EN COURS
- Phase 1 — Socle technique : Auth (JWT) + RBAC + layout multi-rôles + seed
- Phase 2 — Gestion élèves : Fiches, matricules, cycles/classes, catégories, tuteurs
- Phase 3 — Module de caisse : Frais, échéanciers, encaissement, reçus PDF, soldes, dérogations
- Phase 4 — Rapports & tableaux de bord : Statistiques, exports, relances
- Phase 5 — Modules avancés : Compta générale, Mobile Money, SMS/Email, multi-sites
- Phase 6 — Portail parents


---
Task ID: 2
Agent: frontend-styling-expert
Task: Create wireframe/mockup components for all V1 screens of ScolaGest

Work Log:
- Read worklog.md and explored the project (Next.js 16 + TS + Tailwind 4 + shadcn/ui). Verified available UI primitives (Card, Button, Table, Tabs, Select, etc.) and the eslint config (relaxed rules, no `no-explicit-any`/`no-unused-vars`).
- Confirmed the color restriction: no indigo/blue. Adopted **emerald (école/finance)** as primary and **amber** for annotations/alerts via explicit Tailwind classes — globals.css was NOT modified (only files under `src/components/wireframes/` were created, per instructions).
- Created a shared design system `wf-shared.tsx`: `MockAppShell` (sidebar with grouped nav + establishment selector + user card, topbar with search/notifications/avatar), `AnnotationBadge` (tones: amber/emerald/rose/slate for "V1 étendu", "Multi-sites", etc.), `PrimaryButton`/`AccentButton` (emerald/amber themed), `KpiCard`, `MiniBars`, `MiniDonut`, `StaticSelect`, `PageHeader`, `FieldRow`.
- Created `wireframe-frame.tsx` — the browser-chrome wrapper (traffic-light dots, fake URL bar, back/forward/refresh icons, title + description above the framed screen).
- Created 17 screen wireframes (all static, realistic French placeholder data: "Kouassi Jean", "Aminata Traoré", "60 000 FCFA", "6e A", "Terminale D", etc.):
  - wf-login (brand panel + establishment selector + email/password + role hint chips)
  - wf-dashboard (4 KPI cards, bar chart par cycle, donut par mode, recent payments table)
  - wf-students-list (multi-criteria search, filterable table, badges catégorie/statut, pagination)
  - wf-student-detail (identity card, tuteur, solde summary, payment history, documents)
  - wf-student-form (photo, catégorie toggle affecté/non-affecté, matricule MEN/interne, cycle/classe, tuteur, dérogation 3 tranches)
  - wf-fees-config (grille par classe, inscription par catégorie, scolarité 5/4 tranches, examen, échéancier editor)
  - wf-payment-entry (student search, selected student card with solde, motif, montant, mode espèces/Momo/chèque, live solde preview, Encaisser)
  - wf-receipt (numbered receipt with QR placeholder, solde restant, print/download)
  - wf-outstanding (KPIs, retards table, SMS/Email actions, bordereau de relance) — V1 étendu
  - wf-reports (filter panel, synthèse par cycle, exports PDF/Excel, chart placeholder)
  - wf-cash-closure (récap par caissier, total théorique vs remis, écart, validation)
  - wf-accounting (Tabs: Journal / Plan comptable / Grand livre / Bilan) — V1 étendu
  - wf-mobile-money (providers Orange/MTN/Wave, transactions, webhooks, réconciliation) — V1 étendu
  - wf-parent-portal (dedicated parent shell, children cards, échéances, payment history, downloadable receipts)
  - wf-user-management (users table, role badges, multi-sites scoping, permissions matrix)
  - wf-school-years (exercices list, create with reprise des paramètres, réinscription/passage, archive)
  - wf-settings (Tabs: Établissements / Cycles&Classes tree / Providers SMS+Momo / Audit log)
- Created `wireframes-index.tsx` — renders ALL wireframes grouped into 8 Tabs categories (Authentification, Tableau de bord & élèves, Caisse & paiements, Configuration & frais, Rapports & comptabilité, Modules avancés, Portail parent, Administration) with a Phase-0 header, legend, and amber notice explaining the static nature of the mockups.
- Fixed an issue where `wf-cash-closure.tsx` was accidentally written to `src/components/` instead of `src/components/wireframes/` — moved it to the correct directory.
- Ran `bun run lint` (clean) and `bunx tsc --noEmit` (no errors in `src/components/wireframes/**`; only pre-existing unrelated errors in `examples/` and `skills/` which are in the eslint ignore list).

Stage Summary:
- 20 files created under `/home/z/my-project/src/components/wireframes/`: `wireframe-frame.tsx`, `wf-shared.tsx`, `wireframes-index.tsx`, and 17 `wf-*.tsx` screen mockups.
- Design system: emerald primary + amber accents, no blue/indigo anywhere. All wireframes use real shadcn/ui components (Card, Button, Input, Table, Tabs, Select, Badge, Switch, RadioGroup, Checkbox, Avatar, Separator, Textarea) plus Lucide icons.
- A reusable `MockAppShell` (admin/staff) and a dedicated parent layout give each screen a realistic, app-like frame; `WireframeFrame` adds the browser-chrome look for the validation page.
- Annotation badges (`V1 étendu`, `Multi-sites`, `RBAC`, `Mobile Money`) mark extended-scope features.
- `src/app/page.tsx` was NOT modified; the lead agent can drop `<WireframesIndex />` into the page to present all mockups for Phase 0 validation.
- `bun run lint` passes with zero warnings/errors on the new code.

---
Task ID: 1
Agent: Z.ai Code (tuteur principal)
Task: Concevoir et rédiger le modèle de données MCD/MLD de ScolaGest (V1 étendu)

Work Log:
- Analyse complète du §6 du cahier des charges (esquisse du modèle) et des règles métier §5
- Conception de 25 entités réparties en 7 domaines fonctionnels (référentiel/multi-sites, élèves/tuteurs, facturation, caisse/paiements, utilisateurs/sécurité, communication, comptabilité)
- Extension du modèle pour couvrir les 4 points ex-§3.2 : TransactionMobileMoney + ProviderPaiementConfig (Mobile Money), TemplateMessage + EnvoiMessage (SMS/Email relances), ExerciceComptable + CompteComptable + JournalComptable + EcritureComptable + LigneEcriture (compta générale partie double), Etablissement + EtablissementAccess (multi-sites RBAC)
- Formalisation des règles métier clés (catégorie NON_APPLICABLE pour préscolaire/primaire, matricule MEN vs identifiant interne, dérogation sociale 3 tranches pour affectés, contrôle solde, clôture caisse, partie double comptable)
- Définition des index recommandés et du plan de migration SQLite→PostgreSQL/Neon
- Rédaction du document docs/data-model.md

Stage Summary:
- Livrable : docs/data-model.md (modèle de données complet, ~25 entités, 7 domaines, 11 règles métier, index, plan migration)
- Décisions clés : catégories via ENUM (NON_APPLICABLE pour cycles sans affectation), rôles via ENUM (simplification V1), frais annexes réutilisant la table Frais, échéancier dérogatoire via Echeance.eleve_id nullable
- En attente de validation utilisateur avant démarrage Phase 1

---
Task ID: 3
Agent: Z.ai Code (tuteur principal)
Task: Assembler la page de présentation Phase 0 sur la route /

Work Log:
- Création du composant src/components/phase0/data-model-overview.tsx (visualisation des 7 domaines + règles métier)
- Réécriture de src/app/page.tsx : layout flex (min-h-screen) avec header sticky, 5 onglets (Vue d'ensemble, Modèle de données, Maquettes, Architecture, Planning), footer sticky
- Mise à jour du layout.tsx : métadonnées ScolaGest en français, lang="fr"
- Intégration du composant WireframesIndex (17 maquettes du sous-agent Task 2)
- Correction lint (commentaire JSX échappé)
- `bun run lint` : propre, 0 erreur

Stage Summary:
- Page / opérationnelle : 5 onglets + 8 sous-onglets maquettes, tous navigables
- Vérification agent-browser : page charge sans erreur, tabs interactifs, footer correct, aucune erreur console
- Captures d'écran sauvegardées dans tool-results/ (overview, model, wireframes, archi, planning)

---
Task ID: 4
Agent: Z.ai Code (tuteur principal)
Task: Vérification navigateur (agent-browser) de la page Phase 0

Work Log:
- agent-browser open http://localhost:3000 : page charge, titre "ScolaGest — Gestion & Caisse Scolaire"
- Vérification des 5 onglets principaux via clics successifs : tous fonctionnels
- Vérification des 8 sous-onglets de maquettes : Authentification(1), Tableau de bord & élèves(4), Caisse & paiements(3), Configuration & frais(3), Rapports & comptabilité(2), Modules avancés(2), Portail parent(1), Administration(1)
- Vérification footer : poussé naturellement en bas (layout flex min-h-screen + flex-1 + mt-auto)
- Contrôle console/errors : aucun (seulement React DevTools info + HMR normaux)
- Contrôle dev.log : GET / 200, aucune erreur de compilation

Stage Summary:
- Phase 0 validée côté navigateur : la page est interactive et sans défaut
- Prête pour présentation à l'utilisateur et validation des livrables avant Phase 1

---
Task ID: 4
Agent: frontend-styling-expert
Task: Build frontend auth + dashboard layout + API client for Phase 1

Work Log:
- Read worklog.md (Phase 0 validée) and inspected the existing project: Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui. Confirmed that `zustand@5` is already in package.json (no install needed).
- Verified shadcn primitives available in `src/components/ui/` (button, card, input, label, select, sheet, dropdown-menu, avatar, separator, badge, collapsible, scroll-area, etc.) and the relaxed ESLint config.
- Created `src/lib/api-client.ts`:
  - Constant `API_TRANSFORM_PORT = "8080"`.
  - Helper `withTransformPort(path)` that appends `?XTransformPort=8080` (or `&XTransformPort=8080` if path already has a query).
  - `request<T>()` core function that auto-attaches `Authorization: Bearer <accessToken>` from the auth store, handles JSON serialization, parses JSON/text responses, throws a typed `ApiError` (with `status` + `body`).
  - 401 handling: tries `useAuthStore.getState().refresh()` once, then retries the original request; on refresh failure calls `logout()` and throws.
  - Exports `apiGet<T>`, `apiPost<T>`, `apiPut<T>`, `apiDelete<T>`, plus `buildApiUrl` and `ApiError`.
  - Options supported per call: `skipAuth` (no Authorization header), `skipRefresh` (avoid infinite refresh loop).
- Created `src/lib/auth-store.ts` (Zustand + persist middleware):
  - State: `accessToken`, `refreshToken`, `user`, `etablissement`, `role`, `isLoading` (init true), `isAuthenticated` (derived), `hydrated`.
  - Actions: `login(email, password, etablissementId?)` calls POST /api/auth/login (skipAuth) and stores tokens; `logout()` calls POST /api/auth/logout then clears; `refresh()` calls POST /api/auth/refresh (skipAuth + skipRefresh) and rotates tokens; `fetchMe()` calls GET /api/auth/me to rehydrate profile after a page reload; `setEtablissement()`, `setHydrated()`, `stopLoading()`.
  - Persistence: localStorage key `scolagest-auth` via `createJSONStorage`, `partialize` keeps only tokens + user + etab + role (not transient flags). SSR-safe fallback when `window` is undefined. `onRehydrateStorage` recomputes `isAuthenticated` and marks `hydrated=true`.
- Created `src/components/auth/login-form.tsx`:
  - Full-screen centered card on a gradient `from-emerald-50 via-background to-amber-50` background (no indigo/blue anywhere) with two decorative blurred blobs.
  - Logo: GraduationCap in an emerald-600 rounded square.
  - Fields: email, password (with show/hide eye toggle), establishment Select populated from GET /api/etablissements (loaded on mount, fails silently to "Tous établissements").
  - Submit button uses emerald-600 with Loader2 spinner during submission. Toast (via `useToast`) on success and on error (with ApiError-specific 401 message).
  - Collapsible "Identifiants de démonstration" box (amber-toned) listing the 6 demo accounts; clicking one auto-fills email + password.
- Created `src/components/dashboard/views/placeholder.tsx`:
  - Shared `PlaceholderView` component used by all 10 nav view placeholders: title + icon, phase badge, dashed-border "Module en cours de développement" card with bullet list of features.
- Created 10 placeholder view components (all default exports, `use client`):
  - `view-eleves.tsx` (Phase 2), `view-caisse.tsx` (Phase 3, amber accent), `view-impayes.tsx` (Phase 4, amber), `view-rapports.tsx` (Phase 4), `view-frais.tsx` (Phase 3), `view-annees.tsx` (Phase 2), `view-utilisateurs.tsx` (Phase 1), `view-comptabilite.tsx` (Phase 5), `view-mobile-money.tsx` (Phase 5, amber), `view-parametres.tsx` (Phase 1).
- Created `src/components/dashboard/dashboard-home.tsx`:
  - Welcome card (gradient emerald) with greeting based on time-of-day, user initials avatar (emerald), user name + role badge + establishment badge, current date in French, current school year.
  - 4 KPI cards (Total encaissé, Total attendu, Taux de recouvrement, Impayés) with placeholder FCFA values + a "Données de démonstration — Phase 2" badge.
  - "Actions rapides" section with 4 buttons (Nouvel élève, Nouvel encaissement, Voir impayés, Clôturer caisse) that call an `onNavigate(view)` prop to switch views.
  - "Statut du système" card that pings GET /api/health (skipAuth) on mount and displays status/version/env with loading + error states.
  - Exports `DashboardViewId` type for reuse by the layout.
- Created `src/components/dashboard/dashboard-layout.tsx`:
  - Exports `NAV_GROUPS` array (3 groups: Pilotage, Configuration, Modules avancés) with `roles?: Role[]` restrictions on each item, and `ViewId` type.
  - RBAC rules: Utilisateurs = ADMINISTRATEUR only; Paramètres = ADMINISTRATEUR only; Caisse = CAISSIER/ADMINISTRATEUR/COMPTABLE; Impayés = CAISSIER/ADMINISTRATEUR/COMPTABLE/DIRECTION; Mobile Money = ADMINISTRATEUR; Frais/Années = ADMINISTRATEUR/DIRECTION; Comptabilité = COMPTABLE/ADMINISTRATEUR; Tableau de bord/Élèves/Rapports = open to most roles.
  - Sidebar (desktop persistent, mobile via shadcn Sheet): logo header, establishment selector (Select), ScrollArea with grouped nav (active item highlighted emerald-600 white), user card at bottom.
  - Topbar: hamburger (mobile only), page title (derived from active nav), search Input (placeholder, non-functional), notification Bell with amber dot, user DropdownMenu (avatar + name + role + email + Déconnexion item with destructive variant).
  - Main area renders the active view based on `useState<ViewId>("dashboard")` and a switch on the 11 view IDs.
  - Footer at the bottom of the main scroll area ("Phase 1 — Socle technique · Collège Privé Le Chandelier, Dabou").
  - `handleLogout` calls the auth store's `logout` and shows a confirmation toast.
  - Safety effect: if the user's role changes and the active view becomes invisible, fallback to "dashboard".
- Rewrote `src/app/page.tsx`:
  - "use client" component that selects between three states from the auth store:
    1. `isLoading` → centered spinner page with ScolaGest logo on the same emerald→amber gradient.
    2. `!isAuthenticated` → `<LoginForm />`.
    3. `isAuthenticated` → `<DashboardLayout />`.
  - `useEffect` on mount: if a token exists (persisted), call `fetchMe()` to validate; otherwise `stopLoading()`. This handles SSR → client rehydration correctly (the persist middleware rehydrates from localStorage before the effect runs).
- Verified everything compiles and runs:
  - `bun run lint` → 0 errors, 0 warnings.
  - `bunx tsc --noEmit` → 0 errors on new code (only pre-existing errors in `examples/` and `skills/`, which are in the ESLint ignore list).
  - Dev server (`bunx next dev -p 3000 -H 0.0.0.0`) compiled successfully and served GET / with HTTP 200. The dev log shows `GET /api/etablissements?XTransformPort=8080 404` — confirming the LoginForm rendered client-side and the API client correctly appended `?XTransformPort=8080` to the call (the 404 is expected because the Go backend isn't running yet).
  - Visual verification via agent-browser was blocked by the sandbox gateway (port 81 returns the Z.ai "waiting" placeholder because the dev server runs in a separate network namespace), but the dev.log 200 responses confirm the page renders without errors.

Stage Summary:
- Files created (16) + 1 rewritten:
  - `src/lib/api-client.ts` — fetch wrapper with XTransformPort, Authorization, 401→refresh, typed `ApiError`, exports `apiGet/apiPost/apiPut/apiDelete/buildApiUrl/ApiError/API_TRANSFORM_PORT`.
  - `src/lib/auth-store.ts` — Zustand + persist auth store (tokens, user, etablissement, role, isLoading, isAuthenticated, hydrated + actions login/logout/refresh/fetchMe/setEtablissement/setHydrated/stopLoading). localStorage key `scolagest-auth`. SSR-safe.
  - `src/components/auth/login-form.tsx` — full-screen login card, emerald/amber gradient, demo credentials collapsible.
  - `src/components/dashboard/dashboard-home.tsx` — welcome card, 4 KPIs (placeholder Phase 2), 4 quick-action buttons, health-check card.
  - `src/components/dashboard/dashboard-layout.tsx` — sidebar (Sheet on mobile), topbar (search + bell + user menu), main view switch, footer, exports `NAV_GROUPS` + `ViewId`.
  - `src/components/dashboard/views/placeholder.tsx` — shared `PlaceholderView` helper.
  - 10 view files: `view-eleves.tsx`, `view-caisse.tsx`, `view-impayes.tsx`, `view-rapports.tsx`, `view-frais.tsx`, `view-annees.tsx`, `view-utilisateurs.tsx`, `view-comptabilite.tsx`, `view-mobile-money.tsx`, `view-parametres.tsx`.
  - `src/app/page.tsx` — rewritten to be auth-aware (loading spinner → LoginForm → DashboardLayout).
- Key decisions:
  - Circular import between `api-client.ts` (reads `useAuthStore.getState()`) and `auth-store.ts` (calls `apiGet/apiPost`) is safe because the references are inside function bodies, not at module top-level, so both modules fully load before either is invoked.
  - The `isAuthenticated` field is recomputed in every auth action and after `onRehydrateStorage`, ensuring the page.tsx selector stays in sync without needing a derived getter.
  - All emerald/amber styling uses explicit Tailwind classes (e.g. `bg-emerald-600`, `border-amber-200`) — `globals.css` was NOT modified, keeping the default shadcn neutral `--primary` for the design system while the app's brand color is layered on top.
  - Login form uses `skipAuth: true` for the `/api/etablissements` and `/api/auth/login` calls (no token yet); the api-client still appends `?XTransformPort=8080` in both cases.
  - `DashboardViewId` is exported from `dashboard-home.tsx` and re-exported as `ViewId` from `dashboard-layout.tsx` for type-safety in the nav config and the `onNavigate` callback.
- `src/components/wireframes/` (Phase 0 mockups) and `src/components/phase0/` (Phase 0 overview) were NOT touched, per instructions.
- `bun run lint` and `bunx tsc --noEmit` both pass on all new files. The Next.js dev server compiled and served HTTP 200 on `/`, with the LoginForm correctly issuing a `/api/etablissements?XTransformPort=8080` request (404 expected — Go backend still being built in parallel).

---
Task ID: 1
Agent: Z.ai Code (tuteur principal)
Task: Phase 1 - Backend Go fondation (dépendances, config, DB, 25 modèles GORM)

Work Log:
- Installation Go 1.23.4 (espace utilisateur /home/z/.local/go), config PATH
- Dépendances : Gin, GORM, glebarez/sqlite (pure Go, pas de CGO), golang-jwt/v5, bcrypt, uuid, godotenv
- Structure backend : cmd/server/, internal/{config,database,models,services,handlers,middleware,utils,seed}
- config/config.go : chargement env (PORT, DB_PATH, JWT_SECRET, durées tokens)
- database/database.go : connexion SQLite + AutoMigrate 25 tables (foreign_keys ON, WAL mode)
- models/ : 25 entités en 9 fichiers (base, enums, referentiel, eleves, facturation, caisse, utilisateurs, communication, comptabilite, notification)
- Types ENUM Go typés (CategorieEleve, TypeFrais, ModePaiement, RoleUtilisateur, etc.)

Stage Summary:
- Backend compile (go build ./cmd/server/ → 0 erreur)
- 25 tables créées via AutoMigrate, contraintes FK actives
- UUID auto-générés via gorm hook BeforeCreate

---
Task ID: 2
Agent: Z.ai Code (tuteur principal)
Task: Phase 1 - Backend Auth JWT + RBAC middleware

Work Log:
- utils/password.go : hash/verify bcrypt
- services/jwt_service.go : génération access/refresh tokens (HS256), validation, hash SHA-256 pour stockage
- services/auth_service.go : Login (vérif password, détermination rôle effectif via EtablissementAccess, persistance sessions, audit), Refresh (rotation tokens), Logout (révocation), GetMe
- middleware/auth.go : AuthMiddleware (validation JWT, injection contexte user_id/role/etablissement_id), RequireRole (RBAC), RequireEtablissement
- middleware/cors.go : CORS pour frontend Next.js (port 3000)
- handlers/auth.go : endpoints POST /api/auth/login, POST /api/auth/refresh, POST /api/auth/logout, GET /api/auth/me
- handlers/etablissement.go : GET /api/etablissements, GET /api/etablissements/:id
- handlers/health.go : GET /api/health

Stage Summary:
- Auth complète : JWT access (1h) + refresh (7j), sessions persistées en DB, révocation au logout
- RBAC : rôle effectif par établissement (EtablissementAccess), super-admin global
- Audit : journalisation login/logout
- Tests curl : login admin ✓, /me ✓, mauvais password → 401 ✓, login caissier (rôle + établissement auto) ✓

---
Task ID: 3
Agent: Z.ai Code (tuteur principal)
Task: Phase 1 - Backend Seed + main.go + instrumentation

Work Log:
- seed/seed.go : données démo idempotentes
  - 2 établissements (Collège Le Chandelier 013062 avec catégorie affecté, EPV 0103105091 sans catégorie)
  - 1 année scolaire active (2026-2027)
  - 4 cycles (préscolaire, primaire, collège, lycée) + classes (PS/MS/GS, CP1-CM2, 6e-3e, 2nde-Terminale)
  - 6 utilisateurs (un par rôle) avec accès établissements + mots de passe hashés
- cmd/server/main.go : assemblage config → DB → seed → services → handlers → router Gin → CORS → routes → start
- src/instrumentation.ts : hook Next.js qui démarre le backend Go au démarrage du dev server (runtime nodejs, build auto si sources modifiées, redémarrage auto si crash)
- .env backend configuré

Stage Summary:
- Backend démarré via instrumentation Next.js (persistance liée au dev server)
- Seed : 2 établissements, 4 cycles, ~20 classes, 6 utilisateurs (admin/caissier/comptable/direction/censeur/secretariat)
- Comptes démo : admin@scolagest.ci/admin123, caissier@scolagest.ci/caissier123, etc.

---
Task ID: 5
Agent: Z.ai Code (tuteur principal)
Task: Phase 1 - Intégration + vérification navigateur E2E

Work Log:
- Vérification API backend (curl) : health ✓, etablissements (2) ✓, login admin ✓ (JWT), /me ✓ (rôle ADMINISTRATEUR), mauvais password → 401 ✓
- Vérification API via gateway (port 81 + XTransformPort=8080) : login ✓ (routage Caddy correct)
- Test navigateur (agent-browser via port 81) :
  - Page de login affichée (email, password, sélecteur établissement, identifiants démo) ✓
  - Login admin → dashboard avec 11 sections nav, KPIs, actions rapides, toast "Connexion réussie" ✓
  - Navigation entre vues (Élèves, Caisse, Utilisateurs) ✓ (screenshots)
  - RBAC caissier : ne voit que 4 sections (Tableau de bord, Élèves, Caisse, Impayés & relances) — pas Utilisateurs/Paramètres/Comptabilité ✓
  - Responsive mobile (375x812) ✓
  - Aucune erreur console ✓
- Point mineur : sélecteur du menu utilisateur (logout) complexe à automatiser — fonctionne en clic réel mais le name accessible est verbeux

Stage Summary:
- Phase 1 VALIDÉE end-to-end : backend Go + frontend Next.js + gateway Caddy + RBAC
- 6 comptes démo fonctionnels, navigation role-based, API sécurisée JWT
- Captures : p1-login.png, p1-dashboard.png, p1-view-eleves.png, p1-view-caisse.png, p1-view-users.png, p1-caissier-rbac.png, p1-mobile.png
