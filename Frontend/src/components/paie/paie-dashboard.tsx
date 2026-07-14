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
 * Refonte Forêt EdTech :
 *  - Hero header GlassCard desktop + KentePattern strip top + badge rond
 *    gradient emerald→gold (Wallet) + pill « Phase C » + pill établissement.
 *  - TabsList premium : glass-desktop subtile + tab actif bg-emerald-600
 *    text-white + icônes (Wallet / HandCoins).
 *  - 4 StatCards DS pour chaque onglet (Bulletins : emerald / forest / gold /
 *    amber ; Avances : emerald / amber / sky / terracotta) avec stagger.
 *  - Tableaux enrichis : GlassCard adaptive noHover p-0 + header bg-
 *    emerald-50/60 + hover row bg-emerald-50/60 + avatar emerald-600 initiales
 *    + badges renforcés (border-300 bg-100 text-800) + salaire net text-gold-
 *    dark font-bold + boutons avec title natif + motion.tr stagger.
 *  - Cartes mobile (md:hidden) : GlassCard mobile p-4 + avatar size-11 +
 *    InfoRows + actions icône-seules (h-11 w-11, touch target ≥ 44px).
 *  - Dialogs premium : badge gradient + GlassCard tablet + footer grid-cols-2
 *    + bouton submit variant success.
 *  - Empty states premium : KentePattern bg + badges ronds colorés.
 *  - Loading state premium : Skeletons + KentePattern strip top.
 *
 * États : pas d'établissement (amber), chargement (skeletons), erreur (carte
 * rose + retry), vide (emerald).
 *
 * Le contexte d'établissement vient de `useAuthStore`. Si aucun établissement
 * n'est sélectionné, on invite l'utilisateur à en choisir un.
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query (paieKeys.bulletins / bulletin /
 * avances + clés ["enseignants", "list", { all: true, paie: true }]),
 * mutations (generateMutation / validerMutation / payerMutation /
 * createMutation / traiterMutation) + invalidateQueries, types BulletinPaie /
 * AvanceSalaire / StatutBulletin / StatutAvance / GenerateBulletinResult,
 * constantes STATUT_BULLETIN_LABEL / STATUT_AVANCE_LABEL / MOIS_LABELS /
 * STATUT_BULLETIN_BADGE / STATUT_AVANCE_BADGE / STATUT_AVANCE_OPTIONS
 * (contrastes renforcés visuellement mais sémantiquement identiques), helpers
 * enseignantLabel / enseignantInitials / currentMonthYear / moisLabel,
 * handlers et toasts conservés. Aucun endpoint backend touché.
 */

import * as React from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { motion } from "framer-motion";
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
  Clock,
  type LucideIcon,
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
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { StatCard } from "@/components/ds/stat-card";

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

// Contrastes renforcés (BUG À ÉVITER #7) : border-300 bg-100 text-800.
const STATUT_BULLETIN_BADGE: Record<StatutBulletin, string> = {
  BROUILLON:
    "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
  VALIDE:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200",
  PAYE:
    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200",
};

const STATUT_AVANCE_BADGE: Record<StatutAvance, string> = {
  DEMANDEE:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200",
  APPROUVEE:
    "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-200",
  REJETEE:
    "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200",
  DEDUITE:
    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200",
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

/** Initiales (max 2 lettres) pour l'avatar d'un enseignant. */
function enseignantInitials(
  e?: { nom?: string; prenoms?: string } | null,
): string {
  if (!e) return "?";
  const pre = (e.prenoms ?? "").trim();
  const nom = (e.nom ?? "").trim();
  const a = pre ? pre[0]! : "";
  const b = nom ? nom[0]! : "";
  const init = (a + b).toUpperCase();
  return init || "?";
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
    <PaieShell etablissementNom={etablissement.nom}>
      <Tabs defaultValue="bulletins" className="w-full">
        <TabsList className="glass-desktop h-auto gap-1 border-0 p-1">
          <TabsTrigger
            value="bulletins"
            className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <Wallet className="size-4" />
            Bulletins de paie
          </TabsTrigger>
          <TabsTrigger
            value="avances"
            className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
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
// Shell (hero header premium + KentePattern strip / separator)
// ─────────────────────────────────────────────────────────────────────────────

function PaieShell({
  children,
  etablissementNom,
}: {
  children: React.ReactNode;
  etablissementNom?: string;
}) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <KentePattern variant="strip" position="top" />

      {/* ─── Hero header premium ──────────────────────────────────────── */}
      <GlassCard variant="desktop" noHover premiumBorder className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Badge rond gradient emerald→gold avec icône Wallet */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <Wallet className="size-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                  Paie enseignants
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Génération des bulletins de paie mensuels et suivi des avances
                sur salaire des enseignants.
              </p>
              {etablissementNom ? (
                <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {etablissementNom}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </GlassCard>

      <KentePattern variant="separator" className="my-1" />

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
  const prefersReducedMotion = usePrefersReducedMotion();
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

  // ─── KPIs calculés sur la liste des bulletins ────────────────────────────
  const list = bulletins ?? [];
  const kpis = React.useMemo(() => {
    let valides = 0;
    let payes = 0;
    let brouillons = 0;
    let netTotal = 0;
    for (const b of list) {
      if (b.statut === "VALIDE") valides += 1;
      else if (b.statut === "PAYE") payes += 1;
      else if (b.statut === "BROUILLON") brouillons += 1;
      netTotal += b.salaire_net;
    }
    return { total: list.length, valides, payes, brouillons, netTotal };
  }, [list]);

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Barre de filtres ─────────────────────────────────────────────── */}
      <GlassCard variant="adaptive" noHover noAnimation className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" />
            <Select
              value={String(mois)}
              onValueChange={(v) => setMois(Number(v))}
            >
              <SelectTrigger
                className="w-full bg-background sm:w-40"
                aria-label="Mois"
              >
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
              <SelectTrigger
                className="w-full bg-background sm:w-28"
                aria-label="Année"
              >
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
            <Badge
              variant="outline"
              className="tabular-nums border-emerald-300 bg-emerald-100 font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
            >
              {list.length} bulletin{list.length > 1 ? "s" : ""}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Actualiser"
              title="Actualiser la liste des bulletins"
            >
              <RefreshCw
                className={cn("size-4", isFetching && "animate-spin")}
              />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="success"
              onClick={() => setGenerateOpen(true)}
              className="w-full gap-1.5 sm:w-auto"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Générer un bulletin</span>
              <span className="sm:hidden">Générer</span>
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ─── 4 StatCards de résumé ────────────────────────────────────────── */}
      <section
        aria-label="Résumé des bulletins"
        className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4"
      >
        <StatCard
          icon={Wallet}
          tone="emerald"
          label="Total bulletins"
          value={kpis.total}
          hint={
            isLoading
              ? "chargement…"
              : `pour ${moisLabel(mois).toLowerCase()} ${annee}`
          }
          delay={0}
          className="h-full"
        />
        <StatCard
          icon={Clock}
          tone="amber"
          label="Brouillons"
          value={kpis.brouillons}
          hint="en attente de validation"
          delay={0.05}
          className="h-full"
        />
        <StatCard
          icon={CheckCircle2}
          tone="forest"
          label="Validés"
          value={kpis.valides}
          hint="prêts à payer"
          delay={0.1}
          className="h-full"
        />
        <StatCard
          icon={Banknote}
          tone="gold"
          label="Payés"
          value={kpis.payes}
          hint={`net : ${formatFCFA(kpis.netTotal)}`}
          delay={0.15}
          className="h-full"
        />
      </section>

      <KentePattern variant="separator" className="my-1" />

      {/* ─── Contenu : tableau / skeleton / empty / error ─────────────────── */}
      {isLoading ? (
        <LoadingState />
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              title="Réessayer le chargement"
            >
              <RefreshCw className="size-4" />
              Réessayer
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Wallet}
          tone="emerald"
          title="Aucun bulletin pour cette période"
          description={`Aucun bulletin n'a été généré pour ${moisLabel(mois).toLowerCase()} ${annee}. Cliquez sur « Générer un bulletin » pour en créer un.`}
          action={
            <Button
              variant="success"
              size="sm"
              onClick={() => setGenerateOpen(true)}
              className="w-full sm:w-auto"
            >
              <Plus className="size-4" />
              Générer un bulletin
            </Button>
          }
        />
      ) : (
        <>
          {/* ─── Tableau desktop (md:block, hidden on mobile) ───────────── */}
          <GlassCard
            variant="adaptive"
            noHover
            noAnimation
            premiumBorder
            className="hidden overflow-hidden p-0 md:block"
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <TableHead className="min-w-[180px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Enseignant
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Période
                    </TableHead>
                    <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Heures pt.
                    </TableHead>
                    <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Heures pl.
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Taux moy.
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Brut
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Avances
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Cotis.
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Net
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Statut
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((b, idx) => (
                    <BulletinRow
                      key={b.id}
                      bulletin={b}
                      index={idx}
                      prefersReducedMotion={prefersReducedMotion}
                      onDetail={() => setDetailTarget(b)}
                      onValider={() => setValiderTarget(b)}
                      onPayer={() => setPayerTarget(b)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </GlassCard>

          {/* ─── Cartes mobile (md:hidden) ────────────────────────────── */}
          <div className="space-y-3 md:hidden">
            {list.map((b, idx) => (
              <BulletinMobileCard
                key={b.id}
                bulletin={b}
                index={idx}
                prefersReducedMotion={prefersReducedMotion}
                onDetail={() => setDetailTarget(b)}
                onValider={() => setValiderTarget(b)}
                onPayer={() => setPayerTarget(b)}
              />
            ))}
          </div>
        </>
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
// Ligne du tableau Bulletins (motion.tr avec stagger delay index*0.02)
// ─────────────────────────────────────────────────────────────────────────────

function BulletinRow({
  bulletin: b,
  index,
  prefersReducedMotion,
  onDetail,
  onValider,
  onPayer,
}: {
  bulletin: BulletinPaie;
  index: number;
  prefersReducedMotion: boolean;
  onDetail: () => void;
  onValider: () => void;
  onPayer: () => void;
}) {
  const ens = enseignantLabel(b.enseignant);
  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.3,
          delay: Math.min(index * 0.02, 0.4),
          ease: [0.22, 1, 0.36, 1] as const,
        },
      };
  return (
    <motion.tr
      data-slot="table-row"
      className="hover:bg-emerald-50/60 border-b transition-colors dark:hover:bg-emerald-950/20"
      {...motionProps}
    >
      {/* Enseignant : avatar emerald-600 + nom font-display + matricule mono */}
      <TableCell>
        <div className="flex items-center gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white"
            aria-hidden="true"
          >
            {enseignantInitials(b.enseignant)}
          </div>
          <div className="min-w-0">
            <div className="break-words font-display text-sm font-semibold leading-snug text-forest">
              {ens.nom}
            </div>
            {ens.matricule ? (
              <div className="font-mono text-[11px] text-muted-foreground">
                {ens.matricule}
              </div>
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm">
        <span className="font-medium text-forest">{moisLabel(b.mois)}</span>{" "}
        <span className="text-muted-foreground">{b.annee}</span>
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
      <TableCell className="text-right text-sm font-bold tabular-nums text-gold-dark dark:text-gold">
        {formatFCFA(b.salaire_net)}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={cn("font-medium", STATUT_BULLETIN_BADGE[b.statut])}
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
            onClick={onDetail}
            title="Voir le détail du bulletin"
            aria-label={`Voir le détail du bulletin de ${ens.nom}`}
          >
            <Eye className="size-3.5" />
            <span className="hidden lg:inline">Détail</span>
          </Button>
          {b.statut === "BROUILLON" ? (
            <Button
              size="sm"
              variant="outline"
              onClick={onValider}
              title="Valider ce bulletin (saisie des cotisations)"
              aria-label={`Valider le bulletin de ${ens.nom}`}
              className="gap-1 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-300"
            >
              <CheckCircle2 className="size-3.5" />
              <span className="hidden lg:inline">Valider</span>
            </Button>
          ) : null}
          {b.statut === "VALIDE" ? (
            <Button
              size="sm"
              variant="success"
              onClick={onPayer}
              title="Marquer ce bulletin comme payé"
              aria-label={`Marquer payé le bulletin de ${ens.nom}`}
              className="gap-1"
            >
              <Banknote className="size-3.5" />
              <span className="hidden lg:inline">Marquer payé</span>
              <span className="lg:hidden">Payer</span>
            </Button>
          ) : null}
        </div>
      </TableCell>
    </motion.tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carte mobile Bulletin (motion.div + GlassCard mobile)
// ─────────────────────────────────────────────────────────────────────────────

function BulletinMobileCard({
  bulletin: b,
  index,
  prefersReducedMotion,
  onDetail,
  onValider,
  onPayer,
}: {
  bulletin: BulletinPaie;
  index: number;
  prefersReducedMotion: boolean;
  onDetail: () => void;
  onValider: () => void;
  onPayer: () => void;
}) {
  const ens = enseignantLabel(b.enseignant);
  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.35,
          delay: Math.min(index * 0.05, 0.4),
          ease: [0.22, 1, 0.36, 1] as const,
        },
      };
  return (
    <motion.div className="rounded-2xl" {...motionProps}>
      <GlassCard variant="mobile" noHover noAnimation className="p-4">
        {/* En-tête */}
        <div className="flex items-start gap-3">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white"
            aria-hidden="true"
          >
            {enseignantInitials(b.enseignant)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="break-words font-display text-base font-semibold leading-snug text-forest">
              {ens.nom}
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {ens.matricule || "—"}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn("font-medium", STATUT_BULLETIN_BADGE[b.statut])}
          >
            {STATUT_BULLETIN_LABEL[b.statut]}
          </Badge>
        </div>

        {/* Body : période + heures + taux + brut + net */}
        <div className="mt-3 space-y-2 border-t pt-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="flex size-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <CalendarDays className="size-3" />
            </span>
            <span className="font-medium text-forest">
              {moisLabel(b.mois)} {b.annee}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="flex size-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
                <Clock className="size-3" />
              </span>
              Heures pt. / pl.
            </span>
            <span className="font-mono font-medium tabular-nums">
              {b.heures_pointees.toFixed(1)} / {b.heures_planifiees.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="flex size-6 items-center justify-center rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300">
                <HandCoins className="size-3" />
              </span>
              Avances / Cotis.
            </span>
            <span className="font-mono tabular-nums text-amber-700 dark:text-amber-300">
              -{formatFCFA(b.total_avances)}{" "}
              <span className="text-rose-700 dark:text-rose-300">
                / -{formatFCFA(b.cotisations)}
              </span>
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 border-t pt-2 text-xs">
            <span className="flex items-center gap-2 font-medium text-forest">
              <span className="flex size-6 items-center justify-center rounded-md bg-gold/15 text-gold-dark">
                <Wallet className="size-3" />
              </span>
              Net à payer
            </span>
            <span className="font-mono text-base font-bold text-gold-dark dark:text-gold">
              {formatFCFA(b.salaire_net)}
            </span>
          </div>
        </div>

        {/* Footer : actions */}
        <div className="mt-3 flex justify-end gap-1.5 border-t pt-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onDetail}
            className="h-11 w-11 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
            title="Voir le détail du bulletin"
            aria-label={`Voir le détail du bulletin de ${ens.nom}`}
          >
            <Eye className="size-4" />
          </Button>
          {b.statut === "BROUILLON" ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onValider}
              className="h-11 w-11 text-amber-700 hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-950/40"
              title="Valider ce bulletin"
              aria-label={`Valider le bulletin de ${ens.nom}`}
            >
              <CheckCircle2 className="size-4" />
            </Button>
          ) : null}
          {b.statut === "VALIDE" ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onPayer}
              className="h-11 w-11 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              title="Marquer ce bulletin comme payé"
              aria-label={`Marquer payé le bulletin de ${ens.nom}`}
            >
              <Banknote className="size-4" />
            </Button>
          ) : null}
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet 2 : Avances sur salaire
// ─────────────────────────────────────────────────────────────────────────────

function AvancesTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const prefersReducedMotion = usePrefersReducedMotion();
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

  // ─── KPIs calculés sur la liste des avances ──────────────────────────────
  const list = avances ?? [];
  const kpis = React.useMemo(() => {
    let demandees = 0;
    let approuvees = 0;
    let rejetees = 0;
    let deduites = 0;
    let montantDemandees = 0;
    for (const a of list) {
      if (a.statut === "DEMANDEE") {
        demandees += 1;
        montantDemandees += a.montant;
      } else if (a.statut === "APPROUVEE") approuvees += 1;
      else if (a.statut === "REJETEE") rejetees += 1;
      else if (a.statut === "DEDUITE") deduites += 1;
    }
    return {
      total: list.length,
      demandees,
      approuvees,
      rejetees,
      deduites,
      montantDemandees,
    };
  }, [list]);

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Barre de filtres ─────────────────────────────────────────────── */}
      <GlassCard variant="adaptive" noHover noAnimation className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <HandCoins className="size-4 text-muted-foreground" />
            <Select
              value={statut}
              onValueChange={(v) => setStatut(v as StatutAvance | "all")}
            >
              <SelectTrigger
                className="w-full bg-background sm:w-48"
                aria-label="Filtrer par statut"
              >
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
            <Badge
              variant="outline"
              className="tabular-nums border-emerald-300 bg-emerald-100 font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
            >
              {list.length} avance{list.length > 1 ? "s" : ""}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Actualiser"
              title="Actualiser la liste des avances"
            >
              <RefreshCw
                className={cn("size-4", isFetching && "animate-spin")}
              />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="success"
              onClick={() => setCreateOpen(true)}
              className="w-full gap-1.5 sm:w-auto"
            >
              <Plus className="size-4" />
              <span className="hidden sm:inline">Nouvelle avance</span>
              <span className="sm:hidden">Nouvelle</span>
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ─── 4 StatCards de résumé ────────────────────────────────────────── */}
      <section
        aria-label="Résumé des avances"
        className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4"
      >
        <StatCard
          icon={HandCoins}
          tone="emerald"
          label="Total avances"
          value={kpis.total}
          hint={isLoading ? "chargement…" : "demandes enregistrées"}
          delay={0}
          className="h-full"
        />
        <StatCard
          icon={Clock}
          tone="amber"
          label="Demandées"
          value={kpis.demandees}
          hint={`montant : ${formatFCFA(kpis.montantDemandees)}`}
          delay={0.05}
          className="h-full"
        />
        <StatCard
          icon={ThumbsUp}
          tone="sky"
          label="Approuvées"
          value={kpis.approuvees}
          hint="à déduire du prochain bulletin"
          delay={0.1}
          className="h-full"
        />
        <StatCard
          icon={ThumbsDown}
          tone="terracotta"
          label="Rejetées"
          value={kpis.rejetees}
          hint="demandes refusées"
          delay={0.15}
          className="h-full"
        />
      </section>

      <KentePattern variant="separator" className="my-1" />

      {/* ─── Contenu : tableau / skeleton / empty / error ─────────────────── */}
      {isLoading ? (
        <LoadingState />
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              title="Réessayer le chargement"
            >
              <RefreshCw className="size-4" />
              Réessayer
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={HandCoins}
          tone="emerald"
          title="Aucune avance"
          description="Aucune demande d'avance sur salaire ne correspond au filtre sélectionné."
          action={
            <Button
              variant="success"
              size="sm"
              onClick={() => setCreateOpen(true)}
              className="w-full sm:w-auto"
            >
              <Plus className="size-4" />
              Nouvelle avance
            </Button>
          }
        />
      ) : (
        <>
          {/* ─── Tableau desktop (md:block, hidden on mobile) ───────────── */}
          <GlassCard
            variant="adaptive"
            noHover
            noAnimation
            premiumBorder
            className="hidden overflow-hidden p-0 md:block"
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                    <TableHead className="min-w-[180px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Enseignant
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Montant
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Date demande
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Motif
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Statut
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((a, idx) => (
                    <AvanceRow
                      key={a.id}
                      avance={a}
                      index={idx}
                      prefersReducedMotion={prefersReducedMotion}
                      onApprouver={() =>
                        traiterMutation.mutate({
                          id: a.id,
                          body: { approuver: true },
                        })
                      }
                      approuverPending={traiterMutation.isPending}
                      onRejeter={() => setRejeterTarget(a)}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </GlassCard>

          {/* ─── Cartes mobile (md:hidden) ────────────────────────────── */}
          <div className="space-y-3 md:hidden">
            {list.map((a, idx) => (
              <AvanceMobileCard
                key={a.id}
                avance={a}
                index={idx}
                prefersReducedMotion={prefersReducedMotion}
                onApprouver={() =>
                  traiterMutation.mutate({
                    id: a.id,
                    body: { approuver: true },
                  })
                }
                approuverPending={traiterMutation.isPending}
                onRejeter={() => setRejeterTarget(a)}
              />
            ))}
          </div>
        </>
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
// Ligne du tableau Avances (motion.tr avec stagger delay index*0.02)
// ─────────────────────────────────────────────────────────────────────────────

function AvanceRow({
  avance: a,
  index,
  prefersReducedMotion,
  onApprouver,
  approuverPending,
  onRejeter,
}: {
  avance: AvanceSalaire;
  index: number;
  prefersReducedMotion: boolean;
  onApprouver: () => void;
  approuverPending: boolean;
  onRejeter: () => void;
}) {
  const ens = enseignantLabel(a.enseignant);
  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.3,
          delay: Math.min(index * 0.02, 0.4),
          ease: [0.22, 1, 0.36, 1] as const,
        },
      };
  return (
    <motion.tr
      data-slot="table-row"
      className="hover:bg-emerald-50/60 border-b transition-colors dark:hover:bg-emerald-950/20"
      {...motionProps}
    >
      {/* Enseignant : avatar emerald-600 + nom font-display + matricule mono */}
      <TableCell>
        <div className="flex items-center gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white"
            aria-hidden="true"
          >
            {enseignantInitials(a.enseignant)}
          </div>
          <div className="min-w-0">
            <div className="break-words font-display text-sm font-semibold leading-snug text-forest">
              {ens.nom}
            </div>
            {ens.matricule ? (
              <div className="font-mono text-[11px] text-muted-foreground">
                {ens.matricule}
              </div>
            ) : null}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right text-sm font-bold tabular-nums text-gold-dark dark:text-gold">
        {formatFCFA(a.montant)}
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
        {formatDateShort(a.date_demande)}
      </TableCell>
      <TableCell className="max-w-[260px] text-sm">
        {a.motif ? (
          <span className="line-clamp-2 break-words leading-snug text-muted-foreground">
            {a.motif}
          </span>
        ) : (
          <span className="text-xs italic text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={cn("font-medium", STATUT_AVANCE_BADGE[a.statut])}
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
              onClick={onApprouver}
              disabled={approuverPending}
              title="Approuver cette avance"
              aria-label={`Approuver l'avance de ${ens.nom}`}
              className="gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-300"
            >
              <ThumbsUp className="size-3.5" />
              <span className="hidden lg:inline">Approuver</span>
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onRejeter}
              title="Rejeter cette avance (motif requis)"
              aria-label={`Rejeter l'avance de ${ens.nom}`}
              className="gap-1 border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-300"
            >
              <ThumbsDown className="size-3.5" />
              <span className="hidden lg:inline">Rejeter</span>
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </motion.tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carte mobile Avance (motion.div + GlassCard mobile)
// ─────────────────────────────────────────────────────────────────────────────

function AvanceMobileCard({
  avance: a,
  index,
  prefersReducedMotion,
  onApprouver,
  approuverPending,
  onRejeter,
}: {
  avance: AvanceSalaire;
  index: number;
  prefersReducedMotion: boolean;
  onApprouver: () => void;
  approuverPending: boolean;
  onRejeter: () => void;
}) {
  const ens = enseignantLabel(a.enseignant);
  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.35,
          delay: Math.min(index * 0.05, 0.4),
          ease: [0.22, 1, 0.36, 1] as const,
        },
      };
  return (
    <motion.div className="rounded-2xl" {...motionProps}>
      <GlassCard variant="mobile" noHover noAnimation className="p-4">
        {/* En-tête */}
        <div className="flex items-start gap-3">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white"
            aria-hidden="true"
          >
            {enseignantInitials(a.enseignant)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="break-words font-display text-base font-semibold leading-snug text-forest">
              {ens.nom}
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">
              {ens.matricule || "—"}
            </p>
          </div>
          <Badge
            variant="outline"
            className={cn("font-medium", STATUT_AVANCE_BADGE[a.statut])}
          >
            {STATUT_AVANCE_LABEL[a.statut]}
          </Badge>
        </div>

        {/* Body : montant + date + motif */}
        <div className="mt-3 space-y-2 border-t pt-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="flex size-6 items-center justify-center rounded-md bg-gold/15 text-gold-dark">
                <Wallet className="size-3" />
              </span>
              Montant
            </span>
            <span className="font-mono text-base font-bold text-gold-dark dark:text-gold">
              {formatFCFA(a.montant)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex size-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <CalendarDays className="size-3" />
            </span>
            <span className="font-mono">{formatDateShort(a.date_demande)}</span>
          </div>
          {a.motif ? (
            <div className="flex items-start gap-2 text-xs">
              <span className="mt-0.5 flex size-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
                <HandCoins className="size-3" />
              </span>
              <span className="break-words leading-snug text-muted-foreground">
                {a.motif}
              </span>
            </div>
          ) : null}
        </div>

        {/* Footer : actions */}
        {a.statut === "DEMANDEE" ? (
          <div className="mt-3 flex justify-end gap-1.5 border-t pt-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onApprouver}
              disabled={approuverPending}
              className="h-11 w-11 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
              title="Approuver cette avance"
              aria-label={`Approuver l'avance de ${ens.nom}`}
            >
              {approuverPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ThumbsUp className="size-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onRejeter}
              className="h-11 w-11 text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
              title="Rejeter cette avance"
              aria-label={`Rejeter l'avance de ${ens.nom}`}
            >
              <ThumbsDown className="size-4" />
            </Button>
          </div>
        ) : null}
      </GlassCard>
    </motion.div>
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
      <SelectTrigger id={id} className="bg-background">
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
// Dialog : générer un bulletin (premium avec badge gradient)
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
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-md shadow-emerald-900/20">
              <Wallet className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="font-display text-lg font-bold tracking-tight text-forest">
                Générer un bulletin de paie
              </DialogTitle>
              <DialogDescription>
                Le bulletin sera généré à partir des pointages validés de
                l&apos;enseignant pour le mois sélectionné.
              </DialogDescription>
            </div>
          </div>
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
                <SelectTrigger id="gen-mois" className="bg-background">
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
                <SelectTrigger id="gen-annee" className="bg-background">
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

          <div className="rounded-md border border-amber-300 bg-amber-100/80 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Si un écart est détecté entre les heures planifiées et pointées,
                un avertissement sera affiché après la génération.
              </span>
            </div>
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="success"
              disabled={isPending || !valid}
              className="w-full sm:w-auto"
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
// Dialog : valider un bulletin (cotisations) — premium
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
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-md shadow-emerald-900/20">
              <CheckCircle2 className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="font-display text-lg font-bold tracking-tight text-forest">
                Valider le bulletin
              </DialogTitle>
              <DialogDescription>
                {bulletin
                  ? `Bulletin de ${moisLabel(bulletin.mois)} ${bulletin.annee} — ${enseignantLabel(bulletin.enseignant).nom}`
                  : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {bulletin ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <GlassCard variant="tablet" noHover noAnimation className="p-3">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Salaire brut</span>
                <span className="font-medium tabular-nums">
                  {formatFCFA(bulletin.salaire_brut)}
                </span>
              </div>
              <div className="mt-1 flex justify-between text-xs">
                <span className="text-muted-foreground">Avances déduites</span>
                <span className="font-medium tabular-nums text-amber-700 dark:text-amber-300">
                  -{formatFCFA(bulletin.total_avances)}
                </span>
              </div>
            </GlassCard>

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
                className="bg-background"
              />
              <p
                id="val-cotisations-help"
                className="text-[11px] text-muted-foreground"
              >
                Montant en FCFA. Sera déduit du salaire net.
              </p>
              {submitted && !valid ? (
                <p className="text-xs text-rose-600">Montant invalide.</p>
              ) : null}
            </div>

            <div className="rounded-md border border-emerald-300 bg-emerald-100/80 p-3 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
              <div className="flex justify-between">
                <span className="font-medium">Salaire net à payer</span>
                <span className="font-bold tabular-nums">
                  {formatFCFA(netApercu)}
                </span>
              </div>
            </div>

            <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isPending}
                className="w-full sm:w-auto"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="success"
                disabled={isPending || !valid}
                className="w-full sm:w-auto"
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
// Dialog : marquer payé (référence) — premium
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
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-md shadow-emerald-900/20">
              <Banknote className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="font-display text-lg font-bold tracking-tight text-forest">
                Marquer comme payé
              </DialogTitle>
              <DialogDescription>
                {bulletin
                  ? `Bulletin de ${moisLabel(bulletin.mois)} ${bulletin.annee} — ${enseignantLabel(bulletin.enseignant).nom}`
                  : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {bulletin ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <GlassCard variant="tablet" noHover noAnimation className="p-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Net à payer</span>
                <span className="font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                  {formatFCFA(bulletin.salaire_net)}
                </span>
              </div>
            </GlassCard>

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
                className="bg-background"
              />
              {submitted && !valid ? (
                <p className="text-xs text-rose-600">
                  Saisissez au moins 2 caractères.
                </p>
              ) : null}
            </div>

            <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isPending}
                className="w-full sm:w-auto"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="success"
                disabled={isPending || !valid}
                className="w-full sm:w-auto"
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
// Dialog : créer une avance — premium
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
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-md shadow-emerald-900/20">
              <HandCoins className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="font-display text-lg font-bold tracking-tight text-forest">
                Nouvelle avance sur salaire
              </DialogTitle>
              <DialogDescription>
                Enregistrez une demande d&apos;avance qui sera déduite du
                prochain bulletin de paie de l&apos;enseignant.
              </DialogDescription>
            </div>
          </div>
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
              className="bg-background"
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
              className="bg-background"
            />
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="success"
              disabled={isPending || !valid}
              className="w-full sm:w-auto"
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
// Dialog : rejeter une avance (motif) — premium
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
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-md shadow-rose-900/20">
              <ThumbsDown className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="font-display text-lg font-bold tracking-tight text-forest">
                Rejeter la demande d&apos;avance
              </DialogTitle>
              <DialogDescription>
                {avance
                  ? `${enseignantLabel(avance.enseignant).nom} — ${formatFCFA(avance.montant)}`
                  : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {avance ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {avance.motif ? (
              <GlassCard variant="tablet" noHover noAnimation className="p-3">
                <p className="text-xs text-muted-foreground">
                  Motif de la demande :
                </p>
                <p className="mt-1 break-words leading-snug text-foreground">
                  {avance.motif}
                </p>
              </GlassCard>
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
                className="bg-background"
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

            <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isPending}
                className="w-full sm:w-auto"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isPending || !valid}
                className="w-full sm:w-auto"
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
// Dialog : détail du bulletin (récupère la version fraîche) — premium
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
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-md shadow-emerald-900/20">
              <Wallet className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="font-display text-lg font-bold tracking-tight text-forest">
                Détail du bulletin
              </DialogTitle>
              <DialogDescription>
                {b
                  ? `${enseignantLabel(b.enseignant).nom} — ${moisLabel(b.mois)} ${b.annee}`
                  : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="rounded-md border border-rose-300 bg-rose-100 p-3 text-sm text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200">
            {error instanceof Error
              ? error.message
              : "Impossible de charger les détails de ce bulletin."}
          </div>
        ) : b ? (
          <div className="flex flex-col gap-4">
            {/* En-tête enseignant */}
            <GlassCard variant="tablet" noHover noAnimation className="p-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex size-10 items-center justify-center rounded-full bg-emerald-600 text-white"
                  aria-hidden="true"
                >
                  <GraduationCap className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-words font-display text-sm font-semibold leading-snug text-forest">
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
                  className={cn("font-medium", STATUT_BULLETIN_BADGE[b.statut])}
                >
                  {STATUT_BULLETIN_LABEL[b.statut]}
                </Badge>
              </div>
            </GlassCard>

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
            <GlassCard variant="tablet" noHover noAnimation className="p-0">
              <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Taux horaire moyen</span>
                <span className="font-medium tabular-nums">
                  {formatFCFA(b.taux_horaire_moyen)}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Salaire brut</span>
                <span className="font-medium tabular-nums">
                  {formatFCFA(b.salaire_brut)}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  Avances déduites
                </span>
                <span className="font-medium tabular-nums text-amber-700 dark:text-amber-300">
                  -{formatFCFA(b.total_avances)}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border/60 px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  Cotisations sociales
                </span>
                <span className="font-medium tabular-nums text-rose-700 dark:text-rose-300">
                  -{formatFCFA(b.cotisations)}
                </span>
              </div>
              <div className="flex items-center justify-between px-3 py-3">
                <span className="font-semibold text-forest">
                  Salaire net à payer
                </span>
                <span className="text-base font-bold tabular-nums text-gold-dark dark:text-gold">
                  {formatFCFA(b.salaire_net)}
                </span>
              </div>
            </GlassCard>

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
              <GlassCard variant="tablet" noHover noAnimation className="p-3">
                <p className="text-xs font-medium text-forest">Notes</p>
                <p className="mt-1 break-words leading-snug text-muted-foreground">
                  {b.notes}
                </p>
              </GlassCard>
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
          "text-sm font-medium text-forest",
          mono && "font-mono text-xs",
        )}
      >
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// États vides premium (KentePattern bg + badge rond coloré + icône Lucide)
// ─────────────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: LucideIcon;
  tone: "emerald" | "amber" | "rose";
  title: string;
  description: string;
  action?: React.ReactNode;
}

function EmptyState({ icon: Icon, tone, title, description, action }: EmptyStateProps) {
  const cls = {
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  }[tone];
  return (
    <GlassCard
      variant="adaptive"
      noHover
      className="relative overflow-hidden"
    >
      <KentePattern variant="bg" />
      <div className="relative flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-full",
            cls,
          )}
        >
          <Icon className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="font-display text-base font-semibold text-forest">
            {title}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        {action}
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading state premium (KentePattern strip top + 6 Skeletons rows)
// ─────────────────────────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <GlassCard
      variant="adaptive"
      noHover
      noAnimation
      className="relative overflow-hidden p-0"
    >
      <KentePattern variant="strip" position="top" />
      <div className="space-y-2 p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </GlassCard>
  );
}

export default PaieDashboard;
