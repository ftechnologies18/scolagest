"use client";

/**
 * ScolaGest — Tableau de bord caisse (Phase 3 — amélioration).
 *
 * Affiche :
 *  - 4 cartes KPI en grille responsive (1 → 2 → 4 cols) :
 *      1. Total encaissé (emerald, gros chiffre FCFA, Wallet)
 *      2. Nb transactions (sky, Receipt)
 *      3. File d'attente (amber, Users, cliquable → `onJumpToFileAttente`)
 *      4. Annulations (rose, XCircle)
 *  - Répartition par mode : barres horizontales colorées (espèces=emerald,
 *    MoMo=amber, chèque=sky, virement=slate) avec label + montant + %.
 *  - Derniers encaissements : liste des 5 derniers (n° reçu, élève, montant,
 *    mode, heure).
 *
 * Polling 30s sur `fetchDashboardCaisse`. États loading / error.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  Receipt,
  Users,
  XCircle,
  AlertCircle,
  RefreshCw,
  Clock,
  ArrowRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchDashboardCaisse,
  type DashboardCaisse,
  type RepartitionModeCaisse,
} from "@/lib/api-caisse";
import { formatFCFA, formatTime } from "@/lib/format";
import type { ModePaiement } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─────────────────────────────────────────────────────────────────────────────
// Clés React Query dédiées (exportées pour invalidation croisée)
// ─────────────────────────────────────────────────────────────────────────────

export const dashboardCaisseKeys = {
  all: ["caisse", "dashboard"] as const,
  today: () => [...dashboardCaisseKeys.all, "today"] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers locaux
// ─────────────────────────────────────────────────────────────────────────────

/** Couleurs (barre + tintes) selon le mode de paiement. */
const MODE_REPARTITION: Record<
  string,
  { label: string; bar: string; track: string; text: string }
> = {
  ESPECES: {
    label: "Espèces",
    bar: "bg-emerald-500",
    track: "bg-emerald-100 dark:bg-emerald-950/40",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  MOBILE_MONEY: {
    label: "Mobile Money",
    bar: "bg-amber-500",
    track: "bg-amber-100 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
  },
  CHEQUE: {
    label: "Chèque",
    bar: "bg-sky-500",
    track: "bg-sky-100 dark:bg-sky-950/40",
    text: "text-sky-700 dark:text-sky-300",
  },
  VIREMENT: {
    label: "Virement",
    bar: "bg-slate-500",
    track: "bg-slate-100 dark:bg-slate-900/40",
    text: "text-slate-700 dark:text-slate-300",
  },
};

function modeStyle(mode: string): {
  label: string;
  bar: string;
  track: string;
  text: string;
} {
  return (
    MODE_REPARTITION[mode] ?? {
      label: mode || "Autre",
      bar: "bg-slate-400",
      track: "bg-slate-100 dark:bg-slate-900/40",
      text: "text-slate-700 dark:text-slate-300",
    }
  );
}

const MODE_LABEL_SHORT: Record<ModePaiement, string> = {
  ESPECES: "Espèces",
  CHEQUE: "Chèque",
  VIREMENT: "Virement",
  MOBILE_MONEY: "MoMo",
};

// ─────────────────────────────────────────────────────────────────────────────
// Cartes KPI
// ─────────────────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  tone: "emerald" | "sky" | "amber" | "rose";
  onClick?: () => void;
  clickable?: boolean;
}

const TONE_CLS: Record<
  KpiCardProps["tone"],
  { icon: string; ring: string; value: string; hover: string }
> = {
  emerald: {
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    ring: "border-emerald-200/60 dark:border-emerald-900/40",
    value: "text-emerald-700 dark:text-emerald-300",
    hover: "hover:border-emerald-400/60 hover:shadow-md",
  },
  sky: {
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    ring: "border-sky-200/60 dark:border-sky-900/40",
    value: "text-sky-700 dark:text-sky-300",
    hover: "hover:border-sky-400/60 hover:shadow-md",
  },
  amber: {
    icon: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    ring: "border-amber-200/60 dark:border-amber-900/40",
    value: "text-amber-700 dark:text-amber-300",
    hover: "hover:border-amber-400/60 hover:shadow-md",
  },
  rose: {
    icon: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    ring: "border-rose-200/60 dark:border-rose-900/40",
    value: "text-rose-700 dark:text-rose-300",
    hover: "hover:border-rose-400/60 hover:shadow-md",
  },
};

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  onClick,
  clickable,
}: KpiCardProps) {
  const cls = TONE_CLS[tone];
  const inner = (
    <CardContent className="flex items-start gap-3 p-4">
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          cls.icon,
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className={cn("mt-0.5 text-xl font-bold tabular-nums sm:text-2xl", cls.value)}>
          {value}
        </p>
        {hint ? (
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {hint}
          </p>
        ) : null}
      </div>
      {clickable ? (
        <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground" />
      ) : null}
    </CardContent>
  );

  if (clickable) {
    return (
      <Card
        className={cn(
          "cursor-pointer text-left transition-all",
          cls.ring,
          cls.hover,
        )}
      >
        <button
          type="button"
          onClick={onClick}
          className="block h-full w-full text-left"
        >
          {inner}
        </button>
      </Card>
    );
  }
  return (
    <Card className={cn("transition-all", cls.ring)}>
      {inner}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Barre de répartition par mode
// ─────────────────────────────────────────────────────────────────────────────

function RepartitionBar({
  item,
}: {
  item: RepartitionModeCaisse;
}) {
  const style = modeStyle(item.mode);
  const pct = Math.max(0, Math.min(100, item.pourcentage ?? 0));
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={cn("size-2 shrink-0 rounded-full", style.bar)}
            aria-hidden
          />
          <span className="truncate text-xs font-medium">{item.label || style.label}</span>
          <span className="text-[11px] text-muted-foreground">
            ({item.nb} tx)
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xs font-semibold tabular-nums">
            {formatFCFA(item.montant)}
          </span>
          <span className={cn("text-[11px] font-medium tabular-nums", style.text)}>
            {pct.toFixed(1)}%
          </span>
        </div>
      </div>
      <div
        className={cn("h-2 w-full overflow-hidden rounded-full", style.track)}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn("h-full rounded-full transition-all", style.bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ligne « dernier encaissement »
// ─────────────────────────────────────────────────────────────────────────────

function DernierPaiementRow({
  paiement,
}: {
  paiement: DashboardCaisse["derniers_paiements"][number];
}) {
  const style = modeStyle(paiement.mode_paiement);
  return (
    <li className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-accent/40">
      <div
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          style.track,
        )}
      >
        <Receipt className={cn("size-4", style.text)} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {paiement.eleve_prenoms} {paiement.eleve_nom}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          <span className="font-mono">{paiement.numero_recu}</span>
          {paiement.frais_libelle ? (
            <>
              <span className="mx-1 text-muted-foreground/50">·</span>
              {paiement.frais_libelle}
            </>
          ) : null}
        </p>
      </div>
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
          {formatFCFA(paiement.montant)}
        </span>
        <div className="flex items-center gap-1">
          <span
            className={cn(
              "rounded-md px-1.5 py-0 text-[10px] font-medium",
              style.track,
              style.text,
            )}
          >
            {style.label}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
            <Clock className="size-2.5" />
            {formatTime(paiement.heure)}
          </span>
        </div>
      </div>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export interface DashboardCaissePanelProps {
  /** Callback optionnel pour naviguer vers l'onglet « File d'attente ». */
  onJumpToFileAttente?: () => void;
}

export function DashboardCaissePanel({
  onJumpToFileAttente,
}: DashboardCaissePanelProps) {
  const etablissement = useAuthStore((s) => s.etablissement);

  const {
    data: dash,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: dashboardCaisseKeys.today(),
    queryFn: () => fetchDashboardCaisse(),
    enabled: !!etablissement,
    refetchInterval: 30_000, // polling toutes les 30s
    refetchOnWindowFocus: true,
  });

  // Pas d'établissement
  if (!etablissement) {
    return (
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20">
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <AlertCircle className="size-8 text-amber-600" />
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Aucun établissement sélectionné
          </p>
          <p className="max-w-md text-xs text-muted-foreground">
            Sélectionnez un établissement dans la barre latérale pour voir le
            tableau de bord de la caisse.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Chargement initial
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Erreur
  if (isError) {
    return (
      <Card className="border-rose-200 bg-rose-50/50 dark:border-rose-900/40 dark:bg-rose-950/20">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <AlertCircle className="size-8 text-rose-600" />
          <p className="text-sm font-medium text-rose-800 dark:text-rose-200">
            Impossible de charger le tableau de bord
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
          >
            <RefreshCw className="mr-1.5 size-3.5" />
            Réessayer
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalEncaisse = dash?.total_encaisse ?? 0;
  const nbTransactions = dash?.nb_transactions ?? 0;
  const fileAttenteCount = dash?.file_attente_count ?? 0;
  const nbAnnulations = dash?.nb_annulations ?? 0;
  const repartition = dash?.repartition_modes ?? [];
  const derniers = dash?.derniers_paiements ?? [];
  const panierMoyen =
    nbTransactions > 0 ? Math.round(totalEncaisse / nbTransactions) : 0;

  return (
    <div className="space-y-4">
      {/* Bandeau refresh */}
      <div className="flex items-center justify-between">
        <Badge
          variant="outline"
          className="border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          <Clock className="mr-1 size-3" />
          Actualisé toutes les 30s
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-muted-foreground"
        >
          <RefreshCw
            className={cn("mr-1.5 size-3.5", isFetching && "animate-spin")}
          />
          Actualiser
        </Button>
      </div>

      {/* 4 cartes KPI */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Wallet}
          label="Total encaissé"
          value={formatFCFA(totalEncaisse)}
          hint={panierMoyen > 0 ? `Panier moyen ${formatFCFA(panierMoyen)}` : "Aujourd'hui"}
          tone="emerald"
        />
        <KpiCard
          icon={Receipt}
          label="Transactions"
          value={String(nbTransactions)}
          hint="Encaissements validés du jour"
          tone="sky"
        />
        <KpiCard
          icon={Users}
          label="File d'attente"
          value={String(fileAttenteCount)}
          hint={
            fileAttenteCount > 0
              ? "Élèves à encaisser"
              : "Personne en attente"
          }
          tone="amber"
          clickable={fileAttenteCount > 0 && !!onJumpToFileAttente}
          onClick={
            fileAttenteCount > 0 && onJumpToFileAttente
              ? onJumpToFileAttente
              : undefined
          }
        />
        <KpiCard
          icon={XCircle}
          label="Annulations"
          value={String(nbAnnulations)}
          hint={nbAnnulations > 0 ? "Paiements annulés" : "Aucune annulation"}
          tone="rose"
        />
      </div>

      {/* Répartition + derniers encaissements */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Répartition par mode */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wallet className="size-4 text-emerald-600" />
              Répartition par mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {repartition.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Aucun encaissement aujourd'hui.
              </p>
            ) : (
              repartition.map((item) => (
                <RepartitionBar key={item.mode} item={item} />
              ))
            )}
          </CardContent>
        </Card>

        {/* Derniers encaissements */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Receipt className="size-4 text-sky-600" />
              Derniers encaissements
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {derniers.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                Aucun encaissement pour le moment aujourd'hui.
              </p>
            ) : (
              <ul className="max-h-96 divide-y overflow-y-auto">
                {derniers.map((p) => (
                  <DernierPaiementRow key={p.id} paiement={p} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Petite note : la correspondance mode → label court pour les reçus */}
      <p className="text-[11px] text-muted-foreground">
        Les libellés courts ({Object.values(MODE_LABEL_SHORT).join(", ")}) sont
        utilisés sur les reçus. La file d'attente et le total s'actualisent
        automatiquement toutes les 30 secondes.
      </p>
    </div>
  );
}
