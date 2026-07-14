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

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, CalendarDays } from "lucide-react";
import { RoleGuard } from "@/components/auth/role-guard";
import { MatieresList } from "@/components/enseignants/matieres-list";
import { AffectationsList } from "@/components/enseignants/affectations-list";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

const ALLOWED_ROLES = [
  "DIRECTION",
  "DIRECTEUR_ETUDES",
  "DIRECTEUR_SUPERVISEUR",
  "SECRETARIAT",
] as const;

type TabValue = "matieres" | "affectations";

/** Lit l'onglet depuis les searchParams avec fallback sur "matières". */
function readTabFromParams(searchParams: URLSearchParams): TabValue {
  return searchParams.get("tab") === "affectations"
    ? "affectations"
    : "matieres";
}

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
  // State local = source de vérité pour Radix (controlled). Initialisé depuis
  // l'URL pour la rétrocompatibilité (?tab=affectations) et le back/forward.
  const [tab, setTab] = useState<TabValue>(() => readTabFromParams(searchParams));

  // Sync URL → state quand l'URL change (back/forward, liens externes).
  // Pattern légitime documenté Next.js pour les onglets synchronisés URL.
  useEffect(() => {
    setTab(readTabFromParams(searchParams));
  }, [searchParams]);

  /** Bascule d'onglet : state local (réactivité immédiate) + URL (partage). */
  const handleTabChange = useCallback(
    (value: string) => {
      if (value !== "matieres" && value !== "affectations") return;
      setTab(value as TabValue);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", value);
      router.replace(`/matieres-affectations?${params.toString()}`, {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
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
  );
}
