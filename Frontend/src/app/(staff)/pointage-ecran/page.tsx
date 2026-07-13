"use client";

/**
 * ScolaGest — Redirection /pointage-ecran → /temps-pedagogique?tab=pointage.
 *
 * Ancienne route conservée pour la rétrocompatibilité. Redirige vers la page
 * unifiée avec l'onglet Pointage temps réel actif.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PointageEcranRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/temps-pedagogique?tab=pointage");
  }, [router]);
  return null;
}
