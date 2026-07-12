"use client";

/**
 * ScolaGest — Page tableau de bord discipline (route `/discipline`).
 *
 * Rend la vue `DisciplineDashboard` (module Phase B), protégée par un RoleGuard
 * réservé à la direction, aux directeurs et au secrétariat.
 */

import { RoleGuard } from "@/components/auth/role-guard";
import { DisciplineDashboard } from "@/components/discipline/discipline-dashboard";

const ALLOWED_ROLES = [
  "DIRECTION",
  "DIRECTEUR_ETUDES",
  "DIRECTEUR_SUPERVISEUR",
  "SECRETARIAT",
] as const;

export default function DisciplinePage() {
  return (
    <RoleGuard allow={[...ALLOWED_ROLES]}>
      <DisciplineDashboard />
    </RoleGuard>
  );
}
