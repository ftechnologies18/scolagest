"use client";

/**
 * ScolaGest — Wizard Inscription, Étape 1 : Identité de l'élève (Refonte).
 *
 * Champs : nom, prénoms, sexe, date/lieu naissance, catégorie, matricule min.
 *
 * Innovations :
 *  - Détection de doublon en temps réel (dès que nom + date naissance sont
 *    saisis) → bannière d'alerte amber avec lien vers la fiche existante.
 *  - Aperçu de l'identifiant interne auto-généré (ex: COL-2026-0007) affiché
 *    en lecture seule dès le chargement.
 *
 * Refonte Forêt EdTech :
 *  - Section header numéroté : badge rond gradient emerald "1" + icône User +
 *    titre `font-display text-lg` + sous-titre.
 *  - Aperçu identifiant auto : `GlassCard variant="mobile"` premium avec
 *    icône Fingerprint dans badge rond emerald, valeur en `font-mono text-lg
 *    font-bold text-emerald-700`, badge "Prévisualisation" en pill gold,
 *    pulse subtil pendant le chargement.
 *  - Détection doublon : card d'alerte avec bordure amber-300 + AlertTriangle
 *    dans badge rond amber + boutons doublons en mini-cards avec hover emerald.
 *  - Formulaire : grid 2 colonnes desktop, 1 colonne mobile, focus ring emerald
 *    sur les inputs, astérisque rose pour les champs requis, Select Sexe avec
 *    icônes Mars/Venus comme dans eleves-list.
 *
 * LOGIQUE MÉTIER INTACTE : hooks, query keys, DTOs, types, endpoints API,
 * signatures de fonctions (data / onChange / onValidChange).
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ExternalLink,
  Fingerprint,
  Flag,
  Loader2,
  Mars,
  Venus,
  User,
  type LucideIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";

import { useAuthStore } from "@/lib/auth-store";
import {
  checkDoublon,
  fetchNextIdentifiant,
  type WorkflowEleve,
} from "@/lib/api-inscription";

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
import { GlassCard } from "@/components/ds/glass-card";

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

  // Validation : nom + sexe + (catégorie si appliqueCategorie) + matricule si Collège/Lycée
  const isValid = React.useMemo(() => {
    if (!data.nom.trim()) return false;
    if (!data.sexe) return false;
    if (appliqueCategorie && data.categorie === "NON_APPLICABLE") return false;
    // Collège/Lycée : matricule ministériel obligatoire
    if (appliqueCategorie && !(data.matricule_ministere ?? "").trim()) return false;
    return true;
  }, [data.nom, data.sexe, data.categorie, appliqueCategorie, data.matricule_ministere]);

  React.useEffect(() => {
    onValidChange(isValid);
  }, [isValid, onValidChange]);

  function update(patch: Partial<WorkflowEleve>) {
    onChange({ ...data, ...patch });
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        num={1}
        icon={User}
        title="Identité de l'élève"
        subtitle={
          appliqueCategorie
            ? "Renseignez l'état civil. Le matricule ministériel est obligatoire."
            : "Renseignez l'état civil. L'identifiant interne est généré automatiquement."
        }
      />

      {/* Aperçu identifiant auto — UNIQUEMENT pour Primaire/Préscolaire (pas Collège/Lycée) */}
      {!appliqueCategorie && (
      <GlassCard variant="mobile" noHover className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Fingerprint className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              Identifiant interne (auto-généré)
            </p>
            {identifiantLoading ? (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                génération…
              </p>
            ) : (
              <p className="font-mono text-lg font-bold leading-snug text-emerald-700 dark:text-emerald-300">
                {identifiantData?.identifiant ?? "—"}
              </p>
            )}
          </div>
          <Badge className="border border-gold/40 bg-gold/15 text-gold-dark dark:text-gold-light">
            Prévisualisation
          </Badge>
        </div>
      </GlassCard>
      )}

      {/* Détection doublon — alerte amber */}
      {doublons.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/80 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {doublons.length} élève{doublons.length > 1 ? "s" : ""} similaire
                {doublons.length > 1 ? "s" : ""} trouvé
                {doublons.length > 1 ? "s" : ""}
                {doublonFetching ? " (recherche…)" : ""}
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Un élève avec le même nom et la même date de naissance existe peut-être
                déjà. Vérifiez avant de continuer.
              </p>
              <div className="flex flex-wrap gap-2 pt-1.5">
                {doublons.slice(0, 3).map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => router.push(`/eleves`)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-emerald-950/30"
                  >
                    <ExternalLink className="size-3" aria-hidden="true" />
                    {d.identifiant_interne} — {d.prenoms} {d.nom}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Formulaire */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nom" required>
          <Input
            value={data.nom}
            onChange={(e) => update({ nom: e.target.value.toUpperCase() })}
            placeholder="KOUASSI"
            required
            className="focus-visible:ring-emerald-500/40"
          />
        </Field>
        <Field label="Prénoms">
          <Input
            value={data.prenoms}
            onChange={(e) => update({ prenoms: e.target.value })}
            placeholder="Yann Eric"
            className="focus-visible:ring-emerald-500/40"
          />
        </Field>
        <Field label="Sexe" required>
          <Select
            value={data.sexe || "none"}
            onValueChange={(v) => update({ sexe: v === "none" ? "" : (v as "M" | "F") })}
          >
            <SelectTrigger className="w-full focus-visible:ring-emerald-500/40">
              <SelectValue placeholder="Sélectionnez…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sélectionnez…</SelectItem>
              <SelectItem value="M">
                <span className="flex items-center gap-2">
                  <Mars className="size-3.5 text-blue-700 dark:text-blue-400" aria-hidden="true" />
                  Masculin
                </span>
              </SelectItem>
              <SelectItem value="F">
                <span className="flex items-center gap-2">
                  <Venus className="size-3.5 text-rose-700 dark:text-rose-400" aria-hidden="true" />
                  Féminin
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Date de naissance">
          <Input
            type="date"
            value={data.date_naissance ?? ""}
            onChange={(e) => update({ date_naissance: e.target.value || null })}
            className="focus-visible:ring-emerald-500/40"
          />
        </Field>
        <Field label="Lieu de naissance">
          <Input
            value={data.lieu_naissance}
            onChange={(e) => update({ lieu_naissance: e.target.value })}
            placeholder="Abidjan"
            className="focus-visible:ring-emerald-500/40"
          />
        </Field>
        <Field
          label="Matricule ministériel"
          required={appliqueCategorie}
          hint={
            appliqueCategorie
              ? "Obligatoire pour le Collège/Lycée. Fourni par le Ministère de l'Éducation."
              : "Optionnel pour le Primaire/Préscolaire."
          }
        >
          <Input
            value={data.matricule_ministere ?? ""}
            onChange={(e) => update({ matricule_ministere: e.target.value || null })}
            placeholder="CI-00245-MEN-001"
            className="font-mono focus-visible:ring-emerald-500/40"
          />
        </Field>
        {appliqueCategorie && (
          <Field
            label="Catégorie"
            required
            hint="Affecté = élève de l'État exonéré de scolarité. Non affecté = élève libre."
          >
            <Select
              value={data.categorie}
              onValueChange={(v) => update({ categorie: v as "AFFECTE" | "NON_AFFECTE" })}
            >
              <SelectTrigger className="w-full focus-visible:ring-emerald-500/40">
                <SelectValue placeholder="Sélectionnez…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AFFECTE">Affecté (exonéré scolarité)</SelectItem>
                <SelectItem value="NON_AFFECTE">Non affecté</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field
          label="Nationalité"
          hint="Nationalité telle qu'inscrite sur l'extrait de naissance ou le passeport."
        >
          <div className="relative">
            <Flag
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={data.nationalite ?? ""}
              onChange={(e) => update({ nationalite: e.target.value })}
              placeholder="Ex : Ivoirienne, Malienne, Burkinabè…"
              autoComplete="off"
              className="pl-9 focus-visible:ring-emerald-500/40"
            />
          </div>
        </Field>
      </div>
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
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        {label}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
