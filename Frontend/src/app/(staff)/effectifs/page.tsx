"use client";

/**
 * ScolaGest — Page « Effectifs » (route `/effectifs`).
 *
 * Tableau de bord de remplissage des classes : KPIs globaux, tableau détaillé
 * par classe et carte thermique visuelle.
 *
 * Accessible à la DIRECTION et aux DIRECTEUR_* (pilotage de l'établissement).
 * Le caissier, le comptable et le secrétariat n'y accèdent pas.
 */

import { RoleGuard } from "@/components/auth/role-guard";
import { EffectifsDashboard } from "@/components/effectifs/effectifs-dashboard";

export default function EffectifsPage() {
  return (
    <RoleGuard
      allow={["DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR"]}
    >
      <EffectifsDashboard />
    </RoleGuard>
  );
}
