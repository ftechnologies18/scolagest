"use client";

/**
 * ScolaGest — Vue « Comptabilité générale » (Phase 5).
 *
 * Cinq onglets :
 *  - Exercices    : liste des exercices comptables, « Nouvel exercice »,
 *    « Clôturer » (réservé COMPTABLE / ADMINISTRATEUR / DIRECTION).
 *  - Plan comptable : arbre hiérarchique des comptes (groupés par type
 *    ACTIF / PASSIF / PRODUIT / CHARGE), « Nouveau compte ».
 *  - Écritures    : filtres (exercice, journal, dates) + table paginée.
 *    Clic sur une ligne → dialog affichant les lignes (débit/crédit/compte).
 *  - Grand livre  : filtres (exercice, compte, dates) → table par compte
 *    avec solde d&apos;ouverture, mouvements et solde de fin.
 *  - Bilan        : sélection de l&apos;exercice → 4 cartes (Actif / Passif /
 *    Produits / Charges) + résultat (produits − charges), tables détaillées.
 *
 * Rôles autorisés : COMPTABLE / ADMINISTRATEUR / DIRECTION (filtre nav
 * appliqué dans `dashboard-layout.tsx`).
 *
 * Toutes les requêtes sont `enabled: !!etablissement?.id` avec
 * `retry: 1, retryDelay: 1500` pour tolérer un backend transitoirement
 * indisponible. Les états d&apos;erreur / vide / chargement sont gérés
 * explicitement pour chaque onglet.
 */

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  ListTree,
  FileText,
  Scale,
  Lock,
  Plus,
  Loader2,
  AlertCircle,
  Filter,
  CheckCircle2,
  Wallet,
  TrendingUp,
  TrendingDown,
  CalendarRange,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  comptaKeys,
  fetchExercices,
  cloturerExercice,
  fetchComptes,
  fetchJournaux,
  fetchEcritures,
  fetchEcriture,
  fetchGrandLivre,
  fetchBilan,
} from "@/lib/api-phase5";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA, formatDateShort, todayISO } from "@/lib/format";
import type {
  BilanResult,
  CompteComptable,
  EcrituresQueryParams,
  EcritureComptable,
  ExerciceComptable,
  GrandLivreQueryParams,
  GrandLivreResult,
  TypeCompte,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ExerciceFormDialog } from "@/components/comptabilite/exercice-form-dialog";
import { CompteFormDialog } from "@/components/comptabilite/compte-form-dialog";

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_COMPTE_LABEL: Record<TypeCompte, string> = {
  ACTIF: "Actif",
  PASSIF: "Passif",
  PRODUIT: "Produit",
  CHARGE: "Charge",
};

const TYPE_COMPTE_CLS: Record<TypeCompte, string> = {
  ACTIF: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  PASSIF: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  PRODUIT: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300",
  CHARGE: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
};

const TYPE_COMPTE_ORDER: TypeCompte[] = ["ACTIF", "PASSIF", "PRODUIT", "CHARGE"];

const PAGE_SIZE = 15;

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function ComptabiliteView() {
  const etablissement = useAuthStore((s) => s.etablissement);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <BookOpen className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">
              Comptabilité générale
            </h1>
            <p className="text-sm text-muted-foreground">
              Exercices, plan comptable, écritures, grand livre et bilan.
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
            <p className="text-sm font-medium">Sélectionnez un établissement</p>
            <p className="max-w-md text-xs text-muted-foreground">
              La comptabilité est gérée par établissement. Choisissez-en un dans
              la barre latérale pour accéder aux exercices et au plan comptable.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="exercices" className="w-full">
          <TabsList className="flex w-full justify-start gap-1 overflow-x-auto sm:w-auto">
            <TabsTrigger value="exercices">
              <CalendarRange className="size-3.5" />
              Exercices
            </TabsTrigger>
            <TabsTrigger value="plan">
              <ListTree className="size-3.5" />
              Plan comptable
            </TabsTrigger>
            <TabsTrigger value="ecritures">
              <FileText className="size-3.5" />
              Écritures
            </TabsTrigger>
            <TabsTrigger value="grand-livre">
              <BookOpen className="size-3.5" />
              Grand livre
            </TabsTrigger>
            <TabsTrigger value="bilan">
              <Scale className="size-3.5" />
              Bilan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exercices" className="mt-4">
            <ExercicesPanel />
          </TabsContent>
          <TabsContent value="plan" className="mt-4">
            <PlanComptablePanel />
          </TabsContent>
          <TabsContent value="ecritures" className="mt-4">
            <EcrituresPanel />
          </TabsContent>
          <TabsContent value="grand-livre" className="mt-4">
            <GrandLivrePanel />
          </TabsContent>
          <TabsContent value="bilan" className="mt-4">
            <BilanPanel />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Exercices »
// ─────────────────────────────────────────────────────────────────────────────

function ExercicesPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const etablissement = useAuthStore((s) => s.etablissement);
  const role = useAuthStore((s) => s.role);

  const [formOpen, setFormOpen] = React.useState(false);
  const [cloturerTarget, setCloturerTarget] =
    React.useState<ExerciceComptable | null>(null);

  const canManage = ["COMPTABLE", "ADMINISTRATEUR", "DIRECTION"].includes(
    role ?? "",
  );

  const {
    data: exercices,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: comptaKeys.exercices(etablissement?.id),
    queryFn: () => fetchExercices(etablissement?.id),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });

  const cloturerMutation = useMutation({
    mutationFn: (id: string) => cloturerExercice(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: comptaKeys.exercices(etablissement?.id),
      });
      toast({
        title: "Exercice clôturé",
        description: "Les écritures sont désormais verrouillées.",
      });
      setCloturerTarget(null);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de clôturer l'exercice.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {exercices?.length ?? 0} exercice(s) · un exercice ouvert est
          nécessaire pour saisir des écritures.
        </p>
        {canManage && (
          <Button
            onClick={() => setFormOpen(true)}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            size="sm"
          >
            <Plus className="size-4" />
            Nouvel exercice
          </Button>
        )}
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : (exercices ?? []).length === 0 ? (
            <EmptyState
              title="Aucun exercice"
              message="Créez un premier exercice comptable pour commencer à saisir des écritures."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-4">Libellé</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(exercices ?? []).map((ex) => (
                    <TableRow key={ex.id}>
                      <TableCell className="pl-4">
                        <div className="font-medium">{ex.libelle}</div>
                        {ex.annee_scolaire_id ? (
                          <div className="text-[11px] text-muted-foreground">
                            Année scolaire rattachée
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <CalendarRange className="mr-1 inline size-3" />
                        {formatDateShort(ex.date_debut)} →{" "}
                        {formatDateShort(ex.date_fin)}
                      </TableCell>
                      <TableCell>
                        <StatutExerciceBadge statut={ex.statut} />
                      </TableCell>
                      <TableCell className="text-right">
                        {ex.statut === "OUVERT" && canManage ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCloturerTarget(ex)}
                            className="border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-950/30"
                          >
                            <Lock className="size-3.5" />
                            Clôturer
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ExerciceFormDialog open={formOpen} onOpenChange={setFormOpen} />

      <AlertDialog
        open={!!cloturerTarget}
        onOpenChange={(o) => !o && setCloturerTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clôturer l&apos;exercice ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous êtes sur le point de clôturer « {cloturerTarget?.libelle} ».
              Cette action est <strong>irréversible</strong> : aucune nouvelle
              écriture ne pourra être rattachée à cet exercice.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cloturerMutation.isPending}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                cloturerTarget && cloturerMutation.mutate(cloturerTarget.id)
              }
              disabled={cloturerMutation.isPending}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {cloturerMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Lock className="size-4" />
              )}
              Clôturer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatutExerciceBadge({ statut }: { statut: ExerciceComptable["statut"] }) {
  const cls =
    statut === "OUVERT"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
      : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300";
  return (
    <Badge variant="outline" className={cn("font-medium", cls)}>
      {statut === "OUVERT" ? "Ouvert" : "Clôturé"}
    </Badge>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Plan comptable »
// ─────────────────────────────────────────────────────────────────────────────

function PlanComptablePanel() {
  const etablissement = useAuthStore((s) => s.etablissement);
  const role = useAuthStore((s) => s.role);
  const canManage = ["COMPTABLE", "ADMINISTRATEUR", "DIRECTION"].includes(
    role ?? "",
  );

  const [formOpen, setFormOpen] = React.useState(false);

  const {
    data: comptes,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: comptaKeys.comptes(etablissement?.id),
    queryFn: () => fetchComptes(etablissement?.id),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });

  // Grouper par type, puis hiérarchiser (parent → enfants)
  const grouped = React.useMemo(() => {
    const byType: Record<TypeCompte, CompteComptable[]> = {
      ACTIF: [],
      PASSIF: [],
      PRODUIT: [],
      CHARGE: [],
    };
    (comptes ?? []).forEach((c) => {
      byType[c.type]?.push(c);
    });
    // Trier par numéro dans chaque groupe
    TYPE_COMPTE_ORDER.forEach((t) => {
      byType[t].sort((a, b) => a.numero.localeCompare(b.numero, undefined, { numeric: true }));
    });
    return byType;
  }, [comptes]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {comptes?.length ?? 0} compte(s) au plan comptable.
        </p>
        {canManage && (
          <Button
            onClick={() => setFormOpen(true)}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            size="sm"
          >
            <Plus className="size-4" />
            Nouveau compte
          </Button>
        )}
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="p-0">
            <ErrorState onRetry={() => refetch()} />
          </CardContent>
        </Card>
      ) : (comptes ?? []).length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title="Aucun compte"
              message="Le plan comptable est vide. Créez un premier compte pour structurer votre comptabilité."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {TYPE_COMPTE_ORDER.map((type) => (
            <Card key={type} className="overflow-hidden">
              <CardHeader className="bg-muted/30 py-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  <span>{TYPE_COMPTE_LABEL[type]}</span>
                  <Badge variant="outline" className={cn(TYPE_COMPTE_CLS[type])}>
                    {grouped[type].length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {grouped[type].length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                    Aucun compte de type {TYPE_COMPTE_LABEL[type].toLowerCase()}.
                  </p>
                ) : (
                  <CompteTreeList comptes={grouped[type]} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CompteFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

function CompteTreeList({ comptes }: { comptes: CompteComptable[] }) {
  // Construire une map parent → enfants
  const byParent = React.useMemo(() => {
    const map = new Map<string | null, CompteComptable[]>();
    comptes.forEach((c) => {
      const key = c.parent_id ?? null;
      const arr = map.get(key) ?? [];
      arr.push(c);
      map.set(key, arr);
    });
    return map;
  }, [comptes]);

  const roots = byParent.get(null) ?? [];

  function renderNode(compte: CompteComptable, depth: number): React.ReactNode {
    const children = byParent.get(compte.id) ?? [];
    return (
      <React.Fragment key={compte.id}>
        <TableRow className={cn(depth > 0 && "bg-muted/10")}>
          <TableCell
            className="font-mono text-xs"
            style={{ paddingLeft: `${12 + depth * 18}px` }}
          >
            {compte.numero}
          </TableCell>
          <TableCell className="text-xs">{compte.libelle}</TableCell>
          <TableCell className="text-right">
            {compte.actif ? (
              <Badge
                variant="outline"
                className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
              >
                Actif
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-muted-foreground/20 bg-muted text-muted-foreground"
              >
                Inactif
              </Badge>
            )}
          </TableCell>
        </TableRow>
        {children.map((c) => renderNode(c, depth + 1))}
      </React.Fragment>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/20">
            <TableHead className="pl-4 text-[11px] uppercase">N°</TableHead>
            <TableHead className="text-[11px] uppercase">Libellé</TableHead>
            <TableHead className="text-right text-[11px] uppercase">
              État
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roots.map((r) => renderNode(r, 0))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Écritures »
// ─────────────────────────────────────────────────────────────────────────────

function EcrituresPanel() {
  const etablissement = useAuthStore((s) => s.etablissement);

  const [exerciceId, setExerciceId] = React.useState<string>("all");
  const [journalId, setJournalId] = React.useState<string>("all");
  const [dateDebut, setDateDebut] = React.useState("");
  const [dateFin, setDateFin] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [selectedEcriture, setSelectedEcriture] =
    React.useState<EcritureComptable | null>(null);

  const { data: exercices } = useQuery({
    queryKey: comptaKeys.exercices(etablissement?.id),
    queryFn: () => fetchExercices(etablissement?.id),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });
  const { data: journaux } = useQuery({
    queryKey: comptaKeys.journaux(etablissement?.id),
    queryFn: () => fetchJournaux(etablissement?.id),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });

  const params: EcrituresQueryParams = React.useMemo(
    () => ({
      exercice_id: exerciceId !== "all" ? exerciceId : undefined,
      journal_id: journalId !== "all" ? journalId : undefined,
      date_debut: dateDebut || undefined,
      date_fin: dateFin || undefined,
      page,
      page_size: PAGE_SIZE,
    }),
    [exerciceId, journalId, dateDebut, dateFin, page],
  );

  const {
    data: result,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: comptaKeys.ecritures(params),
    queryFn: () => fetchEcritures(params),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });

  // Reset page si filtres changent
  React.useEffect(() => {
    setPage(1);
  }, [exerciceId, journalId, dateDebut, dateFin]);

  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Exercice</Label>
            <Select value={exerciceId} onValueChange={setExerciceId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous exercices</SelectItem>
                {(exercices ?? []).map((ex) => (
                  <SelectItem key={ex.id} value={ex.id}>
                    {ex.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Journal</Label>
            <Select value={journalId} onValueChange={setJournalId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous journaux</SelectItem>
                {(journaux ?? []).map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.code} — {j.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ec-debut" className="text-xs">
              Date début
            </Label>
            <Input
              id="ec-debut"
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              max={dateFin || todayISO()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ec-fin" className="text-xs">
              Date fin
            </Label>
            <Input
              id="ec-fin"
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              min={dateDebut || undefined}
              max={todayISO()}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setExerciceId("all");
                setJournalId("all");
                setDateDebut("");
                setDateFin("");
              }}
            >
              <Filter className="size-3.5" />
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isFetching ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Mise à jour…
            </>
          ) : (
            <>
              <FileText className="size-3" />
              {total} écriture(s)
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <Loader2 className={cn("size-3.5", isFetching && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : (result?.data ?? []).length === 0 ? (
            <EmptyState
              title="Aucune écriture"
              message="Aucune écriture ne correspond à vos filtres. Les écritures sont générées automatiquement lors des encaissements (journal de caisse)."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-4">Date</TableHead>
                    <TableHead>N° pièce</TableHead>
                    <TableHead>Journal</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Débit</TableHead>
                    <TableHead className="text-right">Crédit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(result?.data ?? []).map((ec) => {
                    const totalDebit = (ec.lignes ?? []).reduce(
                      (s, l) => s + (l.debit ?? 0),
                      0,
                    );
                    const totalCredit = (ec.lignes ?? []).reduce(
                      (s, l) => s + (l.credit ?? 0),
                      0,
                    );
                    return (
                      <TableRow
                        key={ec.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => setSelectedEcriture(ec)}
                      >
                        <TableCell className="pl-4 text-xs">
                          {formatDateShort(ec.date_ecriture)}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {ec.numero_piece}
                        </TableCell>
                        <TableCell className="text-xs">
                          {ec.journal ? (
                            <span className="rounded-md border border-muted-foreground/20 bg-muted/40 px-1.5 py-0.5 text-[11px]">
                              {ec.journal.code}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="max-w-[280px] truncate text-xs">
                          {ec.libelle}
                        </TableCell>
                        <TableCell>
                          <StatutEcritureBadge statut={ec.statut} />
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                          {formatFCFA(totalDebit)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-semibold text-amber-700 dark:text-amber-300">
                          {formatFCFA(totalCredit)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isFetching}
          >
            Précédent
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isFetching}
          >
            Suivant
          </Button>
        </div>
      )}

      <EcritureDetailDialog
        ecriture={selectedEcriture}
        onClose={() => setSelectedEcriture(null)}
      />
    </div>
  );
}

function StatutEcritureBadge({
  statut,
}: {
  statut: EcritureComptable["statut"];
}) {
  const cls =
    statut === "VALIDEE"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
      : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300";
  return (
    <Badge variant="outline" className={cn("font-medium", cls)}>
      {statut === "VALIDEE" ? "Validée" : "Brouillon"}
    </Badge>
  );
}

function EcritureDetailDialog({
  ecriture,
  onClose,
}: {
  ecriture: EcritureComptable | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = React.useState<EcritureComptable | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!ecriture) {
      setDetail(null);
      return;
    }
    // Si l'écriture a déjà des lignes, on les affiche directement.
    if (ecriture.lignes && ecriture.lignes.length > 0) {
      setDetail(ecriture);
      return;
    }
    // Sinon, on charge le détail.
    let cancelled = false;
    setLoading(true);
    fetchEcriture(ecriture.id)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch(() => {
        if (!cancelled) setDetail(ecriture);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ecriture]);

  const lignes = detail?.lignes ?? [];
  const totalDebit = lignes.reduce((s, l) => s + (l.debit ?? 0), 0);
  const totalCredit = lignes.reduce((s, l) => s + (l.credit ?? 0), 0);

  return (
    <Dialog open={!!ecriture} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="size-5 text-emerald-600" />
            Écriture {ecriture?.numero_piece}
          </DialogTitle>
          <DialogDescription>
            {ecriture
              ? `${ecriture.libelle} · ${formatDateShort(ecriture.date_ecriture)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" />
            Chargement des lignes…
          </div>
        ) : lignes.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Aucune ligne détaillée disponible.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="pl-3 text-[11px] uppercase">Compte</TableHead>
                  <TableHead className="text-[11px] uppercase">Libellé</TableHead>
                  <TableHead className="text-right text-[11px] uppercase">
                    Débit
                  </TableHead>
                  <TableHead className="text-right text-[11px] uppercase">
                    Crédit
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lignes.map((l, i) => (
                  <TableRow key={l.id ?? i}>
                    <TableCell className="font-mono text-xs">
                      {l.compte
                        ? `${l.compte.numero} — ${l.compte.libelle}`
                        : l.compte_id}
                    </TableCell>
                    <TableCell className="text-xs">
                      {l.libelle ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-emerald-700 dark:text-emerald-300">
                      {l.debit ? formatFCFA(l.debit) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-amber-700 dark:text-amber-300">
                      {l.credit ? formatFCFA(l.credit) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell colSpan={2} className="text-right text-xs">
                    Totaux
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-emerald-700 dark:text-emerald-300">
                    {formatFCFA(totalDebit)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs text-amber-700 dark:text-amber-300">
                    {formatFCFA(totalCredit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}

        {ecriture?.paiement ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
            <Wallet className="mr-1 inline size-3" />
            Issue du paiement n°{" "}
            <span className="font-mono">{ecriture.paiement.numero_recu}</span>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Grand livre »
// ─────────────────────────────────────────────────────────────────────────────

function GrandLivrePanel() {
  const etablissement = useAuthStore((s) => s.etablissement);

  const [exerciceId, setExerciceId] = React.useState<string>("all");
  const [compteId, setCompteId] = React.useState<string>("all");
  const [dateDebut, setDateDebut] = React.useState("");
  const [dateFin, setDateFin] = React.useState("");

  const { data: exercices } = useQuery({
    queryKey: comptaKeys.exercices(etablissement?.id),
    queryFn: () => fetchExercices(etablissement?.id),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });
  const { data: comptes } = useQuery({
    queryKey: comptaKeys.comptes(etablissement?.id),
    queryFn: () => fetchComptes(etablissement?.id),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });

  const params: GrandLivreQueryParams = React.useMemo(
    () => ({
      exercice_id: exerciceId !== "all" ? exerciceId : undefined,
      compte_id: compteId !== "all" ? compteId : undefined,
      date_debut: dateDebut || undefined,
      date_fin: dateFin || undefined,
    }),
    [exerciceId, compteId, dateDebut, dateFin],
  );

  const {
    data: grandLivre,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: comptaKeys.grandLivre(params),
    queryFn: () => fetchGrandLivre(params),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Exercice</Label>
            <Select value={exerciceId} onValueChange={setExerciceId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {(exercices ?? []).map((ex) => (
                  <SelectItem key={ex.id} value={ex.id}>
                    {ex.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Compte</Label>
            <Select value={compteId} onValueChange={setCompteId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les comptes</SelectItem>
                {(comptes ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="font-mono">{c.numero}</span>
                    {" — "}
                    {c.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gl-debut" className="text-xs">
              Date début
            </Label>
            <Input
              id="gl-debut"
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              max={dateFin || todayISO()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gl-fin" className="text-xs">
              Date fin
            </Label>
            <Input
              id="gl-fin"
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              min={dateDebut || undefined}
              max={todayISO()}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setExerciceId("all");
                setCompteId("all");
                setDateDebut("");
                setDateFin("");
              }}
            >
              <Filter className="size-3.5" />
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isFetching ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Calcul…
            </>
          ) : (
            <>
              <BookOpen className="size-3" />
              {grandLivre?.comptes.length ?? 0} compte(s) ·{" "}
              {grandLivre?.comptes.reduce(
                (s, c) => s + c.mouvements.length,
                0,
              ) ?? 0}{" "}
              mouvement(s)
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <Loader2 className={cn("size-3.5", isFetching && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : isError ? (
        <Card>
          <CardContent className="p-0">
            <ErrorState onRetry={() => refetch()} />
          </CardContent>
        </Card>
      ) : !grandLivre || grandLivre.comptes.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title="Grand livre vide"
              message="Aucun mouvement comptable sur la période sélectionnée."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {(grandLivre as GrandLivreResult).comptes.map((c) => (
            <Card key={c.compte_id} className="overflow-hidden">
              <CardHeader className="bg-muted/30 py-3">
                <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    <span className="font-mono">{c.numero}</span>
                    {" — "}
                    {c.libelle}
                  </span>
                  <div className="flex items-center gap-2 text-xs font-normal">
                    <Badge
                      variant="outline"
                      className="border-muted-foreground/20 bg-muted/40"
                    >
                      Ouverture :{" "}
                      <span className="ml-1 font-mono">
                        {formatFCFA(
                          c.solde_debit_ouv - c.solde_credit_ouv,
                        )}
                      </span>
                    </Badge>
                    <Badge
                      variant="outline"
                      className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                    >
                      Solde final :{" "}
                      <span className="ml-1 font-mono">
                        {formatFCFA(c.solde_debit_fin - c.solde_credit_fin)}
                      </span>
                    </Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {c.mouvements.length === 0 ? (
                  <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                    Aucun mouvement sur ce compte.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="pl-4 text-[11px] uppercase">
                            Date
                          </TableHead>
                          <TableHead className="text-[11px] uppercase">
                            Pièce
                          </TableHead>
                          <TableHead className="text-[11px] uppercase">
                            Libellé
                          </TableHead>
                          <TableHead className="text-right text-[11px] uppercase">
                            Débit
                          </TableHead>
                          <TableHead className="text-right text-[11px] uppercase">
                            Crédit
                          </TableHead>
                          <TableHead className="text-right text-[11px] uppercase">
                            Solde
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {c.mouvements.map((m, i) => (
                          <TableRow key={i}>
                            <TableCell className="pl-4 text-xs">
                              {formatDateShort(m.date)}
                            </TableCell>
                            <TableCell className="font-mono text-xs">
                              {m.numero_piece}
                            </TableCell>
                            <TableCell className="max-w-[280px] truncate text-xs">
                              {m.libelle}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-emerald-700 dark:text-emerald-300">
                              {m.debit ? formatFCFA(m.debit) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-amber-700 dark:text-amber-300">
                              {m.credit ? formatFCFA(m.credit) : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold">
                              {formatFCFA(m.solde)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <Card className="bg-muted/30">
            <CardContent className="flex items-center justify-between py-3">
              <span className="text-xs font-medium uppercase text-muted-foreground">
                Totaux généraux
              </span>
              <div className="flex gap-4 font-mono text-sm">
                <span className="text-emerald-700 dark:text-emerald-300">
                  Débit : {formatFCFA(grandLivre.total_debit)}
                </span>
                <span className="text-amber-700 dark:text-amber-300">
                  Crédit : {formatFCFA(grandLivre.total_credit)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Bilan »
// ─────────────────────────────────────────────────────────────────────────────

function BilanPanel() {
  const etablissement = useAuthStore((s) => s.etablissement);

  const [exerciceId, setExerciceId] = React.useState<string>("all");

  const { data: exercices } = useQuery({
    queryKey: comptaKeys.exercices(etablissement?.id),
    queryFn: () => fetchExercices(etablissement?.id),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });

  const {
    data: bilan,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: comptaKeys.bilan(exerciceId !== "all" ? exerciceId : undefined),
    queryFn: () =>
      fetchBilan(exerciceId !== "all" ? exerciceId : undefined),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });

  const resultat = bilan?.resultat ?? 0;
  const isProfit = resultat >= 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <Label className="text-xs">Exercice</Label>
            <Select value={exerciceId} onValueChange={setExerciceId}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous exercices</SelectItem>
                {(exercices ?? []).map((ex) => (
                  <SelectItem key={ex.id} value={ex.id}>
                    {ex.libelle}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <Loader2 className={cn("size-3.5", isFetching && "animate-spin")} />
            Actualiser
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="p-0">
            <ErrorState onRetry={() => refetch()} />
          </CardContent>
        </Card>
      ) : !bilan ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              title="Bilan indisponible"
              message="Sélectionnez un exercice contenant des écritures pour générer le bilan."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* 4 cartes section */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <BilanCard
              title="Actif"
              total={bilan.actif.total}
              icon={Wallet}
              accent="emerald"
            />
            <BilanCard
              title="Passif"
              total={bilan.passif.total}
              icon={Scale}
              accent="amber"
            />
            <BilanCard
              title="Produits"
              total={bilan.produits.total}
              icon={TrendingUp}
              accent="emerald"
            />
            <BilanCard
              title="Charges"
              total={bilan.charges.total}
              icon={TrendingDown}
              accent="rose"
            />
          </div>

          {/* Résultat */}
          <Card
            className={cn(
              "border-l-4",
              isProfit
                ? "border-l-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20"
                : "border-l-rose-500 bg-rose-50/40 dark:bg-rose-950/20",
            )}
          >
            <CardContent className="flex flex-col items-start justify-between gap-2 py-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                {isProfit ? (
                  <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <TrendingUp className="size-5" />
                  </div>
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                    <TrendingDown className="size-5" />
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Résultat de l&apos;exercice
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Produits − Charges
                  </p>
                </div>
              </div>
              <p
                className={cn(
                  "font-mono text-2xl font-bold",
                  isProfit
                    ? "text-emerald-700 dark:text-emerald-300"
                    : "text-rose-700 dark:text-rose-300",
                )}
              >
                {formatFCFA(resultat)}
              </p>
            </CardContent>
          </Card>

          {/* Détails par section */}
          <div className="grid gap-4 lg:grid-cols-2">
            <BilanDetailTable
              title="Actif — détail"
              section={bilan.actif}
              accent="emerald"
            />
            <BilanDetailTable
              title="Passif — détail"
              section={bilan.passif}
              accent="amber"
            />
            <BilanDetailTable
              title="Produits — détail"
              section={bilan.produits}
              accent="emerald"
            />
            <BilanDetailTable
              title="Charges — détail"
              section={bilan.charges}
              accent="rose"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function BilanCard({
  title,
  total,
  icon: Icon,
  accent,
}: {
  title: string;
  total: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: "emerald" | "amber" | "rose";
}) {
  const cls: Record<string, string> = {
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  };
  return (
    <Card>
      <CardContent className="flex items-center justify-between py-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <p className="mt-1 font-mono text-xl font-bold">{formatFCFA(total)}</p>
        </div>
        <div
          className={cn(
            "flex size-10 items-center justify-center rounded-full",
            cls[accent],
          )}
        >
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function BilanDetailTable({
  title,
  section,
  accent,
}: {
  title: string;
  section: BilanResult["actif"];
  accent: "emerald" | "amber" | "rose";
}) {
  const headerCls: Record<string, string> = {
    emerald:
      "text-emerald-700 dark:text-emerald-300",
    amber: "text-amber-700 dark:text-amber-300",
    rose: "text-rose-700 dark:text-rose-300",
  };
  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-muted/30 py-3">
        <CardTitle className={cn("text-sm", headerCls[accent])}>
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {section.comptes.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">
            Aucun compte mouvementé.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/20">
                  <TableHead className="pl-4 text-[11px] uppercase">N°</TableHead>
                  <TableHead className="text-[11px] uppercase">Libellé</TableHead>
                  <TableHead className="text-right text-[11px] uppercase">
                    Montant
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {section.comptes.map((c) => (
                  <TableRow key={c.compte_id}>
                    <TableCell className="pl-4 font-mono text-xs">
                      {c.numero}
                    </TableCell>
                    <TableCell className="text-xs">{c.libelle}</TableCell>
                    <TableCell className="text-right font-mono text-xs">
                      {formatFCFA(c.montant)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell colSpan={2} className="text-right text-xs">
                    Total
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono text-xs",
                      headerCls[accent],
                    )}
                  >
                    {formatFCFA(section.total)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// États partagés
// ─────────────────────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
        <AlertCircle className="size-6" />
      </div>
      <div>
        <p className="text-sm font-medium">Erreur de chargement</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Le backend n&apos;a pas pu répondre. Réessayez ou vérifiez votre
          connexion.
        </p>
      </div>
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
      <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CheckCircle2 className="size-6" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
