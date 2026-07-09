"use client";

import { GraduationCap, CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DataModelOverview } from "@/components/phase0/data-model-overview";
import { WireframesIndex } from "@/components/wireframes/wireframes-index";

const STACK = [
  {
    composant: "Frontend",
    techno: "Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui",
    port: "3000",
  },
  {
    composant: "Backend / API",
    techno: "Go — framework Gin + ORM GORM + golang-migrate",
    port: "8080",
  },
  {
    composant: "Base de données (local)",
    techno: "SQLite via GORM (fichier scolagest.db)",
    port: "—",
  },
  {
    composant: "Base de données (prod)",
    techno: "PostgreSQL managé — Neon (serverless, branchable)",
    port: "—",
  },
  {
    composant: "Stockage fichiers",
    techno: "Cloudflare R2 (compatible S3) — URLs signées",
    port: "—",
  },
  {
    composant: "Authentification",
    techno: "JWT (access + refresh), bcrypt/argon2, RBAC multi-établissements",
    port: "—",
  },
  {
    composant: "Communication inter-services",
    techno: "Gateway Caddy — Next.js appelle Go via ?XTransformPort=8080",
    port: "—",
  },
];

const SCOPE_INCLUDED = [
  "Gestion des élèves, tuteurs, cycles/classes/années",
  "Catégories affecté / non-affecté + règles de facturation",
  "Paramétrage des frais et échéanciers (par cycle/année)",
  "Module de caisse : encaissement, reçus, soldes, clôture",
  "Tableaux de bord et rapports (PDF / Excel)",
  "Gestion utilisateurs + RBAC + audit",
  "Stockage fichiers (photos, pièces justificatives)",
  "Portail parents (solde, historique, reçus)",
  "Paiement Mobile Money (Orange/MTN/Wave) — ex-§3.2",
  "Relances SMS / Email automatiques — ex-§3.2",
  "Comptabilité générale (grand livre, bilan) — ex-§3.2",
  "Multi-sites simultanés — ex-§3.2",
];

const SCOPE_EXCLUDED = [
  "Gestion pédagogique (notes, bulletins, emplois du temps)",
];

const PHASES = [
  {
    nom: "Phase 0 — Cadrage",
    duree: "1 à 2 sem.",
    contenu: "Validation du cahier des charges, maquettes, modèle de données",
    statut: "en cours",
  },
  {
    nom: "Phase 1 — Socle technique",
    duree: "2 sem.",
    contenu: "Monorepo, backend Go + Gin + GORM, auth JWT, RBAC, seed données",
    statut: "à venir",
  },
  {
    nom: "Phase 2 — Gestion élèves",
    duree: "2 à 3 sem.",
    contenu: "Fiches élèves, matricules, cycles/classes, catégories, tuteurs",
    statut: "à venir",
  },
  {
    nom: "Phase 3 — Module de caisse",
    duree: "3 à 4 sem.",
    contenu: "Frais, échéanciers, encaissement, reçus PDF, soldes, dérogations",
    statut: "à venir",
  },
  {
    nom: "Phase 4 — Rapports & tableaux de bord",
    duree: "2 sem.",
    contenu: "Statistiques, exports, relances",
    statut: "à venir",
  },
  {
    nom: "Phase 5 — Modules avancés",
    duree: "3 à 4 sem.",
    contenu: "Compta générale, Mobile Money, SMS/Email, multi-sites",
    statut: "à venir",
  },
  {
    nom: "Phase 6 — Portail parents",
    duree: "1 à 2 sem.",
    contenu: "Consultation solde, historique, reçus téléchargeables",
    statut: "à venir",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
              <GraduationCap className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">ScolaGest</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">
                Gestion & Caisse Scolaire — Le Chandelier, Dabou
              </p>
            </div>
          </div>
          <Badge className="bg-amber-500 hover:bg-amber-500 text-white">
            Phase 0 — Cadrage
          </Badge>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6">
        {/* Hero */}
        <section className="mb-8">
          <Card className="overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50 to-background">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col gap-4">
                <Badge
                  variant="outline"
                  className="w-fit border-emerald-400 text-emerald-700"
                >
                  Version 1.0 — Document de travail
                </Badge>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                  Application Web de Gestion &amp; de Caisse Scolaire
                </h2>
                <p className="text-sm md:text-base text-muted-foreground max-w-2xl">
                  Projet de digitalisation du cycle d&apos;encaissement scolaire
                  pour le Groupe Scolaire Le Chandelier (Dabou, Côte
                  d&apos;Ivoire) — du dossier d&apos;inscription de l&apos;élève
                  jusqu&apos;au solde complet de sa scolarité. Cette page
                  présente les livrables de la Phase 0 (cadrage) à valider avant
                  le démarrage du développement.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Badge variant="secondary">Préscolaire · Primaire · Collège · Lycée</Badge>
                  <Badge variant="secondary">Devise : FCFA</Badge>
                  <Badge variant="secondary">Interface : Français</Badge>
                  <Badge variant="secondary">Backend Go · Frontend Next.js</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
            <TabsTrigger value="overview" className="text-xs md:text-sm">
              Vue d&apos;ensemble
            </TabsTrigger>
            <TabsTrigger value="model" className="text-xs md:text-sm">
              Modèle de données
            </TabsTrigger>
            <TabsTrigger value="wireframes" className="text-xs md:text-sm">
              Maquettes
            </TabsTrigger>
            <TabsTrigger value="archi" className="text-xs md:text-sm">
              Architecture
            </TabsTrigger>
            <TabsTrigger value="planning" className="text-xs md:text-sm">
              Planning
            </TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="mt-6 space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    Périmètre inclus (V1)
                  </CardTitle>
                  <CardDescription>
                    V1 standard + 4 points ex-§3.2 du cahier des charges
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {SCOPE_INCLUDED.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-sm"
                      >
                        <CheckCircle2 className="size-4 text-emerald-600 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card className="border-rose-200">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Circle className="size-4 text-rose-500" />
                    Hors périmètre (V1)
                  </CardTitle>
                  <CardDescription>
                    Évolution future possible — non abordée dans cette version
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5">
                    {SCOPE_EXCLUDED.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <Circle className="size-4 text-rose-400 mt-0.5 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-foreground">
                      Acteurs &amp; rôles (RBAC)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "Administrateur",
                        "Caissier(ère)",
                        "Comptable / Direction",
                        "Censeur / Directeur de cycle",
                        "Secrétariat / Scolarité",
                        "Parent / Tuteur",
                      ].map((role) => (
                        <Badge
                          key={role}
                          variant="outline"
                          className="text-[11px]"
                        >
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Établissements du Groupe (multi-sites)
                </CardTitle>
                <CardDescription>
                  Architecture conçue dès la V1 pour représenter fidèlement
                  l&apos;organisation réelle du Groupe
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border p-4">
                    <p className="font-medium text-sm">Collège Privé Le Chandelier</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Collège + Lycée — Code officiel :{" "}
                      <code className="text-[11px]">013062</code>
                    </p>
                    <Badge
                      variant="outline"
                      className="mt-2 text-[11px] border-emerald-300 text-emerald-700"
                    >
                      Distinction affecté / non-affecté active
                    </Badge>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="font-medium text-sm">
                      École Primaire Privée Le Chandelier / EPV
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Préscolaire + Primaire — Imm. :{" "}
                      <code className="text-[11px]">0103105091</code>
                    </p>
                    <Badge
                      variant="outline"
                      className="mt-2 text-[11px] border-amber-300 text-amber-700"
                    >
                      Tarif unique (pas de distinction)
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Data model */}
          <TabsContent value="model" className="mt-6">
            <DataModelOverview />
          </TabsContent>

          {/* Wireframes */}
          <TabsContent value="wireframes" className="mt-6">
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
              <p className="text-sm text-muted-foreground">
                <strong className="text-foreground">Maquettes Phase 0.</strong>{" "}
                Ces wireframes illustrent les écrans prévus en V1. Ils sont
                statiques (données d&apos;illustration) et servent à valider
                l&apos;ergonomie et la couverture fonctionnelle avant le
                développement. Les badges{" "}
                <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-[10px] mx-1">
                  V1 étendu
                </Badge>
                identifient les modules issus de la §3.2.
              </p>
            </div>
            <WireframesIndex />
          </TabsContent>

          {/* Architecture */}
          <TabsContent value="architecture" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Stack technique retenue</CardTitle>
                <CardDescription>
                  Conforme au §7 du cahier des charges, adaptée à
                  l&apos;environnement de développement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2 pr-4 font-medium text-muted-foreground">
                          Composant
                        </th>
                        <th className="py-2 pr-4 font-medium text-muted-foreground">
                          Technologie
                        </th>
                        <th className="py-2 font-medium text-muted-foreground">
                          Port
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {STACK.map((row) => (
                        <tr key={row.composant} className="border-b last:border-0">
                          <td className="py-2.5 pr-4 font-medium">{row.composant}</td>
                          <td className="py-2.5 pr-4 text-muted-foreground">
                            {row.techno}
                          </td>
                          <td className="py-2.5">
                            <code className="text-xs">{row.port}</code>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Organisation du dépôt (monorepo)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="rounded-lg bg-muted p-4 text-xs font-mono overflow-x-auto leading-relaxed">
{`scolagest/
├── src/                      # Frontend Next.js 16 (port 3000)
│   ├── app/                  #   App Router (route / uniquement)
│   ├── components/           #   Composants UI + wireframes
│   └── lib/                  #   Client API Go
├── backend/                  # Backend Go (port 8080)
│   ├── cmd/                  #   Point d'entrée main.go
│   ├── internal/
│   │   ├── config/           #   Config (env, DB)
│   │   ├── handlers/         #   Handlers HTTP (Gin)
│   │   ├── middleware/       #   Auth JWT, RBAC, audit
│   │   ├── models/           #   Modèles GORM (25 entités)
│   │   ├── repositories/     #   Accès données
│   │   ├── services/         #   Logique métier (caisse, compta...)
│   │   └── utils/            #   JWT, hash, PDF, validation
│   └── migrations/           #   Scripts golang-migrate
├── docs/                     # Documentation (data-model.md, ...)
└── package.json              # Next.js (bun)`}
                </pre>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-emerald-50/30">
              <CardHeader>
                <CardTitle className="text-base">
                  Communication frontend → backend
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Le frontend Next.js appelle le backend Go via des URLs
                  relatives avec le paramètre <code className="text-xs">?XTransformPort=8080</code>.
                  Le gateway Caddy route la requête vers le port 8080 (Go) ou
                  3000 (Next.js) selon la présence du paramètre.
                </p>
                <div className="rounded-lg bg-background p-3 font-mono text-xs">
                  <span className="text-muted-foreground">{"// Exemple côté Next.js"}</span>
                  {"\n"}
                  <span className="text-emerald-700">fetch</span>(
                  <span className="text-amber-700">
                    &quot;/api/eleves?XTransformPort=8080&quot;
                  </span>
                  )
                </div>
                <p className="text-xs">
                  En production, le backend Go sera déployé sur Render et le
                  frontend sur Vercel ; le paramètre <code className="text-xs">XTransformPort</code>{" "}
                  sera remplacé par l&apos;URL publique du backend via une
                  variable d&apos;environnement.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Planning */}
          <TabsContent value="planning" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Phasage indicatif du projet
                </CardTitle>
                <CardDescription>
                  Inspiré du §10 du cahier des charges, adapté au périmètre V1
                  étendu
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {PHASES.map((phase) => (
                  <div
                    key={phase.nom}
                    className={`flex items-start gap-3 rounded-lg border p-3 ${
                      phase.statut === "en cours"
                        ? "border-emerald-400 bg-emerald-50/50"
                        : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-sm">{phase.nom}</p>
                        <Badge variant="outline" className="text-[10px]">
                          {phase.duree}
                        </Badge>
                        {phase.statut === "en cours" ? (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white text-[10px]">
                            En cours
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            À venir
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {phase.contenu}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-amber-200 bg-amber-50/30">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowRight className="size-4 text-amber-600" />
                  Points à valider avant la Phase 1
                </CardTitle>
                <CardDescription>
                  Validation des livrables Phase 0 — répondez pour démarrer le
                  développement
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {[
                    "Validation du modèle de données (25 entités, 7 domaines) — voir onglet « Modèle de données »",
                    "Validation des maquettes / wireframes — voir onglet « Maquettes »",
                    "Validation des règles métier (catégorie NON_APPLICABLE, dérogation 3 tranches, partie double)",
                    "Validation de l'architecture multi-établissements (EtablissementAccess)",
                    "Arbitrage : RBAC par rôles ENUM (proposition V1) ou table Permission granulaire ?",
                    "Arbitrage : frais annexes via table Frais (proposition V1) ou entité dédiée ?",
                  ].map((point) => (
                    <li key={point} className="flex items-start gap-2">
                      <Circle className="size-4 text-amber-500 mt-0.5 shrink-0" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer (sticky en bas) */}
      <footer className="mt-auto border-t bg-background">
        <div className="mx-auto max-w-7xl px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>
            ScolaGest · Application de Gestion &amp; Caisse Scolaire — Freelance
            Technologies Côte d&apos;Ivoire
          </p>
          <p className="text-[11px]">
            Phase 0 — Cadrage · Cas d&apos;usage : Collège Privé Le Chandelier,
            Dabou
          </p>
        </div>
      </footer>
    </div>
  );
}
