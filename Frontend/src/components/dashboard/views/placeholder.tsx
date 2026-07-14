"use client";

/**
 * ScolaGest — Squelette de vue "à venir".
 *
 * Utilisé par toutes les vues placeholder de Phase 1 pour rester visuellement
 * cohérentes entre elles. Affiche un titre, un badge de phase, une description
 * et une zone d'actions optionnelle.
 */

import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ds/glass-card";
import { Badge } from "@/components/ui/badge";

interface PlaceholderViewProps {
  title: string;
  description: string;
  icon: LucideIcon;
  phase: string;
  bullets?: string[];
  accent?: "emerald" | "amber";
}

export function PlaceholderView({
  title,
  description,
  icon: Icon,
  phase,
  bullets = [],
  accent = "emerald",
}: PlaceholderViewProps) {
  const iconBg =
    accent === "emerald" ? "bg-emerald-600" : "bg-amber-500";
  const phaseBadge =
    accent === "emerald"
      ? "border-emerald-300 text-emerald-700"
      : "border-amber-300 text-amber-700";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${iconBg} text-white shadow-sm`}
          >
            <Icon className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Badge variant="outline" className={`w-fit ${phaseBadge}`}>
          À venir · {phase}
        </Badge>
      </div>

      <GlassCard variant="adaptive" noHover className="overflow-hidden border-dashed p-0">
        <div className="border-b border-emerald-100/60 px-5 py-4">
          <h2 className="flex items-center gap-2 font-display text-base font-semibold text-forest">
            <span className="size-2 rounded-full bg-amber-500" />
            Module en cours de développement
          </h2>
        </div>
        <div className="space-y-4 p-5">
          <p className="text-sm text-muted-foreground">
            Cet écran fait partie du périmètre <strong>{phase}</strong> de
            ScolaGest. La structure de navigation et le squelette de l&apos;UI
            sont en place ; les fonctionnalités seront ajoutées lorsque cette
            phase démarrera.
          </p>
          {bullets.length > 0 && (
            <ul className="grid gap-2 sm:grid-cols-2">
              {bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs"
                >
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
