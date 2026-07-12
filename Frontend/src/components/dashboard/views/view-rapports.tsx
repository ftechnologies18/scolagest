"use client";

/**
 * ScolaGest — Vue « Rapports » (Phase 4).
 *
 * Trois onglets :
 *  - Paiements     : filtres multicritères + tableau des encaissements +
 *    totaux + exports CSV/Excel.
 *  - Soldes         : filtres (classe, catégorie, statut) + tableau des
 *    soldes par élève + totaux + export CSV.
 *  - Recouvrement   : filtres (cycle, classe) + tableau par classe + résumé
 *    global + bar chart du taux par classe.
 *
 * Toutes les requêtes utilisent `useQuery` avec les filtres dans la clé de
 * cache (debounce 300ms sur les changements de filtres). Les boutons d'export
 * déclenchent `downloadRapportPaiements(filters, 'csv' | 'excel')` qui
 * télécharge un fichier via la gateway Caddy.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
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
import {
  formatFCFA,
  formatDateShort,
  todayISO,
} from "@/lib/format";
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
import { Card, CardContent } from "@/components/ui/card";
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

export default function RapportsView() {
  const etablissement = useAuthStore((s) => s.etablissement);

  return (
    <div className="space-y-4">
      <KentePattern variant="strip" position="top" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <FileBarChart className="size-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">Rapports</h1>
            <p className="text-sm text-muted-foreground">
              Exports et statistiques des encaissements, soldes et taux de
              recouvrement.
              {etablissement?.nom ? (
                <span className="ml-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {etablissement.nom}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      {!etablissement?.id ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <Filter className="size-6" />
            </div>
            <p className="text-sm font-medium">
              Sélectionnez un établissement
            </p>
            <p className="max-w-md text-xs text-muted-foreground">
              Les rapports sont calculés par établissement. Choisissez-en un
              dans la barre latérale pour commencer.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="paiements" className="w-full">
          <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:grid-cols-none">
            <TabsTrigger value="paiements">
              <Wallet className="size-3.5" />
              Paiements
            </TabsTrigger>
            <TabsTrigger value="soldes">
              <Scale className="size-3.5" />
              Soldes
            </TabsTrigger>
            <TabsTrigger value="recouvrement">
              <PieChart className="size-3.5" />
              Recouvrement
            </TabsTrigger>
          </TabsList>

          <TabsContent value="paiements" className="mt-4">
            <RapportPaiementsPanel />
          </TabsContent>
          <TabsContent value="soldes" className="mt-4">
            <RapportSoldesPanel />
          </TabsContent>
          <TabsContent value="recouvrement" className="mt-4">
            <RapportRecouvrementPanel />
          </TabsContent>
        </Tabs>
      )}
    </div>
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
      {/* Filtres */}
      <GlassCard variant="adaptive" noHover className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="rp-date-debut" className="text-xs">
              Date début
            </Label>
            <Input
              id="rp-date-debut"
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              max={dateFin || todayISO()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rp-date-fin" className="text-xs">
              Date fin
            </Label>
            <Input
              id="rp-date-fin"
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              min={dateDebut || undefined}
              max={todayISO()}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cycle</Label>
            <Select value={cycleId} onValueChange={setCycleId}>
              <SelectTrigger className="w-full">
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
          <div className="space-y-1.5">
            <Label className="text-xs">Classe</Label>
            <Select value={classeId} onValueChange={setClasseId}>
              <SelectTrigger className="w-full">
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
          <div className="space-y-1.5">
            <Label className="text-xs">Catégorie</Label>
            <Select value={categorie} onValueChange={setCategorie}>
              <SelectTrigger className="w-full">
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
          <div className="space-y-1.5">
            <Label className="text-xs">Mode</Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as "all" | ModePaiement)}
            >
              <SelectTrigger className="w-full">
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
          <div className="space-y-1.5">
            <Label className="text-xs">Caissier</Label>
            <Select
              value={caissier}
              onValueChange={(v) => setCaissier(v as "all" | "me")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous caissiers</SelectItem>
                <SelectItem value="me">Mes encaissements</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
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
              <Filter className="size-3.5" />
              Réinitialiser
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Résumé */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Montant total"
          value={formatFCFA(data?.total_montant ?? 0)}
          icon={Wallet}
          tone="emerald"
          delay={0}
        />
        <StatCard
          label="Nombre de paiements"
          value={`${data?.count ?? 0}`}
          icon={FileText}
          tone="sky"
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
          delay={0.1}
        />
      </div>

      <KentePattern variant="separator" className="my-1" />

      {/* Export + Rafraîchir */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isFetching ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Mise à jour…
            </>
          ) : (
            <>
              <CalendarRange className="size-3" />
              {data?.count ?? 0} paiement(s) sur la période sélectionnée
            </>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
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
            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
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

      {/* Tableau */}
      <GlassCard variant="adaptive" noHover className="overflow-hidden p-0">
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
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-4">Date</TableHead>
                    <TableHead>Reçu</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Caissier</TableHead>
                    <TableHead>Statut</TableHead>
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
                          "hover:bg-muted/40",
                          p.statut === "ANNULE" && "opacity-60",
                        )}
                      >
                        <TableCell className="pl-4 text-xs">
                          {formatDateShort(p.date_paiement)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {p.numero_recu}
                        </TableCell>
                        <TableCell className="text-xs font-medium">
                          {eleveLabel}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.eleve?.inscription_courante?.classe_libelle ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs">{motif}</TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          {formatFCFA(p.montant)}
                        </TableCell>
                        <TableCell>
                          <ModePaiementBadge mode={p.mode_paiement} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
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
      {/* Filtres */}
      <GlassCard variant="adaptive" noHover className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Classe</Label>
            <Select value={classeId} onValueChange={setClasseId}>
              <SelectTrigger className="w-full">
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
          <div className="space-y-1.5">
            <Label className="text-xs">Catégorie</Label>
            <Select value={categorie} onValueChange={setCategorie}>
              <SelectTrigger className="w-full">
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
          <div className="space-y-1.5">
            <Label className="text-xs">Statut</Label>
            <Select value={statut} onValueChange={setStatut}>
              <SelectTrigger className="w-full">
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
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setClasseId("all");
                setCategorie("all");
                setStatut("all");
              }}
            >
              <Filter className="size-3.5" />
              Réinitialiser
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Résumé */}
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Total attendu"
          value={formatFCFA(data?.total_attendu ?? 0)}
          icon={Wallet}
          tone="sky"
          delay={0}
        />
        <StatCard
          label="Total payé"
          value={formatFCFA(data?.total_paye ?? 0)}
          icon={Wallet}
          tone="emerald"
          delay={0.05}
        />
        <StatCard
          label="Solde dû"
          value={formatFCFA(data?.total_solde_du ?? 0)}
          icon={AlertCircle}
          tone="amber"
          delay={0.1}
        />
        <StatCard
          label="Élèves concernés"
          value={`${data?.count ?? 0}`}
          icon={FileText}
          tone="forest"
          delay={0.15}
        />
      </div>

      {/* Export */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {isFetching ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" /> Mise à jour…
            </span>
          ) : (
            `${data?.count ?? 0} élève(s) au total`
          )}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting || (data?.count ?? 0) === 0}
        >
          {exporting ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Download className="size-3.5" />
          )}
          Export CSV
        </Button>
      </div>

      {/* Tableau */}
      <GlassCard variant="adaptive" noHover className="overflow-hidden p-0">
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
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-4">Élève</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead className="text-right">Attendu</TableHead>
                    <TableHead className="text-right">Payé</TableHead>
                    <TableHead className="text-right">Solde dû</TableHead>
                    <TableHead className="pr-4">Statut</TableHead>
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
                      <TableRow key={s.eleve_id} className="hover:bg-muted/40">
                        <TableCell className="pl-4 text-xs font-medium">
                          {fullName}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {s.classe || "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatFCFA(s.total_attendu)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-emerald-700 dark:text-emerald-300">
                          {formatFCFA(s.total_paye)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono text-xs font-semibold",
                            s.solde_du > 0
                              ? "text-amber-700 dark:text-amber-300"
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

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <GlassCard variant="adaptive" noHover className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Cycle</Label>
            <Select value={cycleId} onValueChange={setCycleId}>
              <SelectTrigger className="w-full">
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
          <div className="space-y-1.5">
            <Label className="text-xs">Classe</Label>
            <Select value={classeId} onValueChange={setClasseId}>
              <SelectTrigger className="w-full">
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
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setCycleId("all");
                setClasseId("all");
              }}
            >
              <Filter className="size-3.5" />
              Réinitialiser
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Résumé global */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total attendu"
          value={formatFCFA(resume?.attendu ?? 0)}
          icon={Wallet}
          tone="sky"
          delay={0}
        />
        <StatCard
          label="Total encaissé"
          value={formatFCFA(resume?.encaisse ?? 0)}
          icon={Wallet}
          tone="emerald"
          delay={0.05}
        />
        <GlassCard variant="adaptive" noHover className="flex items-center justify-between gap-4 p-5">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Taux de recouvrement
            </span>
            <span className="text-2xl font-bold font-display text-foreground">
              {(resume?.taux ?? 0).toFixed(1)} %
            </span>
            <span className="text-xs text-muted-foreground">
              Encaissé / Attendu
            </span>
          </div>
          <ProgressCircle
            value={resume?.taux ?? 0}
            size={88}
            strokeWidth={8}
          />
        </GlassCard>
      </div>

      <KentePattern variant="separator" className="my-1" />

      {/* Graphique */}
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
            <p className="py-8 text-center text-xs text-muted-foreground">
              Aucune donnée de recouvrement disponible.
            </p>
          ) : (
            <BarChart
              data={lignes.map((l) => ({
                label: l.classe,
                value: l.encaisse,
                value2: l.attendu,
              }))}
              formatValue={formatFCFA}
              height={Math.max(140, lignes.length * 36)}
              legendLabel="Encaissé"
              legendLabel2="Attendu"
            />
          )}
        </div>
      </GlassCard>

      {/* Tableau */}
      <GlassCard variant="adaptive" noHover className="overflow-hidden p-0">
        <div className="flex items-center justify-between p-5 pb-3">
          <h3 className="font-display text-base font-semibold">Détail par classe</h3>
          <Button
            variant="outline"
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
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-4">Classe</TableHead>
                    <TableHead className="text-right">Effectif</TableHead>
                    <TableHead className="text-right">Attendu</TableHead>
                    <TableHead className="text-right">Encaissé</TableHead>
                    <TableHead className="text-right">Impayés</TableHead>
                    <TableHead className="text-right">Taux</TableHead>
                    <TableHead className="pr-4">Niveau</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lignes.map((l, idx) => {
                    const taux = l.taux ?? 0;
                    return (
                      <TableRow key={`${l.classe}-${idx}`} className="hover:bg-muted/40">
                        <TableCell className="pl-4 text-xs font-medium">
                          {l.classe || "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {l.nb_eleves ?? 0}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {formatFCFA(l.attendu)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-emerald-700 dark:text-emerald-300">
                          {formatFCFA(l.encaisse)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          <span
                            className={cn(
                              "font-mono",
                              (l.nb_impayes ?? 0) > 0
                                ? "text-amber-700 dark:text-amber-300"
                                : "text-muted-foreground",
                            )}
                          >
                            {l.nb_impayes ?? 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold">
                          <RecouvrementTauxBadge taux={taux} />
                        </TableCell>
                        <TableCell className="pr-4">
                          <TauxMiniBar taux={taux} />
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
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Composants partagés
// ─────────────────────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
        <AlertCircle className="size-6" />
      </div>
      <p className="text-sm font-medium">Erreur de chargement</p>
      <p className="max-w-md text-xs text-muted-foreground">
        Le backend n&apos;a pas pu répondre. Vérifiez qu&apos;il est démarré puis
        réessayez.
      </p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <Loader2 className="size-3.5" />
        Réessayer
      </Button>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <FileBarChart className="size-6" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-md text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

function SoldeStatutBadge({ statut }: { statut?: string }) {
  if (!statut) return <span className="text-xs">—</span>;
  const map: Record<string, { label: string; cls: string }> = {
    SOLDE: {
      label: "Soldé",
      cls: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    },
    PARTIEL: {
      label: "Partiel",
      cls: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
    },
    IMPAYE: {
      label: "Impayé",
      cls: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
    },
  };
  const entry = map[statut] ?? {
    label: statut,
    cls: "border-muted-foreground/20 bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium", entry.cls)}>
      {entry.label}
    </Badge>
  );
}

function RecouvrementTauxBadge({ taux }: { taux: number }) {
  const cls =
    taux >= 80
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
      : taux >= 50
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
        : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300";
  return (
    <Badge variant="outline" className={cn("text-[10px] font-semibold tabular-nums", cls)}>
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
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", cls)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
