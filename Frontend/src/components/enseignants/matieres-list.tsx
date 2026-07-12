"use client";

/**
 * ScolaGest — Liste des matières (module Enseignant — Phase A).
 *
 * Vue principale du module Matières :
 *  - Grille de cartes (responsive) : code, libellé, coefficient, cycle (si
 *    défini), couleur (pastille), actif/inactif.
 *  - Bouton « Nouvelle matière » (emerald) qui ouvre le formulaire de création.
 *  - Boutons « Modifier » + « Supprimer » (avec confirm) sur chaque carte.
 *
 * États : pas d'établissement, chargement (skeleton), vide, erreur.
 */

import * as React from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  Loader2,
  Hash,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchMatieres,
  createMatiere,
  updateMatiere,
  deleteMatiere,
  type Matiere,
  type MatiereDTO,
} from "@/lib/api-enseignant";
import { fetchCycles, cyclesKeys } from "@/lib/api-students";
import { useToast } from "@/hooks/use-toast";
import type { Cycle } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers & constantes
// ─────────────────────────────────────────────────────────────────────────────

export const matieresListKeys = {
  all: ["matieres"] as const,
  list: () => [...matieresListKeys.all, "list"] as const,
};

/** Couleurs prédéfinies proposées dans le formulaire (palette non indigo/blue). */
const COULEUR_PRESETS = [
  { value: "#10b981", label: "Émeraude" },
  { value: "#f59e0b", label: "Ambre" },
  { value: "#ef4444", label: "Rouge" },
  { value: "#ec4899", label: "Rose" },
  { value: "#14b8a6", label: "Turquoise" },
  { value: "#84cc16", label: "Lime" },
  { value: "#a855f7", label: "Violet" },
  { value: "#64748b", label: "Slate" },
];

/** Couleur par défaut si la matière n'en a pas. */
const COULEUR_DEFAUT = "#10b981";

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function MatieresList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const etablissement = useAuthStore((s) => s.etablissement);

  // Dialogs
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Matiere | null>(null);

  const {
    data: matieres,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: matieresListKeys.list(),
    queryFn: fetchMatieres,
    enabled: !!etablissement,
  });

  // Cycles (pour le select du formulaire et l'affichage du cycle)
  const { data: cycles } = useQuery<Cycle[]>({
    queryKey: cyclesKeys.list(etablissement?.id),
    queryFn: () => fetchCycles(etablissement?.id),
    enabled: !!etablissement,
  });

  // ─── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (dto: MatiereDTO) => createMatiere(dto),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: matieresListKeys.all });
      toast({
        title: "Matière créée",
        description: "La matière a été ajoutée avec succès.",
      });
      setFormOpen(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de créer la matière.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<MatiereDTO> }) =>
      updateMatiere(id, dto),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: matieresListKeys.all });
      toast({
        title: "Matière modifiée",
        description: "Les modifications ont été enregistrées.",
      });
      setFormOpen(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de modifier la matière.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMatiere(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: matieresListKeys.all });
      toast({
        title: "Matière supprimée",
        description: "La matière a été retirée de l'établissement.",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de supprimer cette matière.",
        variant: "destructive",
      });
    },
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(m: Matiere) {
    setEditing(m);
    setFormOpen(true);
  }
  function handleSubmit(dto: MatiereDTO) {
    if (editing) {
      updateMutation.mutate({ id: editing.id, dto });
    } else {
      createMutation.mutate(dto);
    }
  }

  // ─── États ────────────────────────────────────────────────────────────────

  if (!etablissement) {
    return (
      <MatieresShell>
        <EmptyState
          icon={AlertCircle}
          tone="amber"
          title="Sélectionnez un établissement"
          description="Choisissez un établissement dans la barre latérale pour gérer ses matières."
        />
      </MatieresShell>
    );
  }

  return (
    <MatieresShell onNew={openCreate}>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          icon={AlertCircle}
          tone="rose"
          title="Erreur de chargement"
          description={
            error instanceof Error
              ? error.message
              : "Impossible de charger les matières. Vérifiez que le backend est démarré puis réessayez."
          }
        />
      ) : (matieres ?? []).length === 0 ? (
        <EmptyState
          icon={BookOpen}
          tone="emerald"
          title="Aucune matière"
          description="Cliquez sur « Nouvelle matière » pour créer votre première matière."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(matieres ?? []).map((m) => (
            <MatiereCard
              key={m.id}
              matiere={m}
              onEdit={() => openEdit(m)}
              onDelete={() => deleteMutation.mutate(m.id)}
              deleting={deleteMutation.isPending}
            />
          ))}
        </div>
      )}

      <MatiereFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        matiere={editing}
        cycles={cycles ?? []}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
      />
    </MatieresShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell (titre + bouton)
// ─────────────────────────────────────────────────────────────────────────────

function MatieresShell({
  children,
  onNew,
}: {
  children: React.ReactNode;
  onNew?: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <BookOpen className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Matières</h1>
            <p className="text-sm text-muted-foreground">
              Catalogue des matières enseignées : code, libellé, coefficient,
              cycle et couleur d&apos;affichage.
            </p>
          </div>
        </div>
        {onNew ? (
          <Button
            onClick={onNew}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Plus className="size-4" />
            Nouvelle matière
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carte d'une matière
// ─────────────────────────────────────────────────────────────────────────────

function MatiereCard({
  matiere,
  onEdit,
  onDelete,
  deleting,
}: {
  matiere: Matiere;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const couleur = matiere.couleur || COULEUR_DEFAUT;
  return (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span
              className="inline-block size-4 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-900"
              style={{ backgroundColor: couleur }}
              aria-hidden
            />
            <CardTitle className="text-base leading-tight">
              {matiere.libelle}
            </CardTitle>
          </div>
          {!matiere.actif ? (
            <Badge
              variant="outline"
              className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
            >
              Inactif
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              Actif
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <Badge
            variant="outline"
            className="border-muted-foreground/20 bg-muted/40 font-mono font-normal"
          >
            <Hash className="size-3" />
            {matiere.code}
          </Badge>
          {matiere.cycle ? (
            <Badge
              variant="outline"
              className="border-muted-foreground/20 bg-muted/40 font-normal"
            >
              {matiere.cycle.libelle}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">Coefficient</span>
          <span className="font-mono font-medium">
            {matiere.coefficient ?? 1}
          </span>
        </div>

        <div className="flex justify-end gap-1 border-t pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="text-emerald-700 hover:bg-emerald-50"
          >
            <Pencil className="size-3.5" />
            Modifier
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-rose-50"
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Supprimer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Supprimer cette matière ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. La matière « {matiere.libelle} »
                  sera retirée du catalogue. Les associations existantes avec
                  les enseignants et les affectations peuvent être affectées.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-white hover:bg-destructive/90"
                >
                  Supprimer définitivement
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog : formulaire création / édition
// ─────────────────────────────────────────────────────────────────────────────

interface FormState {
  code: string;
  libelle: string;
  coefficient: string;
  cycle_id: string; // "NONE" si pas de cycle
  couleur: string;
  actif: boolean;
}

function MatiereFormDialog({
  open,
  onOpenChange,
  matiere,
  cycles,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  matiere: Matiere | null;
  cycles: Cycle[];
  onSubmit: (dto: MatiereDTO) => void;
  submitting: boolean;
}) {
  const isEdit = !!matiere;

  const [form, setForm] = React.useState<FormState>({
    code: "",
    libelle: "",
    coefficient: "1",
    cycle_id: "NONE",
    couleur: COULEUR_DEFAUT,
    actif: true,
  });
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    if (matiere) {
      setForm({
        code: matiere.code ?? "",
        libelle: matiere.libelle ?? "",
        coefficient:
          matiere.coefficient != null ? String(matiere.coefficient) : "1",
        cycle_id: matiere.cycle_id ?? "NONE",
        couleur: matiere.couleur || COULEUR_DEFAUT,
        actif: matiere.actif,
      });
    } else {
      setForm({
        code: "",
        libelle: "",
        coefficient: "1",
        cycle_id: "NONE",
        couleur: COULEUR_DEFAUT,
        actif: true,
      });
    }
  }, [open, matiere]);

  const codeValid = form.code.trim().length > 0;
  const libelleValid = form.libelle.trim().length > 0;
  const coefValid =
    !Number.isNaN(Number(form.coefficient)) && Number(form.coefficient) > 0;
  const formValid = codeValid && libelleValid && coefValid;

  function handleSave() {
    setSubmitted(true);
    if (!formValid) return;
    const dto: MatiereDTO = {
      code: form.code.trim(),
      libelle: form.libelle.trim(),
      coefficient: Number(form.coefficient),
      cycle_id: form.cycle_id === "NONE" ? null : form.cycle_id,
      couleur: form.couleur,
      actif: form.actif,
    };
    onSubmit(dto);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier la matière" : "Nouvelle matière"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Mettez à jour les informations de la matière."
              : "Renseignez les informations de la matière."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Code */}
            <div className="space-y-1.5">
              <Label htmlFor="mat-code">
                Code <span className="text-destructive">*</span>
              </Label>
              <Input
                id="mat-code"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="MATH"
                aria-invalid={submitted && !codeValid}
              />
              {submitted && !codeValid ? (
                <p className="text-[11px] text-destructive">Le code est requis.</p>
              ) : null}
            </div>

            {/* Coefficient */}
            <div className="space-y-1.5">
              <Label htmlFor="mat-coef">Coefficient</Label>
              <Input
                id="mat-coef"
                type="number"
                min={0}
                step="0.5"
                value={form.coefficient}
                onChange={(e) =>
                  setForm({ ...form, coefficient: e.target.value })
                }
                aria-invalid={submitted && !coefValid}
              />
              {submitted && !coefValid ? (
                <p className="text-[11px] text-destructive">
                  Coefficient invalide.
                </p>
              ) : null}
            </div>
          </div>

          {/* Libellé */}
          <div className="space-y-1.5">
            <Label htmlFor="mat-libelle">
              Libellé <span className="text-destructive">*</span>
            </Label>
            <Input
              id="mat-libelle"
              value={form.libelle}
              onChange={(e) => setForm({ ...form, libelle: e.target.value })}
              placeholder="Mathématiques"
              aria-invalid={submitted && !libelleValid}
            />
            {submitted && !libelleValid ? (
              <p className="text-[11px] text-destructive">
                Le libellé est requis.
              </p>
            ) : null}
          </div>

          {/* Cycle (optionnel) */}
          <div className="space-y-1.5">
            <Label htmlFor="mat-cycle">Cycle (optionnel)</Label>
            <Select
              value={form.cycle_id}
              onValueChange={(v) => setForm({ ...form, cycle_id: v })}
            >
              <SelectTrigger id="mat-cycle">
                <SelectValue placeholder="Tous cycles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Tous cycles</SelectItem>
                {cycles.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Couleur */}
          <div className="space-y-1.5">
            <Label>Couleur d&apos;affichage</Label>
            <div className="flex flex-wrap gap-1.5">
              {COULEUR_PRESETS.map((c) => {
                const selected = form.couleur.toLowerCase() === c.value.toLowerCase();
                return (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setForm({ ...form, couleur: c.value })}
                    className={cn(
                      "size-7 rounded-full ring-2 ring-offset-2 ring-offset-background transition-transform hover:scale-110",
                      selected ? "ring-foreground" : "ring-transparent",
                    )}
                    style={{ backgroundColor: c.value }}
                    aria-label={`Couleur ${c.label}`}
                    aria-pressed={selected}
                  />
                );
              })}
            </div>
          </div>

          {/* Actif */}
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2.5">
            <div className="space-y-0.5">
              <Label htmlFor="mat-actif" className="cursor-pointer">
                Matière active
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Une matière inactive n&apos;apparaît plus dans les sélecteurs
                d&apos;affectation.
              </p>
            </div>
            <Switch
              id="mat-actif"
              checked={form.actif}
              onCheckedChange={(v) => setForm({ ...form, actif: v })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={submitting}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isEdit ? (
              "Enregistrer"
            ) : (
              "Créer la matière"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// États vides
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  tone,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "emerald" | "amber" | "rose";
  title: string;
  description: string;
}) {
  const cls = {
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  }[tone];
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-full",
            cls,
          )}
        >
          <Icon className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-medium">{title}</p>
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default MatieresList;
