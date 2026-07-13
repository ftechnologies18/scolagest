"use client";

/**
 * ScolaGest — Clôture quotidienne de caisse (Phase 3 — refonte Forêt EdTech).
 *
 * Affiche :
 *  - la date du jour + le caissier courant
 *  - le total théorique (lecture seule, calculé backend) — somme des
 *    paiements valides du jour
 *  - le total remis (input) saisi par le caissier
 *  - l'écart (auto-calculé, amber si non nul)
 *  - un champ notes
 *  - bouton « Clôturer » (variant success) → createCloture
 *  - si une clôture existe déjà aujourd'hui (statut CLOTUREE), résumé +
 *    bouton « Valider » (variant outline) pour COMPTABLE/DIRECTION
 *  - tableau des paiements du jour en dessous (header bg-emerald-50/60 +
 *    th text-emerald-900 + motion.tr stagger).
 *
 * Refonte : GlassCard adaptive pour le récap + tableau + badges renforcés
 * (border-300 bg-100 text-800) + boutons variant success / outline avec
 * title natif + empty state premium (KentePattern bg + badge rond emerald).
 */

import * as React from "react";
import {
  useQuery,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wallet,
  CalendarDays,
  ShieldCheck,
  User,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchClotureAujourdhui,
  fetchPaiements,
  createCloture,
  validerCloture,
  cloturesKeys,
  paiementsKeys,
} from "@/lib/api-caisse";
import { useToast } from "@/hooks/use-toast";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { formatFCFA, formatDateShort, formatDateTime, todayISO } from "@/lib/format";
import type { ClotureCaisse, Paiement } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
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
} from "./caisse-badges";

const SUPERVISEUR_ROLES = ["COMPTABLE", "DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR"];

export function ClotureCaissePanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const prefersReducedMotion = usePrefersReducedMotion();

  const isSuperviseur = !!role && SUPERVISEUR_ROLES.includes(role);

  // Clôture du jour pour le caissier courant
  const {
    data: cloture,
    isLoading,
    isError,
  } = useQuery({
    queryKey: cloturesKeys.aujourdhui(),
    queryFn: fetchClotureAujourdhui,
  });

  // Paiements du jour (caissier courant)
  const today = todayISO();
  const { data: paiementsData } = useQuery({
    queryKey: paiementsKeys.list({
      date_debut: today,
      date_fin: today,
      page: 1,
      page_size: 200,
    }),
    queryFn: () =>
      fetchPaiements({
        date_debut: today,
        date_fin: today,
        page: 1,
        page_size: 200,
      }),
  });
  const paiementsDuJour = (paiementsData?.data ?? []).filter(
    (p) => p.statut === "VALIDE",
  );
  const totalTheoriqueCalcule = paiementsDuJour.reduce(
    (sum, p) => sum + p.montant,
    0,
  );

  // États formulaire (création / mise à jour)
  const [totalRemis, setTotalRemis] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");

  React.useEffect(() => {
    if (cloture) {
      setTotalRemis(String(cloture.total_remis ?? ""));
      setNotes(cloture.notes ?? "");
    } else {
      setTotalRemis("");
      setNotes("");
    }
  }, [cloture]);

  const totalTheorique = cloture?.total_theorique ?? totalTheoriqueCalcule;
  const totalRemisNum = Number(totalRemis) || 0;
  const ecart = totalRemisNum - totalTheorique;

  // Création / mise à jour
  const saveMutation = useMutation({
    mutationFn: () =>
      createCloture({
        total_remis: totalRemisNum,
        notes: notes.trim() || undefined,
      }),
    onSuccess: async (c: ClotureCaisse) => {
      await queryClient.invalidateQueries({ queryKey: cloturesKeys.all });
      toast({
        title: "Clôture enregistrée",
        description: `Écart : ${formatFCFA(c.ecart)}${
          c.ecart !== 0 ? " (à justifier)" : " — conforme"
        }.`,
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible d'enregistrer la clôture.",
        variant: "destructive",
      });
    },
  });

  // Validation (superviseur)
  const validerMutation = useMutation({
    mutationFn: (id: string) => validerCloture(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: cloturesKeys.all });
      toast({
        title: "Clôture validée",
        description: "La clôture a été validée par un superviseur.",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de valider la clôture.",
        variant: "destructive",
      });
    },
  });

  const estCloturee = cloture?.statut === "CLOTUREE";
  const estValidee = cloture?.statut === "VALIDEE";
  const canEdit = !estValidee;

  const caissierLabel = user
    ? `${user.prenoms ?? ""} ${user.nom ?? ""}`.trim() || user.email
    : "—";

  return (
    <div className="space-y-4">
      {/* En-tête — récap clôture */}
      <GlassCard variant="adaptive" noHover>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
            <Lock className="size-5" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-base font-bold tracking-tight text-forest">
              Clôture de caisse — {formatDateShort(today)}
            </h3>
            <p className="text-xs text-muted-foreground">
              Vérifiez le total remis puis clôturez la journée. La clôture
              pourra ensuite être validée par un superviseur.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Infos caissier + statut */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              Caissier :{" "}
              <span className="font-medium text-foreground">{caissierLabel}</span>
            </span>
            {cloture ? (
              <StatutClotureBadge statut={cloture.statut} />
            ) : (
              <Badge
                variant="outline"
                className="border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200"
              >
                Ouverte (non clôturée)
              </Badge>
            )}
          </div>

          {/* Lecture seule : théorique + remis + écart */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-[10px] uppercase text-muted-foreground">
                Total théorique
              </p>
              <p className="font-mono text-lg font-bold">
                {formatFCFA(totalTheorique)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {paiementsDuJour.length} paiement(s) valide(s) du jour
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="total-remis" className="text-xs">
                Total remis (FCFA)
              </Label>
              <Input
                id="total-remis"
                type="number"
                min={0}
                value={totalRemis}
                onChange={(e) => setTotalRemis(e.target.value)}
                disabled={!canEdit || saveMutation.isPending}
                className="font-mono"
                placeholder="0"
              />
              <p className="text-[10px] text-muted-foreground">
                Somme effectivement remise en caisse
              </p>
            </div>

            <div
              className={cn(
                "rounded-lg border p-3",
                ecart === 0
                  ? "border-emerald-300 bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40"
                  : "border-amber-300 bg-amber-100 dark:border-amber-800/60 dark:bg-amber-950/40",
              )}
            >
              <p
                className={cn(
                  "text-[10px] uppercase",
                  ecart === 0
                    ? "text-emerald-800 dark:text-emerald-200"
                    : "text-amber-800 dark:text-amber-200",
                )}
              >
                Écart
              </p>
              <p
                className={cn(
                  "font-mono text-lg font-bold",
                  ecart === 0
                    ? "text-emerald-800 dark:text-emerald-200"
                    : "text-amber-800 dark:text-amber-200",
                )}
              >
                {formatFCFA(ecart)}
              </p>
              <p
                className={cn(
                  "text-[10px]",
                  ecart === 0
                    ? "text-emerald-800 dark:text-emerald-200"
                    : "text-amber-800 dark:text-amber-200",
                )}
              >
                {ecart === 0
                  ? "Conforme"
                  : ecart > 0
                    ? "Excédent à justifier"
                    : "Manquant à justifier"}
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs">
              Notes / observations
            </Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!canEdit || saveMutation.isPending}
              placeholder="Ex. Manquant de 2 000 FCFA sur tranche 4 — régularisation prévue."
            />
          </div>

          {/* Récap si clôturée */}
          {cloture ? (
            <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground">
              <p>
                <span className="font-medium text-foreground">Statut :</span>{" "}
                {cloture.statut}
              </p>
              <p>
                <span className="font-medium text-foreground">Date clôture :</span>{" "}
                {formatDateTime(cloture.date_cloture)}
              </p>
              {cloture.valide_par ? (
                <p>
                  <span className="font-medium text-foreground">Validée par :</span>{" "}
                  {cloture.valide_par}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex flex-wrap justify-end gap-2 border-t pt-3">
            {isLoading ? (
              <Skeleton className="h-9 w-32" />
            ) : estValidee ? (
              <Badge
                variant="outline"
                className="border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
              >
                <ShieldCheck className="size-3.5" />
                Clôture validée
              </Badge>
            ) : (
              <>
                {canEdit ? (
                  <Button
                    type="button"
                    variant="success"
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                    title={
                      estCloturee
                        ? "Mettre à jour la clôture du jour"
                        : "Clôturer la caisse du jour"
                    }
                  >
                    {saveMutation.isPending ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Enregistrement…
                      </>
                    ) : estCloturee ? (
                      <>
                        <CheckCircle2 className="size-4" />
                        Mettre à jour la clôture
                      </>
                    ) : (
                      <>
                        <Lock className="size-4" />
                        Clôturer la caisse
                      </>
                    )}
                  </Button>
                ) : null}
                {estCloturee && isSuperviseur ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={validerMutation.isPending}
                    onClick={() => cloture && validerMutation.mutate(cloture.id)}
                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800/60 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                    title="Valider la clôture en tant que superviseur"
                  >
                    {validerMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="size-4" />
                    )}
                    Valider la clôture
                  </Button>
                ) : null}
              </>
            )}
          </div>

          {!isSuperviseur && estCloturee && !estValidee ? (
            <p className="text-[11px] text-muted-foreground">
              La clôture est en attente de validation par un comptable ou un
              administrateur.
            </p>
          ) : null}

          {isError ? (
            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-100 p-2 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertCircle className="size-4" />
              Impossible de charger la clôture du jour. Vous pouvez tout de
              même saisir le total remis.
            </div>
          ) : null}
        </div>
      </GlassCard>

      <KentePattern variant="separator" />

      {/* Détail des paiements du jour */}
      <GlassCard
        variant="adaptive"
        noHover
        noAnimation
        className="overflow-hidden p-0"
      >
        <div className="flex items-center gap-2 p-5 pb-3">
          <Wallet className="size-4 text-emerald-600" />
          <h3 className="font-display text-base font-semibold text-forest">
            Paiements du jour ({paiementsDuJour.length})
          </h3>
        </div>
        <div>
          {paiementsDuJour.length === 0 ? (
            <div className="relative flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Wallet className="size-6" />
              </div>
              <div className="space-y-1">
                <p className="font-display text-sm font-semibold text-forest">
                  Aucun paiement valide enregistré aujourd&apos;hui
                </p>
                <p className="max-w-md text-xs text-muted-foreground">
                  Les encaissements validés du jour apparaîtront ici pour
                  vérification avant clôture.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <TableHead className="pl-4 text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Heure
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Reçu
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Élève
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Montant
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Mode
                    </TableHead>
                    <TableHead className="pr-4 text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Statut
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paiementsDuJour.map((p, index) => (
                    <PaiementDuJourRow
                      key={p.id}
                      paiement={p}
                      index={index}
                      prefersReducedMotion={prefersReducedMotion}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ligne du tableau Paiements du jour (motion.tr avec stagger)
// ─────────────────────────────────────────────────────────────────────────────

function PaiementDuJourRow({
  paiement: p,
  index,
  prefersReducedMotion,
}: {
  paiement: Paiement;
  index: number;
  prefersReducedMotion: boolean;
}) {
  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.3,
          delay: Math.min(index * 0.02, 0.4),
          ease: [0.22, 1, 0.36, 1] as const,
        },
      };
  return (
    <motion.tr
      data-slot="table-row"
      className="border-b transition-colors hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20"
      {...motionProps}
    >
      <TableCell className="pl-4 whitespace-nowrap text-xs">
        {new Date(p.date_paiement).toLocaleTimeString("fr-FR", {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </TableCell>
      <TableCell>
        <span className="break-words font-mono text-xs leading-snug">
          {p.numero_recu}
        </span>
      </TableCell>
      <TableCell className="break-words text-xs leading-snug">
        {p.eleve
          ? [p.eleve.prenoms, p.eleve.nom].filter(Boolean).join(" ")
          : "—"}
      </TableCell>
      <TableCell className="text-right font-mono text-xs font-semibold">
        {formatFCFA(p.montant)}
      </TableCell>
      <TableCell>
        <ModePaiementBadge mode={p.mode_paiement} />
      </TableCell>
      <TableCell className="pr-4">
        <StatutPaiementBadge statut={p.statut} />
      </TableCell>
    </motion.tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge statut clôture (renforcé : border-300 bg-100 text-800)
// ─────────────────────────────────────────────────────────────────────────────

function StatutClotureBadge({
  statut,
}: {
  statut: ClotureCaisse["statut"];
}) {
  const cls: Record<ClotureCaisse["statut"], string> = {
    OUVERTE:
      "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
    CLOTUREE:
      "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200",
    VALIDEE:
      "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200",
  };
  const labels: Record<ClotureCaisse["statut"], string> = {
    OUVERTE: "Ouverte",
    CLOTUREE: "Clôturée (à valider)",
    VALIDEE: "Validée",
  };
  const icons: Record<ClotureCaisse["statut"], React.ReactNode> = {
    OUVERTE: <User className="size-3" />,
    CLOTUREE: <Lock className="size-3" />,
    VALIDEE: <ShieldCheck className="size-3" />,
  };
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium", cls[statut])}>
      {icons[statut]}
      {labels[statut]}
    </Badge>
  );
}
