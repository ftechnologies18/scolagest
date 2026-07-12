"use client";

/**
 * ScolaGest — Wizard d'inscription (Phase 2 — Refonte Forêt EdTech).
 *
 * Orchestrateur multi-étapes qui crée en une passe (transaction atomique
 * backend) : élève + tuteur + inscription dans une classe pour une année.
 *
 * Étapes :
 *  1. Identité de l'élève (avec détection de doublon + aperçu identifiant auto)
 *  2. Tuteur/Parent (recherche existant par téléphone ou nouveau)
 *  3. Scolarité (cycle → niveau → classe, aperçu frais, dérogation)
 *  4. Récapitulatif + soumission + fiche de succès
 *
 * L'état global est géré ici et passé aux étapes. La soumission finale appelle
 * POST /api/inscriptions/workflow.
 *
 * Refonte Forêt EdTech :
 *  - Bande kente top avant le hero header.
 *  - Hero header en `GlassCard variant="desktop"` avec badge rond gradient
 *    emerald→amber (icône GraduationCap), titre `font-display text-2xl` et
 *    pill "4 étapes" en emerald.
 *  - StepIndicator enveloppé dans une `GlassCard variant="desktop"` subtile.
 *    Les cercles : Done (emerald-600 + Check), Current (ring emerald + pulse
 *    subtil), Pending (border-muted). Lignes de progression gradient
 *    emerald→amber pour les segments done. Mobile : mode compact (cercles
 *    seulement, labels cachés).
 *  - Card d'étape : `GlassCard variant="adaptive"` + padding `p-6`.
 *  - Navigation footer : bouton Précédent (outline + ChevronLeft), indicateur
 *    "Étape X sur 4" centré, bouton Suivant (variant success + ChevronRight),
 *    bouton "Valider l'inscription" (variant success + Check) sur l'étape 4.
 *    Sur mobile : boutons full-width empilés + sticky en bas (backdrop-blur).
 *  - SuccessView premium : `GlassCard variant="desktop"` + `premiumBorder`
 *    (effet carte de réussite gold), bandeau gradient emerald→amber, icône
 *    PartyPopper dans un badge rond gold avec animation spring, grille
 *    d'InfoRow 2 colonnes desktop / 1 colonne mobile, alerte paiement requis
 *    amber-toned, `KentePattern variant="bg"` décoratif en fond.
 *  - Empty state (pas d'établissement) : `KentePattern variant="bg"` +
 *    illustration `GraduationCap` dans badge gradient.
 *
 * LOGIQUE MÉTIER INTACTE : hooks, mutations, query keys, DTOs, types,
 * endpoints API, signatures de fonctions.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  User,
  Users,
  GraduationCap,
  ClipboardCheck,
  AlertCircle,
  PartyPopper,
  Fingerprint,
  IdCard,
  CalendarDays,
  Phone,
  type LucideIcon,
} from "lucide-react";

import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/hooks/use-toast";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { ApiError } from "@/lib/api-client";
import {
  submitInscriptionWorkflow,
  type WorkflowDTO,
  type WorkflowEleve,
  type WorkflowTuteur,
  type WorkflowInscription,
  type WorkflowResult,
} from "@/lib/api-inscription";

import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { StepEleve } from "./step-eleve";
import { StepTuteur } from "./step-tuteur";
import { StepScolarite } from "./step-scolarite";
import { StepRecap } from "./step-recap";

// ─────────────────────────────────────────────────────────────────────────────
// Types d'étape
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Élève", icon: User, description: "Identité de l'élève" },
  { id: 2, label: "Tuteur", icon: Users, description: "Parent / tuteur légal" },
  { id: 3, label: "Scolarité", icon: GraduationCap, description: "Classe & année" },
  { id: 4, label: "Récap", icon: ClipboardCheck, description: "Vérification & validation" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Wizard
// ─────────────────────────────────────────────────────────────────────────────

export function InscriptionWizard() {
  const router = useRouter();
  const { toast } = useToast();
  const etablissement = useAuthStore((s) => s.etablissement);

  const [step, setStep] = React.useState(1);

  // État global du wizard
  const [eleveData, setEleveData] = React.useState<WorkflowEleve>({
    nom: "",
    prenoms: "",
    date_naissance: null,
    lieu_naissance: "",
    sexe: "",
    categorie: "NON_APPLICABLE",
    matricule_ministere: null,
  });

  const [tuteurData, setTuteurData] = React.useState<WorkflowTuteur>({
    tuteur_id: null,
    nom: "",
    prenoms: "",
    telephone: "",
    telephone2: "",
    email: "",
    adresse: "",
    lien_parente: "PERE",
    profession: "",
  });

  const [inscriptionData, setInscriptionData] =
    React.useState<WorkflowInscription>({
      classe_id: "",
      annee_scolaire_id: "",
      statut: "INSCRIT",
      derogation_inscription: false,
      motif_derogation: "",
      notes: "",
    });

  // Validation par étape (booléen — chaque étape expose sa propre validité)
  const [stepValid, setStepValid] = React.useState<Record<number, boolean>>({
    1: false,
    2: false,
    3: false,
    4: true,
  });

  // Callbacks mémorisés (évitent les boucles infinies de useEffect dans les
  // étapes : si on passait des fonctions inline, elles seraient recréées à
  // chaque render du wizard, déclenchant les effets de validation à chaque
  // fois → "Maximum update depth exceeded").
  const setStep1Valid = React.useCallback(
    (v: boolean) => setStepValid((s) => ({ ...s, 1: v })),
    [],
  );
  const setStep2Valid = React.useCallback(
    (v: boolean) => setStepValid((s) => ({ ...s, 2: v })),
    [],
  );
  const setStep3Valid = React.useCallback(
    (v: boolean) => setStepValid((s) => ({ ...s, 3: v })),
    [],
  );

  // Résultat du workflow (affiché sur l'étape 4 après succès)
  const [result, setResult] = React.useState<WorkflowResult | null>(null);

  // Mutation de soumission
  const mutation = useMutation({
    mutationFn: (dto: WorkflowDTO) => submitInscriptionWorkflow(dto),
    onSuccess: (data) => {
      setResult(data);
      toast({
        title: "Pré-inscription réussie",
        description: `${data.eleve.prenoms} ${data.eleve.nom} a été pré-inscrit(e). Paiement des frais d'inscription requis pour validation définitive.`,
      });
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Une erreur est survenue lors de l'inscription.";
      toast({
        title: "Échec de l'inscription",
        description: msg,
        variant: "destructive",
      });
    },
  });

  // ─── Navigation ──────────────────────────────────────────────────────────
  const canGoNext = stepValid[step];
  const canGoPrev = step > 1;

  function next() {
    if (!canGoNext) return;
    if (step < 4) setStep(step + 1);
  }

  function prev() {
    if (canGoPrev) setStep(step - 1);
  }

  function handleSubmit() {
    const dto: WorkflowDTO = {
      eleve: eleveData,
      tuteur: tuteurData,
      inscription: inscriptionData,
    };
    mutation.mutate(dto);
  }

  function handleReset() {
    setStep(1);
    setResult(null);
    setEleveData({
      nom: "",
      prenoms: "",
      date_naissance: null,
      lieu_naissance: "",
      sexe: "",
      categorie: "NON_APPLICABLE",
      matricule_ministere: null,
    });
    setTuteurData({
      tuteur_id: null,
      nom: "",
      prenoms: "",
      telephone: "",
      telephone2: "",
      email: "",
      adresse: "",
      lien_parente: "PERE",
      profession: "",
    });
    setInscriptionData({
      classe_id: "",
      annee_scolaire_id: "",
      statut: "INSCRIT",
      derogation_inscription: false,
      motif_derogation: "",
      notes: "",
    });
  }

  // ─── Pas d'établissement ──────────────────────────────────────────────────
  if (!etablissement) {
    return (
      <div className="mx-auto max-w-2xl">
        <KentePattern variant="strip" position="top" />
        <div className="mt-6 flex min-h-[60vh] items-center justify-center">
          <GlassCard variant="desktop" noHover className="relative w-full overflow-hidden p-8 text-center">
            <KentePattern variant="bg" />
            <div className="relative space-y-4">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-terracotta text-white shadow-lg shadow-amber-900/20">
                <AlertCircle className="size-8" aria-hidden="true" />
              </div>
              <div className="space-y-1.5">
                <h2 className="font-display text-xl font-semibold text-forest">
                  Établissement requis
                </h2>
                <p className="mx-auto max-w-md text-sm text-muted-foreground">
                  Sélectionnez un établissement dans la barre latérale avant
                  d&apos;enregistrer une nouvelle inscription.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  // ─── Succès : afficher la fiche ───────────────────────────────────────────
  if (result) {
    return <SuccessView result={result} onReset={handleReset} onGoEleves={() => router.push("/eleves")} />;
  }

  // ─── Wizard ───────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24 sm:pb-0">
      {/* Bande kente top */}
      <KentePattern variant="strip" position="top" />

      {/* Hero header */}
      <GlassCard variant="desktop" noHover className="p-5 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3.5">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-amber-500 text-white shadow-md shadow-emerald-900/20">
              <GraduationCap className="size-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <h1 className="font-display text-xl font-semibold tracking-tight text-forest sm:text-2xl">
                Nouvelle inscription
              </h1>
              <p className="text-sm text-muted-foreground">
                {etablissement.nom} — Enregistrez un nouvel élève en 4 étapes.
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 sm:self-auto">
            <ClipboardCheck className="size-3.5" aria-hidden="true" />
            4 étapes
          </span>
        </div>
      </GlassCard>

      {/* Indicateur d'étapes */}
      <StepIndicator currentStep={step} />

      {/* Contenu de l'étape */}
      <GlassCard variant="adaptive" noHover className="p-5 sm:p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {step === 1 && (
              <StepEleve
                data={eleveData}
                onChange={setEleveData}
                onValidChange={setStep1Valid}
              />
            )}
            {step === 2 && (
              <StepTuteur
                data={tuteurData}
                onChange={setTuteurData}
                onValidChange={setStep2Valid}
              />
            )}
            {step === 3 && (
              <StepScolarite
                data={inscriptionData}
                eleveCategorie={eleveData.categorie}
                onChange={setInscriptionData}
                onValidChange={setStep3Valid}
              />
            )}
            {step === 4 && (
              <StepRecap
                eleve={eleveData}
                tuteur={tuteurData}
                inscription={inscriptionData}
                isSubmitting={mutation.isPending}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </GlassCard>

      {/* Navigation — sticky sur mobile */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t border-emerald-100/60 bg-background/85 px-4 py-3 backdrop-blur-md dark:border-emerald-900/30 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none">
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={prev}
            disabled={!canGoPrev || mutation.isPending}
            className="w-full sm:w-auto"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
            Précédent
          </Button>

          <span className="order-first text-center text-sm text-muted-foreground sm:order-none">
            Étape <span className="font-semibold text-forest">{step}</span> sur{" "}
            {STEPS.length}
          </span>

          {step < 4 ? (
            <Button
              type="button"
              onClick={next}
              disabled={!canGoNext}
              variant="success"
              className="w-full sm:w-auto"
            >
              Suivant
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={!canGoNext || mutation.isPending}
              variant="success"
              className="w-full shadow-lg shadow-emerald-900/20 sm:w-auto"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Inscription en cours…
                </>
              ) : (
                <>
                  <Check className="size-4" aria-hidden="true" />
                  Valider l&apos;inscription
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Indicateur d'étapes
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  return (
    <GlassCard variant="desktop" noHover className="p-4 sm:p-5">
      {/* Desktop : cercles + labels + lignes de progression */}
      <div className="hidden items-center justify-between gap-2 sm:flex">
        {STEPS.map((s, idx) => {
          const Icon = s.icon;
          const isDone = currentStep > s.id;
          const isCurrent = currentStep === s.id;
          return (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={[
                    "relative flex size-10 items-center justify-center rounded-full border-2 transition-all",
                    isDone
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                      : isCurrent
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700 ring-4 ring-emerald-500/15 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "border-muted bg-background text-muted-foreground",
                  ].join(" ")}
                >
                  {/* Pulse subtil sur l'étape courante */}
                  {isCurrent && !prefersReducedMotion ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 animate-ping rounded-full border-2 border-emerald-500/40"
                    />
                  ) : null}
                  {isDone ? (
                    <Check className="size-5" aria-hidden="true" />
                  ) : (
                    <Icon className="size-5" aria-hidden="true" />
                  )}
                  <span className="sr-only">Étape {s.id}</span>
                </div>
                <div className="text-center">
                  <p
                    className={[
                      "text-xs font-medium",
                      isCurrent || isDone ? "text-foreground" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {s.label}
                  </p>
                  <p className="hidden text-[10px] text-muted-foreground md:block">
                    {s.description}
                  </p>
                </div>
              </div>
              {idx < STEPS.length - 1 ? (
                <div
                  className={[
                    "h-0.5 flex-1 rounded-full transition-colors",
                    isDone
                      ? "bg-gradient-to-r from-emerald-500 to-amber-500"
                      : "bg-muted",
                  ].join(" ")}
                  aria-hidden="true"
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </div>

      {/* Mobile : mode compact — cercles + numéros + ligne fine */}
      <div className="flex items-center justify-between gap-1 sm:hidden">
        {STEPS.map((s, idx) => {
          const isDone = currentStep > s.id;
          const isCurrent = currentStep === s.id;
          return (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={[
                    "flex size-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                    isDone
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : isCurrent
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/20"
                        : "border-muted bg-background text-muted-foreground",
                  ].join(" ")}
                >
                  {isDone ? (
                    <Check className="size-4" aria-hidden="true" />
                  ) : (
                    s.id
                  )}
                </div>
                <span
                  className={[
                    "text-[10px] font-medium",
                    isCurrent ? "text-emerald-700" : isDone ? "text-foreground" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 ? (
                <div
                  className={[
                    "h-0.5 flex-1 rounded-full",
                    isDone
                      ? "bg-gradient-to-r from-emerald-500 to-amber-500"
                      : "bg-muted",
                  ].join(" ")}
                  aria-hidden="true"
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Vue de succès
// ─────────────────────────────────────────────────────────────────────────────

function SuccessView({
  result,
  onReset,
  onGoEleves,
}: {
  result: WorkflowResult;
  onReset: () => void;
  onGoEleves: () => void;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { eleve, inscription } = result;
  const classeLibelle = inscription.classe?.libelle ?? "—";
  const anneeLibelle = inscription.annee_scolaire?.libelle ?? "—";

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-24 sm:pb-0">
      <KentePattern variant="strip" position="top" />

      <motion.div
        initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <GlassCard
          variant="desktop"
          premiumBorder
          noHover
          className="relative overflow-hidden p-0"
        >
          {/* Kente bg décoratif subtil */}
          <KentePattern variant="bg" />

          {/* Bandeau succès : gradient emerald→amber */}
          <div className="relative bg-gradient-to-r from-emerald-600 via-emerald-600 to-amber-500 px-6 py-8 text-center text-white">
            <motion.div
              initial={prefersReducedMotion ? {} : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-white/25 ring-4 ring-white/30 backdrop-blur"
            >
              <PartyPopper className="size-8" aria-hidden="true" />
            </motion.div>
            <h2 className="font-display text-2xl font-bold tracking-tight">
              Pré-inscription réussie !
            </h2>
            <p className="mt-1 text-sm text-emerald-50">
              {eleve.prenoms} {eleve.nom} a été pré-inscrit(e) avec succès.
            </p>
          </div>

          {/* Récap élève */}
          <div className="relative space-y-5 p-6">
            <div className="grid grid-cols-1 gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
              <InfoRow
                icon={Fingerprint}
                label="Identifiant interne"
                value={eleve.identifiant_interne}
                mono
              />
              <InfoRow
                icon={IdCard}
                label="Matricule Min."
                value={eleve.matricule_ministere || "—"}
                mono
              />
              <InfoRow
                icon={User}
                label="Nom complet"
                value={[eleve.prenoms, eleve.nom].filter(Boolean).join(" ")}
              />
              <InfoRow
                icon={User}
                label="Sexe"
                value={
                  eleve.sexe === "M" ? "Masculin" : eleve.sexe === "F" ? "Féminin" : "—"
                }
              />
              <InfoRow
                icon={GraduationCap}
                label="Classe"
                value={classeLibelle}
              />
              <InfoRow
                icon={CalendarDays}
                label="Année scolaire"
                value={anneeLibelle}
              />
              <InfoRow
                icon={Users}
                label="Tuteur"
                value={
                  eleve.tuteur
                    ? [eleve.tuteur.prenoms, eleve.tuteur.nom].filter(Boolean).join(" ")
                    : "—"
                }
              />
              <InfoRow
                icon={Phone}
                label="Téléphone tuteur"
                value={eleve.tuteur?.telephone ?? "—"}
              />
            </div>

            {/* Kente separator */}
            <KentePattern variant="separator" />

            {/* Alerte paiement requis — amber-toned */}
            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50/80 p-3.5 dark:border-amber-900/50 dark:bg-amber-950/20">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600" aria-hidden="true" />
              <div className="space-y-0.5 text-sm">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Paiement des frais d&apos;inscription requis
                </p>
                <p className="text-amber-800 dark:text-amber-300">
                  L&apos;élève est actuellement <strong>pré-inscrit</strong>. Son
                  inscription sera définitivement validée après le paiement des
                  frais d&apos;inscription à la caisse.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <Button
                onClick={onGoEleves}
                variant="success"
                className="flex-1 shadow-lg shadow-emerald-900/20"
              >
                Voir la fiche élève
              </Button>
              <Button variant="outline" onClick={onReset} className="flex-1">
                Nouvelle inscription
              </Button>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Icon className="size-4" aria-hidden="true" />
      </div>
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={[
            "font-medium leading-snug break-words text-foreground",
            mono ? "font-mono text-emerald-700 dark:text-emerald-300" : "",
          ].join(" ")}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
