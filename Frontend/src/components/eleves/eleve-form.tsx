"use client";

/**
 * ScolaGest — Formulaire de création / édition d'un élève (Phase 2 — Refonte)
 *
 * Champs :
 *  - nom* + prenoms
 *  - date_naissance (input type=date)
 *  - lieu_naissance
 *  - sexe (RadioGroup M/F)
 *  - matricule_ministere (hint : laisser vide pour le préscolaire)
 *  - catégorie (Select — options dépendent de l'établissement)
 *  - statut (Select)
 *  - photo_url (text input optionnel + Avatar preview)
 *  - tuteur (Select + option "Créer nouveau tuteur" → TuteurDialog)
 *
 * Refonte Forêt EdTech :
 *  - Header avec stepper visuel (3 étapes : Identité → Scolarité → Tuteur &
 *    photo). Le formulaire reste en un seul tenant ; les sections sont
 *    visuellement délimitées par des GlassCard numérotées.
 *  - Chaque section : header avec badge rond emerald numéroté + titre
 *    `font-display` + sous-titre.
 *  - KentePattern separator entre les sections.
 *  - Photo preview : si `photo_url` est rempli, Avatar size-20 à côté du
 *    champ.
 *  - Tuteur Select : item "Créer un nouveau tuteur" avec separator au-dessus.
 *  - Bouton submit : sticky en bas de page sur mobile (backdrop-blur).
 *
 * Validation zod + react-hook-form. À la soumission, appelle
 * createEleve (mode création) ou updateEleve (mode édition), toast,
 * puis `onSaved(id)`.
 *
 * LOGIQUE MÉTIER INTACTE : hooks, mutations, query keys, DTOs, types,
 * endpoints API.
 */

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  ArrowLeft,
  Loader2,
  UserPlus,
  Save,
  AlertCircle,
  IdCard,
  GraduationCap,
  Image as ImageIcon,
} from "lucide-react";

import { useAuthStore } from "@/lib/auth-store";
import {
  createEleve,
  fetchEleve,
  fetchTuteurs,
  updateEleve,
  elevesKeys,
  tuteursKeys,
} from "@/lib/api-students";
import type {
  CategorieEleve,
  EleveDTO,
  StatutEleve,
  Tuteur,
} from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import { TuteurDialog } from "@/components/eleves/tuteur-dialog";
import { initialsOf } from "@/components/eleves/eleves-list";

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

const eleveSchema = z.object({
  nom: z.string().trim().min(1, "Le nom est obligatoire"),
  prenoms: z.string().trim().optional(),
  date_naissance: z.string().optional(),
  lieu_naissance: z.string().trim().optional(),
  sexe: z.enum(["M", "F", ""]).optional(),
  matricule_ministere: z.string().trim().optional(),
  categorie: z
    .enum(["AFFECTE", "NON_AFFECTE", "NON_APPLICABLE"])
    .refine((v) => !!v, "Sélectionnez une catégorie"),
  statut: z.enum(["ACTIF", "INACTIF", "TRANSFERE", "DIPLOME"]),
  photo_url: z.string().trim().optional(),
  tuteur_id: z.string().optional(),
});

type EleveFormValues = z.infer<typeof eleveSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Options
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIE_OPTIONS: { value: CategorieEleve; label: string }[] = [
  { value: "AFFECTE", label: "Affecté" },
  { value: "NON_AFFECTE", label: "Non affecté" },
];

const STATUT_OPTIONS: { value: StatutEleve; label: string }[] = [
  { value: "ACTIF", label: "Actif" },
  { value: "INACTIF", label: "Inactif" },
  { value: "TRANSFERE", label: "Transféré" },
  { value: "DIPLOME", label: "Diplômé" },
];

const SECTIONS = [
  { num: 1, label: "Identité" },
  { num: 2, label: "Scolarité" },
  { num: 3, label: "Tuteur & photo" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export interface EleveFormProps {
  /** Si fourni : mode édition. Sinon : mode création. */
  eleveId?: string;
  /** Appelé après sauvegarde réussie avec l'ID de l'élève. */
  onSaved: (id: string) => void;
  /** Annulation. */
  onCancel: () => void;
}

export function EleveForm({ eleveId, onSaved, onCancel }: EleveFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const etablissement = useAuthStore((s) => s.etablissement);

  const isEditMode = !!eleveId;
  const appliqueCategorie = !!etablissement?.applique_categorie_affecte;

  // Chargement de l'élève existant (mode édition)
  const { data: existingEleve, isLoading: isLoadingEleve } = useQuery({
    queryKey: elevesKeys.detail(eleveId ?? "new"),
    queryFn: () => fetchEleve(eleveId!),
    enabled: isEditMode,
  });

  // Chargement de la liste des tuteurs
  const { data: tuteurs } = useQuery<Tuteur[]>({
    queryKey: tuteursKeys.list(),
    queryFn: () => fetchTuteurs(),
  });

  // État local du sélecteur "nouveau tuteur"
  const [tuteurDialogOpen, setTuteurDialogOpen] = React.useState(false);

  // Init du formulaire
  const form = useForm<EleveFormValues>({
    resolver: zodResolver(eleveSchema),
    defaultValues: {
      nom: "",
      prenoms: "",
      date_naissance: "",
      lieu_naissance: "",
      sexe: "",
      matricule_ministere: "",
      categorie: appliqueCategorie ? "AFFECTE" : "NON_APPLICABLE",
      statut: "ACTIF",
      photo_url: "",
      tuteur_id: "",
    },
  });

  // useWatch (vs form.watch) évite les avertissements du React Compiler et
  // permet à chaque champ contrôlé de ne se re-render que lorsque sa valeur
  // change. Doit être appelé AVANT tout early return (règle des hooks).
  const tuteurValue = useWatch({ control: form.control, name: "tuteur_id" });
  const categorieValue = useWatch({
    control: form.control,
    name: "categorie",
  });
  const sexeValue = useWatch({ control: form.control, name: "sexe" });
  const statutValue = useWatch({ control: form.control, name: "statut" });
  const photoUrlValue = useWatch({ control: form.control, name: "photo_url" });
  const nomValue = useWatch({ control: form.control, name: "nom" });
  const prenomsValue = useWatch({ control: form.control, name: "prenoms" });

  // Quand l'élève existant est chargé, on hydrate le formulaire
  React.useEffect(() => {
    if (!isEditMode || !existingEleve) return;
    form.reset({
      nom: existingEleve.nom ?? "",
      prenoms: existingEleve.prenoms ?? "",
      date_naissance: existingEleve.date_naissance
        ? existingEleve.date_naissance.slice(0, 10)
        : "",
      lieu_naissance: existingEleve.lieu_naissance ?? "",
      sexe: (existingEleve.sexe as "M" | "F" | "") ?? "",
      matricule_ministere: existingEleve.matricule_ministere ?? "",
      categorie: existingEleve.categorie,
      statut: existingEleve.statut,
      photo_url: existingEleve.photo_url ?? "",
      tuteur_id: existingEleve.tuteur_id ?? "",
    });
  }, [existingEleve, isEditMode, form]);

  // Mutation create
  const createMutation = useMutation({
    mutationFn: (dto: EleveDTO) => createEleve(dto),
    onSuccess: async (eleve) => {
      await queryClient.invalidateQueries({ queryKey: elevesKeys.lists() });
      toast({
        title: "Élève créé",
        description: `Matricule interne : ${eleve.identifiant_interne}`,
      });
      onSaved(eleve.id);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur lors de la création",
        description:
          err instanceof Error ? err.message : "Réessayez dans un instant.",
        variant: "destructive",
      });
    },
  });

  // Mutation update
  const updateMutation = useMutation({
    mutationFn: (dto: Partial<EleveDTO>) =>
      updateEleve(eleveId!, dto),
    onSuccess: async (eleve) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: elevesKeys.detail(eleveId!),
        }),
        queryClient.invalidateQueries({ queryKey: elevesKeys.lists() }),
      ]);
      toast({
        title: "Modifications enregistrées",
        description: `Fiche de ${eleve.nom} mise à jour.`,
      });
      onSaved(eleve.id);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur lors de la modification",
        description:
          err instanceof Error ? err.message : "Réessayez dans un instant.",
        variant: "destructive",
      });
    },
  });

  function onSubmit(values: EleveFormValues) {
    const dto: EleveDTO = {
      nom: values.nom,
      prenoms: values.prenoms || undefined,
      date_naissance: values.date_naissance || null,
      lieu_naissance: values.lieu_naissance || "",
      sexe: (values.sexe as "M" | "F" | "") || "",
      categorie: values.categorie,
      matricule_ministere: values.matricule_ministere || null,
      photo_url: values.photo_url || "",
      tuteur_id: values.tuteur_id || null,
      statut: values.statut,
    };
    if (isEditMode) {
      updateMutation.mutate(dto);
    } else {
      createMutation.mutate(dto);
    }
  }

  function handleTuteurCreated(tuteur: Tuteur) {
    form.setValue("tuteur_id", tuteur.id, { shouldDirty: true });
    // Invalide le cache des tuteurs pour rafraîchir la liste
    void queryClient.invalidateQueries({ queryKey: tuteursKeys.lists() });
    toast({
      title: "Tuteur sélectionné",
      description: `${tuteur.prenoms ?? ""} ${tuteur.nom}`.trim(),
    });
  }

  // ─── Pas d'établissement ─────────────────────────────────────────────────
  if (!etablissement) {
    return (
      <div className="space-y-4">
        <BackButton onClick={onCancel} />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <AlertCircle className="size-10 text-amber-600" />
            <p className="text-base font-medium">
              Sélectionnez un établissement
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              Vous devez sélectionner un établissement dans la barre latérale
              avant de créer ou modifier un élève.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Chargement (mode édition) ───────────────────────────────────────────
  if (isEditMode && isLoadingEleve) {
    return <FormSkeleton onCancel={onCancel} />;
  }

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-4 pb-20 sm:pb-0">
      <BackButton onClick={onCancel} />

      {/* Header avec stepper visuel */}
      <GlassCard variant="desktop" noHover className="p-5 sm:p-6">
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 className="font-display text-xl font-semibold tracking-tight text-forest sm:text-2xl">
              {isEditMode ? "Modifier l'élève" : "Nouvel élève"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isEditMode
                ? "Mettez à jour les informations de la fiche élève."
                : `Renseignez les informations de l'élève. Établissement : ${etablissement.nom}.`}
            </p>
          </div>

          {/* Stepper desktop horizontal */}
          <div className="hidden items-center gap-2 sm:flex">
            {SECTIONS.map((section, idx) => (
              <React.Fragment key={section.num}>
                <div className="flex items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white shadow-sm">
                    {section.num}
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {section.label}
                  </span>
                </div>
                {idx < SECTIONS.length - 1 ? (
                  <div className="h-0.5 flex-1 bg-gradient-to-r from-emerald-300 to-emerald-500" />
                ) : null}
              </React.Fragment>
            ))}
          </div>

          {/* Stepper mobile : barre de progression simple */}
          <div className="sm:hidden">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Formulaire en 3 sections</span>
              <span className="font-medium text-emerald-700">3 étapes</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full bg-gradient-to-r from-emerald-500 to-amber-500" />
            </div>
          </div>
        </div>
      </GlassCard>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* ─── Section 1 : Identité ───────────────────────────────────────── */}
        <SectionCard
          num={1}
          icon={IdCard}
          title="Identité"
          subtitle="État civil de l'élève"
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
              label="Date de naissance"
              error={form.formState.errors.date_naissance?.message}
            >
              <Input
                type="date"
                {...form.register("date_naissance")}
              />
            </FormField>

            <FormField
              label="Lieu de naissance"
              error={form.formState.errors.lieu_naissance?.message}
            >
              <Input
                placeholder="Dabou"
                {...form.register("lieu_naissance")}
              />
            </FormField>

            <FormField
              label="Sexe"
              error={form.formState.errors.sexe?.message}
              className="sm:col-span-2"
            >
              <RadioGroup
                value={sexeValue}
                onValueChange={(v) =>
                  form.setValue("sexe", v as "M" | "F" | "", {
                    shouldDirty: true,
                  })
                }
                className="flex gap-6 pt-1"
              >
                <Label
                  htmlFor="sexe-M"
                  className="flex cursor-pointer items-center gap-2 font-normal"
                >
                  <RadioGroupItem id="sexe-M" value="M" />
                  Masculin
                </Label>
                <Label
                  htmlFor="sexe-F"
                  className="flex cursor-pointer items-center gap-2 font-normal"
                >
                  <RadioGroupItem id="sexe-F" value="F" />
                  Féminin
                </Label>
              </RadioGroup>
            </FormField>
          </div>
        </SectionCard>

        <KentePattern variant="separator" />

        {/* ─── Section 2 : Scolarité ──────────────────────────────────────── */}
        <SectionCard
          num={2}
          icon={GraduationCap}
          title="Scolarité"
          subtitle="Matricule, catégorie & statut"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Matricule Ministère (MEN)"
              error={form.formState.errors.matricule_ministere?.message}
              hint="Laisser vide pour le préscolaire — identifiant interne généré automatiquement."
              className="sm:col-span-2"
            >
              <Input
                placeholder="Ex. 0103105091-A-24"
                className="font-mono"
                {...form.register("matricule_ministere")}
              />
            </FormField>

            <FormField
              label="Catégorie"
              required
              error={form.formState.errors.categorie?.message}
            >
              <Select
                value={categorieValue}
                onValueChange={(v) =>
                  form.setValue("categorie", v as CategorieEleve, {
                    shouldDirty: true,
                  })
                }
                disabled={!appliqueCategorie}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {appliqueCategorie ? (
                    CATEGORIE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="NON_APPLICABLE">
                      Non applicable
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {!appliqueCategorie ? (
                <p className="text-xs text-muted-foreground">
                  Cet établissement n&apos;applique pas la distinction
                  Affecté / Non affecté.
                </p>
              ) : null}
            </FormField>

            <FormField
              label="Statut"
              error={form.formState.errors.statut?.message}
            >
              <Select
                value={statutValue}
                onValueChange={(v) =>
                  form.setValue("statut", v as StatutEleve, {
                    shouldDirty: true,
                  })
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
            </FormField>
          </div>
        </SectionCard>

        <KentePattern variant="separator" />

        {/* ─── Section 3 : Tuteur & photo ─────────────────────────────────── */}
        <SectionCard
          num={3}
          icon={ImageIcon}
          title="Tuteur & photo"
          subtitle="Tuteur légal et visuel de l'élève"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              label="Tuteur"
              error={form.formState.errors.tuteur_id?.message}
              className="sm:col-span-2"
            >
              <Select
                value={tuteurValue || "none"}
                onValueChange={(v) => {
                  if (v === "__new__") {
                    setTuteurDialogOpen(true);
                    return;
                  }
                  form.setValue(
                    "tuteur_id",
                    v === "none" ? "" : v,
                    { shouldDirty: true },
                  );
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Aucun tuteur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun tuteur</SelectItem>
                  {tuteurs && tuteurs.length > 0 ? (
                    <SelectGroup>
                      <SelectLabel>Tuteurs existants</SelectLabel>
                      {tuteurs.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {`${t.prenoms ?? ""} ${t.nom}`.trim()}
                          {t.telephone ? ` · ${t.telephone}` : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                  <Separator className="my-1" />
                  <SelectItem value="__new__">
                    <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                      <UserPlus className="size-3.5" />
                      Créer un nouveau tuteur…
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </FormField>

            {/* Photo URL avec preview */}
            <FormField
              label="Photo (URL)"
              error={form.formState.errors.photo_url?.message}
              className="sm:col-span-2"
              hint="Collez une URL d'image. L'upload de fichier sera disponible plus tard."
            >
              <div className="flex items-center gap-3">
                <Avatar className="size-12 shrink-0 border-2 border-emerald-100 dark:border-emerald-900/40">
                  {photoUrlValue ? (
                    <AvatarImage
                      src={photoUrlValue}
                      alt="Aperçu photo"
                      onError={() => {
                        /* l'AvatarFallback s'affiche automatiquement */
                      }}
                    />
                  ) : null}
                  <AvatarFallback className="bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {photoUrlValue ? (
                      <ImageIcon className="size-4" />
                    ) : (
                      initialsOf(nomValue, prenomsValue) || "?"
                    )}
                  </AvatarFallback>
                </Avatar>
                <Input
                  type="url"
                  placeholder="https://exemple.com/photo.jpg"
                  className="flex-1"
                  {...form.register("photo_url")}
                />
              </div>
            </FormField>
          </div>
        </SectionCard>

        {/* Actions — sticky sur mobile */}
        <div className="sticky bottom-0 z-20 -mx-4 border-t border-emerald-100/50 bg-background/80 px-4 py-3 backdrop-blur-md dark:border-emerald-900/30 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              variant="success"
              className="w-full shadow-lg shadow-emerald-900/20 sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {isEditMode ? "Enregistrement…" : "Création…"}
                </>
              ) : (
                <>
                  <Save className="size-4" />
                  {isEditMode ? "Enregistrer" : "Créer l'élève"}
                </>
              )}
            </Button>
          </div>
        </div>
      </form>

      {/* Dialogue de création de tuteur */}
      <TuteurDialog
        open={tuteurDialogOpen}
        onOpenChange={setTuteurDialogOpen}
        onCreated={handleTuteurCreated}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className="-ml-2 text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" />
      Retour
    </Button>
  );
}

function SectionCard({
  num,
  icon: Icon,
  title,
  subtitle,
  children,
}: {
  num: number;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <GlassCard variant="adaptive" noHover>
      <div className="mb-4 flex items-start gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white shadow-sm">
          {num}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Icon className="size-4 text-emerald-600" />
            <h3 className="font-display text-base font-semibold leading-tight">
              {title}
            </h3>
          </div>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {children}
    </GlassCard>
  );
}

function FormField({
  label,
  required,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>
        {label}
        {required ? <span className="ml-0.5 text-destructive">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function FormSkeleton({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="space-y-4">
      <BackButton onClick={onCancel} />
      <Skeleton className="h-7 w-48" />
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="space-y-1.5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
