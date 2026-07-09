"use client";

/**
 * ScolaGest — Badges partagés du module Caisse (Phase 3).
 *
 * Badges colorés pour : mode de paiement, statut de paiement, statut
 * d'échéance, type de frais. Couleurs :
 *  - emerald : espèces / validé / payé / inscription
 *  - amber    : chèque / en attente / partiel / examen
 *  - orange   : mobile money
 *  - muted    : virement / scolarité / annexe
 *  - rose     : annulé / en retard
 */

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type {
  ModePaiement,
  StatutEcheance,
  StatutPaiement,
  TypeFrais,
} from "@/lib/types";

const MODE_LABEL: Record<ModePaiement, string> = {
  ESPECES: "Espèces",
  CHEQUE: "Chèque",
  VIREMENT: "Virement",
  MOBILE_MONEY: "Mobile Money",
};

const MODE_CLS: Record<ModePaiement, string> = {
  ESPECES:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  CHEQUE:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  VIREMENT:
    "border-muted-foreground/20 bg-muted text-muted-foreground",
  MOBILE_MONEY:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300",
};

export function ModePaiementBadge({ mode }: { mode: ModePaiement }) {
  return (
    <Badge variant="outline" className={cn("font-medium", MODE_CLS[mode])}>
      {MODE_LABEL[mode]}
    </Badge>
  );
}

const STATUT_PAIEMENT_LABEL: Record<StatutPaiement, string> = {
  VALIDE: "Validé",
  ANNULE: "Annulé",
  EN_ATTENTE: "En attente",
};

const STATUT_PAIEMENT_CLS: Record<StatutPaiement, string> = {
  VALIDE:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  ANNULE:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
  EN_ATTENTE:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
};

export function StatutPaiementBadge({ statut }: { statut: StatutPaiement }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STATUT_PAIEMENT_CLS[statut])}
    >
      {STATUT_PAIEMENT_LABEL[statut]}
    </Badge>
  );
}

const STATUT_ECHEANCE_LABEL: Record<StatutEcheance, string> = {
  PAYE: "Payée",
  PARTIEL: "Partielle",
  EN_RETARD: "En retard",
  A_VENIR: "À venir",
};

const STATUT_ECHEANCE_CLS: Record<StatutEcheance, string> = {
  PAYE:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  PARTIEL:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  EN_RETARD:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
  A_VENIR:
    "border-muted-foreground/20 bg-muted text-muted-foreground",
};

export function StatutEcheanceBadge({ statut }: { statut: StatutEcheance }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", STATUT_ECHEANCE_CLS[statut])}
    >
      {STATUT_ECHEANCE_LABEL[statut]}
    </Badge>
  );
}

const TYPE_FRAIS_LABEL: Record<TypeFrais, string> = {
  INSCRIPTION: "Inscription",
  SCOLARITE: "Scolarité",
  EXAMEN: "Examen",
  ANNEXE: "Annexe",
};

const TYPE_FRAIS_CLS: Record<TypeFrais, string> = {
  INSCRIPTION:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  SCOLARITE:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300",
  EXAMEN:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  ANNEXE:
    "border-muted-foreground/20 bg-muted text-muted-foreground",
};

export function TypeFraisBadge({ type }: { type: TypeFrais }) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", TYPE_FRAIS_CLS[type])}
    >
      {TYPE_FRAIS_LABEL[type]}
    </Badge>
  );
}

export { TYPE_FRAIS_LABEL, MODE_LABEL, STATUT_PAIEMENT_LABEL };
