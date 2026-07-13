"use client";

/**
 * ScolaGest — Page unifiée Encaissements (route `/encaissements`).
 *
 * Fusion des anciennes routes `/caisse` (guichet physique : espèces, chèque,
 * virement) et `/mobile-money` (guichet MoMo : Orange/MTN/Wave) en une seule
 * page avec onglets.
 *
 * Innovation UX : un seul point d'entrée pour le guichet d'encaissement —
 * le caissier bascule entre les modes de paiement sans changer de menu.
 *
 * RBAC : l'onglet Mobile Money est réservé au CAISSIER seul (guichet MoMo).
 * Le COMPTABLE voit l'onglet Caisse mais pas l'onglet Mobile Money (double
 * sécurité : onglet masqué + TabsContent non rendu + garde-fou URL).
 *
 * Architecture :
 *  - Header global premium (GlassCard + badge rond gradient emerald→gold +
 *    icône HandCoins + h1 + description).
 *  - Onglets synchronisés à l'URL (`?tab=caisse` | `?tab=momo`).
 *  - Onglet « Caisse » : rend `CaisseView` (encaissement, clôture, reçus).
 *  - Onglet « Mobile Money » : rend `MobileMoneyView` (initier, réconcilier).
 *  - RoleGuard global : CAISSIER / COMPTABLE (accès page). Onglet MoMo
 *    conditionné par canSeeMomo (rôle CAISSIER uniquement).
 *
 * Rétrocompatibilité : les anciennes routes `/caisse` et `/mobile-money`
 * redirigent vers cette page avec le bon onglet.
 */

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Smartphone, Wallet } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import CaisseView from "@/components/dashboard/views/view-caisse";
import MobileMoneyView from "@/components/dashboard/views/view-mobile-money";

/** Rôles autorisés à accéder à la page (Caisse + MoMo confondus). */
const PAGE_ROLES = ["CAISSIER", "COMPTABLE"] as const;

/** Rôles autorisés à voir l'onglet Mobile Money (guichet MoMo). */
const MOMO_ROLES = ["CAISSIER"] as const;

type TabValue = "caisse" | "momo";

/**
 * Onglet courant dérivé de l'URL + permissions. Source de vérité = URL
 * (pas de state local dupliqué), évite le anti-pattern setState-in-effect.
 * Garde-fou : si l'utilisateur demande ?tab=momo sans permission, on force
 * l'onglet Caisse.
 */
function useTabFromUrl(
  searchParams: URLSearchParams,
  canSeeMomo: boolean,
): TabValue {
  return useMemo(() => {
    const requested = searchParams.get("tab");
    if (requested === "momo" && canSeeMomo) return "momo";
    return "caisse";
  }, [searchParams, canSeeMomo]);
}

export default function EncaissementsPage() {
  return <EncaissementsContent />;
}

function EncaissementsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = useAuthStore((s) => s.role);

  // L'utilisateur courant peut-il voir l'onglet Mobile Money ?
  const canSeeMomo = useMemo(
    () => !!role && (MOMO_ROLES as readonly string[]).includes(role),
    [role],
  );

  // Onglet courant dérivé de l'URL (sans state local — évite setState-in-effect).
  const tab = useTabFromUrl(searchParams, canSeeMomo);

  /** Bascule d'onglet : met à jour l'URL (la dérivation recalcule l'onglet). */
  const handleTabChange = useCallback(
    (value: string) => {
      if (value !== "caisse" && value !== "momo") return;
      // Refus de basculer vers MoMo si l'utilisateur n'a pas le rôle.
      if (value === "momo" && !canSeeMomo) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", value);
      router.replace(`/encaissements?${params.toString()}`, { scroll: false });
    },
    [router, searchParams, canSeeMomo],
  );

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {/* ─── Onglets Caisse / Mobile Money ──────────────────────────────── */}
      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-0">
        <TabsList className="h-10">
          <TabsTrigger value="caisse" className="gap-1.5 px-3">
            <Wallet className="size-4" />
            Caisse
          </TabsTrigger>
          {canSeeMomo ? (
            <TabsTrigger value="momo" className="gap-1.5 px-3">
              <Smartphone className="size-4" />
              Mobile Money
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="caisse" className="mt-0">
          <CaisseView />
        </TabsContent>
        {canSeeMomo ? (
          <TabsContent value="momo" className="mt-0">
            <MobileMoneyView />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
