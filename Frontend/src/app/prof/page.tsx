"use client";

/**
 * ScolaGest — Tableau de bord du portail enseignant (route `/prof`).
 *
 * Affiche :
 *   - La date du jour (titre + sous-titre).
 *   - Un bouton large « Signaler un incident » (accès direct au formulaire).
 *   - La liste des sessions de cours du jour (`fetchMesSessions(todayISO())`),
 *     chacune avec sa matière, sa classe, son horaire et son statut de pointage.
 *   - Pour chaque session : un gros bouton « Pointer mon entrée » / « Pointer
 *     ma sortie » menant vers `/prof/pointage?session=ID`.
 *
 * États gérés : chargement (skeletons), erreur (carte rose), vide (carte
 * ambre « pas de cours aujourd'hui »).
 *
 * Mobile-first : grille en une colonne, gros boutons tactiles (≥ 48 px),
 * cartes empilées avec spacing généreux.
 */

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  Clock,
  DoorOpen,
  MapPin,
  AlertTriangle,
  Loader2,
  LogIn,
  LogOut,
  CircleDot,
  RefreshCw,
  GraduationCap,
  Flag,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchMesSessions,
  type SessionCours,
  type Pointage,
} from "@/lib/api-pointage";
import { profKeys } from "@/lib/api-prof";
import { todayISO, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Détermine le statut d'affichage d'une session à partir de ses pointages :
 *   - `ENTREE` pointé → « En cours »
 *   - `SORTIE` pointé → « Terminé »
 *   - sinon → « À pointer »
 */
function sessionStatus(
  session: SessionCours,
): "A_POINTER" | "EN_COURS" | "TERMINE" {
  const pointages = session.pointages ?? [];
  const hasSortie = pointages.some((p) => p.type === "SORTIE");
  const hasEntree = pointages.some((p) => p.type === "ENTREE");
  if (hasSortie) return "TERMINE";
  if (hasEntree) return "EN_COURS";
  return "A_POINTER";
}

function lastPointage(session: SessionCours, type: "ENTREE" | "SORTIE"): Pointage | undefined {
  return (session.pointages ?? [])
    .filter((p) => p.type === type)
    .sort((a, b) => (a.date_heure_client < b.date_heure_client ? 1 : -1))[0];
}

function formatHeure(isoTime: string): string {
  // `heure_debut` est attendu au format "HH:MM:SS" (Postgres TIME).
  const parts = isoTime?.split(":") ?? [];
  if (parts.length < 2) return isoTime ?? "—";
  return `${parts[0]}h${parts[1]}`;
}

// ─────────────────────────────────────────────────────────────────────────────
 // Composant : carte de session
// ─────────────────────────────────────────────────────────────────────────────

function SessionCard({ session }: { session: SessionCours }) {
  const status = sessionStatus(session);
  const matiere = session.affectation?.matiere;
  const classe = session.affectation?.classe;
  const entree = lastPointage(session, "ENTREE");
  const sortie = lastPointage(session, "SORTIE");

  const ctaLabel =
    status === "A_POINTER"
      ? "Pointer mon entrée"
      : status === "EN_COURS"
        ? "Pointer ma sortie"
        : "Voir le détail";
  const ctaIcon = status === "A_POINTER" ? LogIn : status === "EN_COURS" ? LogOut : CircleDot;
  const CtaIcon = ctaIcon;

  const statusBadge =
    status === "A_POINTER" ? (
      <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        <CircleDot className="size-3" /> À pointer
      </Badge>
    ) : status === "EN_COURS" ? (
      <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <LogIn className="size-3" /> En cours
      </Badge>
    ) : (
      <Badge variant="outline" className="gap-1 border-slate-300 bg-slate-50 text-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
        <LogOut className="size-3" /> Terminé
      </Badge>
    );

  return (
    <Card className="overflow-hidden border-l-4 border-l-emerald-500 shadow-sm">
      <CardHeader className="gap-2 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              {matiere?.libelle ?? "Matière inconnue"}
              {matiere?.couleur ? (
                <span
                  aria-hidden
                  className="inline-block size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: matiere.couleur }}
                />
              ) : null}
            </CardTitle>
            <CardDescription className="flex items-center gap-1.5 text-sm">
              <GraduationCap className="size-3.5 text-muted-foreground" />
              {classe?.libelle ?? "Classe inconnue"}
            </CardDescription>
          </div>
          {statusBadge}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-1.5">
            <Clock className="size-4 text-muted-foreground" />
            <span className="font-medium">
              {formatHeure(session.heure_debut)} – {formatHeure(session.heure_fin)}
            </span>
          </div>
          {session.salle ? (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="size-4" />
              <span className="truncate">{session.salle}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-muted-foreground/70">
              <DoorOpen className="size-4" />
              <span className="text-xs italic">Salle non définie</span>
            </div>
          )}
        </div>

        {entree || sortie ? (
          <div className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
            {entree ? (
              <div className="flex items-center gap-1.5">
                <LogIn className="size-3.5 text-emerald-600" />
                Entrée pointée à{" "}
                <span className="font-medium text-foreground">
                  {new Date(entree.date_heure_client).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ) : null}
            {sortie ? (
              <div className="mt-0.5 flex items-center gap-1.5">
                <LogOut className="size-3.5 text-slate-600" />
                Sortie pointée à{" "}
                <span className="font-medium text-foreground">
                  {new Date(sortie.date_heure_client).toLocaleTimeString("fr-FR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        <Button asChild size="lg" className="mt-1 h-12 w-full gap-2 text-base">
          <Link href={`/prof/pointage?session=${encodeURIComponent(session.id)}`}>
            <CtaIcon className="size-5" />
            {ctaLabel}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page principale
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfDashboardPage() {
  const today = todayISO();
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: profKeys.sessions(today),
    queryFn: () => fetchMesSessions(today),
  });

  const sessions = data ?? [];

  return (
    <div className="space-y-6">
      {/* Bandeau date du jour + actions principales */}
      <section className="space-y-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
            <CalendarDays className="size-6 text-emerald-600" />
            Mes cours du jour
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatDate(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button asChild size="lg" className="h-12 w-full gap-2 bg-amber-600 text-base hover:bg-amber-700">
            <Link href="/prof/incidents">
              <Flag className="size-5" />
              Signaler un incident
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 w-full gap-2 border-emerald-300 text-base text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-300">
            <Link href="/prof/paie">
              <Wallet className="size-5" />
              Mes bulletins de paie
            </Link>
          </Button>
        </div>
      </section>

      {/* Liste des sessions */}
      <section className="space-y-3" aria-label="Sessions de cours du jour">
        {isLoading ? (
          <SessionListSkeleton />
        ) : isError ? (
          <Card className="border-rose-200 bg-rose-50/50">
            <CardHeader className="gap-1.5">
              <CardTitle className="flex items-center gap-2 text-base text-rose-700">
                <AlertTriangle className="size-5" />
                Impossible de charger vos cours
              </CardTitle>
              <CardDescription className="text-rose-700/80">
                {error instanceof Error ? error.message : "Erreur inconnue."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                type="button"
                variant="outline"
                onClick={() => refetch()}
                className="gap-2"
                disabled={isFetching}
              >
                <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
                Réessayer
              </Button>
            </CardContent>
          </Card>
        ) : sessions.length === 0 ? (
          <Card className="border-amber-200 bg-amber-50/50">
            <CardHeader className="items-center text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <CalendarDays className="size-6" />
              </div>
              <CardTitle className="text-base text-amber-800">
                Aucun cours aujourd&apos;hui
              </CardTitle>
              <CardDescription className="text-amber-700/80">
                Vous n&apos;avez pas de session planifiée pour ce jour. Profitez-en
                pour signaler un incident si nécessaire.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function SessionListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <Card key={i} className="border-l-4 border-l-muted">
          <CardHeader className="gap-2 pb-3">
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
