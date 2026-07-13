"use client";

/**
 * ScolaGest — Redirection /mobile-money → /encaissements?tab=momo.
 *
 * Ancienne route conservée pour la rétrocompatibilité. Redirige vers la page
 * unifiée avec l'onglet Mobile Money actif.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MobileMoneyRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/encaissements?tab=momo");
  }, [router]);
  return null;
}
