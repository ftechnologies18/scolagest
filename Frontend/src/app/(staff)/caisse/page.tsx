"use client";

/**
 * ScolaGest — Redirection /caisse → /encaissements?tab=caisse.
 *
 * Ancienne route conservée pour la rétrocompatibilité. Redirige vers la page
 * unifiée avec l'onglet Caisse actif.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CaisseRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/encaissements?tab=caisse");
  }, [router]);
  return null;
}
