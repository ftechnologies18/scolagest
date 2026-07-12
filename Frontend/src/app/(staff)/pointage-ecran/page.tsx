"use client";

/**
 * ScolaGest — Page écran de pointage temps réel (route `/pointage-ecran`).
 *
 * Rend la vue `EcranPointage` (module Phase B), protégée par un RoleGuard
 * réservé à la direction, aux directeurs et au secrétariat.
 */

import { RoleGuard } from "@/components/auth/role-guard";
import { EcranPointage } from "@/components/pointage/ecran-pointage";

const ALLOWED_ROLES = [
  "DIRECTION",
  "DIRECTEUR_ETUDES",
  "DIRECTEUR_SUPERVISEUR",
  "SECRETARIAT",
] as const;

export default function PointageEcranPage() {
  return (
    <RoleGuard allow={[...ALLOWED_ROLES]}>
      <EcranPointage />
    </RoleGuard>
  );
}
