"use client";

/**
 * ScolaGest — Carte KPI réutilisable (Phase 4).
 *
 * Affiche un indicateur clé avec :
 *  - une icône dans un cercle coloré (emerald / amber / rose / sky / orange),
 *  - une grande valeur (FCFA, %, ou nombre),
 *  - un libellé court,
 *  - un sous-titre optionnel,
 *  - une tendance optionnelle (hausse/baisse avec couleur sémantique).
 *
 * Utilisée par le tableau de bord et les vues Rapports.
 */

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ds/glass-card";

export type KpiAccent = "emerald" | "amber" | "rose" | "sky" | "orange" | "slate";

const ACCENT_BG: Record<KpiAccent, string> = {
  emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  sky: "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  orange: "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
};

const TREND_UP_CLS = "text-emerald-600 dark:text-emerald-400";
const TREND_DOWN_CLS = "text-rose-600 dark:text-rose-400";

export interface KpiCardProps {
  /** Libellé court (ex : "Total encaissé"). */
  label: string;
  /** Valeur déjà formatée (ex : "142 350 000 FCFA" ou "84,4 %"). */
  value: string;
  /** Icône Lucide affichée dans le cercle coloré. */
  icon: LucideIcon;
  /** Couleur d'accent (par défaut emerald). */
  accent?: KpiAccent;
  /** Sous-titre optionnel sous la valeur. */
  subtitle?: string;
  /** Texte de tendance (ex : "+8,2 % vs N-1"). */
  trend?: string;
  /** Sens de la tendance : true = hausse (vert), false = baisse (rouge). */
  trendUp?: boolean;
  /** Désactive la marge par défaut (utile dans une grille gérée par le parent). */
  className?: string;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  accent = "emerald",
  subtitle,
  trend,
  trendUp,
  className,
}: KpiCardProps) {
  const trendCls =
    trendUp === undefined ? "" : trendUp ? TREND_UP_CLS : TREND_DOWN_CLS;
  return (
    <GlassCard
      variant="adaptive"
      noHover
      className={cn("overflow-hidden p-5", className)}
    >
      <motion.div
        initial={false}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.2 }}
        className="h-full"
      >
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-lg",
              ACCENT_BG[accent],
            )}
          >
            <Icon className="size-5" />
          </div>
          {trend ? (
            <span
              className={cn(
                "flex items-center gap-0.5 text-[11px] font-medium",
                trendCls,
              )}
            >
              {trendUp === false ? (
                <ArrowDownRight className="size-3" />
              ) : (
                <ArrowUpRight className="size-3" />
              )}
              {trend}
            </span>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold tracking-tight tabular-nums">
          {value}
        </p>
        {subtitle ? (
          <p className="mt-1 text-[11px] text-muted-foreground">{subtitle}</p>
        ) : null}
      </motion.div>
    </GlassCard>
  );
}

export default KpiCard;
