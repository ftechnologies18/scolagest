"use client";

/**
 * ScolaGest — File d'attente des élèves PRE_INSCRIT (Phase 3 — refonte Forêt EdTech).
 *
 * Affiche la liste ordonnée (par date d'inscription) des élèves en attente de
 * paiement du frais d'inscription. Chaque ligne est une carte GlassCard avec :
 *  - badges « EN ATTENTE » (amber renforcé) + source (PRÉ-INSCRIPTION emerald
 *    renforcé / MANUELLE slate renforcé)
 *  - avatar initiales bg-emerald-600 text-white + nom + prénoms + identifiant
 *    interne (mono) + classe
 *  - montant attendu (gras FCFA) + déjà payé + solde dû
 *  - bouton « Encaisser » (variant success, gros bouton tactile) → Dialog
 *    d'encaissement rapide (Select mode + Input montant pré-rempli avec le
 *    solde dû) → `createPaiement`. Au succès : toast + invalidation
 *    `fetchFileAttente` et `fetchDashboardCaisse`. L'élève disparaît de la
 *    file (passage automatique INSCRIT côté backend).
 *
 * Polling 30s sur `fetchFileAttente`. États loading / error / empty premium
 * (KentePattern bg + badge rond emerald + Users).
 *
 * Refonte : hero header local (GlassCard tablet + badge rond gradient
 * emerald→gold + Users + compteur) + cards élèves GlassCard adaptive AVEC
 * hover lift + motion.div stagger + avatar initiales bg-emerald-600 text-white
 * + badges renforcés (border-300 bg-100 text-800) + bouton Encaisser variant
 * success + title natif + empty/loading/error states premium.
 */

import * as React from "react";
import {
  useQuery,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Wallet,
  HandCoins,
  Clock,
  Users,
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
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { formatFCFA, formatDateShort, todayISO, dateInputToISO } from "@/lib/format";
import type { ModePaiement } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
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

function eleveInitials(e: EleveFileAttente): string {
  const p = (e.prenoms ?? "").trim();
  const n = (e.nom ?? "").trim();
  const a = p ? p[0] : "";
  const b = n ? n[0] : "";
  return (a + b).toUpperCase() || "?";
}

function sourceBadge(source: string): {
  label: string;
  className: string;
} {
  if (source === "PRE_INSCRIPTION") {
    return {
      label: "PRÉ-INSCRIPTION",
      className:
        "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200",
    };
  }
  return {
    label: "MANUELLE",
    className:
      "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
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
            <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white">
              <HandCoins className="size-4" />
            </span>
            Encaissement rapide
          </DialogTitle>
          <DialogDescription>
            Encaisser le frais d&apos;inscription et sortir l&apos;élève de la
            file d&apos;attente.
          </DialogDescription>
        </DialogHeader>

        {/* Récap élève */}
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
              {eleveInitials(eleve)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm font-semibold leading-snug">
                {eleveNom(eleve)}
              </p>
              <p className="break-words font-mono text-[11px] leading-snug text-muted-foreground">
                {eleve.identifiant_interne}
              </p>
              <p className="mt-0.5 break-words text-xs leading-snug text-muted-foreground">
                <HandCoins className="mr-1 inline size-3" />
                {eleve.classe_libelle || "Classe non affectée"}
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

          {mode === "MOBILE_MONEY" ? (
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
          ) : null}

          {(mode === "CHEQUE" ||
            mode === "VIREMENT" ||
            mode === "MOBILE_MONEY") ? (
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
          ) : null}

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

          {isOverpay ? (
            <p className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              Le montant dépasse le solde dû ({formatFCFA(soldeDu)}).
            </p>
          ) : null}

          {!eleve.frais_inscription_id ? (
            <p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
              Aucun frais d&apos;inscription associé. Utilisez le formulaire
              d&apos;encaissement standard.
            </p>
          ) : null}
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
            className="w-full sm:w-auto"
            title="Annuler l'encaissement"
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="success"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="w-full sm:w-auto"
            title="Valider l'encaissement et sortir l'élève de la file d'attente"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 size-4 animate-spin" />
                Encaissement…
              </>
            ) : (
              <>
                <Wallet className="mr-1.5 size-4" />
                Valider l&apos;encaissement
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
  const prefersReducedMotion = usePrefersReducedMotion();
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
      <GlassCard variant="adaptive" noHover className="relative overflow-hidden">
        <KentePattern variant="bg" />
        <div className="relative flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertCircle className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="font-display text-base font-semibold text-forest">
              Aucun établissement sélectionné
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              Sélectionnez un établissement dans la barre latérale pour voir la
              file d&apos;attente des élèves en attente de paiement.
            </p>
          </div>
        </div>
      </GlassCard>
    );
  }

  // Chargement initial
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Erreur
  if (isError) {
    return (
      <GlassCard variant="adaptive" noHover className="relative overflow-hidden">
        <KentePattern variant="bg" />
        <div className="relative flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="font-display text-base font-semibold text-forest">
              Impossible de charger la file d&apos;attente
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Le backend n&apos;a pas pu répondre. Réessayez ou vérifiez votre
              connexion.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            title="Réessayer le chargement"
          >
            <RefreshCw className="size-3.5" />
            Réessayer
          </Button>
        </div>
      </GlassCard>
    );
  }

  // File vide — empty state premium
  if (count === 0) {
    return (
      <GlassCard variant="adaptive" noHover className="relative overflow-hidden">
        <KentePattern variant="bg" />
        <div className="relative flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Users className="size-6" />
          </div>
          <div className="space-y-1">
            <p className="font-display text-base font-semibold text-forest">
              Aucun élève en attente — tous sont à jour ✓
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              Tous les élèves pré-inscrits ont réglé leur frais
              d&apos;inscription. La file d&apos;attente s&apos;actualise
              automatiquement toutes les 30 secondes.
            </p>
          </div>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero header local : compteur + refresh */}
      <GlassCard variant="tablet" noHover className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <Users className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-bold tracking-tight text-forest">
                  File d&apos;attente
                </h2>
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-100 px-2 py-0 text-[11px] font-bold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200"
                >
                  <Clock className="mr-1 size-3" />
                  {count} en attente
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Liste triée par date d&apos;inscription (plus ancienne en
                premier). Actualisation automatique toutes les 30&nbsp;secondes.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Actualiser la file d'attente"
            className="w-full sm:w-auto"
          >
            <RefreshCw
              className={cn("size-3.5", isFetching && "animate-spin")}
            />
            Actualiser
          </Button>
        </div>
      </GlassCard>

      <KentePattern variant="separator" className="my-1" />

      {/* Liste des élèves en attente */}
      <div className="space-y-3">
        {file!.map((eleve, index) => {
          const src = sourceBadge(eleve.source);
          const motionProps = prefersReducedMotion
            ? {}
            : {
                initial: { opacity: 0, y: 12 },
                animate: { opacity: 1, y: 0 },
                transition: {
                  duration: 0.3,
                  delay: Math.min(index * 0.04, 0.4),
                  ease: [0.22, 1, 0.36, 1] as const,
                },
              };
          return (
            <motion.div key={eleve.eleve_id} {...motionProps}>
              <GlassCard
                variant="adaptive"
                className="overflow-hidden p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Identité + badges */}
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
                      {eleveInitials(eleve)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="border-amber-300 bg-amber-100 px-1.5 py-0 text-[10px] font-bold text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200"
                        >
                          EN ATTENTE
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "px-1.5 py-0 text-[10px] font-semibold",
                            src.className,
                          )}
                        >
                          {src.label}
                        </Badge>
                      </div>
                      <p className="mt-1 break-words text-sm font-semibold leading-snug text-forest">
                        {eleveNom(eleve)}
                      </p>
                      <p className="break-words font-mono text-[11px] leading-snug text-muted-foreground">
                        {eleve.identifiant_interne}
                        <span className="mx-1 text-muted-foreground/50">·</span>
                        <span className="font-sans">
                          {eleve.classe_libelle || "Classe non affectée"}
                        </span>
                      </p>
                      <p className="mt-0.5 break-words text-[11px] leading-snug text-muted-foreground">
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
                      variant="success"
                      className="h-11 w-full sm:w-auto"
                      onClick={() => setDialogEleve(eleve)}
                      disabled={eleve.solde_du <= 0 || !eleve.frais_inscription_id}
                      title="Encaisser le frais d'inscription et sortir l'élève de la file d'attente"
                    >
                      <Wallet className="mr-1.5 size-4" />
                      Encaisser
                    </Button>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
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
