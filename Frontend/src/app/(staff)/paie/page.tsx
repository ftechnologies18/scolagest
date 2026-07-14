"use client";

/**
 * ScolaGest — Page paie enseignants (route `/paie`).
 *
 * Rend la vue `PaieDashboard` (module Phase C), protégée par un RoleGuard
 * réservé à la direction et aux directeurs (études / superviseur).
 */

import { Wallet } from "lucide-react";
import { RoleGuard } from "@/components/auth/role-guard";
import { ModuleHero } from "@/components/ds/module-hero";
import { PaieDashboard } from "@/components/paie/paie-dashboard";

const ALLOWED_ROLES = [
  "DIRECTION",
  "DIRECTEUR_ETUDES",
  "DIRECTEUR_SUPERVISEUR",
] as const;

export default function PaiePage() {
  return (
    <RoleGuard allow={[...ALLOWED_ROLES]}>
      <ModuleHero
        icon={Wallet}
        title="Paie"
        subtitle="Bulletins de paie et avances sur salaire"
      />
      <PaieDashboard />
    </RoleGuard>
  );
}
