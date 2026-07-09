"use client";

/**
 * ScolaGest — Dialogue de création d'un tuteur (Phase 2)
 *
 * Modal shadcn utilisé depuis le formulaire élève pour créer un tuteur
 * à la volée. À la soumission, appelle `createTuteur` puis déclenche la
 * callback `onCreated(tuteur)` afin que le formulaire élève puisse
 * présélectionner ce tuteur.
 *
 * Champs : nom* + prenoms + telephone* + telephone2 + email + adresse +
 * lien_parente (Select) + profession.
 */

import * as React from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { UserPlus, Loader2 } from "lucide-react";

import { createTuteur, tuteursKeys } from "@/lib/api-students";
import type { LienParente, Tuteur } from "@/lib/types";
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

const tuteurSchema = z.object({
  nom: z.string().trim().min(1, "Le nom est obligatoire"),
  prenoms: z.string().trim().optional(),
  telephone: z
    .string()
    .trim()
    .min(1, "Le téléphone est obligatoire"),
  telephone2: z.string().trim().optional(),
  email: z.string().trim().optional(),
  adresse: z.string().trim().optional(),
  lien_parente: z.string().optional(),
  profession: z.string().trim().optional(),
});

type TuteurFormValues = z.infer<typeof tuteurSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────────────────────────────────────

const LIEN_PARENTE_OPTIONS: { value: LienParente; label: string }[] = [
  { value: "PERE", label: "Père" },
  { value: "MERE", label: "Mère" },
  { value: "TUTEUR_LEGAL", label: "Tuteur légal" },
  { value: "AUTRE", label: "Autre" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export interface TuteurDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Appelé après création réussie du tuteur. */
  onCreated: (tuteur: Tuteur) => void;
}

export function TuteurDialog({
  open,
  onOpenChange,
  onCreated,
}: TuteurDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<TuteurFormValues>({
    resolver: zodResolver(tuteurSchema),
    defaultValues: {
      nom: "",
      prenoms: "",
      telephone: "",
      telephone2: "",
      email: "",
      adresse: "",
      lien_parente: "TUTEUR_LEGAL",
      profession: "",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: TuteurFormValues) =>
      createTuteur({
        nom: values.nom,
        prenoms: values.prenoms,
        telephone: values.telephone,
        telephone2: values.telephone2,
        email: values.email,
        adresse: values.adresse,
        lien_parente:
          (values.lien_parente as LienParente) || "TUTEUR_LEGAL",
        profession: values.profession,
        actif: true,
      }),
    onSuccess: async (tuteur) => {
      await queryClient.invalidateQueries({ queryKey: tuteursKeys.lists() });
      toast({
        title: "Tuteur créé",
        description: `${tuteur.prenoms ?? ""} ${tuteur.nom}`.trim(),
      });
      onCreated(tuteur);
      form.reset();
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de créer le tuteur.",
        variant: "destructive",
      });
    },
  });

  function onSubmit(values: TuteurFormValues) {
    mutation.mutate(values);
  }

  // Réinitialise le formulaire à l'ouverture
  React.useEffect(() => {
    if (open) {
      form.reset();
    }
  }, [open, form]);

  const lienParenteValue = useWatch({
    control: form.control,
    name: "lien_parente",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="size-5 text-emerald-600" />
            Nouveau tuteur
          </DialogTitle>
          <DialogDescription>
            Créez un tuteur à la volée. Il sera automatiquement affecté à
            l&apos;élève en cours.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Nom"
              required
              error={form.formState.errors.nom?.message}
            >
              <Input
                placeholder="Koné"
                autoComplete="family-name"
                {...form.register("nom")}
              />
            </FormField>

            <FormField
              label="Prénoms"
              error={form.formState.errors.prenoms?.message}
            >
              <Input
                placeholder="Aminata"
                autoComplete="given-name"
                {...form.register("prenoms")}
              />
            </FormField>

            <FormField
              label="Téléphone"
              required
              error={form.formState.errors.telephone?.message}
            >
              <Input
                placeholder="+225 07 00 00 00 00"
                inputMode="tel"
                autoComplete="tel"
                {...form.register("telephone")}
              />
            </FormField>

            <FormField
              label="Téléphone 2"
              error={form.formState.errors.telephone2?.message}
            >
              <Input
                placeholder="+225 05 00 00 00 00"
                inputMode="tel"
                {...form.register("telephone2")}
              />
            </FormField>

            <FormField
              label="Email"
              error={form.formState.errors.email?.message}
            >
              <Input
                type="email"
                placeholder="tuteur@exemple.ci"
                autoComplete="email"
                {...form.register("email")}
              />
            </FormField>

            <FormField
              label="Lien de parenté"
              error={form.formState.errors.lien_parente?.message}
            >
              <Select
                value={lienParenteValue}
                onValueChange={(v) =>
                  form.setValue("lien_parente", v, { shouldDirty: true })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {LIEN_PARENTE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="Profession"
              error={form.formState.errors.profession?.message}
            >
              <Input
                placeholder="Commerçante"
                {...form.register("profession")}
              />
            </FormField>

            <FormField
              label="Adresse"
              error={form.formState.errors.adresse?.message}
              className="sm:col-span-2"
            >
              <Input
                placeholder="Quartier, ville"
                {...form.register("adresse")}
              />
            </FormField>
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
                "Créer le tuteur"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composant champ
// ─────────────────────────────────────────────────────────────────────────────

function FormField({
  label,
  required,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
