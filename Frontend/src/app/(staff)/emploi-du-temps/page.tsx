"use client";

/**
 * ScolaGest — Page emploi du temps (route `/emploi-du-temps`).
 *
 * Rend la vue `EmploiTempsDashboard` (module Phase A étendue), protégée par un
 * RoleGuard réservé à la direction, aux directeurs (études / superviseur) et
 * au secrétariat.
 */

import { RoleGuard } from "@/components/auth/role-guard";
import { EmploiTempsDashboard } from "@/components/emploi-temps/emploi-temps-dashboard";

const ALLOWED_ROLES = [
  "DIRECTION",
  "DIRECTEUR_ETUDES",
  "DIRECTEUR_SUPERVISEUR",
  "SECRETARIAT",
] as const;

export default function EmploiDuTempsPage() {
  return (
    <RoleGuard allow={[...ALLOWED_ROLES]}>
      <EmploiTempsDashboard />
    </RoleGuard>
  );
}
