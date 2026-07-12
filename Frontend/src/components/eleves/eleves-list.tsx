"use client";

/**
 * ScolaGest — Liste des élèves (Phase 2)
 *
 * Vue principale du module Élèves :
 *  - Barre de recherche (debounce 300ms) sur nom / matricule.
 *  - Filtres : classe, catégorie (selon établissement), statut.
 *  - Bouton "Nouvel élève" (emerald) qui ouvre le formulaire de création.
 *  - Tableau (shadcn Table) avec photo+nom, matricule, classe courante,
 *    catégorie (badge), statut (badge), actions voir/modifier.
 *  - Pagination prev/next + "page X sur Y".
 *  - États : chargement (skeleton), vide ("Aucun élève trouvé"), erreur.
 *
 * Le contexte d'établissement vient de `useAuthStore`. Si aucun
 * établissement n'est sélectionné, on invite l'utilisateur à en choisir un.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Eye,
  Pencil,
  Plus,
  Search,
  Users,
  UserPlus,
  AlertCircle,
  Download,
  FileText,
  FileSpreadsheet,
  File as FileIcon,
  Loader2,
  GraduationCap,
  TrendingDown,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchEleves,
  fetchElevesExport,
  fetchElevesStats,
  fetchClasses,
  fetchCycles,
  elevesKeys,
  classesKeys,
  cyclesKeys,
} from "@/lib/api-students";
import type {
  CategorieEleve,
  Classe,
  Cycle,
  Eleve,
  EleveStats,
  ElevesQueryParams,
  StatutEleve,
} from "@/lib/types";
import {
  exportElevesCSV,
  exportElevesExcel,
  exportElevesPDF,
} from "@/lib/export-students";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers partagés (exportés pour réutilisation dans le détail / formulaire)
// ─────────────────────────────────────────────────────────────────────────────

export function initialsOf(nom?: string, prenoms?: string): string {
  const a = (nom ?? "").trim().charAt(0);
  const b = (prenoms ?? "").trim().charAt(0);
  return (a + b).toUpperCase() || "?";
}

export function eleveFullName(eleve: Eleve): string {
  return [eleve.prenoms, eleve.nom].filter(Boolean).join(" ").trim() || "—";
}

export const CATEGORIE_LABEL: Record<CategorieEleve, string> = {
  AFFECTE: "Affecté",
  NON_AFFECTE: "Non affecté",
  NON_APPLICABLE: "Non applicable",
};

export const STATUT_LABEL: Record<StatutEleve, string> = {
  ACTIF: "Actif",
  INACTIF: "Inactif",
  TRANSFERE: "Transféré",
  DIPLOME: "Diplômé",
};

export function CategorieBadge({ categorie }: { categorie: CategorieEleve }) {
  const cls: Record<CategorieEleve, string> = {
    AFFECTE:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    NON_AFFECTE:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
    NON_APPLICABLE:
      "border-muted-foreground/20 bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", cls[categorie])}>
      {CATEGORIE_LABEL[categorie]}
    </Badge>
  );
}

export function StatutBadge({ statut }: { statut: StatutEleve }) {
  const cls: Record<StatutEleve, string> = {
    ACTIF:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    INACTIF:
      "border-muted-foreground/20 bg-muted text-muted-foreground",
    TRANSFERE:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
    DIPLOME:
      "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", cls[statut])}>
      {STATUT_LABEL[statut]}
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export interface ElevesListProps {
  /** Aller à la vue de création d'élève. */
  onCreate: () => void;
  /** Aller à la vue de détail d'un élève. */
  onSelect: (id: string) => void;
  /** Aller à la vue d'édition d'un élève. */
  onEdit: (id: string) => void;
}

const PAGE_SIZE = 20;

export function ElevesList({ onCreate, onSelect, onEdit }: ElevesListProps) {
  const etablissement = useAuthStore((s) => s.etablissement);

  // État des filtres
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [cycleId, setCycleId] = React.useState<string>("all");
  const [niveau, setNiveau] = React.useState<string>("all"); // string pour le Select, converti en number
  const [classeId, setClasseId] = React.useState<string>("all");
  const [categorie, setCategorie] = React.useState<CategorieEleve | "all">(
    "all",
  );
  const [statut, setStatut] = React.useState<StatutEleve | "all">("all");
  const [page, setPage] = React.useState(1);
  const [exporting, setExporting] = React.useState(false);

  // Debounce de la recherche (300ms)
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Réinitialise la page quand un filtre change
  React.useEffect(() => {
    setPage(1);
  }, [cycleId, niveau, classeId, categorie, statut]);

  // Quand le cycle change, on réinitialise le niveau et la classe (cascade)
  React.useEffect(() => {
    setNiveau("all");
    setClasseId("all");
  }, [cycleId]);

  // Quand le niveau change, on réinitialise la classe (cascade)
  React.useEffect(() => {
    setClasseId("all");
  }, [niveau]);

  // L'établissement décide des catégories disponibles
  const appliqueCategorie = !!etablissement?.applique_categorie_affecte;

  // Paramètres de requête
  const queryParams: ElevesQueryParams = React.useMemo(
    () => ({
      search: debouncedSearch || undefined,
      cycle_id: cycleId !== "all" ? cycleId : undefined,
      niveau: niveau !== "all" ? Number(niveau) : undefined,
      classe_id: classeId !== "all" ? classeId : undefined,
      categorie: categorie !== "all" ? categorie : undefined,
      statut: statut !== "all" ? statut : undefined,
      page,
      page_size: PAGE_SIZE,
    }),
    [debouncedSearch, cycleId, niveau, classeId, categorie, statut, page],
  );

  const { data, isLoading, isError, error, isFetching } = useQuery({
    queryKey: elevesKeys.list(queryParams),
    queryFn: () => fetchEleves(queryParams),
    enabled: !!etablissement,
  });

  // Classes du contexte (pour le filtre "classe")
  const { data: classes } = useQuery<Classe[]>({
    queryKey: classesKeys.list(etablissement?.id),
    queryFn: () => fetchClasses(etablissement?.id),
    enabled: !!etablissement,
  });

  // Cycles du contexte (pour le filtre "cycle")
  const { data: cycles } = useQuery<Cycle[]>({
    queryKey: cyclesKeys.list(etablissement?.id),
    queryFn: () => fetchCycles(etablissement?.id),
    enabled: !!etablissement,
  });

  // Mini-stats contextuelles (total, garçons/filles, redoublants)
  const { data: stats } = useQuery<EleveStats>({
    queryKey: [...elevesKeys.lists(), "stats", queryParams],
    queryFn: () => fetchElevesStats(queryParams),
    enabled: !!etablissement,
  });

  // ─── Logique cascade : Cycle → Niveau → Classe ───────────────────────────
  // Classes filtrées par cycle puis par niveau (dérivation côté client depuis
  // la liste déjà chargée — aucun appel API supplémentaire).
  const filteredClasses = React.useMemo(() => {
    if (!classes) return [];
    return classes.filter((c) => {
      if (cycleId !== "all" && c.cycle_id !== cycleId) return false;
      if (niveau !== "all" && c.niveau !== Number(niveau)) return false;
      return true;
    });
  }, [classes, cycleId, niveau]);

  // Niveaux distincts dérivés des classes du cycle sélectionné.
  const availableNiveaux = React.useMemo(() => {
    if (!classes) return [];
    const filtered = cycleId !== "all"
      ? classes.filter((c) => c.cycle_id === cycleId)
      : classes;
    const niveaux = [...new Set(filtered.map((c) => c.niveau))].sort(
      (a, b) => a - b,
    );
    return niveaux;
  }, [classes, cycleId]);

  // Libellé de la classe sélectionnée (pour le nom de fichier d'export)
  const selectedClasseLibelle = React.useMemo(() => {
    if (classeId === "all") return undefined;
    return classes?.find((c) => c.id === classeId)?.libelle;
  }, [classes, classeId]);

  // ─── Export (PDF / Excel / CSV) ──────────────────────────────────────────
  const handleExport = React.useCallback(
    async (format: "pdf" | "xlsx" | "csv") => {
      setExporting(true);
      try {
        const allEleves = await fetchElevesExport(queryParams);
        if (allEleves.length === 0) return;
        const ctx = {
          etablissement,
          classeLibelle: selectedClasseLibelle,
        };
        if (format === "pdf") exportElevesPDF(allEleves, ctx);
        else if (format === "xlsx") exportElevesExcel(allEleves, ctx);
        else exportElevesCSV(allEleves, ctx);
      } catch {
        // silencieux : l'erreur réseau est déjà gérée par le toast du client API
      } finally {
        setExporting(false);
      }
    },
    [queryParams, etablissement, selectedClasseLibelle],
  );

  const eleves = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ─── Pas d'établissement sélectionné ──────────────────────────────────────
  if (!etablissement) {
    return (
      <div className="space-y-4">
        <ListHeader
          onCreate={onCreate}
          createDisabled
          appliqueCategorie={false}
        />
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
                La liste des élèves est filtrée par établissement. Choisissez un
                établissement dans la barre latérale pour afficher les élèves
                correspondants.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ListHeader
        onCreate={onCreate}
        createDisabled={false}
        appliqueCategorie={appliqueCategorie}
      />

      {/* Barre de filtres + mini-stats + export */}
      <GlassCard variant="adaptive" noHover className="p-4">
        <div className="space-y-4">
          {/* Ligne 1 : recherche + export */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom ou matricule…"
                className="pl-8"
                aria-label="Rechercher un élève"
              />
            </div>
            {/* Menu export */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={exporting || total === 0}
                  className="shrink-0"
                >
                  {exporting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  Télécharger
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Format d&apos;export</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExport("pdf")}>
                  <FileText className="size-4 text-rose-600" />
                  PDF (liste officielle)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                  <FileSpreadsheet className="size-4 text-emerald-600" />
                  Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  <FileIcon className="size-4 text-amber-600" />
                  CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Ligne 2 : filtres en cascade Cycle → Niveau → Classe + catégorie + statut */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {/* Cycle */}
            <Select value={cycleId} onValueChange={setCycleId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tous cycles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous cycles</SelectItem>
                {cycles?.map((cy) => (
                  <SelectItem key={cy.id} value={cy.id}>
                    {cy.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Niveau (dépend du cycle) */}
            <Select value={niveau} onValueChange={setNiveau}>
              <SelectTrigger className="w-full">
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

            {/* Classe (dépend du cycle + niveau) */}
            <Select value={classeId} onValueChange={setClasseId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Toutes classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes classes</SelectItem>
                {filteredClasses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Catégorie */}
            <Select
              value={categorie}
              onValueChange={(v) =>
                setCategorie(v as CategorieEleve | "all")
              }
              disabled={!appliqueCategorie}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    appliqueCategorie
                      ? "Toutes catégories"
                      : "Non applicable"
                  }
                />
              </SelectTrigger>
              {appliqueCategorie ? (
                <SelectContent>
                  <SelectItem value="all">Toutes catégories</SelectItem>
                  <SelectItem value="AFFECTE">Affecté</SelectItem>
                  <SelectItem value="NON_AFFECTE">Non affecté</SelectItem>
                </SelectContent>
              ) : (
                <SelectContent>
                  <SelectItem value="NON_APPLICABLE">
                    Non applicable
                  </SelectItem>
                </SelectContent>
              )}
            </Select>

            {/* Statut */}
            <Select
              value={statut}
              onValueChange={(v) => setStatut(v as StatutEleve | "all")}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tous statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="ACTIF">Actif</SelectItem>
                <SelectItem value="INACTIF">Inactif</SelectItem>
                <SelectItem value="TRANSFERE">Transféré</SelectItem>
                <SelectItem value="DIPLOME">Diplômé</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Mini-stats contextuelles */}
          {stats && stats.total > 0 && (
            <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 px-4 py-2.5 text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <Users className="size-4 text-emerald-600" />
                {stats.total} élève{stats.total > 1 ? "s" : ""}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <GraduationCap className="size-4 text-forest" />
                {stats.garcons} G
                <span className="text-muted-foreground/60">/</span>
                <span className="text-pink-600">{stats.filles} F</span>
              </span>
              {stats.redoublants > 0 && (
                <>
                  <span className="text-muted-foreground">·</span>
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <TrendingDown className="size-4" />
                    {stats.redoublants} redoublant
                    {stats.redoublants > 1 ? "s" : ""}
                  </span>
                </>
              )}
              {isFetching && !isLoading && (
                <span className="ml-auto text-xs text-muted-foreground">
                  mise à jour…
                </span>
              )}
            </div>
          )}
        </div>
      </GlassCard>

      <KentePattern variant="separator" className="my-1" />

      {/* Erreur */}
      {isError && !isLoading && (
        <Card>
          <CardContent className="flex items-center gap-3 py-6 text-sm">
            <AlertCircle className="size-5 text-destructive" />
            <div>
              <p className="font-medium text-destructive">
                Erreur lors du chargement des élèves
              </p>
              <p className="text-muted-foreground">
                {error instanceof Error
                  ? error.message
                  : "Veuillez réessayer dans un instant."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Chargement */}
      {isLoading && <ListSkeleton />}

      {/* Tableau */}
      {!isLoading && !isError && (
        <GlassCard variant="adaptive" noHover className="overflow-hidden p-0">
          <div>
            {eleves.length === 0 ? (
              <EmptyState onCreate={onCreate} />
            ) : (
              <>
                {/* Vue table (desktop) */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="pl-4">Élève</TableHead>
                        <TableHead>Matricule</TableHead>
                        <TableHead>Classe</TableHead>
                        <TableHead>Catégorie</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="pr-4 text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eleves.map((eleve) => (
                        <EleveRow
                          key={eleve.id}
                          eleve={eleve}
                          onSelect={() => onSelect(eleve.id)}
                          onEdit={() => onEdit(eleve.id)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Vue cartes (mobile) */}
                <div className="divide-y md:hidden">
                  {eleves.map((eleve) => (
                    <EleveRowMobile
                      key={eleve.id}
                      eleve={eleve}
                      onSelect={() => onSelect(eleve.id)}
                      onEdit={() => onEdit(eleve.id)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between gap-2 border-t px-4 py-3 text-sm">
                  <p className="text-muted-foreground">
                    Page <span className="font-medium">{page}</span> sur{" "}
                    <span className="font-medium">{totalPages}</span>
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page >= totalPages}
                    >
                      Suivant
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

function ListHeader({
  onCreate,
  createDisabled,
  appliqueCategorie,
}: {
  onCreate: () => void;
  createDisabled: boolean;
  appliqueCategorie: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-emerald-600" />
          <h2 className="font-display text-xl font-semibold tracking-tight">
            Élèves
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Gérez les fiches élèves, les matricules, catégories et inscriptions.
          {appliqueCategorie
            ? " Catégorie Affecté / Non affecté active pour cet établissement."
            : " Catégorie non applicable (préscolaire / primaire)."}
        </p>
      </div>
      <Button
        onClick={onCreate}
        disabled={createDisabled}
        variant="success"
      >
        <Plus className="size-4" />
        Nouvel élève
      </Button>
    </div>
  );
}

function EleveRow({
  eleve,
  onSelect,
  onEdit,
}: {
  eleve: Eleve;
  onSelect: () => void;
  onEdit: () => void;
}) {
  return (
    <TableRow onClick={onSelect} className="cursor-pointer">
      <TableCell className="pl-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-9 border">
            {eleve.photo_url ? (
              <AvatarImage src={eleve.photo_url} alt={eleveFullName(eleve)} />
            ) : null}
            <AvatarFallback className="bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {initialsOf(eleve.nom, eleve.prenoms)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-medium">{eleveFullName(eleve)}</p>
            <p className="truncate text-xs text-muted-foreground">
              {eleve.identifiant_interne}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="font-mono text-xs">
        {eleve.matricule_ministere ?? (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {eleve.inscription_courante?.classe_libelle ?? (
          <span className="text-muted-foreground">Non inscrit</span>
        )}
      </TableCell>
      <TableCell>
        <CategorieBadge categorie={eleve.categorie} />
      </TableCell>
      <TableCell>
        <StatutBadge statut={eleve.statut} />
      </TableCell>
      <TableCell className="pr-4 text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-emerald-700"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            aria-label="Voir la fiche"
          >
            <Eye className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:text-emerald-700"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            aria-label="Modifier"
          >
            <Pencil className="size-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function EleveRowMobile({
  eleve,
  onSelect,
  onEdit,
}: {
  eleve: Eleve;
  onSelect: () => void;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/50"
    >
      <Avatar className="size-10 shrink-0 border">
        {eleve.photo_url ? (
          <AvatarImage src={eleve.photo_url} alt={eleveFullName(eleve)} />
        ) : null}
        <AvatarFallback className="bg-emerald-100 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {initialsOf(eleve.nom, eleve.prenoms)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-medium">{eleveFullName(eleve)}</p>
          <StatutBadge statut={eleve.statut} />
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">
            {eleve.inscription_courante?.classe_libelle ?? "Non inscrit"} ·{" "}
            {eleve.matricule_ministere ?? eleve.identifiant_interne}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            aria-label="Modifier"
          >
            <Pencil className="size-3.5" />
          </Button>
        </div>
      </div>
    </button>
  );
}

function ListSkeleton() {
  return (
    <Card>
      <CardContent className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-md border border-transparent px-2 py-2"
          >
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <UserPlus className="size-6" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium">Aucun élève trouvé</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Aucun élève ne correspond à vos critères. Créez votre premier élève ou
          ajustez vos filtres.
        </p>
      </div>
      <Button onClick={onCreate} variant="success">
        <Plus className="size-4" />
        Créer un élève
      </Button>
    </div>
  );
}
