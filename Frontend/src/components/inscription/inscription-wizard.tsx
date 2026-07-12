"use client";

/**
 * ScolaGest — Wizard d'inscription (Phase 2).
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
} from "lucide-react";

import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/hooks/use-toast";
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
import { Card, CardContent } from "@/components/ui/card";
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
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="size-10 text-amber-500" />
            <p className="text-base font-medium">Établissement requis</p>
            <p className="text-sm text-muted-foreground">
              Sélectionnez un établissement dans la barre latérale pour
              enregistrer une nouvelle inscription.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Succès : afficher la fiche ───────────────────────────────────────────
  if (result) {
    return <SuccessView result={result} onReset={handleReset} onGoEleves={() => router.push("/eleves")} />;
  }

  // ─── Wizard ───────────────────────────────────────────────────────────────
  const CurrentStepIcon = STEPS[step - 1].icon;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* En-tête */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Nouvelle inscription</h1>
        <p className="text-sm text-muted-foreground">
          {etablissement.nom} — Enregistrez un nouvel élève en 4 étapes.
        </p>
      </div>

      {/* Indicateur d'étapes */}
      <StepIndicator currentStep={step} />

      {/* Contenu de l'étape */}
      <Card>
        <CardContent className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
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
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={prev}
          disabled={!canGoPrev || mutation.isPending}
        >
          <ChevronLeft className="size-4" />
          Précédent
        </Button>

        <span className="text-sm text-muted-foreground">
          Étape {step} sur {STEPS.length}
        </span>

        {step < 4 ? (
          <Button onClick={next} disabled={!canGoNext}>
            Suivant
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button
            onClick={handleSubmit}
            disabled={!canGoNext || mutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Inscription en cours…
              </>
            ) : (
              <>
                <Check className="size-4" />
                Valider l&apos;inscription
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Indicateur d'étapes
// ─────────────────────────────────────────────────────────────────────────────

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      {STEPS.map((s, idx) => {
        const Icon = s.icon;
        const isDone = currentStep > s.id;
        const isCurrent = currentStep === s.id;
        return (
          <React.Fragment key={s.id}>
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  "flex size-10 items-center justify-center rounded-full border-2 transition-colors",
                  isDone
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : isCurrent
                      ? "border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40"
                      : "border-muted bg-background text-muted-foreground",
                ].join(" ")}
              >
                {isDone ? (
                  <Check className="size-5" />
                ) : (
                  <Icon className="size-5" />
                )}
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
                <p className="hidden text-[10px] text-muted-foreground sm:block">
                  {s.description}
                </p>
              </div>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={[
                  "h-0.5 flex-1 transition-colors",
                  isDone ? "bg-emerald-600" : "bg-muted",
                ].join(" ")}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
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
  const { eleve, inscription } = result;
  const classeLibelle =
    inscription.classe?.libelle ?? "—";
  const anneeLibelle =
    inscription.annee_scolaire?.libelle ?? "—";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="overflow-hidden border-emerald-200">
          {/* Bandeau succès */}
          <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-8 text-center text-white">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mx-auto mb-3 flex size-16 items-center justify-center rounded-full bg-white/20 backdrop-blur"
            >
              <PartyPopper className="size-8" />
            </motion.div>
            <h2 className="text-2xl font-bold">Pré-inscription réussie !</h2>
            <p className="mt-1 text-emerald-50">
              {eleve.prenoms} {eleve.nom} a été pré-inscrit(e) avec succès.
            </p>
          </div>

          {/* Récap élève */}
          <CardContent className="space-y-4 p-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <InfoRow label="Identifiant interne" value={eleve.identifiant_interne} mono />
              <InfoRow label="Matricule Min." value={eleve.matricule_ministere || "—"} mono />
              <InfoRow
                label="Nom complet"
                value={[eleve.prenoms, eleve.nom].filter(Boolean).join(" ")}
              />
              <InfoRow label="Sexe" value={eleve.sexe === "M" ? "Masculin" : eleve.sexe === "F" ? "Féminin" : "—"} />
              <InfoRow label="Classe" value={classeLibelle} />
              <InfoRow label="Année scolaire" value={anneeLibelle} />
              <InfoRow
                label="Tuteur"
                value={
                  eleve.tuteur
                    ? [eleve.tuteur.prenoms, eleve.tuteur.nom].filter(Boolean).join(" ")
                    : "—"
                }
              />
              <InfoRow label="Téléphone tuteur" value={eleve.tuteur?.telephone ?? "—"} />
            </div>

            {/* Alerte paiement requis */}
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600" />
              <div className="text-sm">
                <p className="font-semibold text-amber-900 dark:text-amber-200">
                  Paiement des frais d&apos;inscription requis
                </p>
                <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                  L&apos;élève est actuellement <strong>pré-inscrit</strong>. Son
                  inscription sera définitivement validée après le paiement des
                  frais d&apos;inscription à la caisse.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-4 sm:flex-row">
              <Button
                onClick={onGoEleves}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                Voir la fiche élève
              </Button>
              <Button variant="outline" onClick={onReset} className="flex-1">
                Nouvelle inscription
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-medium ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
