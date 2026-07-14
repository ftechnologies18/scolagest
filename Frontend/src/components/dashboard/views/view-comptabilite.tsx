"use client";

/**
 * ScolaGest — Vue « Comptabilité générale » (Phase 5).
 *
 * Cinq onglets :
 *  - Exercices    : liste des exercices comptables, « Nouvel exercice »,
 *    « Clôturer » (réservé COMPTABLE / DIRECTION).
 *  - Plan comptable : arbre hiérarchique des comptes (groupés par type
 *    ACTIF / PASSIF / PRODUIT / CHARGE), « Nouveau compte ».
 *  - Écritures    : filtres (exercice, journal, dates) + table paginée.
 *    Clic sur une ligne → dialog affichant les lignes (débit/crédit/compte).
 *  - Grand livre  : filtres (exercice, compte, dates) → table par compte
 *    avec solde d&apos;ouverture, mouvements et solde de fin.
 *  - Bilan        : sélection de l&apos;exercice → 4 cartes (Actif / Passif /
 *    Produits / Charges) + résultat (produits − charges), tables détaillées.
 *
 * Rôles autorisés : COMPTABLE / DIRECTION (filtre nav
 * appliqué dans `dashboard-layout.tsx`).
 *
 * Toutes les requêtes sont `enabled: !!etablissement?.id` avec
 * `retry: 1, retryDelay: 1500` pour tolérer un backend transitoirement
 * indisponible. Les états d&apos;erreur / vide / chargement sont gérés
 * explicitement pour chaque onglet.
 *
 * Refonte « Forêt EdTech » (Task 4) :
 *  - Hero header premium (KentePattern strip + GlassCard desktop + badge
 *    rond gradient emerald→gold (BookOpen) + titre font-display text-2xl +
 *    pill "Phase 5" outline avec Sparkles + pill établissement).
 *  - TabsList premium (glass-desktop subtile + tab actif bg-emerald-600
 *    text-white + icônes CalendarRange / ListTree / FileText / BookOpen /
 *    Scale + scrollable mobile).
 *  - Onglet Exercices enrichi : 3 StatCards (Total emerald / Ouverts forest /
 *    Clôturés terracotta) + tableau header bg-emerald-50/60 + hover + libellé
 *    font-display + badges renforcés + bouton Clôturer avec title natif +
 *    motion.tr stagger + AlertDialog footer grid-cols-2 mobile.
 *  - Onglet Plan comptable enrichi : 4 StatCards par type (Actif emerald /
 *    Passif amber / Produit sky / Charge terracotta) + GlassCard par type
 *    header bg-emerald-50/60 + comptes avec badges renforcés + bouton
 *    "Nouveau compte" variant success.
 *  - Onglet Écritures enrichi : filtres GlassCard adaptive + icônes
 *    contextuelles dans les SelectTrigger + bouton Réinitialiser variant
 *    outline avec RotateCcw + tableau header bg-emerald-50/60 + hover +
 *    badges renforcés + boutons avec title natif + motion.tr stagger +
 *    pagination boutons avec title natif + dialog détail écriture badge
 *    gradient + GlassCard tablet pour les lignes.
 *  - Onglet Grand livre enrichi : filtres GlassCard adaptive + bouton
 *    Réinitialiser + tableau par compte header bg-emerald-50/60 + hover +
 *    montants text-gold-dark + motion.tr stagger.
 *  - Onglet Bilan enrichi : 3 StatCards (Total actif emerald / Total passif
 *    amber / Résultat gold si positif ou terracotta si négatif) + 4 cards par
 *    type en GlassCard adaptive avec header bg-emerald-50/60 + tableaux
 *    détaillés header bg-emerald-50/60 + montants text-gold-dark.
 *  - Dialogs premium (ExerciceFormDialog / CompteFormDialog) : badge gradient
 *    + GlassCard tablet + footer grid-cols-2 + bouton submit variant success.
 *  - Empty states premium (KentePattern bg + badges ronds colorés).
 *  - Loading state premium (KentePattern strip top + Skeletons en GlassCard).
 *  - Animations Framer Motion (StatCards stagger delay index*0.05 + rows
 *    motion.tr stagger delay index*0.02 capé 0.4s) avec respect de
 *    `usePrefersReducedMotion()`.
 */

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  ListTree,
  FileText,
  Scale,
  Lock,
  Plus,
  Loader2,
  AlertCircle,
  Filter,
  CheckCircle2,
  Wallet,
  TrendingUp,
  TrendingDown,
  CalendarRange,
  RotateCcw,
  Calendar,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  comptaKeys,
  fetchExercices,
  cloturerExercice,
  fetchComptes,
  fetchJournaux,
  fetchEcritures,
  fetchEcriture,
  fetchGrandLivre,
  fetchBilan,
} from "@/lib/api-phase5";
import { useToast } from "@/hooks/use-toast";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { formatFCFA, formatDateShort, todayISO } from "@/lib/format";
import type {
  BilanResult,
  CompteComptable,
  EcrituresQueryParams,
  EcritureComptable,
  ExerciceComptable,
  GrandLivreQueryParams,
  GrandLivreResult,
  TypeCompte,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
} from "@/components/ui/alert-dialog";
import { ExerciceFormDialog } from "@/components/comptabilite/exercice-form-dialog";
import { CompteFormDialog } from "@/components/comptabilite/compte-form-dialog";
import { GlassCard } from "@/components/ds/glass-card";
import { StatCard } from "@/components/ds/stat-card";
import { KentePattern } from "@/components/ds/kente-pattern";

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_COMPTE_LABEL: Record<TypeCompte, string> = {
  ACTIF: "Actif",
  PASSIF: "Passif",
  PRODUIT: "Produit",
  CHARGE: "Charge",
};

const TYPE_COMPTE_CLS: Record<TypeCompte, string> = {
  ACTIF: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200",
  PASSIF: "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200",
  PRODUIT: "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-200",
  CHARGE: "border-terracotta/40 bg-terracotta/10 text-terracotta dark:border-terracotta/40 dark:bg-terracotta/10 dark:text-terracotta",
};

const TYPE_COMPTE_ORDER: TypeCompte[] = ["ACTIF", "PASSIF", "PRODUIT", "CHARGE"];

/** Icônes contextuelles par type de compte (badges de section). */
const TYPE_COMPTE_ICONS: Record<TypeCompte, LucideIcon> = {
  ACTIF: Wallet,
  PASSIF: Scale,
  PRODUIT: TrendingUp,
  CHARGE: TrendingDown,
};

/** Tones StatCard par type de compte. */
const TYPE_COMPTE_TONES: Record<
  TypeCompte,
  "emerald" | "amber" | "sky" | "terracotta"
> = {
  ACTIF: "emerald",
  PASSIF: "amber",
  PRODUIT: "sky",
  CHARGE: "terracotta",
};

const PAGE_SIZE = 15;

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function ComptabiliteView() {
  const etablissement = useAuthStore((s) => s.etablissement);

  return (
    <div className="space-y-4 sm:space-y-6">
      <KentePattern variant="strip" position="top" />

      {/* ─── Hero header premium ──────────────────────────────────────── */}
      <GlassCard variant="desktop" noHover premiumBorder className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Badge rond gradient emerald→gold avec icône BookOpen */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <BookOpen className="size-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                  Comptabilité générale
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50/60 px-2 py-0.5 align-middle text-[11px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <Sparkles className="size-3" />
                  Phase 5
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Exercices, plan comptable, écritures, grand livre et bilan.
              </p>
              {etablissement?.nom ? (
                <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {etablissement.nom}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </GlassCard>

      <KentePattern variant="separator" className="my-1" />

      {!etablissement?.id ? (
        <EmptyState
          icon={Filter}
          tone="amber"
          title="Sélectionnez un établissement"
          message="La comptabilité est gérée par établissement. Choisissez-en un dans la barre latérale pour accéder aux exercices et au plan comptable."
        />
      ) : (
        <Tabs defaultValue="exercices" className="w-full">
          <TabsList className="glass-desktop h-auto w-full gap-1 overflow-x-auto border-0 p-1 sm:w-auto">
            <TabsTrigger
              value="exercices"
              className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              <CalendarRange className="size-4" />
              Exercices
            </TabsTrigger>
            <TabsTrigger
              value="plan"
              className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              <ListTree className="size-4" />
              Plan comptable
            </TabsTrigger>
            <TabsTrigger
              value="ecritures"
              className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              <FileText className="size-4" />
              Écritures
            </TabsTrigger>
            <TabsTrigger
              value="grand-livre"
              className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              <BookOpen className="size-4" />
              Grand livre
            </TabsTrigger>
            <TabsTrigger
              value="bilan"
              className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
            >
              <Scale className="size-4" />
              Bilan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exercices" className="mt-4">
            <ExercicesPanel />
          </TabsContent>
          <TabsContent value="plan" className="mt-4">
            <PlanComptablePanel />
          </TabsContent>
          <TabsContent value="ecritures" className="mt-4">
            <EcrituresPanel />
          </TabsContent>
          <TabsContent value="grand-livre" className="mt-4">
            <GrandLivrePanel />
          </TabsContent>
          <TabsContent value="bilan" className="mt-4">
            <BilanPanel />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Exercices »
// ─────────────────────────────────────────────────────────────────────────────

function ExercicesPanel() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const etablissement = useAuthStore((s) => s.etablissement);
  const role = useAuthStore((s) => s.role);

  const [formOpen, setFormOpen] = React.useState(false);
  const [cloturerTarget, setCloturerTarget] =
    React.useState<ExerciceComptable | null>(null);

  const canManage = ["COMPTABLE", "DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR"].includes(
    role ?? "",
  );

  const {
    data: exercices,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: comptaKeys.exercices(etablissement?.id),
    queryFn: () => fetchExercices(etablissement?.id),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });

  const cloturerMutation = useMutation({
    mutationFn: (id: string) => cloturerExercice(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: comptaKeys.exercices(etablissement?.id),
      });
      toast({
        title: "Exercice clôturé",
        description: "Les écritures sont désormais verrouillées.",
      });
      setCloturerTarget(null);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de clôturer l'exercice.",
        variant: "destructive",
      });
    },
  });

  // ─── KPIs calculés sur la liste des exercices ──────────────────────
  const list = exercices ?? [];
  const kpis = React.useMemo(() => {
    let ouverts = 0;
    let clotures = 0;
    for (const ex of list) {
      if (ex.statut === "OUVERT") ouverts += 1;
      else clotures += 1;
    }
    return { total: list.length, ouverts, clotures };
  }, [list]);

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Bandeau : compte + actions ─────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {exercices?.length ?? 0} exercice(s) · un exercice ouvert est
          nécessaire pour saisir des écritures.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Actualiser la liste des exercices"
          >
            <Loader2 className={cn("size-3.5", isFetching && "animate-spin")} />
            Actualiser
          </Button>
          {canManage && (
            <Button
              onClick={() => setFormOpen(true)}
              variant="success"
              size="sm"
              title="Créer un nouvel exercice comptable"
            >
              <Plus className="size-4" />
              Nouvel exercice
            </Button>
          )}
        </div>
      </div>

      {/* ─── 3 StatCards de résumé ────────────────────────────────────────── */}
      <section
        aria-label="Résumé des exercices"
        className="grid grid-cols-1 gap-4 sm:grid-cols-3"
      >
        <StatCard
          icon={CalendarRange}
          tone="emerald"
          label="Total exercices"
          value={kpis.total}
          hint={isLoading ? "chargement…" : "créés pour l'établissement"}
          delay={0}
          className="h-full"
        />
        <StatCard
          icon={CheckCircle2}
          tone="forest"
          label="Ouverts"
          value={kpis.ouverts}
          hint="acceptent les écritures"
          delay={0.05}
          className="h-full"
        />
        <StatCard
          icon={Lock}
          tone="terracotta"
          label="Clôturés"
          value={kpis.clotures}
          hint="verrouillés définitivement"
          delay={0.1}
          className="h-full"
        />
      </section>

      <KentePattern variant="separator" className="my-1" />

      {/* ─── Contenu : tableau / skeleton / empty / error ─────────────────── */}
      {isLoading ? (
        <LoadingState rows={4} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          tone="emerald"
          title="Aucun exercice"
          message="Créez un premier exercice comptable pour commencer à saisir des écritures."
        />
      ) : (
        <GlassCard
          variant="adaptive"
          noHover
          noAnimation
          premiumBorder
          className="overflow-hidden p-0"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <TableHead className="min-w-[200px] pl-4 text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Libellé
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Période
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Statut
                  </TableHead>
                  <TableHead className="pr-4 text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((ex, index) => (
                  <ExerciceRow
                    key={ex.id}
                    exercice={ex}
                    index={index}
                    prefersReducedMotion={prefersReducedMotion}
                    canManage={canManage}
                    onCloturer={() => setCloturerTarget(ex)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      )}

      <ExerciceFormDialog open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog
        open={!!cloturerTarget}
        onOpenChange={(o) => !o && setCloturerTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clôturer l&apos;exercice ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point de clôturer « {cloturerTarget?.libelle} ».
              Cette action est <strong>irréversible</strong> : aucune nouvelle
              écriture ne pourra être rattachée à cet exercice.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <AlertDialogCancel
              disabled={cloturerMutation.isPending}
              className="sm:mr-2"
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                cloturerTarget && cloturerMutation.mutate(cloturerTarget.id)
              }
              disabled={cloturerMutation.isPending}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {cloturerMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Lock className="size-4" />
              )}
              Clôturer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ligne du tableau Exercice (motion.tr avec stagger delay index*0.02)
// ─────────────────────────────────────────────────────────────────────────────

function ExerciceRow({
  exercice: ex,
  index,
  prefersReducedMotion,
  canManage,
  onCloturer,
}: {
  exercice: ExerciceComptable;
  index: number;
  prefersReducedMotion: boolean;
  canManage: boolean;
  onCloturer: () => void;
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
  return (
    <motion.tr
      data-slot="table-row"
      className="hover:bg-emerald-50/60 border-b transition-colors dark:hover:bg-emerald-950/20"
      {...motionProps}
    >
      <TableCell className="pl-4">
        <div className="flex items-center gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
            aria-hidden="true"
          >
            <CalendarRange className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="break-words font-display text-sm font-semibold leading-snug text-forest">
              {ex.libelle}
            </div>
            {ex.annee_scolaire_id ? (
              <div className="text-[11px] text-muted-foreground">
                Année scolaire rattachée
              </div>
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        <CalendarRange className="mr-1 inline size-3" />
        {formatDateShort(ex.date_debut)} → {formatDateShort(ex.date_fin)}
      </TableCell>
      <TableCell>
        <StatutExerciceBadge statut={ex.statut} />
      </TableCell>
      <TableCell className="pr-4 text-right">
        {ex.statut === "OUVERT" && canManage ? (
          <Button
            variant="outline"
            size="sm"
            onClick={onCloturer}
            className="border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800/60 dark:text-amber-300 dark:hover:bg-amber-950/30"
            title={`Clôturer l'exercice « ${ex.libelle} »`}
            aria-label={`Clôturer l'exercice « ${ex.libelle} »`}
          >
            <Lock className="size-3.5" />
            <span className="hidden lg:inline">Clôturer</span>
            <span className="lg:hidden">Clôturer</span>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </motion.tr>
  );
}

function StatutExerciceBadge({ statut }: { statut: ExerciceComptable["statut"] }) {
  const cls =
    statut === "OUVERT"
      ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
      : "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200";
  return (
    <Badge variant="outline" className={cn("font-medium", cls)}>
      {statut === "OUVERT" ? "Ouvert" : "Clôturé"}
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Plan comptable »
// ─────────────────────────────────────────────────────────────────────────────

function PlanComptablePanel() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const etablissement = useAuthStore((s) => s.etablissement);
  const role = useAuthStore((s) => s.role);
  const canManage = ["COMPTABLE", "DIRECTION", "DIRECTEUR_ETUDES", "DIRECTEUR_SUPERVISEUR"].includes(
    role ?? "",
  );

  const [formOpen, setFormOpen] = React.useState(false);

  const {
    data: comptes,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: comptaKeys.comptes(etablissement?.id),
    queryFn: () => fetchComptes(etablissement?.id),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });

  // Grouper par type, puis hiérarchiser (parent → enfants)
  const grouped = React.useMemo(() => {
    const byType: Record<TypeCompte, CompteComptable[]> = {
      ACTIF: [],
      PASSIF: [],
      PRODUIT: [],
      CHARGE: [],
    };
    (comptes ?? []).forEach((c) => {
      byType[c.type]?.push(c);
    });
    // Trier par numéro dans chaque groupe
    TYPE_COMPTE_ORDER.forEach((t) => {
      byType[t].sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
    });
    return byType;
  }, [comptes]);

  // ─── KPIs par type ─────────────────────────────────────────────────
  const kpis = React.useMemo(() => {
    return {
      ACTIF: grouped.ACTIF.length,
      PASSIF: grouped.PASSIF.length,
      PRODUIT: grouped.PRODUIT.length,
      CHARGE: grouped.CHARGE.length,
    } as Record<TypeCompte, number>;
  }, [grouped]);

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Bandeau : compte + actions ─────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {comptes?.length ?? 0} compte(s) au plan comptable.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Actualiser le plan comptable"
          >
            <Loader2 className={cn("size-3.5", isFetching && "animate-spin")} />
            Actualiser
          </Button>
          {canManage && (
            <Button
              onClick={() => setFormOpen(true)}
              variant="success"
              size="sm"
              title="Créer un nouveau compte comptable"
            >
              <Plus className="size-4" />
              Nouveau compte
            </Button>
          )}
        </div>
      </div>

      {/* ─── 4 StatCards par type de compte ──────────────────────────────── */}
      <section
        aria-label="Résumé des comptes par type"
        className="grid grid-cols-2 items-stretch gap-3 sm:gap-4 lg:grid-cols-4"
      >
        {TYPE_COMPTE_ORDER.map((type, i) => {
          const Icon = TYPE_COMPTE_ICONS[type];
          return (
            <StatCard
              key={type}
              icon={Icon}
              tone={TYPE_COMPTE_TONES[type]}
              label={TYPE_COMPTE_LABEL[type]}
              value={kpis[type]}
              hint={isLoading ? "chargement…" : "comptes"}
              delay={i * 0.05}
              className="h-full"
            />
          );
        })}
      </section>

      <KentePattern variant="separator" className="my-1" />

      {/* ─── Contenu : sections / skeleton / empty / error ──────────────── */}
      {isLoading ? (
        <LoadingState rows={6} rowHeight="h-10" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (comptes ?? []).length === 0 ? (
        <EmptyState
          icon={ListTree}
          tone="emerald"
          title="Aucun compte"
          message="Le plan comptable est vide. Créez un premier compte pour structurer votre comptabilité."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {TYPE_COMPTE_ORDER.map((type, idx) => {
            const Icon = TYPE_COMPTE_ICONS[type];
            return (
              <GlassCard
                key={type}
                variant="adaptive"
                noHover
                noAnimation
                className="overflow-hidden p-0"
              >
                <div className="flex items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/60 px-5 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      aria-hidden="true"
                    >
                      <Icon className="size-4" />
                    </span>
                    <h3 className="font-display text-sm font-semibold tracking-tight text-forest">
                      {TYPE_COMPTE_LABEL[type]}
                    </h3>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn("font-medium", TYPE_COMPTE_CLS[type])}
                  >
                    {grouped[type].length}
                  </Badge>
                </div>
                <div>
                  {grouped[type].length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                      Aucun compte de type {TYPE_COMPTE_LABEL[type].toLowerCase()}.
                    </p>
                  ) : (
                    <CompteTreeList
                      comptes={grouped[type]}
                      prefersReducedMotion={prefersReducedMotion}
                      startIndex={idx * 100}
                    />
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      <CompteFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

function CompteTreeList({
  comptes,
  prefersReducedMotion,
  startIndex = 0,
}: {
  comptes: CompteComptable[];
  prefersReducedMotion: boolean;
  startIndex?: number;
}) {
  // Construire une map parent → enfants
  const byParent = React.useMemo(() => {
    const map = new Map<string | null, CompteComptable[]>();
    comptes.forEach((c) => {
      const key = c.parent_id ?? null;
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    });
    return map;
  }, [comptes]);

  const roots = byParent.get(null) ?? [];

  // Aplatit la hiérarchie pour le stagger d'animation
  const flat: { compte: CompteComptable; depth: number }[] = [];
  function walk(compte: CompteComptable, depth: number) {
    flat.push({ compte, depth });
    const children = byParent.get(compte.id) ?? [];
    children.forEach((c) => walk(c, depth + 1));
  }
  roots.forEach((r) => walk(r, 0));

  function renderNode(compte: CompteComptable, depth: number, index: number): React.ReactNode {
    const children = byParent.get(compte.id) ?? [];
    const motionProps = prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration: 0.25,
            delay: Math.min(index * 0.02, 0.4),
            ease: [0.22, 1, 0.36, 1] as const,
          },
        };
    return (
      <React.Fragment key={compte.id}>
        <motion.tr
          data-slot="table-row"
          className={cn(
            "hover:bg-emerald-50/60 border-b transition-colors dark:hover:bg-emerald-950/20",
            depth > 0 && "bg-muted/10",
          )}
          {...motionProps}
        >
          <TableCell
            className="font-mono text-xs"
            style={{ paddingLeft: `${12 + depth * 18}px` }}
          >
            {compte.numero}
          </TableCell>
          <TableCell className="text-xs break-words leading-snug">
            {compte.libelle}
          </TableCell>
          <TableCell className="text-right">
            {compte.actif ? (
              <Badge
                variant="outline"
                className="border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
              >
                Actif
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200"
              >
                Inactif
              </Badge>
            )}
          </TableCell>
        </motion.tr>
        {children.map((c) => renderNode(c, depth + 1, index + 1))}
      </React.Fragment>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
            <TableHead className="pl-4 text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
              N°
            </TableHead>
            <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
              Libellé
            </TableHead>
            <TableHead className="pr-4 text-right text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
              État
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {flat.map((item, i) => renderNode(item.compte, item.depth, startIndex + i))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Écritures »
// ─────────────────────────────────────────────────────────────────────────────

function EcrituresPanel() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const etablissement = useAuthStore((s) => s.etablissement);

  const [exerciceId, setExerciceId] = React.useState<string>("all");
  const [journalId, setJournalId] = React.useState<string>("all");
  const [dateDebut, setDateDebut] = React.useState("");
  const [dateFin, setDateFin] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [selectedEcriture, setSelectedEcriture] =
    React.useState<EcritureComptable | null>(null);

  const { data: exercices } = useQuery({
    queryKey: comptaKeys.exercices(etablissement?.id),
    queryFn: () => fetchExercices(etablissement?.id),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });
  const { data: journaux } = useQuery({
    queryKey: comptaKeys.journaux(etablissement?.id),
    queryFn: () => fetchJournaux(etablissement?.id),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });

  const params: EcrituresQueryParams = React.useMemo(
    () => ({
      exercice_id: exerciceId !== "all" ? exerciceId : undefined,
      journal_id: journalId !== "all" ? journalId : undefined,
      date_debut: dateDebut || undefined,
      date_fin: dateFin || undefined,
      page,
      page_size: PAGE_SIZE,
    }),
    [exerciceId, journalId, dateDebut, dateFin, page],
  );

  const {
    data: result,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: comptaKeys.ecritures(params),
    queryFn: () => fetchEcritures(params),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });

  // Reset page si filtres changent
  React.useEffect(() => {
    setPage(1);
  }, [exerciceId, journalId, dateDebut, dateFin]);

  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function resetFilters() {
    setExerciceId("all");
    setJournalId("all");
    setDateDebut("");
    setDateFin("");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Filtres premium ─────────────────────────────────────────────── */}
      <GlassCard
        variant="adaptive"
        noHover
        noAnimation
        className="p-4 sm:p-5"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Exercice</Label>
            <Select value={exerciceId} onValueChange={setExerciceId}>
              <SelectTrigger
                className="w-full bg-background"
                aria-label="Filtrer par exercice"
              >
                <CalendarRange className="size-4 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous exercices</SelectItem>
                {(exercices ?? []).map((ex) => (
                  <SelectItem key={ex.id} value={ex.id}>
                    {ex.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Journal</Label>
            <Select value={journalId} onValueChange={setJournalId}>
              <SelectTrigger
                className="w-full bg-background"
                aria-label="Filtrer par journal"
              >
                <BookOpen className="size-4 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous journaux</SelectItem>
                {(journaux ?? []).map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.code} — {j.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ec-debut" className="text-xs">
              Date début
            </Label>
            <div className="relative">
              <Calendar
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="ec-debut"
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                max={dateFin || todayISO()}
                className="bg-background pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ec-fin" className="text-xs">
              Date fin
            </Label>
            <div className="relative">
              <Calendar
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="ec-fin"
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                min={dateDebut || undefined}
                max={todayISO()}
                className="bg-background pl-8"
              />
            </div>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={resetFilters}
              title="Réinitialiser les filtres des écritures"
            >
              <RotateCcw className="size-3.5" />
              Réinitialiser
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ─── Bandeau : compte + actualiser ───────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isFetching ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Mise à jour…
            </>
          ) : (
            <>
              <FileText className="size-3" />
              {total} écriture(s)
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          title="Actualiser les écritures"
        >
          <Loader2 className={cn("size-3.5", isFetching && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      {/* ─── Contenu : tableau / skeleton / empty / error ─────────────────── */}
      {isLoading ? (
        <LoadingState rows={6} rowHeight="h-10" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (result?.data ?? []).length === 0 ? (
        <EmptyState
          icon={FileText}
          tone="emerald"
          title="Aucune écriture"
          message="Aucune écriture ne correspond à vos filtres. Les écritures sont générées automatiquement lors des encaissements (journal de caisse)."
        />
      ) : (
        <GlassCard
          variant="adaptive"
          noHover
          noAnimation
          premiumBorder
          className="overflow-hidden p-0"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <TableHead className="pl-4 text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Date
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    N° pièce
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Journal
                  </TableHead>
                  <TableHead className="min-w-[240px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Libellé
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Statut
                  </TableHead>
                  <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Débit
                  </TableHead>
                  <TableHead className="pr-4 text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Crédit
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(result?.data ?? []).map((ec, index) => (
                  <EcritureRow
                    key={ec.id}
                    ecriture={ec}
                    index={index}
                    prefersReducedMotion={prefersReducedMotion}
                    onClick={() => setSelectedEcriture(ec)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      )}

      {/* ─── Pagination ─────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isFetching}
            title="Page précédente"
          >
            Précédent
          </Button>
          <span className="text-xs font-medium text-muted-foreground">
            Page {page} sur {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isFetching}
            title="Page suivante"
          >
            Suivant
          </Button>
        </div>
      )}

      <EcritureDetailDialog
        ecriture={selectedEcriture}
        onClose={() => setSelectedEcriture(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ligne du tableau Écriture (motion.tr avec stagger delay index*0.02)
// ─────────────────────────────────────────────────────────────────────────────

function EcritureRow({
  ecriture: ec,
  index,
  prefersReducedMotion,
  onClick,
}: {
  ecriture: EcritureComptable;
  index: number;
  prefersReducedMotion: boolean;
  onClick: () => void;
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
  const totalDebit = (ec.lignes ?? []).reduce(
    (s, l) => s + (l.debit ?? 0),
    0,
  );
  const totalCredit = (ec.lignes ?? []).reduce(
    (s, l) => s + (l.credit ?? 0),
    0,
  );
  return (
    <motion.tr
      data-slot="table-row"
      className="cursor-pointer hover:bg-emerald-50/60 border-b transition-colors dark:hover:bg-emerald-950/20"
      onClick={onClick}
      {...motionProps}
    >
      <TableCell className="pl-4 text-xs whitespace-nowrap">
        {formatDateShort(ec.date_ecriture)}
      </TableCell>
      <TableCell className="font-mono text-xs">{ec.numero_piece}</TableCell>
      <TableCell className="text-xs">
        {ec.journal ? (
          <span className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-100 px-1.5 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200">
            {ec.journal.code}
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="max-w-[280px] text-xs break-words leading-snug">
        {ec.libelle}
      </TableCell>
      <TableCell>
        <StatutEcritureBadge statut={ec.statut} />
      </TableCell>
      <TableCell className="text-right font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300">
        {formatFCFA(totalDebit)}
      </TableCell>
      <TableCell className="pr-4 text-right font-mono text-xs font-semibold text-amber-700 dark:text-amber-300">
        {formatFCFA(totalCredit)}
      </TableCell>
    </motion.tr>
  );
}

function StatutEcritureBadge({
  statut,
}: {
  statut: EcritureComptable["statut"];
}) {
  const cls =
    statut === "VALIDEE"
      ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
      : "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200";
  return (
    <Badge variant="outline" className={cn("font-medium", cls)}>
      {statut === "VALIDEE" ? "Validée" : "Brouillon"}
    </Badge>
  );
}

function EcritureDetailDialog({
  ecriture,
  onClose,
}: {
  ecriture: EcritureComptable | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = React.useState<EcritureComptable | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!ecriture) {
      setDetail(null);
      return;
    }
    // Si l'écriture a déjà des lignes, on les affiche directement.
    if (ecriture.lignes && ecriture.lignes.length > 0) {
      setDetail(ecriture);
      return;
    }
    // Sinon, on charge le détail.
    let cancelled = false;
    setLoading(true);
    fetchEcriture(ecriture.id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setDetail(ecriture);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ecriture]);

  const lignes = detail?.lignes ?? [];
  const totalDebit = lignes.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCredit = lignes.reduce((s, l) => s + (l.credit ?? 0), 0);

  return (
    <Dialog open={!!ecriture} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <FileText className="size-5" />
            </div>
            <span className="font-display text-lg font-semibold text-forest">
              Écriture {ecriture?.numero_piece}
            </span>
          </DialogTitle>
          <DialogDescription>
            {ecriture
              ? `${ecriture.libelle} · ${formatDateShort(ecriture.date_ecriture)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Chargement des lignes…
          </div>
        ) : lignes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aucune ligne détaillée disponible.
          </p>
        ) : (
          <GlassCard
            variant="tablet"
            noHover
            noAnimation
            className="overflow-hidden p-0"
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <TableHead className="pl-3 text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Compte
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Libellé
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Débit
                    </TableHead>
                    <TableHead className="pr-3 text-right text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Crédit
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignes.map((l, i) => (
                    <TableRow
                      key={l.id ?? i}
                      className="hover:bg-emerald-50/60 border-b transition-colors dark:hover:bg-emerald-950/20"
                    >
                      <TableCell className="font-mono text-xs break-words leading-snug">
                        {l.compte
                          ? `${l.compte.numero} — ${l.compte.libelle}`
                          : l.compte_id}
                      </TableCell>
                      <TableCell className="text-xs break-words leading-snug">
                        {l.libelle ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-700 dark:text-emerald-300">
                        {l.debit ? formatFCFA(l.debit) : "—"}
                      </TableCell>
                      <TableCell className="pr-3 text-right font-mono text-xs text-amber-700 dark:text-amber-300">
                        {l.credit ? formatFCFA(l.credit) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-emerald-50/60 font-semibold dark:bg-emerald-950/20">
                    <TableCell colSpan={2} className="text-right text-xs">
                      Totaux
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-emerald-700 dark:text-emerald-300">
                      {formatFCFA(totalDebit)}
                    </TableCell>
                    <TableCell className="pr-3 text-right font-mono text-xs text-amber-700 dark:text-amber-300">
                      {formatFCFA(totalCredit)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </GlassCard>
        )}

        {ecriture?.paiement ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            <Wallet className="mr-1 inline size-3" />
            Issue du paiement n°{" "}
            <span className="font-mono">{ecriture.paiement.numero_recu}</span>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Grand livre »
// ─────────────────────────────────────────────────────────────────────────────

function GrandLivrePanel() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const etablissement = useAuthStore((s) => s.etablissement);

  const [exerciceId, setExerciceId] = React.useState<string>("all");
  const [compteId, setCompteId] = React.useState<string>("all");
  const [dateDebut, setDateDebut] = React.useState("");
  const [dateFin, setDateFin] = React.useState("");

  const { data: exercices } = useQuery({
    queryKey: comptaKeys.exercices(etablissement?.id),
    queryFn: () => fetchExercices(etablissement?.id),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });
  const { data: comptes } = useQuery({
    queryKey: comptaKeys.comptes(etablissement?.id),
    queryFn: () => fetchComptes(etablissement?.id),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });

  const params: GrandLivreQueryParams = React.useMemo(
    () => ({
      exercice_id: exerciceId !== "all" ? exerciceId : undefined,
      compte_id: compteId !== "all" ? compteId : undefined,
      date_debut: dateDebut || undefined,
      date_fin: dateFin || undefined,
    }),
    [exerciceId, compteId, dateDebut, dateFin],
  );

  const {
    data: grandLivre,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: comptaKeys.grandLivre(params),
    queryFn: () => fetchGrandLivre(params),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });

  function resetFilters() {
    setExerciceId("all");
    setCompteId("all");
    setDateDebut("");
    setDateFin("");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Filtres premium ─────────────────────────────────────────────── */}
      <GlassCard
        variant="adaptive"
        noHover
        noAnimation
        className="p-4 sm:p-5"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Exercice</Label>
            <Select value={exerciceId} onValueChange={setExerciceId}>
              <SelectTrigger
                className="w-full bg-background"
                aria-label="Filtrer par exercice"
              >
                <CalendarRange className="size-4 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {(exercices ?? []).map((ex) => (
                  <SelectItem key={ex.id} value={ex.id}>
                    {ex.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Compte</Label>
            <Select value={compteId} onValueChange={setCompteId}>
              <SelectTrigger
                className="w-full bg-background"
                aria-label="Filtrer par compte"
              >
                <ListTree className="size-4 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les comptes</SelectItem>
                {(comptes ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="font-mono">{c.numero}</span>
                    {" — "}
                    {c.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gl-debut" className="text-xs">
              Date début
            </Label>
            <div className="relative">
              <Calendar
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="gl-debut"
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                max={dateFin || todayISO()}
                className="bg-background pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gl-fin" className="text-xs">
              Date fin
            </Label>
            <div className="relative">
              <Calendar
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="gl-fin"
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                min={dateDebut || undefined}
                max={todayISO()}
                className="bg-background pl-8"
              />
            </div>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={resetFilters}
              title="Réinitialiser les filtres du grand livre"
            >
              <RotateCcw className="size-3.5" />
              Réinitialiser
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ─── Bandeau : compte + actualiser ───────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isFetching ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Calcul…
            </>
          ) : (
            <>
              <BookOpen className="size-3" />
              {grandLivre?.comptes.length ?? 0} compte(s) ·{" "}
              {grandLivre?.comptes.reduce(
                (s, c) => s + c.mouvements.length,
                0,
              ) ?? 0}{" "}
              mouvement(s)
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          title="Actualiser le grand livre"
        >
          <Loader2 className={cn("size-3.5", isFetching && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      {isLoading ? (
        <LoadingState rows={5} rowHeight="h-10" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !grandLivre || grandLivre.comptes.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          tone="emerald"
          title="Grand livre vide"
          message="Aucun mouvement comptable sur la période sélectionnée."
        />
      ) : (
        <div className="space-y-4">
          {(grandLivre as GrandLivreResult).comptes.map((c) => (
            <GrandLivreCompteCard
              key={c.compte_id}
              compte={c}
              prefersReducedMotion={prefersReducedMotion}
            />
          ))}

          <GlassCard
            variant="adaptive"
            noHover
            noAnimation
            className="bg-muted/30 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Totaux généraux
              </span>
              <div className="flex gap-4 font-mono text-sm">
                <span className="text-emerald-700 dark:text-emerald-300">
                  Débit : {formatFCFA(grandLivre.total_debit)}
                </span>
                <span className="text-amber-700 dark:text-amber-300">
                  Crédit : {formatFCFA(grandLivre.total_credit)}
                </span>
              </div>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carte Grand livre par compte
// ─────────────────────────────────────────────────────────────────────────────

function GrandLivreCompteCard({
  compte: c,
  prefersReducedMotion,
}: {
  compte: GrandLivreResult["comptes"][number];
  prefersReducedMotion: boolean;
}) {
  return (
    <GlassCard
      variant="adaptive"
      noHover
      noAnimation
      premiumBorder
      className="overflow-hidden p-0"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50/60 px-5 py-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
        <div className="flex items-center gap-2 text-sm">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
            aria-hidden="true"
          >
            <ListTree className="size-4" />
          </span>
          <span className="font-display font-semibold text-forest">
            <span className="font-mono">{c.numero}</span>
            {" — "}
            {c.libelle}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs font-normal">
          <Badge
            variant="outline"
            className="border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200"
          >
            Ouverture :{" "}
            <span className="ml-1 font-mono text-gold-dark dark:text-gold">
              {formatFCFA(c.solde_debit_ouv - c.solde_credit_ouv)}
            </span>
          </Badge>
          <Badge
            variant="outline"
            className="border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
          >
            Solde final :{" "}
            <span className="ml-1 font-mono text-gold-dark dark:text-gold">
              {formatFCFA(c.solde_debit_fin - c.solde_credit_fin)}
            </span>
          </Badge>
        </div>
      </div>
      <div>
        {c.mouvements.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            Aucun mouvement sur ce compte.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <TableHead className="pl-4 text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Date
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Pièce
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Libellé
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Débit
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Crédit
                  </TableHead>
                  <TableHead className="pr-4 text-right text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Solde
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {c.mouvements.map((m, i) => (
                  <GrandLivreMouvementRow
                    key={i}
                    mouvement={m}
                    index={i}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

function GrandLivreMouvementRow({
  mouvement: m,
  index,
  prefersReducedMotion,
}: {
  mouvement: GrandLivreResult["comptes"][number]["mouvements"][number];
  index: number;
  prefersReducedMotion: boolean;
}) {
  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.25,
          delay: Math.min(index * 0.02, 0.4),
          ease: [0.22, 1, 0.36, 1] as const,
        },
      };
  return (
    <motion.tr
      data-slot="table-row"
      className="hover:bg-emerald-50/60 border-b transition-colors dark:hover:bg-emerald-950/20"
      {...motionProps}
    >
      <TableCell className="pl-4 text-xs whitespace-nowrap">
        {formatDateShort(m.date)}
      </TableCell>
      <TableCell className="font-mono text-xs">{m.numero_piece}</TableCell>
      <TableCell className="max-w-[280px] text-xs break-words leading-snug">
        {m.libelle}
      </TableCell>
      <TableCell className="text-right font-mono text-xs text-gold-dark dark:text-gold">
        {m.debit ? formatFCFA(m.debit) : "—"}
      </TableCell>
      <TableCell className="text-right font-mono text-xs text-gold-dark dark:text-gold">
        {m.credit ? formatFCFA(m.credit) : "—"}
      </TableCell>
      <TableCell className="pr-4 text-right font-mono text-xs font-semibold text-gold-dark dark:text-gold">
        {formatFCFA(m.solde)}
      </TableCell>
    </motion.tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Bilan »
// ─────────────────────────────────────────────────────────────────────────────

function BilanPanel() {
  const etablissement = useAuthStore((s) => s.etablissement);

  const [exerciceId, setExerciceId] = React.useState<string>("all");

  const { data: exercices } = useQuery({
    queryKey: comptaKeys.exercices(etablissement?.id),
    queryFn: () => fetchExercices(etablissement?.id),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });

  const {
    data: bilan,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: comptaKeys.bilan(exerciceId !== "all" ? exerciceId : undefined),
    queryFn: () =>
      fetchBilan(exerciceId !== "all" ? exerciceId : undefined),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });

  const resultat = bilan?.resultat ?? 0;
  const isProfit = resultat >= 0;

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Sélecteur exercice + actualiser ─────────────────────────────── */}
      <GlassCard
        variant="adaptive"
        noHover
        noAnimation
        className="p-4 sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <Label className="text-xs">Exercice</Label>
            <Select value={exerciceId} onValueChange={setExerciceId}>
              <SelectTrigger
                className="w-full bg-background sm:w-72"
                aria-label="Sélectionner un exercice pour le bilan"
              >
                <CalendarRange className="size-4 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous exercices</SelectItem>
                {(exercices ?? []).map((ex) => (
                  <SelectItem key={ex.id} value={ex.id}>
                    {ex.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Actualiser le bilan"
          >
            <Loader2 className={cn("size-3.5", isFetching && "animate-spin")} />
            Actualiser
          </Button>
        </div>
      </GlassCard>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : !bilan ? (
        <EmptyState
          icon={Scale}
          tone="amber"
          title="Bilan indisponible"
          message="Sélectionnez un exercice contenant des écritures pour générer le bilan."
        />
      ) : (
        <div className="space-y-4">
          {/* ─── 3 StatCards : Total actif / Total passif / Résultat ─────── */}
          <section
            aria-label="Résumé du bilan"
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            <StatCard
              icon={Wallet}
              tone="emerald"
              label="Total actif"
              value={formatFCFA(bilan.actif.total)}
              hint="avoirs de l'établissement"
              delay={0}
              className="h-full"
            />
            <StatCard
              icon={Scale}
              tone="amber"
              label="Total passif"
              value={formatFCFA(bilan.passif.total)}
              hint="dettes & capitaux"
              delay={0.05}
              className="h-full"
            />
            <StatCard
              icon={isProfit ? TrendingUp : TrendingDown}
              tone={isProfit ? "gold" : "terracotta"}
              label="Résultat"
              value={formatFCFA(resultat)}
              hint={isProfit ? "excédentaire" : "déficitaire"}
              delay={0.1}
              className="h-full"
            />
          </section>

          {/* ─── Détails par section ─────────────────────────────────────── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <BilanDetailTable
              title="Actif — détail"
              section={bilan.actif}
              accent="emerald"
            />
            <BilanDetailTable
              title="Passif — détail"
              section={bilan.passif}
              accent="amber"
            />
            <BilanDetailTable
              title="Produits — détail"
              section={bilan.produits}
              accent="emerald"
            />
            <BilanDetailTable
              title="Charges — détail"
              section={bilan.charges}
              accent="rose"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function BilanDetailTable({
  title,
  section,
  accent,
}: {
  title: string;
  section: BilanResult["actif"];
  accent: "emerald" | "amber" | "rose";
}) {
  const headerCls: Record<string, string> = {
    emerald: "text-emerald-700 dark:text-emerald-300",
    amber: "text-amber-700 dark:text-amber-300",
    rose: "text-rose-700 dark:text-rose-300",
  };
  return (
    <GlassCard
      variant="adaptive"
      noHover
      noAnimation
      premiumBorder
      className="overflow-hidden p-0"
    >
      <div className="bg-emerald-50/60 px-5 py-3 dark:bg-emerald-950/20">
        <h3 className={cn("font-display text-sm font-semibold", headerCls[accent])}>
          {title}
        </h3>
      </div>
      <div>
        {section.comptes.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            Aucun compte mouvementé.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <TableHead className="pl-4 text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    N°
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Libellé
                  </TableHead>
                  <TableHead className="pr-4 text-right text-[11px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Montant
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.comptes.map((c) => (
                  <TableRow
                    key={c.compte_id}
                    className="hover:bg-emerald-50/60 border-b transition-colors dark:hover:bg-emerald-950/20"
                  >
                    <TableCell className="pl-4 font-mono text-xs">
                      {c.numero}
                    </TableCell>
                    <TableCell className="text-xs break-words leading-snug">
                      {c.libelle}
                    </TableCell>
                    <TableCell className="pr-4 text-right font-mono text-xs text-gold-dark dark:text-gold">
                      {formatFCFA(c.montant)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-emerald-50/60 font-semibold dark:bg-emerald-950/20">
                  <TableCell colSpan={2} className="text-right text-xs">
                    Total
                  </TableCell>
                  <TableCell
                    className={cn(
                      "pr-4 text-right font-mono text-xs text-gold-dark dark:text-gold",
                    )}
                  >
                    {formatFCFA(section.total)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// États partagés (premium — KentePattern bg + badges ronds colorés)
// ─────────────────────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <GlassCard
      variant="adaptive"
      noHover
      className="relative overflow-hidden"
    >
      <KentePattern variant="bg" />
      <div className="relative flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="font-display text-base font-semibold text-forest">
            Erreur de chargement
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Le backend n&apos;a pas pu répondre. Réessayez ou vérifiez votre
            connexion.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          title="Réessayer le chargement"
        >
          <Loader2 className="size-3.5" />
          Réessayer
        </Button>
      </div>
    </GlassCard>
  );
}

function EmptyState({
  icon: Icon,
  tone,
  title,
  message,
}: {
  icon: LucideIcon;
  tone: "emerald" | "amber" | "rose";
  title: string;
  message: string;
}) {
  const cls = {
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  }[tone];
  return (
    <GlassCard
      variant="adaptive"
      noHover
      className="relative overflow-hidden"
    >
      <KentePattern variant="bg" />
      <div className="relative flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
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
          <p className="max-w-md text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </GlassCard>
  );
}

function LoadingState({
  rows = 5,
  rowHeight = "h-14",
}: {
  rows?: number;
  rowHeight?: string;
}) {
  return (
    <GlassCard
      variant="adaptive"
      noHover
      noAnimation
      className="relative overflow-hidden p-0"
    >
      <KentePattern variant="strip" position="top" />
      <div className="space-y-2 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className={cn("w-full", rowHeight)} />
        ))}
      </div>
    </GlassCard>
  );
}
