"use client";

/**
 * ScolaGest — Tableau de bord discipline (module Phase B).
 *
 * Vue réservée au secrétariat / direction / directeurs. Deux onglets :
 *
 *  1. « Élèves à risque » : top des élèves signalés sur la période (7/30/90 j).
 *     Colonnes : élève (nom + prénoms), classe, nb tickets, nb profs différents
 *     (BADGE IMPORTANT — signaux venant de plusieurs enseignants), nb critiques,
 *     dernier ticket, statut « À convoquer » (badge rouge si a_convoquer) +
 *     bouton « Voir détails » qui ouvre un dialog listant les tickets de l'élève
 *     (fetchIncidentsEleve).
 *
 *  2. « Tickets » : tous les tickets d'incident (filtre par statut).
 *     Colonnes : date, élève, catégorie (badge), gravité (badge coloré), prof
 *     (ou « Anonyme »), statut, actions (« Traiter » → dialog avec select
 *     statut + textarea action prise → traiterIncident).
 *     Si gravité = CRITIQUE et statut = OUVERT → ligne en surbrillance rose.
 *
 * Refonte Forêt EdTech :
 *  - Hero header GlassCard desktop + KentePattern strip top + badge rond
 *    gradient emerald→gold (ShieldAlert) + pill « Phase B » + pill éta-
 *    blissement emerald.
 *  - TabsList premium : glass-desktop subtile + tab actif bg-emerald-600
 *    text-white + icônes.
 *  - 4 StatCards DS pour l'onglet Élèves à risque (emerald / terracotta /
 *    amber / gold) avec stagger.
 *  - Tableau Élèves à risque enrichi : GlassCard adaptive noHover p-0 +
 *    header bg-emerald-50/60 + hover row bg-emerald-50/60 + avatar initiales
 *    + nom font-display + badges renforcés (border-300 bg-100 text-800) +
 *    row « à convoquer » bg-rose-50/40 + bouton « Voir détails » avec title
 *    natif + motion.tr stagger.
 *  - Tableau Tickets enrichi : GlassCard adaptive noHover p-0 + header bg-
 *    emerald-50/60 + hover row bg-emerald-50/60 + badges gravité/statut/
 *    catégorie renforcés + row critique+ouvert en surbrillance + bouton
 *    « Traiter » avec title natif + motion.tr stagger.
 *  - Dialog traiter incident premium : badge gradient + GlassCard tablet pour
 *    le contenu + footer grid-cols-2 + bouton submit variant success.
 *  - Dialog détails élève premium : badge gradient + liste des tickets en
 *    cards mini avec badges renforcés.
 *  - Empty states premium : KentePattern bg + badges ronds colorés.
 *  - Loading state premium : Skeletons + KentePattern strip top.
 *
 * États : chargement (skeleton), erreur, vide.
 *
 * Le contexte d'établissement vient de `useAuthStore`. Si aucun établissement
 * n'est sélectionné, on invite l'utilisateur à en choisir un.
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query (disciplineKeys.elevesRisque /
 * incidents / incidentsEleve), mutations (traiterMutation) + invalidate-
 * Queries, types TicketIncident / EleveRisque / StatutTicket / GraviteIncident
 * / CategorieIncident / TraiterBody, constantes GRAVITE_BADGE / STATUT_BADGE /
 * CATEGORIE_BADGE / STATUT_OPTIONS / PERIODE_OPTIONS (contrastes renforcés
 * visuellement mais sémantiquement identiques), helpers eleveFullName,
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
  ShieldAlert,
  RefreshCw,
  AlertCircle,
  Users,
  Ticket,
  UserX,
  Loader2,
  Hand,
  MessageSquare,
  Eye,
  CalendarClock,
  Flame,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchIncidents,
  fetchElevesRisque,
  fetchIncidentsEleve,
  traiterIncident,
  CATEGORIE_LABEL,
  GRAVITE_LABEL,
  STATUT_TICKET_LABEL,
  type TicketIncident,
  type EleveRisque,
  type StatutTicket,
  type GraviteIncident,
  type CategorieIncident,
  type TraiterBody,
} from "@/lib/api-incident";
import { formatDate, formatDateShort, formatDateTime } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { StatCard } from "@/components/ds/stat-card";

// ─────────────────────────────────────────────────────────────────────────────
// Clés React Query
// ─────────────────────────────────────────────────────────────────────────────

export const disciplineKeys = {
  all: ["discipline"] as const,
  elevesRisque: (periode: number) =>
    [...disciplineKeys.all, "eleves-risque", periode] as const,
  incidents: (params: { statut?: StatutTicket }) =>
    [...disciplineKeys.all, "incidents", params] as const,
  incidentsEleve: (eleveId: string) =>
    [...disciplineKeys.all, "incidents-eleve", eleveId] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers d'affichage
// ─────────────────────────────────────────────────────────────────────────────

// Contrast renforcé (BUG À ÉVITER #7) : border-300 bg-100 text-800.
const GRAVITE_BADGE: Record<GraviteIncident, string> = {
  MINEUR:
    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200",
  MODERE:
    "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-200",
  SEVERE:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200",
  CRITIQUE:
    "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200",
};

const STATUT_BADGE: Record<StatutTicket, string> = {
  OUVERT:
    "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200",
  EN_COURS:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200",
  TRAITE:
    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200",
  CLOTURE:
    "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
  REJETE:
    "border-muted-foreground/30 bg-muted text-muted-foreground",
};

const CATEGORIE_BADGE: Record<CategorieIncident, string> = {
  ABSENTEISME:
    "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
  IMPOLITESSE:
    "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
  COMPORTEMENT:
    "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
  TRAVAIL:
    "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
  RETARD:
    "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
};

const STATUT_OPTIONS: StatutTicket[] = [
  "OUVERT",
  "EN_COURS",
  "TRAITE",
  "CLOTURE",
  "REJETE",
];

const PERIODE_OPTIONS: { value: number; label: string }[] = [
  { value: 7, label: "7 derniers jours" },
  { value: 30, label: "30 derniers jours" },
  { value: 90, label: "90 derniers jours" },
];

function eleveFullName(e: {
  nom?: string;
  prenoms?: string;
  eleve_nom?: string;
  eleve_prenoms?: string;
}): string {
  const nom = e.eleve_nom ?? e.nom ?? "";
  const prenoms = e.eleve_prenoms ?? e.prenoms ?? "";
  return [prenoms, nom].filter(Boolean).join(" ").trim() || "—";
}

/** Initiales (max 2 lettres) pour l'avatar d'un élève à risque. */
function eleveInitials(e: EleveRisque): string {
  const pre = (e.eleve_prenoms ?? "").trim();
  const nom = (e.eleve_nom ?? "").trim();
  const a = pre ? pre[0]! : "";
  const b = nom ? nom[0]! : "";
  const init = (a + b).toUpperCase();
  return init || "?";
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function DisciplineDashboard() {
  const etablissement = useAuthStore((s) => s.etablissement);

  if (!etablissement) {
    return (
      <DisciplineShell>
        <EmptyState
          icon={AlertCircle}
          tone="amber"
          title="Sélectionnez un établissement"
          description="Choisissez un établissement dans la barre latérale pour accéder au tableau de bord discipline."
        />
      </DisciplineShell>
    );
  }

  return (
    <DisciplineShell etablissementNom={etablissement.nom}>
      <Tabs defaultValue="eleves-risque" className="w-full">
        <TabsList className="glass-desktop h-auto gap-1 border-0 p-1">
          <TabsTrigger
            value="eleves-risque"
            className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <Users className="size-4" />
            Élèves à risque
          </TabsTrigger>
          <TabsTrigger
            value="tickets"
            className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <Ticket className="size-4" />
            Tickets
          </TabsTrigger>
        </TabsList>
        <TabsContent value="eleves-risque" className="mt-4">
          <ElevesRisqueTab />
        </TabsContent>
        <TabsContent value="tickets" className="mt-4">
          <TicketsTab />
        </TabsContent>
      </Tabs>
    </DisciplineShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell (hero header premium + KentePattern strip / separator)
// ─────────────────────────────────────────────────────────────────────────────

function DisciplineShell({
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
      <GlassCard variant="desktop" noHover className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Badge rond gradient emerald→gold avec icône ShieldAlert */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <ShieldAlert className="size-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                  Discipline
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50/60 px-2 py-0.5 align-middle text-[11px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <Sparkles className="size-3" />
                  Phase B
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Suivi des tickets d&apos;incident disciplinaire et identification
                des élèves à risque.
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
// Onglet 1 : Élèves à risque
// ─────────────────────────────────────────────────────────────────────────────

function ElevesRisqueTab() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [periode, setPeriode] = React.useState<number>(30);
  const [detailEleve, setDetailEleve] = React.useState<EleveRisque | null>(null);

  const {
    data: eleves,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: disciplineKeys.elevesRisque(periode),
    queryFn: () => fetchElevesRisque(periode),
    refetchOnWindowFocus: true,
  });

  // ─── KPIs calculés sur la liste des élèves à risque ──────────────────────
  const list = eleves ?? [];
  const kpis = React.useMemo(() => {
    let aConvoquer = 0;
    let multiProfs = 0;
    let critiques = 0;
    for (const e of list) {
      if (e.a_convoquer) aConvoquer += 1;
      if (e.nb_profs_differents >= 2) multiProfs += 1;
      critiques += e.nb_critiques;
    }
    return { total: list.length, aConvoquer, multiProfs, critiques };
  }, [list]);

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Filtre période ─────────────────────────────────────────────── */}
      <GlassCard variant="adaptive" noHover noAnimation className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <CalendarClock className="size-4 text-muted-foreground" />
            <span className="font-medium">Période d&apos;analyse</span>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={String(periode)}
              onValueChange={(v) => setPeriode(Number(v))}
            >
              <SelectTrigger className="w-full bg-background sm:w-52" aria-label="Période d'analyse">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIODE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={String(o.value)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Actualiser"
              title="Actualiser la liste des élèves à risque"
            >
              <RefreshCw
                className={cn("size-4", isFetching && "animate-spin")}
              />
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ─── 4 StatCards de résumé ────────────────────────────────────────── */}
      <section
        aria-label="Résumé des élèves à risque"
        className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4"
      >
        <StatCard
          icon={Users}
          tone="emerald"
          label="Total signalés"
          value={kpis.total}
          hint={isLoading ? "chargement…" : "élève(s) sur la période"}
          delay={0}
          className="h-full"
        />
        <StatCard
          icon={UserX}
          tone="terracotta"
          label="À convoquer"
          value={kpis.aConvoquer}
          hint="en attente de convocation"
          delay={0.05}
          className="h-full"
        />
        <StatCard
          icon={Flame}
          tone="amber"
          label="Multi-profs"
          value={kpis.multiProfs}
          hint="≥ 2 enseignants différents"
          delay={0.1}
          className="h-full"
        />
        <StatCard
          icon={AlertCircle}
          tone="gold"
          label="Critiques"
          value={kpis.critiques}
          hint="tickets graves cumulés"
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
              : "Impossible de charger les élèves à risque. Vérifiez que le backend est démarré puis réessayez."
          }
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()} title="Réessayer le chargement">
              <RefreshCw className="size-4" />
              Réessayer
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Users}
          tone="emerald"
          title="Aucun élève à risque"
          description="Aucun élève n'a été signalé sur la période sélectionnée. Tout va bien !"
        />
      ) : (
        <GlassCard
          variant="adaptive"
          noHover
          noAnimation
          className="overflow-hidden p-0"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <TableHead className="min-w-[180px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Élève
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Classe
                  </TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Tickets
                  </TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Profs diff.
                  </TableHead>
                  <TableHead className="text-center text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Critiques
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Dernier ticket
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
                {list.map((e, idx) => (
                  <EleveRisqueRow
                    key={e.eleve_id}
                    eleve={e}
                    index={idx}
                    prefersReducedMotion={prefersReducedMotion}
                    onDetail={() => setDetailEleve(e)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      )}

      {/* Dialog détails élève */}
      <EleveRisqueDetailDialog
        eleve={detailEleve}
        onClose={() => setDetailEleve(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ligne du tableau Élève à risque (motion.tr avec stagger delay index*0.02)
// ─────────────────────────────────────────────────────────────────────────────

function EleveRisqueRow({
  eleve: e,
  index,
  prefersReducedMotion,
  onDetail,
}: {
  eleve: EleveRisque;
  index: number;
  prefersReducedMotion: boolean;
  onDetail: () => void;
}) {
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
      className={cn(
        "hover:bg-emerald-50/60 border-b transition-colors dark:hover:bg-emerald-950/20",
        e.a_convoquer && "bg-rose-50/40 dark:bg-rose-950/20",
      )}
      {...motionProps}
    >
      {/* Élève : avatar emerald-600 text-white + nom font-display + ID mono */}
      <TableCell>
        <div className="flex items-center gap-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white"
            aria-hidden="true"
          >
            {eleveInitials(e)}
          </div>
          <div className="min-w-0">
            <div className="break-words font-display text-sm font-semibold leading-snug text-forest">
              {eleveFullName(e)}
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">
              {e.eleve_id.slice(0, 8)}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm">
        <span className="break-words leading-snug">
          {e.classe_libelle || "—"}
        </span>
      </TableCell>
      <TableCell className="text-center">
        <Badge
          variant="outline"
          className="tabular-nums border-slate-300 bg-slate-100 font-bold text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200"
        >
          {e.nb_tickets}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <Badge
          variant="outline"
          className={cn(
            "font-bold tabular-nums",
            e.nb_profs_differents >= 3
              ? "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200"
              : e.nb_profs_differents >= 2
                ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200"
                : "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
          )}
          title="Nombre d'enseignants différents ayant signalé cet élève"
        >
          {e.nb_profs_differents}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        {e.nb_critiques > 0 ? (
          <Badge
            variant="outline"
            className="gap-1 border-rose-300 bg-rose-100 font-bold text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200"
          >
            <Flame className="size-3" />
            {e.nb_critiques}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {e.dernier_ticket ? formatDateShort(e.dernier_ticket) : "—"}
      </TableCell>
      <TableCell>
        {e.a_convoquer ? (
          <Badge
            variant="outline"
            className="gap-1 border-rose-300 bg-rose-100 font-bold text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/60 dark:text-rose-200"
          >
            <UserX className="size-3" />
            À convoquer
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
          >
            Suivi normal
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          variant="outline"
          onClick={onDetail}
          title="Voir les détails de l'élève"
          aria-label={`Voir les détails de l'élève « ${eleveFullName(e)} »`}
        >
          <Eye className="size-3.5" />
          <span className="hidden sm:inline">Voir détails</span>
          <span className="sm:hidden">Détails</span>
        </Button>
      </TableCell>
    </motion.tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog : détails d'un élève à risque (premium avec badge gradient)
// ─────────────────────────────────────────────────────────────────────────────

function EleveRisqueDetailDialog({
  eleve,
  onClose,
}: {
  eleve: EleveRisque | null;
  onClose: () => void;
}) {
  const open = eleve !== null;
  const {
    data: tickets,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: disciplineKeys.incidentsEleve(eleve?.eleve_id ?? ""),
    queryFn: () => fetchIncidentsEleve(eleve!.eleve_id),
    enabled: !!eleve,
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-md shadow-emerald-900/20">
              <Users className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="font-display text-lg font-bold tracking-tight text-forest">
                {eleve ? eleveFullName(eleve) : "Détails élève"}
              </DialogTitle>
              <DialogDescription>
                Historique des tickets disciplinaires de l&apos;élève.
                {eleve?.classe_libelle
                  ? ` · Classe : ${eleve.classe_libelle}.`
                  : ""}
                {eleve
                  ? ` · ${eleve.nb_tickets} ticket(s) sur la période, ${eleve.nb_critiques} critique(s).`
                  : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-md border border-rose-300 bg-rose-100 p-3 text-sm text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-200">
              {error instanceof Error
                ? error.message
                : "Impossible de charger les tickets de cet élève."}
            </div>
          ) : (tickets ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed border-muted p-6 text-center text-sm text-muted-foreground">
              Aucun ticket enregistré pour cet élève.
            </div>
          ) : (
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
              {(tickets ?? []).map((t) => (
                <TicketLine key={t.id} ticket={t} compact />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet 2 : Tickets
// ─────────────────────────────────────────────────────────────────────────────

function TicketsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [statut, setStatut] = React.useState<StatutTicket | "all">("all");
  const [traiterTarget, setTraiterTarget] =
    React.useState<TicketIncident | null>(null);

  const {
    data: tickets,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: disciplineKeys.incidents({
      statut: statut !== "all" ? statut : undefined,
    }),
    queryFn: () =>
      fetchIncidents({
        statut: statut !== "all" ? statut : undefined,
      }),
    refetchOnWindowFocus: true,
  });

  // ─── Mutation : traiter un ticket ───────────────────────────────────────
  const traiterMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: TraiterBody }) =>
      traiterIncident(id, body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: disciplineKeys.all });
      toast({
        title: "Ticket traité",
        description: "Le ticket a été mis à jour avec succès.",
      });
      setTraiterTarget(null);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de traiter ce ticket.",
        variant: "destructive",
      });
    },
  });

  const list = tickets ?? [];

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Filtre statut ──────────────────────────────────────────────── */}
      <GlassCard variant="adaptive" noHover noAnimation className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Ticket className="size-4 text-muted-foreground" />
            <span className="font-medium">
              {list.length} ticket{list.length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={statut}
              onValueChange={(v) => setStatut(v as StatutTicket | "all")}
            >
              <SelectTrigger className="w-full bg-background sm:w-52" aria-label="Filtrer par statut">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                {STATUT_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUT_TICKET_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Actualiser"
              title="Actualiser la liste des tickets"
            >
              <RefreshCw
                className={cn("size-4", isFetching && "animate-spin")}
              />
            </Button>
          </div>
        </div>
      </GlassCard>

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
              : "Impossible de charger les tickets. Vérifiez que le backend est démarré puis réessayez."
          }
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()} title="Réessayer le chargement">
              <RefreshCw className="size-4" />
              Réessayer
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <EmptyState
          icon={Ticket}
          tone="emerald"
          title="Aucun ticket"
          description="Aucun ticket d'incident ne correspond au filtre sélectionné."
        />
      ) : (
        <GlassCard
          variant="adaptive"
          noHover
          noAnimation
          className="overflow-hidden p-0"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <TableHead className="min-w-[120px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Date
                  </TableHead>
                  <TableHead className="min-w-[160px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Élève
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Catégorie
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Gravité
                  </TableHead>
                  <TableHead className="min-w-[140px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Enseignant
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
                {list.map((t, idx) => {
                  const alerte =
                    t.gravite === "CRITIQUE" && t.statut === "OUVERT";
                  return (
                    <TicketRow
                      key={t.id}
                      ticket={t}
                      alerte={alerte}
                      index={idx}
                      prefersReducedMotion={prefersReducedMotion}
                      onTraiter={() => setTraiterTarget(t)}
                    />
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      )}

      {/* Dialog traiter ticket */}
      <TraiterTicketDialog
        ticket={traiterTarget}
        onClose={() => setTraiterTarget(null)}
        onSubmit={(body) => {
          if (!traiterTarget) return;
          traiterMutation.mutate({ id: traiterTarget.id, body });
        }}
        isPending={traiterMutation.isPending}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ligne du tableau Tickets (motion.tr avec stagger delay index*0.02)
// ─────────────────────────────────────────────────────────────────────────────

function TicketRow({
  ticket: t,
  alerte,
  index,
  prefersReducedMotion,
  onTraiter,
}: {
  ticket: TicketIncident;
  alerte: boolean;
  index: number;
  prefersReducedMotion: boolean;
  onTraiter: () => void;
}) {
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
  const cloteeOrRejetee =
    t.statut === "CLOTURE" || t.statut === "REJETE";
  return (
    <motion.tr
      data-slot="table-row"
      className={cn(
        "hover:bg-emerald-50/60 border-b transition-colors dark:hover:bg-emerald-950/20",
        alerte && "bg-rose-100/70 dark:bg-rose-950/40",
      )}
      {...motionProps}
    >
      <TableCell className="text-sm text-muted-foreground">
        {formatDateShort(t.date_incident)}
      </TableCell>
      {/* Élève : nom font-display + classe en sous-ligne */}
      <TableCell>
        <div className="flex flex-col">
          <span className="break-words font-display text-sm font-semibold leading-snug text-forest">
            {t.eleve ? eleveFullName(t.eleve) : "Élève inconnu"}
          </span>
          {t.classe?.libelle ? (
            <span className="text-[11px] text-muted-foreground">
              {t.classe.libelle}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={CATEGORIE_BADGE[t.categorie]}
        >
          {CATEGORIE_LABEL[t.categorie]}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={cn("gap-1 font-medium", GRAVITE_BADGE[t.gravite])}
        >
          {t.gravite === "CRITIQUE" ? (
            <Flame className="size-3" />
          ) : null}
          {GRAVITE_LABEL[t.gravite]}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">
        {t.anonyme ? (
          <span className="italic text-muted-foreground">Anonyme</span>
        ) : t.enseignant ? (
          <span className="line-clamp-1 break-words leading-snug">
            {eleveFullName(t.enseignant)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={cn("font-medium", STATUT_BADGE[t.statut])}
        >
          {STATUT_TICKET_LABEL[t.statut]}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          variant={cloteeOrRejetee ? "outline" : "success"}
          onClick={onTraiter}
          title={
            cloteeOrRejetee
              ? "Rouvrir / réexaminer ce ticket"
              : "Traiter ce ticket (statut + action prise)"
          }
          aria-label={`Traiter le ticket #${t.id.slice(0, 8)}`}
        >
          <Hand className="size-3.5" />
          <span className="hidden sm:inline">Traiter</span>
          <span className="sm:hidden">Traiter</span>
        </Button>
      </TableCell>
    </motion.tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog : traiter un ticket (premium avec badge gradient + sections GlassCard)
// ─────────────────────────────────────────────────────────────────────────────

function TraiterTicketDialog({
  ticket,
  onClose,
  onSubmit,
  isPending,
}: {
  ticket: TicketIncident | null;
  onClose: () => void;
  onSubmit: (body: TraiterBody) => void;
  isPending: boolean;
}) {
  const open = ticket !== null;
  const [statut, setStatut] = React.useState<StatutTicket>("EN_COURS");
  const [action, setAction] = React.useState("");

  // Réinitialise le formulaire quand on ouvre pour un nouveau ticket.
  React.useEffect(() => {
    if (ticket) {
      setStatut(
        ticket.statut === "OUVERT" ? "EN_COURS" : ticket.statut,
      );
      setAction(ticket.action_prise || "");
    }
  }, [ticket]);

  const canSubmit =
    action.trim().length >= 3 &&
    (statut !== ticket?.statut || action.trim() !== (ticket?.action_prise ?? ""));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ticket) return;
    if (action.trim().length < 3) return;
    onSubmit({ statut, action_prise: action.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-md shadow-emerald-900/20">
              <Hand className="size-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <DialogTitle className="font-display text-lg font-bold tracking-tight text-forest">
                Traiter le ticket
              </DialogTitle>
              <DialogDescription>
                {ticket
                  ? `Ticket #${ticket.id.slice(0, 8)} · ${CATEGORIE_LABEL[ticket.categorie]} · ${GRAVITE_LABEL[ticket.gravite]}`
                  : ""}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {ticket ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* ─── Récap élève + description ────────────────────────────── */}
            <GlassCard variant="tablet" noHover noAnimation className="p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="break-words font-medium leading-snug text-forest">
                  {ticket.eleve ? eleveFullName(ticket.eleve) : "—"}
                </span>
                {ticket.classe?.libelle ? (
                  <Badge
                    variant="outline"
                    className="border-slate-300 bg-slate-100 text-[11px] text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200"
                  >
                    {ticket.classe.libelle}
                  </Badge>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  · {formatDate(ticket.date_incident)}
                </span>
              </div>
              <p className="mt-2 line-clamp-3 break-words leading-snug text-muted-foreground">
                {ticket.description}
              </p>
            </GlassCard>

            {/* ─── Statut ─────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="traiter-statut">
                Nouveau statut <span className="text-rose-600">*</span>
              </Label>
              <Select
                value={statut}
                onValueChange={(v) => setStatut(v as StatutTicket)}
              >
                <SelectTrigger id="traiter-statut" className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUT_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUT_TICKET_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ─── Action prise ──────────────────────────────────────────── */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="traiter-action">
                Action / décision prise{" "}
                <span className="text-rose-600">*</span>
              </Label>
              <Textarea
                id="traiter-action"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                placeholder="Ex : Convocation des parents, sanction disciplinaire, avertissement oral…"
                rows={4}
                maxLength={1000}
                required
                className="bg-background"
              />
              <p className="text-[11px] text-muted-foreground">
                {action.length}/1000 caractères. Minimum 3 caractères.
              </p>
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
                disabled={isPending || !canSubmit}
                className="w-full sm:w-auto"
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Hand className="size-4" />
                )}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ligne de ticket (compacte) pour le dialog détails élève — cards mini premium
// ─────────────────────────────────────────────────────────────────────────────

function TicketLine({
  ticket,
  compact = false,
}: {
  ticket: TicketIncident;
  compact?: boolean;
}) {
  return (
    <div className="rounded-lg border border-emerald-200 bg-card p-3 text-sm dark:border-emerald-900/40 dark:bg-emerald-950/20">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className={cn("font-medium", GRAVITE_BADGE[ticket.gravite])}
        >
          {ticket.gravite === "CRITIQUE" ? (
            <Flame className="size-3" />
          ) : null}
          {GRAVITE_LABEL[ticket.gravite]}
        </Badge>
        <Badge variant="outline" className={CATEGORIE_BADGE[ticket.categorie]}>
          {CATEGORIE_LABEL[ticket.categorie]}
        </Badge>
        <Badge
          variant="outline"
          className={cn("font-medium", STATUT_BADGE[ticket.statut])}
        >
          {STATUT_TICKET_LABEL[ticket.statut]}
        </Badge>
        <span className="ml-auto text-xs text-muted-foreground">
          {formatDateTime(ticket.date_incident)}
        </span>
      </div>
      {!compact ? (
        <p className="mt-2 break-words leading-snug text-muted-foreground">
          {ticket.description}
        </p>
      ) : (
        <p className="mt-2 line-clamp-2 break-words leading-snug text-muted-foreground">
          {ticket.description}
        </p>
      )}
      {!compact && ticket.action_prise ? (
        <div className="mt-2 flex items-start gap-1.5 rounded bg-muted/40 p-2 text-xs">
          <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <span className="break-words leading-snug">
            <span className="font-medium">Action prise : </span>
            {ticket.action_prise}
          </span>
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <span>
          {ticket.anonyme
            ? "Signalé anonymement"
            : ticket.enseignant
              ? `Par ${eleveFullName(ticket.enseignant)}`
              : "Signalé par un enseignant"}
        </span>
      </div>
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
