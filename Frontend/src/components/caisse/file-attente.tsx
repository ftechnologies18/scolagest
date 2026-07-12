"use client";

/**
 * ScolaGest — File d'attente des élèves PRE_INSCRIT (Phase 3 — amélioration).
 *
 * Affiche la liste ordonnée (par date d'inscription) des élèves en attente de
 * paiement du frais d'inscription. Chaque ligne est une carte avec :
 *  - badges « EN ATTENTE » (amber) + source (PRÉ-INSCRIPTION emerald /
 *    MANUELLE slate)
 *  - nom + prénoms + identifiant interne (mono) + classe
 *  - montant attendu (gras FCFA) + déjà payé + solde dû
 *  - bouton « Encaisser » (emerald, gros bouton tactile) → Dialog d'encaissement
 *    rapide (Select mode + Input montant pré-rempli avec le solde dû) →
 *    `createPaiement`. Au succès : toast + invalidation `fetchFileAttente` et
 *    `fetchDashboardCaisse`. L'élève disparaît de la file (passage automatique
 *    INSCRIT côté backend).
 *
 * Polling 30s sur `fetchFileAttente`. États loading / error / empty.
 */

import * as React from "react";
import {
  useQuery,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Wallet,
  GraduationCap,
  HandCoins,
  Clock,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchFileAttente,
  createPaiement,
  paiementsKeys,
  soldesKeys,
  type EleveFileAttente,
} from "@/lib/api-caisse";
import { dashboardCaisseKeys } from "@/components/caisse/dashboard-caisse";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA, formatDateShort, todayISO, dateInputToISO } from "@/lib/format";
import type { ModePaiement } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─────────────────────────────────────────────────────────────────────────────
// Clés React Query dédiées (pour invalidation croisée)
// ─────────────────────────────────────────────────────────────────────────────

export const fileAttenteKeys = {
  all: ["caisse", "file-attente"] as const,
  list: () => [...fileAttenteKeys.all, "list"] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers locaux
// ─────────────────────────────────────────────────────────────────────────────

const MODE_OPTIONS: { value: ModePaiement; label: string }[] = [
  { value: "ESPECES", label: "Espèces" },
  { value: "CHEQUE", label: "Chèque" },
  { value: "VIREMENT", label: "Virement" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
];

const PROVIDER_OPTIONS = ["Orange Money", "MTN MoMo", "Wave"] as const;

function eleveNom(e: EleveFileAttente): string {
  return [e.prenoms, e.nom].filter(Boolean).join(" ").trim() || "—";
}

function sourceBadge(source: string): {
  label: string;
  className: string;
} {
  if (source === "PRE_INSCRIPTION") {
    return {
      label: "PRÉ-INSCRIPTION",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    };
  }
  return {
    label: "MANUELLE",
    className:
      "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composant : Dialog d'encaissement rapide
// ─────────────────────────────────────────────────────────────────────────────

interface EncaissementDialogProps {
  eleve: EleveFileAttente | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function EncaissementDialog({
  eleve,
  open,
  onOpenChange,
}: EncaissementDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [mode, setMode] = React.useState<ModePaiement>("ESPECES");
  const [provider, setProvider] = React.useState<string>(PROVIDER_OPTIONS[0]);
  const [reference, setReference] = React.useState<string>("");
  const [montant, setMontant] = React.useState<string>("");
  const [datePaiement, setDatePaiement] = React.useState<string>(todayISO());

  // (Re)initialise le montant avec le solde dû quand on ouvre / change d'élève.
  React.useEffect(() => {
    if (open && eleve) {
      setMontant(eleve.solde_du > 0 ? String(eleve.solde_du) : "");
      setMode("ESPECES");
      setProvider(PROVIDER_OPTIONS[0]);
      setReference("");
      setDatePaiement(todayISO());
    }
  }, [open, eleve]);

  const montantNum = Number(montant) || 0;
  const soldeDu = eleve?.solde_du ?? 0;
  const isOverpay = montantNum > soldeDu;
  const canSubmit =
    !!eleve && montantNum > 0 && !isOverpay && (eleve.frais_inscription_id ?? "").length > 0;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!eleve) throw new Error("Aucun élève sélectionné.");
      if (!eleve.frais_inscription_id) {
        throw new Error(
          "Aucun frais d'inscription associé à cet élève. Utilisez le formulaire d'encaissement standard.",
        );
      }
      return createPaiement({
        eleve_id: eleve.eleve_id,
        frais_id: eleve.frais_inscription_id,
        montant: montantNum,
        mode_paiement: mode,
        provider_momo: mode === "MOBILE_MONEY" ? provider : null,
        reference_externe: reference || undefined,
        date_paiement: datePaiement ? dateInputToISO(datePaiement) : undefined,
      });
    },
    onSuccess: async (paiement) => {
      // Invalide les caches caisse (file d'attente + dashboard + paiements + soldes).
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: fileAttenteKeys.all }),
        queryClient.invalidateQueries({ queryKey: dashboardCaisseKeys.all }),
        queryClient.invalidateQueries({ queryKey: paiementsKeys.all }),
        queryClient.invalidateQueries({ queryKey: soldesKeys.all }),
      ]);
      toast({
        title: "Encaissement réussi",
        description: `Reçu ${paiement.numero_recu} · ${formatFCFA(
          paiement.montant,
        )} encaissés. L'élève sort de la file d'attente.`,
      });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Échec de l'encaissement",
        description:
          err instanceof Error
            ? err.message
            : "Impossible d'enregistrer le paiement.",
        variant: "destructive",
      });
    },
  });

  if (!eleve) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <HandCoins className="size-4 text-emerald-600" />
            Encaissement rapide
          </DialogTitle>
          <DialogDescription>
            Encaisser le frais d'inscription et sortir l'élève de la file
            d'attente.
          </DialogDescription>
        </DialogHeader>

        {/* Récap élève */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <GraduationCap className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {eleveNom(eleve)}
              </p>
              <p className="truncate font-mono text-[11px] text-muted-foreground">
                {eleve.identifiant_interne}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                <GraduationCap className="mr-1 inline size-3" />
                {eleve.classe_libelle || "—"}
              </p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-emerald-200/60 pt-2 text-center dark:border-emerald-900/40">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Attendu
              </p>
              <p className="text-xs font-semibold text-foreground">
                {formatFCFA(eleve.montant_attendu)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Payé
              </p>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                {formatFCFA(eleve.montant_deja_paye)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Solde dû
              </p>
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                {formatFCFA(eleve.solde_du)}
              </p>
            </div>
          </div>
        </div>

        {/* Formulaire */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="enc-mode">Mode de paiement</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as ModePaiement)}>
              <SelectTrigger id="enc-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === "MOBILE_MONEY" && (
            <div className="space-y-1.5">
              <Label htmlFor="enc-provider">Provider</Label>
              <Select value={provider} onValueChange={setProvider}>
                <SelectTrigger id="enc-provider" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDER_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {(mode === "CHEQUE" ||
            mode === "VIREMENT" ||
            mode === "MOBILE_MONEY") && (
            <div className="space-y-1.5">
              <Label htmlFor="enc-ref">
                {mode === "MOBILE_MONEY"
                  ? "Référence transaction"
                  : mode === "CHEQUE"
                    ? "N° chèque / banque"
                    : "Référence virement"}
              </Label>
              <Input
                id="enc-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={mode === "MOBILE_MONEY" ? "MP240314.1234.A" : "BNK-001234"}
                maxLength={120}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="enc-montant">Montant (FCFA)</Label>
              <Input
                id="enc-montant"
                type="number"
                min={1}
                inputMode="numeric"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                className={cn(
                  isOverpay &&
                    "border-rose-400 focus-visible:ring-rose-400/40",
                )}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="enc-date">Date</Label>
              <Input
                id="enc-date"
                type="date"
                value={datePaiement}
                onChange={(e) => setDatePaiement(e.target.value)}
              />
            </div>
          </div>

          {isOverpay && (
            <p className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              Le montant dépasse le solde dû ({formatFCFA(soldeDu)}).
            </p>
          )}

          {!eleve.frais_inscription_id && (
            <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              Aucun frais d'inscription associé. Utilisez le formulaire
              d'encaissement standard.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            Annuler
          </Button>
          <Button
            type="button"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Encaissement…
              </>
            ) : (
              <>
                <Wallet className="mr-1.5 size-4" />
                Valider l'encaissement
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function FileAttente() {
  const etablissement = useAuthStore((s) => s.etablissement);
  const [dialogEleve, setDialogEleve] = React.useState<EleveFileAttente | null>(
    null,
  );

  const {
    data: file,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: fileAttenteKeys.list(),
    queryFn: fetchFileAttente,
    enabled: !!etablissement,
    refetchInterval: 30_000, // polling toutes les 30s
    refetchOnWindowFocus: true,
  });

  const count = file?.length ?? 0;

  // Pas d'établissement sélectionné
  if (!etablissement) {
    return (
      <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20">
        <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
          <AlertCircle className="size-8 text-amber-600" />
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Aucun établissement sélectionné
          </p>
          <p className="max-w-md text-xs text-muted-foreground">
            Sélectionnez un établissement dans la barre latérale pour voir la
            file d'attente des élèves en attente de paiement.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Chargement initial
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-6 w-24" />
        </div>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full rounded-xl" />
        ))}
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
            Impossible de charger la file d'attente
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

  // File vide
  if (count === 0) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <CheckCircle2 className="size-10 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            Aucun élève en attente — tous sont à jour ✓
          </p>
          <p className="max-w-md text-xs text-muted-foreground">
            Tous les élèves pré-inscrits ont réglé leur frais d'inscription.
            La file d'attente s'actualise automatiquement toutes les 30 secondes.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* En-tête : compteur + refresh */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
          >
            <Clock className="mr-1 size-3" />
            {count} en attente
          </Badge>
          <span className="text-xs text-muted-foreground">
            Liste triée par date d'inscription (plus ancienne en premier).
          </span>
        </div>
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

      {/* Liste des élèves en attente */}
      <div className="space-y-3">
        {file!.map((eleve) => {
          const src = sourceBadge(eleve.source);
          return (
            <Card
              key={eleve.eleve_id}
              className="overflow-hidden transition-shadow hover:shadow-md"
            >
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                {/* Identité + badges */}
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <GraduationCap className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className="border-amber-300 bg-amber-50 px-1.5 py-0 text-[10px] font-bold text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                      >
                        EN ATTENTE
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn("px-1.5 py-0 text-[10px] font-semibold", src.className)}
                      >
                        {src.label}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-sm font-semibold">
                      {eleveNom(eleve)}
                    </p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {eleve.identifiant_interne}
                      <span className="mx-1 text-muted-foreground/50">·</span>
                      <span className="font-sans">
                        {eleve.classe_libelle || "Classe non affectée"}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      <Clock className="mr-1 inline size-3" />
                      Inscrit le {formatDateShort(eleve.date_inscription)}
                    </p>
                  </div>
                </div>

                {/* Montants + bouton */}
                <div className="flex flex-col gap-2 sm:items-end">
                  <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-4">
                    <div className="text-center sm:text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Attendu
                      </p>
                      <p className="text-sm font-bold text-foreground">
                        {formatFCFA(eleve.montant_attendu)}
                      </p>
                    </div>
                    <div className="text-center sm:text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Payé
                      </p>
                      <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        {formatFCFA(eleve.montant_deja_paye)}
                      </p>
                    </div>
                    <div className="text-center sm:text-right">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        Solde dû
                      </p>
                      <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                        {formatFCFA(eleve.solde_du)}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="lg"
                    className="h-11 w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
                    onClick={() => setDialogEleve(eleve)}
                    disabled={eleve.solde_du <= 0 || !eleve.frais_inscription_id}
                  >
                    <Wallet className="mr-1.5 size-4" />
                    Encaisser
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Dialog d'encaissement rapide */}
      <EncaissementDialog
        eleve={dialogEleve}
        open={!!dialogEleve}
        onOpenChange={(o) => {
          if (!o) setDialogEleve(null);
        }}
      />
    </div>
  );
}
