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
