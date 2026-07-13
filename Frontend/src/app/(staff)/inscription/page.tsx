"use client";

/**
 * ScolaGest — Redirection /inscription → /inscriptions?tab=nouvelle.
 *
 * Ancienne route conservée pour la rétrocompatibilité. Redirige vers la page
 * unifiée avec l'onglet Nouvelle inscription actif.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InscriptionRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/inscriptions?tab=nouvelle");
  }, [router]);
  return null;
}
