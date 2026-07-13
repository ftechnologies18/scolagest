"use client";

/**
 * ScolaGest — Redirection /emploi-du-temps → /temps-pedagogique?tab=edt.
 *
 * Ancienne route conservée pour la rétrocompatibilité. Redirige vers la page
 * unifiée avec l'onglet Emploi du temps actif.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EmploiDuTempsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/temps-pedagogique?tab=edt");
  }, [router]);
  return null;
}
