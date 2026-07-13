"use client";

/**
 * ScolaGest — Page publique de suivi de pré-inscription
 * (route `/pre-inscription/suivi`).
 *
 * Refonte Forêt EdTech (v2) — effet wahou + stepper visuel.
 *
 * Le parent accède à cette page via le lien reçu après soumission :
 * `/pre-inscription/suivi?token=XXX`. La page lit le token dans l'URL et
 * interroge la route publique `GET /api/public/pre-inscriptions/:token`.
 *
 * Améliorations apportées (Phase 3 — refonte totale) :
 *  - Header « wahou » : KentePattern strip top + bandeau gradient emerald→amber
 *    + logo + titre « Suivi de votre demande » + pill « Phase 3 » outline +
 *    KentePattern separator + glassmorphism (backdrop-blur). Bouton
 *    « Contacter le secrétariat » intégré au header sur desktop.
 *  - Stepper visuel horizontal (desktop) / vertical (mobile) 3 étapes :
 *    Soumise → En revue → Validée (ou Rejetée en terminal). Étape courante
 *    mise en avant (pulse subtil + ring), précédentes cochées emerald, lignes
 *    de progression colorées (gradient emerald→amber ou rose si rejet).
 *  - Message contextuel selon le statut : SOUMISE (amber/Clock), EN_REVUE
 *    (sky/User), VALIDEE (emerald/CheckCircle2 animée spring + CTA prochaines
 *    étapes), REJETEE (rose/XCircle + motif notes_staff affiché clairement).
 *  - Récap dossier discret (GlassCard adaptive) en bas : nom élève,
 *    établissement, classe souhaitée, date soumission — pour confirmer au
 *    parent qu'il regarde le bon dossier.
 *  - Cartes de détails premium : GlassCard adaptive + hover lift pour Élève /
 *    Tuteur / Classe. Badges renforcés (border-300 bg-100 text-800), icônes
 *    contextuelles dans badges ronds emerald/15, DetailRow flex items-start
 *    + mt-0.5 sur l'icône.
 *  - Footer enrichi : KentePattern strip top + 3 colonnes (Établissement /
 *    Contact / ScolaGest) + bouton « Contacter le secrétariat ».
 *  - Bouton « Contacter le secrétariat » sticky en bas sur mobile (backdrop-
 *    blur + border-top) — filet de sécurité à chaque statut.
 *  - Empty states premium : KentePattern bg + badges ronds colorés. Pas de
 *    token (amber/AlertCircle + CTA pré-inscription), erreur (rose/XCircle +
 *    CTA nouvelle pré-inscription), chargement (Loader2 emerald + KentePattern
 *    strip top).
 *  - Animation Framer Motion : pulse subtil sur l'étape courante du stepper,
 *    fade-in + slide-up sur la carte de statut, stagger sur les cartes de
 *    détails (delay={index * 0.05}). Respect usePrefersReducedMotion().
 *
 * LOGIQUE MÉTIER INTACTE : imports de `@/lib/api-pre-inscription`
 * (fetchPreInscriptionByToken, preInscriptionsKeys, types PreInscription /
 * StatutPreInscription), hook useQuery (queryKey preInscriptionsKeys.
 * publicByToken(token), queryFn fetchPreInscriptionByToken, enabled: !!token,
 * retry: false), useSearchParams pour lire le token, wrapper React.Suspense
 * (requis par Next.js pour useSearchParams), endpoint API backend
 * (GET /api/public/pre-inscriptions/:token), helpers (STATUT_LABEL,
 * STATUT_BADGE_CLS, sexeLabel, categorieLabel, lienParenteLabel), logique de
 * la Timeline (statut, dateSoumission, dateTraitement). Masquage classe si
 * VALIDEE (la classe sera communiquée après paiement) préservé.
 *
 * États : pas de token, chargement, erreur (token invalide), succès (carte
 * détaillée + stepper + récap).
 */

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Hash,
  Landmark,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  School,
  Sparkles,
  User,
  Users,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";

import {
  fetchPreInscriptionByToken,
  preInscriptionsKeys,
  type PreInscription,
  type StatutPreInscription,
} from "@/lib/api-pre-inscription";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (logique métier préservée à l'identique)
// ─────────────────────────────────────────────────────────────────────────────

const STATUT_LABEL: Record<StatutPreInscription, string> = {
  SOUMISE: "Soumise",
  EN_REVUE: "En revue",
  VALIDEE: "Validée",
  REJETEE: "Rejetée",
};

const STATUT_BADGE_CLS: Record<StatutPreInscription, string> = {
  SOUMISE:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  EN_REVUE:
    "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  VALIDEE:
    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  REJETEE:
    "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200",
};

/** Palette d'icônes + tons par statut (pour le message contextuel). */
const STATUT_MSG: Record<
  StatutPreInscription,
  {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    /** Classes du badge rond contenant l'icône (taille size-14). */
    badgeRound: string;
    /** Classes du bandeau de fond (border + bg). */
    banner: string;
  }
> = {
  SOUMISE: {
    icon: Clock,
    title: "Votre dossier a bien été reçu",
    subtitle:
      "Il sera examiné sous peu par le secrétariat. Vous recevrez une notification à chaque étape du traitement.",
    badgeRound:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    banner:
      "border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20",
  },
  EN_REVUE: {
    icon: User,
    title: "Votre dossier est en cours d'examen",
    subtitle:
      "Le secrétariat vérifie les informations transmises. Cette étape prend généralement 24 à 48 heures ouvrées.",
    badgeRound:
      "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    banner:
      "border-sky-200 bg-sky-50/60 dark:border-sky-900/50 dark:bg-sky-950/20",
  },
  VALIDEE: {
    icon: CheckCircle2,
    title: "Félicitations, votre enfant est inscrit·e !",
    subtitle:
      "Le secrétariat a validé la pré-inscription. Prochaine étape : finaliser le dossier à l'établissement.",
    badgeRound:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    banner:
      "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20",
  },
  REJETEE: {
    icon: XCircle,
    title: "Votre demande n'a pas pu être acceptée",
    subtitle:
      "Le motif du refus est indiqué ci-dessous. Pour toute précision, contactez le secrétariat de l'établissement.",
    badgeRound:
      "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
    banner:
      "border-rose-200 bg-rose-50/60 dark:border-rose-900/50 dark:bg-rose-950/20",
  },
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

/** Initiales d'un nom complet — pour l'avatar de l'élève dans le récap. */
function initials(nom?: string, prenoms?: string): string {
  const a = (nom ?? "").trim().charAt(0);
  const b = (prenoms ?? "").trim().charAt(0);
  return (a + b).toUpperCase() || "?";
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
          <LoadingState />
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
        <NoTokenState />
      </PublicShell>
    );
  }

  // ─── Chargement ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <PublicShell>
        <LoadingState />
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
        <ErrorState message={message} />
      </PublicShell>
    );
  }

  // ─── Succès : carte détaillée ─────────────────────────────────────────────
  return (
    <PublicShell pre={data}>
      <SuiviCard pre={data} />
    </PublicShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell public (plein écran, hero « wahou », sans sidebar)
// ─────────────────────────────────────────────────────────────────────────────

function PublicShell({
  children,
  pre,
}: {
  children: React.ReactNode;
  pre?: PreInscription;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const etablissementNom = pre?.etablissement?.nom;
  const etablissementVille = pre?.etablissement?.ville;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-gradient-to-br from-emerald-50 via-background to-amber-50">
      {/* Texture kente subtile en fond (max 8% opacity) */}
      <KentePattern variant="bg" className="opacity-[0.08]" />

      {/* Orbes décoratifs (glassmorphism léger) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-emerald-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-amber-200/30 blur-3xl"
      />

      {/* ─── Header « wahou » ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 shrink-0">
        {/* Strip kente top */}
        <KentePattern variant="strip" position="top" />

        {/* Bandeau gradient emerald→amber + glassmorphism */}
        <div className="relative border-b border-emerald-200/60 bg-gradient-to-r from-emerald-700 via-emerald-600 to-amber-500/90 backdrop-blur supports-[backdrop-filter]:bg-gradient-to-r supports-[backdrop-filter]:from-emerald-700/95 supports-[backdrop-filter]:via-emerald-600/95 supports-[backdrop-filter]:to-amber-500/85">
          <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Image
                  src="/logo.png"
                  alt="ScolaGest"
                  width={40}
                  height={40}
                  className="rounded-xl bg-white/95 p-0.5 shadow-md shadow-emerald-900/30 ring-1 ring-gold/40"
                />
                <span
                  aria-hidden
                  className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-gold text-[8px] font-bold text-emerald-900 ring-2 ring-white"
                >
                  ★
                </span>
              </div>
              <div className="min-w-0">
                <p className="font-display text-base font-bold leading-tight text-white">
                  Suivi de votre demande
                </p>
                <p className="break-words text-[11px] leading-tight text-emerald-50/90">
                  ScolaGest · Pré-inscription en ligne
                </p>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {/* Pill Phase 3 */}
              <span
                className="hidden items-center gap-1 rounded-full border border-white/40 bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur-sm sm:inline-flex"
                title="Phase 3 — Innovation pré-inscription en ligne"
              >
                <Sparkles className="size-3" />
                Phase 3
              </span>

              {/* Bouton « Contacter le secrétariat » desktop */}
              <Button
                asChild
                variant="outline"
                size="sm"
                className="hidden border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:inline-flex"
                title="Contacter le secrétariat"
              >
                <a href="#contact">
                  <Phone className="size-4" />
                  Contacter le secrétariat
                </a>
              </Button>

              {/* Bouton pré-inscription desktop */}
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden text-white hover:bg-white/20 hover:text-white md:inline-flex"
                title="Faire une nouvelle pré-inscription"
              >
                <Link href="/pre-inscription">
                  <GraduationCap className="size-4" />
                  Pré-inscription
                </Link>
              </Button>

              {/* Bouton pré-inscription mobile (icône seule) */}
              <Button
                asChild
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20 hover:text-white md:hidden"
                aria-label="Faire une nouvelle pré-inscription"
                title="Pré-inscription"
              >
                <Link href="/pre-inscription">
                  <GraduationCap className="size-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Bandeau établissement (si la pré-inscription est chargée) */}
        <AnimatePresence initial={false}>
          {etablissementNom ? (
            <motion.div
              key="etab-banner"
              initial={prefersReducedMotion ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden border-b border-emerald-200/60 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70"
            >
              <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-2 sm:px-6">
                <Badge
                  variant="outline"
                  className="border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                >
                  <School className="mr-1 size-3" aria-hidden="true" />
                  <span className="break-words leading-snug">
                    {etablissementNom}
                  </span>
                </Badge>
                {etablissementVille ? (
                  <Badge
                    variant="outline"
                    className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                  >
                    <MapPin className="mr-1 size-3" aria-hidden="true" />
                    <span className="break-words leading-snug">
                      {etablissementVille}
                    </span>
                  </Badge>
                ) : null}
                <span className="ml-auto hidden text-[11px] text-muted-foreground sm:inline">
                  Page publique · sans authentification
                </span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* KentePattern separator sous la nav */}
        <KentePattern variant="separator" />
      </header>

      {/* ─── Contenu principal ──────────────────────────────────────────────── */}
      <main className="relative z-10 mx-auto w-full max-w-5xl flex-1 px-4 py-8 pb-24 sm:px-6 sm:py-10 sm:pb-12">
        {children}
      </main>

      {/* ─── Footer enrichi ─────────────────────────────────────────────────── */}
      <footer
        id="contact"
        className="relative z-10 mt-auto overflow-hidden border-t border-gold/30 bg-gradient-to-b from-white/95 to-emerald-50/40 backdrop-blur supports-[backdrop-filter]:bg-white/85"
      >
        <KentePattern variant="strip" position="top" />
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          <div className="grid grid-cols-1 items-stretch gap-6 sm:grid-cols-3">
            <FooterBlock
              icon={<Landmark className="size-5 text-emerald-600" />}
              title="Établissement"
            >
              <p className="break-words font-medium leading-snug">
                {etablissementNom ?? "Groupe Scolaire Le Chandelier"}
              </p>
              <p className="break-words text-xs text-muted-foreground">
                {etablissementVille ? `${etablissementVille}, ` : "Dabou, "}
                Côte d&apos;Ivoire
              </p>
            </FooterBlock>

            <FooterBlock
              icon={<Phone className="size-5 text-emerald-600" />}
              title="Besoin d&apos;aide ?"
            >
              <p className="break-words text-sm leading-snug">
                Contactez le secrétariat pour toute question sur l&apos;étude
                de votre dossier ou les prochaines étapes.
              </p>
              <Button
                asChild
                size="sm"
                className="mt-2 bg-emerald-600 hover:bg-emerald-700"
                title="Contacter le secrétariat"
              >
                <a href="#contact">
                  <MessageSquare className="size-4" />
                  Contacter le secrétariat
                </a>
              </Button>
            </FooterBlock>

            <FooterBlock
              icon={<Mail className="size-5 text-emerald-600" />}
              title="ScolaGest"
            >
              <p className="break-words text-xs leading-snug text-muted-foreground">
                Application de Gestion &amp; Caisse Scolaire — Pré-inscription
                en ligne.
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Du lundi au vendredi, 8h à 16h.
              </p>
            </FooterBlock>
          </div>

          <KentePattern variant="separator" className="my-6" />

          <div className="flex flex-col items-center justify-between gap-2 text-[11px] text-muted-foreground sm:flex-row">
            <p>
              ScolaGest · Pré-inscription en ligne · Page publique sans
              authentification
            </p>
            <p>Groupe Scolaire Le Chandelier — Dabou, Côte d&apos;Ivoire</p>
          </div>
        </div>
      </footer>

      {/* ─── Bouton « Contacter le secrétariat » sticky mobile ─────────────── */}
      {/* Filet de sécurité à chaque statut — sticky en bas sur mobile uniquement */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-emerald-200/60 bg-white/85 backdrop-blur supports-[backdrop-filter]:bg-white/75 sm:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="break-words text-[11px] font-medium leading-tight text-muted-foreground">
              Une question sur votre dossier ?
            </p>
            <p className="break-words text-[10px] leading-tight text-muted-foreground">
              Le secrétariat vous répond sous 24-48h.
            </p>
          </div>
          <Button
            asChild
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700"
            title="Contacter le secrétariat"
          >
            <a href="#contact">
              <Phone className="size-4" />
              Contacter
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer block (3 colonnes)
// ─────────────────────────────────────────────────────────────────────────────

function FooterBlock({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="flex size-7 items-center justify-center rounded-md bg-emerald-50 ring-1 ring-emerald-200/60 dark:bg-emerald-950/40 dark:ring-emerald-900/40">
          {icon}
        </span>
        <span className="break-words leading-snug">{title}</span>
      </div>
      <div className="space-y-1 break-words text-sm leading-snug text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// États premium (pas de token, chargement, erreur)
// ─────────────────────────────────────────────────────────────────────────────

function NoTokenState() {
  return (
    <GlassCard
      variant="adaptive"
      noHover
      className="relative mx-auto max-w-md overflow-hidden border border-dashed"
    >
      <KentePattern variant="bg" />
      {/* Strip kente top */}
      <KentePattern variant="strip" position="top" className="!absolute inset-x-0 top-0" />
      <div className="relative flex flex-col items-center gap-3 px-4 py-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 shadow-lg shadow-amber-900/10 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertCircle className="size-7" />
        </div>
        <div>
          <p className="break-words text-base font-semibold">Token manquant</p>
          <p className="mx-auto mt-1 max-w-md break-words text-sm leading-snug text-muted-foreground">
            Aucun jeton de suivi n&apos;a été fourni dans l&apos;URL. Vérifiez
            le lien que vous avez reçu par e-mail ou SMS après votre
            pré-inscription.
          </p>
        </div>
        <Button
          asChild
          className="mt-2 bg-emerald-600 hover:bg-emerald-700"
          title="Faire une pré-inscription"
        >
          <Link href="/pre-inscription">
            <GraduationCap className="size-4" />
            Faire une pré-inscription
          </Link>
        </Button>
      </div>
    </GlassCard>
  );
}

function LoadingState() {
  return (
    <GlassCard
      variant="adaptive"
      noHover
      noAnimation
      className="relative mx-auto max-w-2xl overflow-hidden border border-dashed"
    >
      {/* Strip kente top */}
      <KentePattern variant="strip" position="top" className="!absolute inset-x-0 top-0" />
      <div className="relative flex flex-col items-center gap-3 px-4 py-16 text-center">
        <Loader2 className="size-10 animate-spin text-emerald-600" />
        <div>
          <p className="break-words text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            Récupération de votre pré-inscription…
          </p>
          <p className="mx-auto mt-1 max-w-md break-words text-xs leading-snug text-muted-foreground">
            Nous interrogeons le serveur ScolaGest avec votre jeton de suivi.
            Cela ne prend généralement que quelques secondes.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <GlassCard
      variant="adaptive"
      noHover
      className="relative mx-auto max-w-md overflow-hidden border border-dashed"
    >
      <KentePattern variant="bg" />
      <KentePattern variant="strip" position="top" className="!absolute inset-x-0 top-0" />
      <div className="relative flex flex-col items-center gap-3 px-4 py-12 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-rose-100 text-rose-700 shadow-lg shadow-rose-900/10 dark:bg-rose-950/40 dark:text-rose-300">
          <XCircle className="size-7" />
        </div>
        <div>
          <p className="break-words text-base font-semibold">Lien invalide</p>
          <p className="mx-auto mt-1 max-w-md break-words text-sm leading-snug text-muted-foreground">
            {message}
          </p>
        </div>
        <Button
          asChild
          className="mt-2 bg-emerald-600 hover:bg-emerald-700"
          title="Faire une nouvelle pré-inscription"
        >
          <Link href="/pre-inscription">
            <GraduationCap className="size-4" />
            Faire une nouvelle pré-inscription
          </Link>
        </Button>
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carte de suivi (succès)
// ─────────────────────────────────────────────────────────────────────────────

function SuiviCard({ pre }: { pre: PreInscription }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const eleveNomComplet = [pre.eleve_prenoms, pre.eleve_nom]
    .filter(Boolean)
    .join(" ")
    .trim();
  const tuteurNomComplet = [pre.tuteur_prenoms, pre.tuteur_nom]
    .filter(Boolean)
    .join(" ")
    .trim();

  // Cartes de détails (pour le stagger)
  const detailCards = [
    {
      id: "eleve",
      icon: User,
      title: "Élève",
      content: <EleveDetails pre={pre} nomComplet={eleveNomComplet} />,
    },
    {
      id: "tuteur",
      icon: Users,
      title: "Tuteur / Parent",
      content: <TuteurDetails pre={pre} nomComplet={tuteurNomComplet} />,
    },
    {
      id: "classe",
      icon: School,
      title:
        pre.statut === "VALIDEE" ? "Classe & notes" : "Classe souhaitée & notes",
      content: <ClasseDetails pre={pre} />,
    },
  ] as const;

  return (
    <div className="space-y-6">
      {/* ─── Stepper visuel (en haut) ─────────────────────────────────────── */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <Stepper
          statut={pre.statut}
          dateSoumission={pre.date_soumission}
          dateTraitement={pre.date_traitement ?? null}
        />
      </motion.div>

      {/* ─── Carte de statut (message contextuel) ─────────────────────────── */}
      <StatutCard pre={pre} />

      {/* ─── Cartes de détails premium ───────────────────────────────────── */}
      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2">
        {detailCards.map((card, idx) => {
          const Icon = card.icon;
          return (
            <GlassCard
              key={card.id}
              variant="adaptive"
              className={cn(
                "h-full p-5",
                card.id === "classe" && "md:col-span-2",
              )}
              delay={idx * 0.05}
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <Icon className="size-5" aria-hidden="true" />
                </div>
                <h2 className="break-words font-display text-base font-semibold leading-tight text-forest">
                  {card.title}
                </h2>
              </div>
              <Separator className="mb-3 bg-emerald-100/60 dark:bg-emerald-900/30" />
              {card.content}
            </GlassCard>
          );
        })}
      </div>

      {/* ─── Récap dossier discret (en bas) ───────────────────────────────── */}
      <RecapDossier pre={pre} nomEleve={eleveNomComplet} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carte de statut (message contextuel)
// ─────────────────────────────────────────────────────────────────────────────

function StatutCard({ pre }: { pre: PreInscription }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const config = STATUT_MSG[pre.statut];
  const Icon = config.icon;
  const isValidated = pre.statut === "VALIDEE";

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard
        variant="adaptive"
        premiumBorder
        noHover
        className="relative overflow-hidden p-0"
      >
        {/* Bandeau coloré selon statut */}
        <div
          className={cn(
            "relative overflow-hidden border-b p-5 sm:p-6",
            config.banner,
          )}
        >
          <KentePattern variant="bg" className="opacity-10" />
          <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              {/* Badge rond avec icône contextuelle (animée spring si VALIDEE) */}
              <motion.div
                initial={
                  prefersReducedMotion
                    ? false
                    : isValidated
                      ? { scale: 0, rotate: -45 }
                      : { scale: 0.8, opacity: 0 }
                }
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : {
                        type: "spring",
                        stiffness: 260,
                        damping: 18,
                        delay: 0.15,
                      }
                }
                className={cn(
                  "flex size-14 shrink-0 items-center justify-center rounded-2xl shadow-md",
                  config.badgeRound,
                )}
              >
                <Icon className="size-7" aria-hidden="true" />
              </motion.div>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={cn(
                      "px-2.5 py-0.5 text-xs font-semibold",
                      STATUT_BADGE_CLS[pre.statut],
                    )}
                  >
                    {STATUT_LABEL[pre.statut]}
                  </Badge>
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Statut de votre demande
                  </span>
                </div>
                <h1 className="break-words font-display text-xl font-bold leading-tight text-forest sm:text-2xl">
                  {config.title}
                </h1>
                <p className="max-w-2xl break-words text-sm leading-snug text-muted-foreground">
                  {config.subtitle}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Détails contextuels (motif rejet / prochaines étapes validation) */}
        <div className="space-y-4 p-5 sm:p-6">
          {/* Soumission + traitement (dates) */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailRow
              label="Demande soumise le"
              value={formatDateTime(pre.date_soumission)}
              icon={<CalendarDays className="size-3.5" />}
            />
            <DetailRow
              label="Dernier traitement"
              value={
                pre.date_traitement
                  ? formatDateTime(pre.date_traitement)
                  : "En attente"
              }
              icon={<Clock className="size-3.5" />}
            />
          </div>

          {/* Motif du rejet (si REJETEE) */}
          {pre.statut === "REJETEE" && pre.notes_staff ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 dark:border-rose-900/50 dark:bg-rose-950/30">
              <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-rose-800 dark:text-rose-300">
                <XCircle className="size-3.5" />
                Motif du rejet
              </p>
              <p className="break-words whitespace-pre-wrap text-sm leading-snug text-rose-900 dark:text-rose-100">
                {pre.notes_staff}
              </p>
            </div>
          ) : null}

          {/* Prochaines étapes (si VALIDEE) */}
          {isValidated ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 className="size-3.5" />
                Prochaines étapes
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <ProchaineEtape
                  icon={<Wallet className="size-4" />}
                  label="Paiement des frais"
                  description="Réglez les frais d'inscription à la caisse de l'établissement."
                />
                <ProchaineEtape
                  icon={<FileText className="size-4" />}
                  label="Documents à apporter"
                  description="Extrait de naissance, photos, bulletins précédents."
                />
                <ProchaineEtape
                  icon={<School className="size-4" />}
                  label="Classe attribuée"
                  description="La classe de votre enfant sera communiquée après paiement."
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  asChild
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  title="Accéder au portail parent"
                >
                  <Link href="/parent">
                    <Users className="size-4" />
                    Accéder au portail parent
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                  title="Contacter le secrétariat"
                >
                  <a href="#contact">
                    <MessageSquare className="size-4" />
                    Contacter le secrétariat
                  </a>
                </Button>
              </div>
            </div>
          ) : null}

          {/* Notes du secrétariat (si VALIDEE avec notes) */}
          {isValidated && pre.notes_staff ? (
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Notes du secrétariat
              </p>
              <p className="break-words whitespace-pre-wrap rounded-md bg-emerald-50 p-3 text-sm leading-snug text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                {pre.notes_staff}
              </p>
            </div>
          ) : null}
        </div>
      </GlassCard>
    </motion.div>
  );
}

function ProchaineEtape({
  icon,
  label,
  description,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-emerald-100 bg-white/60 p-2.5 dark:border-emerald-900/30 dark:bg-emerald-950/20">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        {icon}
      </div>
      <div className="min-w-0 space-y-0.5">
        <p className="break-words text-xs font-semibold leading-snug text-emerald-900 dark:text-emerald-100">
          {label}
        </p>
        <p className="break-words text-[11px] leading-snug text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stepper visuel 3 étapes : Soumise → En revue → Validée / Rejetée
// ─────────────────────────────────────────────────────────────────────────────

type StepDef = {
  key: StatutPreInscription;
  label: string;
  icon: LucideIcon;
  reached: boolean;
  isCurrent: boolean;
  isTerminal?: boolean;
  isError?: boolean;
  /** Texte secondaire affiché sous le label (date ou statut). */
  hint: string;
};

function Stepper({
  statut,
  dateSoumission,
  dateTraitement,
}: {
  statut: StatutPreInscription;
  dateSoumission: string;
  dateTraitement: string | null;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();

  // Construction des étapes — SOUMISE → EN_REVUE → VALIDEE/REJETEE
  const steps: StepDef[] = [
    {
      key: "SOUMISE",
      label: "Soumise",
      icon: Clock,
      reached: true,
      isCurrent: statut === "SOUMISE",
      hint: formatDate(dateSoumission),
    },
    {
      key: "EN_REVUE",
      label: "En revue",
      icon: User,
      reached:
        statut === "EN_REVUE" || statut === "VALIDEE" || statut === "REJETEE",
      isCurrent: statut === "EN_REVUE",
      hint:
        statut === "EN_REVUE"
          ? "En cours de traitement"
          : statut === "SOUMISE"
            ? "En attente"
            : "Examinée",
    },
    // La 3ᵉ étape est dynamique (Validée ou Rejetée)
    statut === "REJETEE"
      ? {
          key: "REJETEE",
          label: "Rejetée",
          icon: XCircle,
          reached: true,
          isCurrent: true,
          isTerminal: true,
          isError: true,
          hint: dateTraitement ? formatDate(dateTraitement) : "Refusée",
        }
      : {
          key: "VALIDEE",
          label: "Validée",
          icon: CheckCircle2,
          reached: statut === "VALIDEE",
          isCurrent: statut === "VALIDEE",
          isTerminal: true,
          isError: false,
          hint:
            statut === "VALIDEE"
              ? dateTraitement
                ? formatDate(dateTraitement)
                : "Inscription créée"
              : "En attente",
        },
  ];

  return (
    <GlassCard
      variant="desktop"
      noHover
      noAnimation
      className="relative overflow-hidden p-4 sm:p-5"
    >
      <KentePattern variant="bg" className="opacity-[0.06]" />

      {/* Titre du stepper */}
      <div className="relative mb-4 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="size-3.5 text-emerald-600" aria-hidden="true" />
          Progression de votre dossier
        </p>
        <Badge
          className={cn("px-2.5 py-0.5 text-xs font-semibold", STATUT_BADGE_CLS[statut])}
        >
          {STATUT_LABEL[statut]}
        </Badge>
      </div>

      {/* Stepper — vertical sur mobile, horizontal sur desktop */}
      {/* Mobile (vertical) */}
      <ol className="relative space-y-4 sm:hidden">
        {steps.map((s, idx) => {
          const Icon = s.icon;
          const isLast = idx === steps.length - 1;
          const nextStep = steps[idx + 1];
          return (
            <li
              key={s.key}
              className="relative flex items-start gap-3"
            >
              {/* Point + ligne verticale */}
              <div className="flex flex-col items-center">
                <StepDot
                  step={s}
                  prefersReducedMotion={prefersReducedMotion}
                />
                {!isLast ? (
                  <div
                    aria-hidden
                    className={cn(
                      "w-0.5 flex-1 self-stretch",
                      nextStep?.reached
                        ? nextStep?.isError
                          ? "bg-gradient-to-b from-rose-400 to-rose-300"
                          : "bg-gradient-to-b from-emerald-500 to-amber-400"
                        : "bg-muted",
                    )}
                    style={{ minHeight: 24 }}
                  />
                ) : null}
              </div>
              {/* Contenu */}
              <div className={cn("flex-1 pb-1", !isLast && "min-h-[3rem]")}>
                <p
                  className={cn(
                    "break-words text-sm font-semibold leading-tight",
                    s.reached
                      ? s.isError
                        ? "text-rose-700 dark:text-rose-300"
                        : s.isCurrent
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {s.label}
                </p>
                <p className="break-words text-[11px] leading-snug text-muted-foreground">
                  {s.hint}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Desktop (horizontal) */}
      <ol className="hidden items-start gap-0 sm:flex">
        {steps.map((s, idx) => {
          const Icon = s.icon;
          const isLast = idx === steps.length - 1;
          const nextStep = steps[idx + 1];
          return (
            <li
              key={s.key}
              className="flex flex-1 items-start gap-2"
            >
              <div className="flex flex-col items-center gap-1.5">
                <StepDot
                  step={s}
                  prefersReducedMotion={prefersReducedMotion}
                />
                <div className="text-center">
                  <p
                    className={cn(
                      "break-words text-xs font-semibold leading-tight",
                      s.reached
                        ? s.isError
                          ? "text-rose-700 dark:text-rose-300"
                          : s.isCurrent
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {s.label}
                  </p>
                  <p className="break-words text-[10px] leading-snug text-muted-foreground">
                    {s.hint}
                  </p>
                </div>
              </div>
              {/* Ligne de progression horizontale */}
              {!isLast ? (
                <div
                  aria-hidden
                  className={cn(
                    "mx-1 mt-5 h-0.5 flex-1 rounded-full",
                    nextStep?.reached
                      ? nextStep?.isError
                        ? "bg-gradient-to-r from-rose-400 to-rose-300"
                        : "bg-gradient-to-r from-emerald-500 to-amber-400"
                      : "bg-muted",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </GlassCard>
  );
}

/** Point du stepper (cercle avec icône). */
function StepDot({
  step,
  prefersReducedMotion,
}: {
  step: StepDef;
  prefersReducedMotion: boolean;
}) {
  const Icon = step.icon;
  const showCheck =
    step.reached && !step.isCurrent && !step.isError;
  return (
    <div className="relative flex shrink-0 items-center justify-center">
      {/* Pulse subtil sur l'étape courante */}
      {step.isCurrent && !prefersReducedMotion ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-ping rounded-full border-2 border-emerald-500/40"
        />
      ) : null}
      <div
        className={cn(
          "relative flex size-10 items-center justify-center rounded-full border-2 transition-all",
          step.reached
            ? step.isError
              ? "border-rose-500 bg-rose-500 text-white shadow-md shadow-rose-500/30"
              : step.isCurrent
                ? "border-emerald-600 bg-emerald-50 text-emerald-700 ring-4 ring-emerald-500/15 dark:bg-emerald-950/40 dark:text-emerald-300"
                : step.key === "VALIDEE"
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                  : step.key === "EN_REVUE"
                    ? "border-sky-500 bg-sky-500 text-white shadow-md shadow-sky-500/30"
                    : "border-amber-500 bg-amber-500 text-white shadow-md shadow-amber-500/30"
            : "border-muted bg-background text-muted-foreground",
          step.isCurrent && "scale-110",
        )}
      >
        {showCheck ? (
          <CheckCircle2 className="size-5" aria-hidden="true" />
        ) : (
          <Icon className="size-5" aria-hidden="true" />
        )}
        <span className="sr-only">{step.label}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Cartes de détails premium (Élève / Tuteur / Classe)
// ─────────────────────────────────────────────────────────────────────────────

function EleveDetails({
  pre,
  nomComplet,
}: {
  pre: PreInscription;
  nomComplet: string;
}) {
  return (
    <div className="space-y-3">
      <DetailRow
        label="Nom complet"
        value={nomComplet || "—"}
        icon={<User className="size-3.5" />}
      />
      <DetailRow
        label="Date de naissance"
        value={
          pre.eleve_date_naissance
            ? formatDate(pre.eleve_date_naissance)
            : "—"
        }
        icon={<CalendarDays className="size-3.5" />}
      />
      <DetailRow
        label="Lieu de naissance"
        value={pre.eleve_lieu_naissance || "—"}
        icon={<MapPin className="size-3.5" />}
      />
      <DetailRow label="Sexe" value={sexeLabel(pre.eleve_sexe)} />
      <DetailRow
        label="Catégorie"
        value={categorieLabel(pre.eleve_categorie)}
      />
    </div>
  );
}

function TuteurDetails({
  pre,
  nomComplet,
}: {
  pre: PreInscription;
  nomComplet: string;
}) {
  return (
    <div className="space-y-3">
      <DetailRow
        label="Nom complet"
        value={nomComplet || "—"}
        icon={<Users className="size-3.5" />}
      />
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
      <DetailRow
        label="Lien de parenté"
        value={lienParenteLabel(pre.tuteur_lien_parente)}
      />
    </div>
  );
}

function ClasseDetails({ pre }: { pre: PreInscription }) {
  return (
    <div className="space-y-3">
      {/* Classe souhaitée / Classe attribuée */}
      {pre.statut === "VALIDEE" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
            <School className="size-3.5" />
            Classe attribuée
          </p>
          <p className="mt-1 break-words text-sm leading-snug text-amber-700 dark:text-amber-400">
            La classe de votre enfant sera communiquée après le paiement des
            frais d&apos;inscription à la caisse de l&apos;établissement.
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

      {pre.notes_parent ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Message du parent
          </p>
          <p className="break-words whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm leading-snug">
            {pre.notes_parent}
          </p>
        </div>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Récap dossier discret (en bas)
// ─────────────────────────────────────────────────────────────────────────────

function RecapDossier({
  pre,
  nomEleve,
}: {
  pre: PreInscription;
  nomEleve: string;
}) {
  return (
    <GlassCard
      variant="adaptive"
      noHover
      noAnimation
      className="relative overflow-hidden border border-dashed p-5"
    >
      <KentePattern variant="bg" className="opacity-[0.06]" />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-emerald-50 ring-1 ring-emerald-200/60 dark:bg-emerald-950/40 dark:ring-emerald-900/40">
            <Hash className="size-3.5 text-emerald-600" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Récapitulatif du dossier
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* Avatar élève */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-600 font-bold text-white ring-2 ring-gold/60">
                <span className="text-sm">{initials(pre.eleve_nom, pre.eleve_prenoms)}</span>
              </div>
              <span
                aria-hidden
                className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-gold text-[8px] text-emerald-900 ring-2 ring-white"
              >
                ★
              </span>
            </div>
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold leading-tight text-foreground">
                {nomEleve || "Élève"}
              </p>
              <p className="break-words text-[11px] leading-tight text-muted-foreground">
                Élève à inscrire
              </p>
            </div>
          </div>

          <Separator
            orientation="vertical"
            className="hidden h-12 bg-emerald-100/60 dark:bg-emerald-900/30 sm:block"
          />

          {/* Infos dossier */}
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3">
            <DetailRow
              label="Établissement"
              value={pre.etablissement?.nom ?? "—"}
              icon={<Landmark className="size-3.5" />}
            />
            <DetailRow
              label="Classe souhaitée"
              value={
                pre.statut === "VALIDEE"
                  ? "À communiquer"
                  : pre.classe
                    ? pre.classe.libelle
                    : "Non précisée"
              }
              icon={<School className="size-3.5" />}
            />
            <DetailRow
              label="Date soumission"
              value={formatDate(pre.date_soumission)}
              icon={<CalendarDays className="size-3.5" />}
            />
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DetailRow — ligne d'info compacte (BUG À ÉVITER #4 : flex items-start + mt-0.5)
// ─────────────────────────────────────────────────────────────────────────────

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
      <span className="break-words text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="flex items-start gap-1.5 text-right text-sm font-medium">
        {icon ? (
          <span className="mt-0.5 text-emerald-600 dark:text-emerald-400">
            {icon}
          </span>
        ) : null}
        <span className="break-words leading-snug">{value}</span>
      </span>
    </div>
  );
}
