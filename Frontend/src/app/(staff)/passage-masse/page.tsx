"use client";

/**
 * ScolaGest — Page « Passage de classe en masse » (route `/passage-masse`).
 *
 * Opération de fin d'année : génère un aperçu de l'ensemble des élèves d'une
 * année source, permet d'ajuster individuellement la décision (PROMU,
 * REDOUBLANT, NON_REINSCRIT) puis valide en une passe l'inscription des
 * promus dans l'année cible.
 *
 * Réservé à la DIRECTION et aux DIRECTEUR_* (pilotage établissement).
 * Le caissier, le comptable et le secrétariat n'y accèdent pas.
 */

import { RoleGuard } from "@/components/auth/role-guard";
import { PassageMasseDashboard } from "@/components/passage-masse/passage-masse-dashboard";

export default function PassageMassePage() {
  return (
    <RoleGuard
      allow={["DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR"]}
    >
      <PassageMasseDashboard />
    </RoleGuard>
  );
}
