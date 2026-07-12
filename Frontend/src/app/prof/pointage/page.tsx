"use client";

/**
 * ScolaGest — Page de pointage enseignant (route `/prof/pointage`).
 *
 * Reçoit `?session=SESSION_ID` en query param. Affiche les détails du cours
 * (matière, classe, horaire, salle), puis un gros bouton « Pointer mon
 * entrée » / « Pointer ma sortie » selon le dernier pointage connu.
 *
 * Au clic :
 *   1. Capture la position GPS (`getCurrentPositionWithStatus`).
 *   2. Crée le pointage via `createPointage` avec :
 *        - `date_heure_client` = maintenant (ISO),
 *        - `geo_lat`, `geo_lng`, `geo_precision` (0,0,0 si GPS indispo),
 *        - `methode` = "GPS_ONLINE".
 *   3. Affiche le résultat : succès (vert), validation requise (orange),
 *      fraude suspectée (rouge).
 *
 * Si le GPS est indisponible (permission refusée, timeout…), on permet quand
 * même de pointer : le backend marquera le pointage en `VALIDATION_REQUISE`
 * (le surveillant validera manuellement).
 *
 * Bouton retour vers `/prof`.
 */

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Clock,
  MapPin,
  DoorOpen,
  LogIn,
  LogOut,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  GraduationCap,
  RefreshCw,
  LocateFixed,
  CircleDot,
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
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { useToast } from "@/hooks/use-toast";
import { profKeys } from "@/lib/api-prof";
import {
  createPointage,
  fetchMesSessions,
  type SessionCours,
  type PointageResult,
  type TypePointage,
} from "@/lib/api-pointage";
import {
  getCurrentPositionWithStatus,
  type GeoError,
  type GeoPosition,
} from "@/lib/geolocation";
import { todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatHeure(isoTime: string): string {
  const parts = isoTime?.split(":") ?? [];
  if (parts.length < 2) return isoTime ?? "—";
  return `${parts[0]}h${parts[1]}`;
}

function findSession(sessions: SessionCours[], id: string): SessionCours | undefined {
  return sessions.find((s) => s.id === id);
}

function nextType(session: SessionCours | undefined): TypePointage {
  if (!session) return "ENTREE";
  const pointages = session.pointages ?? [];
  const hasSortie = pointages.some((p) => p.type === "SORTIE");
  const hasEntree = pointages.some((p) => p.type === "ENTREE");
  if (hasSortie) return "ENTREE"; // déjà terminé — par défaut on proposera entrée
  if (hasEntree) return "SORTIE";
  return "ENTREE";
}

function isTermine(session: SessionCours | undefined): boolean {
  if (!session) return false;
  return (session.pointages ?? []).some((p) => p.type === "SORTIE");
}

type PointageOutcome =
  | { kind: "SUCCESS"; result: PointageResult; geo: GeoPosition; geoError: GeoError | null }
  | { kind: "ERROR"; message: string };

// ─────────────────────────────────────────────────────────────────────────────
// Composants de résultat
// ─────────────────────────────────────────────────────────────────────────────

function ResultCard({
  outcome,
  onReset,
}: {
  outcome: PointageOutcome;
  onReset: () => void;
}) {
  if (outcome.kind === "ERROR") {
    return (
      <Card className="border-rose-200 bg-rose-50/60">
        <CardHeader className="items-center text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <ShieldAlert className="size-7" />
          </div>
          <CardTitle className="text-base text-rose-800">Pointage échoué</CardTitle>
          <CardDescription className="text-rose-700/80">{outcome.message}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Button type="button" onClick={onReset} className="h-11 gap-2">
            <RefreshCw className="size-4" />
            Réessayer
          </Button>
          <Button asChild variant="outline" className="h-11 gap-2">
            <Link href="/prof">
              <ArrowLeft className="size-4" />
              Retour à mon espace
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { result, geo, geoError } = outcome;
  const statut = result.pointage.statut;

  // Synchronise l'affichage selon le statut renvoyé par le backend.
  const isFraude = statut === "FRAUDE_SUSPECTEE";
  const isValidation = statut === "VALIDATION_REQUISE" || statut === "SYNC_EN_ATTENTE";
  const isOk =
    statut === "VALIDE" || statut === "VALIDE_MANUEL" || (!isFraude && !isValidation);

  const icon = isFraude ? ShieldAlert : isValidation ? AlertTriangle : CheckCircle2;
  const Icon = icon;
  const tone = isFraude
    ? "border-rose-200 bg-rose-50/60 text-rose-700"
    : isValidation
      ? "border-amber-200 bg-amber-50/60 text-amber-700"
      : "border-emerald-200 bg-emerald-50/60 text-emerald-700";
  const title = isFraude
    ? "Pointage rejeté"
    : isValidation
      ? "Validation requise"
      : "Pointage enregistré";
  const desc = isFraude
    ? result.alerte || "Le pointage a été marqué comme fraude suspectée. Contactez la direction si nécessaire."
    : isValidation
      ? result.alerte || "Votre position GPS est borderline ou indisponible. Un surveillant doit valider ce pointage."
      : result.alerte || "Votre pointage a été enregistré et validé par le système.";

  return (
    <Card className={cn("border", tone)}>
      <CardHeader className="items-center text-center">
        <div
          className={cn(
            "mx-auto flex size-14 items-center justify-center rounded-full",
            isFraude
              ? "bg-rose-100 text-rose-600"
              : isValidation
                ? "bg-amber-100 text-amber-600"
                : "bg-emerald-100 text-emerald-600",
          )}
        >
          <Icon className="size-7" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2 rounded-md bg-background/60 p-3">
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="font-medium">
              {result.pointage.type === "ENTREE" ? "Entrée" : "Sortie"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Heure</p>
            <p className="font-medium">
              {new Date(result.pointage.date_heure_client).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Méthode</p>
            <p className="font-mono text-xs">{result.pointage.methode}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Statut</p>
            <p className="font-mono text-xs">{result.pointage.statut}</p>
          </div>
        </div>

        {/* Bloc GPS */}
        <div className="rounded-md bg-background/60 p-3 text-xs">
          <p className="text-muted-foreground">Position GPS capturée</p>
          {geo.lat === 0 && geo.lng === 0 ? (
            <p className="mt-0.5 font-medium text-amber-700">
              GPS indisponible {geoError ? `— ${geoError.message}` : ""}
            </p>
          ) : (
            <p className="mt-0.5 font-mono text-foreground">
              {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}{" "}
              <span className="text-muted-foreground">
                (±{Math.round(geo.precision)} m)
              </span>
            </p>
          )}
        </div>

        {result.pointage.motif_rejet ? (
          <div className="rounded-md border border-dashed border-rose-300 bg-rose-50/40 p-3 text-xs text-rose-700">
            <p className="font-medium">Motif du rejet</p>
            <p className="mt-0.5">{result.pointage.motif_rejet}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 pt-1">
          <Button asChild className="h-11 gap-2">
            <Link href="/prof">
              <ArrowLeft className="size-4" />
              Retour à mon espace
            </Link>
          </Button>
          {!isFraude && (
            <Button
              type="button"
              variant="outline"
              onClick={onReset}
              className="h-11 gap-2"
            >
              <CircleDot className="size-4" />
              Effectuer un autre pointage
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfPointagePage() {
  // `useSearchParams` doit être encapsulé dans une Suspense boundary en
  // Next.js 16 pour le rendu statique — on délègue à un composant enfant.
  return (
    <React.Suspense fallback={<PointagePageFallback />}>
      <ProfPointagePageInner />
    </React.Suspense>
  );
}

function PointagePageFallback() {
  return (
    <div className="space-y-4">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 h-9 gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <Link href="/prof">
          <ArrowLeft className="size-4" />
          Retour à mon espace
        </Link>
      </Button>
      <SessionDetailsSkeleton />
    </div>
  );
}

function ProfPointagePageInner() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session") ?? "";
  const qc = useQueryClient();
  const { toast } = useToast();

  const today = todayISO();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: profKeys.sessions(today),
    queryFn: () => fetchMesSessions(today),
    // Pas de refetch automatique : on invalide manuellement après un pointage.
    staleTime: 30_000,
  });

  const session = React.useMemo(
    () => (data ? findSession(data, sessionId) : undefined),
    [data, sessionId],
  );

  const [submitting, setSubmitting] = React.useState(false);
  const [geoWarning, setGeoWarning] = React.useState<string | null>(null);
  const [outcome, setOutcome] = React.useState<PointageOutcome | null>(null);

  // Cas : pas d'ID de session dans l'URL → retour dashboard.
  if (!sessionId) {
    return (
      <div className="space-y-4">
        <BackButton />
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="items-center text-center">
            <AlertTriangle className="size-8 text-amber-600" />
            <CardTitle className="text-base text-amber-800">
              Session manquante
            </CardTitle>
            <CardDescription className="text-amber-700/80">
              Aucune session sélectionnée. Revenez à votre espace et choisissez
              un cours à pointer.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="h-11 w-full gap-2">
              <Link href="/prof">
                <ArrowLeft className="size-4" />
                Retour à mon espace
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  async function handlePointer() {
    if (!session) return;
    setSubmitting(true);
    setGeoWarning(null);

    // 1. Capture GPS.
    const { position: geo, error: geoError } = await getCurrentPositionWithStatus();
    if (geoError) {
      // On continue quand même : le backend marquera VALIDATION_REQUISE.
      setGeoWarning(geoError.message);
    }

    // 2. Création du pointage.
    try {
      const type: TypePointage = nextType(session);
      const result = await createPointage({
        session_cours_id: session.id,
        type,
        date_heure_client: new Date().toISOString(),
        geo_lat: geo.lat,
        geo_lng: geo.lng,
        geo_precision: geo.precision,
        methode: "GPS_ONLINE",
      });
      setOutcome({ kind: "SUCCESS", result, geo, geoError });

      // Invalide le cache des sessions pour que la liste du dashboard se
      // rafraîchisse (statut mis à jour).
      await qc.invalidateQueries({ queryKey: profKeys.sessions(today) });

      toast({
        title:
          result.pointage.statut === "FRAUDE_SUSPECTEE"
            ? "Pointage rejeté"
            : result.pointage.statut === "VALIDATION_REQUISE" ||
                result.pointage.statut === "SYNC_EN_ATTENTE"
              ? "Validation requise"
              : "Pointage enregistré",
        description: result.alerte ?? undefined,
        variant:
          result.pointage.statut === "FRAUDE_SUSPECTEE" ? "destructive" : "default",
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Échec du pointage. Réessayez.";
      setOutcome({ kind: "ERROR", message });
      toast({
        title: "Échec du pointage",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setOutcome(null);
    setGeoWarning(null);
    // Force un refetch pour récupérer le statut mis à jour de la session.
    refetch();
  }

  return (
    <div className="space-y-4">
      <BackButton />

      {/* Détails du cours */}
      {isLoading ? (
        <SessionDetailsSkeleton />
      ) : isError ? (
        <Card className="border-rose-200 bg-rose-50/50">
          <CardHeader className="gap-1.5">
            <CardTitle className="flex items-center gap-2 text-base text-rose-700">
              <AlertTriangle className="size-5" />
              Impossible de charger le cours
            </CardTitle>
            <CardDescription className="text-rose-700/80">
              {error instanceof Error ? error.message : "Erreur inconnue."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" variant="outline" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="size-4" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      ) : !session ? (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader className="items-center text-center">
            <AlertTriangle className="size-8 text-amber-600" />
            <CardTitle className="text-base text-amber-800">Session introuvable</CardTitle>
            <CardDescription className="text-amber-700/80">
              Cette session n&apos;apparait pas parmi vos cours du jour. Elle a
              peut-être été annulée ou déplacée.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="h-11 w-full gap-2">
              <Link href="/prof">
                <ArrowLeft className="size-4" />
                Retour à mon espace
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Bandeau détails cours */}
          <GlassCard
            variant="adaptive"
            noHover
            className="border-l-4 border-l-emerald-500"
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-display flex items-center gap-2 text-base font-semibold">
                  {session.affectation?.matiere?.libelle ?? "Matière inconnue"}
                  {session.affectation?.matiere?.couleur ? (
                    <span
                      aria-hidden
                      className="inline-block size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: session.affectation.matiere.couleur }}
                    />
                  ) : null}
                </h3>
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <GraduationCap className="size-3.5" />
                  {session.affectation?.classe?.libelle ?? "Classe inconnue"}
                </p>
              </div>
              {isTermine(session) ? (
                <Badge variant="outline" className="gap-1 border-slate-300 bg-slate-50 text-slate-600">
                  <LogOut className="size-3" /> Terminé
                </Badge>
              ) : nextType(session) === "SORTIE" ? (
                <Badge variant="outline" className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700">
                  <LogIn className="size-3" /> Entrée pointée
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-700">
                  <CircleDot className="size-3" /> À pointer
                </Badge>
              )}
            </div>
            <div>
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
            </div>
          </GlassCard>

          <KentePattern variant="separator" />

          {/* Bloc action / résultat */}
          {outcome ? (
            <ResultCard outcome={outcome} onReset={handleReset} />
          ) : (
            <GlassCard variant="adaptive" noHover>
              <div className="mb-3 flex flex-col gap-2">
                <h3 className="font-display flex items-center gap-2 text-base font-semibold">
                  <LocateFixed className="size-5 text-emerald-600" />
                  Pointage
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isTermine(session)
                    ? "Ce cours est déjà terminé. Vous pouvez tout de même enregistrer un pointage de régularisation."
                    : nextType(session) === "SORTIE"
                      ? "Pointez maintenant votre sortie de cours."
                      : "Pointez maintenant votre entrée en cours."}
                </p>
              </div>
              <div className="space-y-3">
                {geoWarning ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    <p className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="size-4" />
                      GPS indisponible
                    </p>
                    <p className="mt-0.5">{geoWarning}</p>
                    <p className="mt-1 text-amber-700/80">
                      Le pointage sera soumis à validation manuelle du
                      surveillant.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-700">
                    <p className="flex items-center gap-1.5">
                      <LocateFixed className="size-4" />
                      Votre position GPS sera capturée au moment du clic.
                    </p>
                  </div>
                )}

                <Button
                  type="button"
                  size="lg"
                  onClick={handlePointer}
                  disabled={submitting}
                  className={cn(
                    "h-16 w-full gap-3 text-base",
                    nextType(session) === "SORTIE"
                      ? "bg-slate-700 hover:bg-slate-800"
                      : "bg-emerald-600 hover:bg-emerald-700",
                  )}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-6 animate-spin" />
                      Pointage en cours…
                    </>
                  ) : (
                    <>
                      {nextType(session) === "SORTIE" ? (
                        <LogOut className="size-6" />
                      ) : (
                        <LogIn className="size-6" />
                      )}
                      {nextType(session) === "SORTIE"
                        ? "Pointer ma sortie"
                        : "Pointer mon entrée"}
                    </>
                  )}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Le bouton capture le GPS puis enregistre le pointage sur le
                  serveur. En cas d&apos;échec GPS, le pointage reste possible
                  (validation manuelle requise).
                </p>
              </div>
            </GlassCard>
          )}
        </>
      )}
    </div>
  );
}

function BackButton() {
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="-ml-2 h-9 gap-1.5 text-muted-foreground hover:text-foreground"
    >
      <Link href="/prof">
        <ArrowLeft className="size-4" />
        Retour à mon espace
      </Link>
    </Button>
  );
}

function SessionDetailsSkeleton() {
  return (
    <Card className="border-l-4 border-l-muted">
      <CardHeader className="gap-2 pb-3">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </CardHeader>
      <CardContent>
        <div className="flex gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      </CardContent>
      <CardContent className="pt-0">
        <Skeleton className="h-16 w-full" />
      </CardContent>
    </Card>
  );
}
