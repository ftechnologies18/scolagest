"use client";

/**
 * ScolaGest — Page d'inscription (route `/inscription`).
 *
 * Rend le wizard d'inscription complet (4 étapes) qui crée en une passe :
 * élève + tuteur + inscription dans une classe pour une année scolaire.
 *
 * Accessible au SECRETARIAT, DIRECTION, DIRECTEUR_ETUDES, DIRECTEUR_SUPERVISEUR.
 * Le caissier et le comptable n'y accèdent pas (ils gèrent la caisse, pas les
 * inscriptions).
 */

import { RoleGuard } from "@/components/auth/role-guard";
import { InscriptionWizard } from "@/components/inscription/inscription-wizard";

export default function InscriptionPage() {
  return (
    <RoleGuard
      allow={["SECRETARIAT", "DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR"]}
    >
      <InscriptionWizard />
    </RoleGuard>
  );
}
