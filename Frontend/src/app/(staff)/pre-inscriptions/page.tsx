"use client";

/**
 * ScolaGest — Page staff « Pré-inscriptions » (route `/pre-inscriptions`).
 *
 * Liste des pré-inscriptions en ligne soumises par les parents, avec
 * validation/rejet par le secrétariat et la direction. Accessible à
 * SECRETARIAT, DIRECTION, DIRECTEUR_ETUDES, DIRECTEUR_SUPERVISEUR.
 *
 * Le composant `PreInscriptionsList` s'occupe de tout : filtres par statut,
 * tableau, dialogs de validation/rejet/détail.
 */

import { RoleGuard } from "@/components/auth/role-guard";
import { PreInscriptionsList } from "@/components/pre-inscription/pre-inscriptions-list";

export default function PreInscriptionsPage() {
  return (
    <RoleGuard
      allow={[
        "SECRETARIAT",
        "DIRECTION",
        "DIRECTEUR_ETUDES",
        "DIRECTEUR_SUPERVISEUR",
      ]}
    >
      <PreInscriptionsList />
    </RoleGuard>
  );
}
