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
 * États : chargement (skeleton), erreur, vide.
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

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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

const GRAVITE_BADGE: Record<GraviteIncident, string> = {
  MINEUR:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  MODERE:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300",
  SEVERE:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  CRITIQUE:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
};

const STATUT_BADGE: Record<StatutTicket, string> = {
  OUVERT:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
  EN_COURS:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  TRAITE:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  CLOTURE:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  REJETE:
    "border-muted-foreground/20 bg-muted text-muted-foreground",
};

const CATEGORIE_BADGE: Record<CategorieIncident, string> = {
  ABSENTEISME:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  IMPOLITESSE:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  COMPORTEMENT:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  TRAVAIL:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  RETARD:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
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
    <DisciplineShell>
      <Tabs defaultValue="eleves-risque" className="w-full">
        <TabsList className="h-auto">
          <TabsTrigger value="eleves-risque" className="gap-1.5">
            <Users className="size-4" />
            Élèves à risque
          </TabsTrigger>
          <TabsTrigger value="tickets" className="gap-1.5">
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
// Shell commun
// ─────────────────────────────────────────────────────────────────────────────

function DisciplineShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <ShieldAlert className="size-6 text-rose-600" />
          Discipline
        </h1>
        <p className="text-sm text-muted-foreground">
          Suivi des tickets d'incident disciplinaire et identification des
          élèves à risque.
        </p>
      </header>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet 1 : Élèves à risque
// ─────────────────────────────────────────────────────────────────────────────

function ElevesRisqueTab() {
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

  return (
    <div className="flex flex-col gap-4">
      {/* Filtre période */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <CalendarClock className="size-4 text-muted-foreground" />
            <span className="font-medium">Période d'analyse</span>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={String(periode)}
              onValueChange={(v) => setPeriode(Number(v))}
            >
              <SelectTrigger className="w-full sm:w-52">
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
            >
              <RefreshCw
                className={cn("size-4", isFetching && "animate-spin")}
              />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contenu : tableau / skeleton / empty / error */}
      {isLoading ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
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
              : "Impossible de charger les élèves à risque. Vérifiez que le backend est démarré puis réessayez."
          }
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="size-4" />
              Réessayer
            </Button>
          }
        />
      ) : (eleves ?? []).length === 0 ? (
        <EmptyState
          icon={Users}
          tone="emerald"
          title="Aucun élève à risque"
          description="Aucun élève n'a été signalé sur la période sélectionnée. Tout va bien !"
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Élève</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead className="text-center">Tickets</TableHead>
                    <TableHead className="text-center">Profs diff.</TableHead>
                    <TableHead className="text-center">Critiques</TableHead>
                    <TableHead>Dernier ticket</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(eleves ?? []).map((e) => (
                    <TableRow
                      key={e.eleve_id}
                      className={cn(
                        e.a_convoquer &&
                          "bg-rose-50/60 dark:bg-rose-950/20",
                      )}
                    >
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {eleveFullName(e)}
                          </span>
                          <span className="font-mono text-[11px] text-muted-foreground">
                            {e.eleve_id.slice(0, 8)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {e.classe_libelle || "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className="font-bold tabular-nums"
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
                              ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                              : e.nb_profs_differents >= 2
                                ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                                : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
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
                            className="gap-1 border-rose-200 bg-rose-50 font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                          >
                            <Flame className="size-3" />
                            {e.nb_critiques}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {e.dernier_ticket
                          ? formatDateShort(e.dernier_ticket)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {e.a_convoquer ? (
                          <Badge
                            variant="outline"
                            className="gap-1 border-rose-300 bg-rose-100 font-bold text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/60 dark:text-rose-300"
                          >
                            <UserX className="size-3" />
                            À convoquer
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            Suivi normal
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDetailEleve(e)}
                        >
                          <Eye className="size-3.5" />
                          <span className="hidden sm:inline">Voir détails</span>
                          <span className="sm:hidden">Détails</span>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog détails élève */}
      <EleveRisqueDetailDialog
        eleve={detailEleve}
        onClose={() => setDetailEleve(null)}
      />
    </div>
  );
}

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
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-5 text-rose-600" />
            {eleve ? eleveFullName(eleve) : "Détails élève"}
          </DialogTitle>
          <DialogDescription>
            Historique des tickets disciplinaires de l'élève.
            {eleve?.classe_libelle
              ? ` · Classe : ${eleve.classe_libelle}.`
              : ""}
            {eleve
              ? ` · ${eleve.nb_tickets} ticket(s) sur la période, ${eleve.nb_critiques} critique(s).`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
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

  return (
    <div className="flex flex-col gap-4">
      {/* Filtre statut */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Ticket className="size-4 text-muted-foreground" />
            <span className="font-medium">
              {(tickets ?? []).length} ticket
              {(tickets ?? []).length > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={statut}
              onValueChange={(v) => setStatut(v as StatutTicket | "all")}
            >
              <SelectTrigger className="w-full sm:w-52">
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
            >
              <RefreshCw
                className={cn("size-4", isFetching && "animate-spin")}
              />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Contenu : tableau / skeleton / empty / error */}
      {isLoading ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
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
              : "Impossible de charger les tickets. Vérifiez que le backend est démarré puis réessayez."
          }
          action={
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="size-4" />
              Réessayer
            </Button>
          }
        />
      ) : (tickets ?? []).length === 0 ? (
        <EmptyState
          icon={Ticket}
          tone="emerald"
          title="Aucun ticket"
          description="Aucun ticket d'incident ne correspond au filtre sélectionné."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">Date</TableHead>
                    <TableHead className="min-w-[160px]">Élève</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Gravité</TableHead>
                    <TableHead className="min-w-[140px]">Enseignant</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(tickets ?? []).map((t) => {
                    const alerte =
                      t.gravite === "CRITIQUE" && t.statut === "OUVERT";
                    return (
                      <TableRow
                        key={t.id}
                        className={cn(
                          alerte &&
                            "bg-rose-100/70 dark:bg-rose-950/40",
                        )}
                      >
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDateShort(t.date_incident)}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">
                              {t.eleve
                                ? eleveFullName(t.eleve)
                                : "Élève inconnu"}
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
                            className={cn(
                              "gap-1 font-medium",
                              GRAVITE_BADGE[t.gravite],
                            )}
                          >
                            {t.gravite === "CRITIQUE" ? (
                              <Flame className="size-3" />
                            ) : null}
                            {GRAVITE_LABEL[t.gravite]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {t.anonyme ? (
                            <span className="italic text-muted-foreground">
                              Anonyme
                            </span>
                          ) : t.enseignant ? (
                            <span className="line-clamp-1">
                              {eleveFullName(t.enseignant)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "font-medium",
                              STATUT_BADGE[t.statut],
                            )}
                          >
                            {STATUT_TICKET_LABEL[t.statut]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant={
                              t.statut === "CLOTURE" || t.statut === "REJETE"
                                ? "outline"
                                : "default"
                            }
                            onClick={() => setTraiterTarget(t)}
                            className={
                              t.statut !== "CLOTURE" && t.statut !== "REJETE"
                                ? "bg-emerald-600 hover:bg-emerald-700"
                                : undefined
                            }
                          >
                            <Hand className="size-3.5" />
                            <span className="hidden sm:inline">Traiter</span>
                            <span className="sm:hidden">Traiter</span>
                          </Button>
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
// Dialog : traiter un ticket
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
          <DialogTitle className="flex items-center gap-2">
            <Hand className="size-5 text-emerald-600" />
            Traiter le ticket
          </DialogTitle>
          <DialogDescription>
            {ticket
              ? `Ticket #${ticket.id.slice(0, 8)} · ${CATEGORIE_LABEL[ticket.categorie]} · ${GRAVITE_LABEL[ticket.gravite]}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {ticket ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Récap élève + description */}
            <div className="rounded-md border border-muted bg-muted/30 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">
                  {ticket.eleve ? eleveFullName(ticket.eleve) : "—"}
                </span>
                {ticket.classe?.libelle ? (
                  <Badge variant="outline" className="text-[11px]">
                    {ticket.classe.libelle}
                  </Badge>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  · {formatDate(ticket.date_incident)}
                </span>
              </div>
              <p className="mt-2 line-clamp-3 text-muted-foreground">
                {ticket.description}
              </p>
            </div>

            {/* Statut */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="traiter-statut">
                Nouveau statut <span className="text-rose-600">*</span>
              </Label>
              <Select
                value={statut}
                onValueChange={(v) => setStatut(v as StatutTicket)}
              >
                <SelectTrigger id="traiter-statut">
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

            {/* Action prise */}
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
              />
              <p className="text-[11px] text-muted-foreground">
                {action.length}/1000 caractères. Minimum 3 caractères.
              </p>
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
                disabled={isPending || !canSubmit}
                className="bg-emerald-600 hover:bg-emerald-700"
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
// Ligne de ticket (compacte) pour le dialog détails élève
// ─────────────────────────────────────────────────────────────────────────────

function TicketLine({
  ticket,
  compact = false,
}: {
  ticket: TicketIncident;
  compact?: boolean;
}) {
  return (
    <div className="rounded-md border border-muted bg-card p-3 text-sm">
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
        <p className="mt-2 text-muted-foreground">{ticket.description}</p>
      ) : (
        <p className="mt-2 line-clamp-2 text-muted-foreground">
          {ticket.description}
        </p>
      )}
      {!compact && ticket.action_prise ? (
        <div className="mt-2 flex items-start gap-1.5 rounded bg-muted/40 p-2 text-xs">
          <MessageSquare className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          <span>
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

function EmptyState({ icon: Icon, tone, title, description, action }: EmptyStateProps) {
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
