"use client";

/**
 * ScolaGest — Redirection /effectifs → /eleves-effectifs?tab=effectifs.
 *
 * Ancienne route conservée pour la rétrocompatibilité (liens existants,
 * bookmarks, history). Redirige vers la page unifiée avec l'onglet
 * Effectifs actif.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EffectifsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/eleves-effectifs?tab=effectifs");
  }, [router]);
  return null;
}
