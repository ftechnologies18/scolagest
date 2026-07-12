"use client";

/**
 * ScolaGest — Wizard Inscription, Étape 1 : Identité de l'élève.
 *
 * Champs : nom, prénoms, sexe, date/lieu naissance, catégorie, matricule min.
 *
 * Innovations :
 *  - Détection de doublon en temps réel (dès que nom + date naissance sont
 *    saisis) → bannière d'alerte avec lien vers la fiche existante.
 *  - Aperçu de l'identifiant interne auto-généré (ex: COL-2026-0007) affiché
 *    en lecture seule dès le chargement.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Eye, Fingerprint, Loader2, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/lib/auth-store";
import { checkDoublon, fetchNextIdentifiant, type WorkflowEleve } from "@/lib/api-inscription";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
} from "@/components/ui/card";

interface StepEleveProps {
  data: WorkflowEleve;
  onChange: (data: WorkflowEleve) => void;
  onValidChange: (valid: boolean) => void;
}

export function StepEleve({ data, onChange, onValidChange }: StepEleveProps) {
  const router = useRouter();
  const etablissement = useAuthStore((s) => s.etablissement);
  const appliqueCategorie = !!etablissement?.applique_categorie_affecte;

  // Aperçu de l'identifiant interne auto-généré
  const { data: identifiantData, isLoading: identifiantLoading } = useQuery({
    queryKey: ["next-identifiant"],
    queryFn: fetchNextIdentifiant,
  });

  // Détection de doublon (debounce via la query key)
  const nomTrimmed = data.nom?.trim() ?? "";
  const canCheckDoublon = nomTrimmed.length >= 2 && !!data.date_naissance;
  const { data: doublonData, isFetching: doublonFetching } = useQuery({
    queryKey: ["check-doublon", nomTrimmed, data.date_naissance, data.matricule_ministere],
    queryFn: () =>
      checkDoublon({
        nom: nomTrimmed,
        date_naissance: data.date_naissance ?? undefined,
        matricule: data.matricule_ministere ?? undefined,
      }),
    enabled: canCheckDoublon,
    staleTime: 10_000,
  });

  const doublons = doublonData?.doublons ?? [];

  // Validation : nom + sexe + (catégorie si appliqueCategorie) requis
  const isValid = React.useMemo(() => {
    if (!data.nom.trim()) return false;
    if (!data.sexe) return false;
    if (appliqueCategorie && data.categorie === "NON_APPLICABLE") return false;
    return true;
  }, [data.nom, data.sexe, data.categorie, appliqueCategorie]);

  React.useEffect(() => {
    onValidChange(isValid);
  }, [isValid, onValidChange]);

  function update(patch: Partial<WorkflowEleve>) {
    onChange({ ...data, ...patch });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Identité de l&apos;élève</h2>
        <p className="text-sm text-muted-foreground">
          Renseignez l&apos;état civil de l&apos;élève. L&apos;identifiant interne est
          généré automatiquement.
        </p>
      </div>

      {/* Aperçu identifiant auto */}
      <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/20">
        <Fingerprint className="size-5 text-emerald-600" />
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">Identifiant interne (auto-généré)</p>
          {identifiantLoading ? (
            <p className="text-sm text-muted-foreground">
              <Loader2 className="inline size-3 animate-spin" /> génération…
            </p>
          ) : (
            <p className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-400">
              {identifiantData?.identifiant ?? "—"}
            </p>
          )}
        </div>
        <Badge variant="outline" className="border-emerald-300 text-emerald-700">
          Prévisualisation
        </Badge>
      </div>

      {/* Détection doublon */}
      {doublons.length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardContent className="flex items-start gap-3 py-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="flex-1 space-y-1.5">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                {doublons.length} élève{doublons.length > 1 ? "s" : ""} similaire
                {doublons.length > 1 ? "s" : ""} trouvé{doublons.length > 1 ? "s" : ""}
                {doublonFetching ? " (recherche…)" : ""}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Un élève avec le même nom et la même date de naissance existe peut-être
                déjà. Vérifiez avant de continuer.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {doublons.slice(0, 3).map((d) => (
                  <button
                    key={d.id}
                    onClick={() => router.push(`/eleves`)}
                    className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
                  >
                    <ExternalLink className="size-3" />
                    {d.identifiant_interne} — {d.prenoms} {d.nom}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Formulaire */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nom" required>
          <Input
            value={data.nom}
            onChange={(e) => update({ nom: e.target.value.toUpperCase() })}
            placeholder="KOUASSI"
            required
          />
        </Field>
        <Field label="Prénoms">
          <Input
            value={data.prenoms}
            onChange={(e) => update({ prenoms: e.target.value })}
            placeholder="Yann Eric"
          />
        </Field>
        <Field label="Sexe" required>
          <Select
            value={data.sexe || "none"}
            onValueChange={(v) => update({ sexe: v === "none" ? "" : (v as "M" | "F") })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sélectionnez…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sélectionnez…</SelectItem>
              <SelectItem value="M">Masculin</SelectItem>
              <SelectItem value="F">Féminin</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Date de naissance">
          <Input
            type="date"
            value={data.date_naissance ?? ""}
            onChange={(e) => update({ date_naissance: e.target.value || null })}
          />
        </Field>
        <Field label="Lieu de naissance">
          <Input
            value={data.lieu_naissance}
            onChange={(e) => update({ lieu_naissance: e.target.value })}
            placeholder="Abidjan"
          />
        </Field>
        <Field label="Matricule ministériel">
          <Input
            value={data.matricule_ministere ?? ""}
            onChange={(e) => update({ matricule_ministere: e.target.value || null })}
            placeholder="CI-00245-MEN-001"
          />
        </Field>
        {appliqueCategorie && (
          <Field label="Catégorie" required>
            <Select
              value={data.categorie}
              onValueChange={(v) => update({ categorie: v as "AFFECTE" | "NON_AFFECTE" })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AFFECTE">Affecté (exonéré scolarité)</SelectItem>
                <SelectItem value="NON_AFFECTE">Non affecté</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
      </div>
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
