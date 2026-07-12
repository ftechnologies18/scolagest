"use client";

/**
 * ScolaGest — Dialogue d'inscription d'un élève (Phase 2)
 *
 * Modal shadcn permettant d'ajouter une inscription à un élève :
 *  - Classe (Select, liste des classes de l'établissement courant)
 *  - Année scolaire (Select, défaut = année active)
 *  - Statut (Select, défaut INSCRIT)
 *  - Dérogation (Switch) — si activé, montre le motif
 *
 * À la soumission, appelle `createInscription(eleveId, dto)` puis
 * invalide le cache React Query de la fiche élève et de la liste.
 */

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Loader2, GraduationCap, AlertTriangle } from "lucide-react";

import { useAuthStore } from "@/lib/auth-store";
import {
  createInscription,
  fetchActiveAnnee,
  fetchAnneesScolaires,
  fetchClasses,
  elevesKeys,
  inscriptionsKeys,
  classesKeys,
  anneesKeys,
} from "@/lib/api-students";
import type { StatutInscription } from "@/lib/types";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

const inscriptionSchema = z
  .object({
    classe_id: z.string().min(1, "Sélectionnez une classe"),
    annee_scolaire_id: z.string().min(1, "Sélectionnez une année"),
    statut: z.string().min(1),
    derogation_inscription: z.boolean(),
    motif_derogation: z.string().optional(),
  })
  .refine(
    (data) =>
      !data.derogation_inscription ||
      (data.motif_derogation ?? "").trim().length >= 3,
    {
      message: "Indiquez le motif de la dérogation (3 caractères min.).",
      path: ["motif_derogation"],
    },
  );

type InscriptionFormValues = z.infer<typeof inscriptionSchema>;

const STATUT_OPTIONS: { value: StatutInscription; label: string }[] = [
  { value: "PRE_INSCRIT", label: "Pré-inscrit (paiement requis)" },
  { value: "INSCRIT", label: "Inscrit" },
  { value: "REINSCRIT", label: "Réinscrit" },
  { value: "TRANSFERE", label: "Transféré" },
  { value: "ABANDON", label: "Abandon" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export interface InscriptionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eleveId: string;
  /** Optionnel : présélection d'une classe. */
  defaultClasseId?: string;
}

export function InscriptionDialog({
  open,
  onOpenChange,
  eleveId,
  defaultClasseId,
}: InscriptionDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const etablissement = useAuthStore((s) => s.etablissement);

  // Année active pour pré-remplir
  const { data: activeAnnee } = useQuery({
    queryKey: anneesKeys.active(),
    queryFn: fetchActiveAnnee,
    enabled: open,
  });

  // Toutes les années
  const { data: annees } = useQuery({
    queryKey: anneesKeys.list(),
    queryFn: fetchAnneesScolaires,
    enabled: open,
  });

  // Classes de l'établissement
  const { data: classes } = useQuery({
    queryKey: classesKeys.list(etablissement?.id),
    queryFn: () => fetchClasses(etablissement?.id),
    enabled: open,
  });

  const form = useForm<InscriptionFormValues>({
    resolver: zodResolver(inscriptionSchema),
    defaultValues: {
      classe_id: "",
      annee_scolaire_id: "",
      statut: "INSCRIT",
      derogation_inscription: false,
      motif_derogation: "",
    },
  });

  // Pré-remplit avec l'année active + classe par défaut
  React.useEffect(() => {
    if (!open) return;
    form.reset({
      classe_id: defaultClasseId ?? "",
      annee_scolaire_id: activeAnnee?.id ?? "",
      statut: "INSCRIT",
      derogation_inscription: false,
      motif_derogation: "",
    });
  }, [open, activeAnnee, defaultClasseId, form]);

  const mutation = useMutation({
    mutationFn: (values: InscriptionFormValues) =>
      createInscription(eleveId, {
        classe_id: values.classe_id,
        annee_scolaire_id: values.annee_scolaire_id,
        statut: values.statut as StatutInscription,
        derogation_inscription: values.derogation_inscription,
        motif_derogation: values.derogation_inscription
          ? values.motif_derogation
          : "",
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: elevesKeys.detail(eleveId),
        }),
        queryClient.invalidateQueries({ queryKey: elevesKeys.lists() }),
        queryClient.invalidateQueries({
          queryKey: inscriptionsKeys.list(eleveId),
        }),
      ]);
      toast({
        title: "Inscription créée",
        description: "L'élève a été inscrit avec succès.",
      });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de créer l'inscription.",
        variant: "destructive",
      });
    },
  });

  const derogationActive = useWatch({
    control: form.control,
    name: "derogation_inscription",
  });
  const classeValue = useWatch({
    control: form.control,
    name: "classe_id",
  });
  const anneeValue = useWatch({
    control: form.control,
    name: "annee_scolaire_id",
  });
  const statutValue = useWatch({ control: form.control, name: "statut" });

  function onSubmit(values: InscriptionFormValues) {
    mutation.mutate(values);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GraduationCap className="size-5 text-emerald-600" />
            Nouvelle inscription
          </DialogTitle>
          <DialogDescription>
            Inscrivez cet élève dans une classe pour une année scolaire.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Classe</Label>
              <Select
                value={classeValue}
                onValueChange={(v) =>
                  form.setValue("classe_id", v, { shouldDirty: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {(classes ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.classe_id ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.classe_id.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label>Année scolaire</Label>
              <Select
                value={anneeValue}
                onValueChange={(v) =>
                  form.setValue("annee_scolaire_id", v, { shouldDirty: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {(annees ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.libelle}
                      {a.est_active ? " (active)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.annee_scolaire_id ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.annee_scolaire_id.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Statut</Label>
              <Select
                value={statutValue}
                onValueChange={(v) =>
                  form.setValue("statut", v, { shouldDirty: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {STATUT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dérogation */}
          <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="size-3.5" />
                  Dérogation d&apos;inscription
                </Label>
                <p className="text-xs text-amber-700/80 dark:text-amber-400/80">
                  Activez si l&apos;inscription déroge à la règle (ex.hors délai,
                  cycle inhabituel). Un motif est alors obligatoire.
                </p>
              </div>
              <Switch
                checked={derogationActive}
                onCheckedChange={(v) =>
                  form.setValue("derogation_inscription", v, {
                    shouldDirty: true,
                  })
                }
                aria-label="Dérogation d'inscription"
              />
            </div>
            {derogationActive ? (
              <div className="space-y-1.5">
                <Label htmlFor="motif-derogation">Motif de la dérogation</Label>
                <Textarea
                  id="motif-derogation"
                  placeholder="Ex. Inscription tardive autorisée par la direction…"
                  rows={2}
                  {...form.register("motif_derogation")}
                />
                {form.formState.errors.motif_derogation ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.motif_derogation.message}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Création…
                </>
              ) : (
                "Inscrire l'élève"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
