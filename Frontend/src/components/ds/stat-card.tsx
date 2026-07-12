"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "./glass-card";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

type StatTone = "emerald" | "amber" | "terracotta" | "gold" | "sky" | "forest";

export interface StatCardProps {
  /** Icône Lucide. */
  icon: LucideIcon;
  /** Label court (ex: "Total encaissé"). */
  label: string;
  /** Valeur formatée (ex: "1 250 000 FCFA" ou "42"). */
  value: React.ReactNode;
  /** Tone de l'icône (définit la couleur du badge icône). */
  tone?: StatTone;
  /** Tendance : valeur numérique (ex: 12.5 pour +12.5%). */
  trend?: number;
  /** Inverser la tendance (ex: +impayés = mauvais). */
  invertTrend?: boolean;
  /** Sous-titre optionnel (ex: "ce mois"). */
  hint?: React.ReactNode;
  /** Délai d'animation pour stagger (en secondes). */
  delay?: number;
  className?: string;
  /** Cliqueable (rend la carte interactive). */
  onClick?: () => void;
}

const toneClasses: Record<StatTone, { bg: string; text: string }> = {
  emerald: { bg: "bg-emerald-500/20", text: "text-emerald-700" },
  amber: { bg: "bg-amber-500/20", text: "text-amber-700" },
  terracotta: { bg: "bg-terracotta/20", text: "text-terracotta" },
  gold: { bg: "bg-gold/20", text: "text-gold-dark" },
  sky: { bg: "bg-sky-500/20", text: "text-sky-700" },
  forest: { bg: "bg-forest/15", text: "text-forest" },
};

export function StatCard({
  icon: Icon,
  label,
  value,
  tone = "emerald",
  trend,
  invertTrend = false,
  hint,
  delay = 0,
  className,
  onClick,
}: StatCardProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const toneClass = toneClasses[tone];

  // Tendance : positive = vert, négative = rouge, sauf si invertTrend
  const isPositiveTrend = trend !== undefined ? (invertTrend ? trend < 0 : trend > 0) : null;
  const TrendIcon = isPositiveTrend === null ? null : isPositiveTrend ? TrendingUp : TrendingDown;
  const trendColor = isPositiveTrend === null ? "" : isPositiveTrend ? "bg-emerald-500/20 text-emerald-700" : "bg-terracotta/20 text-terracotta";

  return (
    <GlassCard
      variant="adaptive"
      delay={delay}
      noHover={!onClick}
      className={cn(
        "p-5",
        onClick && "cursor-pointer",
        className
      )}
      onClick={onClick}
      aria-label={onClick ? label : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">
            {label}
          </span>
          <span className="text-2xl font-bold font-display text-foreground truncate">
            {value}
          </span>
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
        <div className={cn("flex size-10 items-center justify-center rounded-lg shrink-0", toneClass.bg)}>
          <Icon className={cn("size-5", toneClass.text)} aria-hidden="true" />
        </div>
      </div>
      {trend !== undefined && TrendIcon && (
        <div className="mt-3 flex items-center gap-2">
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold", trendColor)}>
            <TrendIcon className="size-3" aria-hidden="true" />
            {Math.abs(trend).toFixed(1)}%
          </span>
          <span className="text-xs text-muted-foreground">vs période précédente</span>
        </div>
      )}
    </GlassCard>
  );
}

export default StatCard;
