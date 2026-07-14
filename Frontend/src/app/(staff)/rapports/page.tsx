"use client";

/**
 * ScolaGest — Page rapports (route `/rapports`).
 *
 * Accessible au personnel de caisse et de pilotage : CAISSIER, COMPTABLE,
 * DIRECTION/DIRECTEUR_ETUDES/DIRECTEUR_SUPERVISEUR, SECRETARIAT, EDUCATEUR.
 */

import { BarChart3 } from "lucide-react";
import { RoleGuard } from "@/components/auth/role-guard";
import { ModuleHero } from "@/components/ds/module-hero";
import RapportsView from "@/components/dashboard/views/view-rapports";

export default function RapportsPage() {
  return (
    <RoleGuard
      allow={[
        "CAISSIER",
        "COMPTABLE",
        "DIRECTION",
        "DIRECTEUR_ETUDES",
        "DIRECTEUR_SUPERVISEUR",
        "SECRETARIAT",
        "EDUCATEUR",
      ]}
    >
      <ModuleHero
        icon={BarChart3}
        title="Rapports"
        subtitle="Tableaux de bord et exports analytiques"
      />
      <RapportsView />
    </RoleGuard>
  );
}
