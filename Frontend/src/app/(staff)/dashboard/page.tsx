"use client";

/**
 * ScolaGest — Page d'accueil du tableau de bord staff (route `/dashboard`).
 *
 * Rend la vue `DashboardHome` existante. Le prop `onNavigate` (qui attend un
 * `DashboardViewId`) est adapté en navigation URL : on mappe chaque ID de
 * vue vers son chemin App Router puis on appelle `router.push`.
 */

import { useRouter } from "next/navigation";
import { DashboardHome, type DashboardViewId } from "@/components/dashboard/dashboard-home";

/** Mapping `DashboardViewId` → chemin App Router. */
const VIEW_TO_PATH: Record<DashboardViewId, string> = {
  dashboard: "/dashboard",
  eleves: "/eleves",
  inscription: "/inscription",
  caisse: "/caisse",
  impayes: "/impayes",
  rapports: "/rapports",
  frais: "/frais",
  annees: "/annees",
  utilisateurs: "/utilisateurs",
  effectifs: "/effectifs",
  "passage-masse": "/passage-masse",
  comptabilite: "/comptabilite",
  "mobile-money": "/mobile-money",
  parametres: "/parametres",
  "pre-inscriptions": "/pre-inscriptions",
  enseignants: "/enseignants",
  matieres: "/matieres",
  affectations: "/affectations",
  "pointage-ecran": "/pointage-ecran",
  discipline: "/discipline",
  paie: "/paie",
  "saas-dashboard": "/saas/dashboard",
  "saas-establishments": "/saas/establishments",
  "saas-audit": "/saas/audit",
  "saas-billing": "/saas/billing",
  "saas-support": "/saas/support",
};

export default function DashboardPage() {
  const router = useRouter();

  return (
    <DashboardHome
      onNavigate={(view) => {
        const path = VIEW_TO_PATH[view] ?? "/dashboard";
        router.push(path);
      }}
    />
  );
}
