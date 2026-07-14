"use client";

/**
 * ScolaGest — Dialogue de paiement Mobile Money (Portail parent — Phase 6 — Refonte Forêt EdTech).
 *
 * Permet au parent d'initier un paiement Mobile Money (Orange Money, MTN
 * Money, Wave) pour un de ses enfants. Le montant est pré-rempli avec le
 * solde dû de l'enfant mais reste éditable ; le téléphone client est
 * pré-rempli avec celui du tuteur.
 *
 * Refonte Forêt EdTech :
 *  - Header premium : badge rond gradient emerald→gold + icône Smartphone.
 *  - Providers visuels : 3 cartes cliquables pour Orange/MTN/Wave (couleurs
 *    de marque : orange / amber / slate) avec sélection visuelle (ring).
 *  - Footer grid-cols-2 + bouton submit variant success (gradient emerald).
 *  - Vue succès premium : badge rond emerald + carte référence.
 *
 * Au clic sur « Payer », on appelle `payerMobileMoneyParent(dto)` qui hit
 * `POST /api/parent/payer/mobile-money` (token parent). En cas de succès, on
 * affiche la référence de transaction et on invalide le cache `parentKeys`
 * pour rafraîchir les soldes et l'historique.
 */

import * as React from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Smartphone,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Send,
  X,
  Receipt,
  Phone,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";

import {
  payerMobileMoneyParent,
  parentKeys,
  type EnfantParent,
  type ParentPaiementMomoResponse,
} from "@/lib/api-parent";
import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProviderMomo } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Configuration des providers (couleurs de marque Forêt EdTech)
// ─────────────────────────────────────────────────────────────────────────────

interface ProviderConfig {
  value: ProviderMomo;
  label: string;
  description: string;
  /** Couleur de l'icône (badge rond) */
  iconBg: string;
  /** Couleur du ring / bg quand sélectionné */
  selectedCls: string;
  /** Couleur du texte + icône (état normal) */
  textCls: string;
  /** Classe de base du badge provider */
  badgeCls: string;
}

const PROVIDER_CONFIG: ProviderConfig[] = [
  {
    value: "ORANGE_MONEY",
    label: "Orange Money",
    description: "Opérateur historique, USSD #144#",
    iconBg: "bg-orange-500",
    selectedCls:
      "border-orange-500 bg-orange-50 ring-2 ring-orange-500/30 dark:bg-orange-950/40 dark:ring-orange-500/40",
    textCls: "text-orange-700 dark:text-orange-300",
    badgeCls:
      "border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-200",
  },
  {
    value: "MTN_MONEY",
    label: "MTN Money",
    description: "MoMo, USSD *133#",
    iconBg: "bg-amber-500",
    selectedCls:
      "border-amber-500 bg-amber-50 ring-2 ring-amber-500/30 dark:bg-amber-950/40 dark:ring-amber-500/40",
    textCls: "text-amber-700 dark:text-amber-300",
    badgeCls:
      "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  },
  {
    value: "WAVE",
    label: "Wave",
    description: "Wallet, sans USSD",
    iconBg: "bg-slate-700",
    selectedCls:
      "border-slate-700 bg-slate-50 ring-2 ring-slate-700/30 dark:bg-slate-800/40 dark:ring-slate-400/40",
    textCls: "text-slate-700 dark:text-slate-300",
    badgeCls:
      "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200",
  },
];

export interface PaymentMomoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enfant: EnfantParent | null;
}

export function PaymentMomoDialog({
  open,
  onOpenChange,
  enfant,
}: PaymentMomoDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const tuteur = useAuthStore((s) => s.tuteur);

  const soldeDu = enfant?.solde?.solde_du ?? 0;

  const [montant, setMontant] = React.useState<string>("");
  const [provider, setProvider] = React.useState<ProviderMomo>("ORANGE_MONEY");
  const [telephone, setTelephone] = React.useState<string>("");
  const [result, setResult] = React.useState<ParentPaiementMomoResponse | null>(
    null,
  );

  // Réinitialise le formulaire à chaque ouverture / changement d'enfant.
  React.useEffect(() => {
    if (open) {
      setMontant(soldeDu > 0 ? String(soldeDu) : "");
      setProvider("ORANGE_MONEY");
      setTelephone(tuteur?.telephone ?? "");
      setResult(null);
    }
  }, [open, enfant?.id, soldeDu, tuteur]);

  const montantNum = Number(montant) || 0;
  const isOverpay = soldeDu > 0 && montantNum > soldeDu;
  const canSubmit =
    !!enfant && montantNum > 0 && telephone.trim().length >= 8 && !isOverpay;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!enfant) throw new Error("Aucun enfant sélectionné.");
      return payerMobileMoneyParent({
        eleve_id: enfant.id,
        montant: montantNum,
        provider,
        telephone_client: telephone.trim(),
      });
    },
    onSuccess: async (tx) => {
      setResult(tx);
      // Invalide tout le cache parent (enfants, soldes, paiements, échéances).
      await queryClient.invalidateQueries({ queryKey: parentKeys.all });
      toast({
        title: "Paiement initié",
        description: `${formatFCFA(tx.montant)} via ${tx.provider.replace(
          "_",
          " ",
        )} — référence ${tx.reference_externe || tx.id.slice(0, 8)}.`,
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Échec du paiement",
        description:
          err instanceof Error
            ? err.message
            : "Impossible d'initier le paiement Mobile Money.",
        variant: "destructive",
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate();
  }

  function handleClose(open: boolean) {
    onOpenChange(open);
    if (!open) {
      mutation.reset();
      setResult(null);
    }
  }

  const enfantLabel = enfant
    ? `${enfant.prenoms ?? ""} ${enfant.nom ?? ""}`.trim()
    : "—";

  const selectedConfig = PROVIDER_CONFIG.find((p) => p.value === provider) ?? PROVIDER_CONFIG[0];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg gap-0 p-0 sm:max-w-lg">
        <KentePattern variant="strip" position="top" />
        {/* Header premium : badge rond gradient emerald→gold + Smartphone */}
        <DialogHeader className="border-b border-emerald-100 bg-gradient-to-br from-emerald-50 to-amber-50 px-6 py-5 dark:from-emerald-950/20 dark:to-amber-950/10">
          <DialogTitle className="flex items-center gap-3 text-base">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-md shadow-emerald-900/20">
              <Smartphone className="size-5" />
            </span>
            Payer en ligne — Mobile Money
          </DialogTitle>
          <DialogDescription className="ml-[52px] text-xs">
            Initiez un paiement Mobile Money pour{" "}
            <span className="break-words font-medium text-foreground">{enfantLabel}</span>.
            Vous recevrez une demande de validation sur votre téléphone.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {result ? (
            <SuccessView
              result={result}
              onClose={() => handleClose(false)}
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Récap enfant + solde — GlassCard tablet */}
              <GlassCard variant="tablet" noHover noAnimation className="!p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Enfant</span>
                  <span className="break-words font-medium leading-snug">{enfantLabel}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Solde dû</span>
                  <span
                    className={cn(
                      "font-mono font-bold leading-snug",
                      soldeDu > 0
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-emerald-700 dark:text-emerald-300",
                    )}
                  >
                    {formatFCFA(soldeDu)}
                  </span>
                </div>
              </GlassCard>

              {/* Providers visuels : 3 cartes cliquables (Orange / MTN / Wave) */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Provider Mobile Money
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {PROVIDER_CONFIG.map((cfg) => {
                    const isSelected = provider === cfg.value;
                    return (
                      <button
                        key={cfg.value}
                        type="button"
                        onClick={() => setProvider(cfg.value)}
                        aria-pressed={isSelected}
                        title={cfg.description}
                        className={cn(
                          "flex flex-col items-center gap-2 rounded-lg border-2 p-3 text-center transition-all",
                          isSelected
                            ? cfg.selectedCls
                            : "border-muted-foreground/20 bg-background hover:bg-muted/40",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-9 items-center justify-center rounded-full text-white shadow-sm",
                            cfg.iconBg,
                          )}
                        >
                          <Smartphone className="size-4" />
                        </span>
                        <span
                          className={cn(
                            "break-words text-xs font-semibold leading-snug",
                            isSelected ? cfg.textCls : "text-foreground",
                          )}
                        >
                          {cfg.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="break-words text-[11px] leading-snug text-muted-foreground">
                  Sélectionné :{" "}
                  <span className={cn("font-medium", selectedConfig.textCls)}>
                    {selectedConfig.label}
                  </span>{" "}
                  — {selectedConfig.description}
                </p>
              </div>

              {/* Montant */}
              <div className="space-y-1.5">
                <Label htmlFor="momo-montant" className="flex items-center gap-1.5">
                  <Receipt className="size-3.5 text-emerald-600" />
                  Montant (FCFA)
                </Label>
                <Input
                  id="momo-montant"
                  type="number"
                  min={0}
                  step="500"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  disabled={mutation.isPending}
                  className="h-11 border-2 font-mono text-base focus:border-emerald-500 focus-visible:ring-emerald-500/30"
                  placeholder="Ex. 50000"
                />
                {soldeDu > 0 && montantNum > 0 ? (
                  <p
                    className={cn(
                      "break-words text-[11px] leading-snug",
                      isOverpay
                        ? "text-rose-600 dark:text-rose-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {isOverpay ? (
                      <>
                        <AlertCircle className="mr-1 inline size-3" />
                        Trop-perçu : {formatFCFA(montantNum - soldeDu)} au-delà
                        du solde dû.
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-1 inline size-3 text-emerald-600" />
                        Solde restant après : {formatFCFA(soldeDu - montantNum)}
                      </>
                    )}
                  </p>
                ) : null}
              </div>

              {/* Téléphone client */}
              <div className="space-y-1.5">
                <Label htmlFor="momo-tel" className="flex items-center gap-1.5">
                  <Phone className="size-3.5 text-emerald-600" />
                  Téléphone Mobile Money
                </Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="momo-tel"
                    type="tel"
                    inputMode="tel"
                    value={telephone}
                    onChange={(e) => setTelephone(e.target.value)}
                    disabled={mutation.isPending}
                    placeholder="Ex. +2250701020304"
                    className="h-11 border-2 pl-10 font-mono text-base focus:border-emerald-500 focus-visible:ring-emerald-500/30"
                  />
                </div>
                <p className="break-words text-[11px] leading-snug text-muted-foreground">
                  Numéro Mobile Money du payeur. Pré-rempli avec votre numéro
                  de tuteur — modifiez-le si nécessaire.
                </p>
              </div>

              {/* Note sandbox */}
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
                <Smartphone className="mt-0.5 size-3.5 shrink-0" />
                <span className="break-words leading-snug">
                  <strong>Mode sandbox :</strong> la transaction est initiée
                  mais nécessite une confirmation manuelle côté caisse pour
                  générer le paiement définitif.
                </span>
              </div>

              {/* Actions — footer grid-cols-2 + bouton submit variant success */}
              <DialogFooter className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleClose(false)}
                  disabled={mutation.isPending}
                  className="w-full"
                >
                  <X className="size-4" />
                  Annuler
                </Button>
                <Button
                  type="submit"
                  variant="success"
                  disabled={!canSubmit || mutation.isPending}
                  className="w-full"
                  title="Initier le paiement Mobile Money"
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Paiement en cours…
                    </>
                  ) : (
                    <>
                      <Send className="size-4" />
                      Payer {montantNum > 0 ? `· ${formatFCFA(montantNum)}` : ""}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vue succès (premium)
// ─────────────────────────────────────────────────────────────────────────────

function SuccessView({
  result,
  onClose,
}: {
  result: ParentPaiementMomoResponse;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      {/* Badge rond emerald avec CheckCircle2 animé */}
      <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-lg shadow-emerald-900/10 ring-4 ring-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-950/40">
        <CheckCircle2 className="size-9" />
      </div>
      <h3 className="font-display text-lg font-bold">Paiement initié</h3>
      <p className="max-w-sm break-words text-sm leading-snug text-muted-foreground">
        Votre demande de paiement de{" "}
        <span className="font-mono font-semibold text-foreground">
          {formatFCFA(result.montant)}
        </span>{" "}
        via {result.provider.replace("_", " ")} a bien été enregistrée.
        Validez-la sur votre téléphone via le menu USSD ou l&apos;application de
        votre opérateur.
      </p>

      {/* Carte référence premium */}
      <GlassCard variant="tablet" noHover noAnimation className="!w-full max-w-sm !p-3">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Référence</span>
          <span className="break-all font-mono font-semibold leading-snug">
            {result.reference_externe || result.id.slice(0, 8)}
          </span>
        </div>
        {result.statut ? (
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-muted-foreground">Statut</span>
            <span className="break-words font-medium leading-snug">{result.statut}</span>
          </div>
        ) : null}
        {result.message ? (
          <p className="mt-2 break-words text-[11px] leading-snug text-muted-foreground">
            {result.message}
          </p>
        ) : null}
      </GlassCard>

      <Button
        type="button"
        variant="success"
        onClick={onClose}
        className="mt-4 w-full max-w-sm"
      >
        Fermer
      </Button>
    </div>
  );
}
