"use client";

/**
 * ScolaGest — Redirection /matieres → /matieres-affectations?tab=matieres.
 *
 * Ancienne route conservée pour la rétrocompatibilité (liens existants,
 * bookmarks, history). Redirige vers la page unifiée avec l'onglet Matières
 * actif.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MatieresRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/matieres-affectations?tab=matieres");
  }, [router]);
  return null;
}
