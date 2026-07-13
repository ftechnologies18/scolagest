"use client";

/**
 * ScolaGest — Liste des matières (module Enseignant — Phase A).
 *
 * Vue principale du module Matières :
 *  - Grille de cartes (responsive) : code, libellé, coefficient, cycle (si
 *    défini), couleur (pastille), actif/inactif.
 *  - Bouton « Nouvelle matière » (variant success) qui ouvre le formulaire.
 *  - Boutons « Modifier » + « Supprimer » (avec confirm) sur chaque carte.
 *
 * Refonte Forêt EdTech :
 *  - Hero header GlassCard desktop + KentePattern strip top + badge rond
 *    gradient emerald→gold (BookOpen) + pill « Phase A » outline.
 *  - 4 StatCards DS (emerald / forest / terracotta / gold) avec stagger
 *    delay 0/0.05/0.1/0.15.
 *  - MatiereCard : GlassCard adaptive AVEC hover lift + pastille couleur +
 *    libellé font-display + badges renforcés (border-300 bg-100 text-800) +
 *    coefficient avec Hash en badge gold/15 + boutons Modifier/Supprimer avec
 *    title natif (PAS de Tooltip Radix — BUG À ÉVITER #1) + motion.div
 *    stagger delay index*0.05.
 *  - MatiereFormDialog premium : header badge rond gradient + 3 sections
 *    GlassCard tablet (Identification / Pédagogie / Affichage) + footer
 *    grid-cols-2 mobile + bouton submit variant success.
 *  - Empty states premium : KentePattern bg + badges ronds colorés.
 *  - Loading state : KentePattern strip top + 6 Skeletons cards.
 *
 * Le contexte d'établissement vient de `useAuthStore`. Si aucun établissement
 * n'est sélectionné, on invite l'utilisateur à en choisir un.
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query (matieresListKeys.list() /
 * cyclesKeys.list() / fetchMatieres / fetchCycles / enabled: !!etablissement),
 * mutations (createMutation / updateMutation / deleteMutation) + invalidate-
 * Queries, handlers (openCreate / openEdit / handleSubmit), types Matiere /
 * MatiereDTO / Cycle, constantes COULEUR_PRESETS / COULEUR_DEFAUT / matieres-
 * ListKeys, FormState + validation code/libellé/coef. Aucun endpoint backend
 * touché.
 *
 * États : pas d'établissement, chargement (skeleton), vide, erreur.
 */

import * as React from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  Loader2,
  Hash,
  CheckCircle2,
  UserX,
  Layers,
  Tag,
  GraduationCap,
  Palette,
  type LucideIcon,
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
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { Cycle } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { StatCard } from "@/components/ds/stat-card";

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
  const prefersReducedMotion = usePrefersReducedMotion();

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

  // ─── KPIs calculés (Total / Actives / Inactives / Avec cycle) ──────────────
  const list = matieres ?? [];
  const kpis = React.useMemo(() => {
    let actives = 0;
    let inactives = 0;
    let avecCycle = 0;
    for (const m of list) {
      if (m.actif) actives += 1;
      else inactives += 1;
      if (m.cycle_id) avecCycle += 1;
    }
    return { total: list.length, actives, inactives, avecCycle };
  }, [list]);

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
      {/* ─── 4 StatCards de résumé ────────────────────────────────────────── */}
      <section
        aria-label="Résumé des matières"
        className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4"
      >
        <StatCard
          icon={BookOpen}
          tone="emerald"
          label="Total matières"
          value={kpis.total}
          hint={isLoading ? "chargement…" : "dans le catalogue"}
          delay={0}
          className="h-full"
        />
        <StatCard
          icon={CheckCircle2}
          tone="forest"
          label="Actives"
          value={kpis.actives}
          hint="disponibles pour affectation"
          delay={0.05}
          className="h-full"
        />
        <StatCard
          icon={UserX}
          tone="terracotta"
          label="Inactives"
          value={kpis.inactives}
          hint="masquées des sélecteurs"
          delay={0.1}
          className="h-full"
        />
        <StatCard
          icon={Layers}
          tone="gold"
          label="Avec cycle"
          value={kpis.avecCycle}
          hint="restreintes à un cycle"
          delay={0.15}
          className="h-full"
        />
      </section>

      <KentePattern variant="separator" className="my-1" />

      {/* ─── Contenu : grille / skeleton / empty / error ──────────────────── */}
      {isLoading ? (
        <LoadingState />
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
      ) : list.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          tone="emerald"
          title="Aucune matière"
          description="Cliquez sur « Nouvelle matière » pour créer votre première matière."
          action={
            <Button variant="success" onClick={openCreate}>
              <Plus className="size-4" />
              Créer une matière
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((m, idx) => (
            <MatiereCard
              key={m.id}
              matiere={m}
              index={idx}
              prefersReducedMotion={prefersReducedMotion}
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
// Shell (hero header premium + KentePattern strip / separator)
// ─────────────────────────────────────────────────────────────────────────────

function MatieresShell({
  children,
  onNew,
}: {
  children: React.ReactNode;
  onNew?: () => void;
}) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <KentePattern variant="strip" position="top" />

      {/* ─── Hero header premium ──────────────────────────────────────── */}
      <GlassCard variant="desktop" noHover className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Badge rond gradient emerald→gold avec icône BookOpen */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <BookOpen className="size-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                  Matières
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Catalogue des matières enseignées : code, libellé, coefficient,
                cycle et couleur d&apos;affichage.
              </p>
            </div>
          </div>
          {onNew ? (
            <Button
              variant="success"
              onClick={onNew}
              className="w-full sm:w-auto"
            >
              <Plus className="size-4" />
              Nouvelle matière
            </Button>
          ) : null}
        </div>
      </GlassCard>

      <KentePattern variant="separator" className="my-1" />

      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carte d'une matière (motion.div avec stagger delay index*0.05)
// ─────────────────────────────────────────────────────────────────────────────

function MatiereCard({
  matiere,
  index,
  prefersReducedMotion,
  onEdit,
  onDelete,
  deleting,
}: {
  matiere: Matiere;
  index: number;
  prefersReducedMotion: boolean;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const couleur = matiere.couleur || COULEUR_DEFAUT;
  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.35,
          delay: Math.min(index * 0.05, 0.4),
          ease: [0.22, 1, 0.36, 1] as const,
        },
      };
  return (
    <motion.div className="h-full" {...motionProps}>
      <GlassCard variant="adaptive" className="flex h-full flex-col p-5">
        {/* ─── En-tête : pastille couleur + libellé + badge actif ──────── */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="inline-block size-5 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-900"
              style={{ backgroundColor: couleur }}
              aria-hidden="true"
            />
            <h3 className="break-words font-display text-base font-semibold leading-snug text-forest">
              {matiere.libelle}
            </h3>
          </div>
          {matiere.actif ? (
            <Badge
              variant="outline"
              className="shrink-0 border-emerald-300 bg-emerald-100 text-[10px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
            >
              Actif
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="shrink-0 border-rose-300 bg-rose-100 text-[10px] font-medium text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200"
            >
              Inactif
            </Badge>
          )}
        </div>

        {/* ─── Sous-ligne : badges code + cycle ───────────────────────── */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className="gap-1 border-emerald-300 bg-emerald-100 font-mono text-[10px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
          >
            <Hash className="size-3" />
            {matiere.code}
          </Badge>
          {matiere.cycle ? (
            <Badge
              variant="outline"
              className="border-gold/40 bg-gold/15 text-[10px] font-medium text-gold-dark dark:border-gold/40 dark:bg-gold/15 dark:text-gold"
            >
              {matiere.cycle.libelle}
            </Badge>
          ) : null}
        </div>

        {/* ─── Coefficient avec icône Hash en badge gold/15 ────────────── */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Coefficient
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-gold/15 px-2 py-0.5 font-mono text-sm font-bold text-gold-dark dark:bg-gold/15 dark:text-gold">
            <Hash className="size-3" />
            {matiere.coefficient ?? 1}
          </span>
        </div>

        {/* ─── Footer : boutons Modifier / Supprimer ──────────────────── */}
        <div className="mt-auto flex justify-end gap-1 border-t pt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            title="Modifier cette matière"
            aria-label={`Modifier la matière « ${matiere.libelle} »`}
          >
            <Pencil className="size-3.5" />
            Modifier
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-rose-50 dark:hover:bg-rose-950/40"
                disabled={deleting}
                title="Supprimer cette matière"
                aria-label={`Supprimer la matière « ${matiere.libelle} »`}
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
      </GlassCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog : formulaire création / édition (premium avec sections GlassCard)
// ─────────────────────────────────────────────────────────────────────────────

interface FormState {
  code: string;
  libelle: string;
  coefficient: string;
  cycle_id: string; // "NONE" si pas de cycle
  couleur: string;
  actif: boolean;
}

/** Titre de section du formulaire avec badge rond emerald/15 + icône. */
function FormSectionTitle({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex size-7 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
        <Icon className="size-3.5" />
      </span>
      <h3 className="font-display text-sm font-semibold tracking-tight text-forest">
        {children}
      </h3>
    </div>
  );
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-md shadow-emerald-900/20">
              <BookOpen className="size-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="font-display text-lg font-bold tracking-tight text-forest">
                {isEdit ? "Modifier la matière" : "Nouvelle matière"}
              </DialogTitle>
              <DialogDescription>
                {isEdit
                  ? "Mettez à jour les informations de la matière."
                  : "Renseignez les informations de la matière."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ─── Section : Identification ────────────────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="p-4">
            <FormSectionTitle icon={Tag}>Identification</FormSectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
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
                  className="bg-background"
                />
                {submitted && !codeValid ? (
                  <p className="text-[11px] text-destructive">Le code est requis.</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mat-libelle">
                  Libellé <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="mat-libelle"
                  value={form.libelle}
                  onChange={(e) =>
                    setForm({ ...form, libelle: e.target.value })
                  }
                  placeholder="Mathématiques"
                  aria-invalid={submitted && !libelleValid}
                  className="bg-background"
                />
                {submitted && !libelleValid ? (
                  <p className="text-[11px] text-destructive">
                    Le libellé est requis.
                  </p>
                ) : null}
              </div>
            </div>
          </GlassCard>

          {/* ─── Section : Pédagogie ─────────────────────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="p-4">
            <FormSectionTitle icon={GraduationCap}>Pédagogie</FormSectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
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
                  className="bg-background"
                />
                {submitted && !coefValid ? (
                  <p className="text-[11px] text-destructive">
                    Coefficient invalide.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mat-cycle">Cycle (optionnel)</Label>
                <Select
                  value={form.cycle_id}
                  onValueChange={(v) => setForm({ ...form, cycle_id: v })}
                >
                  <SelectTrigger
                    id="mat-cycle"
                    className="bg-background"
                    aria-label="Cycle (optionnel)"
                  >
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
            </div>
          </GlassCard>

          {/* ─── Section : Affichage ─────────────────────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="p-4">
            <FormSectionTitle icon={Palette}>Affichage</FormSectionTitle>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Couleur d&apos;affichage</Label>
                <div className="flex flex-wrap gap-1.5">
                  {COULEUR_PRESETS.map((c) => {
                    const selected =
                      form.couleur.toLowerCase() === c.value.toLowerCase();
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

              <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2.5">
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
          </GlassCard>
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="w-full sm:w-auto"
          >
            Annuler
          </Button>
          <Button
            variant="success"
            onClick={handleSave}
            disabled={submitting}
            className="w-full sm:w-auto"
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
// États vides premium (KentePattern bg + badge rond coloré + icône Lucide)
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  tone,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  tone: "emerald" | "amber" | "rose";
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  const cls = {
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  }[tone];
  return (
    <GlassCard
      variant="adaptive"
      noHover
      className="relative overflow-hidden"
    >
      <KentePattern variant="bg" />
      <div className="relative flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-full",
            cls,
          )}
        >
          <Icon className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="font-display text-base font-semibold text-forest">
            {title}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        {action}
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading state premium (KentePattern strip top + 6 Skeletons cards)
// ─────────────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-3">
      <GlassCard
        variant="adaptive"
        noHover
        noAnimation
        className="relative overflow-hidden p-0"
      >
        <KentePattern variant="strip" position="top" />
        <div className="p-4">
          <Loader2 className="mx-auto size-6 animate-spin text-emerald-600 dark:text-emerald-400" />
        </div>
      </GlassCard>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

export default MatieresList;
