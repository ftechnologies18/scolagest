"use client";

/**
 * ScolaGest — Dialogue de génération d'une facture SaaS.
 *
 * Champs :
 *  - subscription (Select, fetch /api/saas/billing/subscriptions)
 *
 * À la soumission : `generateInvoice(subscriptionId)`, invalidation de
 * `billingKeys.invoices` + `billingKeys.stats` + toast.
 */

import * as React from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Receipt, Loader2 } from "lucide-react";

import {
  billingKeys,
  fetchSubscriptions,
  generateInvoice,
} from "@/lib/api-saas-billing";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA, formatDateShort } from "@/lib/format";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface InvoiceGenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceGenerateDialog({
  open,
  onOpenChange,
}: InvoiceGenerateDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [subscriptionId, setSubscriptionId] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setSubscriptionId("");
  }, [open]);

  const { data: subscriptions } = useQuery({
    queryKey: billingKeys.subscriptions(),
    queryFn: fetchSubscriptions,
    enabled: open,
    retry: 1,
    retryDelay: 1500,
  });

  const activeSubs = React.useMemo(
    () =>
      (subscriptions ?? []).filter(
        (s) => s.statut === "ACTIVE" || s.statut === "TRIALING" || s.statut === "PAST_DUE",
      ),
    [subscriptions],
  );

  const selected = React.useMemo(
    () => activeSubs.find((s) => s.id === subscriptionId) ?? null,
    [activeSubs, subscriptionId],
  );

  const mutation = useMutation({
    mutationFn: (subId: string) => generateInvoice(subId),
    onMutate: () => setSubmitting(true),
    onSuccess: async (inv) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: billingKeys.invoices() }),
        queryClient.invalidateQueries({ queryKey: billingKeys.stats() }),
      ]);
      toast({
        title: "Facture générée",
        description: `Facture ${inv.numero} émise pour « ${
          inv.etablissement?.nom ?? "l'établissement"
        } » (${formatFCFA(inv.montant_ttc)} TTC).`,
      });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Génération impossible",
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
    if (!subscriptionId) {
      toast({
        title: "Sélection requise",
        description: "Veuillez choisir un abonnement.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(subscriptionId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="size-4 text-emerald-600" />
            Générer une facture
          </DialogTitle>
          <DialogDescription>
            Émet une nouvelle facture pour la période en cours de
            l&apos;abonnement sélectionné.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="inv-sub" className="text-xs">
              Abonnement <span className="text-rose-600">*</span>
            </Label>
            <Select
              value={subscriptionId}
              onValueChange={setSubscriptionId}
              disabled={submitting || activeSubs.length === 0}
            >
              <SelectTrigger id="inv-sub" className="w-full">
                <SelectValue
                  placeholder={
                    activeSubs.length === 0
                      ? "Aucun abonnement éligible"
                      : "Sélectionner un abonnement…"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {activeSubs.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.etablissement?.nom ?? "Établissement"} ·{" "}
                    {s.plan?.nom ?? s.plan?.code ?? "Plan"} — prochaine le{" "}
                    {formatDateShort(s.prochaine_facture)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selected ? (
            <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
              <p className="font-medium text-foreground">
                {selected.etablissement?.nom ?? "—"}
              </p>
              <p className="text-muted-foreground">
                Plan : {selected.plan?.nom ?? "—"} · Cycle :{" "}
                {selected.cycle_facturation === "MONTHLY"
                  ? "Mensuel"
                  : "Annuel"}
              </p>
              <p className="text-muted-foreground">
                Prochaine facture attendue :{" "}
                {formatDateShort(selected.prochaine_facture)}
              </p>
            </div>
          ) : null}

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
              disabled={submitting || activeSubs.length === 0}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Receipt className="size-3.5" />
              )}
              Générer la facture
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
