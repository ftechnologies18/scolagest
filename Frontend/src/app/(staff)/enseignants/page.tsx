"use client";

/**
 * ScolaGest — Page liste des enseignants (route `/enseignants`).
 *
 * Rend la vue `EnseignantsList` (module Enseignant — Phase A), protégée par
 * un RoleGuard réservé à la direction, aux directeurs et au secrétariat.
 */

import { RoleGuard } from "@/components/auth/role-guard";
import { EnseignantsList } from "@/components/enseignants/enseignants-list";

const ALLOWED_ROLES = [
  "DIRECTION",
  "DIRECTEUR_ETUDES",
  "DIRECTEUR_SUPERVISEUR",
  "SECRETARIAT",
] as const;

export default function EnseignantsPage() {
  return (
    <RoleGuard allow={[...ALLOWED_ROLES]}>
      <EnseignantsList />
    </RoleGuard>
  );
}
