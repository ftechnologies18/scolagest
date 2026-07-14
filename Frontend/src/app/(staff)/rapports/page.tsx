"use client";

/**
 * ScolaGest — Page rapports (route `/rapports`).
 *
 * Accessible au personnel de caisse et de pilotage : CAISSIER, COMPTABLE,
 * DIRECTION/DIRECTEUR_ETUDES/DIRECTEUR_SUPERVISEUR, SECRETARIAT, EDUCATEUR.
 */

import { RoleGuard } from "@/components/auth/role-guard";
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
      <RapportsView />
    </RoleGuard>
  );
}
