"use client";

/**
 * ScolaGest — Dialogue de création d'un abonnement SaaS.
 *
 * Champs :
 *  - etablissement (Select, fetch /api/saas/establishments)
 *  - plan (Select, fetch /api/saas/billing/plans)
 *  - cycle (Select : MONTHLY / YEARLY)
 *  - duree_essai_jours (Input number, 0 = pas d'essai)
 *
 * À la soumission : `createSubscription`, invalidation de
 * `billingKeys.subscriptions` + `billingKeys.stats` + toast.
 */

import * as React from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { CalendarPlus, Loader2 } from "lucide-react";

import {
  billingKeys,
  createSubscription,
  fetchPlans,
  type CycleFacturation,
  type SubscriptionDTO,
} from "@/lib/api-saas-billing";
import { fetchSaasEstablishments } from "@/lib/api-saas";
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

export interface SubscriptionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SubscriptionFormDialog({
  open,
  onOpenChange,
}: SubscriptionFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ─── Données du formulaire ────────────────────────────────────────────
  const [etablissementId, setEtablissementId] = React.useState("");
  const [planId, setPlanId] = React.useState("");
  const [cycle, setCycle] = React.useState<CycleFacturation>("MONTHLY");
  const [dureeEssai, setDureeEssai] = React.useState("0");
  const [submitting, setSubmitting] = React.useState(false);

  // Reset à l'ouverture
  React.useEffect(() => {
    if (!open) return;
    setEtablissementId("");
    setPlanId("");
    setCycle("MONTHLY");
    setDureeEssai("0");
  }, [open]);

  // ─── Listes déroulantes ────────────────────────────────────────────────
  const { data: establishments } = useQuery({
    queryKey: ["saas", "establishments"],
    queryFn: fetchSaasEstablishments,
    enabled: open,
    retry: 1,
    retryDelay: 1500,
  });

  const { data: plans } = useQuery({
    queryKey: billingKeys.plans(),
    queryFn: fetchPlans,
    enabled: open,
    retry: 1,
    retryDelay: 1500,
  });

  const selectedPlan = React.useMemo(
    () => (plans ?? []).find((p) => p.id === planId) ?? null,
    [plans, planId],
  );

  const mutation = useMutation({
    mutationFn: (dto: SubscriptionDTO) => createSubscription(dto),
    onMutate: () => setSubmitting(true),
    onSuccess: async (sub) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: billingKeys.subscriptions(),
        }),
        queryClient.invalidateQueries({ queryKey: billingKeys.stats() }),
        queryClient.invalidateQueries({ queryKey: billingKeys.invoices() }),
      ]);
      const etabNom =
        (establishments ?? []).find(
          (e) => e.id === sub.etablissement_id,
        )?.nom ?? "l'établissement";
      toast({
        title: "Abonnement créé",
        description: `« ${etabNom} » est désormais abonné au plan « ${
          sub.plan?.nom ?? selectedPlan?.nom ?? "—"
        } ».`,
      });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Création impossible",
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
    if (!etablissementId || !planId) {
      toast({
        title: "Champs requis",
        description:
          "Veuillez sélectionner un établissement et un plan.",
        variant: "destructive",
      });
      return;
    }
    const dto: SubscriptionDTO = {
      etablissement_id: etablissementId,
      plan_id: planId,
      cycle_facturation: cycle,
      duree_essai_jours: Number(dureeEssai) || 0,
    };
    mutation.mutate(dto);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="size-4 text-emerald-600" />
            Nouvel abonnement
          </DialogTitle>
          <DialogDescription>
            Abonnez un établissement à un plan tarifaire ScolaGest.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sub-etab" className="text-xs">
              Établissement <span className="text-rose-600">*</span>
            </Label>
            <Select
              value={etablissementId}
              onValueChange={setEtablissementId}
              disabled={submitting}
            >
              <SelectTrigger id="sub-etab" className="w-full">
                <SelectValue placeholder="Sélectionner un établissement…" />
              </SelectTrigger>
              <SelectContent>
                {(establishments ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nom}
                    {e.ville ? ` — ${e.ville}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sub-plan" className="text-xs">
              Plan <span className="text-rose-600">*</span>
            </Label>
            <Select
              value={planId}
              onValueChange={setPlanId}
              disabled={submitting}
            >
              <SelectTrigger id="sub-plan" className="w-full">
                <SelectValue placeholder="Sélectionner un plan…" />
              </SelectTrigger>
              <SelectContent>
                {(plans ?? [])
                  .filter((p) => p.actif)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nom} ({p.code}) —{" "}
                      {formatFCFA(p.prix_mensuel)}/mois
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {selectedPlan ? (
              <p className="text-[11px] text-muted-foreground">
                {selectedPlan.description || "—"}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sub-cycle" className="text-xs">
                Cycle de facturation
              </Label>
              <Select
                value={cycle}
                onValueChange={(v) => setCycle(v as CycleFacturation)}
                disabled={submitting}
              >
                <SelectTrigger id="sub-cycle" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MONTHLY">Mensuel</SelectItem>
                  <SelectItem value="YEARLY">Annuel</SelectItem>
                </SelectContent>
              </Select>
              {selectedPlan ? (
                <p className="text-[11px] text-muted-foreground">
                  {cycle === "MONTHLY"
                    ? `Facturé ${formatFCFA(selectedPlan.prix_mensuel)} / mois`
                    : `Facturé ${formatFCFA(
                        selectedPlan.prix_annuel,
                      )} / an`}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sub-essai" className="text-xs">
                Durée d&apos;essai (jours)
              </Label>
              <Input
                id="sub-essai"
                type="number"
                min={0}
                max={90}
                value={dureeEssai}
                onChange={(e) => setDureeEssai(e.target.value)}
                disabled={submitting}
              />
              <p className="text-[10px] text-muted-foreground">
                0 = pas d&apos;essai. L&apos;abonnement démarre immédiatement.
              </p>
            </div>
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
              disabled={submitting}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {submitting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CalendarPlus className="size-3.5" />
              )}
              Créer l&apos;abonnement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
