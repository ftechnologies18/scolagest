"use client";

/**
 * ScolaGest — Vue « Rapports » (Phase 4 — Refonte Forêt EdTech).
 *
 * Trois onglets :
 *  - Paiements     : filtres multicritères + tableau des encaissements +
 *    totaux + exports CSV/Excel.
 *  - Soldes         : filtres (classe, catégorie, statut) + tableau des
 *    soldes par élève + totaux + export CSV.
 *  - Recouvrement   : filtres (cycle, classe) + tableau par classe + résumé
 *    global + bar chart du taux par classe.
 *
 * Refonte Forêt EdTech :
 *  - Hero header GlassCard desktop avec badge rond gradient emerald→amber,
 *    titre font-display text-2xl, pill établissement + pill "Phase 4".
 *  - TabsList premium enveloppée dans GlassCard desktop, tabs actifs
 *    bg-emerald-600 text-white, icônes + texte (texte masqué sous 400px).
 *  - Filtres enrichis : icônes contextuelles (Calendar / Layers / School /
 *    Tag / CreditCard / User / CircleDot) dans les SelectTrigger, wrapper
 *    Calendar pour les inputs date, bouton Réinitialiser (RotateCcw, variant
 *    outline quand filtre actif).
 *  - StatCards de résumé : 3 (Paiements : emerald/sky/amber) / 4 (Soldes :
 *    sky/emerald/terracotta si solde dû > 0 sinon emerald/forest) / 3
 *    (Recouvrement : sky/emerald + card premium ProgressCircle premiumBorder).
 *  - Barre d'actions enrichie : Actualiser (ghost), Export CSV (outline
 *    emerald), Export Excel (outline amber). Boutons sticky full-width en
 *    bas sur mobile.
 *  - Tableau desktop : hover row bg-emerald-50/60, montants text-sm
 *    font-bold, badges contrastés (border-300 bg-100 text-800), TauxMiniBar
 *    w-24 avec % à droite.
 *  - Card "Taux de recouvrement" premium : variant desktop + premiumBorder +
 *    KentePattern bg + % text-3xl + hint Excellent/Correct/Critique.
 *  - Empty states premium : KentePattern bg, badges ronds colorés, icônes
 *    contextuelles (FileBarChart / Scale / PieChart / Filter / AlertCircle).
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query (fetchRapport* / rapportsKeys.*),
 * types (RapportPaiements/Soldes/Recouvrement), debounce 300ms sur les filtres,
 * exports CSV/Excel (downloadRapportPaiements, génération CSV côté client pour
 * les soldes via Blob). Aucun endpoint backend modifié.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  FileBarChart,
  Wallet,
  Scale,
  PieChart,
  Download,
  Loader2,
  AlertCircle,
  CalendarRange,
  Filter,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Layers,
  School,
  Tag,
  CreditCard,
  User,
  CircleDot,
  Calendar,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchRapportPaiements,
  fetchRapportSoldes,
  fetchRapportRecouvrement,
  downloadRapportPaiements,
  rapportsKeys,
} from "@/lib/api-reports";
import { fetchClasses, fetchCycles } from "@/lib/api-students";
import { useToast } from "@/hooks/use-toast";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { formatFCFA, formatDateShort, todayISO } from "@/lib/format";
import type {
  ModePaiement,
  RapportPaiementsFilters,
  RapportRecouvrementFilters,
  RapportSoldesFilters,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ModePaiementBadge,
  StatutPaiementBadge,
} from "@/components/caisse/caisse-badges";
import { BarChart } from "@/components/reports/bar-chart";
import { GlassCard } from "@/components/ds/glass-card";
import { StatCard } from "@/components/ds/stat-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { ProgressCircle } from "@/components/ds/progress-circle";

// ─────────────────────────────────────────────────────────────────────────────
// Constantes partagées
// ─────────────────────────────────────────────────────────────────────────────

const MODE_OPTIONS: { value: "all" | ModePaiement; label: string }[] = [
  { value: "all", label: "Tous modes" },
  { value: "ESPECES", label: "Espèces" },
  { value: "CHEQUE", label: "Chèque" },
  { value: "VIREMENT", label: "Virement" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
];

const CATEGORIE_OPTIONS = [
  { value: "all", label: "Toutes catégories" },
  { value: "AFFECTE", label: "Affecté" },
  { value: "NON_AFFECTE", label: "Non affecté" },
  { value: "NON_APPLICABLE", label: "Non applicable" },
];

const STATUT_SOLDE_OPTIONS = [
  { value: "all", label: "Tous statuts" },
  { value: "SOLDE", label: "Soldé" },
  { value: "PARTIEL", label: "Partiel" },
  { value: "IMPAYE", label: "Impayé" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Wrapper TabsContent animé (Framer Motion) — respecte prefers-reduced-motion.
// ─────────────────────────────────────────────────────────────────────────────

function TabPanel({ children }: { children: React.ReactNode }) {
  const prefersReducedMotion = usePrefersReducedMotion();
  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const }
      }
    >
      {children}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function RapportsView() {
  const etablissement = useAuthStore((s) => s.etablissement);

  return (
    <div className="space-y-4">
      <KentePattern variant="strip" position="top" />

      {/* ─── Hero header premium ──────────────────────────────────────── */}
      <GlassCard variant="desktop" noHover premiumBorder className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <FileBarChart className="size-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                Rapports
              </h1>
              <p className="text-sm text-muted-foreground">
                Exports et statistiques des encaissements, soldes et taux de
                recouvrement.
                {etablissement?.nom ? (
                  <span className="ml-1 inline-block rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 align-middle text-[11px] font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                    {etablissement.nom}
                  </span>
                ) : null}
              </p>
            </div>
          </div>
          {/* Pill "Phase 4" outline pour indiquer le module */}
          <span className="inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-emerald-300 bg-emerald-50/60 px-3 py-1 text-xs font-medium text-emerald-800 sm:self-auto dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
            <Sparkles className="size-3.5" />
            Phase 4
          </span>
        </div>
      </GlassCard>

      {!etablissement?.id ? (
        <EmptyStateEtablissement />
      ) : (
        <Tabs defaultValue="paiements" className="w-full">
          {/* TabsList premium enveloppée dans GlassCard desktop */}
          <GlassCard
            variant="desktop"
            noHover
            noAnimation
            className="inline-block w-full p-1.5 sm:w-fit"
          >
            <TabsList className="grid w-full grid-cols-3 gap-1 bg-transparent p-0 sm:flex sm:w-auto">
              <TabsTrigger
                value="paiements"
                className="h-10 px-3 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 dark:data-[state=active]:bg-emerald-600 dark:data-[state=active]:text-white"
              >
                <Wallet className="size-4 shrink-0" />
                <span className="hidden min-[400px]:inline">Paiements</span>
              </TabsTrigger>
              <TabsTrigger
                value="soldes"
                className="h-10 px-3 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 dark:data-[state=active]:bg-emerald-600 dark:data-[state=active]:text-white"
              >
                <Scale className="size-4 shrink-0" />
                <span className="hidden min-[400px]:inline">Soldes</span>
              </TabsTrigger>
              <TabsTrigger
                value="recouvrement"
                className="h-10 px-3 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 dark:data-[state=active]:bg-emerald-600 dark:data-[state=active]:text-white"
              >
                <PieChart className="size-4 shrink-0" />
                <span className="hidden min-[400px]:inline">Recouvrement</span>
              </TabsTrigger>
            </TabsList>
          </GlassCard>

          <TabsContent value="paiements" className="mt-4">
            <TabPanel>
              <RapportPaiementsPanel />
            </TabPanel>
          </TabsContent>
          <TabsContent value="soldes" className="mt-4">
            <TabPanel>
              <RapportSoldesPanel />
            </TabPanel>
          </TabsContent>
          <TabsContent value="recouvrement" className="mt-4">
            <TabPanel>
              <RapportRecouvrementPanel />
            </TabPanel>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty state "Pas d'établissement"
// ─────────────────────────────────────────────────────────────────────────────

function EmptyStateEtablissement() {
  return (
    <GlassCard variant="adaptive" noHover className="relative overflow-hidden">
      <KentePattern variant="bg" />
      <div className="relative flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 shadow-sm dark:bg-amber-950/40 dark:text-amber-300">
          <Filter className="size-7" />
        </div>
        <p className="text-base font-medium">Sélectionnez un établissement</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Les rapports sont calculés par établissement. Choisissez-en un dans
          la barre latérale pour commencer.
        </p>
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Paiements »
// ─────────────────────────────────────────────────────────────────────────────

function RapportPaiementsPanel() {
  const { toast } = useToast();
  const [dateDebut, setDateDebut] = React.useState("");
  const [dateFin, setDateFin] = React.useState("");
  const [cycleId, setCycleId] = React.useState<string>("all");
  const [classeId, setClasseId] = React.useState<string>("all");
  const [categorie, setCategorie] = React.useState<string>("all");
  const [mode, setMode] = React.useState<"all" | ModePaiement>("all");
  const [caissier, setCaissier] = React.useState<"all" | "me">("all");
  const [exporting, setExporting] = React.useState<null | "csv" | "excel">(null);

  // Cycles / classes (pour les filtres)
  const etablissementId = useAuthStore((s) => s.etablissement?.id);
  const user = useAuthStore((s) => s.user);
  const { data: cycles } = useQuery({
    queryKey: ["cycles", { etablissementId }],
    queryFn: () => fetchCycles(etablissementId),
    enabled: !!etablissementId,
  });
  const { data: classes } = useQuery({
    queryKey: ["classes", { etablissementId }],
    queryFn: () => fetchClasses(etablissementId),
    enabled: !!etablissementId,
  });

  // Debounce des filtres (300 ms)
  const [debouncedFilters, setDebouncedFilters] =
    React.useState<RapportPaiementsFilters>({});
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedFilters({
        date_debut: dateDebut || undefined,
        date_fin: dateFin || undefined,
        cycle_id: cycleId !== "all" ? cycleId : undefined,
        classe_id: classeId !== "all" ? classeId : undefined,
        categorie: categorie !== "all" ? categorie : undefined,
        mode_paiement: mode !== "all" ? mode : undefined,
        caissier_id:
          caissier === "me" && user?.id ? user.id : undefined,
      });
    }, 300);
    return () => clearTimeout(t);
  }, [dateDebut, dateFin, cycleId, classeId, categorie, mode, caissier, user?.id]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: rapportsKeys.paiements(debouncedFilters),
    queryFn: () => fetchRapportPaiements(debouncedFilters),
    enabled: !!etablissementId,
    retry: 1,
    retryDelay: 1500,
  });

  const hasActiveFilter =
    dateDebut !== "" ||
    dateFin !== "" ||
    cycleId !== "all" ||
    classeId !== "all" ||
    categorie !== "all" ||
    mode !== "all" ||
    caissier !== "all";

  async function handleExport(format: "csv" | "excel") {
    setExporting(format);
    try {
      await downloadRapportPaiements(debouncedFilters, format);
      toast({
        title: "Export prêt",
        description:
          format === "csv"
            ? "Le fichier CSV a été téléchargé."
            : "Le fichier Excel a été téléchargé.",
      });
    } catch (err) {
      toast({
        title: "Erreur d'export",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de générer l'export. Réessayez.",
        variant: "destructive",
      });
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* ─── Filtres ─────────────────────────────────────────────────── */}
      <GlassCard variant="adaptive" noHover className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Date début */}
          <div className="space-y-1.5">
            <Label
              htmlFor="rp-date-debut"
              className="text-xs font-medium text-muted-foreground"
            >
              Date début
            </Label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-emerald-600" />
              <Input
                id="rp-date-debut"
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                max={dateFin || todayISO()}
                className="h-10 pl-8"
              />
            </div>
          </div>
          {/* Date fin */}
          <div className="space-y-1.5">
            <Label
              htmlFor="rp-date-fin"
              className="text-xs font-medium text-muted-foreground"
            >
              Date fin
            </Label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-emerald-600" />
              <Input
                id="rp-date-fin"
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                min={dateDebut || undefined}
                max={todayISO()}
                className="h-10 pl-8"
              />
            </div>
          </div>
          {/* Cycle */}
          <div className="space-y-1.5">
            <Label
              htmlFor="rp-cycle"
              className="text-xs font-medium text-muted-foreground"
            >
              Cycle
            </Label>
            <Select value={cycleId} onValueChange={setCycleId}>
              <SelectTrigger id="rp-cycle" className="h-10 w-full">
                <Layers className="mr-1.5 size-4 shrink-0 text-emerald-600" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous cycles</SelectItem>
                {(cycles ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Classe */}
          <div className="space-y-1.5">
            <Label
              htmlFor="rp-classe"
              className="text-xs font-medium text-muted-foreground"
            >
              Classe
            </Label>
            <Select value={classeId} onValueChange={setClasseId}>
              <SelectTrigger id="rp-classe" className="h-10 w-full">
                <School className="mr-1.5 size-4 shrink-0 text-emerald-600" />
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
            <Label
              htmlFor="rp-categorie"
              className="text-xs font-medium text-muted-foreground"
            >
              Catégorie
            </Label>
            <Select value={categorie} onValueChange={setCategorie}>
              <SelectTrigger id="rp-categorie" className="h-10 w-full">
                <Tag className="mr-1.5 size-4 shrink-0 text-emerald-600" />
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
          {/* Mode */}
          <div className="space-y-1.5">
            <Label
              htmlFor="rp-mode"
              className="text-xs font-medium text-muted-foreground"
            >
              Mode
            </Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as "all" | ModePaiement)}
            >
              <SelectTrigger id="rp-mode" className="h-10 w-full">
                <CreditCard className="mr-1.5 size-4 shrink-0 text-emerald-600" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Caissier */}
          <div className="space-y-1.5">
            <Label
              htmlFor="rp-caissier"
              className="text-xs font-medium text-muted-foreground"
            >
              Caissier
            </Label>
            <Select
              value={caissier}
              onValueChange={(v) => setCaissier(v as "all" | "me")}
            >
              <SelectTrigger id="rp-caissier" className="h-10 w-full">
                <User className="mr-1.5 size-4 shrink-0 text-emerald-600" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous caissiers</SelectItem>
                <SelectItem value="me">Mes encaissements</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Réinitialiser */}
          <div className="flex items-end">
            <Button
              variant={hasActiveFilter ? "outline" : "ghost"}
              size="default"
              className={cn(
                "h-10 w-full",
                hasActiveFilter &&
                  "border-emerald-300 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-950/40",
              )}
              onClick={() => {
                setDateDebut("");
                setDateFin("");
                setCycleId("all");
                setClasseId("all");
                setCategorie("all");
                setMode("all");
                setCaissier("all");
              }}
            >
              <RotateCcw className="size-3.5" />
              Réinitialiser
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ─── StatCards de résumé (3) ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Montant total"
          value={formatFCFA(data?.total_montant ?? 0)}
          icon={Wallet}
          tone="emerald"
          hint={
            isFetching && !isLoading ? "mise à jour…" : "encaissé sur la période"
          }
          delay={0}
        />
        <StatCard
          label="Nombre de paiements"
          value={`${data?.count ?? 0}`}
          icon={FileText}
          tone="sky"
          hint="encaissements"
          delay={0.05}
        />
        <StatCard
          label="Panier moyen"
          value={
            data && data.count > 0
              ? formatFCFA(data.total_montant / data.count)
              : "—"
          }
          icon={PieChart}
          tone="amber"
          hint="par paiement"
          delay={0.1}
        />
      </div>

      <KentePattern variant="separator" className="my-1" />

      {/* ─── Barre d'actions (desktop + tablette) ────────────────────── */}
      <div className="hidden flex-wrap items-center justify-between gap-2 md:flex">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isFetching ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Mise à jour…
            </>
          ) : (
            <>
              <CalendarRange className="size-3" />
              <span className="font-medium text-foreground">
                {data?.count ?? 0}
              </span>{" "}
              paiement(s) sur la période sélectionnée
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <Loader2
              className={cn("size-3.5", isFetching && "animate-spin")}
            />
            Actualiser
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("csv")}
            disabled={exporting !== null || (data?.count ?? 0) === 0}
            className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 dark:border-emerald-800/60 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            title="Télécharger les encaissements au format CSV (UTF-8)"
          >
            {exporting === "csv" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("excel")}
            disabled={exporting !== null || (data?.count ?? 0) === 0}
            className="border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900 dark:border-amber-800/60 dark:text-amber-300 dark:hover:bg-amber-950/40"
            title="Télécharger les encaissements au format Excel (.xls)"
          >
            {exporting === "excel" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-3.5" />
            )}
            Export Excel
          </Button>
        </div>
      </div>

      {/* ─── Tableau ─────────────────────────────────────────────────── */}
      <GlassCard variant="adaptive" noHover premiumBorder className="overflow-hidden p-0">
        <div>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : (data?.data ?? []).length === 0 ? (
            <EmptyState
              title="Aucun paiement"
              message="Aucun encaissement ne correspond à vos filtres."
              icon={FileBarChart}
              tone="emerald"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-emerald-50/60 hover:bg-emerald-50/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/20">
                    <TableHead className="pl-4 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Date
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Reçu
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Élève
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Classe
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Motif
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Montant
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Mode
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Caissier
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Statut
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.data ?? []).map((p) => {
                    const eleveLabel = p.eleve
                      ? [p.eleve.prenoms, p.eleve.nom]
                          .filter(Boolean)
                          .join(" ")
                      : "—";
                    const caissierLabel = p.caissier
                      ? `${p.caissier.prenoms ?? ""} ${p.caissier.nom ?? ""}`.trim()
                      : "—";
                    const motif =
                      p.frais?.libelle ??
                      p.echeance?.libelle ??
                      "Paiement scolaire";
                    return (
                      <TableRow
                        key={p.id}
                        className={cn(
                          "transition-colors hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20",
                          p.statut === "ANNULE" && "opacity-60",
                        )}
                      >
                        <TableCell className="pl-4 text-xs whitespace-nowrap">
                          {formatDateShort(p.date_paiement)}
                        </TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">
                          {p.numero_recu}
                        </TableCell>
                        <TableCell className="text-xs font-medium break-words leading-snug">
                          {eleveLabel}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {p.eleve?.inscription_courante?.classe_libelle ??
                            "—"}
                        </TableCell>
                        <TableCell className="text-xs break-words leading-snug">
                          {motif}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-bold text-emerald-700 whitespace-nowrap dark:text-emerald-300">
                          {formatFCFA(p.montant)}
                        </TableCell>
                        <TableCell>
                          <ModePaiementBadge mode={p.mode_paiement} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground break-words leading-snug">
                          {caissierLabel}
                        </TableCell>
                        <TableCell>
                          <StatutPaiementBadge statut={p.statut} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </GlassCard>

      {/* ─── Barre d'actions sticky (mobile uniquement) ──────────────── */}
      {(data?.count ?? 0) > 0 && (
        <div className="sticky bottom-0 z-10 mt-2 flex flex-col gap-2 border-t border-emerald-200/60 bg-background/80 p-3 backdrop-blur-md md:hidden dark:border-emerald-800/40 dark:bg-background/80">
          <p className="text-center text-[11px] text-muted-foreground">
            {isFetching ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Mise à jour…
              </span>
            ) : (
              <>
                <span className="font-medium text-foreground">
                  {data?.count ?? 0}
                </span>{" "}
                paiement(s)
              </>
            )}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-11"
              aria-label="Actualiser les paiements"
            >
              <Loader2
                className={cn("size-4", isFetching && "animate-spin")}
              />
              <span className="sr-only">Actualiser</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("csv")}
              disabled={exporting !== null}
              className="h-11 border-emerald-300 text-emerald-800 dark:border-emerald-800/60 dark:text-emerald-300"
              aria-label="Exporter en CSV"
            >
              {exporting === "csv" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport("excel")}
              disabled={exporting !== null}
              className="h-11 border-amber-300 text-amber-800 dark:border-amber-800/60 dark:text-amber-300"
              aria-label="Exporter en Excel"
            >
              {exporting === "excel" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="size-4" />
              )}
              Excel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Soldes »
// ─────────────────────────────────────────────────────────────────────────────

function RapportSoldesPanel() {
  const { toast } = useToast();
  const etablissementId = useAuthStore((s) => s.etablissement?.id);
  const [classeId, setClasseId] = React.useState<string>("all");
  const [categorie, setCategorie] = React.useState<string>("all");
  const [statut, setStatut] = React.useState<string>("all");
  const [exporting, setExporting] = React.useState(false);

  const { data: classes } = useQuery({
    queryKey: ["classes", { etablissementId }],
    queryFn: () => fetchClasses(etablissementId),
    enabled: !!etablissementId,
  });

  // Debounce 300 ms
  const [debouncedFilters, setDebouncedFilters] =
    React.useState<RapportSoldesFilters>({});
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedFilters({
        classe_id: classeId !== "all" ? classeId : undefined,
        categorie: categorie !== "all" ? categorie : undefined,
        statut: statut !== "all" ? statut : undefined,
      });
    }, 300);
    return () => clearTimeout(t);
  }, [classeId, categorie, statut]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: rapportsKeys.soldes(debouncedFilters),
    queryFn: () => fetchRapportSoldes(debouncedFilters),
    enabled: !!etablissementId,
    retry: 1,
    retryDelay: 1500,
  });

  const hasActiveFilter =
    classeId !== "all" || categorie !== "all" || statut !== "all";

  const soldeDu = data?.total_solde_du ?? 0;

  async function handleExport() {
    setExporting(true);
    try {
      // Réutilise l'endpoint paiements pour le téléchargement CSV (les soldes
      // n'ont pas d'endpoint CSV dédié en V1) — pour l'instant, on simule un
      // export JSON côté navigateur.
      const rows = data?.data ?? [];
      if (rows.length === 0) return;
      const header = [
        "Élève",
        "Classe",
        "Total attendu",
        "Total payé",
        "Solde dû",
        "Statut",
      ];
      const csvLines = [
        header.join(";"),
        ...rows.map((r) =>
          [
            `${r.eleve_prenoms ?? ""} ${r.eleve_nom ?? ""}`.trim(),
            r.classe ?? "",
            String(r.total_attendu ?? 0),
            String(r.total_paye ?? 0),
            String(r.solde_du ?? 0),
            r.statut ?? "",
          ]
            .map((s) => `"${String(s).replace(/"/g, '""')}"`)
            .join(";"),
        ),
      ];
      const blob = new Blob(["\uFEFF" + csvLines.join("\n")], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rapport_soldes_${todayISO()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export prêt", description: "Fichier CSV téléchargé." });
    } catch (err) {
      toast({
        title: "Erreur d'export",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de générer l'export.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* ─── Filtres ─────────────────────────────────────────────────── */}
      <GlassCard variant="adaptive" noHover className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Classe */}
          <div className="space-y-1.5">
            <Label
              htmlFor="rs-classe"
              className="text-xs font-medium text-muted-foreground"
            >
              Classe
            </Label>
            <Select value={classeId} onValueChange={setClasseId}>
              <SelectTrigger id="rs-classe" className="h-10 w-full">
                <School className="mr-1.5 size-4 shrink-0 text-emerald-600" />
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
            <Label
              htmlFor="rs-categorie"
              className="text-xs font-medium text-muted-foreground"
            >
              Catégorie
            </Label>
            <Select value={categorie} onValueChange={setCategorie}>
              <SelectTrigger id="rs-categorie" className="h-10 w-full">
                <Tag className="mr-1.5 size-4 shrink-0 text-emerald-600" />
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
          {/* Statut */}
          <div className="space-y-1.5">
            <Label
              htmlFor="rs-statut"
              className="text-xs font-medium text-muted-foreground"
            >
              Statut
            </Label>
            <Select value={statut} onValueChange={setStatut}>
              <SelectTrigger id="rs-statut" className="h-10 w-full">
                <CircleDot className="mr-1.5 size-4 shrink-0 text-emerald-600" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUT_SOLDE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Réinitialiser */}
          <div className="flex items-end">
            <Button
              variant={hasActiveFilter ? "outline" : "ghost"}
              size="default"
              className={cn(
                "h-10 w-full",
                hasActiveFilter &&
                  "border-emerald-300 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-950/40",
              )}
              onClick={() => {
                setClasseId("all");
                setCategorie("all");
                setStatut("all");
              }}
            >
              <RotateCcw className="size-3.5" />
              Réinitialiser
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ─── StatCards de résumé (4) ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total attendu"
          value={formatFCFA(data?.total_attendu ?? 0)}
          icon={Wallet}
          tone="sky"
          hint="scolarité prévue"
          delay={0}
        />
        <StatCard
          label="Total payé"
          value={formatFCFA(data?.total_paye ?? 0)}
          icon={Wallet}
          tone="emerald"
          hint="déjà encaissé"
          delay={0.05}
        />
        <StatCard
          label="Solde dû"
          value={formatFCFA(soldeDu)}
          icon={AlertCircle}
          tone={soldeDu > 0 ? "terracotta" : "emerald"}
          hint={soldeDu > 0 ? "à recouvrer" : "à jour"}
          delay={0.1}
        />
        <StatCard
          label="Élèves concernés"
          value={`${data?.count ?? 0}`}
          icon={FileText}
          tone="forest"
          hint="filtrés"
          delay={0.15}
        />
      </div>

      {/* ─── Export (desktop) ────────────────────────────────────────── */}
      <div className="hidden flex-wrap items-center justify-between gap-2 md:flex">
        <p className="text-xs text-muted-foreground">
          {isFetching ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" /> Mise à jour…
            </span>
          ) : (
            <>
              <span className="font-medium text-foreground">
                {data?.count ?? 0}
              </span>{" "}
              élève(s) au total
            </>
          )}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting || (data?.count ?? 0) === 0}
          className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 dark:border-emerald-800/60 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
          title="Télécharger le rapport des soldes au format CSV"
        >
          {exporting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          Export CSV
        </Button>
      </div>

      {/* ─── Tableau ─────────────────────────────────────────────────── */}
      <GlassCard variant="adaptive" noHover premiumBorder className="overflow-hidden p-0">
        <div>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : (data?.data ?? []).length === 0 ? (
            <EmptyState
              title="Aucun solde"
              message="Aucun élève ne correspond à vos filtres."
              icon={Scale}
              tone="amber"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-emerald-50/60 hover:bg-emerald-50/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/20">
                    <TableHead className="pl-4 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Élève
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Classe
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Attendu
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Payé
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Solde dû
                    </TableHead>
                    <TableHead className="pr-4 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Statut
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.data ?? []).map((s) => {
                    const fullName =
                      [s.eleve_prenoms, s.eleve_nom]
                        .filter(Boolean)
                        .join(" ")
                        .trim() || "—";
                    return (
                      <TableRow
                        key={s.eleve_id}
                        className="transition-colors hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20"
                      >
                        <TableCell className="pl-4 text-xs font-medium break-words leading-snug">
                          {fullName}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {s.classe || "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                          {formatFCFA(s.total_attendu)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold text-emerald-700 whitespace-nowrap dark:text-emerald-300">
                          {formatFCFA(s.total_paye)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono text-sm font-bold whitespace-nowrap",
                            s.solde_du > 0
                              ? "text-terracotta"
                              : "text-emerald-700 dark:text-emerald-300",
                          )}
                        >
                          {formatFCFA(s.solde_du)}
                        </TableCell>
                        <TableCell className="pr-4">
                          <SoldeStatutBadge statut={s.statut} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </GlassCard>

      {/* ─── Barre d'actions sticky (mobile uniquement) ──────────────── */}
      {(data?.count ?? 0) > 0 && (
        <div className="sticky bottom-0 z-10 mt-2 flex flex-col gap-2 border-t border-emerald-200/60 bg-background/80 p-3 backdrop-blur-md md:hidden dark:border-emerald-800/40 dark:bg-background/80">
          <p className="text-center text-[11px] text-muted-foreground">
            {isFetching ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Mise à jour…
              </span>
            ) : (
              <>
                <span className="font-medium text-foreground">
                  {data?.count ?? 0}
                </span>{" "}
                élève(s)
              </>
            )}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-11"
              aria-label="Actualiser les soldes"
            >
              <Loader2
                className={cn("size-4", isFetching && "animate-spin")}
              />
              <span className="sr-only">Actualiser</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting}
              className="h-11 border-emerald-300 text-emerald-800 dark:border-emerald-800/60 dark:text-emerald-300"
              aria-label="Exporter les soldes en CSV"
            >
              {exporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              CSV
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Recouvrement »
// ─────────────────────────────────────────────────────────────────────────────

function RapportRecouvrementPanel() {
  const etablissementId = useAuthStore((s) => s.etablissement?.id);
  const [cycleId, setCycleId] = React.useState<string>("all");
  const [classeId, setClasseId] = React.useState<string>("all");

  const { data: cycles } = useQuery({
    queryKey: ["cycles", { etablissementId }],
    queryFn: () => fetchCycles(etablissementId),
    enabled: !!etablissementId,
  });
  const { data: classes } = useQuery({
    queryKey: ["classes", { etablissementId }],
    queryFn: () => fetchClasses(etablissementId),
    enabled: !!etablissementId,
  });

  // Debounce 300 ms
  const [debouncedFilters, setDebouncedFilters] =
    React.useState<RapportRecouvrementFilters>({});
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedFilters({
        cycle_id: cycleId !== "all" ? cycleId : undefined,
        classe_id: classeId !== "all" ? classeId : undefined,
      });
    }, 300);
    return () => clearTimeout(t);
  }, [cycleId, classeId]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: rapportsKeys.recouvrement(debouncedFilters),
    queryFn: () => fetchRapportRecouvrement(debouncedFilters),
    enabled: !!etablissementId,
    retry: 1,
    retryDelay: 1500,
  });

  const lignes = data?.data ?? [];
  const resume = data?.resume;
  const taux = resume?.taux ?? 0;
  const hasActiveFilter = cycleId !== "all" || classeId !== "all";

  // Hint contextuel selon le taux de recouvrement
  const tauxHint =
    taux >= 80 ? "Excellent" : taux >= 50 ? "Correct" : taux > 0 ? "Critique" : "—";
  const tauxHintTone =
    taux >= 80
      ? "text-emerald-700 dark:text-emerald-300"
      : taux >= 50
        ? "text-amber-700 dark:text-amber-300"
        : "text-terracotta";

  return (
    <div className="space-y-4">
      {/* ─── Filtres ─────────────────────────────────────────────────── */}
      <GlassCard variant="adaptive" noHover className="p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Cycle */}
          <div className="space-y-1.5">
            <Label
              htmlFor="rr-cycle"
              className="text-xs font-medium text-muted-foreground"
            >
              Cycle
            </Label>
            <Select value={cycleId} onValueChange={setCycleId}>
              <SelectTrigger id="rr-cycle" className="h-10 w-full">
                <Layers className="mr-1.5 size-4 shrink-0 text-emerald-600" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous cycles</SelectItem>
                {(cycles ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Classe */}
          <div className="space-y-1.5">
            <Label
              htmlFor="rr-classe"
              className="text-xs font-medium text-muted-foreground"
            >
              Classe
            </Label>
            <Select value={classeId} onValueChange={setClasseId}>
              <SelectTrigger id="rr-classe" className="h-10 w-full">
                <School className="mr-1.5 size-4 shrink-0 text-emerald-600" />
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
          {/* Réinitialiser */}
          <div className="flex items-end">
            <Button
              variant={hasActiveFilter ? "outline" : "ghost"}
              size="default"
              className={cn(
                "h-10 w-full",
                hasActiveFilter &&
                  "border-emerald-300 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-950/40",
              )}
              onClick={() => {
                setCycleId("all");
                setClasseId("all");
              }}
            >
              <RotateCcw className="size-3.5" />
              Réinitialiser
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ─── Résumé global (3 cards) ─────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total attendu"
          value={formatFCFA(resume?.attendu ?? 0)}
          icon={Wallet}
          tone="sky"
          hint="scolarité prévue"
          delay={0}
        />
        <StatCard
          label="Total encaissé"
          value={formatFCFA(resume?.encaisse ?? 0)}
          icon={Wallet}
          tone="emerald"
          hint="déjà perçu"
          delay={0.05}
        />
        {/* Card "Taux de recouvrement" premium : variant desktop + premiumBorder
            + KentePattern bg + % text-3xl + hint Excellent/Correct/Critique */}
        <GlassCard
          variant="desktop"
          premiumBorder
          noHover
          className="relative overflow-hidden"
        >
          <KentePattern variant="bg" />
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Taux de recouvrement
              </span>
              <span className="font-display text-3xl font-bold tabular-nums text-forest">
                {taux.toFixed(1)} %
              </span>
              <span className={cn("text-xs font-medium", tauxHintTone)}>
                {tauxHint} · Encaissé / Attendu
              </span>
            </div>
            <ProgressCircle value={taux} size={88} strokeWidth={8} />
          </div>
        </GlassCard>
      </div>

      <KentePattern variant="separator" className="my-1" />

      {/* ─── Graphique ───────────────────────────────────────────────── */}
      <GlassCard variant="adaptive" noHover>
        <div className="mb-3">
          <h3 className="font-display text-base font-semibold">
            Taux de recouvrement par classe
          </h3>
          <p className="text-xs text-muted-foreground">
            Comparaison du total attendu et encaissé par classe.
          </p>
        </div>
        <div>
          {lignes.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <PieChart className="size-8 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Aucune donnée de recouvrement disponible.
              </p>
            </div>
          ) : (
            <BarChart
              data={lignes.map((l) => ({
                label: l.classe,
                value: l.encaisse,
                value2: l.attendu,
              }))}
              formatValue={formatFCFA}
              height={Math.max(140, lignes.length * 36)}
              color="bg-emerald-500"
              color2="bg-amber-300 dark:bg-amber-800/40"
              legendLabel="Encaissé"
              legendLabel2="Attendu"
            />
          )}
        </div>
      </GlassCard>

      {/* ─── Tableau ─────────────────────────────────────────────────── */}
      <GlassCard variant="adaptive" noHover premiumBorder className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-2 p-5 pb-3">
          <h3 className="font-display text-base font-semibold">
            Détail par classe
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <Loader2
              className={cn("size-3.5", isFetching && "animate-spin")}
            />
            Actualiser
          </Button>
        </div>
        <div>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : lignes.length === 0 ? (
            <EmptyState
              title="Aucune classe"
              message="Aucune classe ne correspond à vos filtres."
              icon={PieChart}
              tone="muted"
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border bg-emerald-50/60 hover:bg-emerald-50/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/20">
                    <TableHead className="pl-4 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Classe
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Effectif
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Attendu
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Encaissé
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Impayés
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Taux
                    </TableHead>
                    <TableHead className="pr-4 text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Niveau
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignes.map((l, idx) => {
                    const ligneTaux = l.taux ?? 0;
                    return (
                      <TableRow
                        key={`${l.classe}-${idx}`}
                        className="transition-colors hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20"
                      >
                        <TableCell className="pl-4 text-xs font-medium break-words leading-snug">
                          {l.classe || "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {l.nb_eleves ?? 0}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs whitespace-nowrap">
                          {formatFCFA(l.attendu)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold text-emerald-700 whitespace-nowrap dark:text-emerald-300">
                          {formatFCFA(l.encaisse)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          <span
                            className={cn(
                              "font-mono tabular-nums",
                              (l.nb_impayes ?? 0) > 0
                                ? "font-semibold text-amber-700 dark:text-amber-300"
                                : "text-muted-foreground",
                            )}
                          >
                            {l.nb_impayes ?? 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <RecouvrementTauxBadge taux={ligneTaux} />
                        </TableCell>
                        <TableCell className="pr-4">
                          <TauxMiniBar taux={ligneTaux} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </GlassCard>

      {/* ─── Barre d'actions sticky (mobile uniquement) ──────────────── */}
      {lignes.length > 0 && (
        <div className="sticky bottom-0 z-10 mt-2 flex flex-col gap-2 border-t border-emerald-200/60 bg-background/80 p-3 backdrop-blur-md md:hidden dark:border-emerald-800/40 dark:bg-background/80">
          <p className="text-center text-[11px] text-muted-foreground">
            {isFetching ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Mise à jour…
              </span>
            ) : (
              <>
                <span className="font-medium text-foreground">
                  {lignes.length}
                </span>{" "}
                classe(s)
              </>
            )}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-11 border-emerald-300 text-emerald-800 dark:border-emerald-800/60 dark:text-emerald-300"
            aria-label="Actualiser le recouvrement"
          >
            <Loader2
              className={cn("size-4", isFetching && "animate-spin")}
            />
            Actualiser
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composants partagés
// ─────────────────────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="relative overflow-hidden px-4 py-12">
      <KentePattern variant="bg" />
      <div className="relative flex flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-rose-100 text-rose-700 shadow-sm dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="size-7" />
        </div>
        <div className="space-y-1.5">
          <p className="text-base font-medium">Erreur de chargement</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Le backend n&apos;a pas pu répondre. Vérifiez qu&apos;il est démarré
            puis réessayez.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <Loader2 className="size-3.5" />
          Réessayer
        </Button>
      </div>
    </div>
  );
}

type EmptyTone = "emerald" | "amber" | "muted";

const emptyToneClasses: Record<EmptyTone, string> = {
  emerald:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  muted: "bg-muted text-muted-foreground",
};

function EmptyState({
  title,
  message,
  icon: Icon = FileBarChart,
  tone = "muted",
}: {
  title: string;
  message: string;
  icon?: LucideIcon;
  tone?: EmptyTone;
}) {
  return (
    <div className="relative overflow-hidden px-4 py-16">
      <KentePattern variant="bg" />
      <div className="relative flex flex-col items-center justify-center gap-3 text-center">
        <div
          className={cn(
            "flex size-14 items-center justify-center rounded-full shadow-sm",
            emptyToneClasses[tone],
          )}
        >
          <Icon className="size-7" />
        </div>
        <div className="space-y-1.5">
          <p className="text-base font-medium">{title}</p>
          <p className="max-w-md text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </div>
  );
}

function SoldeStatutBadge({ statut }: { statut?: string }) {
  if (!statut) return <span className="text-xs">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    SOLDE: {
      label: "Soldé",
      cls: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
    },
    PARTIEL: {
      label: "Partiel",
      cls: "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
    },
    IMPAYE: {
      label: "Impayé",
      cls: "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200",
    },
  };
  const entry = map[statut] ?? {
    label: statut,
    cls: "border-muted-foreground/30 bg-muted text-muted-foreground",
  };
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-medium", entry.cls)}
    >
      {entry.label}
    </Badge>
  );
}

function RecouvrementTauxBadge({ taux }: { taux: number }) {
  const cls =
    taux >= 80
      ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200"
      : taux >= 50
        ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
        : "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200";
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-semibold tabular-nums", cls)}
    >
      {taux.toFixed(1)} %
    </Badge>
  );
}

function TauxMiniBar({ taux }: { taux: number }) {
  const pct = Math.max(2, Math.min(100, taux));
  const cls =
    taux >= 80
      ? "bg-emerald-500"
      : taux >= 50
        ? "bg-amber-500"
        : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", cls)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold tabular-nums text-muted-foreground">
        {taux.toFixed(0)}%
      </span>
    </div>
  );
}
