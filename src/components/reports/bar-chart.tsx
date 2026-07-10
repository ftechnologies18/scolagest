"use client";

/**
 * ScolaGest — Graphique à barres CSS pur (Phase 4).
 *
 * Pas de dépendance externe (pas de recharts) — uniquement des divs Tailwind
 * avec largeurs/hauteurs proportionnelles. Deux modes :
 *
 *  - horizontal (défaut) : barres horizontales empilées verticalement,
 *    étiquette à gauche, valeur(s) à droite. Idéal pour des libellés longs
 *    (cycles, classes, modes de paiement). Supporte une seconde valeur
 *    (comparison attendu vs encaissé) affichée en barre plus claire derrière.
 *
 *  - vertical : barres verticales côte-à-côte, étiquettes sous l'axe.
 *    Idéal pour les séries temporelles (évolution mensuelle).
 *
 * Tooltips au survol via l'attribut `title`.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BarDatum {
  label: string;
  /** Valeur principale (encaissé, montant, etc.). */
  value: number;
  /** Valeur secondaire optionnelle (attendu) — affichée comme barre de fond. */
  value2?: number;
}

export interface BarChartProps {
  data: BarDatum[];
  /** Orientation des barres. */
  orientation?: "horizontal" | "vertical";
  /** Couleur de la valeur principale (classe Tailwind bg-*). */
  color?: string;
  /** Couleur de la valeur secondaire (classe Tailwind bg-*). */
  color2?: string;
  /** Formate la valeur affichée (et le tooltip). */
  formatValue?: (n: number) => string;
  /** Hauteur du graphique (en px). */
  height?: number;
  /** Afficher la légende si `value2` est présent. */
  showLegend?: boolean;
  /** Libellés de légende (seulement si value2 présent). */
  legendLabel?: string;
  legendLabel2?: string;
  /** Classe complémentaire sur la racine. */
  className?: string;
  /** Masquer les valeurs numériques (tooltip seul). */
  hideValues?: boolean;
}

const DEFAULT_COLOR = "bg-emerald-500";
const DEFAULT_COLOR2 = "bg-emerald-200 dark:bg-emerald-900/40";

export function BarChart({
  data,
  orientation = "horizontal",
  color = DEFAULT_COLOR,
  color2 = DEFAULT_COLOR2,
  formatValue = (n) => String(n),
  height = 220,
  showLegend = true,
  legendLabel = "Encaissé",
  legendLabel2 = "Attendu",
  className,
  hideValues = false,
}: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-xs text-muted-foreground",
          className,
        )}
        style={{ height }}
      >
        Aucune donnée à afficher
      </div>
    );
  }

  // Calcul du max pour les proportions
  const max = Math.max(
    1,
    ...data.map((d) => Math.max(d.value ?? 0, d.value2 ?? 0)),
  );

  const hasValue2 = data.some(
    (d) => d.value2 !== undefined && d.value2 !== null,
  );

  return (
    <div className={cn("w-full", className)}>
      {/* Légende (uniquement si value2) */}
      {hasValue2 && showLegend ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", color)} />
            {legendLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-sm", color2)} />
            {legendLabel2}
          </span>
        </div>
      ) : null}

      {orientation === "horizontal" ? (
        <div className="space-y-2.5" style={{ minHeight: height }}>
          {data.map((d, idx) => {
            const w = Math.max(2, (d.value / max) * 100);
            const w2 =
              d.value2 !== undefined && d.value2 !== null
                ? Math.max(2, (d.value2 / max) * 100)
                : 0;
            return (
              <div
                key={`${d.label}-${idx}`}
                className="group grid grid-cols-[110px_1fr_auto] items-center gap-3 text-xs sm:grid-cols-[140px_1fr_auto]"
              >
                <span
                  className="truncate text-muted-foreground"
                  title={d.label}
                >
                  {d.label}
                </span>
                <div className="relative h-5 overflow-hidden rounded-md bg-muted/40">
                  {/* Barre secondaire (attendu) en fond */}
                  {w2 > 0 ? (
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-md",
                        color2,
                      )}
                      style={{ width: `${w2}%` }}
                      title={`${legendLabel2} : ${formatValue(d.value2 ?? 0)}`}
                    />
                  ) : null}
                  {/* Barre principale (encaissé) */}
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-md transition-all duration-300",
                      color,
                    )}
                    style={{ width: `${w}%` }}
                    title={`${legendLabel} : ${formatValue(d.value)}`}
                  />
                </div>
                {!hideValues ? (
                  <span className="font-mono text-[11px] tabular-nums text-foreground/80">
                    {formatValue(d.value)}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="flex items-end gap-2"
          style={{ height }}
        >
          {data.map((d, idx) => {
            const h = Math.max(2, (d.value / max) * 100);
            const h2 =
              d.value2 !== undefined && d.value2 !== null
                ? Math.max(2, (d.value2 / max) * 100)
                : 0;
            return (
              <div
                key={`${d.label}-${idx}`}
                className="group flex flex-1 min-w-0 flex-col items-center gap-1.5"
                title={`${d.label} : ${formatValue(d.value)}`}
              >
                <div className="flex w-full flex-1 items-end justify-center gap-0.5">
                  {h2 > 0 ? (
                    <div
                      className={cn("w-1/2 rounded-t-md", color2)}
                      style={{ height: `${h2}%` }}
                      title={`${legendLabel2} : ${formatValue(d.value2 ?? 0)}`}
                    />
                  ) : null}
                  <div
                    className={cn(
                      "rounded-t-md transition-all duration-300",
                      color,
                      h2 > 0 ? "w-1/2" : "w-full max-w-[36px]",
                    )}
                    style={{ height: `${h}%` }}
                    title={`${legendLabel} : ${formatValue(d.value)}`}
                  />
                </div>
                <span className="truncate text-[10px] text-muted-foreground">
                  {d.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default BarChart;
