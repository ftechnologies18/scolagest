"use client";

/**
 * ScolaGest — Page unifiée Années scolaires & Passage de classe
 * (route `/annees-passage`).
 *
 * Fusion des anciennes routes `/annees` (gestion CRUD des années scolaires)
 * et `/passage-masse` (passage de classe en masse — opération de fin d'année)
 * en une seule page avec onglets.
 *
 * Innovation UX : un seul point d'entrée pour la gestion du cycle annuel —
 * l'utilisateur configure les années scolaires puis bascule sur l'onglet
 * Passage pour effectuer l'opération de fin d'année sans changer de menu.
 * Cohérent métier : les deux opérations concernent le cycle annuel et sont
 * réservées aux mêmes rôles (DIRECTION / DIRECTEUR_*).
 *
 * Architecture :
 *  - Header global premium (GlassCard + badge rond gradient emerald→gold +
 *    icône CalendarRange + h1 + description).
 *  - Onglets synchronisés à l'URL (`?tab=annees` | `?tab=passage`) pour
 *    la partageabilité et la rétrocompatibilité.
 *  - Onglet « Années scolaires » : rend `AnneesView` (CRUD années).
 *  - Onglet « Passage de classe » : rend `PassageMasseDashboard` (aperçu,
 *    ajustement individuel, validation en une passe).
 *  - RoleGuard global : DIRECTION / DIRECTEUR_ETUDES / DIRECTEUR_SUPERVISEUR
 *    (commun aux deux opérations — pas de distinction de rôle entre onglets).
 *
 * Rétrocompatibilité : les anciennes routes `/annees` et `/passage-masse`
 * redirigent vers cette page avec le bon onglet via `?tab=`.
 */

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CalendarDays, CalendarRange, Sparkles } from "lucide-react";
import { RoleGuard } from "@/components/auth/role-guard";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import AnneesView from "@/components/dashboard/views/view-annees";
import { PassageMasseDashboard } from "@/components/passage-masse/passage-masse-dashboard";

const ALLOWED_ROLES = [
  "DIRECTION",
  "DIRECTEUR_ETUDES",
  "DIRECTEUR_SUPERVISEUR",
] as const;

type TabValue = "annees" | "passage";

/**
 * Onglet courant dérivé de l'URL. Source de vérité = URL (pas de state local
 * dupliqué), ce qui évite le anti-pattern setState-in-effect et garantit la
 * cohérence URL ↔ onglet affiché (back/forward, partage de liens).
 */
function useTabFromUrl(searchParams: URLSearchParams): TabValue {
  return useMemo(() => {
    return searchParams.get("tab") === "passage" ? "passage" : "annees";
  }, [searchParams]);
}

export default function AnneesPassagePage() {
  return (
    <RoleGuard allow={[...ALLOWED_ROLES]}>
      <AnneesPassageContent />
    </RoleGuard>
  );
}

function AnneesPassageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Onglet courant dérivé de l'URL (sans state local — évite setState-in-effect).
  const tab = useTabFromUrl(searchParams);

  /** Bascule d'onglet : met à jour l'URL (la dérivation recalcule l'onglet). */
  const handleTabChange = useCallback(
    (value: string) => {
      if (value !== "annees" && value !== "passage") return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", value);
      router.replace(`/annees-passage?${params.toString()}`, {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  return (
    <div className="relative min-h-screen">
      <KentePattern variant="bg" className="opacity-[0.04]" />

      <div className="relative mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
        {/* ─── Header global premium ─────────────────────────────────────── */}
        <GlassCard variant="desktop" noHover className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 sm:gap-4">
              {/* Badge rond gradient emerald→gold avec icône CalendarRange (fusion années + passage) */}
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
                <CalendarRange className="size-6" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                    Années scolaires &amp; Passage de classe
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50/60 px-2 py-0.5 align-middle text-[11px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                    <Sparkles className="size-3" />
                    Cycle annuel
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Gestion du cycle annuel : configuration des années scolaires
                  et passage de classe en masse (opération de fin d&apos;année).
                </p>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* ─── Onglets Années / Passage ───────────────────────────────────── */}
        <Tabs value={tab} onValueChange={handleTabChange} className="space-y-0">
          <TabsList className="h-10">
            <TabsTrigger value="annees" className="gap-1.5 px-3">
              <CalendarDays className="size-4" />
              Années scolaires
            </TabsTrigger>
            <TabsTrigger value="passage" className="gap-1.5 px-3">
              <ArrowRight className="size-4" />
              Passage de classe
            </TabsTrigger>
          </TabsList>

          {/* TabContent Années — rend AnneesView (CRUD années scolaires) */}
          <TabsContent value="annees" className="mt-0">
            <AnneesView />
          </TabsContent>

          {/* TabContent Passage — rend PassageMasseDashboard (passage en masse) */}
          <TabsContent value="passage" className="mt-0">
            <PassageMasseDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
