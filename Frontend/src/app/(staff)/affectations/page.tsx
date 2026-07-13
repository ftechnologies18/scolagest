"use client";

/**
 * ScolaGest — Redirection /affectations → /matieres-affectations?tab=affectations.
 *
 * Ancienne route conservée pour la rétrocompatibilité (liens existants,
 * bookmarks, history). Redirige vers la page unifiée avec l'onglet
 * Affectations actif.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AffectationsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/matieres-affectations?tab=affectations");
  }, [router]);
  return null;
}
