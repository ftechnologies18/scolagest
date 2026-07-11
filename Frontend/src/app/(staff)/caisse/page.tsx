"use client";

/**
 * ScolaGest — Page caisse (route `/caisse`).
 *
 * Accessible au CAISSIER et au COMPTABLE (encaissement, clôture, reçus).
 * La direction n'y accède pas (le `RoleGuard` bloque l'accès par URL directe).
 */

import { RoleGuard } from "@/components/auth/role-guard";
import CaisseView from "@/components/dashboard/views/view-caisse";

export default function CaissePage() {
  return (
    <RoleGuard allow={["CAISSIER", "COMPTABLE"]}>
      <CaisseView />
    </RoleGuard>
  );
}
