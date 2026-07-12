"use client";

/**
 * ScolaGest — Page « Mes bulletins de paie » du portail enseignant
 * (route `/prof/paie`).
 *
 * Affiche la liste des bulletins de paie du prof connecté
 * (`fetchMesBulletins` — route `/api/prof/bulletins`), triés par période
 * décroissante. Chaque ligne : mois/année, salaire brut, salaire net,
 * statut (badge coloré), bouton « Voir détail » (dialog avec tous les
 * détails du bulletin).
 *
 * Pas de RoleGuard — le layout `/prof/layout.tsx` vérifie déjà le rôle
 * ENSEIGNANT et redirige vers `/login` si non authentifié.
 *
 * États gérés : chargement (skeletons), erreur (carte rose + retry), vide
 * (carte emerald « pas encore de bulletins »).
 *
 * Mobile-first : max-w-3xl centré, gros boutons tactiles, cartes empilées
 * avec spacing généreux. Footer sticky assuré par le layout prof.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  RefreshCw,
  AlertTriangle,
  Eye,
  CalendarDays,
  GraduationCap,
  Banknote,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  fetchMesBulletins,
  fetchBulletin,
  STATUT_BULLETIN_LABEL,
  moisLabel,
  type BulletinPaie,
  type StatutBulletin,
} from "@/lib/api-paie";
import { formatFCFA, formatDateTime } from "@/lib/format";
import { profKeys } from "@/lib/api-prof";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─────────────────────────────────────────────────────────────────────────────
// Clés React Query (extension locale pour les bulletins prof)
// ─────────────────────────────────────────────────────────────────────────────

const profBulletinsKeys = {
  all: [...profKeys.all, "bulletins"] as const,
  list: () => [...profBulletinsKeys.all, "list"] as const,
  detail: (id: string) => [...profBulletinsKeys.all, "detail", id] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers d'affichage
// ─────────────────────────────────────────────────────────────────────────────

const STATUT_BULLETIN_BADGE: Record<StatutBulletin, string> = {
  BROUILLON:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  VALIDE:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  PAYE:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
};

/** Trie les bulletins du plus récent au plus ancien (année, puis mois). */
function sortBulletins(list: BulletinPaie[]): BulletinPaie[] {
  return [...list].sort((a, b) => {
    if (b.annee !== a.annee) return b.annee - a.annee;
    return b.mois - a.mois;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfPaiePage() {
  const [detailTarget, setDetailTarget] =
    React.useState<BulletinPaie | null>(null);

  const {
    data: bulletins,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: profBulletinsKeys.list(),
    queryFn: fetchMesBulletins,
    refetchOnWindowFocus: true,
  });

  const sorted = React.useMemo(
    () => sortBulletins(bulletins ?? []),
    [bulletins],
  );

  return (
    <div className="space-y-6">
      {/* Bandeau titre */}
      <section className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
          <Wallet className="size-6 text-emerald-600" />
          Mes bulletins de paie
        </h1>
        <p className="text-sm text-muted-foreground">
          Consultez l&apos;historique de vos bulletins mensuels et le détail de
          vos paiements.
        </p>
      </section>

      {/* Bandeau d'action */}
      <section>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
          <span className="hidden sm:inline">Actualiser</span>
        </Button>
      </section>

      {/* Contenu principal */}
      <section aria-label="Liste des bulletins de paie">
        {isLoading ? (
          <BulletinsSkeleton />
        ) : isError ? (
          <Card className="border-rose-200 bg-rose-50/50">
            <CardHeader className="gap-1.5">
              <CardTitle className="flex items-center gap-2 text-base text-rose-700">
                <AlertTriangle className="size-5" />
                Impossible de charger vos bulletins
              </CardTitle>
              <CardDescription className="text-rose-700/80">
                {error instanceof Error
                  ? error.message
                  : "Une erreur est survenue. Vérifiez votre connexion puis réessayez."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="outline"
                onClick={() => refetch()}
                className="gap-2"
                disabled={isFetching}
              >
                <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
                Réessayer
              </Button>
            </CardContent>
          </Card>
        ) : sorted.length === 0 ? (
          <Card className="border-dashed border-emerald-200 bg-emerald-50/40 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
            <CardHeader className="items-center text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Wallet className="size-6" />
              </div>
              <CardTitle className="text-base">
                Aucun bulletin pour le moment
              </CardTitle>
              <CardDescription className="text-emerald-700/80 dark:text-emerald-300/80">
                Vos bulletins de paie apparaîtront ici dès que la direction
                les aura générés.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
            {/* Vue tableau sur desktop */}
            <Card className="hidden sm:block">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[160px]">Période</TableHead>
                        <TableHead className="text-right">Brut</TableHead>
                        <TableHead className="text-right">Net payé</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Détail</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sorted.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <CalendarDays className="size-4 text-muted-foreground" />
                              <span className="font-medium">
                                {moisLabel(b.mois)}
                              </span>
                              <span className="text-muted-foreground">
                                {b.annee}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                            {formatFCFA(b.salaire_brut)}
                          </TableCell>
                          <TableCell className="text-right text-sm font-bold tabular-nums">
                            {formatFCFA(b.salaire_net)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-medium",
                                STATUT_BULLETIN_BADGE[b.statut],
                              )}
                            >
                              {STATUT_BULLETIN_LABEL[b.statut]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setDetailTarget(b)}
                              className="gap-1"
                            >
                              <Eye className="size-3.5" />
                              Voir
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Vue cartes sur mobile */}
            <div className="space-y-3 sm:hidden">
              {sorted.map((b) => (
                <BulletinMobileCard
                  key={b.id}
                  bulletin={b}
                  onSeeDetails={() => setDetailTarget(b)}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Dialog : détail du bulletin */}
      <BulletinDetailDialog
        bulletin={detailTarget}
        onClose={() => setDetailTarget(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carte mobile pour un bulletin
// ─────────────────────────────────────────────────────────────────────────────

function BulletinMobileCard({
  bulletin,
  onSeeDetails,
}: {
  bulletin: BulletinPaie;
  onSeeDetails: () => void;
}) {
  return (
    <Card className="overflow-hidden border-l-4 border-l-emerald-500 shadow-sm">
      <CardHeader className="gap-2 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="size-4 text-muted-foreground" />
              {moisLabel(bulletin.mois)} {bulletin.annee}
            </CardTitle>
            <CardDescription className="mt-1 flex items-center gap-1.5 text-sm">
              <GraduationCap className="size-3.5" />
              {bulletin.heures_pointees.toFixed(1)} h pointées
            </CardDescription>
          </div>
          <Badge
            variant="outline"
            className={cn("font-medium", STATUT_BULLETIN_BADGE[bulletin.statut])}
          >
            {STATUT_BULLETIN_LABEL[bulletin.statut]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Salaire brut
            </p>
            <p className="font-medium tabular-nums">
              {formatFCFA(bulletin.salaire_brut)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Net à payer
            </p>
            <p className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
              {formatFCFA(bulletin.salaire_net)}
            </p>
          </div>
        </div>
        <Button
          type="button"
          size="lg"
          variant="outline"
          onClick={onSeeDetails}
          className="h-11 w-full gap-2"
        >
          <Eye className="size-4" />
          Voir le détail
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog : détail du bulletin (récupère la version fraîche)
// ─────────────────────────────────────────────────────────────────────────────

function BulletinDetailDialog({
  bulletin,
  onClose,
}: {
  bulletin: BulletinPaie | null;
  onClose: () => void;
}) {
  const open = bulletin !== null;
  const { data, isLoading, isError, error } = useQuery({
    queryKey: profBulletinsKeys.detail(bulletin?.id ?? ""),
    queryFn: () => fetchBulletin(bulletin!.id),
    enabled: !!bulletin,
  });

  const b = data ?? bulletin;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-5 text-emerald-600" />
            Détail du bulletin
          </DialogTitle>
          <DialogDescription>
            {b
              ? `${moisLabel(b.mois)} ${b.annee}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            {error instanceof Error
              ? error.message
              : "Impossible de charger les détails de ce bulletin."}
          </div>
        ) : b ? (
          <div className="flex flex-col gap-4">
            {/* En-tête statut */}
            <div className="flex items-center gap-3 rounded-md border border-muted bg-muted/30 p-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <CalendarDays className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {moisLabel(b.mois)} {b.annee}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {b.heures_pointees.toFixed(1)} h pointées sur{" "}
                  {b.heures_planifiees.toFixed(1)} h planifiées
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "font-medium",
                  STATUT_BULLETIN_BADGE[b.statut],
                )}
              >
                {STATUT_BULLETIN_LABEL[b.statut]}
              </Badge>
            </div>

            {/* Détail sessions */}
            <div className="grid grid-cols-2 gap-3">
              <DetailItem
                label="Sessions pointées"
                value={`${b.nb_sessions_pointees} / ${b.nb_sessions_total}`}
              />
              <DetailItem
                label="Taux horaire moyen"
                value={formatFCFA(b.taux_horaire_moyen)}
              />
            </div>

            {/* Calcul du salaire */}
            <div className="rounded-md border border-muted">
              <div className="flex items-center justify-between border-b border-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">Salaire brut</span>
                <span className="font-medium tabular-nums">
                  {formatFCFA(b.salaire_brut)}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  Avances déduites
                </span>
                <span className="font-medium tabular-nums text-amber-700 dark:text-amber-300">
                  -{formatFCFA(b.total_avances)}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  Cotisations sociales
                </span>
                <span className="font-medium tabular-nums text-rose-700 dark:text-rose-300">
                  -{formatFCFA(b.cotisations)}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-3">
                <span className="font-semibold">Salaire net à payer</span>
                <span className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatFCFA(b.salaire_net)}
                </span>
              </div>
            </div>

            {/* Métadonnées paiement */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {b.date_validation ? (
                <DetailItem
                  label="Validé le"
                  value={formatDateTime(b.date_validation)}
                />
              ) : null}
              {b.date_paie ? (
                <DetailItem
                  label="Payé le"
                  value={formatDateTime(b.date_paie)}
                />
              ) : null}
              {b.reference_paiement ? (
                <DetailItem
                  label="Référence paiement"
                  value={b.reference_paiement}
                  mono
                />
              ) : null}
            </div>

            {b.notes ? (
              <div className="rounded-md border border-muted bg-muted/30 p-3 text-xs">
                <p className="font-medium text-foreground">Notes</p>
                <p className="mt-1 text-muted-foreground">{b.notes}</p>
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Fermer
              </Button>
              {b.statut === "PAYE" && b.reference_paiement ? (
                <Button type="button" variant="outline" disabled className="gap-1.5">
                  <Banknote className="size-4 text-emerald-600" />
                  Payé
                </Button>
              ) : null}
            </DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-medium",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Squelette de chargement
// ─────────────────────────────────────────────────────────────────────────────

function BulletinsSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="border-l-4 border-l-muted">
          <CardHeader className="gap-2 pb-3">
            <Skeleton className="h-5 w-1/3" />
            <Skeleton className="h-4 w-1/4" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-11 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
