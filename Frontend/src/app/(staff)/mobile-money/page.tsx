"use client";

/**
 * ScolaGest — Page Mobile Money (route `/mobile-money`).
 *
 * Accessible au personnel de caisse et de direction :
 * CAISSIER, DIRECTION, DIRECTEUR_ETUDES, DIRECTEUR_SUPERVISEUR.
 */

import { RoleGuard } from "@/components/auth/role-guard";
import MobileMoneyView from "@/components/dashboard/views/view-mobile-money";

export default function MobileMoneyPage() {
  return (
    <RoleGuard
      allow={[
        "CAISSIER",
        "DIRECTION",
        "DIRECTEUR_ETUDES",
        "DIRECTEUR_SUPERVISEUR",
      ]}
    >
      <MobileMoneyView />
    </RoleGuard>
  );
}
