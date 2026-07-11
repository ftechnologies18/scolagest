"use client";

/**
 * ScolaGest — Gestion des établissements SaaS (route `/saas/establishments`).
 *
 * Rend la vue `SaasEstablishmentsView` existante. Le prop `onNavigateSupport`
 * (qui bascule vers la vue Mode Support) est adapté en navigation URL.
 */

import { useRouter } from "next/navigation";
import SaasEstablishmentsView from "@/components/dashboard/views/view-saas-establishments";

export default function SaasEstablishmentsPage() {
  const router = useRouter();

  return (
    <SaasEstablishmentsView
      onNavigateSupport={() => router.push("/saas/support")}
    />
  );
}
