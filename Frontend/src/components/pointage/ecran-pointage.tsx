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
 * Refonte Forêt EdTech :
 *  - Hero header GlassCard desktop + KentePattern strip top + badge rond
 *    gradient emerald→gold (Clock) + pill « Phase B » outline + boutons
 *    Actualiser / Générer (variant success).
 *  - 4 StatCards DS (emerald / forest / amber / terracotta) avec stagger.
 *  - Bandeau filtre : GlassCard adaptive + chips renforcés (border-300 bg-100
 *    text-800) + Select mobile.
 *  - SessionCard : GlassCard adaptive AVEC hover lift + bordure gauche colorée
 *    selon statut + motion.div stagger + pastille matière + badges renforcés
 *    + bouton « Valider manuellement » variant success.
 *  - Empty states premium : KentePattern bg + badges ronds colorés + bouton
 *    Générer variant success.
 *  - Loading state premium : Skeletons + KentePattern strip top.
 *
 * Le contexte d'établissement vient de `useAuthStore`. Si aucun établissement
 * n'est sélectionné, on invite l'utilisateur à en choisir un.
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query (pointageKeys.ecran / fetch-
 * SessionsEcran / generateSessions / validePointageManuel / refetchInterval
 * 30s / refetchOnWindowFocus), types SessionAvecStatut / StatutAffichage,
 * mutations (generateMutation / validerMutation) + invalidateQueries, handlers
 * et toasts conservés, constantes STATUT_LABEL / STATUT_ICO / STATUT_BORDER /
 * STATUT_BADGE (contrastes renforcés visuellement mais sémantiquement
 * identiques), helpers coursCommence / formatHeure / eleveOuEnseignantNom.
 * Aucun endpoint backend touché.
 */

import * as React from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { motion } from "framer-motion";
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
  type LucideIcon,
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
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { StatCard } from "@/components/ds/stat-card";

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

// Contrast renforcé (BUG À ÉVITER #7) : border-300 bg-100 text-800.
const STATUT_BADGE: Record<StatutAffichage, string> = {
  VERT:
    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200",
  JAUNE:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200",
  ROUGE:
    "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200",
  ORANGE:
    "border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-800/60 dark:bg-orange-950/50 dark:text-orange-200",
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

  // Compteurs rapides par statut (pour les pastilles du filtre + StatCards)
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
      etablissementNom={etablissement.nom}
      headerRight={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Actualiser"
            title="Actualiser l'écran de pointage"
            className="w-full sm:w-auto"
          >
            <RefreshCw
              className={cn("size-4", isFetching && "animate-spin")}
            />
            <span className="hidden sm:inline">Actualiser</span>
          </Button>
          <Button
            type="button"
            variant="success"
            size="sm"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            title="Générer les sessions de cours du jour à partir de l'emploi du temps"
            className="w-full sm:w-auto"
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
      {/* ─── 4 StatCards de résumé ────────────────────────────────────────── */}
      <section
        aria-label="Résumé des pointages"
        className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4"
      >
        <StatCard
          icon={Clock}
          tone="emerald"
          label="Total sessions"
          value={compteurs.total}
          hint={isLoading ? "chargement…" : "session(s) aujourd'hui"}
          delay={0}
          className="h-full"
        />
        <StatCard
          icon={CheckCircle2}
          tone="forest"
          label="Présents"
          value={compteurs.vert}
          hint="pointages validés"
          delay={0.05}
          className="h-full"
        />
        <StatCard
          icon={AlertTriangle}
          tone="amber"
          label="À valider"
          value={compteurs.orange}
          hint="régularisation requise"
          delay={0.1}
          className="h-full"
        />
        <StatCard
          icon={XCircle}
          tone="terracotta"
          label="Absents"
          value={compteurs.rouge}
          hint="sans pointage valide"
          delay={0.15}
          className="h-full"
        />
      </section>

      <KentePattern variant="separator" className="my-1" />

      {/* ─── Bandeau date + filtre ─────────────────────────────────────────── */}
      <GlassCard variant="adaptive" noHover noAnimation className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <CalendarDays className="size-4 text-muted-foreground" />
            <span className="font-medium capitalize">
              {formatDate(today)}
            </span>
            <Badge
              variant="outline"
              className="ml-1 border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
            >
              {compteurs.total} session{compteurs.total > 1 ? "s" : ""}
            </Badge>
          </div>

          {/* ─── Chips filtre (hidden on mobile, replaced by Select) ─────── */}
          <div className="hidden flex-wrap items-center gap-2 sm:flex">
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

          {/* ─── Select mobile (sm:hidden) ───────────────────────────────── */}
          <div className="sm:hidden">
            <Select
              value={filtre}
              onValueChange={(v) => setFiltre(v as StatutAffichage | "all")}
            >
              <SelectTrigger className="w-full bg-background" aria-label="Filtrer par statut">
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
        </div>
      </GlassCard>

      {/* ─── Contenu : grille / skeletons / empty / error ─────────────────── */}
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
              : "Impossible de charger les sessions. Vérifiez que le backend est démarré puis réessayez."
          }
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              title="Réessayer le chargement"
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
                variant="success"
                size="sm"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                title="Générer les sessions du jour"
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
            tone="amber"
            title="Aucune session ne correspond au filtre"
            description="Modifiez le filtre de statut pour voir d'autres sessions."
          />
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sessionsFiltrees.map((s, idx) => (
            <SessionCard
              key={s.id}
              session={s}
              index={idx}
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
// Shell (hero header premium + KentePattern strip / separator)
// ─────────────────────────────────────────────────────────────────────────────

interface EcranPointageShellProps {
  children: React.ReactNode;
  headerRight?: React.ReactNode;
  etablissementNom?: string;
}

function EcranPointageShell({
  children,
  headerRight,
  etablissementNom,
}: EcranPointageShellProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <KentePattern variant="strip" position="top" />

      {/* ─── Hero header premium ──────────────────────────────────────── */}
      <GlassCard variant="desktop" noHover premiumBorder className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Badge rond gradient emerald→gold avec icône Clock */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <Clock className="size-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                  Écran de pointage
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Suivi temps réel des pointages enseignants · rafraîchissement
                automatique toutes les 30 secondes.
              </p>
              {etablissementNom ? (
                <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {etablissementNom}
                </span>
              ) : null}
            </div>
          </div>
          {headerRight ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
              {headerRight}
            </div>
          ) : null}
        </div>
      </GlassCard>

      <KentePattern variant="separator" className="my-1" />

      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carte session (GlassCard adaptive + hover lift + bordure gauche colorée)
// ─────────────────────────────────────────────────────────────────────────────

interface SessionCardProps {
  session: SessionAvecStatut;
  index: number;
  onValider: () => void;
  isValiding: boolean;
}

function SessionCard({
  session,
  index,
  onValider,
  isValiding,
}: SessionCardProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const statut = session.statut_affichage;
  const StatutIco = STATUT_ICO[statut];
  const matiere = session.affectation?.matiere;
  const classe = session.affectation?.classe;
  const absentEnCours = statut === "ROUGE" && coursCommence(session);

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
      <GlassCard
        variant="adaptive"
        className={cn(
          "h-full border-l-4 p-4",
          STATUT_BORDER[statut],
        )}
      >
        <div className="flex h-full flex-col gap-3">
          {/* ─── En-tête : heure + statut ─────────────────────────────────── */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-col">
              <span className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                <Clock className="size-3.5 text-muted-foreground" />
                {formatHeure(session.heure_debut)} – {formatHeure(session.heure_fin)}
              </span>
              <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" />
                <span className="line-clamp-1">{session.salle || "—"}</span>
              </span>
            </div>
            <Badge
              variant="outline"
              className={cn("shrink-0 gap-1 font-medium", STATUT_BADGE[statut])}
            >
              <StatutIco className="size-3" />
              {STATUT_LABEL[statut]}
            </Badge>
          </div>

          {/* ─── Matière + classe ─────────────────────────────────────────── */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-3 shrink-0 rounded-full border border-black/10"
                style={{
                  backgroundColor: matiere?.couleur || "#94a3b8",
                }}
              />
              <span className="line-clamp-1 break-words text-sm font-medium leading-snug text-forest">
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

          {/* ─── Enseignant ───────────────────────────────────────────────── */}
          <div className="flex items-center gap-1.5 text-xs">
            <User className="size-3.5 text-muted-foreground" />
            <span className="line-clamp-1 break-words font-medium leading-snug">
              {eleveOuEnseignantNom(session)}
            </span>
          </div>

          {/* ─── Pied : action / badge ────────────────────────────────────── */}
          <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3">
            {statut === "ORANGE" ? (
              <Button
                type="button"
                variant="success"
                size="sm"
                onClick={onValider}
                disabled={isValiding}
                title="Valider manuellement ce pointage (régularisation)"
                aria-label="Valider manuellement le pointage"
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
                className="animate-pulse border-rose-300 bg-rose-100 font-bold uppercase tracking-wide text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/60 dark:text-rose-200"
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
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chip de filtre (badges renforcés border-300 bg-100 text-800)
// ─────────────────────────────────────────────────────────────────────────────

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
  // Contrast renforcé (BUG À ÉVITER #7) : border-300 bg-100 text-800.
  const toneCls: Record<StatutChipProps["tone"], string> = {
    emerald:
      "border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-950/70",
    amber:
      "border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-950/70",
    rose:
      "border-rose-300 bg-rose-100 text-rose-800 hover:bg-rose-200 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200 dark:hover:bg-rose-950/70",
    orange:
      "border-orange-300 bg-orange-100 text-orange-800 hover:bg-orange-200 dark:border-orange-800/60 dark:bg-orange-950/50 dark:text-orange-200 dark:hover:bg-orange-950/70",
    slate:
      "border-slate-300 bg-slate-100 text-slate-800 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:bg-slate-900/70",
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
// Loading state premium (KentePattern strip top + 8 Skeletons en grille)
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
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-xl" />
        ))}
      </div>
    </GlassCard>
  );
}
