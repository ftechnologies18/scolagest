"use client";

/**
 * ScolaGest — Redirection /eleves → /eleves-effectifs?tab=eleves.
 *
 * Ancienne route conservée pour la rétrocompatibilité (liens existants,
 * bookmarks, history). Redirige vers la page unifiée avec l'onglet Élèves
 * actif.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ElevesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/eleves-effectifs?tab=eleves");
  }, [router]);
  return null;
}
