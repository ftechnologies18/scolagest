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
import { HandCoins, Smartphone, Sparkles, Wallet } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
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
    <div className="relative min-h-screen">
      <KentePattern variant="bg" className="opacity-[0.04]" />

      <div className="relative mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        {/* ─── Header global premium ─────────────────────────────────────── */}
        <GlassCard variant="desktop" noHover className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
                <HandCoins className="size-6" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                    Encaissements
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50/60 px-2 py-0.5 align-middle text-[11px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                    <Sparkles className="size-3" />
                    Guichet
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Guichet d&apos;encaissement unifié : caisse physique (espèces,
                  chèque, virement) et Mobile Money (Orange, MTN, Wave).
                </p>
              </div>
            </div>
          </div>
        </GlassCard>

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
    </div>
  );
}
