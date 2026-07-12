"use client";

/**
 * ScolaGest — Page liste des matières (route `/matieres`).
 *
 * Rend la vue `MatieresList` (module Enseignant — Phase A), protégée par un
 * RoleGuard réservé à la direction, aux directeurs et au secrétariat.
 */

import { RoleGuard } from "@/components/auth/role-guard";
import { MatieresList } from "@/components/enseignants/matieres-list";

const ALLOWED_ROLES = [
  "DIRECTION",
  "DIRECTEUR_ETUDES",
  "DIRECTEUR_SUPERVISEUR",
  "SECRETARIAT",
] as const;

export default function MatieresPage() {
  return (
    <RoleGuard allow={[...ALLOWED_ROLES]}>
      <MatieresList />
    </RoleGuard>
  );
}
