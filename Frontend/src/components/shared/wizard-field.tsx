"use client";

/**
 * ScolaGest — Composants partagés pour les wizards (pré-inscription publique +
 * inscription staff).
 *
 * Extraits depuis `pre-inscription-form.tsx` (réforme 2026-07) afin d'uniformiser
 * le rendu des labels/champs et des en-têtes de section entre les deux wizards.
 *
 * NB : les wizards existants conservent leurs propres `Field` / `SectionHeader`
 * internes (par mimétisme historique). Ces composants partagés sont posés pour
 * usage futur — toute nouvelle étape devrait les importer plutôt que de
 * redéclarer une énième copie.
 */

import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { Label } from "@/components/ui/label";

// ─────────────────────────────────────────────────────────────────────────────
// Field — conteneur label + contrôle + hint
// ─────────────────────────────────────────────────────────────────────────────

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium leading-snug">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </Label>
      {children}
      {hint && (
        <p className="break-words text-xs leading-snug text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SectionHeader — icône + titre + description
// ─────────────────────────────────────────────────────────────────────────────

export function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/15 to-amber-500/15 text-emerald-700 dark:text-emerald-300">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 space-y-0.5">
        <h2 className="break-words font-display text-base font-semibold leading-tight text-forest sm:text-lg">
          {title}
        </h2>
        {description && (
          <p className="break-words text-xs leading-snug text-muted-foreground sm:text-sm">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
