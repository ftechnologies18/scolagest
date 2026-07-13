"use client";

/**
 * ScolaGest — Page unifiée Inscriptions (route `/inscriptions`).
 *
 * Fusion des anciennes routes `/inscription` (wizard 4 étapes — élève présent
 * au guichet) et `/pre-inscriptions` (validation des demandes en ligne des
 * parents) en une seule page avec onglets.
 *
 * Innovation UX : un seul point d'entrée pour le cycle complet d'admission —
 * l'utilisateur traite les pré-inscriptions en ligne puis bascule sur
 * l'onglet Nouvelle inscription pour finaliser l'admission au guichet sans
 * changer de menu. Cohérent métier : les deux opérations concernent
 * l'inscription d'un élève, mêmes rôles.
 *
 * Architecture :
 *  - Header global premium (GlassCard + badge rond gradient emerald→gold +
 *    icône ClipboardList + h1 + description).
 *  - Onglets synchronisés à l'URL (`?tab=nouvelle` | `?tab=preinscriptions`).
 *  - Onglet « Pré-inscriptions en ligne » : rend `PreInscriptionsList`
 *    (filtres par statut, tableau, dialogs validation/rejet/détail).
 *  - Onglet « Nouvelle inscription » : rend `InscriptionWizard` (4 étapes).
 *  - RoleGuard global : SECRETARIAT / DIRECTION / DIRECTEUR_ETUDES /
 *    DIRECTEUR_SUPERVISEUR (commun aux deux opérations).
 *
 * Rétrocompatibilité : les anciennes routes `/inscription` et
 * `/pre-inscriptions` redirigent vers cette page avec le bon onglet.
 */

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardList, MailOpen, Sparkles, UserPlus } from "lucide-react";
import { RoleGuard } from "@/components/auth/role-guard";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InscriptionWizard } from "@/components/inscription/inscription-wizard";
import { PreInscriptionsList } from "@/components/pre-inscription/pre-inscriptions-list";

const ALLOWED_ROLES = [
  "SECRETARIAT",
  "DIRECTION",
  "DIRECTEUR_ETUDES",
  "DIRECTEUR_SUPERVISEUR",
] as const;

type TabValue = "preinscriptions" | "nouvelle";

/** Onglet courant dérivé de l'URL (source de vérité = URL, pas de state local). */
function useTabFromUrl(searchParams: URLSearchParams): TabValue {
  return useMemo(() => {
    return searchParams.get("tab") === "nouvelle" ? "nouvelle" : "preinscriptions";
  }, [searchParams]);
}

export default function InscriptionsPage() {
  return (
    <RoleGuard allow={[...ALLOWED_ROLES]}>
      <InscriptionsContent />
    </RoleGuard>
  );
}

function InscriptionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = useTabFromUrl(searchParams);

  const handleTabChange = useCallback(
    (value: string) => {
      if (value !== "preinscriptions" && value !== "nouvelle") return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", value);
      router.replace(`/inscriptions?${params.toString()}`, { scroll: false });
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
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
                <ClipboardList className="size-6" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                    Inscriptions
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50/60 px-2 py-0.5 align-middle text-[11px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                    <Sparkles className="size-3" />
                    Admission
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Cycle complet d&apos;admission : validation des pré-inscriptions
                  en ligne et nouvelles inscriptions au guichet.
                </p>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* ─── Onglets Pré-inscriptions / Nouvelle inscription ────────────── */}
        <Tabs value={tab} onValueChange={handleTabChange} className="space-y-0">
          <TabsList className="h-10">
            <TabsTrigger value="preinscriptions" className="gap-1.5 px-3">
              <MailOpen className="size-4" />
              Pré-inscriptions en ligne
            </TabsTrigger>
            <TabsTrigger value="nouvelle" className="gap-1.5 px-3">
              <UserPlus className="size-4" />
              Nouvelle inscription
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preinscriptions" className="mt-0">
            <PreInscriptionsList />
          </TabsContent>
          <TabsContent value="nouvelle" className="mt-0">
            <InscriptionWizard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
