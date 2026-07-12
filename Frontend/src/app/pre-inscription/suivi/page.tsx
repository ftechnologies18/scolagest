"use client";

/**
 * ScolaGest — Page publique de suivi de pré-inscription
 * (route `/pre-inscription/suivi`).
 *
 * Le parent accède à cette page via le lien reçu après soumission :
 * `/pre-inscription/suivi?token=XXX`. La page lit le token dans l'URL et
 * interroge la route publique `GET /api/public/pre-inscriptions/:token`.
 *
 * Affiche une carte récapitulative (élève, classe souhaitée, établissement)
 * avec une timeline du cycle de vie : SOUMISE → EN_REVUE → VALIDEE / REJETEE.
 *
 * États : pas de token (message), chargement, erreur (token invalide),
 * succès (carte détaillée).
 */

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  GraduationCap,
  Loader2,
  Mail,
  Phone,
  School,
  User,
  XCircle,
} from "lucide-react";

import {
  fetchPreInscriptionByToken,
  preInscriptionsKeys,
  type PreInscription,
  type StatutPreInscription,
} from "@/lib/api-pre-inscription";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUT_LABEL: Record<StatutPreInscription, string> = {
  SOUMISE: "Soumise",
  EN_REVUE: "En revue",
  VALIDEE: "Validée",
  REJETEE: "Rejetée",
};

const STATUT_BADGE_CLS: Record<StatutPreInscription, string> = {
  SOUMISE:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  EN_REVUE:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300",
  VALIDEE:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  REJETEE:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
};

function sexeLabel(s: PreInscription["eleve_sexe"]): string {
  if (s === "M") return "Masculin";
  if (s === "F") return "Féminin";
  return "—";
}

function categorieLabel(c: PreInscription["eleve_categorie"]): string {
  switch (c) {
    case "AFFECTE":
      return "Affecté (État)";
    case "NON_AFFECTE":
      return "Non affecté";
    default:
      return "Non applicable";
  }
}

function lienParenteLabel(l: PreInscription["tuteur_lien_parente"]): string {
  switch (l) {
    case "PERE":
      return "Père";
    case "MERE":
      return "Mère";
    case "TUTEUR_LEGAL":
      return "Tuteur légal";
    case "AUTRE":
      return "Autre";
    default:
      return "—";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function SuiviPreInscriptionPage() {
  // useSearchParams() nécessite un boundary <Suspense> pour le prerendering
  // statique Next.js (sinon erreur build "useSearchParams should be wrapped
  // in a suspense boundary at page").
  return (
    <React.Suspense
      fallback={
        <PublicShell>
          <Card className="mx-auto max-w-2xl">
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <Loader2 className="size-8 animate-spin text-emerald-600" />
              <p className="text-sm text-muted-foreground">Chargement…</p>
            </CardContent>
          </Card>
        </PublicShell>
      }
    >
      <SuiviPreInscriptionContent />
    </React.Suspense>
  );
}

function SuiviPreInscriptionContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const { data, isLoading, isError, error } = useQuery({
    queryKey: preInscriptionsKeys.publicByToken(token),
    queryFn: () => fetchPreInscriptionByToken(token),
    enabled: !!token,
    retry: false,
  });

  // ─── Pas de token ─────────────────────────────────────────────────────────
  if (!token) {
    return (
      <PublicShell>
        <Card className="mx-auto max-w-md">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertCircle className="size-6" />
            </div>
            <p className="text-base font-semibold">Token manquant</p>
            <p className="text-sm text-muted-foreground">
              Aucun jeton de suivi n&apos;a été fourni dans l&apos;URL. Vérifiez
              le lien que vous avez reçu par e-mail ou SMS après votre
              pré-inscription.
            </p>
            <Button asChild className="mt-2 bg-emerald-600 hover:bg-emerald-700">
              <Link href="/pre-inscription">
                <GraduationCap className="size-4" />
                Faire une pré-inscription
              </Link>
            </Button>
          </CardContent>
        </Card>
      </PublicShell>
    );
  }

  // ─── Chargement ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <PublicShell>
        <Card className="mx-auto max-w-2xl">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <Loader2 className="size-8 animate-spin text-emerald-600" />
            <p className="text-sm text-muted-foreground">
              Récupération de votre pré-inscription…
            </p>
          </CardContent>
        </Card>
      </PublicShell>
    );
  }

  // ─── Erreur (token invalide) ──────────────────────────────────────────────
  if (isError || !data) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de récupérer cette pré-inscription. Le lien est peut-être invalide ou expiré.";
    return (
      <PublicShell>
        <Card className="mx-auto max-w-md">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              <XCircle className="size-6" />
            </div>
            <p className="text-base font-semibold">Lien invalide</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button asChild className="mt-2 bg-emerald-600 hover:bg-emerald-700">
              <Link href="/pre-inscription">
                <GraduationCap className="size-4" />
                Faire une nouvelle pré-inscription
              </Link>
            </Button>
          </CardContent>
        </Card>
      </PublicShell>
    );
  }

  // ─── Succès : carte détaillée ─────────────────────────────────────────────
  return (
    <PublicShell>
      <SuiviCard pre={data} />
    </PublicShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell public (plein écran, dégradé emerald, sans sidebar)
// ─────────────────────────────────────────────────────────────────────────────

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-emerald-50 via-background to-amber-50">
      {/* Orbes décoratifs (glassmorphism léger) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-emerald-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-amber-200/30 blur-3xl"
      />

      {/* En-tête */}
      <header className="relative z-10 border-b border-emerald-100/60 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
          <Image
            src="/logo.png"
            alt="ScolaGest"
            width={36}
            height={36}
            className="rounded-lg shadow-sm"
          />
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight">ScolaGest</p>
            <p className="truncate text-[10px] text-muted-foreground leading-tight">
              Suivi de pré-inscription
            </p>
          </div>
          <Button asChild variant="ghost" size="sm" className="ml-auto">
            <Link href="/pre-inscription">
              <GraduationCap className="size-4" />
              Pré-inscription
            </Link>
          </Button>
        </div>
      </header>

      {/* Contenu */}
      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>

      {/* Pied de page */}
      <footer className="relative z-10 mt-auto border-t border-emerald-100/60 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-1.5 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p>ScolaGest · Pré-inscription en ligne</p>
          <p className="text-[11px]">
            Groupe Scolaire Le Chandelier — Dabou, Côte d&apos;Ivoire
          </p>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carte de suivi
// ─────────────────────────────────────────────────────────────────────────────

function SuiviCard({ pre }: { pre: PreInscription }) {
  const eleveNomComplet = [pre.eleve_prenoms, pre.eleve_nom]
    .filter(Boolean)
    .join(" ")
    .trim();
  const tuteurNomComplet = [pre.tuteur_prenoms, pre.tuteur_nom]
    .filter(Boolean)
    .join(" ")
    .trim();

  return (
    <div className="space-y-6">
      {/* Bandeau de statut */}
      <Card className="overflow-hidden border-emerald-200 dark:border-emerald-900/50">
        <CardContent className="space-y-4 py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <GraduationCap className="size-6" />
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Statut de votre demande
                </p>
                <h1 className="text-2xl font-bold tracking-tight">
                  {STATUT_LABEL[pre.statut]}
                </h1>
              </div>
            </div>
            <Badge
              className={cn(
                "px-3 py-1 text-sm font-semibold",
                STATUT_BADGE_CLS[pre.statut],
              )}
            >
              {STATUT_LABEL[pre.statut]}
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground">
            Demande soumise le{" "}
            <span className="font-medium text-foreground">
              {formatDateTime(pre.date_soumission)}
            </span>
            {pre.etablissement && (
              <>
                {" "}
                auprès de{" "}
                <span className="font-medium text-foreground">
                  {pre.etablissement.nom}
                </span>
                {pre.etablissement.ville ? ` (${pre.etablissement.ville})` : ""}
              </>
            )}
            .
          </p>

          {pre.statut === "REJETEE" && pre.notes_staff && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
              <p className="mb-1 font-semibold">Motif du rejet</p>
              <p className="whitespace-pre-wrap">{pre.notes_staff}</p>
            </div>
          )}
          {pre.statut === "VALIDEE" && pre.eleve_cree_id && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
              <p className="flex items-center gap-2">
                <CheckCircle2 className="size-4" />
                Votre enfant a été inscrit(e) avec succès. Le secrétariat vous
                contactera pour finaliser le dossier.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline du cycle de vie */}
      <Card>
        <CardContent className="py-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Cycle de vie
          </p>
          <Timeline statut={pre.statut} dateSoumission={pre.date_soumission} dateTraitement={pre.date_traitement ?? null} />
        </CardContent>
      </Card>

      {/* Détails */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Élève */}
        <Card>
          <CardContent className="space-y-3 py-5">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <User className="size-4" />
              <h2 className="text-sm font-semibold">Élève</h2>
            </div>
            <Separator />
            <DetailRow label="Nom complet" value={eleveNomComplet || "—"} />
            <DetailRow
              label="Date de naissance"
              value={pre.eleve_date_naissance ? formatDate(pre.eleve_date_naissance) : "—"}
              icon={<CalendarDays className="size-3.5" />}
            />
            <DetailRow label="Lieu de naissance" value={pre.eleve_lieu_naissance || "—"} />
            <DetailRow label="Sexe" value={sexeLabel(pre.eleve_sexe)} />
            <DetailRow label="Catégorie" value={categorieLabel(pre.eleve_categorie)} />
          </CardContent>
        </Card>

        {/* Tuteur */}
        <Card>
          <CardContent className="space-y-3 py-5">
            <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
              <Phone className="size-4" />
              <h2 className="text-sm font-semibold">Tuteur / Parent</h2>
            </div>
            <Separator />
            <DetailRow label="Nom complet" value={tuteurNomComplet || "—"} />
            <DetailRow
              label="Téléphone"
              value={pre.tuteur_telephone || "—"}
              icon={<Phone className="size-3.5" />}
            />
            <DetailRow
              label="Email"
              value={pre.tuteur_email || "—"}
              icon={<Mail className="size-3.5" />}
            />
            <DetailRow label="Lien de parenté" value={lienParenteLabel(pre.tuteur_lien_parente)} />
          </CardContent>
        </Card>
      </div>

      {/* Classe souhaitée + notes */}
      <Card>
        <CardContent className="space-y-3 py-5">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <School className="size-4" />
            <h2 className="text-sm font-semibold">
              {pre.statut === "VALIDEE" ? "Classe & notes" : "Classe souhaitée & notes"}
            </h2>
          </div>
          <Separator />
          {/* Classe souhaitée / Classe attribuée */}
          {pre.statut === "VALIDEE" ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
              <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                <School className="size-3.5" />
                Classe attribuée
              </p>
              <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                La classe de votre enfant sera communiquée après le paiement
                des frais d&apos;inscription à la caisse de l&apos;établissement.
              </p>
            </div>
          ) : (
            <DetailRow
              label="Classe souhaitée"
              value={
                pre.classe
                  ? `${pre.classe.libelle}${pre.classe.cycle ? ` · ${pre.classe.cycle.libelle}` : ""}`
                  : "Non précisée"
              }
              icon={<School className="size-3.5" />}
            />
          )}
          {pre.notes_parent && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Message du parent
              </p>
              <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
                {pre.notes_parent}
              </p>
            </div>
          )}
          {pre.statut === "VALIDEE" && pre.notes_staff && (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Notes du secrétariat
              </p>
              <p className="whitespace-pre-wrap rounded-md bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                {pre.notes_staff}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex items-center gap-1.5 text-right text-sm font-medium">
        {icon}
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline du cycle de vie
// ─────────────────────────────────────────────────────────────────────────────

function Timeline({
  statut,
  dateSoumission,
  dateTraitement,
}: {
  statut: StatutPreInscription;
  dateSoumission: string;
  dateTraitement: string | null;
}) {
  const steps: {
    key: StatutPreInscription;
    label: string;
    icon: React.ElementType;
    reached: boolean;
    isTerminal?: boolean;
    isError?: boolean;
  }[] = [
    {
      key: "SOUMISE",
      label: "Soumise",
      icon: Clock,
      reached: true,
    },
    {
      key: "EN_REVUE",
      label: "En revue",
      icon: User,
      reached:
        statut === "EN_REVUE" ||
        statut === "VALIDEE" ||
        statut === "REJETEE",
    },
    {
      key: "VALIDEE",
      label: "Validée",
      icon: CheckCircle2,
      reached: statut === "VALIDEE",
      isTerminal: true,
      isError: false,
    },
  ];

  // Cas rejetée : on remplace la dernière étape par un état rejet
  if (statut === "REJETEE") {
    steps[2] = {
      key: "REJETEE",
      label: "Rejetée",
      icon: XCircle,
      reached: true,
      isTerminal: true,
      isError: true,
    };
  }

  return (
    <div className="space-y-1">
      <ol className="flex flex-col gap-0 sm:flex-row sm:items-center sm:gap-0">
        {steps.map((s, idx) => {
          const Icon = s.icon;
          const isLast = idx === steps.length - 1;
          return (
            <li
              key={s.key}
              className="flex flex-1 items-center gap-3 sm:flex-col sm:text-center"
            >
              <div className="flex items-center gap-3 sm:flex-col sm:gap-1.5">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    s.reached
                      ? s.isError
                        ? "border-rose-500 bg-rose-500 text-white"
                        : s.key === "VALIDEE"
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : s.key === "EN_REVUE"
                            ? "border-sky-500 bg-sky-500 text-white"
                            : "border-amber-500 bg-amber-500 text-white"
                      : "border-muted bg-background text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" />
                </div>
                <div className="sm:text-center">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      s.reached ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {s.key === "SOUMISE" && formatDate(dateSoumission)}
                    {s.key === "EN_REVUE" &&
                      (s.reached ? "En cours de traitement" : "En attente")}
                    {s.key === "VALIDEE" &&
                      (s.reached && dateTraitement
                        ? formatDate(dateTraitement)
                        : s.reached
                          ? "Inscription créée"
                          : "En attente")}
                    {s.key === "REJETEE" &&
                      (dateTraitement ? formatDate(dateTraitement) : "Refusée")}
                  </p>
                </div>
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "h-0.5 flex-1 sm:mb-7",
                    steps[idx + 1].reached
                      ? steps[idx + 1].isError
                        ? "bg-rose-300"
                        : "bg-emerald-300"
                      : "bg-muted",
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
