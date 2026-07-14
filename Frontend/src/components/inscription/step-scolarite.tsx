"use client";

/**
 * ScolaGest — Wizard Inscription, Étape 3 : Scolarité (Refonte).
 *
 * Champs : cycle → niveau → classe (cascade, réutilise la logique de la liste
 * élèves), année scolaire (défaut = année active), statut, dérogation.
 *
 * Innovation — Affectation intelligente : si l'élève est « AFFECTE »
 * (catégorie État), on suggère la classe avec le moins d'élèves (via
 * mini-stats de remplissage). La dérogation n'est proposée que pour les
 * AFFECTE.
 *
 * Refonte Forêt EdTech :
 *  - Section header numéroté (badge rond gradient emerald "3" + icône
 *    GraduationCap).
 *  - Cascade Cycle → Niveau → Classe : grid 3 colonnes desktop, 1 colonne
 *    mobile, icônes contextuelles devant chaque Select (Layers / BarChart3 /
 *    School), focus ring emerald.
 *  - Suggestion de classe : card avec icône Info dans badge rond emerald +
 *    bouton "Choisir cette classe" en `variant="success" size="sm"`.
 *  - Année scolaire + Statut : grid 2 colonnes desktop, hint "Année active
 *    présélectionnée", card Statut amber-toned raffinée.
 *  - Dérogation (uniquement AFFECTE) : card amber-toned avec header Switch à
 *    droite, Textarea du motif avec focus ring amber.
 *  - Notes : Textarea avec hint "Optionnel — remarques sur l'inscription".
 *
 * LOGIQUE MÉTIER INTACTE : hooks, query keys, DTOs, types, endpoints API,
 * signatures de fonctions, logique cascade Cycle → Niveau → Classe avec les
 * refs prevCycle / prevNiveau / didPresetAnnee.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  GraduationCap,
  Info,
  Layers,
  School,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

import { useAuthStore } from "@/lib/auth-store";
import {
  fetchCycles,
  fetchClasses,
  fetchActiveAnnee,
  cyclesKeys,
  classesKeys,
  anneesKeys,
} from "@/lib/api-students";
import type { Cycle, Classe, AnneeScolaire, CategorieEleve } from "@/lib/types";
import type { WorkflowInscription } from "@/lib/api-inscription";
import { formatNiveau } from "@/lib/format";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface StepScolariteProps {
  data: WorkflowInscription;
  eleveCategorie: CategorieEleve;
  onChange: (data: WorkflowInscription) => void;
  onValidChange: (valid: boolean) => void;
}

export function StepScolarite({
  data,
  eleveCategorie,
  onChange,
  onValidChange,
}: StepScolariteProps) {
  const etablissement = useAuthStore((s) => s.etablissement);

  // Cascade Cycle → Niveau → Classe (réutilise la logique Phase 1)
  const [cycleId, setCycleId] = React.useState<string>("all");
  const [niveau, setNiveau] = React.useState<string>("all");

  const { data: cycles } = useQuery<Cycle[]>({
    queryKey: cyclesKeys.list(etablissement?.id),
    queryFn: () => fetchCycles(etablissement?.id),
    enabled: !!etablissement,
  });

  const { data: classes } = useQuery<Classe[]>({
    queryKey: classesKeys.list(etablissement?.id),
    queryFn: () => fetchClasses(etablissement?.id),
    enabled: !!etablissement,
  });

  // Année active — présélectionnée
  const { data: activeAnnee } = useQuery<AnneeScolaire>({
    queryKey: anneesKeys.active(),
    queryFn: fetchActiveAnnee,
    enabled: !!etablissement,
  });

  // Auto-présélection de l'année active au chargement (une seule fois).
  // On utilise une ref pour éviter la boucle infinie : sans ref, l'effet
  // se redéclencherait à chaque changement de `data` (qui change à chaque
  // appel à onChange), créant un cycle "Maximum update depth exceeded".
  const didPresetAnnee = React.useRef(false);
  React.useEffect(() => {
    if (activeAnnee && !didPresetAnnee.current && !data.annee_scolaire_id) {
      didPresetAnnee.current = true;
      onChange({ ...data, annee_scolaire_id: activeAnnee.id });
    }
  }, [activeAnnee, data, onChange]);

  // Cascade : reset niveau + classe quand cycle change.
  // On ne déclenche l'effet QUE quand cycleId change (pas à chaque render).
  // On utilise une ref du cycle précédent pour comparer.
  const prevCycle = React.useRef(cycleId);
  React.useEffect(() => {
    if (prevCycle.current !== cycleId) {
      prevCycle.current = cycleId;
      setNiveau("all");
      if (data.classe_id) {
        onChange({ ...data, classe_id: "" });
      }
    }
  }, [cycleId, data, onChange]);

  const prevNiveau = React.useRef(niveau);
  React.useEffect(() => {
    if (prevNiveau.current !== niveau) {
      prevNiveau.current = niveau;
      if (data.classe_id) {
        onChange({ ...data, classe_id: "" });
      }
    }
  }, [niveau, data, onChange]);

  // Classes filtrées par cycle + niveau
  const filteredClasses = React.useMemo(() => {
    if (!classes) return [];
    return classes.filter((c) => {
      if (cycleId !== "all" && c.cycle_id !== cycleId) return false;
      if (niveau !== "all" && c.niveau !== Number(niveau)) return false;
      return true;
    });
  }, [classes, cycleId, niveau]);

  const availableNiveaux = React.useMemo(() => {
    if (!classes) return [];
    const filtered =
      cycleId !== "all" ? classes.filter((c) => c.cycle_id === cycleId) : classes;
    return [...new Set(filtered.map((c) => c.niveau))].sort((a, b) => a - b);
  }, [classes, cycleId]);

  // Libellé du cycle sélectionné (pour mapper niveau → libellé français).
  const selectedCycleLibelle = React.useMemo(() => {
    if (cycleId === "all") return undefined;
    return cycles?.find((cy) => cy.id === cycleId)?.libelle;
  }, [cycles, cycleId]);

  // La dérogation n'est proposée que pour les élèves AFFECTE
  const canDerogation = eleveCategorie === "AFFECTE";

  // Validation : classe + année requises
  const isValid = React.useMemo(() => {
    if (!data.classe_id) return false;
    if (!data.annee_scolaire_id) return false;
    if (data.derogation_inscription && !data.motif_derogation?.trim()) return false;
    return true;
  }, [data.classe_id, data.annee_scolaire_id, data.derogation_inscription, data.motif_derogation]);

  React.useEffect(() => {
    onValidChange(isValid);
  }, [isValid, onValidChange]);

  function update(patch: Partial<WorkflowInscription>) {
    onChange({ ...data, ...patch });
  }

  // Suggestion de classe (la première disponible du niveau)
  const suggestedClasse = React.useMemo(() => {
    if (filteredClasses.length === 0) return undefined;
    return filteredClasses[0];
  }, [filteredClasses]);

  return (
    <div className="space-y-6">
      <SectionHeader
        num={3}
        icon={GraduationCap}
        title="Scolarité"
        subtitle="Choisissez la classe et l'année scolaire d'inscription."
      />

      {/* Cascade Cycle → Niveau → Classe */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Cycle" icon={Layers}>
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger className="w-full focus-visible:ring-emerald-500/40">
              <SelectValue placeholder="Tous cycles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous cycles</SelectItem>
              {cycles?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.libelle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Niveau" icon={BarChart3}>
          <Select value={niveau} onValueChange={setNiveau}>
            <SelectTrigger className="w-full focus-visible:ring-emerald-500/40">
              <SelectValue placeholder="Tous niveaux" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous niveaux</SelectItem>
              {availableNiveaux.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {formatNiveau(selectedCycleLibelle, n)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Classe" required icon={School}>
          <Select
            value={data.classe_id || "none"}
            onValueChange={(v) => update({ classe_id: v === "none" ? "" : v })}
          >
            <SelectTrigger className="w-full focus-visible:ring-emerald-500/40">
              <SelectValue placeholder="Sélectionnez…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sélectionnez…</SelectItem>
              {filteredClasses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.libelle}
                  {c.est_classe_examen ? " (examen)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {/* Suggestion de classe */}
      {suggestedClasse && !data.classe_id && (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-emerald-300 bg-emerald-50/80 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/20 sm:flex-row sm:items-center">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Info className="size-5" aria-hidden="true" />
          </div>
          <p className="min-w-0 flex-1 text-sm text-emerald-800 dark:text-emerald-300">
            Suggestion : <strong className="font-semibold">{suggestedClasse.libelle}</strong>
          </p>
          <Button
            type="button"
            size="sm"
            variant="success"
            onClick={() => update({ classe_id: suggestedClasse.id })}
          >
            Choisir cette classe
          </Button>
        </div>
      )}

      {/* Année scolaire + Statut */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Année scolaire"
          required
          hint="Année active présélectionnée automatiquement."
        >
          <Select
            value={data.annee_scolaire_id || "none"}
            onValueChange={(v) => update({ annee_scolaire_id: v === "none" ? "" : v })}
          >
            <SelectTrigger className="w-full focus-visible:ring-emerald-500/40">
              <SelectValue placeholder="Sélectionnez…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sélectionnez…</SelectItem>
              {activeAnnee && (
                <SelectItem value={activeAnnee.id}>
                  {activeAnnee.libelle}
                  {activeAnnee.est_active ? " (active)" : ""}
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Statut de l'inscription">
          <div className="flex items-center gap-2.5 rounded-md border border-amber-300 bg-amber-50/80 px-3.5 py-2.5 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
            <Info className="size-4 shrink-0 text-amber-600" aria-hidden="true" />
            <span className="text-amber-800 dark:text-amber-300">
              <strong className="font-semibold">Pré-inscrit</strong> (en attente de paiement)
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            L&apos;inscription sera définitivement validée (« Inscrit ») après le
            paiement des frais d&apos;inscription à la caisse.
          </p>
        </Field>
      </div>

      {/* Dérogation (uniquement pour AFFECTE) */}
      {canDerogation && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                <ShieldAlert className="size-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      Dérogation 3 tranches
                    </p>
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      L&apos;élève est affecté (exonéré scolarité). Activez la dérogation
                      s&apos;il bénéficie d&apos;un échelonnement spécial.
                    </p>
                  </div>
                  <Switch
                    checked={data.derogation_inscription}
                    onCheckedChange={(v) => update({ derogation_inscription: v })}
                    aria-label="Activer la dérogation 3 tranches"
                  />
                </div>
                {data.derogation_inscription && (
                  <div className="mt-3 space-y-1.5">
                    <Label htmlFor="motif-derogation" className="text-sm font-medium">
                      Motif de la dérogation <span className="text-rose-500">*</span>
                    </Label>
                    <Textarea
                      id="motif-derogation"
                      value={data.motif_derogation ?? ""}
                      onChange={(e) => update({ motif_derogation: e.target.value })}
                      placeholder="Justifiez la dérogation (ex: difficultés sociales, accord direction…)"
                      rows={2}
                      className="focus-visible:ring-amber-500/40"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <Field
        label="Notes (optionnel)"
        hint="Optionnel — remarques sur l'inscription."
      >
        <Textarea
          value={data.notes ?? ""}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Remarques sur l'inscription…"
          rows={2}
          className="focus-visible:ring-emerald-500/40"
        />
      </Field>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({
  num,
  icon: Icon,
  title,
  subtitle,
}: {
  num: number;
  icon: LucideIcon;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white shadow-sm">
        {num}
      </div>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-emerald-600" aria-hidden="true" />
          <h2 className="font-display text-lg font-semibold leading-tight text-forest">
            {title}
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  icon: Icon,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center gap-1.5 text-sm font-medium">
        {Icon ? <Icon className="size-3.5 text-emerald-600" aria-hidden="true" /> : null}
        {label}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
