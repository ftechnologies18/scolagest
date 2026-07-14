"use client";

/**
 * ScolaGest — Formulaire PUBLIC de pré-inscription en ligne (Phase 3, Innovation 3).
 *
 * Refonte Forêt EdTech (v2) — wizard engageant 5 étapes :
 *  1. Établissement  — sélection + info catégorie Affecté/Non affecté
 *  2. Élève          — nom, prénoms, date/lieu naissance, sexe, catégorie
 *  3. Tuteur         — nom, prénoms, téléphone, email, lien parenté + détection fratrie
 *  4. Classe & infos — cascade cycle/niveau/classe visuelle + santé + notes parent
 *  5. Confirmation   — récapitulatif + soumission
 *
 * Leverage engagement :
 *  - Hero incarné "Offrez à votre enfant une rentrée réussie" + 3 badges de
 *    réassurance (48h · 100% en ligne · Gratuit) + pill "Temps estimé : 3 min".
 *  - Stepper visuel 5 cercles avec progression emerald→amber (effet Zeigarnik).
 *  - Une seule section visible à la fois → moins de charge cognitive.
 *  - Validation par étape (erreurs immédiates, bouton Suivant disabled tant
 *    que l'étape courante n'est pas valide).
 *  - Animation Framer Motion : slide horizontal + fade entre étapes.
 *  - Champs avec icônes + validation temps réel (coche verte).
 *  - Section santé avec icône cadenas + mention de confidentialité.
 *  - Écran de succès soigné : icône animée (spring scale + bounce), récap,
 *    numéro de dossier bien visible, message rassurant, KentePattern bg.
 *
 * Accessible sans authentification sur la route `/pre-inscription`. La
 * soumission appelle `submitPreInscription` (route publique, `skipAuth: true`).
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query (etablissements / cycles /
 * classes / fratrie), mutation submitPreInscription, handlers
 * `handleSubmit` / `handlePrefillTuteur` / `handleCopyLien`, validation
 * `isValid`, construction du DTO `PreInscriptionDTO`, détection fratrie
 * (debounce 500ms), cascade Cycle → Niveau → Classe (refs prevCycle /
 * prevNiveau), composants `FratrieBanner` et `SuccessScreen`.
 *
 * IMPORTANT : ce formulaire ne doit PAS utiliser useAuthStore (pas de login
 * requis) ni RoleGuard.
 */

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpen,
  Briefcase,
  Calendar,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ClipboardCopy,
  Clock,
  Flag,
  GraduationCap,
  HeartPulse,
  IdCard,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  School,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  Wand2,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";

import {
  classesKeys,
  cyclesKeys,
} from "@/lib/api-students";
import { apiGet, ApiError } from "@/lib/api-client";
import type { Classe, Cycle } from "@/lib/types";
import type { Etablissement } from "@/lib/auth-store";
import {
  searchTuteurByPhone,
  submitPreInscription,
  type CategorieEleve,
  type LienParente,
  type PreInscriptionDTO,
  type SexeEleve,
  type StatutAnneePrecedente,
  type SubmitResult,
  type TuteurFratrieResult,
} from "@/lib/api-pre-inscription";
import { useToast } from "@/hooks/use-toast";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";
import { formatCycleCourt, formatNiveau } from "@/lib/format";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { Footer } from "@/components/ds/footer";
import { motion, AnimatePresence } from "framer-motion";

// ─────────────────────────────────────────────────────────────────────────────
// Constantes du wizard
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 1,
    label: "Élève",
    short: "Élève",
    icon: User,
    description: "Établissement & identité",
  },
  {
    id: 2,
    label: "Tuteur",
    short: "Tuteur",
    icon: Users,
    description: "Parent / responsable",
  },
  {
    id: 3,
    label: "Classe & infos",
    short: "Classe",
    icon: BookOpen,
    description: "Classe & santé",
  },
  {
    id: 4,
    label: "Confirmation",
    short: "Récap",
    icon: ClipboardCheck,
    description: "Vérifier & envoyer",
  },
] as const;

const TOTAL_STEPS = STEPS.length;

/** Palette de tons par index de cycle (pour les cartes de classe visuelles). */
const CYCLE_TONES = [
  {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    border: "border-emerald-300 dark:border-emerald-800",
  },
  {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    border: "border-amber-300 dark:border-amber-800",
  },
  {
    badge: "bg-terracotta/15 text-terracotta dark:bg-terracotta/20 dark:text-terracotta-light",
    border: "border-terracotta/40 dark:border-terracotta/40",
  },
  {
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
    border: "border-sky-300 dark:border-sky-800",
  },
  {
    badge: "bg-gold/15 text-gold-dark dark:bg-gold/20 dark:text-gold",
    border: "border-gold/40 dark:border-gold/40",
  },
] as const;

const DEFAULT_TONE = CYCLE_TONES[0];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de rendu
// ─────────────────────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium leading-snug">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </Label>
      {children}
      {hint && (
        <p className="break-words text-xs leading-snug text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/15 to-amber-500/15 text-emerald-700 dark:text-emerald-300">
        <Icon className="size-5" aria-hidden="true" />
      </div>
      <div className="min-w-0 space-y-0.5">
        <h2 className="break-words font-display text-base font-semibold leading-tight text-forest sm:text-lg">
          {title}
        </h2>
        {description && (
          <p className="break-words text-xs leading-snug text-muted-foreground sm:text-sm">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}

/** Ligne d'info compacte pour l'écran de récapitulatif et de succès. */
function InfoRow({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Icon className="size-3.5" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            "break-words text-sm leading-snug text-foreground",
            mono && "font-mono",
          )}
        >
          {value || "—"}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stepper visuel 5 étapes
// ─────────────────────────────────────────────────────────────────────────────

function Stepper({
  currentStep,
  etablissementNom,
}: {
  currentStep: number;
  etablissementNom?: string;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  return (
    <GlassCard variant="desktop" noHover noAnimation className="p-3 sm:p-4">
      <div className="flex items-center justify-between gap-1.5 overflow-x-auto sm:gap-2">
        {STEPS.map((s, idx) => {
          const Icon = s.icon;
          const isDone = currentStep > s.id;
          const isCurrent = currentStep === s.id;
          return (
            <React.Fragment key={s.id}>
              <div className="flex shrink-0 flex-col items-center gap-1.5">
                <div
                  className={[
                    "relative flex size-9 items-center justify-center rounded-full border-2 transition-all sm:size-10",
                    isDone
                      ? "border-emerald-600 bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                      : isCurrent
                        ? "border-emerald-600 bg-emerald-50 text-emerald-700 ring-4 ring-emerald-500/15 dark:bg-emerald-950/40 dark:text-emerald-300"
                        : "border-muted bg-background text-muted-foreground",
                  ].join(" ")}
                >
                  {isCurrent && !prefersReducedMotion ? (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 animate-ping rounded-full border-2 border-emerald-500/40"
                    />
                  ) : null}
                  {isDone ? (
                    <Check className="size-4 sm:size-5" aria-hidden="true" />
                  ) : (
                    <Icon className="size-4 sm:size-5" aria-hidden="true" />
                  )}
                  <span className="sr-only">Étape {s.id}</span>
                </div>
                <div className="text-center">
                  <p
                    className={[
                      "hidden text-[11px] font-medium leading-tight sm:block",
                      isCurrent || isDone
                        ? "text-foreground"
                        : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {s.label}
                  </p>
                  <p
                    className={[
                      "text-[10px] font-medium leading-tight sm:hidden",
                      isCurrent ? "text-emerald-700" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {s.short}
                  </p>
                </div>
              </div>
              {idx < TOTAL_STEPS - 1 ? (
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
      {etablissementNom && currentStep > 1 ? (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-emerald-100/60 pt-3 dark:border-emerald-900/30">
          <span className="text-[11px] font-medium text-muted-foreground">
            Établissement :
          </span>
          <Badge
            variant="outline"
            className="border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            <School className="mr-1 size-3" aria-hidden="true" />
            <span className="break-words leading-snug">{etablissementNom}</span>
          </Badge>
        </div>
      ) : null}
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function PreInscriptionForm() {
  const { toast } = useToast();
  const prefersReducedMotion = usePrefersReducedMotion();

  // ─── Étape courante du wizard ──────────────────────────────────────────────
  const [step, setStep] = React.useState(1);

  // ─── Établissements (route publique, skipAuth) ────────────────────────────
  const [etablissementId, setEtablissementId] = React.useState<string>("");
  const { data: etablissements, isLoading: etabsLoading } = useQuery<
    Etablissement[]
  >({
    queryKey: ["public-etablissements"],
    queryFn: () =>
      apiGet<Etablissement[]>("/api/etablissements", { skipAuth: true }),
    staleTime: 5 * 60 * 1000,
  });

  const selectedEtablissement = React.useMemo(
    () => etablissements?.find((e) => e.id === etablissementId),
    [etablissements, etablissementId],
  );
  const appliqueCategorie =
    !!selectedEtablissement?.applique_categorie_affecte;

  // ─── Cycles & Classes (cascade) ───────────────────────────────────────────
  const [cycleId, setCycleId] = React.useState<string>("");
  const [niveau, setNiveau] = React.useState<string>("");

  const { data: cycles } = useQuery<Cycle[]>({
    queryKey: cyclesKeys.list(etablissementId || undefined),
    queryFn: () =>
      apiGet<Cycle[]>(
        `/api/cycles?etablissement_id=${encodeURIComponent(etablissementId)}`,
        { skipAuth: true },
      ),
    enabled: !!etablissementId,
    retry: false,
  });
  const { data: classes } = useQuery<Classe[]>({
    queryKey: classesKeys.list(etablissementId || undefined),
    queryFn: () =>
      apiGet<Classe[]>(
        `/api/classes?etablissement_id=${encodeURIComponent(etablissementId)}`,
        { skipAuth: true },
      ),
    enabled: !!etablissementId,
    retry: false,
  });

  // Cascade : reset niveau quand cycle change
  const prevCycle = React.useRef(cycleId);
  React.useEffect(() => {
    if (prevCycle.current !== cycleId) {
      prevCycle.current = cycleId;
      setNiveau("");
    }
  }, [cycleId]);

  const availableNiveaux = React.useMemo(() => {
    if (!classes || !cycleId) return [];
    const filtered = classes.filter((c) => c.cycle_id === cycleId);
    return [...new Set(filtered.map((c) => c.niveau))].sort((a, b) => a - b);
  }, [classes, cycleId]);

  /** Cycle sélectionné (pour récap / stepper). */
  const selectedCycle = React.useMemo(
    () => cycles?.find((c) => c.id === cycleId),
    [cycles, cycleId],
  );

  // ─── État du formulaire ───────────────────────────────────────────────────
  const [eleveNom, setEleveNom] = React.useState("");
  const [elevePrenoms, setElevePrenoms] = React.useState("");
  const [eleveDateNaissance, setEleveDateNaissance] = React.useState("");
  const [eleveLieuNaissance, setEleveLieuNaissance] = React.useState("");
  const [eleveSexe, setEleveSexe] = React.useState<SexeEleve>("");
  const [eleveCategorie, setEleveCategorie] =
    React.useState<CategorieEleve>("NON_APPLICABLE");

  const [tuteurNom, setTuteurNom] = React.useState("");
  const [tuteurPrenoms, setTuteurPrenoms] = React.useState("");
  const [tuteurTelephone, setTuteurTelephone] = React.useState("");
  const [tuteurTelephoneUrgence, setTuteurTelephoneUrgence] = React.useState("");
  const [tuteurEmail, setTuteurEmail] = React.useState("");
  const [tuteurAdresse, setTuteurAdresse] = React.useState("");
  const [tuteurProfession, setTuteurProfession] = React.useState("");
  const [tuteurLienParente, setTuteurLienParente] =
    React.useState<LienParente>("AUTRE");

  const [notesParent, setNotesParent] = React.useState("");

  // ─── Champs complémentaires (nationalité, transfert, santé) ───────────────
  const [eleveNationalite, setEleveNationalite] = React.useState("Ivoirienne");
  const [eleveAncienEtablissement, setEleveAncienEtablissement] =
    React.useState("");
  const [eleveStatutAnneePrecedente, setEleveStatutAnneePrecedente] =
    React.useState<StatutAnneePrecedente>("NON_APPLICABLE");
  const [eleveAllergies, setEleveAllergies] = React.useState("");
  const [eleveNotesSante, setEleveNotesSante] = React.useState("");
  // Toggle santé : si false, les champs allergies + notes santé sont masqués
  const [hasSanteInfo, setHasSanteInfo] = React.useState(false);

  // ─── Détection fratrie (debounce téléphone) ───────────────────────────────
  const [debouncedTelephone, setDebouncedTelephone] = React.useState("");
  React.useEffect(() => {
    const handle = setTimeout(
      () => setDebouncedTelephone(tuteurTelephone.trim()),
      500,
    );
    return () => clearTimeout(handle);
  }, [tuteurTelephone]);

  const fratrieQuery = useQuery<TuteurFratrieResult>({
    queryKey: ["public-fratrie", debouncedTelephone],
    queryFn: () => searchTuteurByPhone(debouncedTelephone),
    enabled: debouncedTelephone.length >= 8,
    retry: false,
    staleTime: 60 * 1000,
  });
  const fratrieResult = fratrieQuery.data;
  const fratrieFetching = fratrieQuery.isFetching;

  /** Pré-remplit les champs tuteur depuis le résultat de la recherche fratrie. */
  function handlePrefillTuteur() {
    if (!fratrieResult?.found || !fratrieResult.tuteur) return;
    const t = fratrieResult.tuteur;
    if (t.nom) setTuteurNom(t.nom);
    if (t.prenoms) setTuteurPrenoms(t.prenoms);
    if (t.email) setTuteurEmail(t.email);
    const liensValides: LienParente[] = [
      "PERE",
      "MERE",
      "TUTEUR_LEGAL",
      "AUTRE",
    ];
    const lien = liensValides.includes(t.lien_parente as LienParente)
      ? (t.lien_parente as LienParente)
      : "AUTRE";
    setTuteurLienParente(lien);
    toast({
      title: "Informations pré-remplies",
      description:
        "Vous pouvez ajuster les champs si besoin. Votre saisie reste prioritaire.",
    });
  }

  // ─── Succès ───────────────────────────────────────────────────────────────
  const [success, setSuccess] = React.useState<SubmitResult | null>(null);

  // ─── Mutation ─────────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (dto: PreInscriptionDTO) => submitPreInscription(dto),
    onSuccess: (data) => {
      setSuccess(data);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      toast({
        title: "Pré-inscription envoyée",
        description:
          "Votre demande a bien été soumise. Conservez votre lien de suivi.",
      });
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Une erreur est survenue lors de la soumission. Veuillez réessayer.";
      toast({
        title: "Échec de la pré-inscription",
        description: msg,
        variant: "destructive",
      });
    },
  });

  // ─── Validation (globale — conservée à l'identique pour la soumission) ────
  const isValid = React.useMemo(() => {
    if (!etablissementId) return false;
    if (!eleveNom.trim()) return false;
    if (!eleveSexe) return false;
    if (appliqueCategorie && eleveCategorie === "NON_APPLICABLE") return false;
    if (!tuteurNom.trim()) return false;
    if (!tuteurTelephone.trim()) return false;
    return true;
  }, [
    etablissementId,
    eleveNom,
    eleveSexe,
    appliqueCategorie,
    eleveCategorie,
    tuteurNom,
    tuteurTelephone,
  ]);

  // ─── Validation par étape (découpe de isValid pour le wizard) ─────────────
  // Étape 1 : établissement + élève (fusion des anciennes étapes 1+2)
  const step1Valid =
    !!etablissementId &&
    !!eleveNom.trim() &&
    !!eleveSexe &&
    (!appliqueCategorie || eleveCategorie !== "NON_APPLICABLE");
  // Étape 2 : tuteur
  const step2Valid = !!tuteurNom.trim() && !!tuteurTelephone.trim();
  // Étape 3 : cycle + niveau obligatoires (réforme 2026-07). La classe est
  // attribuée par le staff lors de la validation — non demandée au parent.
  const step3Valid = !!cycleId && !!niveau;
  // Étape 4 : validation globale (toutes les conditions cumulées)
  const step4Valid = isValid;

  const stepValidMap: Record<number, boolean> = {
    1: step1Valid,
    2: step2Valid,
    3: step3Valid,
    4: step4Valid,
  };

  // ─── Navigation ───────────────────────────────────────────────────────────
  function next() {
    if (step >= TOTAL_STEPS) return;
    if (!stepValidMap[step]) return;
    setStep(step + 1);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function prev() {
    if (step <= 1) return;
    setStep(step - 1);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goToStep(target: number) {
    if (target < 1 || target > TOTAL_STEPS) return;
    setStep(target);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // ─── Soumission ───────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || mutation.isPending) return;

    const dto: PreInscriptionDTO = {
      etablissement_id: etablissementId,
      eleve_nom: eleveNom.trim(),
      eleve_prenoms: elevePrenoms.trim(),
      eleve_date_naissance: eleveDateNaissance || undefined,
      eleve_lieu_naissance: eleveLieuNaissance.trim(),
      eleve_sexe: eleveSexe,
      eleve_categorie: appliqueCategorie ? eleveCategorie : "NON_APPLICABLE",
      eleve_nationalite: eleveNationalite.trim() || undefined,
      eleve_ancien_etablissement:
        eleveAncienEtablissement.trim() || undefined,
      eleve_statut_annee_precedente: eleveStatutAnneePrecedente,
      eleve_allergies: eleveAllergies.trim() || undefined,
      eleve_notes_sante: eleveNotesSante.trim() || undefined,
      tuteur_nom: tuteurNom.trim(),
      tuteur_prenoms: tuteurPrenoms.trim(),
      tuteur_telephone: tuteurTelephone.trim(),
      tuteur_telephone_urgence: tuteurTelephoneUrgence.trim() || undefined,
      tuteur_email: tuteurEmail.trim(),
      tuteur_lien_parente: tuteurLienParente,
      tuteur_adresse: tuteurAdresse.trim() || undefined,
      tuteur_profession: tuteurProfession.trim() || undefined,
      cycle_id: cycleId,
      niveau: niveau,
      notes_parent: notesParent.trim(),
    };
    mutation.mutate(dto);
  }

  // ─── Copie du lien de suivi ───────────────────────────────────────────────
  function handleCopyLien() {
    if (!success) return;
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}${success.suivi_url}`
        : success.suivi_url;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(
        () =>
          toast({
            title: "Lien copié",
            description: "Le lien de suivi a été copié dans le presse-papiers.",
          }),
        () =>
          toast({
            title: "Copie impossible",
            description: url,
            variant: "destructive",
          }),
      );
    } else {
      toast({ title: "Lien de suivi", description: url });
    }
  }

  // ─── Écran de succès ──────────────────────────────────────────────────────
  if (success) {
    return <SuccessScreen result={success} onCopy={handleCopyLien} />;
  }

  // ─── Formulaire ───────────────────────────────────────────────────────────
  const canGoNext = stepValidMap[step];
  const canGoPrev = step > 1;

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-gradient-to-br from-emerald-50 via-background to-amber-50">
      {/* Texture kente subtile en fond (max 8% opacity) */}
      <KentePattern variant="bg" className="opacity-[0.08]" />
      {/* Orbes décoratifs (glassmorphism léger) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-emerald-200/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-amber-200/30 blur-3xl"
      />

      {/* Bande kente */}
      <KentePattern variant="strip" position="top" />

      {/* Hero header engageant */}
      <header className="relative z-10 overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-amber-600 text-white">
        <KentePattern variant="bg" />
        <div className="relative mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
          {/* Rang 1 : logo + pill temps estimé */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="ScolaGest"
                width={40}
                height={40}
                className="rounded-lg bg-white/95 p-0.5 shadow-md ring-1 ring-white/40"
              />
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight">ScolaGest</p>
                <p className="break-words text-[10px] leading-tight text-emerald-50/90">
                  Pré-inscription en ligne
                </p>
              </div>
            </div>
            <span
              title="Temps estimé pour remplir le formulaire"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur"
            >
              <Clock className="size-3.5" aria-hidden="true" />
              <span className="whitespace-nowrap">3 min</span>
            </span>
          </div>

          {/* Rang 2 : titre incarné + sous-titre */}
          <div className="mt-5 space-y-2">
            <h1 className="break-words font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              Offrez à votre enfant une rentrée réussie
            </h1>
            <p className="break-words text-sm leading-snug text-emerald-50/95 sm:max-w-2xl sm:text-base">
              Pré-inscrivez votre enfant en quelques minutes. Le secrétariat
              étudie votre demande et vous répond sous 48h.
            </p>
          </div>

          {/* Rang 3 : 3 badges de réassurance */}
          <div className="mt-4 flex flex-wrap gap-2">
            <ReassuranceBadge icon={Clock} label="Réponse sous 48h" />
            <ReassuranceBadge icon={CheckCircle2} label="100% en ligne" />
            <ReassuranceBadge icon={ShieldCheck} label="Gratuit" />
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="relative z-10 mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        {/* Stepper */}
        <Stepper
          currentStep={step}
          etablissementNom={selectedEtablissement?.nom}
        />

        {/* Barre de progression "Étape X/Y" + barre animée */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>
              Étape{" "}
              <span className="font-semibold text-forest">{step}</span> sur{" "}
              {TOTAL_STEPS} — {STEPS[step - 1].label}
            </span>
            <span className="text-[11px]">
              {Math.round((step / TOTAL_STEPS) * 100)}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-500"
              initial={prefersReducedMotion ? {} : { width: 0 }}
              animate={{
                width: `${(step / TOTAL_STEPS) * 100}%`,
              }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>

        {/* Formulaire (une seule section visible à la fois) */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <GlassCard
            variant="adaptive"
            noHover
            noAnimation
            premiumBorder
            className="min-h-[280px] p-5 sm:p-6"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={step}
                initial={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: 24 }
                }
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                exit={
                  prefersReducedMotion
                    ? { opacity: 0 }
                    : { opacity: 0, x: -24 }
                }
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-5"
              >
                {/* ─── Étape 1 : Établissement + Élève (fusion) ────────── */}
                {step === 1 && (
                  <>
                    <StepEtablissement
                      etablissements={etablissements}
                      etabsLoading={etabsLoading}
                      etablissementId={etablissementId}
                      setEtablissementId={setEtablissementId}
                      selectedEtablissement={selectedEtablissement}
                      appliqueCategorie={appliqueCategorie}
                    />
                    {etablissementId && (
                      <StepEleve
                        eleveNom={eleveNom}
                        setEleveNom={setEleveNom}
                        elevePrenoms={elevePrenoms}
                        setElevePrenoms={setElevePrenoms}
                        eleveDateNaissance={eleveDateNaissance}
                        setEleveDateNaissance={setEleveDateNaissance}
                        eleveLieuNaissance={eleveLieuNaissance}
                        setEleveLieuNaissance={setEleveLieuNaissance}
                        eleveSexe={eleveSexe}
                        setEleveSexe={setEleveSexe}
                        eleveCategorie={eleveCategorie}
                        setEleveCategorie={setEleveCategorie}
                        appliqueCategorie={appliqueCategorie}
                      />
                    )}
                  </>
                )}

                {/* ─── Étape 2 : Tuteur ────────────────────────────────── */}
                {step === 2 && (
                  <StepTuteur
                    tuteurNom={tuteurNom}
                    setTuteurNom={setTuteurNom}
                    tuteurPrenoms={tuteurPrenoms}
                    setTuteurPrenoms={setTuteurPrenoms}
                    tuteurTelephone={tuteurTelephone}
                    setTuteurTelephone={setTuteurTelephone}
                    tuteurTelephoneUrgence={tuteurTelephoneUrgence}
                    setTuteurTelephoneUrgence={setTuteurTelephoneUrgence}
                    tuteurEmail={tuteurEmail}
                    setTuteurEmail={setTuteurEmail}
                    tuteurAdresse={tuteurAdresse}
                    setTuteurAdresse={setTuteurAdresse}
                    tuteurProfession={tuteurProfession}
                    setTuteurProfession={setTuteurProfession}
                    tuteurLienParente={tuteurLienParente}
                    setTuteurLienParente={setTuteurLienParente}
                    fratrieFetching={fratrieFetching}
                    fratrieResult={fratrieResult}
                    onPrefillTuteur={handlePrefillTuteur}
                  />
                )}

                {/* ─── Étape 3 : Classe & infos ────────────────────────── */}
                {step === 3 && (
                  <StepClasseInfos
                    etablissementId={etablissementId}
                    cycles={cycles}
                    cycleId={cycleId}
                    setCycleId={setCycleId}
                    niveau={niveau}
                    setNiveau={setNiveau}
                    availableNiveaux={availableNiveaux}
                    eleveNationalite={eleveNationalite}
                    setEleveNationalite={setEleveNationalite}
                    eleveAncienEtablissement={eleveAncienEtablissement}
                    setEleveAncienEtablissement={setEleveAncienEtablissement}
                    eleveStatutAnneePrecedente={eleveStatutAnneePrecedente}
                    setEleveStatutAnneePrecedente={setEleveStatutAnneePrecedente}
                    eleveAllergies={eleveAllergies}
                    setEleveAllergies={setEleveAllergies}
                    eleveNotesSante={eleveNotesSante}
                    setEleveNotesSante={setEleveNotesSante}
                    hasSanteInfo={hasSanteInfo}
                    setHasSanteInfo={setHasSanteInfo}
                    notesParent={notesParent}
                    setNotesParent={setNotesParent}
                  />
                )}

                {/* ─── Étape 4 : Confirmation ──────────────────────────── */}
                {step === 4 && (
                  <StepConfirmation
                    selectedEtablissement={selectedEtablissement}
                    eleveNom={eleveNom}
                    elevePrenoms={elevePrenoms}
                    eleveDateNaissance={eleveDateNaissance}
                    eleveLieuNaissance={eleveLieuNaissance}
                    eleveSexe={eleveSexe}
                    eleveCategorie={eleveCategorie}
                    appliqueCategorie={appliqueCategorie}
                    tuteurNom={tuteurNom}
                    tuteurPrenoms={tuteurPrenoms}
                    tuteurTelephone={tuteurTelephone}
                    tuteurTelephoneUrgence={tuteurTelephoneUrgence}
                    tuteurEmail={tuteurEmail}
                    tuteurAdresse={tuteurAdresse}
                    tuteurProfession={tuteurProfession}
                    tuteurLienParente={tuteurLienParente}
                    selectedCycle={selectedCycle}
                    selectedNiveau={niveau}
                    eleveNationalite={eleveNationalite}
                    eleveAncienEtablissement={eleveAncienEtablissement}
                    eleveStatutAnneePrecedente={eleveStatutAnneePrecedente}
                    eleveAllergies={eleveAllergies}
                    eleveNotesSante={eleveNotesSante}
                    hasSanteInfo={hasSanteInfo}
                    notesParent={notesParent}
                    goToStep={goToStep}
                    isPending={mutation.isPending}
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
                className="h-11 w-full text-base sm:h-10 sm:w-auto sm:text-sm"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Précédent
              </Button>

              <span className="order-first text-center text-xs text-muted-foreground sm:order-none sm:text-sm">
                Étape{" "}
                <span className="font-semibold text-forest">{step}</span> sur{" "}
                {TOTAL_STEPS}
              </span>

              {step < TOTAL_STEPS ? (
                <Button
                  type="button"
                  onClick={next}
                  disabled={!canGoNext}
                  variant="success"
                  className="h-11 w-full text-base shadow-lg shadow-emerald-900/20 sm:h-10 sm:w-auto sm:text-sm"
                >
                  Continuer
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!isValid || mutation.isPending}
                  variant="success"
                  className="h-11 w-full text-base shadow-lg shadow-emerald-900/20 sm:h-10 sm:w-auto sm:text-sm"
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2
                        className="size-4 animate-spin"
                        aria-hidden="true"
                      />
                      Envoi en cours…
                    </>
                  ) : (
                    <>
                      <Send className="size-4" aria-hidden="true" />
                      Soumettre la pré-inscription
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Légal + temps estimé restant (mobile seulement) */}
            <p className="mt-2 text-center text-[11px] text-muted-foreground sm:hidden">
              En soumettant, vous acceptez que vos données soient traitées pour
              instruire votre demande.
            </p>
          </div>

          {/* Légal desktop */}
          <p className="hidden text-center text-xs text-muted-foreground sm:block">
            En soumettant, vous acceptez que vos données soient traitées pour
            instruire votre demande.
          </p>
        </form>
      </main>

      {/* Pied de page */}
      <Footer className="shrink-0" />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge de réassurance (hero)
// ─────────────────────────────────────────────────────────────────────────────

function ReassuranceBadge({
  icon: Icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  return (
    <span
      title={label}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur"
    >
      <Check
        className="size-3 shrink-0 text-amber-200"
        aria-hidden="true"
      />
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Étape 1 — Établissement
// ─────────────────────────────────────────────────────────────────────────────

function StepEtablissement({
  etablissements,
  etabsLoading,
  etablissementId,
  setEtablissementId,
  selectedEtablissement,
  appliqueCategorie,
}: {
  etablissements?: Etablissement[];
  etabsLoading: boolean;
  etablissementId: string;
  setEtablissementId: (v: string) => void;
  selectedEtablissement?: Etablissement;
  appliqueCategorie: boolean;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader
        icon={School}
        title="Établissement souhaité"
        description="Sélectionnez l'école ScolaGest auprès de laquelle vous pré-inscrivez votre enfant."
      />
      <Separator />

      {etabsLoading ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/40 p-4 text-sm text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Chargement des établissements…
        </div>
      ) : etablissements && etablissements.length > 0 ? (
        <div className="space-y-2">
          {etablissements.map((e) => {
            const isSelected = e.id === etablissementId;
            return (
              <button
                key={e.id}
                type="button"
                onClick={() => setEtablissementId(e.id)}
                aria-pressed={isSelected}
                title={`Sélectionner l'établissement ${e.nom}`}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border-2 p-3 text-left transition-all",
                  isSelected
                    ? "border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/20 dark:border-emerald-400 dark:bg-emerald-950/30"
                    : "border-border bg-background hover:border-emerald-300 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/10",
                )}
              >
                <div
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-xl",
                    isSelected
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                  )}
                >
                  <School className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="break-words leading-snug font-display text-sm font-semibold text-forest">
                    {e.nom}
                  </p>
                  {e.ville && (
                    <p className="flex items-center gap-1 break-words text-xs text-muted-foreground">
                      <MapPin className="size-3 shrink-0" aria-hidden="true" />
                      {e.ville}
                    </p>
                  )}
                </div>
                {isSelected ? (
                  <CheckCircle2
                    className="size-5 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="break-words leading-snug">
            Aucun établissement n&apos;est actuellement disponible à la
            pré-inscription. Veuillez réessayer plus tard.
          </p>
        </div>
      )}

      {selectedEtablissement && appliqueCategorie && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-100/80 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <p className="break-words leading-snug">
            Cet établissement applique la distinction{" "}
            <strong>Affecté / Non affecté</strong>. Vous devrez renseigner la
            catégorie de votre enfant à l&apos;étape 2.
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Étape 2 — Élève
// ─────────────────────────────────────────────────────────────────────────────

function StepEleve({
  eleveNom,
  setEleveNom,
  elevePrenoms,
  setElevePrenoms,
  eleveDateNaissance,
  setEleveDateNaissance,
  eleveLieuNaissance,
  setEleveLieuNaissance,
  eleveSexe,
  setEleveSexe,
  eleveCategorie,
  setEleveCategorie,
  appliqueCategorie,
}: {
  eleveNom: string;
  setEleveNom: (v: string) => void;
  elevePrenoms: string;
  setElevePrenoms: (v: string) => void;
  eleveDateNaissance: string;
  setEleveDateNaissance: (v: string) => void;
  eleveLieuNaissance: string;
  setEleveLieuNaissance: (v: string) => void;
  eleveSexe: SexeEleve;
  setEleveSexe: (v: SexeEleve) => void;
  eleveCategorie: CategorieEleve;
  setEleveCategorie: (v: CategorieEleve) => void;
  appliqueCategorie: boolean;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader
        icon={User}
        title="Identité de l'élève"
        description="Renseignez l'état civil de votre enfant."
      />
      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom" required>
          <ValidatedInput
            value={eleveNom}
            onChange={(e) => setEleveNom(e.target.value)}
            placeholder="Ex : Kouassi"
            autoComplete="family-name"
            isValid={eleveNom.trim().length > 0}
          />
        </Field>
        <Field label="Prénoms">
          <Input
            value={elevePrenoms}
            onChange={(e) => setElevePrenoms(e.target.value)}
            placeholder="Ex : Jean-Marc"
            autoComplete="given-name"
            className="h-11 text-base sm:h-10 sm:text-sm"
          />
        </Field>

        <Field label="Date de naissance">
          <div className="relative">
            <Calendar
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="date"
              value={eleveDateNaissance}
              onChange={(e) => setEleveDateNaissance(e.target.value)}
              inputMode="numeric"
              className="h-11 pl-9 text-base sm:h-10 sm:text-sm"
            />
          </div>
        </Field>
        <Field label="Lieu de naissance">
          <div className="relative">
            <MapPin
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={eleveLieuNaissance}
              onChange={(e) => setEleveLieuNaissance(e.target.value)}
              placeholder="Ex : Abidjan"
              className="h-11 pl-9 text-base sm:h-10 sm:text-sm"
            />
          </div>
        </Field>

        <Field label="Sexe" required>
          <Select
            value={eleveSexe || "none"}
            onValueChange={(v) =>
              setEleveSexe(v === "none" ? "" : (v as SexeEleve))
            }
          >
            <SelectTrigger className="h-11 w-full text-base sm:h-10 sm:text-sm">
              <SelectValue placeholder="Sélectionnez…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sélectionnez…</SelectItem>
              <SelectItem value="M">Masculin</SelectItem>
              <SelectItem value="F">Féminin</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {appliqueCategorie && (
          <Field
            label="Catégorie"
            required
            hint="Affecté = élève de l'État (exonéré). Non affecté = élève ordinaire."
          >
            <Select
              value={eleveCategorie}
              onValueChange={(v) => setEleveCategorie(v as CategorieEleve)}
            >
              <SelectTrigger className="h-11 w-full text-base sm:h-10 sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AFFECTE">Affecté (État)</SelectItem>
                <SelectItem value="NON_AFFECTE">Non affecté</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Étape 3 — Tuteur
// ─────────────────────────────────────────────────────────────────────────────

function StepTuteur({
  tuteurNom,
  setTuteurNom,
  tuteurPrenoms,
  setTuteurPrenoms,
  tuteurTelephone,
  setTuteurTelephone,
  tuteurTelephoneUrgence,
  setTuteurTelephoneUrgence,
  tuteurEmail,
  setTuteurEmail,
  tuteurAdresse,
  setTuteurAdresse,
  tuteurProfession,
  setTuteurProfession,
  tuteurLienParente,
  setTuteurLienParente,
  fratrieFetching,
  fratrieResult,
  onPrefillTuteur,
}: {
  tuteurNom: string;
  setTuteurNom: (v: string) => void;
  tuteurPrenoms: string;
  setTuteurPrenoms: (v: string) => void;
  tuteurTelephone: string;
  setTuteurTelephone: (v: string) => void;
  tuteurTelephoneUrgence: string;
  setTuteurTelephoneUrgence: (v: string) => void;
  tuteurEmail: string;
  setTuteurEmail: (v: string) => void;
  tuteurAdresse: string;
  setTuteurAdresse: (v: string) => void;
  tuteurProfession: string;
  setTuteurProfession: (v: string) => void;
  tuteurLienParente: LienParente;
  setTuteurLienParente: (v: LienParente) => void;
  fratrieFetching: boolean;
  fratrieResult?: TuteurFratrieResult;
  onPrefillTuteur: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader
        icon={Users}
        title="Tuteur / Parent"
        description="Vos coordonnées pour que l'établissement vous contacte sous 48h."
      />
      <Separator />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom" required>
          <ValidatedInput
            value={tuteurNom}
            onChange={(e) => setTuteurNom(e.target.value)}
            placeholder="Ex : Kouassi"
            autoComplete="family-name"
            isValid={tuteurNom.trim().length > 0}
          />
        </Field>
        <Field label="Prénoms">
          <Input
            value={tuteurPrenoms}
            onChange={(e) => setTuteurPrenoms(e.target.value)}
            placeholder="Ex : Marc"
            autoComplete="given-name"
            className="h-11 text-base sm:h-10 sm:text-sm"
          />
        </Field>

        <Field label="Téléphone" required>
          <div className="relative">
            <Phone
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="tel"
              inputMode="tel"
              value={tuteurTelephone}
              onChange={(e) => setTuteurTelephone(e.target.value)}
              placeholder="Ex : +225 07 00 00 00 00"
              autoComplete="tel"
              className="h-11 pl-9 pr-9 text-base sm:h-10 sm:text-sm"
            />
            {fratrieFetching ? (
              <Loader2
                aria-label="Recherche d'une fratrie existante en cours"
                className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-emerald-600"
              />
            ) : tuteurTelephone.trim().length >= 8 ? (
              <CheckCircle2
                aria-hidden="true"
                className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-emerald-600"
              />
            ) : null}
          </div>
        </Field>

        <Field
          label="Contact d'urgence"
        >
          <div className="relative">
            <Phone
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="tel"
              inputMode="tel"
              value={tuteurTelephoneUrgence}
              onChange={(e) => setTuteurTelephoneUrgence(e.target.value)}
              placeholder="Ex : +225 05 00 00 00 00"
              autoComplete="tel"
              className="h-11 pl-9 text-base sm:h-10 sm:text-sm"
            />
          </div>
        </Field>

        <Field label="Email">
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="email"
              inputMode="email"
              value={tuteurEmail}
              onChange={(e) => setTuteurEmail(e.target.value)}
              placeholder="Ex : parent@example.com"
              autoComplete="email"
              className="h-11 pl-9 text-base sm:h-10 sm:text-sm"
            />
          </div>
        </Field>

        <Field label="Lien de parenté">
          <Select
            value={tuteurLienParente || "AUTRE"}
            onValueChange={(v) => setTuteurLienParente(v as LienParente)}
          >
            <SelectTrigger className="h-11 w-full text-base sm:h-10 sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PERE">Père</SelectItem>
              <SelectItem value="MERE">Mère</SelectItem>
              <SelectItem value="TUTEUR_LEGAL">Tuteur légal</SelectItem>
              <SelectItem value="AUTRE">Autre</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field label="Profession">
          <Input
            value={tuteurProfession}
            onChange={(e) => setTuteurProfession(e.target.value)}
            placeholder="Ex : Commerçant(e), Enseignant(e)"
            autoComplete="off"
            className="h-11 text-base sm:h-10 sm:text-sm"
          />
        </Field>

        <Field label="Quartier d'habitation">
          <Input
            value={tuteurAdresse}
            onChange={(e) => setTuteurAdresse(e.target.value)}
            placeholder="Ex : Cocody Angré, Abidjan"
            autoComplete="off"
            className="h-11 text-base sm:h-10 sm:text-sm"
          />
        </Field>
      </div>

      {fratrieResult?.found && fratrieResult.tuteur && (
        <FratrieBanner
          result={fratrieResult}
          onPrefill={onPrefillTuteur}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Étape 4 — Classe & infos complémentaires
// ─────────────────────────────────────────────────────────────────────────────

function StepClasseInfos({
  etablissementId,
  cycles,
  cycleId,
  setCycleId,
  niveau,
  setNiveau,
  availableNiveaux,
  eleveNationalite,
  setEleveNationalite,
  eleveAncienEtablissement,
  setEleveAncienEtablissement,
  eleveStatutAnneePrecedente,
  setEleveStatutAnneePrecedente,
  eleveAllergies,
  setEleveAllergies,
  eleveNotesSante,
  setEleveNotesSante,
  hasSanteInfo,
  setHasSanteInfo,
  notesParent,
  setNotesParent,
}: {
  etablissementId: string;
  cycles?: Cycle[];
  cycleId: string;
  setCycleId: (v: string) => void;
  niveau: string;
  setNiveau: (v: string) => void;
  availableNiveaux: number[];
  eleveNationalite: string;
  setEleveNationalite: (v: string) => void;
  eleveAncienEtablissement: string;
  setEleveAncienEtablissement: (v: string) => void;
  eleveStatutAnneePrecedente: StatutAnneePrecedente;
  setEleveStatutAnneePrecedente: (v: StatutAnneePrecedente) => void;
  eleveAllergies: string;
  setEleveAllergies: (v: string) => void;
  eleveNotesSante: string;
  setEleveNotesSante: (v: string) => void;
  hasSanteInfo: boolean;
  setHasSanteInfo: (v: boolean) => void;
  notesParent: string;
  setNotesParent: (v: string) => void;
}) {
  // Libellé du cycle sélectionné (pour mapper niveau → libellé français).
  const selectedCycleLibelle = React.useMemo(() => {
    if (!cycleId) return undefined;
    return cycles?.find((cy) => cy.id === cycleId)?.libelle;
  }, [cycles, cycleId]);

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={BookOpen}
        title="Cycle, niveau & informations complémentaires"
        description="Cycle et niveau sont obligatoires. La classe définitive est attribuée par l'établissement lors de la finalisation de l'inscription (paiement des frais à la caisse)."
      />
      <Separator />

      {/* Nationalité de l'élève */}
      <div className="space-y-3">
        <Field
          label="Nationalité de l'élève"
          hint="Nationalité telle qu'inscrite sur l'extrait de naissance ou le passeport."
        >
          <div className="relative">
            <Flag
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={eleveNationalite}
              onChange={(e) => setEleveNationalite(e.target.value)}
              placeholder="Ex : Ivoirienne, Malienne, Burkinabè…"
              autoComplete="off"
              className="h-11 pl-9 text-base sm:h-10 sm:text-sm"
            />
          </div>
        </Field>
      </div>

      <Separator />

      {/* Cascade Cycle / Niveau (obligatoires) */}
      {!etablissementId ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="break-words leading-snug">
            Sélectionnez d&apos;abord un établissement (étape 1) pour voir les
            cycles et niveaux disponibles.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cycle" required>
              <Select value={cycleId} onValueChange={setCycleId}>
                <SelectTrigger className="h-11 w-full text-base sm:h-10 sm:text-sm">
                  <SelectValue placeholder="Choisir un cycle" />
                </SelectTrigger>
                <SelectContent>
                  {cycles?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {formatCycleCourt(c.libelle)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Niveau" required>
              <Select value={niveau} onValueChange={setNiveau}>
                <SelectTrigger className="h-11 w-full text-base sm:h-10 sm:text-sm">
                  <SelectValue placeholder="Choisir un niveau" />
                </SelectTrigger>
                <SelectContent>
                  {availableNiveaux.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {formatNiveau(selectedCycleLibelle, n)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          {/* Note explicative : la classe est attribuée par l'établissement */}
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-200">
            <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="break-words leading-snug">
              La <strong>classe définitive</strong> est attribuée par
              l&apos;établissement lors du paiement des frais d&apos;inscription.
            </p>
          </div>
        </div>
      )}

      <Separator />

      {/* Scolarité antérieure (transfert) */}
      <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-4 dark:border-sky-900/40 dark:bg-sky-950/15">
        <div className="mb-3 flex items-start gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
            <School className="size-4" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <p className="break-words leading-snug text-sm font-semibold text-sky-900 dark:text-sky-100">
              Scolarité antérieure (si transfert)
            </p>
            <p className="break-words text-[11px] leading-snug text-sky-800/80 dark:text-sky-200/80">
              Renseignez l&apos;établissement précédent et la décision de fin
              d&apos;année. Laissez vide si l&apos;enfant est nouvel entrant.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Ancien établissement"
            hint="Nom de l'établissement précédent (si transfert)."
          >
            <div className="relative">
              <School
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={eleveAncienEtablissement}
                onChange={(e) =>
                  setEleveAncienEtablissement(e.target.value)
                }
                placeholder="Ex : Collège Saint-Michel"
                autoComplete="off"
                className="h-11 pl-9 text-base sm:h-10 sm:text-sm"
              />
            </div>
          </Field>
          <Field
            label="Statut en fin d'année précédente"
            hint="Décision de l'ancien établissement (promotion, redoublement…)."
          >
            <Select
              value={eleveStatutAnneePrecedente}
              onValueChange={(v) =>
                setEleveStatutAnneePrecedente(v as StatutAnneePrecedente)
              }
            >
              <SelectTrigger className="h-11 w-full text-base sm:h-10 sm:text-sm">
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NON_APPLICABLE">
                  Nouvel entrant (non applicable)
                </SelectItem>
                <SelectItem value="PROMU">Promu</SelectItem>
                <SelectItem value="REDOUBLANT">Redoublant</SelectItem>
                <SelectItem value="AUTRE">Autre situation</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      {/* Section santé — confidentielle avec toggle conditionnel */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/15">
        {/* Toggle : "L'élève a-t-il des informations de santé à signaler ?" */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <Lock className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="break-words leading-snug text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                Informations de santé (confidentielles)
              </p>
              <p className="break-words text-[11px] leading-snug text-emerald-800/80 dark:text-emerald-200/80">
                Ces informations restent confidentielles et ne sont accessibles
                qu&apos;à l&apos;infirmerie et à la direction.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Label
              htmlFor="toggle-sante-public"
              className="cursor-pointer text-xs font-medium text-emerald-800 dark:text-emerald-200"
            >
              {hasSanteInfo ? "Oui" : "Non"}
            </Label>
            <Switch
              id="toggle-sante-public"
              checked={hasSanteInfo}
              onCheckedChange={(checked) => {
                setHasSanteInfo(checked);
                if (!checked) {
                  setEleveAllergies("");
                  setEleveNotesSante("");
                }
              }}
              aria-label="L'élève a-t-il des informations de santé à signaler ?"
            />
          </div>
        </div>

        {/* Champs santé — affichés uniquement si le toggle est activé */}
        {hasSanteInfo && (
          <div className="mt-4 space-y-3 border-t border-emerald-200/60 pt-4 dark:border-emerald-900/40">
            <Field
              label="Allergies connues"
              hint="Séparez les allergies par une virgule."
            >
              <div className="relative">
                <HeartPulse
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={eleveAllergies}
                  onChange={(e) => setEleveAllergies(e.target.value)}
                  placeholder="Ex : arachides, pénicilline"
                  autoComplete="off"
                  className="h-11 pl-9 text-base sm:h-10 sm:text-sm"
                />
              </div>
            </Field>
            <Field
              label="Notes santé (maladies chroniques, traitements…)"
            >
              <Textarea
                value={eleveNotesSante}
                onChange={(e) => setEleveNotesSante(e.target.value)}
                placeholder="Ex : asthme, port de lunettes"
                rows={2}
                className="text-base sm:text-sm"
              />
            </Field>
          </div>
        )}
      </div>

      {/* Notes au secrétariat */}
      <div className="space-y-2">
        <Field
          label="Message au secrétariat"
          hint="Précisions éventuelles : cycle/niveau demandé en seconde intention, infos utiles…"
        >
          <Textarea
            value={notesParent}
            onChange={(e) => setNotesParent(e.target.value)}
            placeholder="Ex : Nous souhaiterions inscrire notre enfant en 6e 1. Merci de nous contacter le soir."
            rows={3}
            className="text-base sm:text-sm"
          />
        </Field>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Étape 5 — Confirmation / Récapitulatif
// ─────────────────────────────────────────────────────────────────────────────

const SEXE_LABEL: Record<SexeEleve, string> = {
  M: "Masculin",
  F: "Féminin",
  "": "—",
};

const CATEGORIE_LABEL: Record<CategorieEleve, string> = {
  AFFECTE: "Affecté (État)",
  NON_AFFECTE: "Non affecté",
  NON_APPLICABLE: "Non applicable",
};

const LIEN_PARENTE_LABEL: Record<LienParente, string> = {
  PERE: "Père",
  MERE: "Mère",
  TUTEUR_LEGAL: "Tuteur légal",
  AUTRE: "Autre",
  "": "Autre",
};

const STATUT_ANNEE_PRECEDENTE_LABEL: Record<StatutAnneePrecedente, string> = {
  PROMU: "Promu",
  REDOUBLANT: "Redoublant",
  AUTRE: "Autre situation",
  NON_APPLICABLE: "Nouvel entrant (non applicable)",
  "": "—",
};

function StepConfirmation({
  selectedEtablissement,
  eleveNom,
  elevePrenoms,
  eleveDateNaissance,
  eleveLieuNaissance,
  eleveSexe,
  eleveCategorie,
  appliqueCategorie,
  tuteurNom,
  tuteurPrenoms,
  tuteurTelephone,
  tuteurTelephoneUrgence,
  tuteurEmail,
  tuteurAdresse,
  tuteurProfession,
  tuteurLienParente,
  selectedCycle,
  selectedNiveau,
  eleveNationalite,
  eleveAncienEtablissement,
  eleveStatutAnneePrecedente,
  eleveAllergies,
  eleveNotesSante,
  hasSanteInfo,
  notesParent,
  goToStep,
  isPending,
}: {
  selectedEtablissement?: Etablissement;
  eleveNom: string;
  elevePrenoms: string;
  eleveDateNaissance: string;
  eleveLieuNaissance: string;
  eleveSexe: SexeEleve;
  eleveCategorie: CategorieEleve;
  appliqueCategorie: boolean;
  tuteurNom: string;
  tuteurPrenoms: string;
  tuteurTelephone: string;
  tuteurTelephoneUrgence: string;
  tuteurEmail: string;
  tuteurAdresse: string;
  tuteurProfession: string;
  tuteurLienParente: LienParente;
  selectedCycle?: Cycle;
  selectedNiveau: string;
  eleveNationalite: string;
  eleveAncienEtablissement: string;
  eleveStatutAnneePrecedente: StatutAnneePrecedente;
  eleveAllergies: string;
  eleveNotesSante: string;
  hasSanteInfo: boolean;
  notesParent: string;
  goToStep: (n: number) => void;
  isPending: boolean;
}) {
  const eleveNomComplet = [elevePrenoms, eleveNom].filter(Boolean).join(" ").trim();
  const tuteurNomComplet = [tuteurPrenoms, tuteurNom].filter(Boolean).join(" ").trim();
  const dateNaissanceFormatted = eleveDateNaissance
    ? new Date(eleveDateNaissance).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="space-y-4">
      <SectionHeader
        icon={ClipboardCheck}
        title="Vérifiez vos informations"
        description="Parcourez le récapitulatif ci-dessous. Cliquez sur « Modifier » pour retourner à une étape."
      />
      <Separator />

      {/* Bloc Élève */}
      <RecapBlock
        title="Élève"
        icon={User}
        onEdit={() => goToStep(1)}
        disabled={isPending}
      >
        <InfoRow icon={User} label="Nom complet" value={eleveNomComplet || "—"} />
        {dateNaissanceFormatted && (
          <InfoRow
            icon={CalendarDays}
            label="Date de naissance"
            value={dateNaissanceFormatted}
          />
        )}
        {eleveLieuNaissance.trim() && (
          <InfoRow
            icon={MapPin}
            label="Lieu de naissance"
            value={eleveLieuNaissance}
          />
        )}
        <InfoRow icon={IdCard} label="Sexe" value={SEXE_LABEL[eleveSexe]} />
        {eleveNationalite.trim() && (
          <InfoRow icon={Flag} label="Nationalité" value={eleveNationalite} />
        )}
        {appliqueCategorie && (
          <InfoRow
            icon={ClipboardCheck}
            label="Catégorie"
            value={CATEGORIE_LABEL[eleveCategorie]}
          />
        )}
      </RecapBlock>

      {/* Bloc Tuteur */}
      <RecapBlock
        title="Tuteur / Parent"
        icon={Users}
        onEdit={() => goToStep(2)}
        disabled={isPending}
      >
        <InfoRow icon={Users} label="Nom complet" value={tuteurNomComplet || "—"} />
        <InfoRow icon={Phone} label="Téléphone" value={tuteurTelephone} />
        {tuteurTelephoneUrgence.trim() && (
          <InfoRow icon={Phone} label="Contact d'urgence" value={tuteurTelephoneUrgence} />
        )}
        {tuteurEmail.trim() && (
          <InfoRow icon={Mail} label="Email" value={tuteurEmail} />
        )}
        <InfoRow
          icon={IdCard}
          label="Lien de parenté"
          value={LIEN_PARENTE_LABEL[tuteurLienParente]}
        />
        {tuteurProfession.trim() && (
          <InfoRow icon={Briefcase} label="Profession" value={tuteurProfession} />
        )}
        {tuteurAdresse.trim() && (
          <InfoRow icon={MapPin} label="Quartier d'habitation" value={tuteurAdresse} />
        )}
      </RecapBlock>

      {/* Bloc Établissement + Classe */}
      <RecapBlock
        title="Établissement & classe"
        icon={School}
        onEdit={() => goToStep(1)}
        disabled={isPending}
      >
        <InfoRow
          icon={School}
          label="Établissement"
          value={
            selectedEtablissement
              ? `${selectedEtablissement.nom}${selectedEtablissement.ville ? ` — ${selectedEtablissement.ville}` : ""}`
              : "—"
          }
        />
        <InfoRow
          icon={BookOpen}
          label="Cycle & niveau souhaités"
          value={
            selectedCycle
              ? `${formatCycleCourt(selectedCycle.libelle)} · ${formatNiveau(selectedCycle.libelle, Number(selectedNiveau))}`
              : "—"
          }
        />
        <InfoRow
          icon={Sparkles}
          label="Classe définitive"
          value="Attribuée par l'établissement (à la caisse)"
        />
        {appliqueCategorie && (
          <InfoRow
            icon={Sparkles}
            label="Distinction Affecté/Non affecté"
            value="Active pour cet établissement"
          />
        )}
      </RecapBlock>

      {/* Bloc Scolarité antérieure (si renseignée) */}
      {(eleveAncienEtablissement.trim() ||
        eleveStatutAnneePrecedente !== "NON_APPLICABLE") && (
        <RecapBlock
          title="Scolarité antérieure"
          icon={School}
          onEdit={() => goToStep(3)}
          disabled={isPending}
        >
          {eleveAncienEtablissement.trim() && (
            <InfoRow
              icon={School}
              label="Ancien établissement"
              value={eleveAncienEtablissement}
            />
          )}
          {eleveStatutAnneePrecedente !== "NON_APPLICABLE" && (
            <InfoRow
              icon={ClipboardCheck}
              label="Statut fin d'année précédente"
              value={STATUT_ANNEE_PRECEDENTE_LABEL[eleveStatutAnneePrecedente] ?? "—"}
            />
          )}
        </RecapBlock>
      )}

      {/* Bloc Santé + notes (si toggle activé ou notes renseignées) */}
      {(hasSanteInfo || notesParent.trim()) && (
        <RecapBlock
          title="Santé & notes"
          icon={HeartPulse}
          onEdit={() => goToStep(3)}
          disabled={isPending}
        >
          {hasSanteInfo && eleveAllergies.trim() && (
            <InfoRow
              icon={HeartPulse}
              label="Allergies"
              value={eleveAllergies}
            />
          )}
          {hasSanteInfo && eleveNotesSante.trim() && (
            <InfoRow
              icon={HeartPulse}
              label="Notes santé"
              value={eleveNotesSante}
            />
          )}
          {notesParent.trim() && (
            <InfoRow
              icon={ClipboardCopy}
              label="Message au secrétariat"
              value={notesParent}
            />
          )}
        </RecapBlock>
      )}

      {/* Alerte finale */}
      <div
        role="status"
        className="flex items-start gap-2 rounded-lg border border-emerald-300 bg-emerald-100/70 p-3 text-xs text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-200"
      >
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p className="break-words leading-snug">
          En soumettant, vous acceptez que vos données soient traitées pour
          instruire votre demande. Le secrétariat vous contactera au{" "}
          <strong>{tuteurTelephone || "numéro renseigné"}</strong> sous 48h.
        </p>
      </div>
    </div>
  );
}

function RecapBlock({
  title,
  icon: Icon,
  onEdit,
  disabled,
  children,
}: {
  title: string;
  icon: LucideIcon;
  onEdit: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-background/60 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/10">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Icon className="size-3.5" aria-hidden="true" />
          </div>
          <h3 className="font-display text-sm font-semibold text-forest">
            {title}
          </h3>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onEdit}
          disabled={disabled}
          title={`Modifier l'étape « ${title} »`}
          className="h-8 border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
        >
          Modifier
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {children}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Input avec validation temps réel (coche verte)
// ─────────────────────────────────────────────────────────────────────────────

function ValidatedInput({
  value,
  isValid,
  className,
  ...props
}: {
  value: string;
  isValid: boolean;
} & React.ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <Input
        value={value}
        className={cn("h-11 pr-9 text-base sm:h-10 sm:text-sm", className)}
        {...props}
      />
      {isValid && value.trim().length > 0 ? (
        <CheckCircle2
          aria-hidden="true"
          className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-emerald-600"
        />
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bannière de détection fratrie
// ─────────────────────────────────────────────────────────────────────────────

function FratrieBanner({
  result,
  onPrefill,
}: {
  result: TuteurFratrieResult;
  onPrefill: () => void;
}) {
  if (!result.found || !result.tuteur) return null;
  const t = result.tuteur;
  const nomComplet = [t.prenoms, t.nom].filter(Boolean).join(" ").trim();
  const nb = result.eleves?.length ?? 0;

  return (
    <div
      role="status"
      className="rounded-xl border border-emerald-300 bg-emerald-100/70 p-4 dark:border-emerald-800/60 dark:bg-emerald-950/30"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
          <Sparkles className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="break-words text-sm font-semibold leading-snug text-emerald-900 dark:text-emerald-100">
            Tuteur reconnu ! {nomComplet || "Ce tuteur"} a déjà {nb}{" "}
            enfant{nb > 1 ? "s" : ""} inscrit{nb > 1 ? "s" : ""} dans le groupe
            ScolaGest.
          </p>
          {nb > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {result.eleves.map((el, i) => {
                const nom = [el.prenoms, el.nom]
                  .filter(Boolean)
                  .join(" ")
                  .trim();
                return (
                  <Badge
                    key={`${nom}-${i}`}
                    variant="outline"
                    className="border-emerald-300 bg-white/80 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
                  >
                    <Users className="mr-1 size-3" aria-hidden="true" />
                    <span className="break-words leading-snug">{nom}</span>
                  </Badge>
                );
              })}
            </div>
          )}
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onPrefill}
              title="Pré-remplir les informations du tuteur depuis la base existante"
              className="h-9 border-emerald-300 bg-white/80 text-emerald-800 hover:bg-emerald-100 hover:text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-900/40 dark:hover:text-emerald-100"
            >
              <Wand2 className="size-3.5" aria-hidden="true" />
              Pré-remplir mes informations
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Écran de succès soigné
// ─────────────────────────────────────────────────────────────────────────────

function SuccessScreen({
  result,
  onCopy,
}: {
  result: SubmitResult;
  onCopy: () => void;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const suiviUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${result.suivi_url}`
      : result.suivi_url;
  const pre = result.pre_inscription;
  const eleveNomComplet = [pre.eleve_prenoms, pre.eleve_nom]
    .filter(Boolean)
    .join(" ")
    .trim();

  const dateSoumissionFormatted = new Date(
    pre.date_soumission,
  ).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-gradient-to-br from-emerald-50 via-background to-amber-50">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-emerald-200/40 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-amber-200/30 blur-3xl"
      />

      <KentePattern variant="strip" position="top" />

      <main className="relative z-10 mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center px-4 py-8 sm:px-6 sm:py-12">
        <motion.div
          initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <GlassCard
            variant="desktop"
            premiumBorder
            noHover
            noAnimation
            className="relative overflow-hidden p-0"
          >
            {/* Kente bg décoratif subtil */}
            <KentePattern variant="bg" />

            {/* Bandeau succès avec icône animée */}
            <div className="relative bg-gradient-to-r from-emerald-600 via-emerald-600 to-amber-500 px-6 py-8 text-center text-white">
              <motion.div
                initial={prefersReducedMotion ? {} : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  delay: 0.2,
                  type: "spring",
                  stiffness: 200,
                  damping: 12,
                }}
                className="mx-auto mb-3 flex size-20 items-center justify-center rounded-full bg-white/25 ring-4 ring-white/30 backdrop-blur"
              >
                <CheckCircle2 className="size-10" aria-hidden="true" />
              </motion.div>
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                Pré-inscription envoyée !
              </h1>
              <p className="mt-2 break-words text-sm leading-snug text-emerald-50">
                Votre demande pour{" "}
                <span className="font-semibold">
                  {eleveNomComplet || "votre enfant"}
                </span>{" "}
                a bien été transmise à l&apos;établissement.
              </p>
            </div>

            {/* Récap court + message rassurant + token */}
            <div className="relative space-y-5 p-5 sm:p-6">
              {/* Récap court */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                  <InfoRow
                    icon={User}
                    label="Élève"
                    value={eleveNomComplet || "—"}
                  />
                  {pre.eleve_nationalite && (
                    <InfoRow
                      icon={Flag}
                      label="Nationalité"
                      value={pre.eleve_nationalite}
                    />
                  )}
                  {pre.etablissement && (
                    <InfoRow
                      icon={School}
                      label="Établissement"
                      value={pre.etablissement.nom}
                    />
                  )}
                  {pre.cycle && (
                    <InfoRow
                      icon={BookOpen}
                      label="Cycle & niveau"
                      value={`${formatCycleCourt(pre.cycle.libelle)}${
                        pre.niveau_souhaite
                          ? ` · ${formatNiveau(pre.cycle.libelle, pre.niveau_souhaite)}`
                          : ""
                      }`}
                    />
                  )}
                  <InfoRow
                    icon={Sparkles}
                    label="Classe définitive"
                    value="Attribuée par l'établissement (à la caisse)"
                  />
                  <InfoRow
                    icon={CalendarDays}
                    label="Soumise le"
                    value={dateSoumissionFormatted}
                  />
                </div>
              </div>

              {/* Message rassurant */}
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-100/80 p-3 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
              >
                <Phone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <p className="break-words leading-snug">
                  Le secrétariat vous contactera au{" "}
                  <strong className="break-words">
                    {pre.tuteur_telephone || "numéro renseigné"}
                  </strong>{" "}
                  sous 48h pour finaliser l&apos;inscription.
                </p>
              </div>

              {/* Numéro de dossier */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Numéro de dossier
                </p>
                <div className="flex items-center gap-2 rounded-lg border-2 border-dashed border-emerald-300 bg-emerald-50/40 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                  <IdCard
                    className="size-5 shrink-0 text-emerald-700 dark:text-emerald-300"
                    aria-hidden="true"
                  />
                  <span className="flex-1 break-all font-mono text-base font-semibold leading-snug text-emerald-800 select-all dark:text-emerald-200">
                    {result.token_suivi}
                  </span>
                </div>
                <p className="break-words text-xs leading-snug text-muted-foreground">
                  Conservez ce numéro : il vous permet de suivre l&apos;état de
                  votre demande sans compte.
                </p>
              </div>

              {/* Lien de suivi */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Lien de suivi
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    asChild
                    variant="success"
                    className="h-11 flex-1 text-base sm:h-10 sm:text-sm"
                  >
                    <Link href={result.suivi_url}>
                      <GraduationCap className="size-4" aria-hidden="true" />
                      Suivre ma demande
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onCopy}
                    title="Copier le lien de suivi dans le presse-papiers"
                    className="h-11 flex-1 text-base sm:h-10 sm:flex-none sm:text-sm"
                  >
                    <ClipboardCopy className="size-4" aria-hidden="true" />
                    Copier le lien
                  </Button>
                </div>
                <p className="break-all rounded-md bg-muted/30 p-2 text-[11px] leading-snug text-muted-foreground">
                  {suiviUrl}
                </p>
              </div>

              <Separator />

              {/* Lien retour */}
              <div className="text-center">
                <Button asChild variant="ghost" size="sm">
                  <Link href="/pre-inscription">
                    Faire une nouvelle pré-inscription
                  </Link>
                </Button>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      </main>

      <Footer className="shrink-0" />
    </div>
  );
}
