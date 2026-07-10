"use client";

/**
 * ScolaGest — Badges partagés Mobile Money (Phase 5).
 *
 * Couleurs sémantiques (pas de bleu/indigo) :
 *  - ORANGE_MONEY  → orange
 *  - MTN_MONEY     → amber (jaune MTN)
 *  - WAVE          → slate (gris-bleu neutre, pas indigo)
 *
 * Statuts transaction :
 *  - REUSSIE / DELIVRE  → emerald
 *  - INITIEE / EN_COURS / EN_ATTENTE → amber
 *  - ECHEC / REMBOURSEE → rose
 */

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type {
  ProviderMomo,
  StatutTransactionMomo,
} from "@/lib/types";

const PROVIDER_LABEL: Record<ProviderMomo, string> = {
  ORANGE_MONEY: "Orange Money",
  MTN_MONEY: "MTN Money",
  WAVE: "Wave",
};

const PROVIDER_CLS: Record<ProviderMomo, string> = {
  ORANGE_MONEY:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300",
  MTN_MONEY:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  WAVE:
    "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
};

export function ProviderMomoBadge({ provider }: { provider: ProviderMomo }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", PROVIDER_CLS[provider])}
    >
      {PROVIDER_LABEL[provider]}
    </Badge>
  );
}

export const PROVIDER_MOMO_LABEL = PROVIDER_LABEL;

const STATUT_LABEL: Record<StatutTransactionMomo, string> = {
  INITIEE: "Initiée",
  EN_COURS: "En cours",
  REUSSIE: "Réussie",
  ECHEC: "Échec",
  REMBOURSEE: "Remboursée",
};

const STATUT_CLS: Record<StatutTransactionMomo, string> = {
  INITIEE:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  EN_COURS:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  REUSSIE:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  ECHEC:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
  REMBOURSEE:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
};

export function StatutMomoBadge({
  statut,
}: {
  statut: StatutTransactionMomo;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STATUT_CLS[statut])}
    >
      {STATUT_LABEL[statut]}
    </Badge>
  );
}

export const STATUT_MOMO_LABEL = STATUT_LABEL;
