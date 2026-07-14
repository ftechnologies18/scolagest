"use client";

/**
 * ScolaGest — Page paie enseignants (route `/paie`).
 *
 * Rend la vue `PaieDashboard` (module Phase C), protégée par un RoleGuard
 * réservé à la direction et aux directeurs (études / superviseur).
 */

import { RoleGuard } from "@/components/auth/role-guard";
import { PaieDashboard } from "@/components/paie/paie-dashboard";

const ALLOWED_ROLES = [
  "DIRECTION",
  "DIRECTEUR_ETUDES",
  "DIRECTEUR_SUPERVISEUR",
] as const;

export default function PaiePage() {
  return (
    <RoleGuard allow={[...ALLOWED_ROLES]}>
      <PaieDashboard />
    </RoleGuard>
  );
}
