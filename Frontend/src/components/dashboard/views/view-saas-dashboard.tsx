"use client";

/**
 * ScolaGest — Vue « Tableau de bord SaaS » (SUPER_ADMIN).
 *
 * Écran d'accueil du SUPER_ADMIN (propriétaire de la plateforme). Affiche :
 *  - 6 cartes KPI : nb établissements, nb établissements actifs, nb élèves
 *    total, nb utilisateurs total, nb paiements total, montant total
 *    encaissé (tous tenants confondus).
 *  - Un bandeau « Mode support » indiquant l'état courant (actif/inactif,
 *    établissement ciblé, expiration) avec raccourci vers la vue Mode
 *    Support.
 *  - Une table des établissements (nom, code officiel, ville, nb élèves, nb
 *    utilisateurs, état).
 *
 * Données :
 *  - `GET /api/saas/stats`          → fetchSaasStats
 *  - `GET /api/saas/establishments` → fetchSaasEstablishments
 *
 * États : chargement (skeleton), erreur (retry), vide.
 */

import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Users,
  UserCog,
  Banknote,
  Wallet,
  AlertCircle,
  RotateCw,
  LifeBuoy,
  ShieldCheck,
  XCircle,
  TrendingUp,
  Hourglass,
  ArrowRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  saasKeys,
  fetchSaasStats,
  fetchSaasEstablishments,
  type SaasEstablishment,
} from "@/lib/api-saas";
import {
  billingKeys,
  fetchBillingStats,
} from "@/lib/api-saas-billing";
import { formatFCFA, formatDateTime } from "@/lib/format";

import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ProgressCircle } from "@/components/ds/progress-circle";

interface SaasDashboardViewProps {
  /** Callback pour naviguer vers une autre vue SaaS. */
  onNavigate?: (
    view:
      | "saas-establishments"
      | "saas-audit"
      | "saas-billing"
      | "saas-support",
  ) => void;
}

export default function SaasDashboardView({
  onNavigate,
}: SaasDashboardViewProps) {
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

  const {
    data: billingStats,
    isLoading: billingLoading,
    isError: billingError,
  } = useQuery({
    queryKey: billingKeys.stats(),
    queryFn: fetchBillingStats,
    retry: 1,
    retryDelay: 1500,
  });

  function handleRefresh() {
    void refetchStats();
    void refetchEtabs();
  }

  const support = stats?.support;
  const supportActif = !!support?.actif;

  return (
    <div className="space-y-6">
      <KentePattern variant="strip" position="top" />
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Building2 className="size-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">
              Tableau de bord SaaS
            </h1>
            <p className="text-sm text-muted-foreground">
              Vue d&apos;ensemble de la plateforme ScolaGest — tous
              établissements confondus.
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

      {/* Bandeau mode support */}
      <GlassCard
        variant="adaptive"
        noHover
        className={cn(
          "border-l-4 p-4",
          supportActif
            ? "border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20"
            : "border-emerald-300 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/10",
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg text-white",
                supportActif ? "bg-amber-500" : "bg-emerald-600",
              )}
            >
              <LifeBuoy className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold">
                Mode support
                {supportActif ? (
                  <Badge
                    variant="outline"
                    className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    Actif
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Inactif
                  </Badge>
                )}
              </p>
              {supportActif ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Support actif pour{" "}
                  <strong className="text-foreground">
                    {support?.etablissement_nom ?? "—"}
                  </strong>
                  {support?.expire_at
                    ? ` · expire le ${formatDateTime(support.expire_at)}`
                    : ""}
                  . Tous vos accès sont tracés dans le journal d&apos;audit.
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Aucun accès aux données d&apos;établissement. Activez le mode
                  support pour assister un établissement (accès tracé, durée
                  limitée).
                </p>
              )}
            </div>
          </div>
          <Button
            variant={supportActif ? "outline" : "success"}
            size="sm"
            onClick={() => onNavigate?.("saas-support")}
          >
            <ShieldCheck className="size-3.5" />
            {supportActif ? "Gérer le support" : "Activer le support"}
          </Button>
        </div>
      </GlassCard>

      {/* KPIs */}
      <div>
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Indicateurs globaux
        </h2>
        {statsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : statsError ? (
          <Card className="border-rose-200 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/20">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex size-11 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                <XCircle className="size-5" />
              </div>
              <p className="text-sm font-medium">Statistiques indisponibles</p>
              <p className="max-w-md text-xs text-muted-foreground">
                Le backend n&apos;a pas pu renvoyer les agrégats SaaS.
                Vérifiez que le serveur Go est démarré puis réessayez.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchStats()}
                disabled={statsFetching}
              >
                <RotateCw className="size-3.5" />
                Réessayer
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Établissements"
              value={String(stats?.nb_etablissements ?? 0)}
              hint={`${stats?.nb_etablissements_actifs ?? 0} actif(s)`}
              icon={Building2}
              tone="emerald"
              delay={0}
            />
            <GlassCard
              variant="premium"
              premiumBorder
              noHover
              className="flex items-center justify-between gap-4 p-5"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Taux d&apos;activité
                </span>
                <span className="text-2xl font-bold font-display text-foreground">
                  {stats?.nb_etablissements_actifs ?? 0}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    / {stats?.nb_etablissements ?? 0}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  Établissements actifs
                </span>
              </div>
              <ProgressCircle
                value={
                  stats && stats.nb_etablissements > 0
                    ? (stats.nb_etablissements_actifs /
                        stats.nb_etablissements) *
                      100
                    : 0
                }
                size={88}
                strokeWidth={8}
              />
            </GlassCard>
            <StatCard
              label="Élèves (total)"
              value={String(stats?.nb_eleves_total ?? 0)}
              hint="Tous établissements confondus"
              icon={Users}
              tone="amber"
              delay={0.1}
            />
            <StatCard
              label="Utilisateurs (total)"
              value={String(stats?.nb_utilisateurs_total ?? 0)}
              hint="Comptes staff actifs"
              icon={UserCog}
              tone="emerald"
              delay={0.15}
            />
            <StatCard
              label="Paiements (total)"
              value={String(stats?.nb_paiements_total ?? 0)}
              hint="Encaissements historisés"
              icon={Banknote}
              tone="amber"
              delay={0.2}
            />
            <StatCard
              label="Montant total encaissé"
              value={formatFCFA(stats?.montant_total_encaisse ?? 0)}
              hint="Tous tenants cumulés"
              icon={Wallet}
              tone="emerald"
              delay={0.25}
            />
          </div>
        )}
      </div>

      <KentePattern variant="separator" className="my-2" />

      {/* Revenus SaaS — raccourci vers la vue Facturation */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Revenus SaaS
          </h2>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-emerald-700 dark:text-emerald-300"
            onClick={() => onNavigate?.("saas-billing")}
          >
            Voir la facturation
            <ArrowRight className="size-3" />
          </Button>
        </div>
        {billingLoading ? (
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : billingError ? (
          <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20">
            <CardContent className="flex items-center gap-2 py-4 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="size-4 shrink-0" />
              Statistiques de facturation indisponibles pour le moment.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-3">
            <GlassCard variant="premium" premiumBorder noHover className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gold/20 text-gold-dark">
                  <TrendingUp className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Revenu mensuel
                  </p>
                  <p className="mt-0.5 truncate font-display text-xl font-bold tracking-tight text-foreground">
                    {formatFCFA(billingStats?.revenu_mensuel ?? 0)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">MRR</p>
                </div>
              </div>
            </GlassCard>
            <GlassCard variant="premium" premiumBorder noHover className="p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-gold/20 text-gold-dark">
                  <Wallet className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Revenu annuel
                  </p>
                  <p className="mt-0.5 truncate font-display text-xl font-bold tracking-tight text-foreground">
                    {formatFCFA(billingStats?.revenu_annuel ?? 0)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">ARR</p>
                </div>
              </div>
            </GlassCard>
            <StatCard
              label="Revenu en attente"
              value={formatFCFA(billingStats?.revenu_en_attente ?? 0)}
              hint="Factures impayées"
              icon={Hourglass}
              tone="amber"
              delay={0.1}
            />
          </div>
        )}
      </div>

      {/* Table des établissements */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Établissements
          </h2>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-emerald-700 dark:text-emerald-300"
            onClick={() => onNavigate?.("saas-establishments")}
          >
            Voir tout
          </Button>
        </div>
        <GlassCard variant="adaptive" noHover className="overflow-hidden p-0">
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
          ) : (establishments ?? []).length === 0 ? (
            <p className="py-10 text-center text-xs text-muted-foreground">
              Aucun établissement enregistré sur la plateforme.
            </p>
          ) : (
            <EstablishmentsTable
              establishments={establishments ?? []}
              limit={5}
            />
          )}
        </GlassCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

function EstablishmentsTable({
  establishments,
  limit,
}: {
  establishments: SaasEstablishment[];
  limit?: number;
}) {
  const rows = limit ? establishments.slice(0, limit) : establishments;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="pl-4">Nom</TableHead>
            <TableHead>Code officiel</TableHead>
            <TableHead>Ville</TableHead>
            <TableHead className="text-right">Élèves</TableHead>
            <TableHead className="text-right">Utilisateurs</TableHead>
            <TableHead className="pr-4 text-right">État</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="pl-4">
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Building2 className="size-4" />
                  </div>
                  <span className="text-sm font-medium">{e.nom}</span>
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
              <TableCell className="pr-4 text-right">
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}


