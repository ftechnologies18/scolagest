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
 * Le contexte d'établissement vient de `useAuthStore`. Si aucun établissement
 * n'est sélectionné, on invite l'utilisateur à en choisir un.
 *
 * Couleurs : emerald (primaire / succès), amber (warning / conflits / IMPAIRE),
 * rose (erreur / suppression), sky (PAIRE), slate (neutre / TOUTES). Aucune
 * couleur indigo/blue.
 */

import * as React from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
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

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
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

const SEMAINE_TYPE_BADGE: Record<SemaineType, string> = {
  TOUTES:
    "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300",
  PAIRE:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300",
  IMPAIRE:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
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

  return (
    <EmploiTempsShell
      onNew={() => setFormOpen(true)}
      onGenJour={() => genJourMutation.mutate(todayISO())}
      onGenSemaine={() => genSemaineMutation.mutate()}
      genJourLoading={genJourMutation.isPending}
      genSemaineLoading={genSemaineMutation.isPending}
      canGenerate={totalCreneaux > 0}
    >
      {/* Barre de filtre */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
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
              <SelectTrigger className="w-full sm:w-64">
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
            >
              <RefreshCw
                className={cn("size-4", calendrierQuery.isFetching && "animate-spin")}
              />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contenu : états / grille */}
      {calendrierQuery.isLoading ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </CardContent>
        </Card>
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
              className="bg-emerald-600 text-white hover:bg-emerald-700"
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
// Shell — en-tête + actions principales
// ─────────────────────────────────────────────────────────────────────────────

interface EmploiTempsShellProps {
  children: React.ReactNode;
  onNew?: () => void;
  onGenJour?: () => void;
  onGenSemaine?: () => void;
  genJourLoading?: boolean;
  genSemaineLoading?: boolean;
  canGenerate?: boolean;
}

function EmploiTempsShell({
  children,
  onNew,
  onGenJour,
  onGenSemaine,
  genJourLoading,
  genSemaineLoading,
  canGenerate,
}: EmploiTempsShellProps) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <CalendarDays className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Emploi du temps</h1>
            <p className="text-sm text-muted-foreground">
              Planifiez les créneaux hebdomadaires des cours (Lundi → Samedi) et
              générez les sessions de pointage associées.
            </p>
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
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Plus className="size-4" />
              Nouveau créneau
            </Button>
          ) : null}
        </div>
      </header>
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
    <Card className="hidden md:block">
      <CardContent className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[860px] gap-px"
            style={{
              gridTemplateColumns: `56px repeat(${JOURS.length}, minmax(0, 1fr))`,
            }}
          >
            {/* Coin haut-gauche */}
            <div className="border-b border-border/60 pb-2 pr-2 text-right text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Heures
            </div>
            {/* En-têtes des jours */}
            {JOURS.map((jour) => {
              const count = creneauxParJour[jour].length;
              return (
                <div
                  key={jour}
                  className="border-b border-border/60 pb-2 text-center"
                >
                  <div className="text-sm font-semibold">{JOUR_LABELS[jour]}</div>
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
      </CardContent>
    </Card>
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
          <span className="text-[10px] text-muted-foreground/60">
            —
          </span>
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
    <div
      className="absolute inset-x-1 overflow-hidden rounded-md border bg-card shadow-sm transition-shadow hover:shadow-md"
      style={{
        top,
        height,
        borderLeftWidth: 4,
        borderLeftColor: couleur,
        backgroundColor: hexToRgba(couleur, 0.08),
      }}
    >
      <div className="flex h-full flex-col gap-0.5 p-1.5">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold leading-tight">
              {matiereLabel(creneau.affectation)}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {classeLabel(creneau.affectation)}
            </p>
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
            <p className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
              <UserIcon className="size-2.5 shrink-0" />
              <span className="truncate">
                {enseignantLabel(creneau.affectation)}
              </span>
            </p>
            {creneau.salle ? (
              <p className="flex items-center gap-1 truncate text-[10px] text-muted-foreground">
                <MapPin className="size-2.5 shrink-0" />
                <span className="truncate">{creneau.salle}</span>
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vue mobile — liste verticale par jour
// ─────────────────────────────────────────────────────────────────────────────

function MobileCalendarList({
  creneauxParJour,
  onDelete,
  deleting,
}: CalendarGridProps) {
  return (
    <div className="space-y-3 md:hidden">
      {JOURS.map((jour) => {
        const creneaux = [...creneauxParJour[jour]].sort(
          (a, b) =>
            timeToMinutes(a.heure_debut) - timeToMinutes(b.heure_debut),
        );
        return (
          <Card key={jour}>
            <CardContent className="p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">{JOUR_LABELS[jour]}</h3>
                <Badge
                  variant="outline"
                  className="font-bold tabular-nums"
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
                  {creneaux.map((c) => (
                    <MobileCreneauRow
                      key={c.id}
                      creneau={c}
                      onDelete={onDelete}
                      deleting={deleting}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function MobileCreneauRow({
  creneau,
  onDelete,
  deleting,
}: {
  creneau: CreneauEmploiTemps;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const couleur = matiereCouleurSafe(creneau.affectation?.matiere?.couleur);
  return (
    <div
      className="rounded-md border bg-card p-2.5 shadow-sm"
      style={{
        borderLeftWidth: 4,
        borderLeftColor: couleur,
        backgroundColor: hexToRgba(couleur, 0.05),
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {matiereLabel(creneau.affectation)}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {classeLabel(creneau.affectation)}
          </p>
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
        <span className="flex items-center gap-1">
          <UserIcon className="size-3" />
          <span className="truncate">{enseignantLabel(creneau.affectation)}</span>
        </span>
        {creneau.salle ? (
          <span className="flex items-center gap-1">
            <MapPin className="size-3" />
            <span className="truncate">{creneau.salle}</span>
          </span>
        ) : null}
        {creneau.semaine_type !== "TOUTES" ? (
          <Badge
            variant="outline"
            className={cn("h-4 px-1 text-[9px] leading-none", SEMAINE_TYPE_BADGE[creneau.semaine_type])}
          >
            {creneau.semaine_type === "PAIRE" ? "Paire" : "Impaire"}
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bouton de suppression (avec confirmation)
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
            compact ? "size-5" : "size-8",
          )}
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
// Dialog — Nouveau créneau
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
          <DialogTitle>Nouveau créneau</DialogTitle>
          <DialogDescription>
            Planifiez un cours récurrent dans l'emploi du temps. Les conflits
            (enseignant ou classe déjà occupés) sont signalés sans bloquer la
            création.
          </DialogDescription>
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
                <SelectTrigger id="et-aff" aria-invalid={submitted && !affValid}>
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
              <p className="text-[11px] text-muted-foreground">
                {selectedAffectation.enseignant
                  ? [selectedAffectation.enseignant.prenoms, selectedAffectation.enseignant.nom]
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
              <SelectTrigger id="et-jour">
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
              <SelectTrigger id="et-semaine">
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
            <p className="text-[11px] text-muted-foreground">
              Le créneau sera planifié toutes les semaines, ou seulement les
              semaines paires / impaires.
            </p>
          </div>

          {/* Bannière conflits (warning, pas blocage) */}
          {conflits.length > 0 ? (
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50/80 p-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">
                    Créneau créé — {conflits.length} conflit(s) détecté(s)
                  </p>
                  <p className="text-xs">
                    Le créneau a été enregistré, mais il chevauche des créneaux
                    existants. Vérifiez la cohérence du planning.
                  </p>
                </div>
              </div>
              <ul className="ml-6 space-y-1 text-xs">
                {conflits.map((c, i) => (
                  <li key={`${c.creneau_id_existant}-${i}`} className="flex flex-col gap-0.5">
                    <span className="font-medium">
                      {CONFLIT_LABEL[c.type] ?? c.type}
                    </span>
                    <span className="text-amber-800 dark:text-amber-300">
                      {c.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
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
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
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
// États vides / erreur partagés
// ─────────────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: typeof AlertCircle;
  tone: "emerald" | "amber" | "rose" | "slate";
  title: string;
  description: string;
  action?: React.ReactNode;
}

const EMPTY_TONE: Record<EmptyStateProps["tone"], string> = {
  emerald:
    "border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
  amber:
    "border-amber-200 bg-amber-50/60 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
  rose: "border-rose-200 bg-rose-50/60 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300",
  slate:
    "border-slate-200 bg-slate-50/60 text-slate-700 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
};

function EmptyState({ icon: Icon, tone, title, description, action }: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed", EMPTY_TONE[tone])}>
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-full",
            EMPTY_TONE[tone],
          )}
        >
          <Icon className="size-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        {action ? <div className="mt-2">{action}</div> : null}
      </CardContent>
    </Card>
  );
}

export default EmploiTempsDashboard;
