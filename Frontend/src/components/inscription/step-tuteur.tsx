"use client";

/**
 * ScolaGest — Wizard Inscription, Étape 2 : Tuteur / Parent (Refonte).
 *
 * Deux modes :
 *  1. « Tuteur existant » : recherche par téléphone → si trouvé, on
 *     référence son ID (utile pour les fratries : évite la re-saisie).
 *  2. « Nouveau tuteur » : saisie complète des champs.
 *
 * Le basculement entre modes se fait via un ToggleGroup. Quand un tuteur
 * existant est sélectionné, les champs de saisie sont masqués.
 *
 * Refonte Forêt EdTech :
 *  - Section header numéroté (badge rond gradient emerald "2" + icône Users).
 *  - ToggleGroup mode : boutons larges avec icônes UserCheck / UserPlus.
 *    Mode actif : `bg-emerald-600 text-white`. Inactif : `hover:bg-emerald-50`.
 *  - Recherche téléphone : input avec icône Search à gauche + Loader2 à
 *    droite pendant la recherche. Hint "Format international recommandé
 *    (+225 …)".
 *  - Résultats : cards mini `GlassCard variant="mobile"` avec hover emerald,
 *    avatar initiales dans badge rond emerald, animation stagger.
 *  - Tuteur sélectionné : card premium avec bordure emerald + icône Check.
 *  - Formulaire nouveau tuteur : grid 2 colonnes desktop, hints
 *    contextuels sous Téléphone et Email.
 *
 * LOGIQUE MÉTIER INTACTE : hooks, query keys, DTOs, types, endpoints API,
 * signatures de fonctions (data / onChange / onValidChange), mode toggle,
 * selectTuteur, switchMode.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Check,
  Loader2,
  Search,
  UserCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { searchTuteurByPhone, type WorkflowTuteur, type LienParente } from "@/lib/api-inscription";
import type { Tuteur } from "@/lib/types";

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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { GlassCard } from "@/components/ds/glass-card";
import { initialsOf } from "@/components/eleves/eleves-list";

interface StepTuteurProps {
  data: WorkflowTuteur;
  onChange: (data: WorkflowTuteur) => void;
  onValidChange: (valid: boolean) => void;
}

type Mode = "existing" | "new";

export function StepTuteur({ data, onChange, onValidChange }: StepTuteurProps) {
  const [mode, setMode] = React.useState<Mode>(
    data.tuteur_id ? "existing" : "new",
  );
  const [searchPhone, setSearchPhone] = React.useState("");

  // Recherche de tuteur par téléphone (dès 6 chiffres)
  const normalizedPhone = searchPhone.replace(/\s/g, "");
  const canSearch = normalizedPhone.length >= 6;
  const { data: searchResults, isFetching } = useQuery({
    queryKey: ["search-tuteur", normalizedPhone],
    queryFn: () => searchTuteurByPhone(normalizedPhone),
    enabled: canSearch && mode === "existing",
  });

  // Validation
  const isValid = React.useMemo(() => {
    if (mode === "existing") return !!data.tuteur_id;
    // nouveau tuteur : nom + téléphone requis
    return !!(data.nom?.trim() && data.telephone?.trim());
  }, [mode, data.tuteur_id, data.nom, data.telephone]);

  React.useEffect(() => {
    onValidChange(isValid);
  }, [isValid, onValidChange]);

  function update(patch: Partial<WorkflowTuteur>) {
    onChange({ ...data, ...patch });
  }

  function switchMode(newMode: Mode) {
    setMode(newMode);
    if (newMode === "new") {
      update({ tuteur_id: null });
    } else {
      // Conserver les champs saisis au cas où l'utilisateur revient
      update({ tuteur_id: null });
    }
  }

  function selectTuteur(t: Tuteur) {
    update({ tuteur_id: t.id });
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        num={2}
        icon={UserCheck}
        title="Tuteur / Parent"
        subtitle="Recherchez un tuteur existant (fratrie) ou créez-en un nouveau."
      />

      {/* Sélecteur de mode — boutons larges avec icônes */}
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(v) => v && switchMode(v as Mode)}
        className="justify-start gap-2"
      >
        <ToggleGroupItem
          value="existing"
          aria-label="Tuteur existant"
          className="gap-1.5 border px-4 py-2 text-sm font-medium data-[state=on]:bg-emerald-600 data-[state=on]:text-white data-[state=on]:shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
        >
          <UserCheck className="size-4" aria-hidden="true" />
          Tuteur existant
        </ToggleGroupItem>
        <ToggleGroupItem
          value="new"
          aria-label="Nouveau tuteur"
          className="gap-1.5 border px-4 py-2 text-sm font-medium data-[state=on]:bg-emerald-600 data-[state=on]:text-white data-[state=on]:shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
        >
          <UserPlus className="size-4" aria-hidden="true" />
          Nouveau tuteur
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Mode tuteur existant */}
      {mode === "existing" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tuteur-search" className="text-sm font-medium">
              Recherche par téléphone
            </Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="tuteur-search"
                value={searchPhone}
                onChange={(e) => {
                  setSearchPhone(e.target.value);
                  update({ tuteur_id: null });
                }}
                placeholder="07 07 07 07 07"
                className="pl-8 pr-9 focus-visible:ring-emerald-500/40"
                inputMode="tel"
              />
              {isFetching ? (
                <Loader2
                  className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-emerald-600"
                  aria-hidden="true"
                />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Saisissez le numéro du parent. S&apos;il a déjà un enfant inscrit,
              son tuteur apparaîtra. Format international recommandé
              (+225 07 07 07 07 07).
            </p>
          </div>

          {/* Résultats */}
          {canSearch && searchResults && searchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {searchResults.length} tuteur{searchResults.length > 1 ? "s" : ""} trouvé
                {searchResults.length > 1 ? "s" : ""}
              </p>
              {searchResults.slice(0, 5).map((t, idx) => {
                const selected = data.tuteur_id === t.id;
                return (
                  <GlassCard
                    key={t.id}
                    variant="mobile"
                    delay={idx * 0.05}
                    onClick={() => selectTuteur(t)}
                    className={[
                      "cursor-pointer p-3 transition-colors",
                      selected
                        ? "border-emerald-500 ring-2 ring-emerald-500/20 dark:border-emerald-500"
                        : "hover:border-emerald-300",
                    ].join(" ")}
                    aria-label={`Sélectionner ${t.prenoms ?? ""} ${t.nom}`.trim()}
                  >
                    <div className="flex w-full items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
                        {initialsOf(t.nom, t.prenoms)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold leading-snug text-foreground">
                          {[t.prenoms, t.nom].filter(Boolean).join(" ")}
                        </p>
                        <p className="break-words text-xs text-muted-foreground">
                          {t.telephone}
                          {t.profession ? ` · ${t.profession}` : ""}
                        </p>
                      </div>
                      {selected ? (
                        <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                          <Check className="mr-0.5 size-3" aria-hidden="true" />
                          Sélectionné
                        </Badge>
                      ) : null}
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}

          {canSearch && searchResults && searchResults.length === 0 && !isFetching && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              <Search className="size-4 shrink-0" aria-hidden="true" />
              Aucun tuteur trouvé pour ce numéro. Basculez sur « Nouveau tuteur ».
            </div>
          )}

          {/* Tuteur sélectionné — card premium */}
          {data.tuteur_id && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50/80 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div className="flex items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <Check className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-xs text-muted-foreground">Tuteur sélectionné</p>
                  {(() => {
                    const t = searchResults?.find((x) => x.id === data.tuteur_id);
                    return t ? (
                      <p className="font-semibold leading-snug text-foreground">
                        {[t.prenoms, t.nom].filter(Boolean).join(" ")}
                        <span className="ml-2 break-words text-sm font-normal text-muted-foreground">
                          {t.telephone}
                        </span>
                      </p>
                    ) : (
                      <p className="font-mono text-sm text-muted-foreground">
                        {data.tuteur_id}
                      </p>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode nouveau tuteur */}
      {mode === "new" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nom" required>
            <Input
              value={data.nom ?? ""}
              onChange={(e) => update({ nom: e.target.value.toUpperCase() })}
              placeholder="TRAORÉ"
              required
              className="focus-visible:ring-emerald-500/40"
            />
          </Field>
          <Field label="Prénoms">
            <Input
              value={data.prenoms ?? ""}
              onChange={(e) => update({ prenoms: e.target.value })}
              placeholder="Aminata"
              className="focus-visible:ring-emerald-500/40"
            />
          </Field>
          <Field
            label="Téléphone"
            required
            hint="Format international recommandé (+225 07 07 07 07 07)."
          >
            <Input
              value={data.telephone ?? ""}
              onChange={(e) => update({ telephone: e.target.value })}
              placeholder="07 07 07 07 07"
              required
              inputMode="tel"
              className="focus-visible:ring-emerald-500/40"
            />
          </Field>
          <Field
            label="Téléphone 2"
            hint="Optionnel — numéro secondaire."
          >
            <Input
              value={data.telephone2 ?? ""}
              onChange={(e) => update({ telephone2: e.target.value })}
              placeholder="01 02 03 04 05"
              inputMode="tel"
              className="focus-visible:ring-emerald-500/40"
            />
          </Field>
          <Field label="Lien de parenté">
            <Select
              value={data.lien_parente || "AUTRE"}
              onValueChange={(v) => update({ lien_parente: v as LienParente })}
            >
              <SelectTrigger className="w-full focus-visible:ring-emerald-500/40">
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
              value={data.profession ?? ""}
              onChange={(e) => update({ profession: e.target.value })}
              placeholder="Commerçante"
              className="focus-visible:ring-emerald-500/40"
            />
          </Field>
          <Field
            label="Email"
            hint="Optionnel — pour notifications."
            className="sm:col-span-2"
          >
            <Input
              type="email"
              value={data.email ?? ""}
              onChange={(e) => update({ email: e.target.value })}
              placeholder="parent@email.ci"
              className="focus-visible:ring-emerald-500/40"
            />
          </Field>
          <Field label="Quartier d'habitation" className="sm:col-span-2">
            <Input
              value={data.adresse ?? ""}
              onChange={(e) => update({ adresse: e.target.value })}
              placeholder="Ex : Cocody Angré, Abidjan"
              className="focus-visible:ring-emerald-500/40"
            />
          </Field>
        </div>
      )}
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
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={["space-y-1.5", className].filter(Boolean).join(" ")}>
      <Label className="text-sm font-medium">
        {label}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
