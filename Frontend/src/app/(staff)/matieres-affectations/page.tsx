"use client";

/**
 * ScolaGest — Page unifiée Matières & Affectations (route `/matieres-affectations`).
 *
 * Fusion des anciennes routes `/matieres` et `/affectations` en une seule page
 * avec onglets (innovation UX : un seul point d'entrée pour la gestion
 * pédagogique prof/matière/classe).
 *
 * Architecture :
 *  - Header global premium (GlassCard + badge "Pédagogie" + titre + description)
 *  - Onglets synchronisés à l'URL (`?tab=matieres` | `?tab=affectations`) pour
 *    la partageabilité et la rétrocompatibilité.
 *  - Chaque onglet rend la liste correspondante (MatieresList / AffectationsList)
 *    qui conserve son propre header contextuel (badge Phase A, bouton Nouvelle…).
 *  - RoleGuard identique aux anciennes pages (DIRECTION, DIRECTEUR_ETUDES,
 *    DIRECTEUR_SUPERVISEUR, SECRETARIAT).
 *
 * Rétrocompatibilité : les anciennes routes `/matieres` et `/affectations`
 * redirigent vers cette page avec le bon onglet via `?tab=`.
 */

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, CalendarDays, Layers, Sparkles } from "lucide-react";
import { RoleGuard } from "@/components/auth/role-guard";
import { MatieresList } from "@/components/enseignants/matieres-list";
import { AffectationsList } from "@/components/enseignants/affectations-list";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const ALLOWED_ROLES = [
  "DIRECTION",
  "DIRECTEUR_ETUDES",
  "DIRECTEUR_SUPERVISEUR",
  "SECRETARIAT",
] as const;

type TabValue = "matieres" | "affectations";

export default function MatieresAffectationsPage() {
  return (
    <RoleGuard allow={[...ALLOWED_ROLES]}>
      <MatieresAffectationsContent />
    </RoleGuard>
  );
}

function MatieresAffectationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Onglet courant dérivé de l'URL (source de vérité = URL, pas de state local
  // dupliqué — évite le anti-pattern setState-in-effect et garantit la
  // cohérence URL ↔ onglet affiché).
  const tabParam = searchParams.get("tab");
  const tab: TabValue = tabParam === "affectations" ? "affectations" : "matieres";

  /** Bascule d'onglet + met à jour l'URL sans rechargement (partageabilité). */
  const handleTabChange = useCallback(
    (value: string) => {
      if (value !== "matieres" && value !== "affectations") return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", value);
      router.replace(`/matieres-affectations?${params.toString()}`, {
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
              {/* Badge rond gradient emerald→gold avec icône Layers (fusion) */}
              <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
                <Layers className="size-6" />
              </div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                    Matières &amp; Affectations
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50/60 px-2 py-0.5 align-middle text-[11px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                    <Sparkles className="size-3" />
                    Phase A
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Gestion pédagogique unifiée : catalogue des matières et
                  affectations prof/matière/classe.
                </p>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* ─── Onglets Matières / Affectations ────────────────────────────── */}
        <Tabs value={tab} onValueChange={handleTabChange} className="space-y-0">
          <TabsList className="h-10">
            <TabsTrigger value="matieres" className="gap-1.5 px-3">
              <BookOpen className="size-4" />
              Matières
            </TabsTrigger>
            <TabsTrigger value="affectations" className="gap-1.5 px-3">
              <CalendarDays className="size-4" />
              Affectations
            </TabsTrigger>
          </TabsList>

          {/* TabContent Matières — rend MatieresList (avec son propre header contextuel) */}
          <TabsContent value="matieres" className="mt-0">
            <MatieresList />
          </TabsContent>

          {/* TabContent Affectations — rend AffectationsList */}
          <TabsContent value="affectations" className="mt-0">
            <AffectationsList />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
