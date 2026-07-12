"use client";

/**
 * ScolaGest — Carte « Soldes & paiements » d'un élève (Phase 3 — Refonte).
 *
 * Affichée dans la fiche détail d'un élève :
 *  - 3 StatCard horizontales (Attendu, Payé, Restant) avec tons neutre /
 *    emerald / amber (si restant > 0) ou emerald (si soldé).
 *  - Tableau des frais attendus (GlassCard sub-section).
 *  - Échéances à venir (badge + montant restant).
 *  - Timeline verticale des 5 derniers paiements (icône + ligne + content).
 *  - Bouton « Voir tout l'historique » (callback `onShowHistory`).
 *
 * États : chargement, erreur, solde indisponible (élève sans frais).
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query, query keys soldesKeys /
 * paiementsKeys, fetchSoldeEleve, fetchPaiements, types SoldeEleve / Paiement.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  AlertCircle,
  ReceiptText,
  History,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarClock,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  fetchSoldeEleve,
  fetchPaiements,
  soldesKeys,
  paiementsKeys,
} from "@/lib/api-caisse";
import { formatFCFA, formatDateShort, formatTime } from "@/lib/format";
import type { SoldeEleve } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GlassCard } from "@/components/ds/glass-card";
import { StatCard } from "@/components/ds/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ModePaiementBadge,
  StatutPaiementBadge,
  TypeFraisBadge,
} from "@/components/caisse/caisse-badges";

export interface EleveSoldeCardProps {
  eleveId: string;
  /** Callback pour ouvrir l'historique complet (ex : naviguer vers la caisse). */
  onShowHistory?: () => void;
}

export function EleveSoldeCard({
  eleveId,
  onShowHistory,
}: EleveSoldeCardProps) {
  // Solde
  const {
    data: solde,
    isLoading,
    isError,
  } = useQuery({
    queryKey: soldesKeys.eleve(eleveId),
    queryFn: () => fetchSoldeEleve(eleveId),
    enabled: !!eleveId,
    retry: 0,
  });

  // 5 derniers paiements
  const { data: paiementsData, isLoading: loadingPaiements } = useQuery({
    queryKey: paiementsKeys.list({ eleve_id: eleveId, page: 1, page_size: 5 }),
    queryFn: () =>
      fetchPaiements({ eleve_id: eleveId, page: 1, page_size: 5 }),
    enabled: !!eleveId,
    retry: 0,
  });
  const derniersPaiements = paiementsData?.data ?? [];

  return (
    <GlassCard variant="adaptive" noHover className="overflow-hidden">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
          <Wallet className="size-4" />
        </div>
        <h3 className="font-display text-base font-semibold">
          Soldes &amp; paiements
        </h3>
      </div>
      <div className="space-y-4">
        {isLoading ? (
          <SoldeSkeleton />
        ) : isError || !solde ? (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
            <AlertCircle className="size-4" />
            Solde indisponible. Le backend renvoie peut-être une erreur ou
            l&apos;élève n&apos;a aucun frais attendu pour l&apos;année active.
          </div>
        ) : (
          <SoldeBody solde={solde} />
        )}

        {/* Derniers paiements — timeline verticale */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-display flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <History className="size-3.5" />
              Derniers paiements
            </h4>
            {onShowHistory ? (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-emerald-700 dark:text-emerald-300"
                onClick={onShowHistory}
              >
                Voir tout l&apos;historique →
              </Button>
            ) : null}
          </div>
          {loadingPaiements ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : derniersPaiements.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/20 px-3 py-6 text-center">
              <ReceiptText className="mx-auto mb-1.5 size-5 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                Aucun paiement enregistré pour cet élève.
              </p>
            </div>
          ) : (
            <ol className="relative space-y-2 border-l-2 border-emerald-100 pl-4 dark:border-emerald-900/40">
              {derniersPaiements.map((p) => (
                <li key={p.id} className="relative">
                  <span
                    className={cn(
                      "absolute -left-[22px] top-2 flex size-3 items-center justify-center rounded-full border-2 bg-white dark:bg-emerald-950",
                      p.statut === "VALIDE"
                        ? "border-emerald-600"
                        : p.statut === "EN_ATTENTE"
                          ? "border-amber-500"
                          : "border-destructive",
                    )}
                    aria-hidden="true"
                  />
                  <div className="flex flex-col gap-1.5 rounded-lg border border-muted bg-muted/20 p-2.5 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40 dark:hover:border-emerald-900/40 dark:hover:bg-emerald-950/20 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {p.frais?.libelle ?? p.echeance?.libelle ?? "Paiement"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDateShort(p.date_paiement)}{" "}
                        {formatTime(p.date_paiement)} ·{" "}
                        <span className="font-mono">{p.numero_recu}</span>
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <ModePaiementBadge mode={p.mode_paiement} />
                        {p.statut !== "VALIDE" ? (
                          <StatutPaiementBadge statut={p.statut} />
                        ) : null}
                      </div>
                    </div>
                    <span className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-300 sm:shrink-0">
                      +{formatFCFA(p.montant)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {onShowHistory ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            onClick={onShowHistory}
          >
            <ReceiptText className="size-3.5" />
            Ouvrir la caisse (historique complet)
          </Button>
        ) : null}
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

function SoldeBody({ solde }: { solde: SoldeEleve }) {
  const isSolde = solde.solde_du <= 0;
  const restantTone = isSolde ? "emerald" : "amber";

  return (
    <div className="space-y-4">
      {/* 3 StatCard horizontales */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={ArrowDownCircle}
          tone="forest"
          label="Attendu"
          value={
            <span className="font-mono text-base">
              {formatFCFA(solde.total_attendu)}
            </span>
          }
          hint="Année active"
          delay={0}
        />
        <StatCard
          icon={ArrowUpCircle}
          tone="emerald"
          label="Payé"
          value={
            <span className="font-mono text-base">
              {formatFCFA(solde.total_paye)}
            </span>
          }
          hint="Encaissements validés"
          delay={0.05}
        />
        <StatCard
          icon={Wallet}
          tone={restantTone}
          label="Restant"
          value={
            <span className="font-mono text-base">
              {formatFCFA(solde.solde_du)}
            </span>
          }
          hint={isSolde ? "Soldé ✓" : "À recouvrer"}
          delay={0.1}
        />
      </div>

      {/* Tableau des frais attendus — sub-section */}
      {solde.frais_attendus.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center">
          <Wallet className="mx-auto mb-1.5 size-5 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">
            Aucun frais attendu pour cet élève (année active).
          </p>
        </div>
      ) : (
        <GlassCard variant="mobile" noHover noAnimation className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="text-[11px]">Type</TableHead>
                  <TableHead className="text-[11px]">Libellé</TableHead>
                  <TableHead className="text-right text-[11px]">Attendu</TableHead>
                  <TableHead className="text-right text-[11px]">Payé</TableHead>
                  <TableHead className="text-right text-[11px]">Solde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solde.frais_attendus.map((sf) => (
                  <TableRow
                    key={sf.frais_id}
                    className="hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20"
                  >
                    <TableCell>
                      <TypeFraisBadge type={sf.type_frais} />
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {sf.libelle}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatFCFA(sf.montant_attendu)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatFCFA(sf.montant_paye)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "font-mono text-xs font-semibold",
                          sf.solde <= 0
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {formatFCFA(sf.solde)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      )}

      {/* Échéances à venir */}
      {solde.echeances_a_venir.length > 0 ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <CalendarClock className="size-3.5" />
            Échéances à venir
          </p>
          <ul className="space-y-1">
            {solde.echeances_a_venir.slice(0, 3).map((e) => (
              <li
                key={e.echeance_id}
                className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs transition-colors hover:border-emerald-200 hover:bg-emerald-50/30 dark:hover:border-emerald-900/40 dark:hover:bg-emerald-950/20"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{e.libelle}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDateShort(e.date_limite)} ·{" "}
                    {formatFCFA(e.montant - e.montant_paye)} restant
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-medium",
                    e.statut === "PAYE"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : e.statut === "EN_RETARD"
                        ? "border-rose-200 bg-rose-50 text-rose-700"
                        : e.statut === "PARTIEL"
                          ? "border-amber-200 bg-amber-50 text-amber-700"
                          : "border-muted-foreground/20 bg-muted text-muted-foreground",
                  )}
                >
                  {e.statut === "PAYE"
                    ? "Payée"
                    : e.statut === "EN_RETARD"
                      ? "En retard"
                      : e.statut === "PARTIEL"
                        ? "Partielle"
                        : "À venir"}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function SoldeSkeleton() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
      <div className="space-y-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}
