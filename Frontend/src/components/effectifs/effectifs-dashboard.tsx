"use client";

/**
 * ScolaGest — Tableau de bord « Effectifs » (Phase 3, Innovation 1).
 *
 * Vue de pilotage du remplissage des classes :
 *  - 4 cartes KPI (total élèves, garçons/filles, redoublants, taux de
 *    remplissage global) avec icônes lucide ;
 *  - Tableau détaillé par classe (libellé, cycle, effectif/max, barre de
 *    progression colorée selon le taux, badges G/F, redoublants, examen) ;
 *  - Carte thermique (grille de cartes colorées vert → amber → rouge avec
 *    l'effectif en grand).
 *
 * Le contexte d'établissement vient de `useAuthStore`. Si aucun établissement
 * n'est sélectionné, on invite l'utilisateur à en choisir un (UX identique à
 * `eleves-list.tsx`).
 *
 * États : pas d'établissement, chargement (skeleton), erreur, vide.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BarChart3,
  GraduationCap,
  Loader2,
  TrendingDown,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  effectifsKeys,
  fetchEffectifs,
  type EffectifClasse,
} from "@/lib/api-effectifs";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de couleur (vert / amber / rose — jamais indigo ni bleu)
// ─────────────────────────────────────────────────────────────────────────────

type RemplissageNiveau = "vert" | "amber" | "rouge";

/** Code la couleur d'un taux de remplissage :
 *  - < 70 %  → vert  (capacité dispo)
 *  - 70-90 % → amber (à surveiller)
 *  - > 90 %  → rouge (saturé / plein)
 *  Une classe pleine (effectif >= max) est toujours rouge, même à 90 % exact.
 */
function niveauRemplissage(taux: number, pleine: boolean): RemplissageNiveau {
  if (pleine || taux > 90) return "rouge";
  if (taux >= 70) return "amber";
  return "vert";
}

/** Classes Tailwind pour les tuiles de la carte thermique. */
const HEATMAP_TILE_CLS: Record<RemplissageNiveau, string> = {
  vert: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100",
  amber:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100",
  rouge:
    "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100",
};

/** Couleur de la barre de progression (fond + indicateur). */
const PROGRESS_CLS: Record<
  RemplissageNiveau,
  { track: string; bar: string }
> = {
  vert: {
    track: "bg-emerald-100 dark:bg-emerald-950/60",
    bar: "bg-emerald-500",
  },
  amber: {
    track: "bg-amber-100 dark:bg-amber-950/60",
    bar: "bg-amber-500",
  },
  rouge: {
    track: "bg-rose-100 dark:bg-rose-950/60",
    bar: "bg-rose-500",
  },
};

/** Couleur d'un badge « taux » affiché à droite de la barre de progression. */
const TAUX_BADGE_CLS: Record<RemplissageNiveau, string> = {
  vert: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  rouge:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
};

/** Formate un taux (0-100) en entier %. */
function formatTaux(taux: number): string {
  return `${Math.round(taux)} %`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  accent: "emerald" | "amber" | "rose" | "slate";
}

const KPI_ICON_CLS: Record<KpiCardProps["accent"], string> = {
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  amber:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  slate:
    "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
};

function KpiCard({ icon: Icon, label, value, hint, accent }: KpiCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-4">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            KPI_ICON_CLS[accent],
          )}
          aria-hidden
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 text-2xl font-bold leading-tight tabular-nums">
            {value}
          </p>
          {hint ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {hint}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

/** Barre de progression personnalisée (couleur par niveau de remplissage). */
function RemplissageBar({
  taux,
  niveau,
  className,
}: {
  taux: number;
  niveau: RemplissageNiveau;
  className?: string;
}) {
  const cls = PROGRESS_CLS[niveau];
  const pct = Math.max(0, Math.min(100, taux));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full",
        cls.track,
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full transition-all", cls.bar)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function EffectifsDashboard() {
  const etablissement = useAuthStore((s) => s.etablissement);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: effectifsKeys.detail(),
    queryFn: () => fetchEffectifs(),
    enabled: !!etablissement,
  });

  // ─── Pas d'établissement sélectionné ──────────────────────────────────────
  if (!etablissement) {
    return (
      <div className="space-y-4">
        <DashboardHeader />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertCircle className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium">
                Sélectionnez un établissement
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                Les effectifs sont calculés par établissement. Choisissez un
                établissement dans la barre latérale pour visualiser le
                remplissage des classes.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Chargement ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-6">
        <DashboardHeader />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-40 rounded-lg" />
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-10 w-40 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  // ─── Erreur ────────────────────────────────────────────────────────────────
  if (isError) {
    const message =
      error instanceof Error ? error.message : "Une erreur est survenue.";
    return (
      <div className="space-y-4">
        <DashboardHeader />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium">
                Impossible de charger les effectifs
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                {message}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const kpis = data?.kpis;
  const classes = data?.classes ?? [];

  // ─── Vide (aucune classe configurée) ───────────────────────────────────────
  if (!kpis || classes.length === 0) {
    return (
      <div className="space-y-4">
        <DashboardHeader />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <BarChart3 className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium">Aucune classe configurée</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Aucune classe n&apos;a été trouvée pour cet établissement.
                Configurez vos cycles et classes pour visualiser les effectifs.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Vue principale ─────────────────────────────────────────────────────────
  const pctGarcons =
    kpis.total_eleves > 0
      ? Math.round((kpis.garcons / kpis.total_eleves) * 100)
      : 0;
  const pctFilles =
    kpis.total_eleves > 0
      ? Math.round((kpis.filles / kpis.total_eleves) * 100)
      : 0;
  const pctRedoublants =
    kpis.total_eleves > 0
      ? Math.round((kpis.redoublants / kpis.total_eleves) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <DashboardHeader />

      {/* ─── KPIs ─────────────────────────────────────────────────────────── */}
      <section
        aria-label="Indicateurs globaux"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard
          icon={Users}
          accent="emerald"
          label="Total élèves"
          value={kpis.total_eleves}
          hint={`${kpis.total_classes} classe${
            kpis.total_classes > 1 ? "s" : ""
          } · ${kpis.classes_pleines} pleine${
            kpis.classes_pleines > 1 ? "s" : ""
          }`}
        />
        <KpiCard
          icon={GraduationCap}
          accent="amber"
          label="Garçons / Filles"
          value={
            <span>
              <span className="text-emerald-600 dark:text-emerald-400">
                {kpis.garcons}
              </span>
              <span className="mx-1 text-muted-foreground">/</span>
              <span className="text-rose-600 dark:text-rose-400">
                {kpis.filles}
              </span>
            </span>
          }
          hint={`${pctGarcons} % G · ${pctFilles} % F`}
        />
        <KpiCard
          icon={TrendingDown}
          accent="rose"
          label="Redoublants"
          value={kpis.redoublants}
          hint={`${pctRedoublants} % de l’effectif`}
        />
        <KpiCard
          icon={BarChart3}
          accent="slate"
          label="Taux de remplissage"
          value={formatTaux(kpis.taux_remplissage_global)}
          hint="Moyenne pondérée tous cycles"
        />
      </section>

      {/* ─── Tableau détaillé par classe ──────────────────────────────────── */}
      <section aria-label="Détail par classe" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight">
            Détail par classe
          </h2>
          <span className="text-xs text-muted-foreground">
            {classes.length} classe{classes.length > 1 ? "s" : ""}
          </span>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Classe</TableHead>
                    <TableHead className="min-w-[140px]">Cycle</TableHead>
                    <TableHead className="min-w-[120px] text-right">
                      Effectif
                    </TableHead>
                    <TableHead className="min-w-[200px]">
                      Remplissage
                    </TableHead>
                    <TableHead className="min-w-[120px] text-center">
                      Genre
                    </TableHead>
                    <TableHead className="min-w-[110px] text-right">
                      Redoublants
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {classes.map((c) => {
                    const pleine = c.effectif >= c.effectif_max;
                    const niveau = niveauRemplissage(
                      c.taux_remplissage,
                      pleine,
                    );
                    return (
                      <TableRow key={c.classe_id}>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">
                              {c.classe_libelle}
                            </span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[11px] text-muted-foreground">
                                Niveau {c.niveau}
                              </span>
                              {c.est_classe_examen ? (
                                <Badge
                                  variant="outline"
                                  className="border-violet-200 bg-violet-50 px-1.5 py-0 text-[10px] text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300"
                                >
                                  Examen
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.cycle_libelle || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-medium tabular-nums">
                            {c.effectif}
                          </span>
                          <span className="text-muted-foreground">
                            {" "}
                            / {c.effectif_max}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <RemplissageBar
                              taux={c.taux_remplissage}
                              niveau={niveau}
                              className="max-w-[140px]"
                            />
                            <Badge
                              variant="outline"
                              className={cn(
                                "shrink-0 tabular-nums",
                                TAUX_BADGE_CLS[niveau],
                              )}
                            >
                              {formatTaux(c.taux_remplissage)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[11px] tabular-nums text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                              title="Garçons"
                            >
                              G·{c.garcons}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="border-rose-200 bg-rose-50 px-1.5 py-0 text-[11px] tabular-nums text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                              title="Filles"
                            >
                              F·{c.filles}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {c.redoublants > 0 ? (
                            <span className="font-medium text-rose-600 dark:text-rose-400">
                              {c.redoublants}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ─── Carte thermique ──────────────────────────────────────────────── */}
      <section aria-label="Carte thermique des effectifs" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold tracking-tight">
            Carte thermique
          </h2>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-500" />
              &lt; 70 %
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-amber-500" />
              70-90 %
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-rose-500" />
              &gt; 90 %
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {classes.map((c) => {
            const pleine = c.effectif >= c.effectif_max;
            const niveau = niveauRemplissage(c.taux_remplissage, pleine);
            return (
              <HeatmapTile
                key={c.classe_id}
                classe={c}
                niveau={niveau}
                pleine={pleine}
              />
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tuile de carte thermique + en-tête
// ─────────────────────────────────────────────────────────────────────────────

function HeatmapTile({
  classe,
  niveau,
  pleine,
}: {
  classe: EffectifClasse;
  niveau: RemplissageNiveau;
  pleine: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-3 shadow-sm transition-transform hover:scale-[1.02]",
        HEATMAP_TILE_CLS[niveau],
      )}
      title={`${classe.classe_libelle} — ${classe.effectif}/${classe.effectif_max} (${formatTaux(
        classe.taux_remplissage,
      )})`}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="truncate text-xs font-semibold leading-tight">
          {classe.classe_libelle}
        </p>
        {pleine ? (
          <span
            className="shrink-0 rounded-full bg-rose-600/90 px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide text-white"
            aria-label="Classe pleine"
          >
            Pleine
          </span>
        ) : null}
      </div>
      <p className="text-2xl font-bold leading-none tabular-nums">
        {classe.effectif}
        <span className="text-sm font-medium opacity-70">
          {" "}
          / {classe.effectif_max}
        </span>
      </p>
      <p className="text-[11px] font-medium opacity-80">
        {formatTaux(classe.taux_remplissage)}
      </p>
      <div className="mt-1 flex items-center gap-1 text-[10px] opacity-80">
        <span>G {classe.garcons}</span>
        <span aria-hidden>·</span>
        <span>F {classe.filles}</span>
        {classe.redoublants > 0 ? (
          <>
            <span aria-hidden>·</span>
            <span>Red. {classe.redoublants}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function DashboardHeader() {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
        Effectifs
      </h1>
      <p className="text-sm text-muted-foreground">
        Tableau de bord de remplissage des classes par cycle et par niveau.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loader affiché pendant la résolution initiale du garde d'authentification.
// (Exporté pour réutilisation éventuelle par la page.)
// ─────────────────────────────────────────────────────────────────────────────

export function EffectifsDashboardFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Chargement des effectifs…
      </div>
    </div>
  );
}
