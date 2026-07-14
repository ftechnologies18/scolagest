"use client";

/**
 * ScolaGest — Tableau de bord de l'emploi du temps (module Phase A étendue).
 *
 * Vue réservée à la direction, aux directeurs (études / superviseur) et au
 * secrétariat. Permet de :
 *  - visualiser le calendrier hebdomadaire (Lundi → Samedi) sous forme de
 *    grille horaire (desktop) ou de liste verticale par jour (mobile) ;
 *  - filtrer par classe (toutes classes ou classe spécifique) ;
 *  - créer un nouveau créneau (sélection de l'affectation prof/matière/classe,
 *    jour, horaires, salle, semaine type) ;
 *  - supprimer un créneau (avec confirmation) ;
 *  - générer les sessions de pointage du jour ou de la semaine entière.
 *
 * Lors de la création d'un créneau, le backend peut retourner des conflits
 * (PROF_CONFLIT / CLASSE_CONFLIT) — le créneau est quand même créé, mais une
 * bannière amber est affichée dans le dialog pour en avertir l'utilisateur
 * (warning, pas blocage).
 *
 * Refonte Forêt EdTech :
 *  - Hero header GlassCard desktop + KentePattern strip top + badge rond
 *    gradient emerald→gold (CalendarDays) + pill « Phase A » + pill éta-
 *    blissement emerald.
 *  - Filtre classe + boutons d'action : GlassCard adaptive + Select classe
 *    avec icône School + boutons « Générer jour » / « Générer semaine »
 *    variant outline + bouton « Nouveau créneau » variant success.
 *  - 4 StatCards DS (Total créneaux emerald / Jours actifs forest / Volume
 *    hebdo amber / Salles distinctes gold) avec stagger.
 *  - Grille horaire desktop : GlassCard adaptive noHover p-0 + en-têtes jours
 *    bg-emerald-50/60 + créneaux bordure couleur matière + pastille couleur +
 *    badges renforcés + hover lift (motion.div).
 *  - Vue mobile (liste par jour) : GlassCard mobile par jour + créneaux en
 *    cards mini avec pastille couleur + badges + bouton supprimer.
 *  - Dialog créer créneau premium : badge gradient + GlassCard tablet + selects
 *    avec icônes contextuelles + alerte conflits amber renforcée + footer
 *    grid-cols-2 + bouton submit variant success.
 *  - AlertDialog suppression premium : structure existante conservée.
 *  - Empty states premium : KentePattern bg + badges ronds colorés.
 *  - Loading state premium : Skeletons + KentePattern strip top.
 *
 * Le contexte d'établissement vient de `useAuthStore`. Si aucun établissement
 * n'est sélectionné, on invite l'utilisateur à en choisir un.
 *
 * Couleurs : emerald (primaire / succès), amber (warning / conflits / IMPAIRE),
 * rose (erreur / suppression), sky (PAIRE), slate (neutre / TOUTES). Aucune
 * couleur indigo/blue.
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query (emploiTempsKeys.calendrier /
 * affectations + classesKeys.list + anneesKeys.active + clés ["enseignants",
 * "list", { all: true, paie: true }]), mutations (genJourMutation /
 * genSemaineMutation / deleteMutation / createMutation) + invalidateQueries,
 * types CreneauEmploiTemps / CreneauDTO / JourSemaine / SemaineType /
 * ConflitInfo / AffectationCours / Classe / AnneeScolaire, constantes
 * SEMAINE_TYPE_BADGE / SEMAINE_TYPE_LABELS / CONFLIT_LABEL / JOUR_LABELS /
 * JOURS / GRID_START_HOUR / GRID_END_HOUR / HOUR_HEIGHT_PX / GRID_HEIGHT_PX /
 * MIN_CRENEAU_HEIGHT_PX (contrastes renforcés visuellement mais sémantiquement
 * identiques), helpers timeToMinutes / formatHourLabel / creneauTopPx /
 * creneauHeightPx / enseignantLabel / matiereLabel / classeLabel /
 * matiereCouleurSafe / hexToRgba, handlers et toasts conservés. Aucun endpoint
 * backend touché.
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
  CalendarRange,
  Plus,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  X,
  MapPin,
  User as UserIcon,
  Clock as ClockIcon,
  Sparkles,
  CalendarCheck,
  School,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchCalendrier,
  createCreneau,
  deleteCreneau,
  generateSessionsFromDate,
  generateSemaine,
  JOUR_LABELS,
  JOURS,
  SEMAINE_TYPE_LABELS,
  type CreneauEmploiTemps,
  type CreneauDTO,
  type JourSemaine,
  type SemaineType,
  type ConflitInfo,
} from "@/lib/api-emploi-temps";
import {
  fetchAffectations,
  type AffectationCours,
} from "@/lib/api-enseignant";
import {
  fetchClasses,
  fetchActiveAnnee,
  classesKeys,
  anneesKeys,
} from "@/lib/api-students";
import { todayISO } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
// Clés React Query
// ─────────────────────────────────────────────────────────────────────────────

export const emploiTempsKeys = {
  all: ["emploi-temps"] as const,
  calendrier: (classeId?: string) =>
    [...emploiTempsKeys.all, "calendrier", { classeId: classeId ?? null }] as const,
  affectations: (anneeScolaireId?: string) =>
    [...emploiTempsKeys.all, "affectations", { anneeScolaireId: anneeScolaireId ?? null }] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Constantes — grille horaire
// ─────────────────────────────────────────────────────────────────────────────

const GRID_START_HOUR = 7; // 07:00
const GRID_END_HOUR = 19; // 19:00
const HOUR_HEIGHT_PX = 56; // hauteur d'une heure (px)
const GRID_HEIGHT_PX = (GRID_END_HOUR - GRID_START_HOUR) * HOUR_HEIGHT_PX;
const MIN_CRENEAU_HEIGHT_PX = 36;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function creneauTopPx(heureDebut: string): number {
  const startMin = timeToMinutes(heureDebut);
  return Math.max(0, startMin - GRID_START_HOUR * 60);
}

function creneauHeightPx(heureDebut: string, heureFin: string): number {
  const start = timeToMinutes(heureDebut);
  const end = timeToMinutes(heureFin);
  return Math.max(MIN_CRENEAU_HEIGHT_PX, end - start);
}

function enseignantLabel(c?: CreneauEmploiTemps["affectation"]): string {
  const e = c?.enseignant;
  if (!e) return "—";
  return [e.prenoms, e.nom].filter(Boolean).join(" ").trim() || "—";
}

function matiereLabel(c?: CreneauEmploiTemps["affectation"]): string {
  return c?.matiere?.libelle ?? "Matière inconnue";
}

function classeLabel(c?: CreneauEmploiTemps["affectation"]): string {
  return c?.classe?.libelle ?? "—";
}

/** Valide et retourne une couleur CSS utilisable (fallback emerald). */
function matiereCouleurSafe(couleur?: string): string {
  if (!couleur) return "#10b981"; // emerald-500
  // hex 3 / 6 / 8 digits
  return /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/.test(couleur)
    ? couleur
    : "#10b981";
}

/** Convertit une couleur hex (#RRGGBB) en une variante rgba avec alpha. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.length >= 6
        ? h.slice(0, 6)
        : "10b981";
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return `rgba(16,185,129,${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Contrastes renforcés (BUG À ÉVITER #7) : border-300 bg-100 text-800.
const SEMAINE_TYPE_BADGE: Record<SemaineType, string> = {
  TOUTES:
    "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300",
  PAIRE:
    "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-200",
  IMPAIRE:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200",
};

const CONFLIT_LABEL: Record<string, string> = {
  PROF_CONFLIT: "Conflit enseignant",
  CLASSE_CONFLIT: "Conflit classe",
};

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function EmploiTempsDashboard() {
  const etablissement = useAuthStore((s) => s.etablissement);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [classeFiltre, setClasseFiltre] = React.useState<string>("all");
  const [formOpen, setFormOpen] = React.useState(false);

  const classeId = classeFiltre === "all" ? undefined : classeFiltre;

  // ─── Queries ──────────────────────────────────────────────────────────────

  const classesQuery = useQuery({
    queryKey: classesKeys.list(etablissement?.id),
    queryFn: () => fetchClasses(etablissement?.id),
    enabled: !!etablissement,
  });

  const calendrierQuery = useQuery({
    queryKey: emploiTempsKeys.calendrier(classeId),
    queryFn: () => fetchCalendrier(classeId),
    enabled: !!etablissement,
    refetchOnWindowFocus: true,
  });

  // ─── Mutations : génération de sessions ───────────────────────────────────

  const genJourMutation = useMutation({
    mutationFn: (date: string) => generateSessionsFromDate(date),
    onSuccess: (data) => {
      toast({
        title: "Sessions du jour générées",
        description: `${data.sessions_generees} session(s) créée(s) pour le ${data.date}.`,
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de générer les sessions du jour.",
        variant: "destructive",
      });
    },
  });

  const genSemaineMutation = useMutation({
    mutationFn: () => generateSemaine(),
    onSuccess: (data) => {
      toast({
        title: "Sessions de la semaine générées",
        description: `${data.sessions_generees} session(s) créée(s) pour la semaine du ${data.semaine_du}.`,
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de générer les sessions de la semaine.",
        variant: "destructive",
      });
    },
  });

  // ─── Mutation : suppression créneau ───────────────────────────────────────

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCreneau(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: emploiTempsKeys.all });
      toast({
        title: "Créneau supprimé",
        description: "Le créneau a été retiré de l'emploi du temps.",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de supprimer ce créneau.",
        variant: "destructive",
      });
    },
  });

  function handleDelete(id: string) {
    deleteMutation.mutate(id);
  }

  // ─── États ────────────────────────────────────────────────────────────────

  if (!etablissement) {
    return (
      <EmploiTempsShell>
        <EmptyState
          icon={AlertCircle}
          tone="amber"
          title="Sélectionnez un établissement"
          description="Choisissez un établissement dans la barre latérale pour gérer son emploi du temps."
        />
      </EmploiTempsShell>
    );
  }

  const calendrier = calendrierQuery.data;
  const creneauxParJour: Record<JourSemaine, CreneauEmploiTemps[]> = {
    LUNDI: [],
    MARDI: [],
    MERCREDI: [],
    JEUDI: [],
    VENDREDI: [],
    SAMEDI: [],
  };
  if (calendrier) {
    for (const j of calendrier.jours) {
      creneauxParJour[j.jour] = j.creneaux ?? [];
    }
  }
  const totalCreneaux = (calendrier?.jours ?? []).reduce(
    (acc, j) => acc + (j.creneaux?.length ?? 0),
    0,
  );

  // ─── KPIs calculés sur le calendrier ──────────────────────────────────────
  // (calcul simple, pas de useMemo : la liste reste petite — 6 jours × N
  // créneaux — et on évite un hook conditionnel après l'early return.)
  let kJoursActifs = 0;
  let kVolumeHebdo = 0;
  const kSallesSet = new Set<string>();
  for (const j of JOURS) {
    const list = creneauxParJour[j];
    if (list.length > 0) kJoursActifs += 1;
    for (const c of list) {
      kVolumeHebdo +=
        (timeToMinutes(c.heure_fin) - timeToMinutes(c.heure_debut)) / 60;
      if (c.salle) kSallesSet.add(c.salle);
    }
  }
  const kpis = {
    total: totalCreneaux,
    joursActifs: kJoursActifs,
    volumeHebdo: kVolumeHebdo,
    sallesDistinctes: kSallesSet.size,
  };

  return (
    <EmploiTempsShell
      etablissementNom={etablissement.nom}
      onNew={() => setFormOpen(true)}
      onGenJour={() => genJourMutation.mutate(todayISO())}
      onGenSemaine={() => genSemaineMutation.mutate()}
      genJourLoading={genJourMutation.isPending}
      genSemaineLoading={genSemaineMutation.isPending}
      canGenerate={totalCreneaux > 0}
    >
      {/* ─── Barre de filtre ─────────────────────────────────────────────── */}
      <GlassCard variant="adaptive" noHover noAnimation className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <CalendarRange className="size-4 text-muted-foreground" />
            <span className="font-medium">Filtrer par classe</span>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={classeFiltre}
              onValueChange={setClasseFiltre}
              disabled={classesQuery.isLoading}
            >
              <SelectTrigger
                className="w-full bg-background sm:w-64"
                aria-label="Filtrer par classe"
              >
                <School className="size-4 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Toutes les classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les classes</SelectItem>
                {(classesQuery.data ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => calendrierQuery.refetch()}
              disabled={calendrierQuery.isFetching}
              aria-label="Actualiser le calendrier"
              title="Actualiser le calendrier"
            >
              <RefreshCw
                className={cn("size-4", calendrierQuery.isFetching && "animate-spin")}
              />
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ─── 4 StatCards de résumé ────────────────────────────────────────── */}
      <section
        aria-label="Résumé de l'emploi du temps"
        className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4"
      >
        <StatCard
          icon={CalendarDays}
          tone="emerald"
          label="Total créneaux"
          value={kpis.total}
          hint={
            calendrierQuery.isLoading
              ? "chargement…"
              : "cours planifiés / semaine"
          }
          delay={0}
          className="h-full"
        />
        <StatCard
          icon={CalendarCheck}
          tone="forest"
          label="Jours actifs"
          value={kpis.joursActifs}
          hint="jours avec au moins 1 cours"
          delay={0.05}
          className="h-full"
        />
        <StatCard
          icon={ClockIcon}
          tone="amber"
          label="Volume hebdo"
          value={`${kpis.volumeHebdo.toFixed(1)} h`}
          hint="heures cumulées / semaine"
          delay={0.1}
          className="h-full"
        />
        <StatCard
          icon={MapPin}
          tone="gold"
          label="Salles distinctes"
          value={kpis.sallesDistinctes}
          hint="salles utilisées"
          delay={0.15}
          className="h-full"
        />
      </section>

      <KentePattern variant="separator" className="my-1" />

      {/* ─── Contenu : états / grille ─────────────────────────────────────── */}
      {calendrierQuery.isLoading ? (
        <LoadingState />
      ) : calendrierQuery.isError ? (
        <EmptyState
          icon={AlertCircle}
          tone="rose"
          title="Erreur de chargement"
          description={
            calendrierQuery.error instanceof Error
              ? calendrierQuery.error.message
              : "Impossible de charger l'emploi du temps. Vérifiez que le backend est démarré puis réessayez."
          }
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => calendrierQuery.refetch()}
              title="Réessayer le chargement"
            >
              <RefreshCw className="size-4" />
              Réessayer
            </Button>
          }
        />
      ) : totalCreneaux === 0 ? (
        <EmptyState
          icon={CalendarDays}
          tone="emerald"
          title="Aucun créneau défini"
          description="Cliquez sur « Nouveau créneau » pour planifier un cours. Les créneaux alimentent automatiquement le pointage et la paie."
          action={
            <Button
              onClick={() => setFormOpen(true)}
              variant="success"
              className="w-full sm:w-auto"
            >
              <Plus className="size-4" />
              Nouveau créneau
            </Button>
          }
        />
      ) : (
        <>
          <DesktopCalendarGrid
            creneauxParJour={creneauxParJour}
            onDelete={handleDelete}
            deleting={deleteMutation.isPending}
          />
          <MobileCalendarList
            creneauxParJour={creneauxParJour}
            onDelete={handleDelete}
            deleting={deleteMutation.isPending}
          />
        </>
      )}

      {/* Dialog création */}
      <NewCreneauDialog open={formOpen} onOpenChange={setFormOpen} />
    </EmploiTempsShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell — en-tête premium + actions principales
// ─────────────────────────────────────────────────────────────────────────────

interface EmploiTempsShellProps {
  children: React.ReactNode;
  etablissementNom?: string;
  onNew?: () => void;
  onGenJour?: () => void;
  onGenSemaine?: () => void;
  genJourLoading?: boolean;
  genSemaineLoading?: boolean;
  canGenerate?: boolean;
}

function EmploiTempsShell({
  children,
  etablissementNom,
  onNew,
  onGenJour,
  onGenSemaine,
  genJourLoading,
  genSemaineLoading,
  canGenerate,
}: EmploiTempsShellProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <KentePattern variant="strip" position="top" />

      {/* ─── Hero header premium ──────────────────────────────────────── */}
      <GlassCard variant="desktop" noHover premiumBorder className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Badge rond gradient emerald→gold avec icône CalendarDays */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <CalendarDays className="size-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                  Emploi du temps
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Planifiez les créneaux hebdomadaires des cours (Lundi → Samedi)
                et générez les sessions de pointage associées.
              </p>
              {etablissementNom ? (
                <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {etablissementNom}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {onGenJour ? (
              <Button
                variant="outline"
                onClick={onGenJour}
                disabled={genJourLoading || !canGenerate}
                title={
                  canGenerate
                    ? "Génère les sessions de pointage pour aujourd'hui"
                    : "Aucun créneau à générer"
                }
                className="w-full sm:w-auto"
              >
                {genJourLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CalendarCheck className="size-4" />
                )}
                <span className="hidden sm:inline">Sessions du jour</span>
                <span className="sm:hidden">Jour</span>
              </Button>
            ) : null}
            {onGenSemaine ? (
              <Button
                variant="outline"
                onClick={onGenSemaine}
                disabled={genSemaineLoading || !canGenerate}
                title={
                  canGenerate
                    ? "Génère les sessions de pointage pour la semaine courante"
                    : "Aucun créneau à générer"
                }
                className="w-full sm:w-auto"
              >
                {genSemaineLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                <span className="hidden sm:inline">Générer la semaine</span>
                <span className="sm:hidden">Semaine</span>
              </Button>
            ) : null}
            {onNew ? (
              <Button
                onClick={onNew}
                variant="success"
                className="w-full sm:w-auto"
              >
                <Plus className="size-4" />
                Nouveau créneau
              </Button>
            ) : null}
          </div>
        </div>
      </GlassCard>

      <KentePattern variant="separator" className="my-1" />

      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vue desktop — grille hebdomadaire (Lundi → Samedi)
// ─────────────────────────────────────────────────────────────────────────────

interface CalendarGridProps {
  creneauxParJour: Record<JourSemaine, CreneauEmploiTemps[]>;
  onDelete: (id: string) => void;
  deleting: boolean;
}

function DesktopCalendarGrid({
  creneauxParJour,
  onDelete,
  deleting,
}: CalendarGridProps) {
  return (
    <GlassCard
      variant="adaptive"
      noHover
      noAnimation
      premiumBorder
      className="hidden overflow-hidden p-3 sm:p-4 md:block"
    >
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[860px] gap-px"
          style={{
            gridTemplateColumns: `56px repeat(${JOURS.length}, minmax(0, 1fr))`,
          }}
        >
          {/* Coin haut-gauche */}
          <div className="border-b border-border/60 pb-2 pr-2 text-right text-[10px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
            Heures
          </div>
          {/* En-têtes des jours */}
          {JOURS.map((jour) => {
            const count = creneauxParJour[jour].length;
            return (
              <div
                key={jour}
                className="border-b border-border/60 bg-emerald-50/60 pb-2 text-center dark:bg-emerald-950/20"
              >
                <div className="font-display text-sm font-semibold text-forest">
                  {JOUR_LABELS[jour]}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {count} créneau{count > 1 ? "x" : ""}
                </div>
              </div>
            );
          })}

          {/* Colonne heures (gutter) */}
          <div className="relative" style={{ height: GRID_HEIGHT_PX }}>
            {Array.from({ length: GRID_END_HOUR - GRID_START_HOUR + 1 }).map(
              (_, i) => {
                const hour = GRID_START_HOUR + i;
                return (
                  <div
                    key={hour}
                    className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-muted-foreground"
                    style={{ top: i * HOUR_HEIGHT_PX }}
                  >
                    {formatHourLabel(hour)}
                  </div>
                );
              },
            )}
          </div>

          {/* Colonnes des jours */}
          {JOURS.map((jour) => (
            <DayColumn
              key={jour}
              jour={jour}
              creneaux={creneauxParJour[jour]}
              onDelete={onDelete}
              deleting={deleting}
            />
          ))}
        </div>
      </div>
    </GlassCard>
  );
}

function DayColumn({
  jour,
  creneaux,
  onDelete,
  deleting,
}: {
  jour: JourSemaine;
  creneaux: CreneauEmploiTemps[];
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  return (
    <div
      className="relative border-l border-border/40"
      style={{ height: GRID_HEIGHT_PX }}
      aria-label={`Créneaux du ${JOUR_LABELS[jour]}`}
    >
      {/* Lignes d'heures (marqueurs) */}
      {Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }).map((_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t border-dashed border-border/40"
          style={{ top: i * HOUR_HEIGHT_PX }}
          aria-hidden
        />
      ))}

      {/* Créneaux */}
      {creneaux.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] text-muted-foreground/60">—</span>
        </div>
      ) : (
        creneaux.map((c) => (
          <DesktopCreneauCard
            key={c.id}
            creneau={c}
            onDelete={onDelete}
            deleting={deleting}
          />
        ))
      )}
    </div>
  );
}

function DesktopCreneauCard({
  creneau,
  onDelete,
  deleting,
}: {
  creneau: CreneauEmploiTemps;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const couleur = matiereCouleurSafe(creneau.affectation?.matiere?.couleur);
  const top = creneauTopPx(creneau.heure_debut);
  const height = creneauHeightPx(creneau.heure_debut, creneau.heure_fin);

  return (
    <motion.div
      className="absolute inset-x-1 overflow-hidden rounded-md border bg-card shadow-sm"
      style={{
        top,
        height,
        borderLeftWidth: 4,
        borderLeftColor: couleur,
        backgroundColor: hexToRgba(couleur, 0.08),
      }}
      whileHover={{ y: -1, transition: { duration: 0.15 } }}
    >
      <div className="flex h-full flex-col gap-0.5 p-1.5">
        <div className="flex items-start justify-between gap-1">
          <div className="flex min-w-0 flex-1 items-start gap-1">
            {/* Pastille couleur matière */}
            <span
              className="mt-0.5 size-2 shrink-0 rounded-full"
              style={{ backgroundColor: couleur }}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="break-words text-[11px] font-semibold leading-tight text-forest">
                {matiereLabel(creneau.affectation)}
              </p>
              <p className="break-words text-[10px] text-muted-foreground">
                {classeLabel(creneau.affectation)}
              </p>
            </div>
          </div>
          <DeleteCreneauButton
            creneau={creneau}
            onDelete={onDelete}
            deleting={deleting}
            compact
          />
        </div>
        {height >= 56 ? (
          <>
            <p className="flex items-start gap-1 text-[10px] text-muted-foreground">
              <UserIcon className="mt-0.5 size-2.5 shrink-0" />
              <span className="break-words leading-tight">
                {enseignantLabel(creneau.affectation)}
              </span>
            </p>
            {creneau.salle ? (
              <p className="flex items-start gap-1 text-[10px] text-muted-foreground">
                <MapPin className="mt-0.5 size-2.5 shrink-0" />
                <span className="break-words leading-tight">{creneau.salle}</span>
              </p>
            ) : null}
            <div className="mt-auto flex items-center justify-between gap-1">
              <span className="font-mono text-[10px] font-medium tabular-nums">
                {creneau.heure_debut} – {creneau.heure_fin}
              </span>
              {creneau.semaine_type !== "TOUTES" ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "h-3.5 px-1 text-[8px] leading-none",
                    SEMAINE_TYPE_BADGE[creneau.semaine_type],
                  )}
                >
                  {creneau.semaine_type === "PAIRE" ? "P" : "I"}
                </Badge>
              ) : null}
            </div>
          </>
        ) : (
          <div className="mt-auto flex items-center justify-between gap-1">
            <span className="font-mono text-[10px] font-medium tabular-nums">
              {creneau.heure_debut}–{creneau.heure_fin}
            </span>
            {creneau.salle ? (
              <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                <MapPin className="size-2" />
                {creneau.salle}
              </span>
            ) : null}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vue mobile — liste verticale par jour (GlassCard mobile par jour)
// ─────────────────────────────────────────────────────────────────────────────

function MobileCalendarList({
  creneauxParJour,
  onDelete,
  deleting,
}: CalendarGridProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  return (
    <div className="space-y-3 md:hidden">
      {JOURS.map((jour) => {
        const creneaux = [...creneauxParJour[jour]].sort(
          (a, b) =>
            timeToMinutes(a.heure_debut) - timeToMinutes(b.heure_debut),
        );
        return (
          <GlassCard key={jour} variant="mobile" noHover noAnimation className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-display text-sm font-semibold text-forest">
                {JOUR_LABELS[jour]}
              </h3>
              <Badge
                variant="outline"
                className="tabular-nums border-emerald-300 bg-emerald-100 font-bold text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
              >
                {creneaux.length}
              </Badge>
            </div>
            {creneaux.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted/20 px-3 py-3 text-center text-xs text-muted-foreground">
                Aucun cours
              </p>
            ) : (
              <div className="space-y-2">
                {creneaux.map((c, idx) => (
                  <MobileCreneauRow
                    key={c.id}
                    creneau={c}
                    index={idx}
                    prefersReducedMotion={prefersReducedMotion}
                    onDelete={onDelete}
                    deleting={deleting}
                  />
                ))}
              </div>
            )}
          </GlassCard>
        );
      })}
    </div>
  );
}

function MobileCreneauRow({
  creneau,
  index,
  prefersReducedMotion,
  onDelete,
  deleting,
}: {
  creneau: CreneauEmploiTemps;
  index: number;
  prefersReducedMotion: boolean;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const couleur = matiereCouleurSafe(creneau.affectation?.matiere?.couleur);
  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.3,
          delay: Math.min(index * 0.03, 0.3),
          ease: [0.22, 1, 0.36, 1] as const,
        },
      };
  return (
    <motion.div
      className="rounded-md border bg-card p-2.5 shadow-sm"
      style={{
        borderLeftWidth: 4,
        borderLeftColor: couleur,
        backgroundColor: hexToRgba(couleur, 0.05),
      }}
      {...motionProps}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          {/* Pastille couleur matière */}
          <span
            className="mt-1 size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: couleur }}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <p className="break-words text-sm font-semibold leading-snug text-forest">
              {matiereLabel(creneau.affectation)}
            </p>
            <p className="break-words text-[11px] text-muted-foreground">
              {classeLabel(creneau.affectation)}
            </p>
          </div>
        </div>
        <DeleteCreneauButton
          creneau={creneau}
          onDelete={onDelete}
          deleting={deleting}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <ClockIcon className="size-3" />
          <span className="font-mono font-medium tabular-nums text-foreground">
            {creneau.heure_debut}–{creneau.heure_fin}
          </span>
        </span>
        <span className="flex items-start gap-1">
          <UserIcon className="mt-0.5 size-3" />
          <span className="break-words leading-tight">
            {enseignantLabel(creneau.affectation)}
          </span>
        </span>
        {creneau.salle ? (
          <span className="flex items-center gap-1">
            <MapPin className="size-3" />
            <span className="break-words leading-tight">{creneau.salle}</span>
          </span>
        ) : null}
        {creneau.semaine_type !== "TOUTES" ? (
          <Badge
            variant="outline"
            className={cn(
              "h-4 px-1 text-[9px] leading-none",
              SEMAINE_TYPE_BADGE[creneau.semaine_type],
            )}
          >
            {creneau.semaine_type === "PAIRE" ? "Paire" : "Impaire"}
          </Badge>
        ) : null}
      </div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bouton de suppression (avec confirmation) — AlertDialog premium conservé
// ─────────────────────────────────────────────────────────────────────────────

function DeleteCreneauButton({
  creneau,
  onDelete,
  deleting,
  compact,
}: {
  creneau: CreneauEmploiTemps;
  onDelete: (id: string) => void;
  deleting: boolean;
  compact?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "shrink-0 text-muted-foreground hover:bg-rose-100 hover:text-rose-700 dark:hover:bg-rose-950/40 dark:hover:text-rose-300",
            compact ? "size-5" : "h-11 w-11",
          )}
          title={`Supprimer le créneau de ${matiereLabel(creneau.affectation)} (${creneau.heure_debut}–${creneau.heure_fin})`}
          aria-label={`Supprimer le créneau de ${matiereLabel(creneau.affectation)} (${creneau.heure_debut}–${creneau.heure_fin})`}
          disabled={deleting}
        >
          <Trash2 className={cn(compact ? "size-3" : "size-4")} />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer ce créneau ?</AlertDialogTitle>
          <AlertDialogDescription>
            Vous êtes sur le point de supprimer le créneau de{" "}
            <span className="font-medium text-foreground">
              {matiereLabel(creneau.affectation)}
            </span>{" "}
            ({classeLabel(creneau.affectation)}) le{" "}
            <span className="font-medium text-foreground">
              {JOUR_LABELS[creneau.jour_semaine]}
            </span>{" "}
            de{" "}
            <span className="font-mono font-medium text-foreground">
              {creneau.heure_debut}
            </span>{" "}
            à{" "}
            <span className="font-mono font-medium text-foreground">
              {creneau.heure_fin}
            </span>
            . Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => onDelete(creneau.id)}
            className="bg-rose-600 text-white hover:bg-rose-700"
          >
            {deleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
            Supprimer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog — Nouveau créneau (premium avec badge gradient + sections GlassCard)
// ─────────────────────────────────────────────────────────────────────────────

interface NewCreneauFormState {
  affectation_cours_id: string;
  jour_semaine: JourSemaine;
  heure_debut: string;
  heure_fin: string;
  salle: string;
  semaine_type: SemaineType;
}

const DEFAULT_FORM: NewCreneauFormState = {
  affectation_cours_id: "",
  jour_semaine: "LUNDI",
  heure_debut: "08:00",
  heure_fin: "10:00",
  salle: "",
  semaine_type: "TOUTES",
};

function NewCreneauDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const etablissement = useAuthStore((s) => s.etablissement);

  const [form, setForm] = React.useState<NewCreneauFormState>(DEFAULT_FORM);
  const [submitted, setSubmitted] = React.useState(false);
  const [conflits, setConflits] = React.useState<ConflitInfo[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setConflits([]);
    setForm(DEFAULT_FORM);
  }, [open]);

  // Année scolaire active (pour filtrer les affectations pertinentes)
  const { data: activeAnnee, isLoading: loadingAnnee } = useQuery({
    queryKey: anneesKeys.active(),
    queryFn: fetchActiveAnnee,
    enabled: !!etablissement && open,
  });

  // Liste des affectations prof/matière/classe pour l'année active
  const { data: affectations, isLoading: loadingAffectations } = useQuery({
    queryKey: emploiTempsKeys.affectations(activeAnnee?.id),
    queryFn: () => fetchAffectations(activeAnnee!.id),
    enabled: !!activeAnnee?.id && open,
  });

  const activeAffectations = React.useMemo(
    () => (affectations ?? []).filter((a) => a.actif !== false),
    [affectations],
  );

  // ─── Mutation création ────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (dto: CreneauDTO) => createCreneau(dto),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: emploiTempsKeys.all });
      if (result.conflits && result.conflits.length > 0) {
        setConflits(result.conflits);
        toast({
          title: "⚠️ Créneau créé avec conflits",
          description: `${result.conflits.length} conflit(s) détecté(s) — voir le détail dans le formulaire.`,
        });
      } else {
        toast({
          title: "Créneau créé",
          description: `Le créneau du ${JOUR_LABELS[result.creneau.jour_semaine]} ${result.creneau.heure_debut}–${result.creneau.heure_fin} a été ajouté.`,
        });
        onOpenChange(false);
      }
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de créer le créneau.",
        variant: "destructive",
      });
    },
  });

  // ─── Validation ───────────────────────────────────────────────────────────

  const affValid = form.affectation_cours_id !== "";
  const horairesValid =
    timeToMinutes(form.heure_fin) > timeToMinutes(form.heure_debut);
  const formValid = affValid && horairesValid;

  function handleSave() {
    setSubmitted(true);
    setConflits([]);
    if (!formValid) return;
    const dto: CreneauDTO = {
      affectation_cours_id: form.affectation_cours_id,
      jour_semaine: form.jour_semaine,
      heure_debut: form.heure_debut,
      heure_fin: form.heure_fin,
      salle: form.salle.trim() || undefined,
      semaine_type: form.semaine_type,
    };
    createMutation.mutate(dto);
  }

  const selectedAffectation = activeAffectations.find(
    (a) => a.id === form.affectation_cours_id,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-md shadow-emerald-900/20">
              <CalendarDays className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="font-display text-lg font-bold tracking-tight text-forest">
                Nouveau créneau
              </DialogTitle>
              <DialogDescription>
                Planifiez un cours récurrent dans l&apos;emploi du temps. Les
                conflits (enseignant ou classe déjà occupés) sont signalés sans
                bloquer la création.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Affectation (prof / matière / classe) */}
          <div className="space-y-1.5">
            <Label htmlFor="et-aff">
              Affectation (prof / matière / classe){" "}
              <span className="text-destructive">*</span>
            </Label>
            {loadingAnnee || loadingAffectations ? (
              <Skeleton className="h-9 w-full" />
            ) : activeAffectations.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Aucune affectation active. Créez d&apos;abord une affectation
                (page « Affectations ») avant de planifier un créneau.
              </p>
            ) : (
              <Select
                value={form.affectation_cours_id}
                onValueChange={(v) =>
                  setForm({ ...form, affectation_cours_id: v })
                }
              >
                <SelectTrigger
                  id="et-aff"
                  aria-invalid={submitted && !affValid}
                  className="bg-background"
                >
                  <SelectValue placeholder="Choisir une affectation" />
                </SelectTrigger>
                <SelectContent>
                  {activeAffectations.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <AffectationLabel affectation={a} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {selectedAffectation ? (
              <p className="break-words text-[11px] leading-snug text-muted-foreground">
                {selectedAffectation.enseignant
                  ? [
                      selectedAffectation.enseignant.prenoms,
                      selectedAffectation.enseignant.nom,
                    ]
                      .filter(Boolean)
                      .join(" ")
                      .trim()
                  : "—"}{" "}
                · {selectedAffectation.matiere?.libelle ?? "—"} ·{" "}
                {selectedAffectation.classe?.libelle ?? "—"}
              </p>
            ) : null}
            {submitted && !affValid ? (
              <p className="text-[11px] text-destructive">
                Sélectionnez une affectation.
              </p>
            ) : null}
          </div>

          {/* Jour */}
          <div className="space-y-1.5">
            <Label htmlFor="et-jour">
              Jour <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.jour_semaine}
              onValueChange={(v) =>
                setForm({ ...form, jour_semaine: v as JourSemaine })
              }
            >
              <SelectTrigger id="et-jour" className="bg-background">
                <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JOURS.map((j) => (
                  <SelectItem key={j} value={j}>
                    {JOUR_LABELS[j]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Horaires */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="et-hd">
                Heure début <span className="text-destructive">*</span>
              </Label>
              <Input
                id="et-hd"
                type="time"
                value={form.heure_debut}
                onChange={(e) =>
                  setForm({ ...form, heure_debut: e.target.value })
                }
                aria-invalid={submitted && !horairesValid}
                className="bg-background"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="et-hf">
                Heure fin <span className="text-destructive">*</span>
              </Label>
              <Input
                id="et-hf"
                type="time"
                value={form.heure_fin}
                onChange={(e) =>
                  setForm({ ...form, heure_fin: e.target.value })
                }
                aria-invalid={submitted && !horairesValid}
                className="bg-background"
              />
            </div>
          </div>
          {submitted && !horairesValid ? (
            <p className="-mt-2 text-[11px] text-destructive">
              L&apos;heure de fin doit être après l&apos;heure de début.
            </p>
          ) : null}

          {/* Salle */}
          <div className="space-y-1.5">
            <Label htmlFor="et-salle">Salle</Label>
            <Input
              id="et-salle"
              type="text"
              value={form.salle}
              onChange={(e) => setForm({ ...form, salle: e.target.value })}
              placeholder="Ex : Salle 12, Labo A…"
              maxLength={80}
              className="bg-background"
            />
          </div>

          {/* Semaine type */}
          <div className="space-y-1.5">
            <Label htmlFor="et-semaine">Semaine type</Label>
            <Select
              value={form.semaine_type}
              onValueChange={(v) =>
                setForm({ ...form, semaine_type: v as SemaineType })
              }
            >
              <SelectTrigger id="et-semaine" className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SEMAINE_TYPE_LABELS) as SemaineType[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {SEMAINE_TYPE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="break-words text-[11px] leading-snug text-muted-foreground">
              Le créneau sera planifié toutes les semaines, ou seulement les
              semaines paires / impaires.
            </p>
          </div>

          {/* Bannière conflits (warning, pas blocage) */}
          {conflits.length > 0 ? (
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-100/80 p-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">
                    Créneau créé — {conflits.length} conflit(s) détecté(s)
                  </p>
                  <p className="break-words text-xs leading-snug">
                    Le créneau a été enregistré, mais il chevauche des créneaux
                    existants. Vérifiez la cohérence du planning.
                  </p>
                </div>
              </div>
              <ul className="ml-6 space-y-1 text-xs">
                {conflits.map((c, i) => (
                  <li
                    key={`${c.creneau_id_existant}-${i}`}
                    className="flex flex-col gap-0.5"
                  >
                    <span className="font-medium">
                      {CONFLIT_LABEL[c.type] ?? c.type}
                    </span>
                    <span className="break-words leading-snug text-amber-800 dark:text-amber-300">
                      {c.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={createMutation.isPending}
            className="w-full sm:w-auto"
          >
            <X className="size-4" />
            {conflits.length > 0 ? "Fermer" : "Annuler"}
          </Button>
          <Button
            onClick={handleSave}
            disabled={createMutation.isPending}
            variant="success"
            className="w-full sm:w-auto"
          >
            {createMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Créer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Affiche le libellé d'une affectation dans un SelectItem. */
function AffectationLabel({ affectation }: { affectation: AffectationCours }) {
  const ens = affectation.enseignant;
  const ensLabel = ens
    ? [ens.prenoms, ens.nom].filter(Boolean).join(" ").trim()
    : "—";
  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5">
      <span className="font-medium">{affectation.matiere?.libelle ?? "—"}</span>
      <span className="text-[10px] text-muted-foreground">
        {ensLabel} · {affectation.classe?.libelle ?? "—"}
      </span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// États vides premium (KentePattern bg + badge rond coloré + icône Lucide)
// ─────────────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: LucideIcon;
  tone: "emerald" | "amber" | "rose";
  title: string;
  description: string;
  action?: React.ReactNode;
}

function EmptyState({ icon: Icon, tone, title, description, action }: EmptyStateProps) {
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
// Loading state premium (KentePattern strip top + Skeletons)
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
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    </GlassCard>
  );
}

export default EmploiTempsDashboard;
