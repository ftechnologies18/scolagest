"use client";

/**
 * ScolaGest — Vue « Impayés & relances » (Phase 4 — Refonte Forêt EdTech).
 *
 * Affiche la liste des élèves ayant un solde_du > 0 (filtres optionnels :
 * classe, catégorie, "échéances passées uniquement") avec :
 *  - Hero header (badge rond gradient amber→terracotta, titre font-display,
 *    pill établissement + pill "Phase 4").
 *  - Filtres enrichis : icônes contextuelles (School / Tag) devant les Select,
 *    Switch "En retard uniquement", bouton Réinitialiser (RotateCcw, outline).
 *  - 4 StatCards de résumé : élèves en retard (amber), total solde dû
 *    (terracotta), retard max (terracotta), échéances en retard (gold).
 *  - Barre d'actions enrichie : compteur, Actualiser (ghost), Bordereau
 *    (success emerald, hint PDF imprimable), Relance SMS (outline → default
 *    amber quand sélection > 0). Boutons sticky full-width en bas sur mobile.
 *  - Tableau desktop : hover row bg-amber-50/60, avatar initials bg-amber-600,
 *    colonne Détail (Eye) ouvrant un dialog des échéances en retard.
 *  - Cartes mobile : card cliquable, avatar initials, montant text-base
 *    font-bold, checkbox 44px.
 *  - Bordereau imprimable premium : GlassCard desktop + premiumBorder,
 *    en-tête gradient amber→terracotta, KentePattern separator.
 *  - Empty states premium : KentePattern bg, badges ronds colorés.
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query (fetchImpayes / impayesKeys),
 * types (ImpayeItem, ImpayesFilters, EcheanceEnRetard), debounce 300ms,
 * sélection Set<string>, workflows handleSendSMS (POST /api/messages/relance-
 * masse) et BordereauRelanceDialog (rendu client-side + window.print() +
 * classe .bordereau-print). Aucun endpoint backend modifié.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Filter,
  Loader2,
  Printer,
  X,
  GraduationCap,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Wallet,
  Timer,
  Send,
  School,
  Tag,
  RotateCcw,
  CalendarClock,
  Eye,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import { fetchImpayes, impayesKeys } from "@/lib/api-reports";
import { fetchClasses } from "@/lib/api-students";
import { apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA, formatDateShort } from "@/lib/format";
import type { ImpayeItem, ImpayesFilters } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GlassCard } from "@/components/ds/glass-card";
import { StatCard } from "@/components/ds/stat-card";
import { KentePattern } from "@/components/ds/kente-pattern";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers partagés
// ─────────────────────────────────────────────────────────────────────────────

/** Initiales (max 2) à partir d'un nom + prénoms — pour l'avatar fallback. */
function initialsOf(nom?: string, prenoms?: string): string {
  const a = (nom ?? "").trim().charAt(0);
  const b = (prenoms ?? "").trim().charAt(0);
  return (a + b).toUpperCase() || "?";
}

/** Nom complet d'un élève impayé (prénoms + nom). */
function impayeFullName(it: ImpayeItem): string {
  return [it.eleve_prenoms, it.eleve_nom].filter(Boolean).join(" ").trim() || "—";
}

const CATEGORIE_OPTIONS = [
  { value: "all", label: "Toutes catégories" },
  { value: "AFFECTE", label: "Affecté" },
  { value: "NON_AFFECTE", label: "Non affecté" },
  { value: "NON_APPLICABLE", label: "Non applicable" },
];

export default function ImpayesView() {
  const etablissement = useAuthStore((s) => s.etablissement);
  const etablissementId = etablissement?.id;
  // ⚠️ Bug historique corrigé : `toast` était utilisé (lignes 115 et 121 du
  // fichier d'origine) sans jamais être déstructuré depuis `useToast`. Sans
  // cette ligne, l'envoi SMS de relance crashait avec
  // `ReferenceError: toast is not defined`. Maintenant déclaré explicitement.
  const { toast } = useToast();

  // Filtres
  const [classeId, setClasseId] = React.useState<string>("all");
  const [categorie, setCategorie] = React.useState<string>("all");
  const [echeancePassee, setEcheancePassee] = React.useState(false);

  // Sélection (élèves pour le bordereau)
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bordereauOpen, setBordereauOpen] = React.useState(false);
  const [smsSending, setSmsSending] = React.useState(false);

  // Dialog "Détail" (échéances en retard d'un élève) — desktop
  const [detailItem, setDetailItem] = React.useState<ImpayeItem | null>(null);

  // Indicateur "filtre actif" (bouton Réinitialiser plus visible)
  const hasActiveFilter =
    classeId !== "all" || categorie !== "all" || echeancePassee;

  // Bug 4 : Envoi SMS de relance via POST /api/messages/relance-masse
  const handleSendSMS = async () => {
    if (selected.size === 0) return;
    setSmsSending(true);
    try {
      const eleveIds = Array.from(selected);
      // Récupérer le template RELANCE (ou utiliser un template par défaut)
      const result = await apiPost<{ count: number }>("/api/messages/relance-masse", {
        eleve_ids: eleveIds,
        template_id: undefined, // le backend utilisera un template par défaut
      });
      toast({
        title: "Relances envoyées",
        description: `${(result as { count: number }).count} SMS de relance envoyé(s).`,
      });
      setSelected(new Set());
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer les relances. Vérifiez que le backend est démarré.",
        variant: "destructive",
      });
    } finally {
      setSmsSending(false);
    }
  };

  // Classes pour filtre
  const { data: classes } = useQuery({
    queryKey: ["classes", { etablissementId }],
    queryFn: () => fetchClasses(etablissementId),
    enabled: !!etablissementId,
  });

  // Debounce 300 ms
  const [debouncedFilters, setDebouncedFilters] =
    React.useState<ImpayesFilters>({});
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedFilters({
        classe_id: classeId !== "all" ? classeId : undefined,
        categorie: categorie !== "all" ? categorie : undefined,
        echeance_passee: echeancePassee,
      });
    }, 300);
    return () => clearTimeout(t);
  }, [classeId, categorie, echeancePassee]);

  const {
    data: impayes,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: impayesKeys.list(debouncedFilters),
    queryFn: () => fetchImpayes(debouncedFilters),
    enabled: !!etablissementId,
    retry: 1,
    retryDelay: 1500,
  });

  const list = impayes ?? [];

  // Stats de résumé
  const totalSolde = list.reduce((s, i) => s + (i.solde_du ?? 0), 0);
  const maxRetard = list.reduce(
    (m, i) => Math.max(m, i.nb_jours_retard_max ?? 0),
    0,
  );
  // Total d'échéances en retard (somme sur tous les élèves)
  const totalEcheancesRetard = list.reduce(
    (s, i) => s + (i.echeances_en_retard?.length ?? 0),
    0,
  );

  // Gestion de la sélection
  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function toggleAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(list.map((i) => i.eleve_id)));
    } else {
      setSelected(new Set());
    }
  }

  // Reset sélection quand la liste change
  React.useEffect(() => {
    setSelected(new Set());
  }, [classeId, categorie, echeancePassee]);

  const selectedItems = list.filter((i) => selected.has(i.eleve_id));
  const hasSelection = selected.size > 0;

  return (
    <div className="space-y-4">
      <KentePattern variant="strip" position="top" />

      {/* ─── Hero header ────────────────────────────────────────────── */}
      <GlassCard variant="desktop" noHover premiumBorder className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Badge rond gradient amber→terracotta avec icône AlertTriangle */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-terracotta text-white shadow-lg shadow-amber-900/20">
              <AlertTriangle className="size-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                  Impayés &amp; relances
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 align-middle text-[11px] font-medium text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200">
                  <Sparkles className="size-3" />
                  Phase 4
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Suivi des soldes débiteurs, échéances en retard et génération de
                bordereaux de relance.
              </p>
              {etablissement?.nom ? (
                <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/40 dark:text-amber-300">
                  {etablissement.nom}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </GlassCard>

      <KentePattern variant="separator" className="my-4" />

      {!etablissementId ? (
        <EmptyStateEtablissement />
      ) : (
        <>
          {/* ─── Filtres ────────────────────────────────────────────── */}
          <GlassCard variant="adaptive" noHover className="p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {/* Classe */}
              <div className="space-y-1.5">
                <Label htmlFor="filter-classe" className="text-xs font-medium text-muted-foreground">
                  Classe
                </Label>
                <Select value={classeId} onValueChange={setClasseId}>
                  <SelectTrigger id="filter-classe" className="h-10 w-full">
                    <School className="mr-1.5 size-4 shrink-0 text-amber-600" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes classes</SelectItem>
                    {(classes ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.libelle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Catégorie */}
              <div className="space-y-1.5">
                <Label htmlFor="filter-categorie" className="text-xs font-medium text-muted-foreground">
                  Catégorie
                </Label>
                <Select value={categorie} onValueChange={setCategorie}>
                  <SelectTrigger id="filter-categorie" className="h-10 w-full">
                    <Tag className="mr-1.5 size-4 shrink-0 text-amber-600" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Switch "En retard uniquement" */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Filtre échéances
                </Label>
                <label
                  htmlFor="echeance-passee"
                  className="flex h-10 cursor-pointer items-center justify-between gap-2 rounded-md border bg-background px-3 transition-colors hover:bg-amber-50/40 dark:hover:bg-amber-950/20"
                >
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <Clock className="size-3.5 text-amber-600" />
                    En retard uniquement
                  </span>
                  <Switch
                    id="echeance-passee"
                    checked={echeancePassee}
                    onCheckedChange={setEcheancePassee}
                  />
                </label>
              </div>

              {/* Réinitialiser (outline, plus visible quand filtre actif) */}
              <div className="flex items-end">
                <Button
                  variant={hasActiveFilter ? "outline" : "ghost"}
                  size="default"
                  className={cn(
                    "h-10 w-full",
                    hasActiveFilter &&
                      "border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-950/40",
                  )}
                  onClick={() => {
                    setClasseId("all");
                    setCategorie("all");
                    setEcheancePassee(false);
                  }}
                >
                  <RotateCcw className="size-3.5" />
                  Réinitialiser
                </Button>
              </div>
            </div>
          </GlassCard>

          <KentePattern variant="separator" className="my-4" />

          {/* ─── StatCards de résumé (4) ─────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Élèves en retard"
              value={`${list.length}`}
              icon={Users}
              tone="amber"
              hint={isFetching && !isLoading ? "mise à jour…" : "solde débiteur"}
              delay={0}
            />
            <StatCard
              label="Total solde dû"
              value={formatFCFA(totalSolde)}
              icon={Wallet}
              tone="terracotta"
              hint="à recouvrer"
              delay={0.05}
            />
            <StatCard
              label="Retard maximum"
              value={
                maxRetard > 0
                  ? `${maxRetard} jour${maxRetard > 1 ? "s" : ""}`
                  : "—"
              }
              icon={Timer}
              tone="terracotta"
              hint="plus ancien retard"
              delay={0.1}
            />
            <StatCard
              label="Échéances en retard"
              value={`${totalEcheancesRetard}`}
              icon={CalendarClock}
              tone="gold"
              hint="cumul tous élèves"
              delay={0.15}
            />
          </div>

          {/* ─── Barre d'actions (desktop + tablette) ──────────────── */}
          <div className="hidden flex-wrap items-center justify-between gap-2 md:flex">
            <p className="text-xs text-muted-foreground">
              {isFetching ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" /> Mise à jour…
                </span>
              ) : (
                <>
                  <span className="font-medium text-foreground">{list.length}</span>{" "}
                  élève{list.length > 1 ? "s" : ""} ·{" "}
                  <span className="font-medium text-amber-800 dark:text-amber-300">
                    {selected.size}
                  </span>{" "}
                  sélectionné{selected.size > 1 ? "s" : ""}
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <Loader2 className={cn("size-3.5", isFetching && "animate-spin")} />
                Actualiser
              </Button>
              <Button
                size="sm"
                variant="success"
                onClick={() => setBordereauOpen(true)}
                disabled={selected.size === 0}
                title="Générer un bordereau de relance PDF imprimable"
              >
                <Printer className="size-3.5" />
                Bordereau {selected.size > 0 ? `(${selected.size})` : "PDF"}
              </Button>
              <Button
                size="sm"
                variant={hasSelection ? "default" : "outline"}
                disabled={selected.size === 0 || smsSending}
                onClick={handleSendSMS}
                className={cn(
                  hasSelection &&
                    "bg-amber-600 text-white shadow-lg shadow-amber-900/20 hover:bg-amber-700",
                )}
                title="Envoyer un SMS de relance aux élèves sélectionnés"
              >
                {smsSending ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                Relance SMS {selected.size > 0 ? `(${selected.size})` : ""}
              </Button>
            </div>
          </div>

          {/* ─── Tableau (desktop + tablette + mobile) ──────────────── */}
          <GlassCard variant="adaptive" noHover premiumBorder className="overflow-hidden p-0">
            <div>
              {isLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : isError ? (
                <EmptyStateErreur onRetry={() => refetch()} />
              ) : list.length === 0 ? (
                <EmptyStateAucunImpaye echeancePassee={echeancePassee} />
              ) : (
                <>
                  {/* Desktop / Tablette : tableau */}
                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-amber-50/60 hover:bg-amber-50/60 dark:bg-amber-950/20">
                          <TableHead className="w-10 pl-4">
                            <Checkbox
                              checked={
                                list.length > 0 &&
                                selected.size === list.length
                              }
                              onCheckedChange={(v) => toggleAll(!!v)}
                              aria-label="Sélectionner tout"
                            />
                          </TableHead>
                          <TableHead>Élève</TableHead>
                          <TableHead>Classe</TableHead>
                          <TableHead>Catégorie</TableHead>
                          <TableHead className="text-right">Solde dû</TableHead>
                          <TableHead className="text-center">
                            Éch. en retard
                          </TableHead>
                          <TableHead className="text-right">
                            Retard max
                          </TableHead>
                          <TableHead className="pr-4 text-right">Détail</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {list.map((it) => {
                          const checked = selected.has(it.eleve_id);
                          const hasRetardDetail =
                            (it.echeances_en_retard?.length ?? 0) > 0;
                          return (
                            <TableRow
                              key={it.eleve_id}
                              className={cn(
                                "cursor-pointer transition-colors hover:bg-amber-50/60 dark:hover:bg-amber-950/20",
                                checked &&
                                  "bg-amber-100/60 dark:bg-amber-950/30",
                              )}
                              onClick={() => toggleOne(it.eleve_id, !checked)}
                            >
                              <TableCell
                                className="pl-4"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) =>
                                    toggleOne(it.eleve_id, !!v)
                                  }
                                  aria-label={`Sélectionner ${impayeFullName(it)}`}
                                  className="size-5"
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-3">
                                  <Avatar className="size-9 border-2 border-amber-100 ring-1 ring-amber-200/50 dark:border-amber-900/40 dark:ring-amber-800/30">
                                    <AvatarFallback className="bg-amber-600 text-xs font-semibold text-white dark:bg-amber-800 dark:text-amber-50">
                                      {initialsOf(it.eleve_nom, it.eleve_prenoms)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="min-w-0">
                                    <p className="break-words text-sm font-medium leading-snug">
                                      {impayeFullName(it)}
                                    </p>
                                    <p className="font-mono text-[10px] text-muted-foreground">
                                      {it.eleve_id.slice(0, 8)}
                                    </p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs">
                                {it.classe || "—"}
                              </TableCell>
                              <TableCell>
                                <CategorieMiniBadge categorie={it.categorie} />
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="font-mono text-sm font-bold text-amber-800 dark:text-amber-300">
                                  {formatFCFA(it.solde_du)}
                                </span>
                              </TableCell>
                              <TableCell className="text-center text-xs tabular-nums">
                                {it.echeances_en_retard?.length ?? 0}
                              </TableCell>
                              <TableCell className="text-right">
                                <RetardBadge jours={it.nb_jours_retard_max} />
                              </TableCell>
                              <TableCell
                                className="pr-4 text-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-muted-foreground hover:bg-amber-50 hover:text-amber-800 dark:hover:bg-amber-950/40"
                                  onClick={() => setDetailItem(it)}
                                  aria-label={`Détail des échéances de ${impayeFullName(it)}`}
                                  title="Détail des échéances en retard"
                                  disabled={!hasRetardDetail}
                                >
                                  <Eye className="size-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile : cartes empilées */}
                  <ul className="divide-y md:hidden">
                    {list.map((it) => {
                      const checked = selected.has(it.eleve_id);
                      const hasRetardDetail =
                        (it.echeances_en_retard?.length ?? 0) > 0;
                      return (
                        <li
                          key={it.eleve_id}
                          className={cn(
                            "transition-colors",
                            checked
                              ? "bg-amber-100/60 dark:bg-amber-950/30"
                              : "bg-transparent",
                          )}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleOne(it.eleve_id, !checked)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                toggleOne(it.eleve_id, !checked);
                              }
                            }}
                            className="flex w-full cursor-pointer items-start gap-3 p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-2"
                            aria-label={`Sélectionner ${impayeFullName(it)}`}
                            aria-pressed={checked}
                          >
                            {/* Touch target ≥ 44px sur la checkbox */}
                            <span
                              className="flex min-h-11 min-w-11 items-center justify-center"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) =>
                                  toggleOne(it.eleve_id, !!v)
                                }
                                aria-label={`Sélectionner ${impayeFullName(it)}`}
                                className="size-5"
                              />
                            </span>
                            <Avatar className="size-10 shrink-0 border-2 border-amber-100 ring-1 ring-amber-200/50 dark:border-amber-900/40">
                              <AvatarFallback className="bg-amber-600 text-xs font-semibold text-white dark:bg-amber-800 dark:text-amber-50">
                                {initialsOf(it.eleve_nom, it.eleve_prenoms)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="break-words text-sm font-semibold leading-snug">
                                {impayeFullName(it)}
                              </p>
                              <p className="break-words text-xs text-muted-foreground">
                                {it.classe || "—"} · <CategorieMiniBadge categorie={it.categorie} />
                              </p>
                              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                <span className="font-mono text-base font-bold text-amber-800 dark:text-amber-300">
                                  {formatFCFA(it.solde_du)}
                                </span>
                                <RetardBadge jours={it.nb_jours_retard_max} />
                              </div>
                              {hasRetardDetail ? (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  {it.echeances_en_retard?.length ?? 0} échéance
                                  {(it.echeances_en_retard?.length ?? 0) > 1
                                    ? "s"
                                    : ""}{" "}
                                  en retard
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </GlassCard>

          {/* ─── Barre d'actions sticky (mobile uniquement) ─────────── */}
          {list.length > 0 && (
            <div className="sticky bottom-0 z-10 mt-2 flex flex-col gap-2 border-t border-amber-200/60 bg-background/80 p-3 backdrop-blur-md md:hidden dark:border-amber-800/40 dark:bg-background/80">
              <p className="text-center text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{list.length}</span>{" "}
                élève{list.length > 1 ? "s" : ""} ·{" "}
                <span className="font-medium text-amber-800 dark:text-amber-300">
                  {selected.size}
                </span>{" "}
                sélectionné{selected.size > 1 ? "s" : ""}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="h-11"
                >
                  <Loader2
                    className={cn("size-4", isFetching && "animate-spin")}
                  />
                  <span className="sr-only">Actualiser</span>
                </Button>
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => setBordereauOpen(true)}
                  disabled={selected.size === 0}
                  className="h-11"
                >
                  <Printer className="size-4" />
                  Bordereau
                </Button>
                <Button
                  size="sm"
                  variant={hasSelection ? "default" : "outline"}
                  disabled={selected.size === 0 || smsSending}
                  onClick={handleSendSMS}
                  className={cn(
                    "h-11",
                    hasSelection &&
                      "bg-amber-600 text-white hover:bg-amber-700",
                  )}
                >
                  {smsSending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  SMS
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialog du bordereau de relance */}
      <BordereauRelanceDialog
        open={bordereauOpen}
        onOpenChange={setBordereauOpen}
        items={selectedItems}
      />

      {/* Dialog détail échéances en retard (desktop) */}
      <DetailEcheancesDialog
        item={detailItem}
        onOpenChange={(open) => {
          if (!open) setDetailItem(null);
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bordereau de relance (imprimable)
// ─────────────────────────────────────────────────────────────────────────────

function BordereauRelanceDialog({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ImpayeItem[];
}) {
  const etablissement = useAuthStore((s) => s.etablissement);
  const user = useAuthStore((s) => s.user);
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const totalSolde = items.reduce((s, i) => s + (i.solde_du ?? 0), 0);

  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="no-print border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Printer className="size-5 text-amber-600" />
            Bordereau de relance
          </DialogTitle>
          <DialogDescription className="text-xs">
            Document imprimable listant les élèves sélectionnés et leurs
            soldes restants à charge. Cliquez sur « Imprimer / PDF » pour
            générer le document.
          </DialogDescription>
        </DialogHeader>

        {/* Contenu imprimable — GlassCard desktop + premiumBorder (effet document officiel) */}
        <div className="max-h-[70vh] overflow-y-auto p-4 sm:p-6">
          <GlassCard
            variant="desktop"
            premiumBorder
            noHover
            noAnimation
            className="bordereau-print overflow-hidden bg-white p-0 text-foreground"
          >
            {/* En-tête établissement — gradient amber→terracotta */}
            <div className="flex flex-col gap-3 bg-gradient-to-br from-amber-500 to-terracotta px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-lg bg-white/15">
                  <GraduationCap className="size-6" />
                </div>
                <div>
                  <div className="text-base font-semibold">
                    {etablissement?.nom ?? "Établissement"}
                  </div>
                  <div className="text-[11px] text-amber-100">
                    {etablissement?.ville
                      ? `${etablissement.ville}, Côte d'Ivoire`
                      : "Côte d'Ivoire"}
                    {etablissement?.code_officiel
                      ? ` · Code ${etablissement.code_officiel}`
                      : ""}
                  </div>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-[11px] uppercase tracking-wide text-amber-100">
                  Bordereau de relance
                </div>
                <div className="text-xs text-amber-50">
                  Édité le {today}
                </div>
              </div>
            </div>

            {/* Séparateur kente sous l'en-tête */}
            <KentePattern variant="separator" />

            <div className="space-y-5 p-6">
              {/* Titre */}
              <div>
                <h2 className="text-center text-lg font-bold uppercase tracking-wide">
                  BORDEREAU DE RELANCE
                </h2>
                <p className="mt-1 text-center text-xs text-muted-foreground">
                  Liste des élèves dont le paiement des frais scolaires est
                  attendu. Nous prions les parents/tuteurs de bien vouloir
                  régulariser la situation dans les meilleurs délais.
                </p>
              </div>

              {/* Référence bordereau */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                <span>
                  <strong>Réf. :</strong> BR-{new Date().getFullYear()}-
                  {String(Date.now()).slice(-6)}
                </span>
                <span>
                  <strong>Étab. :</strong>{" "}
                  {etablissement?.code_officiel ?? etablissement?.nom ?? "—"}
                </span>
                <span>
                  <strong>Édité par :</strong>{" "}
                  {user
                    ? `${user.prenoms ?? ""} ${user.nom ?? ""}`.trim()
                    : "—"}
                </span>
              </div>

              {/* Tableau des élèves */}
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-amber-50 text-[11px] uppercase text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                    <tr>
                      <th className="px-3 py-2 text-left">N°</th>
                      <th className="px-3 py-2 text-left">Élève</th>
                      <th className="px-3 py-2 text-left">Classe</th>
                      <th className="px-3 py-2 text-left">
                        Échéance(s) en retard
                      </th>
                      <th className="px-3 py-2 text-right">Montant dû</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const fullName = impayeFullName(it);
                      const retards =
                        it.echeances_en_retard && it.echeances_en_retard.length > 0
                          ? it.echeances_en_retard
                              .map(
                                (e) =>
                                  `${e.libelle} (${formatDateShort(
                                    e.date_limite,
                                  )}, ${e.jours_retard}j)`,
                              )
                              .join(", ")
                          : "—";
                      return (
                        <tr
                          key={it.eleve_id}
                          className="border-t text-foreground transition-colors hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
                        >
                          <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2">
                            <div className="break-words text-xs font-medium leading-snug">
                              {fullName}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {it.classe || "—"}
                          </td>
                          <td className="px-3 py-2 break-words text-[11px] text-muted-foreground leading-snug">
                            {retards}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs font-semibold">
                            {formatFCFA(it.solde_du)}
                          </td>
                        </tr>
                      );
                    })}
                    {items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-6 text-center text-xs text-muted-foreground"
                        >
                          Aucun élève sélectionné.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                  <tfoot className="bg-emerald-50 dark:bg-emerald-950/30">
                    <tr className="border-t">
                      <td
                        className="px-3 py-2 font-semibold"
                        colSpan={4}
                      >
                        Total à recouvrer ({items.length} élève
                        {items.length > 1 ? "s" : ""})
                      </td>
                      <td className="px-3 py-2 text-right text-base font-bold text-emerald-800 dark:text-emerald-300">
                        {formatFCFA(totalSolde)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mention légale — bordure gauche amber */}
              <div className="rounded-md border-l-4 border-amber-500 bg-amber-50/50 p-3 text-[11px] text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                <strong>Mention importante :</strong> Le présent bordereau est
                un document de relance administrative. Il ne constitue pas une
                quittance. Les paiements effectués postérieurement à son
                édition seront pris en compte au prochain relevé.
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-6 pt-6">
                <div className="text-center">
                  <div className="text-[11px] uppercase text-muted-foreground">
                    Le Comptable / Caissier
                  </div>
                  <div className="mt-12 break-words text-xs font-medium">
                    {user
                      ? `${user.prenoms ?? ""} ${user.nom ?? ""}`.trim()
                      : "—"}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Signature et cachet
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] uppercase text-muted-foreground">
                    Le Directeur / Surveillant Général
                  </div>
                  <div className="mt-12 break-words text-xs font-medium">
                    {etablissement?.nom ?? "—"}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Signature et cachet
                  </div>
                </div>
              </div>

              <Separator />

              {/* Pied de page */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3" />
                  Document généré le {today}
                </span>
                <span>ScolaGest · Gestion &amp; Caisse Scolaire</span>
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Footer actions (no-print) — boutons full-width sur mobile */}
        <div className="no-print flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-muted-foreground">
            Astuce : choisissez « Enregistrer en PDF » comme imprimante pour
            générer un fichier numérique.
          </p>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-11 sm:h-9"
            >
              <X className="size-4" />
              Fermer
            </Button>
            <Button
              type="button"
              onClick={handlePrint}
              disabled={items.length === 0}
              className="h-11 bg-amber-600 text-white hover:bg-amber-700 sm:h-9"
            >
              <Printer className="size-4" />
              Imprimer / Télécharger PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog détail échéances en retard (desktop)
// ─────────────────────────────────────────────────────────────────────────────

function DetailEcheancesDialog({
  item,
  onOpenChange,
}: {
  item: ImpayeItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const open = item !== null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="size-5 text-amber-600" />
            Échéances en retard
          </DialogTitle>
          <DialogDescription className="text-xs">
            {item ? (
              <>
                Détail des échéances en retard de{" "}
                <strong className="text-foreground">
                  {impayeFullName(item)}
                </strong>
                {item.classe ? ` · ${item.classe}` : ""}.
              </>
            ) : (
              "Détail des échéances en retard."
            )}
          </DialogDescription>
        </DialogHeader>

        {item ? (
          <div className="space-y-4">
            {/* Résumé de l'élève */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-amber-50/60 px-4 py-3 dark:bg-amber-950/20">
              <div className="flex items-center gap-3">
                <Avatar className="size-10 border-2 border-amber-100 ring-1 ring-amber-200/50 dark:border-amber-900/40">
                  <AvatarFallback className="bg-amber-600 text-xs font-semibold text-white dark:bg-amber-800 dark:text-amber-50">
                    {initialsOf(item.eleve_nom, item.eleve_prenoms)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold leading-snug">
                    {impayeFullName(item)}
                  </p>
                  <p className="break-words text-xs text-muted-foreground">
                    {item.classe || "—"} ·{" "}
                    <CategorieMiniBadge categorie={item.categorie} />
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Solde dû
                </div>
                <div className="font-mono text-base font-bold text-amber-800 dark:text-amber-300">
                  {formatFCFA(item.solde_du)}
                </div>
              </div>
            </div>

            {/* Liste des échéances en retard */}
            {item.echeances_en_retard && item.echeances_en_retard.length > 0 ? (
              <div className="overflow-hidden rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-amber-50/60 hover:bg-amber-50/60 dark:bg-amber-950/20">
                      <TableHead className="pl-4">Échéance</TableHead>
                      <TableHead>Date limite</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead className="pr-4 text-right">Retard</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {item.echeances_en_retard.map((e) => (
                      <TableRow
                        key={e.echeance_id}
                        className="transition-colors hover:bg-amber-50/40 dark:hover:bg-amber-950/20"
                      >
                        <TableCell className="pl-4 break-words text-xs font-medium leading-snug">
                          {e.libelle}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateShort(e.date_limite)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold">
                          {formatFCFA(e.montant)}
                        </TableCell>
                        <TableCell className="pr-4 text-right">
                          <RetardBadge jours={e.jours_retard} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed py-8 text-sm text-muted-foreground">
                <CheckCircle2 className="size-4 text-emerald-600" />
                Aucune échéance en retard pour cet élève.
              </div>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty states premium
// ─────────────────────────────────────────────────────────────────────────────

function EmptyStateEtablissement() {
  return (
    <GlassCard variant="adaptive" noHover className="border border-dashed">
      <div className="relative overflow-hidden px-4 py-16">
        <KentePattern variant="bg" />
        <div className="relative flex flex-col items-center justify-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <Filter className="size-6" />
          </div>
          <p className="text-sm font-medium">Sélectionnez un établissement</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Les impayés sont calculés par établissement. Choisissez-en un dans
            la barre latérale pour commencer.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

function EmptyStateAucunImpaye({ echeancePassee }: { echeancePassee: boolean }) {
  return (
    <div className="relative overflow-hidden px-4 py-16">
      <KentePattern variant="bg" />
      <div className="relative flex flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-lg shadow-emerald-900/10 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="size-7" />
        </div>
        <p className="font-display text-base font-semibold">
          Aucun impayé {echeancePassee ? "en retard" : ""}
        </p>
        <p className="max-w-md text-xs text-muted-foreground">
          Tous les élèves sont à jour de leurs paiements sur les critères
          sélectionnés. Belle performance !
        </p>
      </div>
    </div>
  );
}

function EmptyStateErreur({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
        <AlertCircle className="size-6" />
      </div>
      <p className="text-sm font-medium">Erreur de chargement</p>
      <p className="max-w-md text-xs text-muted-foreground">
        Le backend n&apos;a pas pu renvoyer les impayés. Vérifiez qu&apos;il
        est démarré puis réessayez.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <Loader2 className="size-3.5" />
        Réessayer
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Petits composants
// ─────────────────────────────────────────────────────────────────────────────

function CategorieMiniBadge({ categorie }: { categorie: string }) {
  // Contrastes renforcés (bg-100 / text-800 / border-300) — aligné sur
  // CategorieBadge de /eleves (BUGS À ÉVITER #6).
  const map: Record<string, { label: string; cls: string }> = {
    AFFECTE: {
      label: "Affecté",
      cls: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
    },
    NON_AFFECTE: {
      label: "Non affecté",
      cls: "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
    },
    NON_APPLICABLE: {
      label: "Non applicable",
      cls: "border-muted-foreground/30 bg-muted text-muted-foreground",
    },
  };
  const e = map[categorie] ?? {
    label: categorie || "—",
    cls: "border-muted-foreground/30 bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium", e.cls)}>
      {e.label}
    </Badge>
  );
}

function RetardBadge({ jours }: { jours: number }) {
  const j = jours ?? 0;
  if (j <= 0) {
    return (
      <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
        À jour
      </span>
    );
  }
  // Contrastes renforcés (bg-100 / text-800 / border-300) — BUGS À ÉVITER #6.
  // 1-29j : emerald (léger retard, surveillance) · 30-59j : amber (alerte) ·
  // 60j+ : rose (critique). Palette chaud/froid cohérente avec le module.
  const cls =
    j >= 60
      ? "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200"
      : j >= 30
        ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
        : "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200";
  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium tabular-nums", cls)}>
      <Clock className="size-2.5" />
      {j} j
    </Badge>
  );
}
