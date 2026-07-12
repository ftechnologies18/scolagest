"use client";

/**
 * ScolaGest — Tableau de bord paie enseignants (module Phase C).
 *
 * Vue réservée à la direction et aux directeurs (études / superviseur).
 * Deux onglets :
 *
 *  1. « Bulletins de paie » : filtre mois/année (défaut = période courante),
 *     bouton « Générer un bulletin » (dialog select enseignant + mois + année),
 *     tableau des bulletins (enseignant nom+matricule, mois/année, heures
 *     pointées/planifiées, taux moyen, salaire brut, avances, cotisations,
 *     salaire net, statut badge coloré, actions). Actions selon statut :
 *       - BROUILLON → « Valider » (dialog champ cotisations)
 *       - VALIDE    → « Marquer payé » (dialog champ référence)
 *       - PAYE      → badge date de paiement
 *     Bouton « Voir détail » (dialog avec tous les détails).
 *     Si `alerte_ecart` retournée à la génération → toast warning.
 *
 *  2. « Avances sur salaire » : bouton « Nouvelle avance » (dialog select
 *     enseignant + montant + motif), tableau des avances (enseignant, montant,
 *     date demande, motif, statut badge, actions), filtre par statut. Actions
 *     pour DEMANDEE : « Approuver » + « Rejeter » (dialog motif rejet).
 *
 * États : pas d'établissement (amber), chargement (skeletons), erreur (carte
 * rose + retry), vide (emerald).
 *
 * Le contexte d'établissement vient de `useAuthStore`. Si aucun établissement
 * n'est sélectionné, on invite l'utilisateur à en choisir un.
 */

import * as React from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Wallet,
  RefreshCw,
  AlertCircle,
  Plus,
  Loader2,
  Eye,
  CheckCircle2,
  Banknote,
  ThumbsUp,
  ThumbsDown,
  HandCoins,
  CalendarDays,
  GraduationCap,
  TriangleAlert,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchBulletins,
  fetchBulletin,
  generateBulletin,
  validerBulletin,
  payerBulletin,
  fetchAvances,
  createAvance,
  traiterAvance,
  STATUT_BULLETIN_LABEL,
  STATUT_AVANCE_LABEL,
  MOIS_LABELS,
  moisLabel,
  type BulletinPaie,
  type AvanceSalaire,
  type StatutBulletin,
  type StatutAvance,
  type GenerateBulletinResult,
} from "@/lib/api-paie";
import { fetchEnseignants, type Enseignant } from "@/lib/api-enseignant";
import {
  formatFCFA,
  formatDateShort,
  formatDateTime,
} from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ─────────────────────────────────────────────────────────────────────────────
// Clés React Query
// ─────────────────────────────────────────────────────────────────────────────

export const paieKeys = {
  all: ["paie"] as const,
  bulletins: (params: { mois?: number; annee?: number }) =>
    [...paieKeys.all, "bulletins", params] as const,
  bulletin: (id: string) => [...paieKeys.all, "bulletin", id] as const,
  avances: (statut?: StatutAvance) =>
    [...paieKeys.all, "avances", { statut }] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers d'affichage
// ─────────────────────────────────────────────────────────────────────────────

const STATUT_BULLETIN_BADGE: Record<StatutBulletin, string> = {
  BROUILLON:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  VALIDE:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  PAYE:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
};

const STATUT_AVANCE_BADGE: Record<StatutAvance, string> = {
  DEMANDEE:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  APPROUVEE:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300",
  REJETEE:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
  DEDUITE:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
};

const STATUT_AVANCE_OPTIONS: StatutAvance[] = [
  "DEMANDEE",
  "APPROUVEE",
  "REJETEE",
  "DEDUITE",
];

function enseignantLabel(
  e?: { nom?: string; prenoms?: string; matricule?: string } | null,
): { nom: string; matricule: string } {
  if (!e) return { nom: "—", matricule: "" };
  const nom = [e.prenoms, e.nom].filter(Boolean).join(" ").trim() || "—";
  return { nom, matricule: e.matricule ?? "" };
}

/** Renvoie le mois courant (1-12) et l'année courante. */
function currentMonthYear(): { mois: number; annee: number } {
  const d = new Date();
  return { mois: d.getMonth() + 1, annee: d.getFullYear() };
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function PaieDashboard() {
  const etablissement = useAuthStore((s) => s.etablissement);

  if (!etablissement) {
    return (
      <PaieShell>
        <EmptyState
          icon={AlertCircle}
          tone="amber"
          title="Sélectionnez un établissement"
          description="Choisissez un établissement dans la barre latérale pour accéder à la gestion de la paie enseignants."
        />
      </PaieShell>
    );
  }

  return (
    <PaieShell>
      <Tabs defaultValue="bulletins" className="w-full">
        <TabsList className="h-auto">
          <TabsTrigger value="bulletins" className="gap-1.5">
            <Wallet className="size-4" />
            Bulletins de paie
          </TabsTrigger>
          <TabsTrigger value="avances" className="gap-1.5">
            <HandCoins className="size-4" />
            Avances sur salaire
          </TabsTrigger>
        </TabsList>
        <TabsContent value="bulletins" className="mt-4">
          <BulletinsTab />
        </TabsContent>
        <TabsContent value="avances" className="mt-4">
          <AvancesTab />
        </TabsContent>
      </Tabs>
    </PaieShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell commun
// ─────────────────────────────────────────────────────────────────────────────

function PaieShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <Wallet className="size-6 text-emerald-600" />
          Paie enseignants
        </h1>
        <p className="text-sm text-muted-foreground">
          Génération des bulletins de paie mensuels et suivi des avances sur
          salaire des enseignants.
        </p>
      </header>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet 1 : Bulletins de paie
// ─────────────────────────────────────────────────────────────────────────────

function BulletinsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initial = currentMonthYear();
  const [mois, setMois] = React.useState<number>(initial.mois);
  const [annee, setAnnee] = React.useState<number>(initial.annee);

  const [generateOpen, setGenerateOpen] = React.useState(false);
  const [validerTarget, setValiderTarget] =
    React.useState<BulletinPaie | null>(null);
  const [payerTarget, setPayerTarget] = React.useState<BulletinPaie | null>(null);
  const [detailTarget, setDetailTarget] = React.useState<BulletinPaie | null>(
    null,
  );

  const {
    data: bulletins,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: paieKeys.bulletins({ mois, annee }),
    queryFn: () => fetchBulletins({ mois, annee }),
    refetchOnWindowFocus: true,
  });

  // ─── Mutation : générer un bulletin ──────────────────────────────────────
  const generateMutation = useMutation({
    mutationFn: (body: {
      enseignant_id: string;
      mois: number;
      annee: number;
    }) => generateBulletin(body),
    onSuccess: async (res: GenerateBulletinResult) => {
      await queryClient.invalidateQueries({ queryKey: paieKeys.all });
      // Alerte d'écart → toast warning (en plus du toast succès).
      if (res.alerte_ecart) {
        toast({
          title: "Bulletin généré — écart détecté",
          description: res.alerte_ecart,
        });
      } else {
        toast({
          title: "Bulletin généré",
          description: `Bulletin de ${moisLabel(res.bulletin.mois)} ${res.bulletin.annee} créé avec succès.`,
        });
      }
      setGenerateOpen(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de générer ce bulletin.",
        variant: "destructive",
      });
    },
  });

  // ─── Mutation : valider un bulletin (BROUILLON → VALIDE) ────────────────
  const validerMutation = useMutation({
    mutationFn: ({ id, cotisations }: { id: string; cotisations: number }) =>
      validerBulletin(id, cotisations),
    onSuccess: async (b: BulletinPaie) => {
      await queryClient.invalidateQueries({ queryKey: paieKeys.all });
      toast({
        title: "Bulletin validé",
        description: `Bulletin de ${moisLabel(b.mois)} ${b.annee} passé en statut « Validé ».`,
      });
      setValiderTarget(null);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de valider ce bulletin.",
        variant: "destructive",
      });
    },
  });

  // ─── Mutation : marquer payé (VALIDE → PAYE) ────────────────────────────
  const payerMutation = useMutation({
    mutationFn: ({ id, reference }: { id: string; reference: string }) =>
      payerBulletin(id, reference),
    onSuccess: async (b: BulletinPaie) => {
      await queryClient.invalidateQueries({ queryKey: paieKeys.all });
      toast({
        title: "Bulletin payé",
        description: `Paiement enregistré pour ${moisLabel(b.mois)} ${b.annee}.`,
      });
      setPayerTarget(null);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible d'enregistrer ce paiement.",
        variant: "destructive",
      });
    },
  });

  // Liste d'années utiles (année courante - 2 → +1)
  const annees = React.useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 2, current - 1, current, current + 1];
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Barre de filtres */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            <Select
              value={String(mois)}
              onValueChange={(v) => setMois(Number(v))}
            >
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOIS_LABELS.map((label, idx) => (
                  <SelectItem key={idx + 1} value={String(idx + 1)}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={String(annee)}
              onValueChange={(v) => setAnnee(Number(v))}
            >
              <SelectTrigger className="w-full sm:w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {annees.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="font-medium">
              {(bulletins ?? []).length} bulletin
              {(bulletins ?? []).length > 1 ? "s" : ""}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Actualiser"
            >
              <RefreshCw
                className={cn("size-4", isFetching && "animate-spin")}
              />
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setGenerateOpen(true)}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Générer un bulletin</span>
              <span className="sm:hidden">Générer</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contenu : tableau / skeleton / empty / error */}
      {isLoading ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : isError ? (
        <EmptyState
          icon={AlertCircle}
          tone="rose"
          title="Erreur de chargement"
          description={
            error instanceof Error
              ? error.message
              : "Impossible de charger les bulletins. Vérifiez que le backend est démarré puis réessayez."
          }
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="size-4" />
              Réessayer
            </Button>
          }
        />
      ) : (bulletins ?? []).length === 0 ? (
        <EmptyState
          icon={Wallet}
          tone="emerald"
          title="Aucun bulletin pour cette période"
          description={`Aucun bulletin n'a été généré pour ${moisLabel(mois).toLowerCase()} ${annee}. Cliquez sur « Générer un bulletin » pour en créer un.`}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Enseignant</TableHead>
                    <TableHead>Période</TableHead>
                    <TableHead className="text-center">Heures pt.</TableHead>
                    <TableHead className="text-center">Heures pl.</TableHead>
                    <TableHead className="text-right">Taux moy.</TableHead>
                    <TableHead className="text-right">Brut</TableHead>
                    <TableHead className="text-right">Avances</TableHead>
                    <TableHead className="text-right">Cotis.</TableHead>
                    <TableHead className="text-right">Net</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(bulletins ?? []).map((b) => {
                    const ens = enseignantLabel(b.enseignant);
                    return (
                      <TableRow key={b.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{ens.nom}</span>
                            {ens.matricule ? (
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {ens.matricule}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          <span className="font-medium">
                            {moisLabel(b.mois)}
                          </span>{" "}
                          {b.annee}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {b.heures_pointees.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-center tabular-nums text-muted-foreground">
                          {b.heures_planifiees.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {formatFCFA(b.taux_horaire_moyen)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {formatFCFA(b.salaire_brut)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-amber-700 dark:text-amber-300">
                          -{formatFCFA(b.total_avances)}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-rose-700 dark:text-rose-300">
                          -{formatFCFA(b.cotisations)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold tabular-nums">
                          {formatFCFA(b.salaire_net)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-medium",
                              STATUT_BULLETIN_BADGE[b.statut],
                            )}
                          >
                            {STATUT_BULLETIN_LABEL[b.statut]}
                          </Badge>
                          {b.statut === "PAYE" && b.date_paie ? (
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              {formatDateShort(b.date_paie)}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDetailTarget(b)}
                              aria-label="Voir le détail"
                            >
                              <Eye className="size-3.5" />
                              <span className="sr-only">Détail</span>
                            </Button>
                            {b.statut === "BROUILLON" ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setValiderTarget(b)}
                                className="gap-1 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-300"
                              >
                                <CheckCircle2 className="size-3.5" />
                                <span className="hidden sm:inline">Valider</span>
                              </Button>
                            ) : null}
                            {b.statut === "VALIDE" ? (
                              <Button
                                size="sm"
                                onClick={() => setPayerTarget(b)}
                                className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                              >
                                <Banknote className="size-3.5" />
                                <span className="hidden sm:inline">Marquer payé</span>
                                <span className="sm:hidden">Payer</span>
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog : générer un bulletin */}
      <GenerateBulletinDialog
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSubmit={(body) => generateMutation.mutate(body)}
        isPending={generateMutation.isPending}
        defaultMois={mois}
        defaultAnnee={annee}
      />

      {/* Dialog : valider un bulletin (cotisations) */}
      <ValiderBulletinDialog
        bulletin={validerTarget}
        onClose={() => setValiderTarget(null)}
        onSubmit={(cotisations) => {
          if (!validerTarget) return;
          validerMutation.mutate({
            id: validerTarget.id,
            cotisations,
          });
        }}
        isPending={validerMutation.isPending}
      />

      {/* Dialog : marquer payé (référence) */}
      <PayerBulletinDialog
        bulletin={payerTarget}
        onClose={() => setPayerTarget(null)}
        onSubmit={(reference) => {
          if (!payerTarget) return;
          payerMutation.mutate({ id: payerTarget.id, reference });
        }}
        isPending={payerMutation.isPending}
      />

      {/* Dialog : détail du bulletin */}
      <BulletinDetailDialog
        bulletin={detailTarget}
        onClose={() => setDetailTarget(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet 2 : Avances sur salaire
// ─────────────────────────────────────────────────────────────────────────────

function AvancesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statut, setStatut] = React.useState<StatutAvance | "all">("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [rejeterTarget, setRejeterTarget] =
    React.useState<AvanceSalaire | null>(null);

  const {
    data: avances,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: paieKeys.avances(statut !== "all" ? statut : undefined),
    queryFn: () => fetchAvances(statut !== "all" ? statut : undefined),
    refetchOnWindowFocus: true,
  });

  // ─── Mutation : créer une avance ─────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (body: {
      enseignant_id: string;
      montant: number;
      motif?: string;
    }) => createAvance(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: paieKeys.all });
      toast({
        title: "Avance enregistrée",
        description: "La demande d'avance a été créée avec succès.",
      });
      setCreateOpen(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible d'enregistrer cette avance.",
        variant: "destructive",
      });
    },
  });

  // ─── Mutation : traiter une avance (approuver/rejeter) ───────────────────
  const traiterMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: { approuver: boolean; motif_rejet?: string };
    }) => traiterAvance(id, body),
    onSuccess: async (a: AvanceSalaire, vars) => {
      await queryClient.invalidateQueries({ queryKey: paieKeys.all });
      toast({
        title: vars.body.approuver ? "Avance approuvée" : "Avance rejetée",
        description: `La demande d'avance a été ${
          vars.body.approuver ? "approuvée" : "rejetée"
        } avec succès.`,
      });
      setRejeterTarget(null);
      void a;
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de traiter cette avance.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="flex flex-col gap-4">
      {/* Barre de filtres */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <HandCoins className="size-4 text-muted-foreground" />
            <Select
              value={statut}
              onValueChange={(v) => setStatut(v as StatutAvance | "all")}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {STATUT_AVANCE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUT_AVANCE_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="font-medium">
              {(avances ?? []).length} avance
              {(avances ?? []).length > 1 ? "s" : ""}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Actualiser"
            >
              <RefreshCw
                className={cn("size-4", isFetching && "animate-spin")}
              />
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Nouvelle avance</span>
              <span className="sm:hidden">Nouvelle</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contenu : tableau / skeleton / empty / error */}
      {isLoading ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : isError ? (
        <EmptyState
          icon={AlertCircle}
          tone="rose"
          title="Erreur de chargement"
          description={
            error instanceof Error
              ? error.message
              : "Impossible de charger les avances. Vérifiez que le backend est démarré puis réessayez."
          }
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="size-4" />
              Réessayer
            </Button>
          }
        />
      ) : (avances ?? []).length === 0 ? (
        <EmptyState
          icon={HandCoins}
          tone="emerald"
          title="Aucune avance"
          description="Aucune demande d'avance sur salaire ne correspond au filtre sélectionné."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Enseignant</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Date demande</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(avances ?? []).map((a) => {
                    const ens = enseignantLabel(a.enseignant);
                    return (
                      <TableRow key={a.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{ens.nom}</span>
                            {ens.matricule ? (
                              <span className="font-mono text-[11px] text-muted-foreground">
                                {ens.matricule}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold tabular-nums">
                          {formatFCFA(a.montant)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                          {formatDateShort(a.date_demande)}
                        </TableCell>
                        <TableCell className="max-w-[260px] text-sm">
                          {a.motif ? (
                            <span className="line-clamp-2 text-muted-foreground">
                              {a.motif}
                            </span>
                          ) : (
                            <span className="text-xs italic text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-medium",
                              STATUT_AVANCE_BADGE[a.statut],
                            )}
                          >
                            {STATUT_AVANCE_LABEL[a.statut]}
                          </Badge>
                          {a.date_approbation ? (
                            <div className="mt-0.5 text-[10px] text-muted-foreground">
                              {formatDateShort(a.date_approbation)}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right">
                          {a.statut === "DEMANDEE" ? (
                            <div className="flex flex-wrap justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  traiterMutation.mutate({
                                    id: a.id,
                                    body: { approuver: true },
                                  })
                                }
                                disabled={traiterMutation.isPending}
                                className="gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-300"
                              >
                                <ThumbsUp className="size-3.5" />
                                <span className="hidden sm:inline">Approuver</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRejeterTarget(a)}
                                className="gap-1 border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300"
                              >
                                <ThumbsDown className="size-3.5" />
                                <span className="hidden sm:inline">Rejeter</span>
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog : créer une avance */}
      <CreateAvanceDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={(body) => createMutation.mutate(body)}
        isPending={createMutation.isPending}
      />

      {/* Dialog : rejeter une avance (motif) */}
      <RejeterAvanceDialog
        avance={rejeterTarget}
        onClose={() => setRejeterTarget(null)}
        onSubmit={(motif_rejet) => {
          if (!rejeterTarget) return;
          traiterMutation.mutate({
            id: rejeterTarget.id,
            body: { approuver: false, motif_rejet },
          });
        }}
        isPending={traiterMutation.isPending}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook partagé : charge la liste des enseignants pour les selects
// ─────────────────────────────────────────────────────────────────────────────

function useEnseignantsActifs(enabled: boolean) {
  return useQuery({
    queryKey: ["enseignants", "list", { all: true, paie: true }] as const,
    queryFn: () => fetchEnseignants({}),
    enabled,
  });
}

function EnseignantSelect({
  value,
  onChange,
  enseignants,
  loading,
  disabled,
  id,
}: {
  value: string;
  onChange: (id: string) => void;
  enseignants: Enseignant[] | undefined;
  loading: boolean;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id}>
        <SelectValue
          placeholder={
            loading ? "Chargement…" : "Sélectionnez un enseignant"
          }
        />
      </SelectTrigger>
      <SelectContent>
        {(enseignants ?? []).length === 0 ? (
          <SelectItem value="__none" disabled>
            Aucun enseignant
          </SelectItem>
        ) : (
          (enseignants ?? []).map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {[e.prenoms, e.nom].filter(Boolean).join(" ").trim() ||
                e.matricule}
              {e.matricule ? ` — ${e.matricule}` : ""}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog : générer un bulletin
// ─────────────────────────────────────────────────────────────────────────────

function GenerateBulletinDialog({
  open,
  onClose,
  onSubmit,
  isPending,
  defaultMois,
  defaultAnnee,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: {
    enseignant_id: string;
    mois: number;
    annee: number;
  }) => void;
  isPending: boolean;
  defaultMois: number;
  defaultAnnee: number;
}) {
  const etablissement = useAuthStore((s) => s.etablissement);
  const [enseignantId, setEnseignantId] = React.useState("");
  const [mois, setMois] = React.useState<number>(defaultMois);
  const [annee, setAnnee] = React.useState<number>(defaultAnnee);
  const [submitted, setSubmitted] = React.useState(false);

  const { data: enseignants, isLoading: loadingEnseignants } =
    useEnseignantsActifs(!!etablissement && open);

  // Réinitialise le formulaire à l'ouverture.
  React.useEffect(() => {
    if (open) {
      setEnseignantId("");
      setMois(defaultMois);
      setAnnee(defaultAnnee);
      setSubmitted(false);
    }
  }, [open, defaultMois, defaultAnnee]);

  const valid = enseignantId !== "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    onSubmit({ enseignant_id: enseignantId, mois, annee });
  }

  const annees = React.useMemo(() => {
    const current = new Date().getFullYear();
    return [current - 2, current - 1, current, current + 1];
  }, []);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-5 text-emerald-600" />
            Générer un bulletin de paie
          </DialogTitle>
          <DialogDescription>
            Le bulletin sera généré à partir des pointages validés de
            l&apos;enseignant pour le mois sélectionné.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="gen-enseignant">
              Enseignant <span className="text-rose-600">*</span>
            </Label>
            <EnseignantSelect
              id="gen-enseignant"
              value={enseignantId}
              onChange={setEnseignantId}
              enseignants={enseignants}
              loading={loadingEnseignants}
            />
            {submitted && !valid ? (
              <p className="text-xs text-rose-600">
                Veuillez sélectionner un enseignant.
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gen-mois">Mois</Label>
              <Select
                value={String(mois)}
                onValueChange={(v) => setMois(Number(v))}
              >
                <SelectTrigger id="gen-mois">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MOIS_LABELS.map((label, idx) => (
                    <SelectItem key={idx + 1} value={String(idx + 1)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="gen-annee">Année</Label>
              <Select
                value={String(annee)}
                onValueChange={(v) => setAnnee(Number(v))}
              >
                <SelectTrigger id="gen-annee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {annees.map((a) => (
                    <SelectItem key={a} value={String(a)}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <TriangleAlert className="mb-1 inline size-3.5" />
            Si un écart est détecté entre les heures planifiées et pointées,
            un avertissement sera affiché après la génération.
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isPending || !valid}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Wallet className="size-4" />
              )}
              Générer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog : valider un bulletin (cotisations)
// ─────────────────────────────────────────────────────────────────────────────

function ValiderBulletinDialog({
  bulletin,
  onClose,
  onSubmit,
  isPending,
}: {
  bulletin: BulletinPaie | null;
  onClose: () => void;
  onSubmit: (cotisations: number) => void;
  isPending: boolean;
}) {
  const open = bulletin !== null;
  const [cotisations, setCotisations] = React.useState("0");
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    if (bulletin) {
      setCotisations(String(bulletin.cotisations ?? 0));
      setSubmitted(false);
    }
  }, [bulletin]);

  const montant = Number(cotisations);
  const valid = !Number.isNaN(montant) && montant >= 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    onSubmit(montant);
  }

  const netApercu =
    bulletin && valid
      ? bulletin.salaire_brut - bulletin.total_avances - montant
      : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-amber-600" />
            Valider le bulletin
          </DialogTitle>
          <DialogDescription>
            {bulletin
              ? `Bulletin de ${moisLabel(bulletin.mois)} ${bulletin.annee} — ${enseignantLabel(bulletin.enseignant).nom}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {bulletin ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="rounded-md border border-muted bg-muted/30 p-3 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Salaire brut</span>
                <span className="font-medium tabular-nums">
                  {formatFCFA(bulletin.salaire_brut)}
                </span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Avances déduites</span>
                <span className="font-medium tabular-nums text-amber-700 dark:text-amber-300">
                  -{formatFCFA(bulletin.total_avances)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="val-cotisations">
                Cotisations à déduire <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="val-cotisations"
                type="number"
                min={0}
                step="100"
                value={cotisations}
                onChange={(e) => setCotisations(e.target.value)}
                placeholder="0"
                aria-describedby="val-cotisations-help"
                required
              />
              <p id="val-cotisations-help" className="text-[11px] text-muted-foreground">
                Montant en FCFA. Sera déduit du salaire net.
              </p>
              {submitted && !valid ? (
                <p className="text-xs text-rose-600">
                  Montant invalide.
                </p>
              ) : null}
            </div>

            <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <div className="flex justify-between">
                <span className="font-medium text-emerald-800 dark:text-emerald-300">
                  Salaire net à payer
                </span>
                <span className="font-bold tabular-nums text-emerald-800 dark:text-emerald-300">
                  {formatFCFA(netApercu)}
                </span>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isPending}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isPending || !valid}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-4" />
                )}
                Valider le bulletin
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog : marquer payé (référence)
// ─────────────────────────────────────────────────────────────────────────────

function PayerBulletinDialog({
  bulletin,
  onClose,
  onSubmit,
  isPending,
}: {
  bulletin: BulletinPaie | null;
  onClose: () => void;
  onSubmit: (reference: string) => void;
  isPending: boolean;
}) {
  const open = bulletin !== null;
  const [reference, setReference] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    if (bulletin) {
      setReference(bulletin.reference_paiement ?? "");
      setSubmitted(false);
    }
  }, [bulletin]);

  const valid = reference.trim().length >= 2;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    onSubmit(reference.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="size-5 text-emerald-600" />
            Marquer comme payé
          </DialogTitle>
          <DialogDescription>
            {bulletin
              ? `Bulletin de ${moisLabel(bulletin.mois)} ${bulletin.annee} — ${enseignantLabel(bulletin.enseignant).nom}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {bulletin ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="rounded-md border border-muted bg-muted/30 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net à payer</span>
                <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatFCFA(bulletin.salaire_net)}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay-ref">
                Référence de paiement{" "}
                <span className="text-rose-600">*</span>
              </Label>
              <Input
                id="pay-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Ex : TRF-2026-001234, ESP-12/03…"
                maxLength={100}
                required
              />
              {submitted && !valid ? (
                <p className="text-xs text-rose-600">
                  Saisissez au moins 2 caractères.
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isPending}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isPending || !valid}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Banknote className="size-4" />
                )}
                Confirmer le paiement
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog : créer une avance
// ─────────────────────────────────────────────────────────────────────────────

function CreateAvanceDialog({
  open,
  onClose,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: {
    enseignant_id: string;
    montant: number;
    motif?: string;
  }) => void;
  isPending: boolean;
}) {
  const etablissement = useAuthStore((s) => s.etablissement);
  const [enseignantId, setEnseignantId] = React.useState("");
  const [montant, setMontant] = React.useState("");
  const [motif, setMotif] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  const { data: enseignants, isLoading: loadingEnseignants } =
    useEnseignantsActifs(!!etablissement && open);

  React.useEffect(() => {
    if (open) {
      setEnseignantId("");
      setMontant("");
      setMotif("");
      setSubmitted(false);
    }
  }, [open]);

  const montantNum = Number(montant);
  const valid =
    enseignantId !== "" && !Number.isNaN(montantNum) && montantNum > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    onSubmit({
      enseignant_id: enseignantId,
      montant: montantNum,
      motif: motif.trim() || undefined,
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandCoins className="size-5 text-emerald-600" />
            Nouvelle avance sur salaire
          </DialogTitle>
          <DialogDescription>
            Enregistrez une demande d&apos;avance qui sera déduite du prochain
            bulletin de paie de l&apos;enseignant.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="av-enseignant">
              Enseignant <span className="text-rose-600">*</span>
            </Label>
            <EnseignantSelect
              id="av-enseignant"
              value={enseignantId}
              onChange={setEnseignantId}
              enseignants={enseignants}
              loading={loadingEnseignants}
            />
            {submitted && enseignantId === "" ? (
              <p className="text-xs text-rose-600">
                Veuillez sélectionner un enseignant.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="av-montant">
              Montant (FCFA) <span className="text-rose-600">*</span>
            </Label>
            <Input
              id="av-montant"
              type="number"
              min={1}
              step="500"
              value={montant}
              onChange={(e) => setMontant(e.target.value)}
              placeholder="Ex : 25000"
              required
            />
            {submitted && (Number.isNaN(montantNum) || montantNum <= 0) ? (
              <p className="text-xs text-rose-600">
                Saisissez un montant supérieur à 0.
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="av-motif">Motif (optionnel)</Label>
            <Textarea
              id="av-motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex : avance pour frais médicaux, urgence familiale…"
              rows={3}
              maxLength={500}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isPending || !valid}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <HandCoins className="size-4" />
              )}
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog : rejeter une avance (motif)
// ─────────────────────────────────────────────────────────────────────────────

function RejeterAvanceDialog({
  avance,
  onClose,
  onSubmit,
  isPending,
}: {
  avance: AvanceSalaire | null;
  onClose: () => void;
  onSubmit: (motif: string) => void;
  isPending: boolean;
}) {
  const open = avance !== null;
  const [motif, setMotif] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    if (avance) {
      setMotif("");
      setSubmitted(false);
    }
  }, [avance]);

  const valid = motif.trim().length >= 3;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if (!valid) return;
    onSubmit(motif.trim());
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ThumbsDown className="size-5 text-rose-600" />
            Rejeter la demande d&apos;avance
          </DialogTitle>
          <DialogDescription>
            {avance
              ? `${enseignantLabel(avance.enseignant).nom} — ${formatFCFA(avance.montant)}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {avance ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {avance.motif ? (
              <div className="rounded-md border border-muted bg-muted/30 p-3 text-xs">
                <p className="text-muted-foreground">Motif de la demande :</p>
                <p className="mt-1 text-foreground">{avance.motif}</p>
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rej-motif">
                Motif du rejet <span className="text-rose-600">*</span>
              </Label>
              <Textarea
                id="rej-motif"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="Ex : montant trop élevé, demande hors politique d'avance…"
                rows={3}
                maxLength={500}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                {motif.length}/500 caractères. Minimum 3 caractères.
              </p>
              {submitted && !valid ? (
                <p className="text-xs text-rose-600">
                  Le motif doit contenir au moins 3 caractères.
                </p>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isPending}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isPending || !valid}
                variant="destructive"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ThumbsDown className="size-4" />
                )}
                Confirmer le rejet
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog : détail du bulletin (récupère la version fraîche)
// ─────────────────────────────────────────────────────────────────────────────

function BulletinDetailDialog({
  bulletin,
  onClose,
}: {
  bulletin: BulletinPaie | null;
  onClose: () => void;
}) {
  const open = bulletin !== null;
  const { data, isLoading, isError, error } = useQuery({
    queryKey: paieKeys.bulletin(bulletin?.id ?? ""),
    queryFn: () => fetchBulletin(bulletin!.id),
    enabled: !!bulletin,
  });

  const b = data ?? bulletin;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="size-5 text-emerald-600" />
            Détail du bulletin
          </DialogTitle>
          <DialogDescription>
            {b
              ? `${enseignantLabel(b.enseignant).nom} — ${moisLabel(b.mois)} ${b.annee}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
            {error instanceof Error
              ? error.message
              : "Impossible de charger les détails de ce bulletin."}
          </div>
        ) : b ? (
          <div className="flex flex-col gap-4">
            {/* En-tête enseignant */}
            <div className="flex items-center gap-3 rounded-md border border-muted bg-muted/30 p-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <GraduationCap className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {enseignantLabel(b.enseignant).nom}
                </p>
                {enseignantLabel(b.enseignant).matricule ? (
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {enseignantLabel(b.enseignant).matricule}
                  </p>
                ) : null}
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "font-medium",
                  STATUT_BULLETIN_BADGE[b.statut],
                )}
              >
                {STATUT_BULLETIN_LABEL[b.statut]}
              </Badge>
            </div>

            {/* Période & sessions */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <DetailItem
                label="Période"
                value={`${moisLabel(b.mois)} ${b.annee}`}
              />
              <DetailItem
                label="Sessions pointées"
                value={`${b.nb_sessions_pointees} / ${b.nb_sessions_total}`}
              />
              <DetailItem
                label="Heures pointées"
                value={`${b.heures_pointees.toFixed(1)} h`}
              />
              <DetailItem
                label="Heures planifiées"
                value={`${b.heures_planifiees.toFixed(1)} h`}
              />
            </div>

            {/* Calcul du salaire */}
            <div className="rounded-md border border-muted">
              <div className="flex items-center justify-between border-b border-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">Taux horaire moyen</span>
                <span className="font-medium tabular-nums">
                  {formatFCFA(b.taux_horaire_moyen)}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">Salaire brut</span>
                <span className="font-medium tabular-nums">
                  {formatFCFA(b.salaire_brut)}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  Avances déduites
                </span>
                <span className="font-medium tabular-nums text-amber-700 dark:text-amber-300">
                  -{formatFCFA(b.total_avances)}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  Cotisations sociales
                </span>
                <span className="font-medium tabular-nums text-rose-700 dark:text-rose-300">
                  -{formatFCFA(b.cotisations)}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-3">
                <span className="font-semibold">Salaire net à payer</span>
                <span className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatFCFA(b.salaire_net)}
                </span>
              </div>
            </div>

            {/* Métadonnées (validation / paiement) */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {b.date_validation ? (
                <DetailItem
                  label="Validé le"
                  value={formatDateTime(b.date_validation)}
                />
              ) : null}
              {b.valide_par ? (
                <DetailItem label="Validé par" value={b.valide_par} />
              ) : null}
              {b.date_paie ? (
                <DetailItem
                  label="Payé le"
                  value={formatDateTime(b.date_paie)}
                />
              ) : null}
              {b.reference_paiement ? (
                <DetailItem
                  label="Référence paiement"
                  value={b.reference_paiement}
                  mono
                />
              ) : null}
            </div>

            {b.notes ? (
              <div className="rounded-md border border-muted bg-muted/30 p-3 text-xs">
                <p className="font-medium text-foreground">Notes</p>
                <p className="mt-1 text-muted-foreground">{b.notes}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-medium",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// États vides / erreur partagés
// ─────────────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: typeof AlertCircle;
  tone: "emerald" | "amber" | "rose" | "slate";
  title: string;
  description: string;
  action?: React.ReactNode;
}

const EMPTY_TONE: Record<EmptyStateProps["tone"], string> = {
  emerald:
    "border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
  amber:
    "border-amber-200 bg-amber-50/60 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
  rose:
    "border-rose-200 bg-rose-50/60 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300",
  slate:
    "border-slate-200 bg-slate-50/60 text-slate-700 dark:border-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
};

function EmptyState({
  icon: Icon,
  tone,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed", EMPTY_TONE[tone])}>
      <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-full",
            EMPTY_TONE[tone],
          )}
        >
          <Icon className="size-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        {action ? <div className="mt-2">{action}</div> : null}
      </CardContent>
    </Card>
  );
}
