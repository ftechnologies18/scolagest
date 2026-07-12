"use client";

/**
 * ScolaGest — Wizard Inscription, Étape 3 : Scolarité.
 *
 * Champs : cycle → niveau → classe (cascade, réutilise la logique de la liste
 * élèves), année scolaire (défaut = année active), statut, dérogation.
 *
 * Innovation — Affectation intelligente : si l'élève est « AFFECTE »
 * (catégorie État), on suggère la classe avec le moins d'élèves (via
 * mini-stats de remplissage). La dérogation n'est proposée que pour les
 * AFFECTE.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { GraduationCap, Loader2, ShieldAlert, Info } from "lucide-react";

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
import type { WorkflowInscription, StatutInscription } from "@/lib/api-inscription";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAnnee]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycleId]);

  const prevNiveau = React.useRef(niveau);
  React.useEffect(() => {
    if (prevNiveau.current !== niveau) {
      prevNiveau.current = niveau;
      if (data.classe_id) {
        onChange({ ...data, classe_id: "" });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [niveau]);

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
      <div>
        <h2 className="text-lg font-semibold">Scolarité</h2>
        <p className="text-sm text-muted-foreground">
          Choisissez la classe et l&apos;année scolaire d&apos;inscription.
        </p>
      </div>

      {/* Cascade Cycle → Niveau → Classe */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Cycle">
          <Select value={cycleId} onValueChange={setCycleId}>
            <SelectTrigger>
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

        <Field label="Niveau">
          <Select value={niveau} onValueChange={setNiveau}>
            <SelectTrigger>
              <SelectValue placeholder="Tous niveaux" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous niveaux</SelectItem>
              {availableNiveaux.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Niveau {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Classe" required>
          <Select
            value={data.classe_id || "none"}
            onValueChange={(v) => update({ classe_id: v === "none" ? "" : v })}
          >
            <SelectTrigger>
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
        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20">
          <CardContent className="flex items-center gap-3 py-3">
            <Info className="size-4 text-emerald-600" />
            <p className="flex-1 text-sm text-emerald-800 dark:text-emerald-300">
              Suggestion : <strong>{suggestedClasse.libelle}</strong>
            </p>
            <button
              onClick={() => update({ classe_id: suggestedClasse.id })}
              className="text-xs font-medium text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-400"
            >
              Choisir cette classe
            </button>
          </CardContent>
        </Card>
      )}

      {/* Année scolaire + Statut */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Année scolaire" required>
          <Select
            value={data.annee_scolaire_id || "none"}
            onValueChange={(v) => update({ annee_scolaire_id: v === "none" ? "" : v })}
          >
            <SelectTrigger>
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
          {activeAnnee && (
            <p className="text-xs text-muted-foreground">
              Année active présélectionnée : {activeAnnee.libelle}
            </p>
          )}
        </Field>

        <Field label="Statut de l&apos;inscription">
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50/50 px-3 py-2 text-sm dark:border-amber-900/50 dark:bg-amber-950/20">
            <Info className="size-4 shrink-0 text-amber-600" />
            <span className="text-amber-800 dark:text-amber-300">
              <strong>Pré-inscrit</strong> (en attente de paiement)
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            L&apos;inscription sera définitivement validée (« Inscrit ») après
            le paiement des frais d&apos;inscription à la caisse.
          </p>
        </Field>
      </div>

      {/* Dérogation (uniquement pour AFFECTE) */}
      {canDerogation && (
        <Card className="border-amber-200 bg-amber-50/30 dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardContent className="space-y-3 py-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Dérogation 3 tranches</p>
                    <p className="text-xs text-muted-foreground">
                      L&apos;élève est affecté (exonéré scolarité). Activez la dérogation
                      s&apos;il bénéficie d&apos;un échelonnement spécial.
                    </p>
                  </div>
                  <Switch
                    checked={data.derogation_inscription}
                    onCheckedChange={(v) =>
                      update({ derogation_inscription: v })
                    }
                  />
                </div>
                {data.derogation_inscription && (
                  <div className="mt-3 space-y-1.5">
                    <Label className="text-sm font-medium">
                      Motif de la dérogation <span className="text-rose-500">*</span>
                    </Label>
                    <Textarea
                      value={data.motif_derogation ?? ""}
                      onChange={(e) => update({ motif_derogation: e.target.value })}
                      placeholder="Justifiez la dérogation (ex: difficultés sociales, accord direction…)"
                      rows={2}
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Field label="Notes (optionnel)">
        <Textarea
          value={data.notes ?? ""}
          onChange={(e) => update({ notes: e.target.value })}
          placeholder="Remarques sur l'inscription…"
          rows={2}
        />
      </Field>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </Label>
      {children}
    </div>
  );
}
