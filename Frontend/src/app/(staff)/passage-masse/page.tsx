"use client";

/**
 * ScolaGest — Redirection /passage-masse → /annees-passage?tab=passage.
 *
 * Ancienne route conservée pour la rétrocompatibilité (liens existants,
 * bookmarks, history). Redirige vers la page unifiée avec l'onglet
 * Passage de classe actif.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PassageMasseRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/annees-passage?tab=passage");
  }, [router]);
  return null;
}
