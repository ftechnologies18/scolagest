"use client";

/**
 * ScolaGest — Page unifiée Élèves & Effectifs (route `/eleves-effectifs`).
 *
 * Fusion des anciennes routes `/eleves` (gestion opérationnelle : liste,
 * fiches, inscriptions) et `/effectifs` (tableau de bord stratégique de
 * remplissage des classes) en une seule page avec onglets.
 *
 * Innovation UX : un seul point d'entrée pour le pilotage des élèves —
 * l'utilisateur bascule entre la vue détaillée (gestion) et la vue
 * agrégée (effectifs) sans changer de menu.
 *
 * Architecture :
 *  - Header global premium (GlassCard + badge rond gradient emerald→gold +
 *    icône School + h1 + description).
 *  - Onglets synchronisés à l'URL (`?tab=eleves` | `?tab=effectifs`) pour
 *    la partageabilité et la rétrocompatibilité.
 *  - Onglet « Élèves » : rend `ElevesView` (gestion opérationnelle, accessible
 *    à tous les rôles authentifiés).
 *  - Onglet « Effectifs » : rend `EffectifsDashboard` (pilotage stratégique,
 *    réservé à DIRECTION / DIRECTEUR_* — masqué aux autres rôles).
 *  - RoleGuard global : tous les rôles authentifiés (comme /eleves). L'onglet
 *    Effectifs est conditionné au rôle via la prop `roles` du tab (masqué aux
 *    rôles non autorisés — un caissier ne voit que l'onglet Élèves).
 *
 * Rétrocompatibilité : les anciennes routes `/eleves` et `/effectifs`
 * redirigent vers cette page avec le bon onglet via `?tab=`.
 */

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BarChart3, Users } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ElevesView from "@/components/dashboard/views/view-eleves";
import { EffectifsDashboard } from "@/components/effectifs/effectifs-dashboard";

/** Rôles autorisés à voir l'onglet Effectifs (pilotage stratégique). */
const EFFECTIFS_ROLES = [
  "DIRECTION",
  "DIRECTEUR_ETUDES",
  "DIRECTEUR_SUPERVISEUR",
] as const;

type TabValue = "eleves" | "effectifs";

/**
 * Onglet courant dérivé de l'URL + permissions. Source de vérité = URL
 * (pas de state local dupliqué), ce qui évite le anti-pattern
 * setState-in-effect et garantit la cohérence URL ↔ onglet affiché.
 * Garde-fou : si l'utilisateur demande ?tab=effectifs sans permission,
 * on force l'onglet Élèves.
 */
function useTabFromUrl(
  searchParams: URLSearchParams,
  canSeeEffectifs: boolean,
): TabValue {
  return useMemo(() => {
    const requested = searchParams.get("tab");
    if (requested === "effectifs" && canSeeEffectifs) return "effectifs";
    return "eleves";
  }, [searchParams, canSeeEffectifs]);
}

export default function ElevesEffectifsPage() {
  return <ElevesEffectifsContent />;
}

function ElevesEffectifsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = useAuthStore((s) => s.role);

  // L'utilisateur courant peut-il voir l'onglet Effectifs ?
  const canSeeEffectifs = useMemo(
    () => !!role && (EFFECTIFS_ROLES as readonly string[]).includes(role),
    [role],
  );

  // Onglet courant dérivé de l'URL (sans state local — évite setState-in-effect).
  const tab = useTabFromUrl(searchParams, canSeeEffectifs);

  /** Bascule d'onglet : met à jour l'URL (la dérivation recalcule l'onglet). */
  const handleTabChange = useCallback(
    (value: string) => {
      if (value !== "eleves" && value !== "effectifs") return;
      // Refus de basculer vers Effectifs si l'utilisateur n'a pas le rôle.
      if (value === "effectifs" && !canSeeEffectifs) return;
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", value);
      router.replace(`/eleves-effectifs?${params.toString()}`, {
        scroll: false,
      });
    },
    [router, searchParams, canSeeEffectifs],
  );

  return (
    <div className="relative mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      {/* ─── Onglets Élèves / Effectifs ──────────────────────────────────── */}
      <Tabs value={tab} onValueChange={handleTabChange} className="space-y-0">
        <TabsList className="h-10">
          <TabsTrigger value="eleves" className="gap-1.5 px-3">
            <Users className="size-4" />
            Élèves
          </TabsTrigger>
          {canSeeEffectifs ? (
            <TabsTrigger value="effectifs" className="gap-1.5 px-3">
              <BarChart3 className="size-4" />
              Effectifs
            </TabsTrigger>
          ) : null}
        </TabsList>

        {/* TabContent Élèves — rend ElevesView (gestion opérationnelle) */}
        <TabsContent value="eleves" className="mt-0">
          <ElevesView />
        </TabsContent>

        {/* TabContent Effectifs — rend EffectifsDashboard (pilotage stratégique).
            Conditionné par canSeeEffectifs : si l'utilisateur n'a pas le rôle,
            l'onglet est masqué ET ce contenu n'est pas rendu (double sécurité). */}
        {canSeeEffectifs ? (
          <TabsContent value="effectifs" className="mt-0">
            <EffectifsDashboard />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
