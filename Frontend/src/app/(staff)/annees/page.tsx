"use client";

/**
 * ScolaGest — Redirection /annees → /annees-passage?tab=annees.
 *
 * Ancienne route conservée pour la rétrocompatibilité (liens existants,
 * bookmarks, history). Redirige vers la page unifiée avec l'onglet
 * Années scolaires actif.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AnneesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/annees-passage?tab=annees");
  }, [router]);
  return null;
}
