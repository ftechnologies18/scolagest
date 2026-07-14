"use client";

/**
 * ScolaGest — Dialogue de paiement d'une facture SaaS.
 *
 * Champs :
 *  - mode_paiement (Select : Mobile Money, Virement, Espèces)
 *  - reference_paiement (Input text)
 *
 * À la soumission : `payInvoice(invoiceId, { mode_paiement, reference_paiement })`,
 * invalidation de `billingKeys.invoices` + `billingKeys.stats` + toast.
 */

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";

import {
  billingKeys,
  payInvoice,
  type SaaInvoice,
} from "@/lib/api-saas-billing";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA } from "@/lib/format";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KentePattern } from "@/components/ds/kente-pattern";

const MODES_PAIEMENT = [
  { value: "MOBILE_MONEY", label: "Mobile Money" },
  { value: "VIREMENT", label: "Virement bancaire" },
  { value: "ESPECES", label: "Espèces" },
];

export interface InvoicePayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Facture à marquer payée. */
  invoice: SaaInvoice | null;
}

export function InvoicePayDialog({
  open,
  onOpenChange,
  invoice,
}: InvoicePayDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [modePaiement, setModePaiement] = React.useState("MOBILE_MONEY");
  const [reference, setReference] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setModePaiement("MOBILE_MONEY");
    setReference("");
  }, [open, invoice]);

  const mutation = useMutation({
    mutationFn: (body: {
      mode_paiement: string;
      reference_paiement: string;
    }) => {
      if (!invoice) throw new Error("Facture manquante");
      return payInvoice(invoice.id, body);
    },
    onMutate: () => setSubmitting(true),
    onSuccess: async (inv) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: billingKeys.invoices() }),
        queryClient.invalidateQueries({ queryKey: billingKeys.stats() }),
      ]);
      toast({
        title: "Facture réglée",
        description: `Facture ${inv.numero} marquée comme payée (${formatFCFA(
          inv.montant_ttc,
        )} TTC).`,
      });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Paiement impossible",
        description:
          err instanceof Error
            ? err.message
            : "Une erreur est survenue. Veuillez réessayer.",
        variant: "destructive",
      });
    },
    onSettled: () => setSubmitting(false),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice) return;
    if (!reference.trim()) {
      toast({
        title: "Référence requise",
        description:
          "Veuillez saisir une référence de paiement (transaction MoMo, n° de virement, reçu).",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate({
      mode_paiement: modePaiement,
      reference_paiement: reference.trim(),
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-[480px]">
        <KentePattern variant="strip" position="top" />
        <div className="px-6 pt-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Check className="size-4" />
            </div>
            Marquer la facture comme payée
          </DialogTitle>
          <DialogDescription>
            {invoice
              ? `Facture ${invoice.numero} — ${formatFCFA(
                  invoice.montant_ttc,
                )} TTC`
              : "Renseignez le mode et la référence du paiement."}
          </DialogDescription>
        </DialogHeader>
        </div>

        <div className="px-6 pb-6 pt-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {invoice ? (
            <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
              <p className="font-medium text-foreground">
                {invoice.etablissement?.nom ?? "Établissement"}
              </p>
              <p className="text-muted-foreground">
                Montant TTC : {formatFCFA(invoice.montant_ttc)} · Échéance :{" "}
                {invoice.date_echeance
                  ? new Date(invoice.date_echeance).toLocaleDateString(
                      "fr-FR",
                    )
                  : "—"}
              </p>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="inv-mode" className="text-xs">
              Mode de paiement <span className="text-rose-600">*</span>
            </Label>
            <Select
              value={modePaiement}
              onValueChange={setModePaiement}
              disabled={submitting}
            >
              <SelectTrigger id="inv-mode" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES_PAIEMENT.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inv-ref" className="text-xs">
              Référence de paiement <span className="text-rose-600">*</span>
            </Label>
            <Input
              id="inv-ref"
              placeholder="Ex : MTN-MOMO-9F3A2B, VIREMENT-BICICI-0023…"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              disabled={submitting}
            />
            <p className="text-[10px] text-muted-foreground">
              Indispensable pour tracer le règlement en comptabilité.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={submitting || !invoice}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Check className="size-3.5" />
              )}
              Confirmer le paiement
            </Button>
          </DialogFooter>
        </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
