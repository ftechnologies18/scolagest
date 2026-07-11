"use client";

/**
 * ScolaGest — Tableau de bord SaaS (route `/saas/dashboard`).
 *
 * Rend la vue `SaasDashboardView` existante. Le prop `onNavigate` (qui attend
 * un identifiant de vue SaaS) est adapté en navigation URL via `router.push`.
 */

import { useRouter } from "next/navigation";
import SaasDashboardView from "@/components/dashboard/views/view-saas-dashboard";

type SaasViewId =
  | "saas-establishments"
  | "saas-audit"
  | "saas-billing"
  | "saas-support";

const VIEW_TO_PATH: Record<SaasViewId, string> = {
  "saas-establishments": "/saas/establishments",
  "saas-audit": "/saas/audit",
  "saas-billing": "/saas/billing",
  "saas-support": "/saas/support",
};

export default function SaasDashboardPage() {
  const router = useRouter();

  return (
    <SaasDashboardView
      onNavigate={(view) => {
        const path = VIEW_TO_PATH[view];
        if (path) router.push(path);
      }}
    />
  );
}
