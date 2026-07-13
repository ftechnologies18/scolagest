"use client";

/**
 * ScolaGest — Page unifiée Temps pédagogique (route `/temps-pedagogique`).
 *
 * Fusion des anciennes routes `/emploi-du-temps` (planning hebdomadaire des
 * créneaux — Lundi → Samedi) et `/pointage-ecran` (suivi temps réel des
 * pointages enseignants) en une seule page avec onglets.
 *
 * Innovation UX : un seul point d'entrée pour la gestion du temps pédagogique
 * — l'utilisateur configure l'emploi du temps puis bascule sur l'onglet
 * Pointage pour voir le suivi temps réel sans changer de menu. Workflow
 * séquentiel direct : l'EDT génère les sessions de pointage.
 *
 * Architecture :
 *  - Header global premium (GlassCard + badge rond gradient emerald→gold +
 *    icône Clock + h1 + description).
 *  - Onglets synchronisés à l'URL (`?tab=edt` | `?tab=pointage`).
 *  - Onglet « Emploi du temps » : rend `EmploiTempsDashboard`.
 *  - Onglet « Pointage temps réel » : rend `EcranPointage`.
 *  - RoleGuard global : DIRECTION / DIRECTEUR_ETUDES / DIRECTEUR_SUPERVISEUR
 *    / SECRETARIAT (commun aux deux opérations).
 *
 * Rétrocompatibilité : les anciennes routes `/emploi-du-temps` et
 * `/pointage-ecran` redirigent vers cette page avec le bon onglet.
 */

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, Clock } from "lucide-react";
import { RoleGuard } from "@/components/auth/role-guard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmploiTempsDashboard } from "@/components/emploi-temps/emploi-temps-dashboard";
import { EcranPointage } from "@/components/pointage/ecran-pointage";

const ALLOWED_ROLES = [
  "DIRECTION",
  "DIRECTEUR_ETUDES",
  "DIRECTEUR_SUPERVISEUR",
  "SECRETARIAT",
] as const;

type TabValue = "edt" | "pointage";

/** Onglet courant dérivé de l'URL (source de vérité = URL, pas de state local). */
function useTabFromUrl(searchParams: URLSearchParams): TabValue {
  return useMemo(() => {
    return searchParams.get("tab") === "pointage" ? "pointage" : "edt";
  }, [searchParams]);
}

export default function TempsPedagogiquePage() {
  return (
    <RoleGuard allow={[...ALLOWED_ROLES]}>
      <TempsPedagogiqueContent />
    </RoleGuard>
  );
}

function TempsPedagogiqueContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = useTabFromUrl(searchParams);

  const handleTabChange = useCallback(
    (value: string) => {
      if (value !== "edt" && value !== "pointage") return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", value);
      router.replace(`/temps-pedagogique?${params.toString()}`, {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {/* ─── Onglets Emploi du temps / Pointage ─────────────────────────── */}
      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-0">
        <TabsList className="h-10">
          <TabsTrigger value="edt" className="gap-1.5 px-3">
            <CalendarDays className="size-4" />
            Emploi du temps
          </TabsTrigger>
          <TabsTrigger value="pointage" className="gap-1.5 px-3">
            <Clock className="size-4" />
            Pointage temps réel
          </TabsTrigger>
        </TabsList>

        <TabsContent value="edt" className="mt-0">
          <EmploiTempsDashboard />
        </TabsContent>
        <TabsContent value="pointage" className="mt-0">
          <EcranPointage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
