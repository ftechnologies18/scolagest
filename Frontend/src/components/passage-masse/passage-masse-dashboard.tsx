"use client";

/**
 * ScolaGest — Tableau de bord « Passage de classe en masse » (Phase 3, Innovation 2).
 *
 * Opération de fin d'année scolaire : promouvoir l'ensemble des élèves d'une
 * année source vers une année cible, en une passe. Workflow en 4 zones :
 *
 *   1. Sélection des années (source = ancienne, présélectionnée = année active ;
 *      cible = nouvelle année).
 *   2. Bouton « Générer l'aperçu » → appelle POST /api/annees-scolaires/preview
 *      et affiche un tableau (une ligne par élève) avec une décision éditable
 *      (PROMU / REDOUBLANT / NON_REINSCRIT). Les diplômés ont un select
 *      désactivé affichant « Diplôme ».
 *   3. Actions rapides (« Tous promus », « Tous redoublants ») + résumé temps
 *      réel (compteurs dynamiques : promus, redoublants, non réinscrits,
 *      diplômes).
 *   4. Bouton « Valider le passage » → POST /api/annees-scolaires/promote →
 *      carte de succès avec les compteurs du PromoteResult + bouton « Nouveau
 *      passage » (reset complet).
 *
 * Refonte Forêt EdTech :
 *  - Hero header GlassCard desktop + KentePattern strip top + badge rond
 *    gradient emerald→gold (GraduationCap) + pill « Phase 3 » outline + pill
 *    « Établissement » emerald.
 *  - 4 StatCards DS (emerald / amber / terracotta / gold) avec stagger.
 *  - Zone de sélection des années : GlassCard adaptive + sections source/cible
 *    avec icônes CalendarDays / ArrowRight + flèche de transition au centre
 *    (desktop) + bouton « Générer l'aperçu » variant success.
 *  - Tableau d'aperçu : GlassCard adaptive noHover p-0 + header bg-emerald-
 *    50/60 + rows motion.tr (stagger delay index*0.02) + hover row bg-emerald-
 *    50/60 + libellés font-display + badges renforcés (border-300 bg-100
 *    text-800) + Select décision avec focus ring emerald + points colorés.
 *  - Pied de page sticky mobile (backdrop-blur + bordure haute) avec badges
 *    résumé renforcés + bouton « Valider le passage » variant success.
 *  - SuccessCard premium : GlassCard desktop premiumBorder + KentePattern bg
 *    + badge rond gradient emerald→gold (Check) + 6 ResultCounter renforcés.
 *  - Empty states premium : KentePattern bg + badges ronds colorés + icône
 *    contextuelle (AlertCircle amber / Users emerald / AlertCircle rose).
 *  - Loading state : KentePattern strip top + Skeletons + Loader2 centré.
 *
 * États : pas d'établissement, chargement des années, erreur, aperçu vide.
 *
 * Le contexte d'établissement vient de `useAuthStore` (filtré côté backend).
 * Couleurs : emerald / amber / terracotta / gold / rose / violet (diplômes)
 * uniquement — jamais indigo ni bleu.
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query (anneesKeys.list / active /
 * enabled: !!etablissement), état local (sourceAnneeId, cibleAnneeId, preview,
 * decisions, loadingPreview, errorPreview, submitting, submitError, result),
 * effects de préselection (source = année active, cible = année suivante),
 * compteurs dynamiques `counts` (useMemo sur preview + decisions), handlers
 * (handleGeneratePreview, handleDecisionChange, handleApplyAll, handleSubmit,
 * handleReset), helpers (fullName, sortPreview), constantes DECISION_LABEL /
 * DECISION_BADGE_CLS (contrastes renforcés). Endpoints backend intacts :
 * POST /api/annees-scolaires/preview, POST /api/annees-scolaires/promote,
 * GET /api/annees-scolaires, GET /api/annees-scolaires/active.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  Check,
  GraduationCap,
  Loader2,
  RefreshCw,
  RotateCw,
  Trophy,
  Users,
  UserX,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import { ApiError } from "@/lib/api-client";
import {
  anneesKeys,
  fetchActiveAnnee,
  fetchAnneesScolaires,
} from "@/lib/api-students";
import type { AnneeScolaire } from "@/lib/types";
import {
  fetchPreview,
  submitPromote,
  type DecisionPassage,
  type EleveDecision,
  type PreviewEleve,
  type PromoteResult,
} from "@/lib/api-passage-masse";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { StatCard } from "@/components/ds/stat-card";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useToast } from "@/hooks/use-toast";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers — couleurs et libellés
// ─────────────────────────────────────────────────────────────────────────────

/** Libellé court d'une décision (pour badges, résumés). */
const DECISION_LABEL: Record<DecisionPassage, string> = {
  PROMU: "Promu",
  REDOUBLANT: "Redoublant",
  NON_REINSCRIT: "Non réinscrit",
};

/** Couleurs sémantiques par décision (badges, accents).
 *  Refonte : contrastes renforcés (border-300 bg-100 text-800 — BUG À ÉVITER #7). */
const DECISION_BADGE_CLS: Record<DecisionPassage, string> = {
  PROMU:
    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200",
  REDOUBLANT:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200",
  NON_REINSCRIT:
    "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200",
};

/** Couleurs du badge « Active » dans les SelectItem (année scolaire active). */
const ANNEE_ACTIVE_BADGE_CLS =
  "border-emerald-300 bg-emerald-100 px-1.5 py-0 text-[10px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200";

/** Nom complet d'un élève (nom + prénoms). */
function fullName(eleve: { eleve_nom: string; eleve_prenoms: string }): string {
  return `${eleve.eleve_prenoms ?? ""} ${eleve.eleve_nom ?? ""}`
    .replace(/\s+/g, " ")
    .trim();
}

/** Tri stable : par classe actuelle puis par nom. */
function sortPreview(rows: PreviewEleve[]): PreviewEleve[] {
  return [...rows].sort((a, b) => {
    const ca = (a.classe_actuelle || "ZZZ").toLowerCase();
    const cb = (b.classe_actuelle || "ZZZ").toLowerCase();
    if (ca !== cb) return ca.localeCompare(cb, "fr");
    const na = (a.eleve_nom || "").toLowerCase();
    const nb = (b.eleve_nom || "").toLowerCase();
    return na.localeCompare(nb, "fr");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function PassageMasseDashboard() {
  const { toast } = useToast();
  const etablissement = useAuthStore((s) => s.etablissement);

  // ─── Chargement des années scolaires (liste + active) ───────────────────────
  const { data: anneesData, isLoading: anneesLoading } = useQuery({
    queryKey: anneesKeys.list(),
    queryFn: fetchAnneesScolaires,
    enabled: !!etablissement,
  });
  const { data: activeAnneeData } = useQuery({
    queryKey: anneesKeys.active(),
    queryFn: fetchActiveAnnee,
    enabled: !!etablissement,
  });

  const annees: AnneeScolaire[] = anneesData ?? [];

  // ─── État local : sélection, aperçu, décisions, soumission ──────────────────
  const [sourceAnneeId, setSourceAnneeId] = React.useState<string>("");
  const [cibleAnneeId, setCibleAnneeId] = React.useState<string>("");

  const [preview, setPreview] = React.useState<PreviewEleve[] | null>(null);
  /** Map eleve_id → décision éditable (initialisée depuis le preview). */
  const [decisions, setDecisions] = React.useState<
    Record<string, DecisionPassage>
  >({});

  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [errorPreview, setErrorPreview] = React.useState<string | null>(null);

  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<PromoteResult | null>(null);

  // ─── Préselection de l'année source = année active ──────────────────────────
  React.useEffect(() => {
    if (!sourceAnneeId && activeAnneeData?.id) {
      setSourceAnneeId(activeAnneeData.id);
    }
  }, [activeAnneeData, sourceAnneeId]);

  // ─── Auto-sélection de l'année cible : première année non-active après source ─
  // (aide l'opérateur sans bloquer — il peut toujours changer manuellement).
  React.useEffect(() => {
    if (!cibleAnneeId && annees.length > 0 && sourceAnneeId) {
      const sourceIdx = annees.findIndex((a) => a.id === sourceAnneeId);
      // L'année cible = année suivante dans la liste (ou la première autre).
      const next =
        sourceIdx >= 0 && sourceIdx + 1 < annees.length
          ? annees[sourceIdx + 1]
          : annees.find((a) => a.id !== sourceAnneeId);
      if (next) setCibleAnneeId(next.id);
    }
  }, [annees, cibleAnneeId, sourceAnneeId]);

  // ─── Compteurs dynamiques (résumé temps réel) ───────────────────────────────
  const counts = React.useMemo(() => {
    let promus = 0;
    let redoublants = 0;
    let nonReinscrits = 0;
    let diplomes = 0;
    if (preview) {
      for (const row of preview) {
        if (row.est_diplome) {
          diplomes += 1;
          continue;
        }
        const d = decisions[row.eleve_id] ?? row.decision;
        if (d === "PROMU") promus += 1;
        else if (d === "REDOUBLANT") redoublants += 1;
        else if (d === "NON_REINSCRIT") nonReinscrits += 1;
      }
    }
    return { promus, redoublants, nonReinscrits, diplomes };
  }, [preview, decisions]);

  // ─── Handlers ───────────────────────────────────────────────────────────────
  async function handleGeneratePreview() {
    if (!sourceAnneeId) {
      toast({
        title: "Année source manquante",
        description: "Sélectionnez l'année scolaire source.",
        variant: "destructive",
      });
      return;
    }
    setLoadingPreview(true);
    setErrorPreview(null);
    setPreview(null);
    setDecisions({});
    setResult(null);
    setSubmitError(null);
    try {
      const rows = await fetchPreview(sourceAnneeId);
      const sorted = sortPreview(rows ?? []);
      setPreview(sorted);
      // Initialise la map des décisions depuis la valeur par défaut du backend.
      const init: Record<string, DecisionPassage> = {};
      for (const r of sorted) init[r.eleve_id] = r.decision;
      setDecisions(init);
      if (sorted.length === 0) {
        toast({
          title: "Aperçu vide",
          description:
            "Aucun élève trouvé pour l'année source sélectionnée.",
        });
      } else {
        toast({
          title: "Aperçu généré",
          description: `${sorted.length} élève(s) à traiter.`,
        });
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Une erreur est survenue lors de la génération de l'aperçu.";
      setErrorPreview(msg);
    } finally {
      setLoadingPreview(false);
    }
  }

  function handleDecisionChange(eleveId: string, value: DecisionPassage) {
    setDecisions((prev) => ({ ...prev, [eleveId]: value }));
  }

  /** Applique une décision à tous les élèves non-diplômés (les diplômés
   *  conservent leur statut « Diplôme » non éditable). */
  function handleApplyAll(decision: DecisionPassage) {
    if (!preview) return;
    setDecisions((prev) => {
      const next = { ...prev };
      for (const row of preview) {
        if (row.est_diplome) continue; // non modifiable
        next[row.eleve_id] = decision;
      }
      return next;
    });
  }

  async function handleSubmit() {
    if (!sourceAnneeId || !cibleAnneeId) {
      toast({
        title: "Sélection incomplète",
        description: "Veuillez sélectionner l'année source et l'année cible.",
        variant: "destructive",
      });
      return;
    }
    if (sourceAnneeId === cibleAnneeId) {
      toast({
        title: "Années identiques",
        description:
          "L'année source et l'année cible doivent être différentes.",
        variant: "destructive",
      });
      return;
    }
    if (!preview || preview.length === 0) return;

    const decisionsArray: EleveDecision[] = preview.map((row) => ({
      eleve_id: row.eleve_id,
      decision: decisions[row.eleve_id] ?? row.decision,
    }));

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await submitPromote(
        sourceAnneeId,
        cibleAnneeId,
        decisionsArray,
      );
      setResult(res);
      toast({
        title: "Passage de classe validé",
        description: `${res.promus} promu(s) · ${res.diplomes} diplômé(s) · ${res.redoublants} redoublant(s).`,
      });
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Une erreur est survenue lors de la validation du passage.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setPreview(null);
    setDecisions({});
    setResult(null);
    setErrorPreview(null);
    setSubmitError(null);
  }

  // ─── Pas d'établissement sélectionné ───────────────────────────────────────
  if (!etablissement) {
    return (
      <PassageMasseShell>
        <EmptyState
          icon={AlertCircle}
          tone="amber"
          title="Sélectionnez un établissement"
          description="Le passage de classe s'applique par établissement. Choisissez un établissement dans la barre latérale pour continuer."
        />
      </PassageMasseShell>
    );
  }

  // ─── Écran de succès (après validation) ─────────────────────────────────────
  if (result) {
    return (
      <PassageMasseShell etablissementNom={etablissement.nom}>
        <SuccessCard
          result={result}
          sourceLibelle={annees.find((a) => a.id === sourceAnneeId)?.libelle}
          cibleLibelle={annees.find((a) => a.id === cibleAnneeId)?.libelle}
          onReset={handleReset}
          submitError={submitError}
        />
      </PassageMasseShell>
    );
  }

  // ─── Vue principale ─────────────────────────────────────────────────────────
  return (
    <PassageMasseShell etablissementNom={etablissement.nom}>
      {/* ─── Sélection des années + bouton aperçu ────────────────────────────── */}
      <GlassCard variant="adaptive" noHover className="p-4 sm:p-5 md:p-6">
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
            {/* Année source */}
            <div className="space-y-2">
              <label
                htmlFor="passage-source-annee"
                className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                <span className="inline-flex size-6 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                  <CalendarDays className="size-3.5" />
                </span>
                Année source (ancienne)
              </label>
              <Select
                value={sourceAnneeId}
                onValueChange={(v) => {
                  setSourceAnneeId(v);
                  // Reset de l'aperçu si l'année source change.
                  handleReset();
                }}
                disabled={anneesLoading || annees.length === 0}
              >
                <SelectTrigger
                  id="passage-source-annee"
                  className="w-full bg-background"
                  aria-label="Année source"
                >
                  <SelectValue
                    placeholder={
                      anneesLoading ? "Chargement…" : "Sélectionner l’année"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {annees.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        <span>{a.libelle}</span>
                        {a.est_active ? (
                          <Badge variant="outline" className={ANNEE_ACTIVE_BADGE_CLS}>
                            Active
                          </Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          · {a.statut}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Flèche de transition (desktop uniquement) */}
            <div className="hidden md:flex md:items-end md:justify-center md:pb-2">
              <span
                className="inline-flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/20 to-amber-500/20 text-amber-700 ring-1 ring-amber-300/40 dark:text-amber-300 dark:ring-amber-800/40"
                aria-hidden
              >
                <ArrowRight className="size-5" />
              </span>
            </div>

            {/* Année cible */}
            <div className="space-y-2">
              <label
                htmlFor="passage-cible-annee"
                className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                <span className="inline-flex size-6 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                  <ArrowRight className="size-3.5" />
                </span>
                Année cible (nouvelle)
              </label>
              <Select
                value={cibleAnneeId}
                onValueChange={setCibleAnneeId}
                disabled={anneesLoading || annees.length === 0}
              >
                <SelectTrigger
                  id="passage-cible-annee"
                  className="w-full bg-background"
                  aria-label="Année cible"
                >
                  <SelectValue
                    placeholder={
                      anneesLoading ? "Chargement…" : "Sélectionner l’année"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {annees.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="flex items-center gap-2">
                        <span>{a.libelle}</span>
                        {a.est_active ? (
                          <Badge variant="outline" className={ANNEE_ACTIVE_BADGE_CLS}>
                            Active
                          </Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          · {a.statut}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleGeneratePreview}
              variant="success"
              disabled={
                loadingPreview ||
                anneesLoading ||
                !sourceAnneeId ||
                annees.length === 0
              }
            >
              {loadingPreview ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Génération…
                </>
              ) : (
                <>
                  <RefreshCw className="size-4" />
                  Générer l&apos;aperçu
                </>
              )}
            </Button>
            {preview ? (
              <span className="text-xs text-muted-foreground">
                {preview.length} élève{preview.length > 1 ? "s" : ""} dans
                l&apos;aperçu
              </span>
            ) : null}
          </div>

          {sourceAnneeId && cibleAnneeId && sourceAnneeId === cibleAnneeId ? (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <AlertCircle className="size-4 shrink-0" />
              L&apos;année source et l&apos;année cible sont identiques —
              sélectionnez deux années distinctes.
            </p>
          ) : null}
        </div>
      </GlassCard>

      {/* ─── Erreur d'aperçu ─────────────────────────────────────────────────── */}
      {errorPreview ? (
        <EmptyState
          icon={AlertCircle}
          tone="rose"
          title="Impossible de générer l'aperçu"
          description={errorPreview}
        />
      ) : null}

      {/* ─── Chargement de l'aperçu (skeleton) ───────────────────────────────── */}
      {loadingPreview && !preview ? <LoadingState /> : null}

      {/* ─── Aperçu (tableau + actions + résumé) ─────────────────────────────── */}
      {preview && preview.length > 0 ? (
        <>
          {/* Résumé temps réel — 4 StatCards DS avec stagger */}
          <section
            aria-label="Résumé des décisions"
            className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 items-stretch"
          >
            <StatCard
              icon={ArrowRight}
              tone="emerald"
              label="Promus"
              value={counts.promus}
              hint="Inscrits dans la classe suivante"
              delay={0}
              className="h-full"
            />
            <StatCard
              icon={RotateCw}
              tone="amber"
              label="Redoublants"
              value={counts.redoublants}
              hint="Restent dans la même classe"
              delay={0.05}
              className="h-full"
            />
            <StatCard
              icon={UserX}
              tone="terracotta"
              label="Non réinscrits"
              value={counts.nonReinscrits}
              hint="Abandons / départs"
              delay={0.1}
              className="h-full"
            />
            <StatCard
              icon={Trophy}
              tone="gold"
              label="Diplômés"
              value={counts.diplomes}
              hint="Fin de cycle (BEPC, CEPE…)"
              delay={0.15}
              className="h-full"
            />
          </section>

          <KentePattern variant="separator" className="my-1" />

          {/* Actions rapides + bouton validation (desktop) */}
          <GlassCard variant="adaptive" noHover className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Actions rapides :
                </span>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApplyAll("PROMU")}
                    className="w-full border-emerald-300 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 dark:border-emerald-800/60 dark:text-emerald-300 dark:hover:bg-emerald-950/40 sm:w-auto"
                  >
                    <Check className="size-3.5" />
                    Tous promus
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleApplyAll("REDOUBLANT")}
                    className="w-full border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900 dark:border-amber-800/60 dark:text-amber-300 dark:hover:bg-amber-950/40 sm:w-auto"
                  >
                    <RotateCw className="size-3.5" />
                    Tous redoublants
                  </Button>
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                variant="success"
                disabled={
                  submitting ||
                  !cibleAnneeId ||
                  sourceAnneeId === cibleAnneeId
                }
                className="hidden w-full sm:inline-flex sm:w-auto"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Validation…
                  </>
                ) : (
                  <>
                    <GraduationCap className="size-4" />
                    Valider le passage
                  </>
                )}
              </Button>
            </div>
            {submitError ? (
              <p
                role="alert"
                className="mt-3 text-xs text-rose-600 dark:text-rose-400 sm:hidden"
              >
                {submitError}
              </p>
            ) : null}
          </GlassCard>

          {/* Tableau d'aperçu */}
          <GlassCard
            variant="adaptive"
            noHover
            noAnimation
            className="overflow-hidden p-0"
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <TableHead className="min-w-[220px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Élève
                    </TableHead>
                    <TableHead className="min-w-[140px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Classe actuelle
                    </TableHead>
                    <TableHead className="min-w-[60px] text-center text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      <span className="sr-only">Vers</span>
                    </TableHead>
                    <TableHead className="min-w-[160px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Classe suivante
                    </TableHead>
                    <TableHead className="min-w-[180px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Décision
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, idx) => {
                    const isDiplome = row.est_diplome;
                    const decision =
                      decisions[row.eleve_id] ?? row.decision;
                    return (
                      <PreviewRow
                        key={row.eleve_id}
                        row={row}
                        isDiplome={isDiplome}
                        decision={decision}
                        index={idx}
                        onDecisionChange={handleDecisionChange}
                      />
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </GlassCard>

          {/* Pied : résumé compact + bouton validation (mobile sticky) */}
          <GlassCard
            variant="adaptive"
            noHover
            noAnimation
            className="sticky bottom-0 z-30 border-t border-emerald-200/60 p-4 sm:static sm:border-t-0 sm:p-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className={DECISION_BADGE_CLS.PROMU}>
                  {counts.promus} promu(s)
                </Badge>
                <Badge variant="outline" className={DECISION_BADGE_CLS.REDOUBLANT}>
                  {counts.redoublants} redoublant(s)
                </Badge>
                <Badge variant="outline" className={DECISION_BADGE_CLS.NON_REINSCRIT}>
                  {counts.nonReinscrits} non réinscrit(s)
                </Badge>
                <Badge
                  variant="outline"
                  className="border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-800/60 dark:bg-violet-950/50 dark:text-violet-200"
                >
                  {counts.diplomes} diplômé(s)
                </Badge>
              </div>
              {submitError ? (
                <p
                  role="alert"
                  className="text-xs text-rose-600 dark:text-rose-400"
                >
                  {submitError}
                </p>
              ) : null}
              <Button
                onClick={handleSubmit}
                variant="success"
                disabled={
                  submitting ||
                  !cibleAnneeId ||
                  sourceAnneeId === cibleAnneeId
                }
                className="w-full sm:hidden"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Validation…
                  </>
                ) : (
                  <>
                    <GraduationCap className="size-4" />
                    Valider le passage
                  </>
                )}
              </Button>
            </div>
          </GlassCard>
        </>
      ) : null}

      {/* ─── Aperçu vide (après génération, 0 élèves) ────────────────────────── */}
      {preview && preview.length === 0 && !loadingPreview ? (
        <EmptyState
          icon={Users}
          tone="emerald"
          title="Aucun élève à traiter"
          description="Aucun élève n'est inscrit dans l'année source sélectionnée. Vérifiez votre sélection ou créez des inscriptions pour cette année."
        />
      ) : null}
    </PassageMasseShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell (hero header premium + KentePattern strip / separator)
// ─────────────────────────────────────────────────────────────────────────────

function PassageMasseShell({
  children,
  etablissementNom,
}: {
  children: React.ReactNode;
  etablissementNom?: string;
}) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <KentePattern variant="strip" position="top" />

      {/* ─── Hero header premium ──────────────────────────────────────── */}
      <GlassCard variant="desktop" noHover className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Badge rond gradient emerald→gold avec icône GraduationCap */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <GraduationCap className="size-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                  Passage de classe en masse
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Promouvez l&apos;ensemble des élèves d&apos;une année vers la
                suivante en une seule opération. Ajustez individuellement
                chaque décision avant validation.
              </p>
              {etablissementNom ? (
                <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {etablissementNom}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </GlassCard>

      <KentePattern variant="separator" className="my-1" />

      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ligne d'aperçu (motion.tr avec stagger delay index*0.02)
// ─────────────────────────────────────────────────────────────────────────────

interface PreviewRowProps {
  row: PreviewEleve;
  isDiplome: boolean;
  decision: DecisionPassage;
  index: number;
  onDecisionChange: (eleveId: string, value: DecisionPassage) => void;
}

function PreviewRow({
  row,
  isDiplome,
  decision,
  index,
  onDecisionChange,
}: PreviewRowProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const animationProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.3,
          delay: Math.min(index * 0.02, 0.4),
          ease: [0.22, 1, 0.36, 1] as const,
        },
      };
  return (
    <motion.tr
      data-slot="table-row"
      className="border-b transition-colors hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:hover:bg-emerald-950/20"
      {...animationProps}
    >
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className="break-words font-display text-sm font-semibold leading-snug text-forest">
            {fullName(row)}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            ID : {row.eleve_id.slice(0, 8)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        {row.classe_actuelle ? (
          <Badge
            variant="outline"
            className="border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
          >
            {row.classe_actuelle}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-center">
        <span
          className="inline-flex size-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
          aria-hidden
        >
          <ArrowRight className="size-3.5" />
        </span>
      </TableCell>
      <TableCell>
        {isDiplome ? (
          <Badge
            variant="outline"
            className="border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-800/60 dark:bg-violet-950/50 dark:text-violet-200"
          >
            <Trophy className="size-3" />
            Diplôme
          </Badge>
        ) : row.classe_suivante ? (
          <Badge
            variant="outline"
            className="border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
          >
            {row.classe_suivante}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {isDiplome ? (
          <Select value="PROMU" disabled>
            <SelectTrigger
              size="sm"
              className="w-full bg-muted/40 text-muted-foreground"
              aria-label="Décision (diplômé)"
            >
              <SelectValue>
                <span className="flex items-center gap-1.5">
                  <Trophy className="size-3.5" />
                  Diplôme
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PROMU">Diplôme</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Select
            value={decision}
            onValueChange={(v) =>
              onDecisionChange(row.eleve_id, v as DecisionPassage)
            }
          >
            <SelectTrigger
              size="sm"
              className="w-full bg-background focus:ring-emerald-500/40"
              aria-label={`Décision pour ${fullName(row)}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PROMU">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  {DECISION_LABEL.PROMU}
                </span>
              </SelectItem>
              <SelectItem value="REDOUBLANT">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-amber-500" />
                  {DECISION_LABEL.REDOUBLANT}
                </span>
              </SelectItem>
              <SelectItem value="NON_REINSCRIT">
                <span className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-rose-500" />
                  {DECISION_LABEL.NON_REINSCRIT}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      </TableCell>
    </motion.tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SuccessCard premium (GlassCard desktop premiumBorder + KentePattern bg)
// ─────────────────────────────────────────────────────────────────────────────

interface SuccessCardProps {
  result: PromoteResult;
  sourceLibelle?: string;
  cibleLibelle?: string;
  onReset: () => void;
  submitError: string | null;
}

function SuccessCard({
  result,
  sourceLibelle,
  cibleLibelle,
  onReset,
  submitError,
}: SuccessCardProps) {
  const total =
    result.promus +
    result.diplomes +
    result.redoublants +
    result.non_reinscrits +
    result.skipped +
    result.erreurs;

  return (
    <GlassCard
      variant="desktop"
      premiumBorder
      noHover
      noAnimation
      className="relative overflow-hidden p-4 sm:p-6"
    >
      <KentePattern variant="bg" />
      <div className="relative space-y-5">
        {/* En-tête succès */}
        <div className="flex items-start gap-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20"
            aria-hidden
          >
            <Check className="size-6" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="font-display text-xl font-bold tracking-tight text-forest">
              Passage de classe validé
            </h2>
            <p className="text-sm text-muted-foreground">
              {sourceLibelle ? (
                <span className="font-medium text-foreground">
                  {sourceLibelle}
                </span>
              ) : (
                "Année source"
              )}{" "}
              <ArrowRight className="inline size-3 align-middle" />{" "}
              {cibleLibelle ? (
                <span className="font-medium text-foreground">
                  {cibleLibelle}
                </span>
              ) : (
                "Année cible"
              )}
              {" · "}
              {total} élève{total > 1 ? "s" : ""} traité
              {total > 1 ? "s" : ""}.
            </p>
          </div>
        </div>

        {/* Grille des compteurs (6 ResultCounter renforcés) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <ResultCounter
            icon={ArrowRight}
            accent="emerald"
            label="Promus"
            value={result.promus}
          />
          <ResultCounter
            icon={Trophy}
            accent="violet"
            label="Diplômés"
            value={result.diplomes}
          />
          <ResultCounter
            icon={RotateCw}
            accent="amber"
            label="Redoublants"
            value={result.redoublants}
          />
          <ResultCounter
            icon={UserX}
            accent="terracotta"
            label="Non réinscrits"
            value={result.non_reinscrits}
          />
          <ResultCounter
            icon={Users}
            accent="slate"
            label="Ignorés"
            value={result.skipped}
            hint="Déjà inscrits"
          />
          <ResultCounter
            icon={AlertCircle}
            accent="rose"
            label="Erreurs"
            value={result.erreurs}
            hint="Transaction annulée"
          />
        </div>

        {submitError ? (
          <p
            role="alert"
            className="rounded-lg border border-rose-300 bg-rose-100 px-3 py-2 text-sm text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200"
          >
            {submitError}
          </p>
        ) : null}

        {result.erreurs > 0 ? (
          <p className="text-xs text-muted-foreground">
            {result.erreurs} élève(s) en erreur — leur transaction a été
            annulée individuellement (les autres ont été traités normalement).
            Consultez les journaux serveur pour le détail.
          </p>
        ) : null}

        {/* Action : nouveau passage */}
        <div className="flex flex-wrap gap-2 pt-1">
          <Button
            onClick={onReset}
            variant="outline"
            className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 dark:border-emerald-800/60 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
          >
            <RefreshCw className="size-4" />
            Nouveau passage
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ResultCounter — compteur compact pour la SuccessCard (bordures renforcées)
// ─────────────────────────────────────────────────────────────────────────────

type ResultTone =
  | "emerald"
  | "amber"
  | "rose"
  | "slate"
  | "violet"
  | "terracotta";

const RESULT_COUNTER_CLS: Record<ResultTone, string> = {
  emerald:
    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200",
  amber:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200",
  rose: "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200",
  slate:
    "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  violet:
    "border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-800/60 dark:bg-violet-950/40 dark:text-violet-200",
  terracotta:
    "border-terracotta bg-terracotta/10 text-terracotta dark:border-terracotta/50 dark:bg-terracotta/15 dark:text-terracotta-light",
};

interface ResultCounterProps {
  icon: React.ElementType;
  accent: ResultTone;
  label: string;
  value: number;
  hint?: string;
}

function ResultCounter({
  icon: Icon,
  accent,
  label,
  value,
  hint,
}: ResultCounterProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-3",
        RESULT_COUNTER_CLS[accent],
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
          {label}
        </span>
        <Icon className="size-3.5 opacity-80" aria-hidden />
      </div>
      <p className="text-2xl font-bold leading-none tabular-nums">{value}</p>
      {hint ? <p className="text-[10px] opacity-70">{hint}</p> : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// États vides premium (KentePattern bg + badge rond coloré + icône Lucide)
// ─────────────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: React.ElementType;
  tone: "emerald" | "amber" | "rose";
  title: string;
  description: string;
}

const EMPTY_STATE_CLS: Record<EmptyStateProps["tone"], string> = {
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
};

function EmptyState({ icon: Icon, tone, title, description }: EmptyStateProps) {
  return (
    <GlassCard
      variant="adaptive"
      noHover
      noAnimation
      className="relative overflow-hidden"
    >
      <KentePattern variant="bg" />
      <div className="relative flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-full",
            EMPTY_STATE_CLS[tone],
          )}
        >
          <Icon className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="font-display text-base font-semibold text-forest">
            {title}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading state premium (KentePattern strip top + Skeletons + Loader2 centré)
// ─────────────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Skeleton className="h-10 w-full max-w-md rounded-lg" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
      <GlassCard
        variant="adaptive"
        noHover
        noAnimation
        className="relative overflow-hidden p-0"
      >
        <KentePattern variant="strip" position="top" />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-emerald-600 dark:text-emerald-400" />
        </div>
      </GlassCard>
    </div>
  );
}
