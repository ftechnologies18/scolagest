"use client";

/**
 * ScolaGest — Vue « Établissements » (SUPER_ADMIN, SaaS).
 *
 * Liste tous les établissements (tous tenants) avec leurs compteurs agrégés
 * (nb élèves, nb utilisateurs) et leur état. Permet au SUPER_ADMIN d&apos;activer
 * le mode support pour un établissement directement depuis cette liste
 * (raccourci vers `POST /api/saas/support/activate`).
 *
 * Données :
 *  - `GET  /api/saas/establishments`     → fetchSaasEstablishments
 *  - `GET  /api/saas/stats`              → fetchSaasStats (statut support)
 *  - `POST /api/saas/support/activate`   → activateSupport
 *
 * États : chargement (skeleton), erreur (retry), vide.
 */

import * as React from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Building2,
  LifeBuoy,
  Loader2,
  AlertCircle,
  RotateCw,
  Search,
  ShieldCheck,
  Users,
  UserCog,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  saasKeys,
  fetchSaasEstablishments,
  fetchSaasStats,
  activateSupport,
} from "@/lib/api-saas";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GlassCard } from "@/components/ds/glass-card";
import { StatCard } from "@/components/ds/stat-card";
import { KentePattern } from "@/components/ds/kente-pattern";

interface SaasEstablishmentsViewProps {
  /** Callback pour naviguer vers la vue Mode Support. */
  onNavigateSupport?: () => void;
}

export default function SaasEstablishmentsView({
  onNavigateSupport,
}: SaasEstablishmentsViewProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");

  const {
    data: establishments,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: saasKeys.establishments(),
    queryFn: fetchSaasEstablishments,
    retry: 1,
    retryDelay: 1500,
  });

  const { data: stats } = useQuery({
    queryKey: saasKeys.stats(),
    queryFn: fetchSaasStats,
    retry: 1,
    retryDelay: 1500,
  });

  const supportActif = !!stats?.support?.actif;
  const supportedEtabId = stats?.support?.etablissement_id ?? null;

  const activateMutation = useMutation({
    mutationFn: (etablissementId: string) =>
      activateSupport(etablissementId),
    onSuccess: async (status, etablissementId) => {
      // Invalide les queries liées au support + stats
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: saasKeys.stats() }),
        queryClient.invalidateQueries({ queryKey: saasKeys.support() }),
      ]);
      const found = (establishments ?? []).find(
        (e) => e.id === etablissementId,
      );
      toast({
        title: "Mode support activé",
        description: `Vous pouvez désormais consulter les données de « ${
          found?.nom ?? status.etablissement_nom ?? "l'établissement"
        } ». Tous vos accès sont tracés.`,
      });
      onNavigateSupport?.();
    },
    onError: (err: unknown) => {
      toast({
        title: "Activation impossible",
        description:
          err instanceof Error
            ? err.message
            : "Impossible d'activer le mode support pour le moment.",
        variant: "destructive",
      });
    },
  });

  function handleActivate(etablissementId: string) {
    if (supportActif && supportedEtabId === etablissementId) return;
    activateMutation.mutate(etablissementId);
  }

  const filtered = React.useMemo(() => {
    const list = establishments ?? [];
    if (!search.trim()) return list;
    const q = search.trim().toLowerCase();
    return list.filter(
      (e) =>
        e.nom.toLowerCase().includes(q) ||
        (e.code_officiel ?? "").toLowerCase().includes(q) ||
        (e.ville ?? "").toLowerCase().includes(q),
    );
  }, [establishments, search]);

  return (
    <div className="space-y-4">
      <KentePattern variant="strip" position="top" />
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Building2 className="size-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">Établissements</h1>
            <p className="text-sm text-muted-foreground">
              {establishments?.length ?? 0} établissement(s) inscrit(s) sur la
              plateforme ScolaGest.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RotateCw className={cn("size-3.5", isFetching && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      {/* KPIs synthèse */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Établissements"
            value={String(establishments?.length ?? 0)}
            hint="Inscrits sur la plateforme"
            icon={Building2}
            tone="emerald"
            delay={0}
          />
          <StatCard
            label="Élèves (total)"
            value={String(
              (establishments ?? []).reduce((acc, e) => acc + e.nb_eleves, 0),
            )}
            hint="Tous tenants confondus"
            icon={Users}
            tone="amber"
            delay={0.05}
          />
          <StatCard
            label="Utilisateurs (total)"
            value={String(
              (establishments ?? []).reduce(
                (acc, e) => acc + e.nb_utilisateurs,
                0,
              ),
            )}
            hint="Comptes staff"
            icon={UserCog}
            tone="emerald"
            delay={0.1}
          />
        </div>
      )}

      <KentePattern variant="separator" className="my-2" />

      {/* Recherche */}
      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Rechercher par nom, code ou ville…"
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Rechercher un établissement"
        />
      </div>

      {/* Table */}
      <GlassCard variant="adaptive" noHover className="overflow-hidden p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <AlertCircle className="size-5 text-rose-600" />
            <p>Impossible de charger les établissements.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RotateCw className="size-3.5" />
              Réessayer
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            {search.trim()
              ? "Aucun établissement ne correspond à votre recherche."
              : "Aucun établissement enregistré sur la plateforme."}
          </p>
        ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-4">Établissement</TableHead>
                    <TableHead>Code officiel</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead className="text-right">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-3" />
                        Élèves
                      </span>
                    </TableHead>
                    <TableHead className="text-right">
                      <span className="inline-flex items-center gap-1">
                        <UserCog className="size-3" />
                        Utilisateurs
                      </span>
                    </TableHead>
                    <TableHead>État</TableHead>
                    <TableHead className="pr-4 text-right">Support</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e) => {
                    const isSupported =
                      supportActif && supportedEtabId === e.id;
                    const disabled =
                      activateMutation.isPending ||
                      (supportActif && !isSupported);
                    return (
                      <TableRow key={e.id}>
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-2">
                            <div className="flex size-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <Building2 className="size-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                {e.nom}
                              </p>
                              {isSupported ? (
                                <p className="flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                  <ShieldCheck className="size-2.5" />
                                  Support actif
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {e.code_officiel || "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {e.ville || "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {e.nb_eleves}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {e.nb_utilisateurs}
                        </TableCell>
                        <TableCell>
                          {e.actif ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              Actif
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                            >
                              Inactif
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          {isSupported ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={onNavigateSupport}
                            >
                              <ShieldCheck className="size-3.5" />
                              Gérer
                            </Button>
                          ) : (
                            <Button
                              variant="premium"
                              size="sm"
                              onClick={() => handleActivate(e.id)}
                              disabled={disabled}
                            >
                              {activateMutation.isPending &&
                              activateMutation.variables === e.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <LifeBuoy className="size-3.5" />
                              )}
                              Activer le support
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
      </GlassCard>

      {/* Note */}
      <p className="text-[11px] text-muted-foreground">
        Le mode support permet au SUPER_ADMIN de consulter temporairement les
        données d&apos;un établissement (élèves, paiements, caisse…). Tous les
        accès sont journalisés dans l&apos;audit global.
      </p>
    </div>
  );
}
