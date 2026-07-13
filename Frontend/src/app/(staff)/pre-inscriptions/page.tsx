"use client";

/**
 * ScolaGest — Redirection /pre-inscriptions → /inscriptions?tab=preinscriptions.
 *
 * Ancienne route conservée pour la rétrocompatibilité. Redirige vers la page
 * unifiée avec l'onglet Pré-inscriptions en ligne actif.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PreInscriptionsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/inscriptions?tab=preinscriptions");
  }, [router]);
  return null;
}
