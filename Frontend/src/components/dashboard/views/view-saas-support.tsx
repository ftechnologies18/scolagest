"use client";

/**
 * ScolaGest — Vue « Mode Support » (SUPER_ADMIN, SaaS).
 *
 * Gestion du mode support : permet au SUPER_ADMIN d&apos;activer ou désactiver
 * l&apos;accès aux données d&apos;un établissement.
 *
 * Comportement :
 *  - Si support INACTIF : carte d&apos;information + liste des établissements
 *    avec un bouton « Activer le support » par ligne (POST
 *    /api/saas/support/activate).
 *  - Si support ACTIF : carte de statut (établissement ciblé, expiration) +
 *    bouton « Désactiver » (POST /api/saas/support/deactivate) + note de
 *    sécurité (accès tracés, durée limitée).
 *
 * Données :
 *  - `GET  /api/saas/stats`            → fetchSaasStats (statut support)
 *  - `GET  /api/saas/establishments`   → fetchSaasEstablishments
 *  - `POST /api/saas/support/activate`   → activateSupport
 *  - `POST /api/saas/support/deactivate` → deactivateSupport
 */

import * as React from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  LifeBuoy,
  Loader2,
  AlertCircle,
  RotateCw,
  ShieldCheck,
  ShieldAlert,
  Building2,
  Search,
  Power,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  saasKeys,
  fetchSaasStats,
  fetchSaasEstablishments,
  activateSupport,
  deactivateSupport,
} from "@/lib/api-saas";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime } from "@/lib/format";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function SaasSupportView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = React.useState("");

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    isFetching: statsFetching,
    refetch: refetchStats,
  } = useQuery({
    queryKey: saasKeys.stats(),
    queryFn: fetchSaasStats,
    retry: 1,
    retryDelay: 1500,
  });

  const {
    data: establishments,
    isLoading: etabsLoading,
    isError: etabsError,
    isFetching: etabsFetching,
    refetch: refetchEtabs,
  } = useQuery({
    queryKey: saasKeys.establishments(),
    queryFn: fetchSaasEstablishments,
    retry: 1,
    retryDelay: 1500,
  });

  const support = stats?.support;
  const supportActif = !!support?.actif;
  const supportedEtabId = support?.etablissement_id ?? null;

  const activateMutation = useMutation({
    mutationFn: (etablissementId: string) =>
      activateSupport(etablissementId),
    onSuccess: async (status, etablissementId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: saasKeys.stats() }),
        queryClient.invalidateQueries({ queryKey: saasKeys.support() }),
      ]);
      const found = (establishments ?? []).find(
        (e) => e.id === etablissementId,
      );
      toast({
        title: "Mode support activé",
        description: `Support actif pour « ${
          found?.nom ?? status.etablissement_nom ?? "l'établissement"
        } ». Tous vos accès sont tracés dans l&apos;audit global.`,
      });
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

  const deactivateMutation = useMutation({
    mutationFn: () => deactivateSupport(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: saasKeys.stats() }),
        queryClient.invalidateQueries({ queryKey: saasKeys.support() }),
      ]);
      toast({
        title: "Mode support désactivé",
        description:
          "Vous n'avez plus accès aux données de l'établissement. Vos actions restent journalisées.",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Désactivation impossible",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de désactiver le mode support pour le moment.",
        variant: "destructive",
      });
    },
  });

  function handleActivate(etablissementId: string) {
    if (supportActif) return;
    activateMutation.mutate(etablissementId);
  }

  function handleDeactivate() {
    deactivateMutation.mutate();
  }

  function handleRefresh() {
    void refetchStats();
    void refetchEtabs();
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
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm",
              supportActif ? "bg-amber-500" : "bg-emerald-600",
            )}
          >
            <LifeBuoy className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Mode Support</h1>
            <p className="text-sm text-muted-foreground">
              Activez l&apos;accès aux données d&apos;un établissement pour
              assister son équipe. Tous les accès sont tracés et limités dans
              le temps.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={statsFetching || etabsFetching}
        >
          <RotateCw
            className={cn(
              "size-3.5",
              (statsFetching || etabsFetching) && "animate-spin",
            )}
          />
          Actualiser
        </Button>
      </div>

      {/* Statut courant */}
      <Card
        className={cn(
          "border-l-4",
          supportActif
            ? "border-amber-300 dark:border-amber-800"
            : "border-emerald-300 dark:border-emerald-800",
        )}
      >
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {supportActif ? (
              <ShieldAlert className="size-4 text-amber-600" />
            ) : (
              <ShieldCheck className="size-4 text-emerald-600" />
            )}
            Statut du mode support
          </CardTitle>
          <CardDescription>
            {supportActif
              ? "Le mode support est actuellement actif. Vos consultations et actions sont journalisées."
              : "Aucun accès aux données d'établissement n'est actuellement actif."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {statsLoading ? (
            <Skeleton className="h-20 w-full" />
          ) : statsError ? (
            <div className="flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50/40 p-3 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300">
              <AlertCircle className="size-4" />
              Impossible de charger le statut du support.
            </div>
          ) : supportActif ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <InfoTile
                  label="Établissement"
                  value={support?.etablissement_nom ?? "—"}
                  icon={Building2}
                />
                <InfoTile
                  label="Expire le"
                  value={
                    support?.expire_at
                      ? formatDateTime(support.expire_at)
                      : "—"
                  }
                  icon={LifeBuoy}
                />
                <InfoTile
                  label="Statut"
                  value="Actif"
                  icon={ShieldAlert}
                  tone="amber"
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
                      disabled={deactivateMutation.isPending}
                    >
                      {deactivateMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Power className="size-3.5" />
                      )}
                      Désactiver le support
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        Désactiver le mode support ?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Vous n&apos;aurez plus accès aux données de
                        « {support?.etablissement_nom ?? "l'établissement"} ».
                        Vos actions restent journalisées dans l&apos;audit
                        global. Vous pourrez réactiver le support à tout
                        moment.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeactivate}
                        className="bg-rose-600 text-white hover:bg-rose-700"
                      >
                        Confirmer la désactivation
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  Aucun support actif
                </p>
                <p className="text-xs text-muted-foreground">
                  Sélectionnez un établissement ci-dessous pour activer le
                  mode support.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sélecteur d'établissement (uniquement si support inactif) */}
      {!supportActif && (
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Établissements
            </h2>
            <div className="relative max-w-md w-full">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher…"
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Rechercher un établissement"
              />
            </div>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              {etabsLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : etabsError ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
                  <AlertCircle className="size-5 text-rose-600" />
                  <p>Impossible de charger les établissements.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchEtabs()}
                    disabled={etabsFetching}
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
                        <TableHead>Code</TableHead>
                        <TableHead>Ville</TableHead>
                        <TableHead className="text-right">Élèves</TableHead>
                        <TableHead>État</TableHead>
                        <TableHead className="pr-4 text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="pl-4">
                            <div className="flex items-center gap-2">
                              <div className="flex size-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                <Building2 className="size-4" />
                              </div>
                              <span className="text-sm font-medium">
                                {e.nom}
                              </span>
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
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleActivate(e.id)}
                              disabled={
                                activateMutation.isPending || !e.actif
                              }
                              className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/40"
                            >
                              {activateMutation.isPending &&
                              activateMutation.variables === e.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <LifeBuoy className="size-3.5" />
                              )}
                              Activer le support
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {!supportActif && (
            <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <XCircle className="mt-px size-3 shrink-0 text-amber-600" />
              Le mode support est limité à un seul établissement à la fois et
              sa durée est plafonnée. Toutes les consultations et actions sont
              enregistrées dans l&apos;audit global.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

function InfoTile({
  label,
  value,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  icon: typeof Building2;
  tone?: "default" | "amber";
}) {
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon
          className={cn(
            "size-3",
            tone === "amber" ? "text-amber-600" : "text-emerald-600",
          )}
        />
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}
