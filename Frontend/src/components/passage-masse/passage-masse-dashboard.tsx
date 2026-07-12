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
 * États : pas d'établissement, chargement des années, erreur, aperçu vide.
 *
 * Le contexte d'établissement vient de `useAuthStore` (filtré côté backend).
 * Couleurs : emerald / amber / rose / slate uniquement — jamais indigo ni bleu.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  Check,
  GraduationCap,
  Loader2,
  RefreshCw,
  Trophy,
  Users,
  UserX,
  RotateCw,
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
import { Card, CardContent } from "@/components/ui/card";
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

/** Couleurs sémantiques par décision (badges, accents). */
const DECISION_BADGE_CLS: Record<DecisionPassage, string> = {
  PROMU:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  REDOUBLANT:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  NON_REINSCRIT:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
};

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
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  accent: "emerald" | "amber" | "rose" | "slate" | "violet";
  hint?: string;
}

const KPI_ICON_CLS: Record<KpiCardProps["accent"], string> = {
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  amber:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  slate:
    "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  violet:
    "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
};

function KpiCard({ icon: Icon, label, value, accent, hint }: KpiCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-4">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            KPI_ICON_CLS[accent],
          )}
          aria-hidden
        >
          <Icon className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-0.5 text-2xl font-bold leading-tight tabular-nums">
            {value}
          </p>
          {hint ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {hint}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
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
  const [decisions, setDecisions] = React.useState<Record<string, DecisionPassage>>({});

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
      <div className="space-y-4">
        <DashboardHeader />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertCircle className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium">
                Sélectionnez un établissement
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                Le passage de classe s&apos;applique par établissement.
                Choisissez un établissement dans la barre latérale pour
                continuer.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Écran de succès (après validation) ─────────────────────────────────────
  if (result) {
    return (
      <div className="space-y-6">
        <DashboardHeader />
        <SuccessCard
          result={result}
          sourceLibelle={annees.find((a) => a.id === sourceAnneeId)?.libelle}
          cibleLibelle={annees.find((a) => a.id === cibleAnneeId)?.libelle}
          onReset={handleReset}
          submitError={submitError}
        />
      </div>
    );
  }

  // ─── Vue principale ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <DashboardHeader />

      {/* ─── Sélection des années + bouton aperçu ────────────────────────────── */}
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="passage-source-annee"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
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
                  className="w-full"
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
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[10px] text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
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

            <div className="space-y-2">
              <label
                htmlFor="passage-cible-annee"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Année cible (nouvelle)
              </label>
              <Select
                value={cibleAnneeId}
                onValueChange={setCibleAnneeId}
                disabled={anneesLoading || annees.length === 0}
              >
                <SelectTrigger
                  id="passage-cible-annee"
                  className="w-full"
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
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 px-1.5 py-0 text-[10px] text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
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
              className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
            >
              <AlertCircle className="size-4 shrink-0" />
              L&apos;année source et l&apos;année cible sont identiques —
              sélectionnez deux années distinctes.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {/* ─── Erreur d'aperçu ─────────────────────────────────────────────────── */}
      {errorPreview ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium">
                Impossible de générer l&apos;aperçu
              </p>
              <p className="max-w-md text-sm text-muted-foreground">
                {errorPreview}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* ─── Chargement de l'aperçu (skeleton) ───────────────────────────────── */}
      {loadingPreview && !preview ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full max-w-md rounded-lg" />
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      ) : null}

      {/* ─── Aperçu (tableau + actions + résumé) ─────────────────────────────── */}
      {preview && preview.length > 0 ? (
        <>
          {/* Résumé temps réel */}
          <section
            aria-label="Résumé des décisions"
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            <KpiCard
              icon={ArrowRight}
              accent="emerald"
              label="Promus"
              value={counts.promus}
              hint="Inscrits dans la classe suivante"
            />
            <KpiCard
              icon={RotateCw}
              accent="amber"
              label="Redoublants"
              value={counts.redoublants}
              hint="Restent dans la même classe"
            />
            <KpiCard
              icon={UserX}
              accent="rose"
              label="Non réinscrits"
              value={counts.nonReinscrits}
              hint="Abandons / départs"
            />
            <KpiCard
              icon={Trophy}
              accent="violet"
              label="Diplômés"
              value={counts.diplomes}
              hint="Fin de cycle (BEPC, CEPE…)"
            />
          </section>

          {/* Actions rapides + bouton validation */}
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Actions rapides :
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleApplyAll("PROMU")}
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                >
                  <Check className="size-3.5" />
                  Tous promus
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleApplyAll("REDOUBLANT")}
                  className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-950/40"
                >
                  <RotateCw className="size-3.5" />
                  Tous redoublants
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {submitError ? (
                  <span className="hidden text-xs text-rose-600 dark:text-rose-400 sm:inline">
                    {submitError}
                  </span>
                ) : null}
                <Button
                  onClick={handleSubmit}
                  disabled={
                    submitting ||
                    !cibleAnneeId ||
                    sourceAnneeId === cibleAnneeId
                  }
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
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
            </CardContent>
          </Card>

          {/* Tableau d'aperçu */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[220px]">Élève</TableHead>
                      <TableHead className="min-w-[140px]">
                        Classe actuelle
                      </TableHead>
                      <TableHead className="min-w-[60px] text-center">
                        <span className="sr-only">Vers</span>
                      </TableHead>
                      <TableHead className="min-w-[160px]">
                        Classe suivante
                      </TableHead>
                      <TableHead className="min-w-[180px]">Décision</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row) => {
                      const isDiplome = row.est_diplome;
                      const decision =
                        decisions[row.eleve_id] ?? row.decision;
                      return (
                        <TableRow key={row.eleve_id}>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium">
                                {fullName(row)}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                ID : {row.eleve_id.slice(0, 8)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {row.classe_actuelle ? (
                              <Badge
                                variant="outline"
                                className="border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
                              >
                                {row.classe_actuelle}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center text-muted-foreground">
                            <ArrowRight className="mx-auto size-4" />
                          </TableCell>
                          <TableCell>
                            {isDiplome ? (
                              <Badge
                                variant="outline"
                                className="border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300"
                              >
                                <Trophy className="size-3" />
                                Diplôme
                              </Badge>
                            ) : row.classe_suivante ? (
                              <Badge
                                variant="outline"
                                className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                              >
                                {row.classe_suivante}
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
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
                                  handleDecisionChange(
                                    row.eleve_id,
                                    v as DecisionPassage,
                                  )
                                }
                              >
                                <SelectTrigger
                                  size="sm"
                                  className="w-full"
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
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Pied : résumé compact + bouton validation (mobile-friendly) */}
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge
                  variant="outline"
                  className={DECISION_BADGE_CLS.PROMU}
                >
                  {counts.promus} promu(s)
                </Badge>
                <Badge
                  variant="outline"
                  className={DECISION_BADGE_CLS.REDOUBLANT}
                >
                  {counts.redoublants} redoublant(s)
                </Badge>
                <Badge
                  variant="outline"
                  className={DECISION_BADGE_CLS.NON_REINSCRIT}
                >
                  {counts.nonReinscrits} non réinscrit(s)
                </Badge>
                <Badge
                  variant="outline"
                  className="border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300"
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
                disabled={
                  submitting ||
                  !cibleAnneeId ||
                  sourceAnneeId === cibleAnneeId
                }
                className="bg-emerald-600 text-white hover:bg-emerald-700 sm:hidden"
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
            </CardContent>
          </Card>
        </>
      ) : null}

      {/* ─── Aperçu vide (après génération, 0 élèves) ────────────────────────── */}
      {preview && preview.length === 0 && !loadingPreview ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Users className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-medium">Aucun élève à traiter</p>
              <p className="max-w-md text-sm text-muted-foreground">
                Aucun élève n&apos;est inscrit dans l&apos;année source
                sélectionnée. Vérifiez votre sélection ou créez des
                inscriptions pour cette année.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// En-tête + carte de succès
// ─────────────────────────────────────────────────────────────────────────────

function DashboardHeader() {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
        Passage de classe en masse
      </h1>
      <p className="text-sm text-muted-foreground">
        Promouvez l&apos;ensemble des élèves d&apos;une année vers la suivante
        en une seule opération. Ajustez individuellement chaque décision avant
        validation.
      </p>
    </div>
  );
}

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
    <Card className="overflow-hidden border-emerald-200 dark:border-emerald-900/50">
      <CardContent className="space-y-5 p-4 sm:p-6">
        {/* En-tête succès */}
        <div className="flex items-start gap-3">
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
            aria-hidden
          >
            <Check className="size-6" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h2 className="text-lg font-bold tracking-tight">
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

        {/* Grille des compteurs */}
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
            accent="rose"
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
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200"
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
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
          >
            <RefreshCw className="size-4" />
            Nouveau passage
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface ResultCounterProps {
  icon: React.ElementType;
  accent: "emerald" | "amber" | "rose" | "slate" | "violet";
  label: string;
  value: number;
  hint?: string;
}

const RESULT_COUNTER_CLS: Record<ResultCounterProps["accent"], string> = {
  emerald:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  slate:
    "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  violet:
    "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
};

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
        "flex flex-col gap-1 rounded-xl border border-transparent p-3",
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
      {hint ? (
        <p className="text-[10px] opacity-70">{hint}</p>
      ) : null}
    </div>
  );
}
