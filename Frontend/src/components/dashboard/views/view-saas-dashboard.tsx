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
  CheckCircle2,
  Users,
  UserCog,
  Banknote,
  Wallet,
  AlertCircle,
  RotateCw,
  LifeBuoy,
  ShieldCheck,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  saasKeys,
  fetchSaasStats,
  fetchSaasEstablishments,
  type SaasEstablishment,
} from "@/lib/api-saas";
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

interface SaasDashboardViewProps {
  /** Callback pour naviguer vers une autre vue SaaS. */
  onNavigate?: (view: "saas-establishments" | "saas-audit" | "saas-support") => void;
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

  function handleRefresh() {
    void refetchStats();
    void refetchEtabs();
  }

  const support = stats?.support;
  const supportActif = !!support?.actif;

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Building2 className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
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
      <Card
        className={cn(
          "border-l-4",
          supportActif
            ? "border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20"
            : "border-emerald-300 bg-emerald-50/30 dark:border-emerald-800 dark:bg-emerald-950/10",
        )}
      >
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
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
            variant={supportActif ? "outline" : "default"}
            size="sm"
            onClick={() => onNavigate?.("saas-support")}
            className={
              supportActif
                ? ""
                : "bg-emerald-600 text-white hover:bg-emerald-700"
            }
          >
            <ShieldCheck className="size-3.5" />
            {supportActif ? "Gérer le support" : "Activer le support"}
          </Button>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
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
            <KpiCard
              label="Établissements"
              value={String(stats?.nb_etablissements ?? 0)}
              subtitle={`${
                stats?.nb_etablissements_actifs ?? 0
              } actif(s)`}
              icon={Building2}
              accent="emerald"
            />
            <KpiCard
              label="Établissements actifs"
              value={String(stats?.nb_etablissements_actifs ?? 0)}
              subtitle={`sur ${stats?.nb_etablissements ?? 0} au total`}
              icon={CheckCircle2}
              accent="emerald"
            />
            <KpiCard
              label="Élèves (total)"
              value={String(stats?.nb_eleves_total ?? 0)}
              subtitle="Tous établissements confondus"
              icon={Users}
              accent="amber"
            />
            <KpiCard
              label="Utilisateurs (total)"
              value={String(stats?.nb_utilisateurs_total ?? 0)}
              subtitle="Comptes staff actifs"
              icon={UserCog}
              accent="emerald"
            />
            <KpiCard
              label="Paiements (total)"
              value={String(stats?.nb_paiements_total ?? 0)}
              subtitle="Encaissements historisés"
              icon={Banknote}
              accent="amber"
            />
            <KpiCard
              label="Montant total encaissé"
              value={formatFCFA(stats?.montant_total_encaisse ?? 0)}
              subtitle="Tous tenants cumulés"
              icon={Wallet}
              accent="emerald"
            />
          </div>
        )}
      </div>

      {/* Table des établissements */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  subtitle,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  subtitle?: string;
  icon: typeof Building2;
  accent: "emerald" | "amber";
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 truncate text-2xl font-bold tracking-tight">
              {value}
            </p>
            {subtitle ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm",
              accent === "emerald" ? "bg-emerald-600" : "bg-amber-500",
            )}
          >
            <Icon className="size-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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


