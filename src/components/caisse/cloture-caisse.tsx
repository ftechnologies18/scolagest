"use client";

/**
 * ScolaGest — Clôture quotidienne de caisse (Phase 3).
 *
 * Affiche :
 *  - la date du jour + le caissier courant
 *  - le total théorique (lecture seule, calculé backend) — somme des
 *    paiements valides du jour
 *  - le total remis (input) saisi par le caissier
 *  - l'écart (auto-calculé, amber si non nul)
 *  - un champ notes
 *  - bouton « Clôturer » → createCloture
 *  - si une clôture existe déjà aujourd'hui (statut CLOTUREE), résumé +
 *    bouton « Valider » pour COMPTABLE/ADMINISTRATEUR
 *  - tableau des paiements du jour en dessous.
 */

import * as React from "react";
import {
  useQuery,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import {
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Wallet,
  CalendarDays,
  ShieldCheck,
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
import { formatFCFA, formatDateShort, formatDateTime, todayISO } from "@/lib/format";
import type { ClotureCaisse } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const SUPERVISEUR_ROLES = ["COMPTABLE", "ADMINISTRATEUR"];

export function ClotureCaissePanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);

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

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Lock className="size-4 text-emerald-600" />
            Clôture de caisse — {formatDateShort(today)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Infos caissier + statut */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-3.5" />
              Caissier :{" "}
              <span className="font-medium text-foreground">
                {user
                  ? `${user.prenoms ?? ""} ${user.nom ?? ""}`.trim() ||
                    user.email
                  : "—"}
              </span>
            </span>
            {cloture ? (
              <StatutClotureBadge statut={cloture.statut} />
            ) : (
              <Badge
                variant="outline"
                className="border-muted-foreground/20 bg-muted/40 text-muted-foreground"
              >
                Ouverte (non clôturée)
              </Badge>
            )}
          </div>

          {/* Lecture seule : théorique */}
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
                  ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                  : "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20",
              )}
            >
              <p
                className={cn(
                  "text-[10px] uppercase",
                  ecart === 0
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-amber-700 dark:text-amber-300",
                )}
              >
                Écart
              </p>
              <p
                className={cn(
                  "font-mono text-lg font-bold",
                  ecart === 0
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-amber-700 dark:text-amber-300",
                )}
              >
                {formatFCFA(ecart)}
              </p>
              <p
                className={cn(
                  "text-[10px]",
                  ecart === 0
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-amber-700 dark:text-amber-300",
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
                className="border-emerald-200 bg-emerald-50 text-emerald-700"
              >
                <ShieldCheck className="size-3.5" />
                Clôture validée
              </Badge>
            ) : (
              <>
                {canEdit ? (
                  <Button
                    type="button"
                    disabled={saveMutation.isPending}
                    onClick={() => saveMutation.mutate()}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
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
                    className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
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
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
              <AlertCircle className="size-4" />
              Impossible de charger la clôture du jour. Vous pouvez tout de
              même saisir le total remis.
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Détail des paiements du jour */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="size-4 text-emerald-600" />
            Paiements du jour ({paiementsDuJour.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {paiementsDuJour.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <Wallet className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Aucun paiement valide enregistré aujourd&apos;hui.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-4">Heure</TableHead>
                    <TableHead>Reçu</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead className="pr-4">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paiementsDuJour.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-4 text-xs">
                        {new Date(p.date_paiement).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {p.numero_recu}
                      </TableCell>
                      <TableCell className="text-xs">
                        {p.eleve
                          ? [p.eleve.prenoms, p.eleve.nom]
                              .filter(Boolean)
                              .join(" ")
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge statut clôture
// ─────────────────────────────────────────────────────────────────────────────

function StatutClotureBadge({
  statut,
}: {
  statut: ClotureCaisse["statut"];
}) {
  const cls: Record<ClotureCaisse["statut"], string> = {
    OUVERTE:
      "border-muted-foreground/20 bg-muted/40 text-muted-foreground",
    CLOTUREE:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
    VALIDEE:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  };
  const labels: Record<ClotureCaisse["statut"], string> = {
    OUVERTE: "Ouverte",
    CLOTUREE: "Clôturée (à valider)",
    VALIDEE: "Validée",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", cls[statut])}>
      {labels[statut]}
    </Badge>
  );
}
