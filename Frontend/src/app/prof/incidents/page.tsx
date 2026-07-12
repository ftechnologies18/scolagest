"use client";

/**
 * ScolaGest — Signalement d&apos;incident disciplinaire (route `/prof/incidents`).
 *
 * Formulaire mobile-first pour qu&apos;un enseignant signale un incident :
 *   - Recherche d&apos;élève (combobox Popover + input de recherche, debounced).
 *     On appelle directement `apiGet("/api/eleves?search=...")` car le prof
 *     peut ne pas avoir accès aux helpers staff (fetchEleves renvoie une
 *     ElevesListResponse paginée — on l&apos;utilise ici en mode lecture seule).
 *   - Catégorie (ABSENTEISME, IMPOLITESSE, COMPORTEMENT, TRAVAIL, RETARD).
 *   - Gravité (MINEUR, MODERE, SEVERE, CRITIQUE).
 *   - Description (textarea).
 *   - Switch « Signalement anonyme » : si coché, l&apos;admin ne verra pas quel
 *     prof a signalé (le backend mettra enseignant_id à NULL côté lecture).
 *   - Date de l&apos;incident (défaut : aujourd&apos;hui).
 *   - Bouton « Envoyer le signalement ».
 *
 * Au succès : écran de confirmation + boutons « Nouveau signalement » /
 * « Retour à mon espace ». Toast sur erreur.
 */

import * as React from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Flag,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Search,
  User,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { apiGet, ApiError } from "@/lib/api-client";
import {
  CATEGORIE_LABEL,
  GRAVITE_LABEL,
  createIncident,
  type CategorieIncident,
  type GraviteIncident,
  type TicketDTO,
  type TicketIncident,
} from "@/lib/api-incident";
import type { Eleve, ElevesListResponse } from "@/lib/types";
import { todayISO, dateInputToISO, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Constantes UI
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES: CategorieIncident[] = [
  "ABSENTEISME",
  "IMPOLITESSE",
  "COMPORTEMENT",
  "TRAVAIL",
  "RETARD",
];

const GRAVITES: GraviteIncident[] = ["MINEUR", "MODERE", "SEVERE", "CRITIQUE"];

const GRAVITE_TONE: Record<GraviteIncident, string> = {
  MINEUR: "border-emerald-300 bg-emerald-50 text-emerald-700",
  MODERE: "border-sky-300 bg-sky-50 text-sky-700",
  SEVERE: "border-amber-300 bg-amber-50 text-amber-700",
  CRITIQUE: "border-rose-300 bg-rose-50 text-rose-700",
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper : appel direct /api/eleves (le prof n&apos;a peut-être pas fetchEleves)
// ─────────────────────────────────────────────────────────────────────────────

function searchEleves(search: string): Promise<Eleve[]> {
  const qs = new URLSearchParams({
    search,
    page: "1",
    page_size: "10",
  });
  // apiGet attache automatiquement le token staff (le prof a le même token).
  return apiGet<ElevesListResponse>(`/api/eleves?${qs.toString()}`).then(
    (r) => r.data ?? [],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant : combobox de recherche d&apos;élève
// ─────────────────────────────────────────────────────────────────────────────

interface EleveComboboxProps {
  value: Eleve | null;
  onChange: (eleve: Eleve | null) => void;
}

function EleveCombobox({ value, onChange }: EleveComboboxProps) {
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isFetching } = useQuery({
    queryKey: ["prof", "eleves-search", debounced],
    queryFn: () => searchEleves(debounced),
    enabled: debounced.length >= 2,
  });
  const results = data ?? [];

  function handleSelect(e: Eleve) {
    onChange(e);
    setSearch("");
    setDebounced("");
    setOpen(false);
  }

  function handleClear() {
    onChange(null);
    setSearch("");
    setDebounced("");
  }

  // Si un élève est déjà sélectionné, on l&apos;affiche en lecture seule.
  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50/50 p-2.5">
        <div className="flex size-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <User className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {[value.prenoms, value.nom].filter(Boolean).join(" ")}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {value.identifiant_interne}
            {value.matricule_ministere ? ` · ${value.matricule_ministere}` : ""}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="size-8 p-0 text-muted-foreground hover:text-rose-600"
          onClick={handleClear}
          aria-label="Changer d'élève"
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Rechercher un élève par nom…"
            className="h-11 pl-9"
            autoComplete="off"
            aria-label="Rechercher un élève"
          />
          {isFetching ? (
            <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          ) : null}
        </div>
      </PopoverTrigger>
      <PopoverContent
        className="p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="max-h-72 overflow-y-auto">
          {debounced.length < 2 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              Saisissez au moins 2 caractères.
            </p>
          ) : results.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              Aucun élève trouvé.
            </p>
          ) : (
            <ul className="divide-y">
              {results.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(e)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                      <User className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {[e.prenoms, e.nom].filter(Boolean).join(" ")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.identifiant_interne}
                        {e.matricule_ministere ? ` · ${e.matricule_ministere}` : ""}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Écran de confirmation
// ─────────────────────────────────────────────────────────────────────────────

function ConfirmationScreen({
  ticket,
  onNouveau,
}: {
  ticket: TicketIncident;
  onNouveau: () => void;
}) {
  return (
    <Card className="border-emerald-200 bg-emerald-50/50">
      <CardHeader className="items-center text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="size-7" />
        </div>
        <CardTitle className="text-base text-emerald-800">
          Signalement envoyé
        </CardTitle>
        <CardDescription className="text-emerald-700/80">
          Votre ticket a été enregistré sous la référence{" "}
          <span className="font-mono font-medium">
            #{ticket.id.slice(0, 8).toUpperCase()}
          </span>
          . La direction prendra en charge le traitement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-md bg-background/60 p-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-muted-foreground">Catégorie</p>
              <p className="font-medium">
                {CATEGORIE_LABEL[ticket.categorie]}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gravité</p>
              <Badge
                variant="outline"
                className={cn("mt-0.5", GRAVITE_TONE[ticket.gravite])}
              >
                {GRAVITE_LABEL[ticket.gravite]}
              </Badge>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-muted-foreground">Date incident</p>
              <p className="font-medium">{formatDate(ticket.date_incident)}</p>
            </div>
            {ticket.anonyme ? (
              <div className="col-span-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-700">
                Signalement anonyme — votre identité n&apos;est pas visible côté
                administration.
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button type="button" onClick={onNouveau} className="h-11 gap-2">
            <Flag className="size-4" />
            Nouveau signalement
          </Button>
          <Button asChild variant="outline" className="h-11 gap-2">
            <Link href="/prof">
              <ArrowLeft className="size-4" />
              Retour à mon espace
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfIncidentsPage() {
  const { toast } = useToast();

  const [eleve, setEleve] = React.useState<Eleve | null>(null);
  const [categorie, setCategorie] = React.useState<CategorieIncident | "">("");
  const [gravite, setGravite] = React.useState<GraviteIncident | "">("");
  const [description, setDescription] = React.useState("");
  const [anonyme, setAnonyme] = React.useState(false);
  const [dateIncident, setDateIncident] = React.useState<string>(todayISO());

  const [submitting, setSubmitting] = React.useState(false);
  const [success, setSuccess] = React.useState<TicketIncident | null>(null);

  function resetForm() {
    setEleve(null);
    setCategorie("");
    setGravite("");
    setDescription("");
    setAnonyme(false);
    setDateIncident(todayISO());
    setSuccess(null);
  }

  function validate(): string | null {
    if (!eleve) return "Veuillez sélectionner un élève.";
    if (!categorie) return "Veuillez choisir une catégorie.";
    if (!gravite) return "Veuillez choisir une gravité.";
    if (description.trim().length < 5)
      return "Veuillez saisir une description (au moins 5 caractères).";
    if (!dateIncident) return "Veuillez indiquer la date de l'incident.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) {
      toast({ title: "Formulaire incomplet", description: err, variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const dto: TicketDTO = {
        eleve_id: eleve!.id,
        categorie: categorie as CategorieIncident,
        gravite: gravite as GraviteIncident,
        description: description.trim(),
        date_incident: dateInputToISO(dateIncident),
        anonyme,
      };
      const ticket = await createIncident(dto);
      setSuccess(ticket);
      toast({
        title: "Signalement envoyé",
        description: `Ticket #${ticket.id.slice(0, 8).toUpperCase()} enregistré.`,
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Échec de l'envoi. Réessayez.";
      toast({
        title: "Échec du signalement",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 h-9 gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <Link href="/prof">
          <ArrowLeft className="size-4" />
          Retour à mon espace
        </Link>
      </Button>

      <div>
        <h1 className="font-display flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl">
          <Flag className="size-6 text-amber-600" />
          Signaler un incident
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Renseignez les détails ci-dessous. La direction sera notifiée.
        </p>
      </div>

      <KentePattern variant="separator" className="my-4" />

      {success ? (
        <ConfirmationScreen ticket={success} onNouveau={resetForm} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <GlassCard variant="adaptive" noHover>
            <div className="mb-3 flex flex-col gap-1.5">
              <h3 className="font-display text-base font-semibold">Élève concerné</h3>
              <p className="text-sm text-muted-foreground">
                Recherchez l&apos;élève par nom ou matricule.
              </p>
            </div>
            <div>
              <EleveCombobox value={eleve} onChange={setEleve} />
            </div>
          </GlassCard>

          <GlassCard variant="adaptive" noHover>
            <div className="mb-3">
              <h3 className="font-display text-base font-semibold">Nature de l&apos;incident</h3>
            </div>
            <div className="space-y-4">
              {/* Catégorie */}
              <div className="space-y-1.5">
                <Label htmlFor="cat">Catégorie *</Label>
                <Select
                  value={categorie}
                  onValueChange={(v) => setCategorie(v as CategorieIncident)}
                >
                  <SelectTrigger id="cat" className="h-11">
                    <SelectValue placeholder="Choisir une catégorie…" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CATEGORIE_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Gravité */}
              <div className="space-y-1.5">
                <Label htmlFor="grav">Gravité *</Label>
                <Select
                  value={gravite}
                  onValueChange={(v) => setGravite(v as GraviteIncident)}
                >
                  <SelectTrigger id="grav" className="h-11">
                    <SelectValue placeholder="Choisir une gravité…" />
                  </SelectTrigger>
                  <SelectContent>
                    {GRAVITES.map((g) => (
                      <SelectItem key={g} value={g}>
                        <span className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-block size-2 rounded-full",
                              g === "MINEUR" && "bg-emerald-500",
                              g === "MODERE" && "bg-sky-500",
                              g === "SEVERE" && "bg-amber-500",
                              g === "CRITIQUE" && "bg-rose-500",
                            )}
                          />
                          {GRAVITE_LABEL[g]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {gravite ? (
                  <Badge
                    variant="outline"
                    className={cn("mt-1", GRAVITE_TONE[gravite as GraviteIncident])}
                  >
                    {GRAVITE_LABEL[gravite as GraviteIncident]}
                  </Badge>
                ) : null}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="desc">Description *</Label>
                <Textarea
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez les faits (contexte, témoins, etc.)."
                  rows={5}
                  className="resize-y"
                  maxLength={1000}
                />
                <p className="text-right text-xs text-muted-foreground">
                  {description.length}/1000
                </p>
              </div>

              {/* Date incident */}
              <div className="space-y-1.5">
                <Label htmlFor="date">Date de l&apos;incident *</Label>
                <Input
                  id="date"
                  type="date"
                  value={dateIncident}
                  max={todayISO()}
                  onChange={(e) => setDateIncident(e.target.value)}
                  className="h-11"
                />
              </div>
            </div>
          </GlassCard>

          <GlassCard variant="adaptive" noHover className="border-amber-200 bg-amber-50/40">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-800" />
              <h3 className="font-display text-base font-semibold text-amber-800">Signalement anonyme</h3>
            </div>
            <div>
              <div className="flex items-start gap-3">
                <Switch
                  id="anonyme"
                  checked={anonyme}
                  onCheckedChange={setAnonyme}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label
                    htmlFor="anonyme"
                    className="cursor-pointer text-sm font-medium"
                  >
                    Masquer mon identité
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Si coché, l&apos;administration ne verra pas quel enseignant a
                    émis ce signalement.
                  </p>
                </div>
              </div>
            </div>
          </GlassCard>

          <Button
            type="submit"
            size="lg"
            variant="premium"
            disabled={submitting}
            className="h-12 w-full gap-2 text-base"
          >
            {submitting ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                Envoi en cours…
              </>
            ) : (
              <>
                <Flag className="size-5" />
                Envoyer le signalement
              </>
            )}
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            En soumettant ce formulaire, vous certifiez que les informations
            communiquées sont exactes.
          </p>
        </form>
      )}
    </div>
  );
}
