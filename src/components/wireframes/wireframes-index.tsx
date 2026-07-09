import type { ReactNode } from "react"
import { GraduationCap, Sparkles, Info } from "lucide-react"
import { WireframeFrame } from "./wireframe-frame"
import { AnnotationBadge } from "./wf-shared"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import { WfLogin } from "./wf-login"
import { WfDashboard } from "./wf-dashboard"
import { WfStudentsList } from "./wf-students-list"
import { WfStudentDetail } from "./wf-student-detail"
import { WfStudentForm } from "./wf-student-form"
import { WfPaymentEntry } from "./wf-payment-entry"
import { WfReceipt } from "./wf-receipt"
import { WfCashClosure } from "./wf-cash-closure"
import { WfFeesConfig } from "./wf-fees-config"
import { WfSchoolYears } from "./wf-school-years"
import { WfSettings } from "./wf-settings"
import { WfReports } from "./wf-reports"
import { WfAccounting } from "./wf-accounting"
import { WfMobileMoney } from "./wf-mobile-money"
import { WfOutstanding } from "./wf-outstanding"
import { WfParentPortal } from "./wf-parent-portal"
import { WfUserManagement } from "./wf-user-management"

type FrameDef = {
  title: string
  description: string
  url?: string
  node: ReactNode
}

const groups: { id: string; label: string; frames: FrameDef[] }[] = [
  {
    id: "auth",
    label: "Authentification",
    frames: [
      {
        title: "Connexion",
        description:
          "Sélecteur d’établissement, e-mail/mot de passe, rôle indicatif.",
        url: "https://scolagest.ci/login",
        node: <WfLogin />,
      },
    ],
  },
  {
    id: "dash",
    label: "Tableau de bord & élèves",
    frames: [
      {
        title: "Tableau de bord",
        description:
          "KPIs (encaissé, attendu, taux de recouvrement, impayés), graphique par cycle, paiements récents.",
        url: "https://scolagest.ci/dashboard",
        node: <WfDashboard />,
      },
      {
        title: "Liste des élèves",
        description:
          "Recherche multi-critères (nom, matricule, classe, catégorie, statut), tableau filtrable, actions.",
        url: "https://scolagest.ci/eleves",
        node: <WfStudentsList />,
      },
      {
        title: "Fiche élève",
        description:
          "Identité, matricule, catégorie, tuteur, solde, historique de paiements, documents.",
        url: "https://scolagest.ci/eleves/CI-00245-MEN",
        node: <WfStudentDetail />,
      },
      {
        title: "Création / édition d’élève",
        description:
          "Identité, matricule MEN ou interne provisoire, toggle catégorie, cycle/classe, tuteur, dérogation 3 tranches.",
        url: "https://scolagest.ci/eleves/nouveau",
        node: <WfStudentForm />,
      },
    ],
  },
  {
    id: "cash",
    label: "Caisse & paiements",
    frames: [
      {
        title: "Encaissement (caisse)",
        description:
          "Recherche élève, motif, montant avec contrôle de solde, mode de paiement, aperçu live.",
        url: "https://scolagest.ci/caisse/encaisser",
        node: <WfPaymentEntry />,
      },
      {
        title: "Reçu de caisse",
        description:
          "Reçu numéroté : élève, matricule, motif, montant, mode, caissier, date/heure, solde restant, QR de vérification.",
        url: "https://scolagest.ci/reces/REC-2025-00185",
        node: <WfReceipt />,
      },
      {
        title: "Clôture de caisse journalière",
        description:
          "Récapitulatif par caissier, total théorique vs remis, écart, validation et verrouillage.",
        url: "https://scolagest.ci/caisse/cloture",
        node: <WfCashClosure />,
      },
    ],
  },
  {
    id: "config",
    label: "Configuration & frais",
    frames: [
      {
        title: "Frais & échéanciers",
        description:
          "Grille par année/cycle/classe, inscription (variantes catégorie), scolarité 5 ou 4 tranches, examen, éditeur d’échéancier.",
        url: "https://scolagest.ci/configuration/frais",
        node: <WfFeesConfig />,
      },
      {
        title: "Années scolaires",
        description:
          "Liste des exercices, création avec reprise des paramètres, réinscription/passage, archivage.",
        url: "https://scolagest.ci/configuration/annees",
        node: <WfSchoolYears />,
      },
      {
        title: "Paramètres généraux",
        description:
          "Établissements multi-sites, arborescence cycles/classes, providers SMS/Momo, journal d’audit.",
        url: "https://scolagest.ci/configuration",
        node: <WfSettings />,
      },
    ],
  },
  {
    id: "reports",
    label: "Rapports & comptabilité",
    frames: [
      {
        title: "Rapports & exports",
        description:
          "Filtres (période, cycle, classe, catégorie, mode, caissier), synthèse, exports PDF/Excel, graphiques.",
        url: "https://scolagest.ci/rapports",
        node: <WfReports />,
      },
      {
        title: "Comptabilité générale",
        description:
          "Plan comptable, journal des écritures, grand livre, bilan résumé, sélecteur d’exercice.",
        url: "https://scolagest.ci/comptabilite",
        node: <WfAccounting />,
      },
    ],
  },
  {
    id: "advanced",
    label: "Modules avancés",
    frames: [
      {
        title: "Mobile Money",
        description:
          "Providers Orange/MTN/Wave, transactions, journal webhooks, réconciliation automatique.",
        url: "https://scolagest.ci/momo",
        node: <WfMobileMoney />,
      },
      {
        title: "Impayés & relances",
        description:
          "Liste des retards, filtres par échéance, bordereau de relance, envoi SMS/Email.",
        url: "https://scolagest.ci/impayes",
        node: <WfOutstanding />,
      },
    ],
  },
  {
    id: "parent",
    label: "Portail parent",
    frames: [
      {
        title: "Espace parent",
        description:
          "Liste des enfants avec solde, paiements, reçus téléchargeables, échéances à venir.",
        url: "https://scolagest.ci/parent",
        node: <WfParentPortal />,
      },
    ],
  },
  {
    id: "admin",
    label: "Administration",
    frames: [
      {
        title: "Utilisateurs & rôles (RBAC)",
        description:
          "Table des utilisateurs, assignation des rôles, périmètre par établissement, matrice de permissions.",
        url: "https://scolagest.ci/admin/utilisateurs",
        node: <WfUserManagement />,
      },
    ],
  },
]

export function WireframesIndex() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="overflow-hidden border-emerald-200">
        <div className="flex flex-col gap-4 bg-gradient-to-br from-emerald-700 to-emerald-900 p-6 text-white md:flex-row md:items-center">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <GraduationCap className="size-8" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">ScolaGest — Phase 0 · Wireframes</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold uppercase">
                <Sparkles className="size-3" /> Pour validation
              </span>
            </div>
            <p className="mt-1 max-w-3xl text-sm text-emerald-100">
              Maquettes statiques des écrans du périmètre V1 (standard + 4
              points étendus : Mobile Money, SMS/Email relances, Comptabilité
              générale, Multi-sites). Établissement pilote : Collège Privé Le
              Chandelier, Dabou. Devise : FCFA, interface en français.
            </p>
          </div>
        </div>
        <CardContent className="grid gap-3 pt-4 text-xs text-muted-foreground md:grid-cols-3">
          <Legend tone="amber" label="V1 étendu — fonctionnalité hors standard" />
          <Legend tone="emerald" label="Multi-sites / portail / RBAC" />
          <Legend tone="slate" label="Standard V1" />
        </CardContent>
      </Card>

      {/* Notice */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <Info className="mt-0.5 size-4 shrink-0" />
        <div>
          <strong>Ces maquettes sont statiques.</strong> Elles illustrent la
          structure et le contenu attendus de chaque écran. Les couleurs
          principales sont l’émeraude (école/finance) et l’ambre (annotations &
          alertes) — aucun bleu/indigo n’est utilisé. Les données affichées sont
          fictives (Kouassi Jean, Aminata Traoré, montants en FCFA…).
        </div>
      </div>

      {/* Grouped wireframes */}
      <Tabs defaultValue={groups[0].id} className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          {groups.map((g) => (
            <TabsTrigger key={g.id} value={g.id} className="text-xs">
              {g.label}
              <span className="ml-1 rounded-full bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-800">
                {g.frames.length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        {groups.map((g) => (
          <TabsContent key={g.id} value={g.id} className="mt-4">
            <div className="space-y-8">
              {g.frames.map((f) => (
                <WireframeFrame
                  key={f.title}
                  title={f.title}
                  description={f.description}
                  url={f.url}
                >
                  {f.node}
                </WireframeFrame>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function Legend({
  tone,
  label,
}: {
  tone: "amber" | "emerald" | "slate"
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <AnnotationBadge tone={tone}>●</AnnotationBadge>
      <span>{label}</span>
    </div>
  )
}
