"use client";

/**
 * ScolaGest — Liste des enseignants (module Enseignant — Phase A).
 *
 * Vue principale du module Enseignant :
 *  - Barre de recherche (debounce 300ms) sur nom / matricule / téléphone.
 *  - Filtre statut (ACTIF / INACTIF / CONGE).
 *  - Bouton « Nouvel enseignant » (variant success) qui ouvre le formulaire.
 *  - 4 StatCards DS (Total / Actifs / En congé / Inactifs) avec stagger.
 *  - Tableau desktop (shadcn Table) : matricule, nom complet (avatar + email),
 *    téléphone, statut (badge), type contrat, taux horaire défaut (FCFA/h gold),
 *    matières (badges) et actions (modifier / gérer matières / supprimer).
 *  - Cartes mobile (md:hidden) : vue condensée par enseignant avec actions
 *    icône-seules (h-11, touch target ≥ 44px).
 *  - Dialog de création / édition (sections Identité / Contact / Contrat en
 *    GlassCard tablet) premium.
 *  - Dialog « Gérer matières » premium : liste des matières en cards mini,
 *    formulaire d'ajout (Select matière + Input taux + bouton « Ajouter »).
 *  - Confirmation de suppression via AlertDialog.
 *
 * Refonte Forêt EdTech :
 *  - Hero header GlassCard desktop + KentePattern strip top + badge rond
 *    gradient emerald→gold (GraduationCap) + pill « Phase A » outline +
 *    pill établissement emerald.
 *  - 4 StatCards DS (emerald / forest / amber / terracotta) avec stagger
 *    delay 0/0.05/0.1/0.15.
 *  - Tableau desktop : GlassCard adaptive noHover noAnimation p-0 + header
 *    bg-emerald-50/60 + hover row bg-emerald-50/60 + avatar emerald-600
 *    text-white + email break-all + badges renforcés (border-300 bg-100
 *    text-800) + taux/h text-gold-dark dark:text-gold font-bold + boutons
 *    d'action avec title natif (PAS de Tooltip Radix — BUG À ÉVITER #1).
 *  - Cartes mobile : GlassCard mobile + avatar emerald + StatutEnseignantBadge
 *    + body (matricule, téléphone, contrat, taux, matières) + footer actions
 *    icône-seules h-11.
 *  - EnseignantFormDialog premium : header badge rond gradient + 3 sections
 *    GlassCard tablet (Identité / Contact / Contrat) + footer grid-cols-2
 *    mobile + bouton submit variant success.
 *  - EnseignantMatieresDialog premium : header badge rond gradient + cards
 *    mini pour les matières associées + formulaire d'ajout (Select + Input
 *    + bouton « Ajouter » variant success).
 *  - Empty states premium : KentePattern bg + badges ronds colorés + bouton
 *    « Créer un enseignant » (variant success) sur l'état vide.
 *  - Loading state : KentePattern strip top + 5 Skeletons rows.
 *
 * Le contexte d'établissement vient de `useAuthStore`. Si aucun établissement
 * n'est sélectionné, on invite l'utilisateur à en choisir un.
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query (enseignantsKeys / matieresKeys
 * / fetchEnseignants / fetchMatieres / enabled: !!etablissement), mutations
 * (createMutation / updateMutation / deleteMutation / addMutation /
 * removeMutation), handlers (openCreate / openEdit / openMatieres /
 * handleSubmit), debounce 300ms sur la recherche, types Enseignant /
 * EnseignantDTO / StatutEnseignant / TypeContrat / Sexe, constantes
 * STATUT_LABEL / STATUT_CLS (contrastes renforcés) / TYPE_CONTRAT_LABEL /
 * TYPE_CONTRAT_OPTIONS / STATUT_OPTIONS, FormState + validation nom/taux,
 * helper enseignantFullName. Aucun endpoint backend touché.
 */

import * as React from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertCircle,
  BookOpen,
  Loader2,
  Mail,
  Phone,
  X,
  Filter,
  FileText,
  CheckCircle2,
  CalendarClock,
  UserX,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchEnseignants,
  createEnseignant,
  updateEnseignant,
  deleteEnseignant,
  addMatiereToEnseignant,
  removeMatiereFromEnseignant,
  fetchMatieres,
  type Enseignant,
  type EnseignantDTO,
  type StatutEnseignant,
  type TypeContrat,
  type Sexe,
} from "@/lib/api-enseignant";
import { formatFCFA } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

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

export const enseignantsKeys = {
  all: ["enseignants"] as const,
  list: (params: { search?: string; statut?: StatutEnseignant }) =>
    [...enseignantsKeys.all, "list", params] as const,
};

export const matieresKeys = {
  all: ["matieres"] as const,
  list: () => [...matieresKeys.all, "list"] as const,
};

const STATUT_LABEL: Record<StatutEnseignant, string> = {
  ACTIF: "Actif",
  INACTIF: "Inactif",
  CONGE: "En congé",
};

// Contrast renforcé (BUG À ÉVITER #7) : border-300 bg-100 text-800.
// INACTIF en rose "chaud" (cohérent avec /utilisateurs, /effectifs).
const STATUT_CLS: Record<StatutEnseignant, string> = {
  ACTIF:
    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200",
  INACTIF:
    "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200",
  CONGE:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200",
};

const TYPE_CONTRAT_LABEL: Record<TypeContrat, string> = {
  CDI: "CDI",
  CDD: "CDD",
  VACATAIRE: "Vacataire",
  STAGIAIRE: "Stagiaire",
};

function StatutEnseignantBadge({ statut }: { statut: StatutEnseignant }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUT_CLS[statut])}>
      {STATUT_LABEL[statut]}
    </Badge>
  );
}

function enseignantFullName(e: Enseignant): string {
  return [e.prenoms, e.nom].filter(Boolean).join(" ").trim() || "—";
}

/** Initiales (max 2 lettres) pour l'avatar d'un enseignant. */
function enseignantInitials(e: Enseignant): string {
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

export function EnseignantsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const etablissement = useAuthStore((s) => s.etablissement);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Filtres
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statut, setStatut] = React.useState<StatutEnseignant | "all">("all");

  // Dialogs
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Enseignant | null>(null);
  const [matieresOpen, setMatieresOpen] = React.useState(false);
  const [matieresTarget, setMatieresTarget] = React.useState<Enseignant | null>(
    null,
  );

  // Debounce de la recherche (300ms)
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = React.useMemo(
    () => ({
      search: debouncedSearch || undefined,
      statut: statut !== "all" ? statut : undefined,
    }),
    [debouncedSearch, statut],
  );

  const {
    data: enseignants,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: enseignantsKeys.list(params),
    queryFn: () => fetchEnseignants(params),
    enabled: !!etablissement,
  });

  // ─── KPIs calculés (Total / Actifs / Congé / Inactifs) ────────────────────
  const list = enseignants ?? [];
  const kpis = React.useMemo(() => {
    let actifs = 0;
    let conges = 0;
    let inactifs = 0;
    for (const e of list) {
      if (e.statut === "ACTIF") actifs += 1;
      else if (e.statut === "CONGE") conges += 1;
      else if (e.statut === "INACTIF") inactifs += 1;
    }
    return { total: list.length, actifs, conges, inactifs };
  }, [list]);

  // ─── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (dto: EnseignantDTO) => createEnseignant(dto),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: enseignantsKeys.all });
      toast({
        title: "Enseignant créé",
        description: "L'enseignant a été ajouté avec succès.",
      });
      setFormOpen(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de créer l'enseignant.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<EnseignantDTO> }) =>
      updateEnseignant(id, dto),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: enseignantsKeys.all });
      toast({
        title: "Enseignant modifié",
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
            : "Impossible de modifier l'enseignant.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEnseignant(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: enseignantsKeys.all });
      toast({
        title: "Enseignant supprimé",
        description: "L'enseignant a été retiré de l'établissement.",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de supprimer cet enseignant.",
        variant: "destructive",
      });
    },
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(e: Enseignant) {
    setEditing(e);
    setFormOpen(true);
  }
  function openMatieres(e: Enseignant) {
    setMatieresTarget(e);
    setMatieresOpen(true);
  }

  function handleSubmit(dto: EnseignantDTO) {
    if (editing) {
      updateMutation.mutate({ id: editing.id, dto });
    } else {
      createMutation.mutate(dto);
    }
  }

  // ─── États ────────────────────────────────────────────────────────────────

  if (!etablissement) {
    return (
      <EnseignantsShell>
        <EmptyState
          icon={AlertCircle}
          tone="amber"
          title="Sélectionnez un établissement"
          description="Choisissez un établissement dans la barre latérale pour gérer ses enseignants."
        />
      </EnseignantsShell>
    );
  }

  return (
    <EnseignantsShell onNew={openCreate} etablissementNom={etablissement.nom}>
      {/* ─── Barre de filtres ─────────────────────────────────────────────── */}
      <GlassCard variant="adaptive" noHover noAnimation className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, matricule, téléphone…"
              className="bg-background pl-8"
              aria-label="Rechercher un enseignant"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
                aria-label="Effacer la recherche"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <Select
            value={statut}
            onValueChange={(v) => setStatut(v as StatutEnseignant | "all")}
          >
            <SelectTrigger
              className="w-full bg-background sm:w-48"
              aria-label="Filtrer par statut"
            >
              <Filter className="size-3.5 text-muted-foreground" />
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="ACTIF">Actif</SelectItem>
              <SelectItem value="INACTIF">Inactif</SelectItem>
              <SelectItem value="CONGE">En congé</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </GlassCard>

      {/* ─── 4 StatCards de résumé ────────────────────────────────────────── */}
      <section
        aria-label="Résumé des enseignants"
        className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4"
      >
        <StatCard
          icon={GraduationCap}
          tone="emerald"
          label="Total enseignants"
          value={kpis.total}
          hint={isLoading ? "chargement…" : "dans l'établissement"}
          delay={0}
          className="h-full"
        />
        <StatCard
          icon={CheckCircle2}
          tone="forest"
          label="Actifs"
          value={kpis.actifs}
          hint="en activité"
          delay={0.05}
          className="h-full"
        />
        <StatCard
          icon={CalendarClock}
          tone="amber"
          label="En congé"
          value={kpis.conges}
          hint="temporairement absents"
          delay={0.1}
          className="h-full"
        />
        <StatCard
          icon={UserX}
          tone="terracotta"
          label="Inactifs"
          value={kpis.inactifs}
          hint="non disponibles"
          delay={0.15}
          className="h-full"
        />
      </section>

      <KentePattern variant="separator" className="my-1" />

      {/* ─── Contenu : tableau / skeleton / empty / error ────────────────── */}
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
              : "Impossible de charger les enseignants. Vérifiez que le backend est démarré puis réessayez."
          }
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          tone="emerald"
          title="Aucun enseignant"
          description="Cliquez sur « Nouvel enseignant » pour ajouter votre premier enseignant."
          action={
            <Button variant="success" onClick={openCreate}>
              <Plus className="size-4" />
              Créer un enseignant
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
            premiumBorder
            className="hidden overflow-hidden p-0 md:block"
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <TableHead className="min-w-[140px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Matricule
                    </TableHead>
                    <TableHead className="min-w-[220px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Nom complet
                    </TableHead>
                    <TableHead className="min-w-[150px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Téléphone
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Statut
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Contrat
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Taux/h
                    </TableHead>
                    <TableHead className="min-w-[200px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Matières
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((e, idx) => (
                    <EnseignantRow
                      key={e.id}
                      enseignant={e}
                      index={idx}
                      prefersReducedMotion={prefersReducedMotion}
                      onEdit={() => openEdit(e)}
                      onMatieres={() => openMatieres(e)}
                      onDelete={() => deleteMutation.mutate(e.id)}
                      deleting={deleteMutation.isPending}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </GlassCard>

          {/* ─── Cartes mobile (md:hidden) ─────────────────────────────── */}
          <div className="space-y-3 md:hidden">
            {list.map((e, idx) => (
              <EnseignantMobileCard
                key={e.id}
                enseignant={e}
                index={idx}
                prefersReducedMotion={prefersReducedMotion}
                onEdit={() => openEdit(e)}
                onMatieres={() => openMatieres(e)}
                onDelete={() => deleteMutation.mutate(e.id)}
                deleting={deleteMutation.isPending}
              />
            ))}
          </div>
        </>
      )}

      {/* Dialog création / édition */}
      <EnseignantFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        enseignant={editing}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
      />

      {/* Dialog gestion matières */}
      <EnseignantMatieresDialog
        open={matieresOpen}
        onOpenChange={setMatieresOpen}
        enseignant={matieresTarget}
      />
    </EnseignantsShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell (hero header premium + KentePattern strip / separator)
// ─────────────────────────────────────────────────────────────────────────────

function EnseignantsShell({
  children,
  onNew,
  etablissementNom,
}: {
  children: React.ReactNode;
  onNew?: () => void;
  etablissementNom?: string;
}) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <KentePattern variant="strip" position="top" />

      {/* ─── Hero header premium ──────────────────────────────────────── */}
      <GlassCard variant="desktop" noHover premiumBorder className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Badge rond gradient emerald→gold avec icône GraduationCap */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <GraduationCap className="size-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                  Enseignants
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Gérez le corps enseignant : fiches, contrats, matières enseignées
                et taux horaires.
              </p>
              {etablissementNom ? (
                <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {etablissementNom}
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
              Nouvel enseignant
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

function EnseignantRow({
  enseignant: e,
  index,
  prefersReducedMotion,
  onEdit,
  onMatieres,
  onDelete,
  deleting,
}: {
  enseignant: Enseignant;
  index: number;
  prefersReducedMotion: boolean;
  onEdit: () => void;
  onMatieres: () => void;
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
  return (
    <motion.tr
      data-slot="table-row"
      className="hover:bg-emerald-50/60 border-b transition-colors dark:hover:bg-emerald-950/20"
      {...motionProps}
    >
      {/* Matricule */}
      <TableCell className="font-mono text-xs text-muted-foreground">
        {e.matricule || "—"}
      </TableCell>

      {/* Nom complet : avatar emerald-600 text-white + nom font-display + email break-all */}
      <TableCell>
        <div className="flex items-center gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white"
            aria-hidden="true"
          >
            {enseignantInitials(e)}
          </div>
          <div className="min-w-0">
            <div className="break-words font-display text-sm font-semibold leading-snug text-forest">
              {enseignantFullName(e)}
            </div>
            {e.email ? (
              <div className="flex items-start gap-1 text-[11px] text-muted-foreground">
                <Mail className="mt-0.5 size-3 shrink-0" />
                <span className="break-all leading-snug">{e.email}</span>
              </div>
            ) : null}
          </div>
        </div>
      </TableCell>

      {/* Téléphone : badge emerald/15 + icône Phone */}
      <TableCell>
        {e.telephone ? (
          <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-2 py-1 text-xs">
            <Phone className="size-3 text-emerald-700 dark:text-emerald-300" />
            <span className="font-mono">{e.telephone}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Statut */}
      <TableCell>
        <StatutEnseignantBadge statut={e.statut} />
      </TableCell>

      {/* Contrat : badge avec icône FileText */}
      <TableCell>
        <Badge
          variant="outline"
          className="gap-1 border-slate-300 bg-slate-100 font-normal text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200"
        >
          <FileText className="size-3" />
          {TYPE_CONTRAT_LABEL[e.type_contrat]}
        </Badge>
      </TableCell>

      {/* Taux/h : text-gold-dark dark:text-gold font-bold */}
      <TableCell className="text-right">
        {e.taux_horaire_defaut ? (
          <span className="font-mono text-base font-bold text-gold-dark dark:text-gold">
            {formatFCFA(e.taux_horaire_defaut)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>

      {/* Matières : badges emerald renforcés (border-300 bg-100 text-800) */}
      <TableCell>
        <div className="flex max-w-[220px] flex-wrap gap-1">
          {(e.matieres ?? []).length === 0 ? (
            <span className="text-[11px] italic text-muted-foreground">
              Aucune
            </span>
          ) : (
            (e.matieres ?? []).slice(0, 3).map((m) => (
              <Badge
                key={m.id}
                variant="outline"
                className="border-emerald-300 bg-emerald-100 text-[10px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
              >
                {m.matiere?.libelle ?? "—"}
              </Badge>
            ))
          )}
          {(e.matieres ?? []).length > 3 ? (
            <Badge
              variant="outline"
              className="border-slate-300 bg-slate-100 text-[10px] font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200"
            >
              +{(e.matieres ?? []).length - 3}
            </Badge>
          ) : null}
        </div>
      </TableCell>

      {/* Actions : title natif (PAS de Tooltip Radix) + icône seule sur md, icône + texte sur lg */}
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            title="Modifier cet enseignant"
            aria-label={`Modifier l'enseignant « ${enseignantFullName(e)} »`}
          >
            <Pencil className="size-3.5" />
            <span className="hidden lg:inline">Modifier</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onMatieres}
            className="text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
            title="Gérer les matières"
            aria-label={`Gérer les matières de « ${enseignantFullName(e)} »`}
          >
            <BookOpen className="size-3.5" />
            <span className="hidden lg:inline">Matières</span>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-rose-50 dark:hover:bg-rose-950/40"
                disabled={deleting}
                title="Supprimer cet enseignant"
                aria-label={`Supprimer l'enseignant « ${enseignantFullName(e)} »`}
              >
                {deleting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                <span className="hidden lg:inline">Supprimer</span>
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Supprimer cet enseignant ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. L&apos;enseignant
                  « {enseignantFullName(e)} » et toutes ses associations
                  (matières, affectations) seront supprimés.
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
      </TableCell>
    </motion.tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carte mobile (md:hidden) — vue condensée par enseignant
// ─────────────────────────────────────────────────────────────────────────────

function EnseignantMobileCard({
  enseignant: e,
  index,
  prefersReducedMotion,
  onEdit,
  onMatieres,
  onDelete,
  deleting,
}: {
  enseignant: Enseignant;
  index: number;
  prefersReducedMotion: boolean;
  onEdit: () => void;
  onMatieres: () => void;
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
  return (
    <motion.div className="rounded-2xl" {...motionProps}>
      <GlassCard variant="mobile" noHover noAnimation className="p-4">
        {/* ─── En-tête : avatar + nom + statut ──────────────────────────── */}
        <div className="flex items-start gap-3">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white"
            aria-hidden="true"
          >
            {enseignantInitials(e)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="break-words font-display text-base font-semibold leading-snug text-forest">
              {enseignantFullName(e)}
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {e.matricule || "—"}
            </p>
          </div>
          <StatutEnseignantBadge statut={e.statut} />
        </div>

        {/* ─── Body : téléphone, email, contrat, taux/h ─────────────────── */}
        <div className="mt-3 space-y-2 border-t pt-3">
          {e.telephone ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="flex size-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                <Phone className="size-3" />
              </span>
              <span className="font-mono">{e.telephone}</span>
            </div>
          ) : null}
          {e.email ? (
            <div className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 flex size-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
                <Mail className="size-3" />
              </span>
              <span className="break-all leading-snug">{e.email}</span>
            </div>
          ) : null}
          <div className="flex items-center gap-2 text-xs">
            <span className="flex size-6 items-center justify-center rounded-md bg-slate-500/15 text-slate-700 dark:text-slate-300">
              <FileText className="size-3" />
            </span>
            <span className="font-medium">{TYPE_CONTRAT_LABEL[e.type_contrat]}</span>
          </div>
          {e.taux_horaire_defaut ? (
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span className="flex size-6 items-center justify-center rounded-md bg-gold/15 text-gold-dark">
                  <BookOpen className="size-3" />
                </span>
                Taux/h
              </span>
              <span className="font-mono text-base font-bold text-gold-dark dark:text-gold">
                {formatFCFA(e.taux_horaire_defaut)}
              </span>
            </div>
          ) : null}
        </div>

        {/* ─── Matières ───────────────────────────────────────────────── */}
        {(e.matieres ?? []).length > 0 ? (
          <div className="mt-3 border-t pt-3">
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Matières
            </p>
            <div className="flex flex-wrap gap-1">
              {(e.matieres ?? []).slice(0, 4).map((m) => (
                <Badge
                  key={m.id}
                  variant="outline"
                  className="border-emerald-300 bg-emerald-100 text-[10px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
                >
                  {m.matiere?.libelle ?? "—"}
                </Badge>
              ))}
              {(e.matieres ?? []).length > 4 ? (
                <Badge
                  variant="outline"
                  className="border-slate-300 bg-slate-100 text-[10px] font-medium text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200"
                >
                  +{(e.matieres ?? []).length - 4}
                </Badge>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* ─── Footer : actions icône-seules (h-11, touch target ≥ 44px) */}
        <div className="mt-3 flex justify-end gap-1.5 border-t pt-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            className="h-11 w-11 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            title="Modifier"
            aria-label={`Modifier l'enseignant « ${enseignantFullName(e)} »`}
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onMatieres}
            className="h-11 w-11 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
            title="Gérer les matières"
            aria-label={`Gérer les matières de « ${enseignantFullName(e)} »`}
          >
            <BookOpen className="size-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 text-destructive hover:bg-rose-50 dark:hover:bg-rose-950/40"
                disabled={deleting}
                title="Supprimer"
                aria-label={`Supprimer l'enseignant « ${enseignantFullName(e)} »`}
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
                  Supprimer cet enseignant ?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Cette action est irréversible. L&apos;enseignant
                  « {enseignantFullName(e)} » et toutes ses associations
                  (matières, affectations) seront supprimés.
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

const TYPE_CONTRAT_OPTIONS: { value: TypeContrat; label: string }[] = [
  { value: "CDI", label: "CDI" },
  { value: "CDD", label: "CDD" },
  { value: "VACATAIRE", label: "Vacataire" },
  { value: "STAGIAIRE", label: "Stagiaire" },
];

const STATUT_OPTIONS: { value: StatutEnseignant; label: string }[] = [
  { value: "ACTIF", label: "Actif" },
  { value: "INACTIF", label: "Inactif" },
  { value: "CONGE", label: "En congé" },
];

interface FormState {
  nom: string;
  prenoms: string;
  sexe: Sexe;
  telephone: string;
  email: string;
  type_contrat: TypeContrat;
  statut: StatutEnseignant;
  taux_horaire_defaut: string;
  diplome: string;
  specialite: string;
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

function EnseignantFormDialog({
  open,
  onOpenChange,
  enseignant,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  enseignant: Enseignant | null;
  onSubmit: (dto: EnseignantDTO) => void;
  submitting: boolean;
}) {
  const isEdit = !!enseignant;

  const [form, setForm] = React.useState<FormState>({
    nom: "",
    prenoms: "",
    sexe: "",
    telephone: "",
    email: "",
    type_contrat: "CDI",
    statut: "ACTIF",
    taux_horaire_defaut: "",
    diplome: "",
    specialite: "",
  });
  const [submitted, setSubmitted] = React.useState(false);

  // Synchronise le formulaire à l'ouverture
  React.useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    if (enseignant) {
      setForm({
        nom: enseignant.nom ?? "",
        prenoms: enseignant.prenoms ?? "",
        sexe: enseignant.sexe ?? "",
        telephone: enseignant.telephone ?? "",
        email: enseignant.email ?? "",
        type_contrat: enseignant.type_contrat ?? "CDI",
        statut: enseignant.statut ?? "ACTIF",
        taux_horaire_defaut:
          enseignant.taux_horaire_defaut != null
            ? String(enseignant.taux_horaire_defaut)
            : "",
        diplome: enseignant.diplome ?? "",
        specialite: enseignant.specialite ?? "",
      });
    } else {
      setForm({
        nom: "",
        prenoms: "",
        sexe: "",
        telephone: "",
        email: "",
        type_contrat: "CDI",
        statut: "ACTIF",
        taux_horaire_defaut: "",
        diplome: "",
        specialite: "",
      });
    }
  }, [open, enseignant]);

  const nomValid = form.nom.trim().length > 0;
  const tauxValid =
    form.taux_horaire_defaut === "" ||
    (!Number.isNaN(Number(form.taux_horaire_defaut)) &&
      Number(form.taux_horaire_defaut) >= 0);
  const formValid = nomValid && tauxValid;

  function handleSave() {
    setSubmitted(true);
    if (!formValid) return;
    const dto: EnseignantDTO = {
      nom: form.nom.trim(),
      prenoms: form.prenoms.trim() || undefined,
      sexe: form.sexe || undefined,
      telephone: form.telephone.trim() || undefined,
      email: form.email.trim() || undefined,
      type_contrat: form.type_contrat,
      statut: form.statut,
      taux_horaire_defaut: form.taux_horaire_defaut
        ? Number(form.taux_horaire_defaut)
        : 0,
      diplome: form.diplome.trim() || undefined,
      specialite: form.specialite.trim() || undefined,
    };
    onSubmit(dto);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-md shadow-emerald-900/20">
              <GraduationCap className="size-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="font-display text-lg font-bold tracking-tight text-forest">
                {isEdit ? "Modifier l'enseignant" : "Nouvel enseignant"}
              </DialogTitle>
              <DialogDescription>
                {isEdit
                  ? "Mettez à jour les informations de l'enseignant."
                  : "Renseignez les informations de base de l'enseignant."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* ─── Section : Identité ─────────────────────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="p-4">
            <FormSectionTitle icon={GraduationCap}>Identité</FormSectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ens-nom">
                  Nom <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="ens-nom"
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  placeholder="Koffi"
                  aria-invalid={submitted && !nomValid}
                  className="bg-background"
                />
                {submitted && !nomValid ? (
                  <p className="text-[11px] text-destructive">Le nom est requis.</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ens-prenoms">Prénoms</Label>
                <Input
                  id="ens-prenoms"
                  value={form.prenoms}
                  onChange={(e) => setForm({ ...form, prenoms: e.target.value })}
                  placeholder="Jean Marc"
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ens-sexe">Sexe</Label>
                <Select
                  value={form.sexe || "NONE"}
                  onValueChange={(v) =>
                    setForm({ ...form, sexe: v === "NONE" ? "" : (v as Sexe) })
                  }
                >
                  <SelectTrigger id="ens-sexe" className="bg-background">
                    <SelectValue placeholder="Non renseigné" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Non renseigné</SelectItem>
                    <SelectItem value="M">Masculin</SelectItem>
                    <SelectItem value="F">Féminin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </GlassCard>

          {/* ─── Section : Contact ──────────────────────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="p-4">
            <FormSectionTitle icon={Phone}>Contact</FormSectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ens-tel">Téléphone</Label>
                <Input
                  id="ens-tel"
                  value={form.telephone}
                  onChange={(e) =>
                    setForm({ ...form, telephone: e.target.value })
                  }
                  placeholder="+225 07 00 00 00"
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ens-email">Email</Label>
                <Input
                  id="ens-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="prof@etablissement.ci"
                  className="bg-background"
                />
              </div>
            </div>
          </GlassCard>

          {/* ─── Section : Contrat ──────────────────────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="p-4">
            <FormSectionTitle icon={FileText}>Contrat</FormSectionTitle>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ens-contrat">Type de contrat</Label>
                <Select
                  value={form.type_contrat}
                  onValueChange={(v) =>
                    setForm({ ...form, type_contrat: v as TypeContrat })
                  }
                >
                  <SelectTrigger id="ens-contrat" className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPE_CONTRAT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ens-statut">Statut</Label>
                <Select
                  value={form.statut}
                  onValueChange={(v) =>
                    setForm({ ...form, statut: v as StatutEnseignant })
                  }
                >
                  <SelectTrigger id="ens-statut" className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ens-taux">Taux horaire par défaut (FCFA)</Label>
                <Input
                  id="ens-taux"
                  type="number"
                  min={0}
                  value={form.taux_horaire_defaut}
                  onChange={(e) =>
                    setForm({ ...form, taux_horaire_defaut: e.target.value })
                  }
                  placeholder="2500"
                  aria-invalid={submitted && !tauxValid}
                  className="bg-background"
                />
                {submitted && !tauxValid ? (
                  <p className="text-[11px] text-destructive">
                    Montant invalide.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ens-diplome">Diplôme</Label>
                <Input
                  id="ens-diplome"
                  value={form.diplome}
                  onChange={(e) => setForm({ ...form, diplome: e.target.value })}
                  placeholder="Licence, Master, CAPES…"
                  className="bg-background"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="ens-spec">Spécialité</Label>
                <Input
                  id="ens-spec"
                  value={form.specialite}
                  onChange={(e) =>
                    setForm({ ...form, specialite: e.target.value })
                  }
                  placeholder="Mathématiques, SVT…"
                  className="bg-background"
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
              "Créer l'enseignant"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog : gestion des matières d'un enseignant (premium)
// ─────────────────────────────────────────────────────────────────────────────

function EnseignantMatieresDialog({
  open,
  onOpenChange,
  enseignant,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  enseignant: Enseignant | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [matiereId, setMatiereId] = React.useState<string>("");
  const [taux, setTaux] = React.useState<string>("");

  React.useEffect(() => {
    if (!open) {
      setMatiereId("");
      setTaux("");
    }
  }, [open]);

  // Liste toutes les matières (pour le select d'ajout)
  const { data: allMatieres, isLoading: loadingMatieres } = useQuery({
    queryKey: matieresKeys.list(),
    queryFn: fetchMatieres,
    enabled: !!enseignant && open,
  });

  // Rafraîchit l'enseignant ciblé pour avoir la liste à jour de ses matières.
  // On passe par la liste filtrée par le matricule (le backend ne expose pas
  // de route GET /api/enseignants/:id dans le client API, mais la recherche
  // par matricule est unique et permet de récupérer la fiche à jour).
  const { data: refreshed, isFetching } = useQuery({
    queryKey: [...enseignantsKeys.all, "detail", enseignant?.id, open],
    queryFn: () => fetchEnseignants({ search: enseignant!.matricule }),
    enabled: !!enseignant && open,
  });

  const current = React.useMemo<Enseignant | null>(() => {
    if (!enseignant) return null;
    const list = refreshed ?? [];
    return list.find((e) => e.id === enseignant.id) ?? enseignant;
  }, [enseignant, refreshed]);

  // Matières non encore associées
  const availableMatieres = React.useMemo(() => {
    if (!allMatieres) return [];
    const associatedIds = new Set(
      (current?.matieres ?? []).map((m) => m.matiere_id),
    );
    return allMatieres.filter((m) => !associatedIds.has(m.id) && m.actif);
  }, [allMatieres, current]);

  const addMutation = useMutation({
    mutationFn: (dto: { matiere_id: string; taux_horaire: number }) =>
      addMatiereToEnseignant(enseignant!.id, {
        matiere_id: dto.matiere_id,
        taux_horaire: dto.taux_horaire,
        est_principale: false,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: enseignantsKeys.all,
      });
      await queryClient.invalidateQueries({
        queryKey: matieresKeys.all,
      });
      toast({
        title: "Matière ajoutée",
        description: "La matière a été associée à l'enseignant.",
      });
      setMatiereId("");
      setTaux("");
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible d'associer la matière.",
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (matiereId: string) =>
      removeMatiereFromEnseignant(enseignant!.id, matiereId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: enseignantsKeys.all,
      });
      toast({
        title: "Matière retirée",
        description: "La matière n'est plus associée à l'enseignant.",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de retirer la matière.",
        variant: "destructive",
      });
    },
  });

  function handleAdd() {
    if (!matiereId) {
      toast({
        title: "Sélection requise",
        description: "Choisissez une matière à associer.",
        variant: "destructive",
      });
      return;
    }
    const tauxNum = taux ? Number(taux) : 0;
    if (Number.isNaN(tauxNum) || tauxNum < 0) {
      toast({
        title: "Taux invalide",
        description: "Le taux horaire doit être un nombre positif.",
        variant: "destructive",
      });
      return;
    }
    addMutation.mutate({ matiere_id: matiereId, taux_horaire: tauxNum });
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
                Matières enseignées
              </DialogTitle>
              <DialogDescription>
                {current
                  ? `Matières de ${enseignantFullName(current)}.`
                  : "Chargement…"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ─── Liste des matières déjà associées ────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold tracking-tight text-forest">
              Matières associées
            </h3>
            {isFetching ? (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          {!current || (current.matieres ?? []).length === 0 ? (
            <p className="rounded-md border border-dashed border-muted-foreground/20 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
              Aucune matière associée.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {(current.matieres ?? []).map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-950/30"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                      <BookOpen className="size-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium leading-snug text-forest">
                        {m.matiere?.libelle ?? "Matière supprimée"}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {m.matiere?.code ?? "—"} · Taux :{" "}
                        <span className="font-mono font-semibold text-gold-dark dark:text-gold">
                          {formatFCFA(m.taux_horaire)}
                        </span>
                        /h
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0 text-destructive hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate(m.matiere_id)}
                    title="Retirer cette matière"
                    aria-label={`Retirer la matière « ${m.matiere?.libelle ?? ""} »`}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ─── Ajouter une matière ─────────────────────────────────────── */}
        <div className="space-y-2 border-t pt-4">
          <h3 className="font-display text-sm font-semibold tracking-tight text-forest">
            Associer une nouvelle matière
          </h3>
          {loadingMatieres ? (
            <Skeleton className="h-9 w-full" />
          ) : availableMatieres.length === 0 ? (
            <p className="rounded-md border border-dashed border-muted-foreground/20 bg-muted/20 px-3 py-3 text-center text-xs text-muted-foreground">
              Toutes les matières actives sont déjà associées (ou aucune matière
              n&apos;est configurée — voir la page « Matières »).
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="add-matiere">Matière</Label>
                <Select value={matiereId} onValueChange={setMatiereId}>
                  <SelectTrigger id="add-matiere" className="bg-background">
                    <SelectValue placeholder="Choisir une matière" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMatieres.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.libelle}{" "}
                        <span className="text-[10px] text-muted-foreground">
                          ({m.code})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-taux">Taux/h (FCFA)</Label>
                <Input
                  id="add-taux"
                  type="number"
                  min={0}
                  value={taux}
                  onChange={(e) => setTaux(e.target.value)}
                  placeholder="2500"
                  className="bg-background"
                />
              </div>
              <Button
                variant="success"
                onClick={handleAdd}
                disabled={addMutation.isPending}
                className="w-full sm:w-auto"
              >
                {addMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Ajouter
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Fermer
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
// Loading state premium (KentePattern strip top + 5 Skeletons)
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
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </GlassCard>
  );
}

export default EnseignantsList;
