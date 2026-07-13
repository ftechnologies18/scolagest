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
 * Refonte Forêt EdTech :
 *  - Hero header GlassCard desktop + badge rond gradient emerald→gold
 *    (BarChart3) + pill « Phase 3 » outline + pill « Établissement » emerald.
 *  - 4 StatCards DS (emerald / amber / terracotta / gold) avec stagger.
 *  - Tableau détaillé : GlassCard adaptive noHover p-0 + header bg-emerald-
 *    50/60 + hover row bg-emerald-50/60 + libellés font-display + badges
 *    renforcés (border-300 bg-100 text-800) + redoublants text-terracotta.
 *  - Carte thermique : GlassCard adaptive noHover + tuiles motion.div
 *    (stagger delay index*0.03) + bordures border-300 + hover:scale-[1.03]
 *    + effectif text-3xl font-bold + badge « Pleine » bg-terracotta.
 *  - Empty states premium : KentePattern bg + badges ronds colorés + icône
 *    contextuelle (AlertCircle amber / BarChart3 emerald / AlertCircle rose).
 *  - Loading state : KentePattern strip top + Loader2 size-8 centré.
 *
 * Le contexte d'établissement vient de `useAuthStore`. Si aucun établissement
 * n'est sélectionné, on invite l'utilisateur à en choisir un (UX identique à
 * `eleves-list.tsx` / `view-impayes.tsx`).
 *
 * États : pas d'établissement, chargement, erreur, vide.
 *
 * LOGIQUE MÉTIER INTACTE : hook React Query (effectifsKeys.detail() /
 * fetchEffectifs() / enabled: !!etablissement), types EffectifClasse /
 * EffectifsKPIs / EffectifsResult, helpers niveauRemplissage / formatTaux,
 * constantes HEATMAP_TILE_CLS / PROGRESS_CLS / TAUX_BADGE_CLS (renforcées
 * visuellement mais sémantiquement identiques), calculs pctGarcons /
 * pctFilles / pctRedoublants. Aucun endpoint backend touché.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
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
import { KentePattern } from "@/components/ds/kente-pattern";
import { StatCard } from "@/components/ds/stat-card";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

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

/** Classes Tailwind pour les tuiles de la carte thermique.
 *  Refonte : bordures renforcées (border-300 au lieu de border-200). */
const HEATMAP_TILE_CLS: Record<RemplissageNiveau, string> = {
  vert: "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-100",
  amber:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100",
  rouge:
    "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100",
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

/** Couleur d'un badge « taux » affiché à droite de la barre de progression.
 *  Refonte : contrastes renforcés (border-300 bg-100 text-800). */
const TAUX_BADGE_CLS: Record<RemplissageNiveau, string> = {
  vert: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200",
  amber:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200",
  rouge:
    "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200",
};

/** Formate un taux (0-100) en entier %. */
function formatTaux(taux: number): string {
  return `${Math.round(taux)} %`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

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
      <EffectifsShell>
        <EmptyState
          icon={AlertCircle}
          tone="amber"
          title="Sélectionnez un établissement"
          description="Les effectifs sont calculés par établissement. Choisissez un établissement dans la barre latérale pour visualiser le remplissage des classes."
        />
      </EffectifsShell>
    );
  }

  // ─── Chargement ────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <EffectifsShell>
        <LoadingState />
      </EffectifsShell>
    );
  }

  // ─── Erreur ────────────────────────────────────────────────────────────────
  if (isError) {
    const message =
      error instanceof Error ? error.message : "Une erreur est survenue.";
    return (
      <EffectifsShell>
        <EmptyState
          icon={AlertCircle}
          tone="rose"
          title="Impossible de charger les effectifs"
          description={message}
        />
      </EffectifsShell>
    );
  }

  const kpis = data?.kpis;
  const classes = data?.classes ?? [];

  // ─── Vide (aucune classe configurée) ───────────────────────────────────────
  if (!kpis || classes.length === 0) {
    return (
      <EffectifsShell etablissementNom={etablissement.nom}>
        <EmptyState
          icon={BarChart3}
          tone="emerald"
          title="Aucune classe configurée"
          description="Aucune classe n’a été trouvée pour cet établissement. Configurez vos cycles et classes pour visualiser les effectifs."
        />
      </EffectifsShell>
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
    <EffectifsShell etablissementNom={etablissement.nom}>
      {/* ─── KPIs (4 StatCards DS avec stagger) ──────────────────────────── */}
      <section
        aria-label="Indicateurs globaux"
        className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4"
      >
        <StatCard
          icon={Users}
          tone="emerald"
          label="Total élèves"
          value={kpis.total_eleves}
          hint={`${kpis.total_classes} classe${
            kpis.total_classes > 1 ? "s" : ""
          } · ${kpis.classes_pleines} pleine${
            kpis.classes_pleines > 1 ? "s" : ""
          }`}
          delay={0}
          className="h-full"
        />
        <StatCard
          icon={GraduationCap}
          tone="amber"
          label="Garçons / Filles"
          value={`${kpis.garcons} G / ${kpis.filles} F`}
          hint={`${pctGarcons} % G · ${pctFilles} % F`}
          delay={0.05}
          className="h-full"
        />
        <StatCard
          icon={TrendingDown}
          tone="terracotta"
          label="Redoublants"
          value={kpis.redoublants}
          hint={`${pctRedoublants} % de l’effectif`}
          delay={0.1}
          className="h-full"
        />
        <StatCard
          icon={BarChart3}
          tone="gold"
          label="Taux de remplissage"
          value={formatTaux(kpis.taux_remplissage_global)}
          hint="Moyenne pondérée tous cycles"
          delay={0.15}
          className="h-full"
        />
      </section>

      <KentePattern variant="separator" className="my-1" />

      {/* ─── Tableau détaillé par classe ──────────────────────────────────── */}
      <section aria-label="Détail par classe" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold tracking-tight text-forest">
            Détail par classe
          </h2>
          <Badge
            variant="outline"
            className="border-emerald-300 bg-emerald-100 text-[10px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
          >
            {classes.length} classe{classes.length > 1 ? "s" : ""}
          </Badge>
        </div>
        <GlassCard
          variant="adaptive"
          noHover
          noAnimation
          className="overflow-hidden p-0"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <TableHead className="min-w-[180px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Classe
                  </TableHead>
                  <TableHead className="min-w-[140px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Cycle
                  </TableHead>
                  <TableHead className="min-w-[120px] text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Effectif
                  </TableHead>
                  <TableHead className="min-w-[200px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Remplissage
                  </TableHead>
                  <TableHead className="min-w-[120px] text-center text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Genre
                  </TableHead>
                  <TableHead className="min-w-[110px] text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
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
                    <TableRow
                      key={c.classe_id}
                      className="hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20"
                    >
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="break-words font-display text-sm font-semibold leading-snug text-forest">
                            {c.classe_libelle}
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] text-muted-foreground">
                              Niveau {c.niveau}
                            </span>
                            {c.est_classe_examen ? (
                              <Badge
                                variant="outline"
                                className="border-violet-300 bg-violet-100 px-1.5 py-0 text-[10px] font-medium text-violet-800 dark:border-violet-800/60 dark:bg-violet-950/50 dark:text-violet-200"
                              >
                                Examen
                              </Badge>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <span className="break-words leading-snug">
                          {c.cycle_libelle || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className="text-base font-bold text-foreground">
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
                            className="border-emerald-300 bg-emerald-100 px-1.5 py-0 text-[11px] font-medium tabular-nums text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
                            title="Garçons"
                          >
                            G·{c.garcons}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="border-rose-300 bg-rose-100 px-1.5 py-0 text-[11px] font-medium tabular-nums text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200"
                            title="Filles"
                          >
                            F·{c.filles}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.redoublants > 0 ? (
                          <span className="font-semibold text-terracotta dark:text-terracotta">
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
        </GlassCard>
      </section>

      <KentePattern variant="separator" className="my-1" />

      {/* ─── Carte thermique ──────────────────────────────────────────────── */}
      <section aria-label="Carte thermique des effectifs" className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-base font-semibold tracking-tight text-forest">
            Carte thermique
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full border border-emerald-400 bg-emerald-500" />
              &lt; 70 %
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full border border-amber-400 bg-amber-500" />
              70-90 %
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-full border border-rose-400 bg-rose-500" />
              &gt; 90 %
            </span>
          </div>
        </div>
        <GlassCard variant="adaptive" noHover noAnimation>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {classes.map((c, idx) => {
              const pleine = c.effectif >= c.effectif_max;
              const niveau = niveauRemplissage(
                c.taux_remplissage,
                pleine,
              );
              return (
                <HeatmapTile
                  key={c.classe_id}
                  classe={c}
                  niveau={niveau}
                  pleine={pleine}
                  index={idx}
                />
              );
            })}
          </div>
        </GlassCard>
      </section>
    </EffectifsShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell (hero header premium + KentePattern strip / separator)
// ─────────────────────────────────────────────────────────────────────────────

function EffectifsShell({
  children,
  etablissementNom,
}: {
  children: React.ReactNode;
  etablissementNom?: string;
}) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <KentePattern variant="strip" position="top" />

      {/* ─── Hero header premium ──────────────────────────────────────── */}
      <GlassCard variant="desktop" noHover className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Badge rond gradient emerald→gold avec icône BarChart3 */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <BarChart3 className="size-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                  Effectifs
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Tableau de bord de remplissage des classes par cycle et par
                niveau.
              </p>
              {etablissementNom ? (
                <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {etablissementNom}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </GlassCard>

      <KentePattern variant="separator" className="my-1" />

      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tuile de carte thermique (motion.div avec stagger delay index*0.03)
// ─────────────────────────────────────────────────────────────────────────────

function HeatmapTile({
  classe,
  niveau,
  pleine,
  index = 0,
}: {
  classe: EffectifClasse;
  niveau: RemplissageNiveau;
  pleine: boolean;
  index?: number;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const animationProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.35,
          delay: Math.min(index * 0.03, 0.6),
          ease: [0.22, 1, 0.36, 1] as const,
        },
      };
  return (
    <motion.div
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-3 shadow-sm transition-transform hover:scale-[1.03]",
        HEATMAP_TILE_CLS[niveau],
      )}
      title={`${classe.classe_libelle} — ${classe.effectif}/${classe.effectif_max} (${formatTaux(
        classe.taux_remplissage,
      )})`}
      {...animationProps}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="break-words text-xs font-semibold leading-tight">
          {classe.classe_libelle}
        </p>
        {pleine ? (
          <span
            className="shrink-0 rounded-full bg-terracotta px-1.5 py-0 text-[9px] font-bold uppercase tracking-wide text-white"
            aria-label="Classe pleine"
          >
            Pleine
          </span>
        ) : null}
      </div>
      <p className="text-3xl font-bold leading-none tabular-nums">
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
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// États vides premium (KentePattern bg + badge rond coloré + icône Lucide)
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  tone,
  title,
  description,
}: {
  icon: React.ElementType;
  tone: "emerald" | "amber" | "rose";
  title: string;
  description: string;
}) {
  const cls = {
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  }[tone];
  return (
    <GlassCard
      variant="adaptive"
      noHover
      className="relative overflow-hidden"
    >
      <KentePattern variant="bg" />
      <div className="relative flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-full",
            cls,
          )}
        >
          <Icon className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="font-display text-base font-semibold text-forest">
            {title}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading state premium (KentePattern strip top + Loader2 centré)
// ─────────────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-40 rounded-lg" />
      <Skeleton className="h-72 w-full rounded-xl" />
      <Skeleton className="h-10 w-40 rounded-lg" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <GlassCard
        variant="adaptive"
        noHover
        noAnimation
        className="relative overflow-hidden p-0"
      >
        <KentePattern variant="strip" position="top" />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-emerald-600 dark:text-emerald-400" />
        </div>
      </GlassCard>
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
