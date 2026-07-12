"use client";

/**
 * ScolaGest — Page liste des affectations (route `/affectations`).
 *
 * Rend la vue `AffectationsList` (module Enseignant — Phase A), protégée par
 * un RoleGuard réservé à la direction, aux directeurs et au secrétariat.
 */

import { RoleGuard } from "@/components/auth/role-guard";
import { AffectationsList } from "@/components/enseignants/affectations-list";

const ALLOWED_ROLES = [
  "DIRECTION",
  "DIRECTEUR_ETUDES",
  "DIRECTEUR_SUPERVISEUR",
  "SECRETARIAT",
] as const;

export default function AffectationsPage() {
  return (
    <RoleGuard allow={[...ALLOWED_ROLES]}>
      <AffectationsList />
    </RoleGuard>
  );
}
