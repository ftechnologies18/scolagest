"use client";

/**
 * ScolaGest — Wizard Inscription, Étape 2 : Tuteur / Parent.
 *
 * Deux modes :
 *  1. « Tuteur existant » : recherche par téléphone → si trouvé, on
 *     référence son ID (utile pour les fratries : évite la re-saisie).
 *  2. « Nouveau tuteur » : saisie complète des champs.
 *
 * Le basculement entre modes se fait via un ToggleGroup. Quand un tuteur
 * existant est sélectionné, les champs de saisie sont masqués.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Search, UserCheck, UserPlus, Phone } from "lucide-react";

import { searchTuteurByPhone, type WorkflowTuteur, type LienParente } from "@/lib/api-inscription";
import type { Tuteur } from "@/lib/types";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

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
      <div>
        <h2 className="text-lg font-semibold">Tuteur / Parent</h2>
        <p className="text-sm text-muted-foreground">
          Recherchez un tuteur existant (fratrie) ou créez-en un nouveau.
        </p>
      </div>

      {/* Sélecteur de mode */}
      <ToggleGroup
        type="single"
        value={mode}
        onValueChange={(v) => v && switchMode(v as Mode)}
        className="justify-start"
      >
        <ToggleGroupItem value="existing" className="gap-1.5">
          <UserCheck className="size-4" />
          Tuteur existant
        </ToggleGroupItem>
        <ToggleGroupItem value="new" className="gap-1.5">
          <UserPlus className="size-4" />
          Nouveau tuteur
        </ToggleGroupItem>
      </ToggleGroup>

      {/* Mode tuteur existant */}
      {mode === "existing" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Recherche par téléphone</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchPhone}
                onChange={(e) => {
                  setSearchPhone(e.target.value);
                  update({ tuteur_id: null });
                }}
                placeholder="07 07 07 07 07"
                className="pl-8"
              />
              {isFetching && (
                <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Saisissez le numéro de téléphone du parent. S&apos;il a déjà un enfant
              inscrit, son tuteur apparaîtra.
            </p>
          </div>

          {/* Résultats */}
          {canSearch && searchResults && searchResults.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {searchResults.length} tuteur(s) trouvé(s)
              </p>
              {searchResults.slice(0, 5).map((t) => {
                const selected = data.tuteur_id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => selectTuteur(t)}
                    className={[
                      "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                      selected
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                        : "border-border hover:border-emerald-300 hover:bg-muted/50",
                    ].join(" ")}
                  >
                    <div className="flex size-9 items-center justify-center rounded-full bg-muted">
                      <Phone className="size-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {t.prenoms} {t.nom}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {t.telephone}
                        {t.profession ? ` · ${t.profession}` : ""}
                      </p>
                    </div>
                    {selected && (
                      <Badge className="bg-emerald-600">Sélectionné</Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {canSearch && searchResults && searchResults.length === 0 && !isFetching && (
            <Card>
              <CardContent className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
                <Search className="size-4" />
                Aucun tuteur trouvé pour ce numéro. Basculez sur « Nouveau tuteur ».
              </CardContent>
            </Card>
          )}

          {/* Tuteur sélectionné */}
          {data.tuteur_id && (
            <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <CardContent className="py-3">
                <p className="text-xs text-muted-foreground">Tuteur sélectionné</p>
                {(() => {
                  const t = searchResults?.find((x) => x.id === data.tuteur_id);
                  return t ? (
                    <p className="font-medium">
                      {t.prenoms} {t.nom} — {t.telephone}
                    </p>
                  ) : (
                    <p className="font-mono text-sm">{data.tuteur_id}</p>
                  );
                })()}
              </CardContent>
            </Card>
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
            />
          </Field>
          <Field label="Prénoms">
            <Input
              value={data.prenoms ?? ""}
              onChange={(e) => update({ prenoms: e.target.value })}
              placeholder="Aminata"
            />
          </Field>
          <Field label="Téléphone" required>
            <Input
              value={data.telephone ?? ""}
              onChange={(e) => update({ telephone: e.target.value })}
              placeholder="07 07 07 07 07"
              required
            />
          </Field>
          <Field label="Téléphone 2">
            <Input
              value={data.telephone2 ?? ""}
              onChange={(e) => update({ telephone2: e.target.value })}
              placeholder="01 02 03 04 05"
            />
          </Field>
          <Field label="Lien de parenté">
            <Select
              value={data.lien_parente || "AUTRE"}
              onValueChange={(v) => update({ lien_parente: v as LienParente })}
            >
              <SelectTrigger>
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
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={data.email ?? ""}
              onChange={(e) => update({ email: e.target.value })}
              placeholder="parent@email.ci"
            />
          </Field>
          <Field label="Adresse">
            <Input
              value={data.adresse ?? ""}
              onChange={(e) => update({ adresse: e.target.value })}
              placeholder="Cocody, Abidjan"
            />
          </Field>
        </div>
      )}
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
