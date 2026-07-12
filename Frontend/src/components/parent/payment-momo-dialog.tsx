"use client";

/**
 * ScolaGest — Dialogue de paiement Mobile Money (Portail parent — Phase 6).
 *
 * Permet au parent d'initier un paiement Mobile Money (Orange Money, MTN
 * Money, Wave) pour un de ses enfants. Le montant est pré-rempli avec le
 * solde dû de l'enfant mais reste éditable ; le téléphone client est
 * pré-rempli avec celui du tuteur.
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
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProviderMomoBadge } from "@/components/mobile-money/momo-badges";

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

const PROVIDER_OPTIONS: { value: ProviderMomo; label: string }[] = [
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "MTN_MONEY", label: "MTN Money" },
  { value: "WAVE", label: "Wave" },
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Smartphone className="size-5 text-amber-600" />
            Payer en ligne — Mobile Money
          </DialogTitle>
          <DialogDescription className="text-xs">
            Initiez un paiement Mobile Money pour{" "}
            <span className="font-medium text-foreground">{enfantLabel}</span>.
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
              {/* Récap enfant + solde */}
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Enfant</span>
                  <span className="font-medium">{enfantLabel}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Solde dû</span>
                  <span
                    className={cn(
                      "font-mono font-bold",
                      soldeDu > 0
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-emerald-700 dark:text-emerald-300",
                    )}
                  >
                    {formatFCFA(soldeDu)}
                  </span>
                </div>
              </div>

              {/* Provider */}
              <div className="space-y-1.5">
                <Label htmlFor="momo-provider">Provider Mobile Money</Label>
                <Select
                  value={provider}
                  onValueChange={(v) => setProvider(v as ProviderMomo)}
                >
                  <SelectTrigger id="momo-provider" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVIDER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <ProviderMomoBadge provider={opt.value} />
                        <span className="ml-2">{opt.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Montant */}
              <div className="space-y-1.5">
                <Label htmlFor="momo-montant">Montant (FCFA)</Label>
                <Input
                  id="momo-montant"
                  type="number"
                  min={0}
                  step="500"
                  value={montant}
                  onChange={(e) => setMontant(e.target.value)}
                  disabled={mutation.isPending}
                  className="font-mono"
                  placeholder="Ex. 50000"
                />
                {soldeDu > 0 && montantNum > 0 ? (
                  <p
                    className={cn(
                      "text-[11px]",
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
                <Label htmlFor="momo-tel">Téléphone Mobile Money</Label>
                <Input
                  id="momo-tel"
                  type="tel"
                  inputMode="tel"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  disabled={mutation.isPending}
                  placeholder="Ex. +2250701020304"
                  className="font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Numéro Mobile Money du payeur. Pré-rempli avec votre numéro
                  de tuteur — modifiez-le si nécessaire.
                </p>
              </div>

              {/* Note sandbox */}
              <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
                <Smartphone className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  <strong>Mode sandbox :</strong> la transaction est initiée
                  mais nécessite une confirmation manuelle côté caisse pour
                  générer le paiement définitif.
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleClose(false)}
                  disabled={mutation.isPending}
                  className="flex-1"
                >
                  <X className="size-4" />
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={!canSubmit || mutation.isPending}
                  className="flex-[2] bg-amber-600 text-white hover:bg-amber-700"
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
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vue succès
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
      <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CheckCircle2 className="size-8" />
      </div>
      <h3 className="text-lg font-bold">Paiement initié</h3>
      <p className="max-w-sm text-sm text-muted-foreground">
        Votre demande de paiement de{" "}
        <span className="font-mono font-semibold text-foreground">
          {formatFCFA(result.montant)}
        </span>{" "}
        via {result.provider.replace("_", " ")} a bien été enregistrée.
        Validez-la sur votre téléphone via le menu USSD ou l&apos;application de
        votre opérateur.
      </p>

      <div className="mt-2 w-full max-w-sm rounded-lg border bg-muted/30 p-3 text-left text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Référence</span>
          <span className="font-mono font-semibold">
            {result.reference_externe || result.id.slice(0, 8)}
          </span>
        </div>
        {result.statut ? (
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-muted-foreground">Statut</span>
            <span className="font-medium">{result.statut}</span>
          </div>
        ) : null}
        {result.message ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {result.message}
          </p>
        ) : null}
      </div>

      <Button
        type="button"
        onClick={onClose}
        className="mt-4 w-full max-w-sm bg-amber-600 text-white hover:bg-amber-700"
      >
        Fermer
      </Button>
    </div>
  );
}
