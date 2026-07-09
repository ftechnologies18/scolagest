"use client";

/**
 * ScolaGest — Carte « Soldes & paiements » d'un élève (Phase 3).
 *
 * Affichée dans la fiche détail d'un élève :
 *  - totaux (attendu / payé / restant)
 *  - tableau des frais attendus (type, libellé, attendu, payé, solde)
 *  - 5 derniers paiements
 *  - bouton « Voir tout l'historique » (callback `onShowHistory`)
 *
 * États : chargement, erreur, solde indisponible (élève sans frais).
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  Loader2,
  AlertCircle,
  ReceiptText,
  History,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wallet className="size-4 text-emerald-600" />
          Soldes &amp; paiements
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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

        {/* Derniers paiements */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <History className="size-3.5" />
              Derniers paiements
            </h3>
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
            <div className="space-y-1.5">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : derniersPaiements.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
              Aucun paiement enregistré pour cet élève.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {derniersPaiements.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      {p.frais?.libelle ?? p.echeance?.libelle ?? "Paiement"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatDateShort(p.date_paiement)}{" "}
                      {formatTime(p.date_paiement)} ·{" "}
                      <span className="font-mono">{p.numero_recu}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      {formatFCFA(p.montant)}
                    </span>
                    <ModePaiementBadge mode={p.mode_paiement} />
                    {p.statut !== "VALIDE" ? (
                      <StatutPaiementBadge statut={p.statut} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {onShowHistory ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50"
            onClick={onShowHistory}
          >
            <ReceiptText className="size-3.5" />
            Ouvrir la caisse (historique complet)
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

function SoldeBody({ solde }: { solde: SoldeEleve }) {
  const isSolde = solde.solde_du <= 0;
  return (
    <div className="space-y-3">
      {/* Totaux */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border bg-muted/20 p-2">
          <p className="text-[10px] uppercase text-muted-foreground">
            Attendu
          </p>
          <p className="font-mono text-sm font-semibold">
            {formatFCFA(solde.total_attendu)}
          </p>
        </div>
        <div className="rounded-lg border bg-emerald-50 p-2 dark:bg-emerald-950/20">
          <p className="text-[10px] uppercase text-emerald-700 dark:text-emerald-300">
            Payé
          </p>
          <p className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            {formatFCFA(solde.total_paye)}
          </p>
        </div>
        <div
          className={cn(
            "rounded-lg border p-2",
            isSolde
              ? "bg-emerald-50 dark:bg-emerald-950/20"
              : "bg-amber-50 dark:bg-amber-950/20",
          )}
        >
          <p
            className={cn(
              "text-[10px] uppercase",
              isSolde
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-amber-700 dark:text-amber-300",
            )}
          >
            Restant
          </p>
          <p
            className={cn(
              "font-mono text-sm font-bold",
              isSolde
                ? "text-emerald-700 dark:text-emerald-300"
                : "text-amber-700 dark:text-amber-300",
            )}
          >
            {formatFCFA(solde.solde_du)}
          </p>
        </div>
      </div>

      {/* Tableau des frais */}
      {solde.frais_attendus.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
          Aucun frais attendu pour cet élève (année active).
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="text-[11px]">Type</TableHead>
                <TableHead className="text-[11px]">Libellé</TableHead>
                <TableHead className="text-right text-[11px]">Attendu</TableHead>
                <TableHead className="text-right text-[11px]">Payé</TableHead>
                <TableHead className="text-right text-[11px]">Solde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {solde.frais_attendus.map((sf) => (
                <TableRow key={sf.frais_id}>
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
      )}

      {/* Échéances à venir */}
      {solde.echeances_a_venir.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase text-muted-foreground">
            Échéances à venir
          </p>
          <ul className="space-y-1">
            {solde.echeances_a_venir.slice(0, 3).map((e) => (
              <li
                key={e.echeance_id}
                className="flex items-center justify-between rounded-md border px-2 py-1.5 text-xs"
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
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
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
