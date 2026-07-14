"use client";

/**
 * ScolaGest — Dialogue de création / édition d'un plan tarifaire SaaS.
 *
 * Champs :
 *  - code (Input)         — code court (BASIC, PRO, ENTERPRISE…)
 *  - nom (Input)          — nom affiché
 *  - description (Textarea)
 *  - prix_mensuel (Input number, FCFA)
 *  - prix_annuel (Input number, FCFA)
 *  - nb_eleves_max (Input number, 0 = illimité)
 *  - nb_users_max (Input number, 0 = illimité)
 *  - actif (Switch)
 *
 * À la soumission : `createPlan` (création) ou `updatePlan` (édition), puis
 * invalidation de `billingKeys.plans` + toast de confirmation.
 */

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, Loader2 } from "lucide-react";

import {
  createPlan,
  updatePlan,
  billingKeys,
  type PlanDTO,
  type SaaPlan,
} from "@/lib/api-saas-billing";
import { useToast } from "@/hooks/use-toast";

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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { KentePattern } from "@/components/ds/kente-pattern";

export interface PlanFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Plan à éditer (null pour création). */
  plan?: SaaPlan | null;
}

export function PlanFormDialog({
  open,
  onOpenChange,
  plan,
}: PlanFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!plan;

  // ─── État du formulaire ────────────────────────────────────────────────
  const [code, setCode] = React.useState("");
  const [nom, setNom] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [prixMensuel, setPrixMensuel] = React.useState("0");
  const [prixAnnuel, setPrixAnnuel] = React.useState("0");
  const [nbElevesMax, setNbElevesMax] = React.useState("0");
  const [nbUsersMax, setNbUsersMax] = React.useState("0");
  const [actif, setActif] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  // Initialise / réinitialise à l'ouverture
  React.useEffect(() => {
    if (!open) return;
    if (plan) {
      setCode(plan.code);
      setNom(plan.nom);
      setDescription(plan.description ?? "");
      setPrixMensuel(String(plan.prix_mensuel ?? 0));
      setPrixAnnuel(String(plan.prix_annuel ?? 0));
      setNbElevesMax(String(plan.nb_eleves_max ?? 0));
      setNbUsersMax(String(plan.nb_users_max ?? 0));
      setActif(!!plan.actif);
    } else {
      setCode("");
      setNom("");
      setDescription("");
      setPrixMensuel("0");
      setPrixAnnuel("0");
      setNbElevesMax("0");
      setNbUsersMax("0");
      setActif(true);
    }
  }, [open, plan]);

  const mutation = useMutation({
    mutationFn: async (dto: PlanDTO) => {
      if (isEdit && plan) return updatePlan(plan.id, dto);
      return createPlan(dto);
    },
    onMutate: () => setSubmitting(true),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: billingKeys.plans() });
      await queryClient.invalidateQueries({ queryKey: billingKeys.stats() });
      toast({
        title: isEdit ? "Plan mis à jour" : "Plan créé",
        description: `« ${saved.nom} » a été ${
          isEdit ? "modifié" : "ajouté"
        } avec succès.`,
      });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Enregistrement impossible",
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
    const dto: PlanDTO = {
      code: code.trim().toUpperCase(),
      nom: nom.trim(),
      description: description.trim(),
      prix_mensuel: Number(prixMensuel) || 0,
      prix_annuel: Number(prixAnnuel) || 0,
      nb_eleves_max: Number(nbElevesMax) || 0,
      nb_users_max: Number(nbUsersMax) || 0,
      actif,
    };
    if (!dto.code || !dto.nom) {
      toast({
        title: "Champs requis",
        description: "Le code et le nom du plan sont obligatoires.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate(dto);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-[560px]">
        <KentePattern variant="strip" position="top" />
        <div className="px-6 pt-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CreditCard className="size-4" />
            </div>
            {isEdit ? "Modifier le plan" : "Nouveau plan tarifaire"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Mettez à jour les tarifs et limites du plan."
              : "Définissez un nouveau plan tarifaire pour les établissements."}
          </DialogDescription>
        </DialogHeader>
        </div>

        <div className="px-6 pb-6 pt-4">

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="plan-code" className="text-xs">
                Code <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="plan-code"
                placeholder="BASIC"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={submitting}
                className="font-mono uppercase"
              />
              <p className="text-[10px] text-muted-foreground">
                Code court en majuscules (ex : BASIC, PRO, ENTERPRISE).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-nom" className="text-xs">
                Nom <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="plan-nom"
                placeholder="Basique"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-description" className="text-xs">
              Description
            </Label>
            <Textarea
              id="plan-description"
              placeholder="Description du plan, fonctionnalités incluses…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={submitting}
              rows={3}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="plan-prix-mensuel" className="text-xs">
                Prix mensuel (FCFA)
              </Label>
              <Input
                id="plan-prix-mensuel"
                type="number"
                min={0}
                step={500}
                value={prixMensuel}
                onChange={(e) => setPrixMensuel(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-prix-annuel" className="text-xs">
                Prix annuel (FCFA)
              </Label>
              <Input
                id="plan-prix-annuel"
                type="number"
                min={0}
                step={500}
                value={prixAnnuel}
                onChange={(e) => setPrixAnnuel(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="plan-eleves" className="text-xs">
                Élèves max
              </Label>
              <Input
                id="plan-eleves"
                type="number"
                min={0}
                value={nbElevesMax}
                onChange={(e) => setNbElevesMax(e.target.value)}
                disabled={submitting}
              />
              <p className="text-[10px] text-muted-foreground">
                0 = illimité.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="plan-users" className="text-xs">
                Utilisateurs max
              </Label>
              <Input
                id="plan-users"
                type="number"
                min={0}
                value={nbUsersMax}
                onChange={(e) => setNbUsersMax(e.target.value)}
                disabled={submitting}
              />
              <p className="text-[10px] text-muted-foreground">
                0 = illimité.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2.5">
            <div>
              <Label
                htmlFor="plan-actif"
                className="text-xs font-medium cursor-pointer"
              >
                Plan actif
              </Label>
              <p className="text-[10px] text-muted-foreground">
                Les plans inactifs ne sont pas proposés aux nouveaux abonnés.
              </p>
            </div>
            <Switch
              id="plan-actif"
              checked={actif}
              onCheckedChange={setActif}
              disabled={submitting}
            />
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
                <CreditCard className="size-3.5" />
              )}
              {isEdit ? "Enregistrer" : "Créer le plan"}
            </Button>
          </DialogFooter>
        </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
