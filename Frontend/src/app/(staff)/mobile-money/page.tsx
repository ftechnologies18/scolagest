"use client";

/**
 * ScolaGest — Page Mobile Money (route `/mobile-money`).
 *
 * Accessible au CAISSIER seul (guichet MoMo : initier, réconcilier des
 * transactions). La direction n'y accède pas.
 */

import { RoleGuard } from "@/components/auth/role-guard";
import MobileMoneyView from "@/components/dashboard/views/view-mobile-money";

export default function MobileMoneyPage() {
  return (
    <RoleGuard allow={["CAISSIER"]}>
      <MobileMoneyView />
    </RoleGuard>
  );
}
