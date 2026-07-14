"use client";

/**
 * ScolaGest — Page tableau de bord discipline (route `/discipline`).
 *
 * Rend la vue `DisciplineDashboard` (module Phase B), protégée par un RoleGuard
 * réservé à la direction, aux directeurs, au secrétariat et aux éducateurs
 * (vie scolaire).
 */

import { ShieldAlert } from "lucide-react";
import { RoleGuard } from "@/components/auth/role-guard";
import { ModuleHero } from "@/components/ds/module-hero";
import { DisciplineDashboard } from "@/components/discipline/discipline-dashboard";

const ALLOWED_ROLES = [
  "DIRECTION",
  "DIRECTEUR_ETUDES",
  "DIRECTEUR_SUPERVISEUR",
  "SECRETARIAT",
  "EDUCATEUR",
] as const;

export default function DisciplinePage() {
  return (
    <RoleGuard allow={[...ALLOWED_ROLES]}>
      <ModuleHero
        icon={ShieldAlert}
        title="Discipline"
        subtitle="Tickets d'incidents et suivi disciplinaire"
      />
      <DisciplineDashboard />
    </RoleGuard>
  );
}
