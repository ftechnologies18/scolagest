"use client";

/**
 * ScolaGest — Écran de pointage temps réel (module Phase B).
 *
 * Vue réservée au secrétariat / direction / directeurs. Affiche la grille des
 * sessions de cours du jour avec leur statut de pointage (VERT / JAUNE / ROUGE
 * / ORANGE) et permet la régularisation manuelle (validation forcée) d'une
 * session qui n'a pas reçu de pointage GPS valide.
 *
 * Fonctionnalités :
 *  - Bouton « Générer les sessions du jour » → POST /api/pointage/generate-sessions
 *    puis rafraîchissement de la grille.
 *  - Grille temps réel des sessions (polling 30 s via `refetchInterval`).
 *  - Chaque session = une carte avec code couleur de bordure selon
 *    `statut_affichage`, heure début/fin, matière (libellé + pastille couleur),
 *    classe, salle, nom de l'enseignant, badge de statut.
 *    • ORANGE → bouton « Valider manuellement » (POST /api/pointage/:id/valider).
 *    • ROUGE + cours commencé → badge « ABSENT » clignotant.
 *  - Filtre par statut (tous / vert / rouge / orange).
 *  - Bouton « Actualiser » manuel.
 *  - États : chargement (skeletons), erreur, vide (avec CTA « Générer »).
 *
 * Le contexte d'établissement vient de `useAuthStore`. Si aucun établissement
 * n'est sélectionné, on invite l'utilisateur à en choisir un.
 */

import * as React from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Clock,
  RefreshCw,
  Sparkles,
  AlertCircle,
  MapPin,
  GraduationCap,
  User,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Hourglass,
  Loader2,
  CalendarDays,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchSessionsEcran,
  generateSessions,
  validePointageManuel,
  type SessionAvecStatut,
  type StatutAffichage,
} from "@/lib/api-pointage";
import { formatDate, todayISO } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
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

// ─────────────────────────────────────────────────────────────────────────────
// Clés React Query
// ─────────────────────────────────────────────────────────────────────────────

export const pointageKeys = {
  all: ["pointage"] as const,
  ecran: (date: string) => [...pointageKeys.all, "ecran", date] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers d'affichage
// ─────────────────────────────────────────────────────────────────────────────

const STATUT_LABEL: Record<StatutAffichage, string> = {
  VERT: "Présent (validé)",
  JAUNE: "En attente de synchro",
  ROUGE: "Absent",
  ORANGE: "Validation requise",
};

const STATUT_ICO: Record<StatutAffichage, typeof CheckCircle2> = {
  VERT: CheckCircle2,
  JAUNE: Hourglass,
  ROUGE: XCircle,
  ORANGE: AlertTriangle,
};

/** Bordure de carte selon le statut (couleur Tailwind, pas d'indigo/blue). */
const STATUT_BORDER: Record<StatutAffichage, string> = {
  VERT:
    "border-l-emerald-500 dark:border-l-emerald-400",
  JAUNE:
    "border-l-amber-500 dark:border-l-amber-400",
  ROUGE:
    "border-l-rose-500 dark:border-l-rose-400",
  ORANGE:
    "border-l-orange-500 dark:border-l-orange-400",
};

const STATUT_BADGE: Record<StatutAffichage, string> = {
  VERT:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  JAUNE:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  ROUGE:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
  ORANGE:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300",
};

/**
 * Détermine si un cours a démarré (heure_debut ≤ maintenant ≤ heure_fin),
 * en combinant `date_cours` (YYYY-MM-DD) et `heure_debut` (HH:MM:SS).
 */
function coursCommence(session: SessionAvecStatut): boolean {
  try {
    const debut = new Date(`${session.date_cours}T${session.heure_debut}`);
    const fin = new Date(`${session.date_cours}T${session.heure_fin}`);
    const now = new Date();
    return now >= debut && now <= fin;
  } catch {
    return false;
  }
}

function formatHeure(h: string | null | undefined): string {
  if (!h) return "—";
  // Heure déjà au format HH:MM:SS ou HH:MM → on tronque à HH:MM
  const parts = h.split(":");
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return h;
}

function eleveOuEnseignantNom(
  session: SessionAvecStatut,
): string {
  // L'écran de pointage suit les enseignants (Phase B : pointage enseignant).
  // Le nom du prof n'est pas dans le type SessionCours mais on l'affichera si
  // présent via une extension future. On affiche un fallback propre sinon.
  const ens = (session as unknown as {
    enseignant?: { nom?: string; prenoms?: string };
    enseignant_nom?: string;
    enseignant_prenoms?: string;
  });
  if (ens.enseignant) {
    return [ens.enseignant.prenoms, ens.enseignant.nom]
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  if (ens.enseignant_nom || ens.enseignant_prenoms) {
    return [ens.enseignant_prenoms, ens.enseignant_nom]
      .filter(Boolean)
      .join(" ")
      .trim();
  }
  return "—";
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function EcranPointage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const etablissement = useAuthStore((s) => s.etablissement);

  const [today] = React.useState(() => todayISO());
  const [filtre, setFiltre] = React.useState<StatutAffichage | "all">("all");

  // ─── Requête temps réel (polling 30 s) ──────────────────────────────────
  const {
    data: sessions,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: pointageKeys.ecran(today),
    queryFn: () => fetchSessionsEcran(today),
    enabled: !!etablissement,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  // ─── Mutation : générer les sessions du jour ────────────────────────────
  const generateMutation = useMutation({
    mutationFn: () => generateSessions(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: pointageKeys.all });
      toast({
        title: "Sessions générées",
        description:
          "Les sessions de cours du jour ont été (re)générées avec succès.",
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

  // ─── Mutation : validation manuelle (régularisation) ───────────────────
  const validerMutation = useMutation({
    mutationFn: (id: string) => validePointageManuel(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: pointageKeys.all });
      toast({
        title: "Pointage validé",
        description:
          "Le pointage a été régularisé manuellement. La session passe au vert.",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de valider ce pointage.",
        variant: "destructive",
      });
    },
  });

  // ─── Filtrage local par statut ──────────────────────────────────────────
  const sessionsFiltrees = React.useMemo(() => {
    const liste = sessions ?? [];
    if (filtre === "all") return liste;
    return liste.filter((s) => s.statut_affichage === filtre);
  }, [sessions, filtre]);

  // Compteurs rapides par statut (pour les pastilles du filtre)
  const compteurs = React.useMemo(() => {
    const liste = sessions ?? [];
    return {
      total: liste.length,
      vert: liste.filter((s) => s.statut_affichage === "VERT").length,
      jaune: liste.filter((s) => s.statut_affichage === "JAUNE").length,
      rouge: liste.filter((s) => s.statut_affichage === "ROUGE").length,
      orange: liste.filter((s) => s.statut_affichage === "ORANGE").length,
    };
  }, [sessions]);

  // ─── États ──────────────────────────────────────────────────────────────
  if (!etablissement) {
    return (
      <EcranPointageShell>
        <EmptyState
          icon={AlertCircle}
          tone="amber"
          title="Sélectionnez un établissement"
          description="Choisissez un établissement dans la barre latérale pour accéder à l'écran de pointage."
        />
      </EcranPointageShell>
    );
  }

  return (
    <EcranPointageShell
      headerRight={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Actualiser"
          >
            <RefreshCw
              className={cn("size-4", isFetching && "animate-spin")}
            />
            <span className="hidden sm:inline">Actualiser</span>
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {generateMutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Sparkles className="size-4" />
            )}
            <span className="hidden sm:inline">Générer les sessions du jour</span>
            <span className="sm:hidden">Générer</span>
          </Button>
        </>
      }
    >
      {/* Bandeau date + filtre */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="size-4 text-muted-foreground" />
            <span className="font-medium capitalize">
              {formatDate(today)}
            </span>
            <Badge variant="outline" className="ml-1">
              {compteurs.total} session{compteurs.total > 1 ? "s" : ""}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatutChip
              active={filtre === "all"}
              onClick={() => setFiltre("all")}
              label="Tous"
              count={compteurs.total}
              tone="slate"
            />
            <StatutChip
              active={filtre === "VERT"}
              onClick={() => setFiltre("VERT")}
              label="Présents"
              count={compteurs.vert}
              tone="emerald"
            />
            <StatutChip
              active={filtre === "ORANGE"}
              onClick={() => setFiltre("ORANGE")}
              label="À valider"
              count={compteurs.orange}
              tone="orange"
            />
            <StatutChip
              active={filtre === "ROUGE"}
              onClick={() => setFiltre("ROUGE")}
              label="Absents"
              count={compteurs.rouge}
              tone="rose"
            />
            <StatutChip
              active={filtre === "JAUNE"}
              onClick={() => setFiltre("JAUNE")}
              label="En attente"
              count={compteurs.jaune}
              tone="amber"
            />
          </div>
          <div className="sm:hidden">
            <Select
              value={filtre}
              onValueChange={(v) => setFiltre(v as StatutAffichage | "all")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Filtrer par statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="VERT">Présents (vert)</SelectItem>
                <SelectItem value="ORANGE">À valider (orange)</SelectItem>
                <SelectItem value="ROUGE">Absents (rouge)</SelectItem>
                <SelectItem value="JAUNE">En attente (jaune)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Contenu : grille / skeletons / empty / error */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
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
              : "Impossible de charger les sessions. Vérifiez que le backend est démarré puis réessayez."
          }
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
            >
              <RefreshCw className="size-4" />
              Réessayer
            </Button>
          }
        />
      ) : sessionsFiltrees.length === 0 ? (
        // Empty : si aucune session du tout → CTA générer ; sinon juste vide
        (sessions ?? []).length === 0 ? (
          <EmptyState
            icon={Clock}
            tone="emerald"
            title="Aucune session pour aujourd'hui"
            description="Générez les sessions de cours du jour à partir de l'emploi du temps. Vous pourrez ensuite suivre le pointage en temps réel."
            action={
              <Button
                size="sm"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Générer les sessions du jour
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={Clock}
            tone="slate"
            title="Aucune session ne correspond au filtre"
            description="Modifiez le filtre de statut pour voir d'autres sessions."
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sessionsFiltrees.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              onValider={() => validerMutation.mutate(s.id)}
              isValiding={
                validerMutation.isPending &&
                validerMutation.variables === s.id
              }
            />
          ))}
        </div>
      )}
    </EcranPointageShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

interface EcranPointageShellProps {
  children: React.ReactNode;
  headerRight?: React.ReactNode;
}

function EcranPointageShell({
  children,
  headerRight,
}: EcranPointageShellProps) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Clock className="size-6 text-emerald-600" />
            Écran de pointage
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suivi temps réel des pointages enseignants · rafraîchissement
            automatique toutes les 30 secondes.
          </p>
        </div>
        {headerRight ? (
          <div className="flex items-center gap-2">{headerRight}</div>
        ) : null}
      </header>
      {children}
    </div>
  );
}

interface SessionCardProps {
  session: SessionAvecStatut;
  onValider: () => void;
  isValiding: boolean;
}

function SessionCard({ session, onValider, isValiding }: SessionCardProps) {
  const statut = session.statut_affichage;
  const StatutIco = STATUT_ICO[statut];
  const matiere = session.affectation?.matiere;
  const classe = session.affectation?.classe;
  const absentEnCours = statut === "ROUGE" && coursCommence(session);

  return (
    <Card
      className={cn(
        "relative overflow-hidden border-l-4 transition-shadow hover:shadow-md",
        STATUT_BORDER[statut],
      )}
    >
      <CardContent className="flex flex-col gap-3 p-4">
        {/* En-tête : heure + statut */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col">
            <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
              <Clock className="size-3.5 text-muted-foreground" />
              {formatHeure(session.heure_debut)} – {formatHeure(session.heure_fin)}
            </span>
            <span className="mt-0.5 text-xs text-muted-foreground">
              Salle {session.salle || "—"}
            </span>
          </div>
          <Badge
            variant="outline"
            className={cn("gap-1 font-medium", STATUT_BADGE[statut])}
          >
            <StatutIco className="size-3" />
            {STATUT_LABEL[statut]}
          </Badge>
        </div>

        {/* Matière + classe */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-3 shrink-0 rounded-full border border-black/10"
              style={{
                backgroundColor: matiere?.couleur || "#94a3b8",
              }}
            />
            <span className="line-clamp-1 text-sm font-medium">
              {matiere?.libelle || "Matière inconnue"}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GraduationCap className="size-3.5" />
            <span className="line-clamp-1">
              {classe?.libelle || "Classe inconnue"}
            </span>
          </div>
        </div>

        {/* Enseignant */}
        <div className="flex items-center gap-1.5 text-xs">
          <User className="size-3.5 text-muted-foreground" />
          <span className="line-clamp-1 font-medium">
            {eleveOuEnseignantNom(session)}
          </span>
        </div>

        {/* Salle (mobile, redondant sur desktop) */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground sm:hidden">
          <MapPin className="size-3.5" />
          <span className="line-clamp-1">{session.salle || "—"}</span>
        </div>

        {/* Pied : action / badge */}
        <div className="mt-1 flex items-center justify-between gap-2 border-t pt-3">
          {statut === "ORANGE" ? (
            <Button
              type="button"
              size="sm"
              onClick={onValider}
              disabled={isValiding}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {isValiding ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3.5" />
              )}
              Valider manuellement
            </Button>
          ) : absentEnCours ? (
            <Badge
              variant="outline"
              className="animate-pulse border-rose-300 bg-rose-100 font-bold uppercase tracking-wide text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/60 dark:text-rose-300"
            >
              <XCircle className="size-3" />
              Absent
            </Badge>
          ) : (
            <span className="text-xs text-muted-foreground">
              {coursCommence(session)
                ? "Cours en cours"
                : session.statut === "TERMINEE"
                  ? "Cours terminé"
                  : "Cours à venir"}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface StatutChipProps {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone: "emerald" | "amber" | "rose" | "orange" | "slate";
}

function StatutChip({
  active,
  onClick,
  label,
  count,
  tone,
}: StatutChipProps) {
  const toneCls: Record<StatutChipProps["tone"], string> = {
    emerald:
      "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber:
      "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
    rose:
      "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
    orange:
      "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300",
    slate:
      "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
        toneCls[tone],
        active && "ring-2 ring-offset-1 ring-emerald-500/40",
      )}
    >
      <span>{label}</span>
      <span className="rounded-full bg-white/60 px-1.5 text-[10px] font-bold tabular-nums dark:bg-black/30">
        {count}
      </span>
    </button>
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
  rose:
    "border-rose-200 bg-rose-50/60 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300",
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
