"use client";

/**
 * ScolaGest — Liste des élèves (Phase 2 — Refonte Forêt EdTech)
 *
 * Vue principale du module Élèves :
 *  - Hero header (GlassCard desktop) avec badge rond emerald→amber, titre
 *    `font-display`, sous-titre + compteur total + bouton "Nouvel élève".
 *  - Barre de filtres repensée : icônes contextuelles devant chaque Select
 *    (Layers / BarChart3 / School / Tag / CircleDot) + bouton "Réinitialiser"
 *    visible seulement si un filtre est actif.
 *  - Mini-stats : 3 StatCard horizontales (Total, G/F, Redoublants).
 *  - Tableau desktop : avatar avec ring emerald, colonne Sexe discrète,
 *    hover row bg-emerald-50/50 + slight lift, actions ghost avec tooltips.
 *  - Carte mobile : GlassCard mobile avec Kebab DropdownMenu pour actions.
 *  - Pagination : "1-20 sur 53" + boutons icônes ChevronLeft / Right.
 *  - Export : DropdownMenu avec icônes colorées (déjà en place).
 *  - Empty state premium : GlassCard + KentePattern bg + CTA emerald.
 *
 * Le contexte d'établissement vient de `useAuthStore`. Si aucun
 * établissement n'est sélectionné, on invite l'utilisateur à en choisir un.
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query, query keys, types, endpoints
 * API, exports PDF/Excel/CSV, cascade Cycle → Niveau → Classe.
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
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Layers,
  BarChart3,
  School,
  Tag,
  CircleDot,
  MoreVertical,
  Mars,
  Venus,
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
import { formatCycleCourt, formatNiveau } from "@/lib/format";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { StatCard } from "@/components/ds/stat-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
// Tooltips removed — using native `title` attribute instead for action buttons.
// Radix TooltipTrigger asChild interfered with onClick propagation on the
// ghost buttons (bug: click on Voir la fiche / Modifier did nothing).
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
      "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
    NON_AFFECTE:
      "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
    NON_APPLICABLE:
      "border-muted-foreground/30 bg-muted text-muted-foreground",
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
      "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
    INACTIF:
      "border-muted-foreground/30 bg-muted text-muted-foreground",
    TRANSFERE:
      "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
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

  // Libellé du cycle sélectionné (pour mapper niveau → libellé français).
  const selectedCycleLibelle = React.useMemo(() => {
    if (cycleId === "all") return undefined;
    return cycles?.find((cy) => cy.id === cycleId)?.libelle;
  }, [cycles, cycleId]);

  // Libellé de la classe sélectionnée (pour le nom de fichier d'export)
  const selectedClasseLibelle = React.useMemo(() => {
    if (classeId === "all") return undefined;
    return classes?.find((c) => c.id === classeId)?.libelle;
  }, [classes, classeId]);

  // ─── Indicateur "filtre actif" (Reset button) ───────────────────────────
  const hasActiveFilter =
    cycleId !== "all" ||
    niveau !== "all" ||
    classeId !== "all" ||
    categorie !== "all" ||
    statut !== "all" ||
    debouncedSearch !== "";

  function resetFilters() {
    setSearch("");
    setDebouncedSearch("");
    setCycleId("all");
    setNiveau("all");
    setClasseId("all");
    setCategorie("all");
    setStatut("all");
  }

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
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  // ─── Pas d'établissement sélectionné ──────────────────────────────────────
  if (!etablissement) {
    return (
      <div className="space-y-4">
        <ListHeader
          onCreate={onCreate}
          createDisabled
          appliqueCategorie={false}
          total={0}
        />
        <GlassCard variant="adaptive" noHover>
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
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
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ListHeader
        onCreate={onCreate}
        createDisabled={false}
        appliqueCategorie={appliqueCategorie}
        total={stats?.total ?? total}
      />

      {/* Mini-stats (3 StatCard horizontales) */}
      {stats && stats.total > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            icon={Users}
            tone="emerald"
            label="Élèves"
            value={stats.total}
            hint={isFetching && !isLoading ? "mise à jour…" : "filtrés"}
            delay={0}
          />
          <StatCard
            icon={GraduationCap}
            tone="amber"
            label="Répartition"
            value={`${stats.garcons} G · ${stats.filles} F`}
            hint="garçons · filles"
            delay={0.05}
          />
          {stats.redoublants > 0 ? (
            <StatCard
              icon={TrendingDown}
              tone="terracotta"
              label="Redoublants"
              value={stats.redoublants}
              hint={
                stats.redoublants > 1
                  ? `${((stats.redoublants / stats.total) * 100).toFixed(1)}% des effectifs`
                  : "1 redoublant"
              }
              delay={0.1}
            />
          ) : (
            <StatCard
              icon={CircleDot}
              tone="forest"
              label="Catégorie"
              value={appliqueCategorie ? "Affecté" : "N/A"}
              hint={
                appliqueCategorie
                  ? "Distinction active"
                  : "Préscolaire / primaire"
              }
              delay={0.1}
            />
          )}
        </div>
      )}

      {/* Barre de filtres + export */}
      <GlassCard variant="adaptive" noHover className="p-4 sm:p-5">
        <div className="space-y-4">
          {/* Ligne 1 : recherche + export */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom ou matricule…"
                className="h-10 pl-8"
                aria-label="Rechercher un élève"
              />
            </div>
            {/* Menu export */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="default"
                  disabled={exporting || total === 0}
                  className="h-10 shrink-0"
                >
                  {exporting ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  Télécharger
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Format d&apos;export</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleExport("pdf")}
                  className="flex items-start gap-2.5 py-2"
                >
                  <FileText className="mt-0.5 size-4 shrink-0 text-rose-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">PDF</p>
                    <p className="text-xs text-muted-foreground">
                      Liste officielle imprimable
                    </p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExport("xlsx")}
                  className="flex items-start gap-2.5 py-2"
                >
                  <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Excel (.xlsx)</p>
                    <p className="text-xs text-muted-foreground">
                      Tableur calculable
                    </p>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => handleExport("csv")}
                  className="flex items-start gap-2.5 py-2"
                >
                  <FileIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">CSV</p>
                    <p className="text-xs text-muted-foreground">
                      Données brutes UTF-8
                    </p>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Ligne 2 : filtres en cascade Cycle → Niveau → Classe + catégorie + statut */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {/* Cycle */}
            <Select value={cycleId} onValueChange={setCycleId}>
              <SelectTrigger className="h-10 w-full">
                <Layers className="mr-1.5 size-4 shrink-0 text-emerald-600" />
                <SelectValue placeholder="Tous cycles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous cycles</SelectItem>
                {cycles?.map((cy) => (
                  <SelectItem key={cy.id} value={cy.id}>
                    {formatCycleCourt(cy.libelle)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Niveau (dépend du cycle) */}
            <Select value={niveau} onValueChange={setNiveau}>
              <SelectTrigger className="h-10 w-full">
                <BarChart3 className="mr-1.5 size-4 shrink-0 text-emerald-600" />
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

            {/* Classe (dépend du cycle + niveau) */}
            <Select value={classeId} onValueChange={setClasseId}>
              <SelectTrigger className="h-10 w-full">
                <School className="mr-1.5 size-4 shrink-0 text-emerald-600" />
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
              <SelectTrigger className="h-10 w-full">
                <Tag className="mr-1.5 size-4 shrink-0 text-emerald-600" />
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
              <SelectTrigger className="h-10 w-full">
                <CircleDot className="mr-1.5 size-4 shrink-0 text-emerald-600" />
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

          {/* Bouton Réinitialiser (uniquement si un filtre est actif) */}
          {hasActiveFilter && (
            <div className="flex items-center justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={resetFilters}
                className="text-muted-foreground hover:text-emerald-700"
              >
                <RotateCcw className="size-3.5" />
                Réinitialiser les filtres
              </Button>
            </div>
          )}
        </div>
      </GlassCard>

      <KentePattern variant="separator" className="my-1" />

      {/* Erreur */}
      {isError && !isLoading && (
        <GlassCard variant="adaptive" noHover>
          <div className="flex items-center gap-3 py-6 text-sm">
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
          </div>
        </GlassCard>
      )}

      {/* Chargement */}
      {isLoading && <ListSkeleton />}

      {/* Tableau */}
      {!isLoading && !isError && (
        <GlassCard variant="adaptive" noHover premiumBorder className="overflow-hidden p-0">
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
                        <TableHead className="w-12 text-center">Sexe</TableHead>
                        <TableHead>Classe</TableHead>
                        <TableHead>Catégorie</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="pr-4 text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {eleves.map((eleve, idx) => (
                        <EleveRow
                          key={eleve.id}
                          eleve={eleve}
                          onSelect={() => onSelect(eleve.id)}
                          onEdit={() => onEdit(eleve.id)}
                          index={idx}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Vue cartes (mobile) */}
                <div className="space-y-2 p-3 md:hidden">
                  {eleves.map((eleve, idx) => (
                    <EleveRowMobile
                      key={eleve.id}
                      eleve={eleve}
                      onSelect={() => onSelect(eleve.id)}
                      onEdit={() => onEdit(eleve.id)}
                      onView={() => onSelect(eleve.id)}
                      index={idx}
                    />
                  ))}
                </div>

                {/* Pagination */}
                <div className="flex flex-col items-center justify-between gap-2 border-t px-4 py-3 text-sm sm:flex-row">
                  <p className="text-muted-foreground">
                    {total > 0 ? (
                      <>
                        <span className="font-medium text-foreground">
                          {rangeStart}–{rangeEnd}
                        </span>{" "}
                        sur <span className="font-medium">{total}</span> élève
                        {total > 1 ? "s" : ""}
                      </>
                    ) : (
                      "Aucun élève"
                    )}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      aria-label="Page précédente"
                      className="size-9"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <span className="px-2 text-xs text-muted-foreground">
                      Page <span className="font-medium text-foreground">{page}</span>{" "}
                      / <span className="font-medium">{totalPages}</span>
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page >= totalPages}
                      aria-label="Page suivante"
                      className="size-9"
                    >
                      <ChevronRight className="size-4" />
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
  total,
}: {
  onCreate: () => void;
  createDisabled: boolean;
  appliqueCategorie: boolean;
  total: number;
}) {
  return (
    <GlassCard variant="desktop" noHover premiumBorder className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          {/* Badge rond emerald→amber gradient avec icône Users */}
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
            <Users className="size-6" />
          </div>
          <div className="min-w-0 space-y-1">
            <h2 className="font-display text-xl font-semibold tracking-tight text-forest sm:text-2xl">
              Élèves
              {total > 0 && (
                <span className="ml-2 inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 align-middle text-xs font-medium text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {total}
                </span>
              )}
            </h2>
            <p className="text-sm text-muted-foreground">
              Gérez les fiches élèves, les matricules, catégories et
              inscriptions.
              {appliqueCategorie
                ? " Catégorie Affecté / Non affecté active pour cet établissement."
                : " Catégorie non applicable (préscolaire / primaire)."}
            </p>
          </div>
        </div>
        <Button
          onClick={onCreate}
          disabled={createDisabled}
          variant="success"
          size="lg"
          className="w-full sm:w-auto"
        >
          <Plus className="size-4" />
          Nouvel élève
        </Button>
      </div>
    </GlassCard>
  );
}

function EleveRow({
  eleve,
  onSelect,
  onEdit,
  index,
}: {
  eleve: Eleve;
  onSelect: () => void;
  onEdit: () => void;
  index: number;
}) {
  const isFille = eleve.sexe === "F";
  return (
    <TableRow
      onClick={onSelect}
      className="cursor-pointer transition-colors hover:bg-emerald-50/60 hover:shadow-sm dark:hover:bg-emerald-950/20"
      style={{ animationDelay: `${index * 0.02}s` }}
    >
      <TableCell className="pl-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-9 border-2 border-emerald-100 ring-1 ring-emerald-200/50 dark:border-emerald-900/40 dark:ring-emerald-800/30">
            {eleve.photo_url ? (
              <AvatarImage src={eleve.photo_url} alt={eleveFullName(eleve)} />
            ) : null}
            <AvatarFallback className="bg-emerald-600 text-xs font-semibold text-white dark:bg-emerald-800 dark:text-emerald-50">
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
      <TableCell className="text-center">
        {eleve.sexe === "M" ? (
          <Mars className="mx-auto size-4 text-sky-600" aria-label="Masculin" />
        ) : eleve.sexe === "F" ? (
          <Venus className="mx-auto size-4 text-pink-600" aria-label="Féminin" />
        ) : (
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
        <div className="flex justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40"
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            aria-label="Voir la fiche"
            title="Voir la fiche"
          >
            <Eye className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40"
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            aria-label="Modifier"
            title="Modifier"
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
  onView,
  index,
}: {
  eleve: Eleve;
  onSelect: () => void;
  onEdit: () => void;
  onView: () => void;
  index: number;
}) {
  return (
    <GlassCard
      variant="mobile"
      noAnimation
      noHover
      className="p-3"
      delay={index * 0.03}
    >
      <div className="flex items-start gap-3">
        <Avatar
          className="size-11 shrink-0 border-2 border-emerald-100 ring-1 ring-emerald-200/50 dark:border-emerald-900/40"
          onClick={onSelect}
        >
          {eleve.photo_url ? (
            <AvatarImage src={eleve.photo_url} alt={eleveFullName(eleve)} />
          ) : null}
          <AvatarFallback className="bg-emerald-600 text-xs font-semibold text-white dark:bg-emerald-800 dark:text-emerald-50">
            {initialsOf(eleve.nom, eleve.prenoms)}
          </AvatarFallback>
        </Avatar>
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 flex-1 space-y-1 text-left"
          aria-label={`Voir la fiche de ${eleveFullName(eleve)}`}
        >
          <p className="truncate font-medium leading-tight">
            {eleveFullName(eleve)}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {eleve.inscription_courante?.classe_libelle ?? "Non inscrit"} ·{" "}
            <span className="font-mono">
              {eleve.matricule_ministere ?? eleve.identifiant_interne}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <StatutBadge statut={eleve.statut} />
            <CategorieBadge categorie={eleve.categorie} />
          </div>
        </button>
        {/* Menu Kebab pour actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 text-muted-foreground"
              aria-label="Actions"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onView}>
              <Eye className="size-4 text-emerald-600" />
              Voir la fiche
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-4 text-amber-600" />
              Modifier
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </GlassCard>
  );
}

function ListSkeleton() {
  return (
    <GlassCard variant="adaptive" noHover className="p-0">
      <div className="space-y-2 p-5">
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
      </div>
    </GlassCard>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="relative overflow-hidden px-4 py-16">
      <KentePattern variant="bg" />
      <div className="relative flex flex-col items-center justify-center gap-4 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-amber-500 text-white shadow-xl shadow-emerald-900/20">
          <UserPlus className="size-8" />
        </div>
        <div className="space-y-1.5">
          <p className="font-display text-lg font-semibold">
            Aucun élève trouvé
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            Aucun élève ne correspond à vos critères. Créez votre premier élève
            ou ajustez vos filtres pour élargir la recherche.
          </p>
        </div>
        <Button onClick={onCreate} variant="success" size="lg">
          <Plus className="size-4" />
          Créer un élève
        </Button>
      </div>
    </div>
  );
}
