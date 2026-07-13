"use client";

/**
 * ScolaGest — Liste des affectations prof/matière/classe (module Enseignant — Phase A).
 *
 * Vue principale du module Affectations :
 *  - Tableau (shadcn Table) avec : enseignant (nom), matière (libellé),
 *    classe, volume hebdo, titulaire (badge), actions (supprimer).
 *  - Bouton « Nouvelle affectation » (variant success) → dialog avec selects :
 *    enseignant, matière, classe, volume horaire hebdo, titulaire (switch).
 *  - Année scolaire présélectionnée sur l'année active (fetchActiveAnnee).
 *  - Alerte de surcharge : si après création le résultat `alerte_surcharge`
 *    est true → toast warning « Charge totale: Xh/semaine (> 25h) ».
 *  - Suppression avec confirmation.
 *
 * Refonte Forêt EdTech :
 *  - Hero header GlassCard desktop + KentePattern strip top + badge rond
 *    gradient emerald→gold (CalendarDays) + pill « Phase A » outline + pill
 *    année active emerald + bouton « Nouvelle affectation » variant success.
 *  - 4 StatCards DS (emerald / gold / amber / forest) avec stagger delay
 *    0/0.05/0.1/0.15.
 *  - Tableau desktop : GlassCard adaptive noHover p-0 + header bg-emerald-50/60
 *    + hover row bg-emerald-50/60 + avatar enseignant initiales emerald + nom
 *    font-display + badges renforcés (border-300 bg-100 text-800) + volume
 *    hebdo avec Clock en badge amber/15 + badge Titulaire avec Star en badge
 *    gold/15 + bouton supprimer avec title natif (PAS de Tooltip Radix — BUG
 *    À ÉVITER #1) + motion.tr stagger delay index*0.02.
 *  - Cartes mobile (md:hidden) : GlassCard mobile avec avatar + nom + matière
 *    + classe + volume + badge titulaire + bouton supprimer h-11 (touch
 *    target ≥ 44px).
 *  - AffectationFormDialog premium : header badge rond gradient + sections
 *    GlassCard tablet (Enseignant / Cours / Charge) + selects avec icônes
 *    contextuelles + alerte surcharge amber renforcée + footer grid-cols-2
 *    mobile + bouton submit variant success.
 *  - Empty states premium : KentePattern bg + badges ronds colorés.
 *  - Loading state : KentePattern strip top + 4 Skeletons rows.
 *
 * Le contexte d'établissement vient de `useAuthStore`. Si aucun établissement
 * n'est sélectionné, on invite l'utilisateur à en choisir un.
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query (anneesKeys.active() /
 * affectationsKeys.list() / classesKeys.list() / fetchActiveAnnee /
 * fetchAffectations / fetchEnseignants / fetchMatieres / fetchClasses /
 * enabled: !!etablissement && open), mutations (createMutation /
 * deleteMutation) + invalidateQueries, handler handleSubmit, types
 * AffectationCours / AffectationDTO / Enseignant / Classe / AnneeScolaire,
 * constante SEUIL_SURCHARGE_H, affectationsKeys, FormState + validation
 * ens/mat/cls/vol. Aucun endpoint backend touché.
 *
 * États : pas d'établissement, pas d'année active, chargement, vide, erreur.
 */

import * as React from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Star,
  Clock,
  X,
  AlertTriangle,
  Sparkles,
  Users,
  BookOpen,
  School,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchAffectations,
  createAffectation,
  deleteAffectation,
  fetchEnseignants,
  fetchMatieres,
  type AffectationCours,
  type AffectationDTO,
  type Enseignant,
} from "@/lib/api-enseignant";
import {
  fetchActiveAnnee,
  fetchClasses,
  anneesKeys,
  classesKeys,
} from "@/lib/api-students";
import { useToast } from "@/hooks/use-toast";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export const affectationsKeys = {
  all: ["affectations"] as const,
  list: (anneeScolaireId?: string) =>
    [...affectationsKeys.all, "list", { anneeScolaireId }] as const,
};

const SEUIL_SURCHARGE_H = 25;

/** Nom complet d'un enseignant (prenoms + nom) ou "—" si vide. */
function enseignantFullName(e?: Enseignant | null): string {
  if (!e) return "—";
  return [e.prenoms, e.nom].filter(Boolean).join(" ").trim() || "—";
}

/** Initiales (max 2 lettres) pour l'avatar d'un enseignant. */
function enseignantInitials(e?: Enseignant | null): string {
  if (!e) return "?";
  const pre = (e.prenoms ?? "").trim();
  const nom = (e.nom ?? "").trim();
  const a = pre ? pre[0]! : "";
  const b = nom ? nom[0]! : "";
  const init = (a + b).toUpperCase();
  return init || "?";
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function AffectationsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const etablissement = useAuthStore((s) => s.etablissement);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Année scolaire active (présélection)
  const {
    data: activeAnnee,
    isLoading: loadingAnnee,
    isError: anneeError,
  } = useQuery({
    queryKey: anneesKeys.active(),
    queryFn: fetchActiveAnnee,
    enabled: !!etablissement,
  });

  // Liste des affectations pour l'année active
  const {
    data: affectations,
    isLoading: loadingAffectations,
    isError: affectationsError,
    error,
  } = useQuery({
    queryKey: affectationsKeys.list(activeAnnee?.id),
    queryFn: () => fetchAffectations(activeAnnee!.id),
    enabled: !!activeAnnee?.id,
  });

  // Dialogs
  const [formOpen, setFormOpen] = React.useState(false);

  // ─── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (dto: AffectationDTO) => createAffectation(dto),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: affectationsKeys.all,
      });
      if (result.alerte_surcharge) {
        toast({
          title: "⚠️ Affectation créée — surcharge détectée",
          description: `Charge totale : ${result.charge_totale_hebdo}h/semaine (> ${SEUIL_SURCHARGE_H}h).`,
        });
      } else {
        toast({
          title: "Affectation créée",
          description: `Charge totale de l'enseignant : ${result.charge_totale_hebdo}h/semaine.`,
        });
      }
      setFormOpen(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de créer l'affectation.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAffectation(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: affectationsKeys.all,
      });
      toast({
        title: "Affectation supprimée",
        description: "L'affectation a été retirée de l'année scolaire.",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de supprimer cette affectation.",
        variant: "destructive",
      });
    },
  });

  function handleSubmit(dto: AffectationDTO) {
    createMutation.mutate(dto);
  }

  // ─── KPIs calculés (Total / Titulaires / Volume total / Ens. distincts) ──
  const list = affectations ?? [];
  const kpis = React.useMemo(() => {
    let titulaires = 0;
    let volumeTotal = 0;
    const ensIds = new Set<string>();
    for (const a of list) {
      if (a.est_titulaire) titulaires += 1;
      volumeTotal += a.volume_horaire_hebdo ?? 0;
      if (a.enseignant_id) ensIds.add(a.enseignant_id);
    }
    return {
      total: list.length,
      titulaires,
      volumeTotal,
      ensDistincts: ensIds.size,
    };
  }, [list]);

  // ─── États ────────────────────────────────────────────────────────────────

  if (!etablissement) {
    return (
      <AffectationsShell>
        <EmptyState
          icon={AlertCircle}
          tone="amber"
          title="Sélectionnez un établissement"
          description="Choisissez un établissement dans la barre latérale pour gérer ses affectations."
        />
      </AffectationsShell>
    );
  }

  if (loadingAnnee) {
    return (
      <AffectationsShell>
        <LoadingState />
      </AffectationsShell>
    );
  }

  if (anneeError || !activeAnnee) {
    return (
      <AffectationsShell>
        <EmptyState
          icon={CalendarDays}
          tone="amber"
          title="Aucune année scolaire active"
          description="Activez une année scolaire dans « Années scolaires » avant de gérer les affectations."
        />
      </AffectationsShell>
    );
  }

  return (
    <AffectationsShell
      anneeLabel={activeAnnee.libelle}
      onNew={() => setFormOpen(true)}
    >
      {/* ─── 4 StatCards de résumé ────────────────────────────────────────── */}
      <section
        aria-label="Résumé des affectations"
        className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4"
      >
        <StatCard
          icon={CalendarDays}
          tone="emerald"
          label="Total affectations"
          value={kpis.total}
          hint={loadingAffectations ? "chargement…" : `année ${activeAnnee.libelle}`}
          delay={0}
          className="h-full"
        />
        <StatCard
          icon={Star}
          tone="gold"
          label="Titulaires"
          value={kpis.titulaires}
          hint="enseignants principaux"
          delay={0.05}
          className="h-full"
        />
        <StatCard
          icon={Clock}
          tone="amber"
          label="Volume total"
          value={`${kpis.volumeTotal}h`}
          hint="heures / semaine"
          delay={0.1}
          className="h-full"
        />
        <StatCard
          icon={Users}
          tone="forest"
          label="Enseignants distincts"
          value={kpis.ensDistincts}
          hint="assignés cette année"
          delay={0.15}
          className="h-full"
        />
      </section>

      <KentePattern variant="separator" className="my-1" />

      {/* ─── Contenu : tableau / skeleton / empty / error ────────────────── */}
      {loadingAffectations ? (
        <LoadingState />
      ) : affectationsError ? (
        <EmptyState
          icon={AlertCircle}
          tone="rose"
          title="Erreur de chargement"
          description={
            error instanceof Error
              ? error.message
              : "Impossible de charger les affectations. Vérifiez que le backend est démarré puis réessayez."
          }
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          tone="emerald"
          title="Aucune affectation"
          description="Cliquez sur « Nouvelle affectation » pour assigner un enseignant à une matière et une classe."
          action={
            <Button variant="success" onClick={() => setFormOpen(true)}>
              <Plus className="size-4" />
              Créer une affectation
            </Button>
          }
        />
      ) : (
        <>
          {/* ─── Tableau desktop (md+) ─────────────────────────────────── */}
          <GlassCard
            variant="adaptive"
            noHover
            noAnimation
            className="hidden overflow-hidden p-0 md:block"
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <TableHead className="min-w-[220px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Enseignant
                    </TableHead>
                    <TableHead className="min-w-[180px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Matière
                    </TableHead>
                    <TableHead className="min-w-[140px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Classe
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Volume hebdo
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Titulaire
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((a, idx) => (
                    <AffectationRow
                      key={a.id}
                      affectation={a}
                      anneeLabel={activeAnnee.libelle}
                      index={idx}
                      prefersReducedMotion={prefersReducedMotion}
                      onDelete={() => deleteMutation.mutate(a.id)}
                      deleting={deleteMutation.isPending}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </GlassCard>

          {/* ─── Cartes mobile (md:hidden) ─────────────────────────────── */}
          <div className="space-y-3 md:hidden">
            {list.map((a, idx) => (
              <AffectationMobileCard
                key={a.id}
                affectation={a}
                anneeLabel={activeAnnee.libelle}
                index={idx}
                prefersReducedMotion={prefersReducedMotion}
                onDelete={() => deleteMutation.mutate(a.id)}
                deleting={deleteMutation.isPending}
              />
            ))}
          </div>
        </>
      )}

      <AffectationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        anneeScolaireId={activeAnnee.id}
        anneeLabel={activeAnnee.libelle}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending}
      />
    </AffectationsShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell (hero header premium + KentePattern strip / separator)
// ─────────────────────────────────────────────────────────────────────────────

function AffectationsShell({
  children,
  anneeLabel,
  onNew,
}: {
  children: React.ReactNode;
  anneeLabel?: string;
  onNew?: () => void;
}) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <KentePattern variant="strip" position="top" />

      {/* ─── Hero header premium ──────────────────────────────────────── */}
      <GlassCard variant="desktop" noHover className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Badge rond gradient emerald→gold avec icône CalendarDays */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <CalendarDays className="size-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                  Affectations
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50/60 px-2 py-0.5 align-middle text-[11px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <Sparkles className="size-3" />
                  Phase A
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Assignez les enseignants aux matières et classes pour
                l&apos;année scolaire en cours.
              </p>
              {anneeLabel ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CalendarDays className="size-3" />
                  Année active : {anneeLabel}
                </span>
              ) : null}
            </div>
          </div>
          {onNew ? (
            <Button
              variant="success"
              onClick={onNew}
              className="w-full sm:w-auto"
            >
              <Plus className="size-4" />
              Nouvelle affectation
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
// Ligne du tableau desktop (motion.tr avec stagger delay index*0.02)
// ─────────────────────────────────────────────────────────────────────────────

function AffectationRow({
  affectation: a,
  anneeLabel,
  index,
  prefersReducedMotion,
  onDelete,
  deleting,
}: {
  affectation: AffectationCours;
  anneeLabel: string;
  index: number;
  prefersReducedMotion: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.3,
          delay: Math.min(index * 0.02, 0.4),
          ease: [0.22, 1, 0.36, 1] as const,
        },
      };
  const fullName = enseignantFullName(a.enseignant);
  return (
    <motion.tr
      data-slot="table-row"
      className="hover:bg-emerald-50/60 border-b transition-colors dark:hover:bg-emerald-950/20"
      {...motionProps}
    >
      {/* Enseignant : avatar emerald-600 text-white + nom font-display + matricule */}
      <TableCell>
        <div className="flex items-center gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white"
            aria-hidden="true"
          >
            {enseignantInitials(a.enseignant)}
          </div>
          <div className="min-w-0">
            <div className="break-words font-display text-sm font-semibold leading-snug text-forest">
              {fullName}
            </div>
            {a.enseignant?.matricule ? (
              <div className="font-mono text-[10px] text-muted-foreground">
                {a.enseignant.matricule}
              </div>
            ) : null}
          </div>
        </div>
      </TableCell>

      {/* Matière : libellé font-display + code mono */}
      <TableCell>
        <div className="break-words font-display text-sm font-medium leading-snug text-forest">
          {a.matiere?.libelle ?? "—"}
        </div>
        {a.matiere?.code ? (
          <div className="font-mono text-[10px] text-muted-foreground">
            {a.matiere.code}
          </div>
        ) : null}
      </TableCell>

      {/* Classe : badge slate renforcé (border-300 bg-100 text-800) */}
      <TableCell>
        {a.classe ? (
          <Badge
            variant="outline"
            className="border-slate-300 bg-slate-100 text-[11px] font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200"
          >
            {a.classe.libelle}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Volume hebdo : badge amber/15 + Clock + value font-bold */}
      <TableCell className="text-right">
        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 font-mono text-sm font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
          <Clock className="size-3" />
          {a.volume_horaire_hebdo}h
        </span>
      </TableCell>

      {/* Titulaire : badge gold/15 + Star si titulaire, sinon "Non" */}
      <TableCell>
        {a.est_titulaire ? (
          <Badge
            variant="outline"
            className="gap-1 border-gold/40 bg-gold/15 text-[11px] font-medium text-gold-dark dark:border-gold/40 dark:bg-gold/15 dark:text-gold"
          >
            <Star className="size-3" />
            Titulaire
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Non</span>
        )}
      </TableCell>

      {/* Actions : bouton supprimer ghost sm avec title natif (PAS de Tooltip) */}
      <TableCell className="text-right">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-rose-50 dark:hover:bg-rose-950/40"
              disabled={deleting}
              title="Supprimer cette affectation"
              aria-label={`Supprimer l'affectation de ${fullName}`}
            >
              {deleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              <span className="hidden lg:inline">Supprimer</span>
              <span className="sr-only">Supprimer</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Supprimer cette affectation ?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. L&apos;affectation
                de l&apos;enseignant à la matière et la classe
                sera supprimée pour l&apos;année scolaire{" "}
                {anneeLabel}.
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
      </TableCell>
    </motion.tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carte mobile (md:hidden) — vue condensée par affectation
// ─────────────────────────────────────────────────────────────────────────────

function AffectationMobileCard({
  affectation: a,
  anneeLabel,
  index,
  prefersReducedMotion,
  onDelete,
  deleting,
}: {
  affectation: AffectationCours;
  anneeLabel: string;
  index: number;
  prefersReducedMotion: boolean;
  onDelete: () => void;
  deleting: boolean;
}) {
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
  const fullName = enseignantFullName(a.enseignant);
  return (
    <motion.div className="rounded-2xl" {...motionProps}>
      <GlassCard variant="mobile" noHover noAnimation className="p-4">
        {/* ─── En-tête : avatar + nom + matricule ─────────────────────────── */}
        <div className="flex items-start gap-3">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white"
            aria-hidden="true"
          >
            {enseignantInitials(a.enseignant)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="break-words font-display text-base font-semibold leading-snug text-forest">
              {fullName}
            </p>
            {a.enseignant?.matricule ? (
              <p className="font-mono text-[11px] text-muted-foreground">
                {a.enseignant.matricule}
              </p>
            ) : null}
          </div>
          {a.est_titulaire ? (
            <Badge
              variant="outline"
              className="shrink-0 gap-1 border-gold/40 bg-gold/15 text-[10px] font-medium text-gold-dark dark:border-gold/40 dark:bg-gold/15 dark:text-gold"
            >
              <Star className="size-3" />
              Titulaire
            </Badge>
          ) : null}
        </div>

        {/* ─── Body : matière, classe, volume hebdo ─────────────────────── */}
        <div className="mt-3 space-y-2 border-t pt-3">
          <div className="flex items-center gap-2 text-xs">
            <span
              className="flex size-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              aria-hidden="true"
            >
              <BookOpen className="size-3" />
            </span>
            <span className="break-words font-medium text-forest">
              {a.matiere?.libelle ?? "—"}
            </span>
            {a.matiere?.code ? (
              <span className="font-mono text-[10px] text-muted-foreground">
                ({a.matiere.code})
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className="flex size-6 items-center justify-center rounded-md bg-slate-500/15 text-slate-700 dark:text-slate-300"
              aria-hidden="true"
            >
              <School className="size-3" />
            </span>
            {a.classe ? (
              <span className="break-words font-medium text-forest">
                {a.classe.libelle}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="flex size-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300"
                aria-hidden="true"
              >
                <Clock className="size-3" />
              </span>
              Volume hebdo
            </span>
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 font-mono text-sm font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-200">
              <Clock className="size-3" />
              {a.volume_horaire_hebdo}h
            </span>
          </div>
        </div>

        {/* ─── Footer : bouton supprimer h-11 (touch target ≥ 44px) ──────── */}
        <div className="mt-3 flex justify-end border-t pt-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-destructive hover:bg-rose-50 dark:hover:bg-rose-950/40"
                disabled={deleting}
                title="Supprimer"
                aria-label={`Supprimer l'affectation de ${fullName}`}
              >
                {deleting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Supprimer cette affectation ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. L&apos;affectation
                  de l&apos;enseignant à la matière et la classe
                  sera supprimée pour l&apos;année scolaire{" "}
                  {anneeLabel}.
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
// Dialog : formulaire de création d'affectation (premium avec sections)
// ─────────────────────────────────────────────────────────────────────────────

interface FormState {
  enseignant_id: string;
  matiere_id: string;
  classe_id: string;
  volume_horaire_hebdo: string;
  est_titulaire: boolean;
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

function AffectationFormDialog({
  open,
  onOpenChange,
  anneeScolaireId,
  anneeLabel,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anneeScolaireId: string;
  anneeLabel: string;
  onSubmit: (dto: AffectationDTO) => void;
  submitting: boolean;
}) {
  const etablissement = useAuthStore((s) => s.etablissement);

  const [form, setForm] = React.useState<FormState>({
    enseignant_id: "",
    matiere_id: "",
    classe_id: "",
    volume_horaire_hebdo: "2",
    est_titulaire: false,
  });
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setForm({
      enseignant_id: "",
      matiere_id: "",
      classe_id: "",
      volume_horaire_hebdo: "2",
      est_titulaire: false,
    });
  }, [open]);

  // Charge les listes nécessaires au formulaire
  const { data: enseignants, isLoading: loadingEnseignants } = useQuery({
    queryKey: ["enseignants", "list", { all: true }] as const,
    queryFn: () => fetchEnseignants({}),
    enabled: !!etablissement && open,
  });

  const { data: matieres, isLoading: loadingMatieres } = useQuery({
    queryKey: ["matieres", "list"] as const,
    queryFn: fetchMatieres,
    enabled: !!etablissement && open,
  });

  const { data: classes, isLoading: loadingClasses } = useQuery({
    queryKey: classesKeys.list(etablissement?.id),
    queryFn: () => fetchClasses(etablissement?.id),
    enabled: !!etablissement && open,
  });

  // Enseignants actifs uniquement (plus pertinent pour une affectation)
  const activeEnseignants = React.useMemo(
    () => (enseignants ?? []).filter((e) => e.statut === "ACTIF"),
    [enseignants],
  );
  // Matières actives uniquement
  const activeMatieres = React.useMemo(
    () => (matieres ?? []).filter((m) => m.actif),
    [matieres],
  );

  const ensValid = form.enseignant_id !== "";
  const matValid = form.matiere_id !== "";
  const clsValid = form.classe_id !== "";
  const volValid =
    !Number.isNaN(Number(form.volume_horaire_hebdo)) &&
    Number(form.volume_horaire_hebdo) > 0;
  const formValid = ensValid && matValid && clsValid && volValid;

  function handleSave() {
    setSubmitted(true);
    if (!formValid) return;
    const dto: AffectationDTO = {
      enseignant_id: form.enseignant_id,
      matiere_id: form.matiere_id,
      classe_id: form.classe_id,
      annee_scolaire_id: anneeScolaireId,
      volume_horaire_hebdo: Number(form.volume_horaire_hebdo),
      est_titulaire: form.est_titulaire,
    };
    onSubmit(dto);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-md shadow-emerald-900/20">
              <CalendarDays className="size-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="font-display text-lg font-bold tracking-tight text-forest">
                Nouvelle affectation
              </DialogTitle>
              <DialogDescription>
                Assignez un enseignant à une matière et une classe pour
                l&apos;année {anneeLabel}.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ─── Section : Enseignant ────────────────────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="p-4">
            <FormSectionTitle icon={Users}>Enseignant</FormSectionTitle>
            <div className="space-y-1.5">
              <Label htmlFor="aff-ens">
                Enseignant <span className="text-destructive">*</span>
              </Label>
              {loadingEnseignants ? (
                <Skeleton className="h-9 w-full" />
              ) : activeEnseignants.length === 0 ? (
                <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                  Aucun enseignant actif. Ajoutez d&apos;abord un enseignant dans
                  la page « Enseignants ».
                </p>
              ) : (
                <Select
                  value={form.enseignant_id}
                  onValueChange={(v) =>
                    setForm({ ...form, enseignant_id: v })
                  }
                >
                  <SelectTrigger
                    id="aff-ens"
                    className="bg-background"
                    aria-invalid={submitted && !ensValid}
                    aria-label="Enseignant"
                  >
                    <Users className="size-3.5 text-muted-foreground" />
                    <SelectValue placeholder="Choisir un enseignant" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeEnseignants.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {[e.prenoms, e.nom].filter(Boolean).join(" ").trim()}{" "}
                        <span className="text-[10px] text-muted-foreground">
                          ({e.matricule || "sans matricule"})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {submitted && !ensValid ? (
                <p className="text-[11px] text-destructive">
                  Sélectionnez un enseignant.
                </p>
              ) : null}
            </div>
          </GlassCard>

          {/* ─── Section : Cours (matière + classe) ─────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="p-4">
            <FormSectionTitle icon={BookOpen}>Cours</FormSectionTitle>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="aff-mat">
                  Matière <span className="text-destructive">*</span>
                </Label>
                {loadingMatieres ? (
                  <Skeleton className="h-9 w-full" />
                ) : activeMatieres.length === 0 ? (
                  <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    Aucune matière active. Ajoutez d&apos;abord une matière dans la
                    page « Matières ».
                  </p>
                ) : (
                  <Select
                    value={form.matiere_id}
                    onValueChange={(v) => setForm({ ...form, matiere_id: v })}
                  >
                    <SelectTrigger
                      id="aff-mat"
                      className="bg-background"
                      aria-invalid={submitted && !matValid}
                      aria-label="Matière"
                    >
                      <BookOpen className="size-3.5 text-muted-foreground" />
                      <SelectValue placeholder="Choisir une matière" />
                    </SelectTrigger>
                    <SelectContent>
                      {activeMatieres.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.libelle}{" "}
                          <span className="text-[10px] text-muted-foreground">
                            ({m.code})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {submitted && !matValid ? (
                  <p className="text-[11px] text-destructive">
                    Sélectionnez une matière.
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="aff-cls">
                  Classe <span className="text-destructive">*</span>
                </Label>
                {loadingClasses ? (
                  <Skeleton className="h-9 w-full" />
                ) : (classes ?? []).length === 0 ? (
                  <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                    Aucune classe configurée. Ajoutez d&apos;abord des classes dans
                    la configuration des cycles.
                  </p>
                ) : (
                  <Select
                    value={form.classe_id}
                    onValueChange={(v) => setForm({ ...form, classe_id: v })}
                  >
                    <SelectTrigger
                      id="aff-cls"
                      className="bg-background"
                      aria-invalid={submitted && !clsValid}
                      aria-label="Classe"
                    >
                      <School className="size-3.5 text-muted-foreground" />
                      <SelectValue placeholder="Choisir une classe" />
                    </SelectTrigger>
                    <SelectContent>
                      {(classes ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.libelle}{" "}
                          <span className="text-[10px] text-muted-foreground">
                            (niveau {c.niveau})
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {submitted && !clsValid ? (
                  <p className="text-[11px] text-destructive">
                    Sélectionnez une classe.
                  </p>
                ) : null}
              </div>
            </div>
          </GlassCard>

          {/* ─── Section : Charge horaire ───────────────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="p-4">
            <FormSectionTitle icon={Clock}>Charge horaire</FormSectionTitle>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="aff-vol">
                  Volume horaire hebdomadaire (heures){" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="aff-vol"
                  type="number"
                  min={0}
                  step="0.5"
                  value={form.volume_horaire_hebdo}
                  onChange={(e) =>
                    setForm({ ...form, volume_horaire_hebdo: e.target.value })
                  }
                  placeholder="2"
                  aria-invalid={submitted && !volValid}
                  className="bg-background"
                />
                {submitted && !volValid ? (
                  <p className="text-[11px] text-destructive">
                    Volume horaire invalide.
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground">
                    Une alerte de surcharge est levée si la charge totale
                    de l&apos;enseignant dépasse {SEUIL_SURCHARGE_H}h/semaine.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2.5">
                <div className="space-y-0.5">
                  <Label htmlFor="aff-tit" className="cursor-pointer">
                    Enseignant titulaire de la classe
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    L&apos;enseignant principal responsable de la classe.
                  </p>
                </div>
                <Switch
                  id="aff-tit"
                  checked={form.est_titulaire}
                  onCheckedChange={(v) =>
                    setForm({ ...form, est_titulaire: v })
                  }
                />
              </div>

              {/* Alerte info surcharge (amber renforcé) */}
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-100/80 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <p>
                  Si la création de cette affectation amène la charge totale de
                  l&apos;enseignant au-dessus de {SEUIL_SURCHARGE_H}h/semaine, une
                  alerte de surcharge sera affichée (sans bloquer la création).
                </p>
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
            <X className="size-4" />
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
            ) : (
              <Plus className="size-4" />
            )}
            Créer l&apos;affectation
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
// Loading state premium (KentePattern strip top + 4 Skeletons rows)
// ─────────────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <GlassCard
      variant="adaptive"
      noHover
      noAnimation
      className="relative overflow-hidden p-0"
    >
      <KentePattern variant="strip" position="top" />
      <div className="space-y-2 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </GlassCard>
  );
}

export default AffectationsList;
