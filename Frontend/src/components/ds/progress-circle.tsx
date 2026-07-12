"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

export interface ProgressCircleProps {
  /** Valeur 0-100. */
  value: number;
  /** Taille du SVG en px (défaut 120). */
  size?: number;
  /** Épaisseur du stroke (défaut 10). */
  strokeWidth?: number;
  /** Label central (défaut : "{value}%"). */
  label?: React.ReactNode;
  /** Couleur du track (cercle de fond). */
  trackColor?: string;
  /** Classe supplémentaire. */
  className?: string;
}

/**
 * ProgressCircle — cercle de progression animé Forêt EdTech.
 *
 * Gradient stroke emerald→amber (primaire→secondaire). Animation d'entrée
 * via Framer Motion (1.5s easeInOut). Respecte prefers-reduced-motion.
 *
 * Utilisation : taux de recouvrement, completion, KPIs circulaires.
 */
export function ProgressCircle({
  value,
  size = 120,
  strokeWidth = 10,
  label,
  trackColor = "rgba(4, 120, 87, 0.15)",
  className,
}: ProgressCircleProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const clampedValue = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clampedValue / 100) * circumference;
  const gradientId = React.useId();

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#047857" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={prefersReducedMotion ? { strokeDashoffset: offset } : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 1.5, ease: "easeInOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold font-display text-forest">
          {label ?? `${clampedValue}%`}
        </span>
      </div>
    </div>
  );
}

export default ProgressCircle;
