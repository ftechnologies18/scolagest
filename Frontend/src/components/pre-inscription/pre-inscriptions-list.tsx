"use client";

/**
 * ScolaGest — Liste des pré-inscriptions pour le staff (Phase 3, Innovation 3).
 *
 * Affiche les pré-inscriptions en ligne soumises par les parents, avec :
 *  - Onglets de filtre par statut (Toutes / SOUMISE / EN_REVUE / VALIDEE /
 *    REJETEE) avec compteurs ;
 *  - Tableau : date soumission, élève (nom + prénoms), tuteur (nom + tél),
 *    classe souhaitée, statut (badge coloré), actions ;
 *  - Actions : Valider (dialog avec sélection classe + année + bouton
 *    confirmer), Rejeter (dialog avec motif), Voir détail (dialog).
 *
 * États : pas d'établissement, chargement, erreur, vide.
 *
 * Couleurs sémantiques : SOUMISE=amber, EN_REVUE=sky, VALIDEE=emerald,
 * REJETEE=rose. Pas d'indigo/bleu.
 */

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  Inbox,
  Loader2,
  MailOpen,
  Phone,
  RefreshCw,
  Send,
  User,
  Users,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchActiveAnnee,
  fetchClasses,
  fetchCycles,
  classesKeys,
  cyclesKeys,
  anneesKeys,
} from "@/lib/api-students";
import { ApiError } from "@/lib/api-client";
import type { AnneeScolaire, Classe, Cycle } from "@/lib/types";
import {
  fetchPreInscriptions,
  preInscriptionsKeys,
  rejeterPreInscription,
  validerPreInscription,
  type PreInscription,
  type StatutPreInscription,
  type ValiderBody,
} from "@/lib/api-pre-inscription";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatDateTime } from "@/lib/format";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

// ─────────────────────────────────────────────────────────────────────────────
// Constantes & helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUTS: StatutPreInscription[] = [
  "SOUMISE",
  "EN_REVUE",
  "VALIDEE",
  "REJETEE",
];

const STATUT_LABEL: Record<StatutPreInscription, string> = {
  SOUMISE: "Soumise",
  EN_REVUE: "En revue",
  VALIDEE: "Validée",
  REJETEE: "Rejetée",
};

const STATUT_BADGE_CLS: Record<StatutPreInscription, string> = {
  SOUMISE:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  EN_REVUE:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300",
  VALIDEE:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  REJETEE:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
};

function eleveNomComplet(pre: PreInscription): string {
  return [pre.eleve_prenoms, pre.eleve_nom].filter(Boolean).join(" ").trim();
}

function tuteurNomComplet(pre: PreInscription): string {
  return [pre.tuteur_prenoms, pre.tuteur_nom].filter(Boolean).join(" ").trim();
}

function classeLibelle(pre: PreInscription): string {
  if (pre.classe) {
    return pre.classe.libelle;
  }
  return "Non précisée";
}

function categorieLabel(c: PreInscription["eleve_categorie"]): string {
  switch (c) {
    case "AFFECTE":
      return "Affecté";
    case "NON_AFFECTE":
      return "Non affecté";
    default:
      return "—";
  }
}

function sexeLabel(s: PreInscription["eleve_sexe"]): string {
  if (s === "M") return "M";
  if (s === "F") return "F";
  return "—";
}

function lienParenteLabel(l: PreInscription["tuteur_lien_parente"]): string {
  switch (l) {
    case "PERE":
      return "Père";
    case "MERE":
      return "Mère";
    case "TUTEUR_LEGAL":
      return "Tuteur légal";
    case "AUTRE":
      return "Autre";
    default:
      return "—";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function PreInscriptionsList() {
  const etablissement = useAuthStore((s) => s.etablissement);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Filtre par statut (undefined = toutes)
  const [statutFilter, setStatutFilter] = React.useState<
    StatutPreInscription | undefined
  >(undefined);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: preInscriptionsKeys.list(statutFilter),
    queryFn: () => fetchPreInscriptions(statutFilter),
    enabled: !!etablissement,
  });

  // Compteurs par statut (chargés une fois, sans filtre)
  const { data: allPres } = useQuery({
    queryKey: preInscriptionsKeys.list(undefined),
    queryFn: () => fetchPreInscriptions(),
    enabled: !!etablissement,
  });

  const counts = React.useMemo(() => {
    const c: Record<StatutPreInscription, number> = {
      SOUMISE: 0,
      EN_REVUE: 0,
      VALIDEE: 0,
      REJETEE: 0,
    };
    for (const p of allPres ?? []) {
      c[p.statut]++;
    }
    return c;
  }, [allPres]);

  // ─── Mutations valider / rejeter ──────────────────────────────────────────
  const validerMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ValiderBody }) =>
      validerPreInscription(id, body),
    onSuccess: (data, vars) => {
      toast({
        title: "Pré-inscription validée",
        description: `${data.eleve.prenoms} ${data.eleve.nom} a été inscrit(e) avec succès.`,
      });
      // Invalide les listes + détail
      queryClient.invalidateQueries({ queryKey: preInscriptionsKeys.all });
      queryClient.invalidateQueries({
        queryKey: preInscriptionsKeys.detail(vars.id),
      });
      closeDialogs();
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Une erreur est survenue lors de la validation.";
      toast({
        title: "Échec de la validation",
        description: msg,
        variant: "destructive",
      });
    },
  });

  const rejeterMutation = useMutation({
    mutationFn: ({ id, motif }: { id: string; motif: string }) =>
      rejeterPreInscription(id, motif),
    onSuccess: () => {
      toast({
        title: "Pré-inscription rejetée",
        description: "La demande a été marquée comme rejetée.",
      });
      queryClient.invalidateQueries({ queryKey: preInscriptionsKeys.all });
      closeDialogs();
    },
    onError: (err) => {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Une erreur est survenue lors du rejet.";
      toast({
        title: "Échec du rejet",
        description: msg,
        variant: "destructive",
      });
    },
  });

  // ─── Dialogs ──────────────────────────────────────────────────────────────
  const [validerTarget, setValiderTarget] = React.useState<PreInscription | null>(null);
  const [rejeterTarget, setRejeterTarget] = React.useState<PreInscription | null>(null);
  const [detailTarget, setDetailTarget] = React.useState<PreInscription | null>(null);

  function closeDialogs() {
    setValiderTarget(null);
    setRejeterTarget(null);
    setDetailTarget(null);
  }

  // ─── Pas d'établissement ──────────────────────────────────────────────────
  if (!etablissement) {
    return (
      <div className="space-y-4">
        <Header onRefresh={() => refetch()} isFetching={isFetching} />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertCircle className="size-6" />
            </div>
            <p className="text-base font-medium">
              Sélectionnez un établissement
            </p>
            <p className="max-w-md text-sm text-muted-foreground">
              Les pré-inscriptions sont listées par établissement. Choisissez un
              établissement dans la barre latérale pour voir les demandes
              soumises par les parents.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Erreur ───────────────────────────────────────────────────────────────
  if (isError) {
    return (
      <div className="space-y-4">
        <Header onRefresh={() => refetch()} isFetching={isFetching} />
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              <AlertCircle className="size-6" />
            </div>
            <p className="text-base font-medium">Erreur de chargement</p>
            <p className="max-w-md text-sm text-muted-foreground">
              {error instanceof Error
                ? error.message
                : "Impossible de charger les pré-inscriptions. Veuillez réessayer."}
            </p>
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="mt-2"
            >
              <RefreshCw className="size-4" />
              Réessayer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pres = data ?? [];

  return (
    <div className="space-y-4">
      <Header onRefresh={() => refetch()} isFetching={isFetching} />

      {/* Onglets de filtre avec compteurs */}
      <FilterTabs
        active={statutFilter}
        onChange={setStatutFilter}
        counts={counts}
        total={allPres?.length ?? 0}
      />

      {/* Tableau */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : pres.length === 0 ? (
            <EmptyState statut={statutFilter} />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Soumise le</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Tuteur</TableHead>
                    <TableHead>Classe souhaitée</TableHead>
                    <TableHead className="w-[110px]">Statut</TableHead>
                    <TableHead className="w-[260px] text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pres.map((pre) => (
                    <TableRow key={pre.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(pre.date_soumission)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <User className="size-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {eleveNomComplet(pre) || "—"}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {sexeLabel(pre.eleve_sexe)} ·{" "}
                              {categorieLabel(pre.eleve_categorie)}
                              {pre.eleve_date_naissance
                                ? ` · ${formatDate(pre.eleve_date_naissance)}`
                                : ""}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
                            <Users className="size-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {tuteurNomComplet(pre) || "—"}
                            </p>
                            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Phone className="size-3" />
                              {pre.tuteur_telephone || "—"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-medium">
                          {classeLibelle(pre)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "px-2 py-0.5 text-xs font-semibold",
                            STATUT_BADGE_CLS[pre.statut],
                          )}
                        >
                          {STATUT_LABEL[pre.statut]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDetailTarget(pre)}
                          >
                            <Eye className="size-3.5" />
                            <span className="sr-only sm:not-sr-only">
                              Détail
                            </span>
                          </Button>
                          {(pre.statut === "SOUMISE" ||
                            pre.statut === "EN_REVUE") && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setValiderTarget(pre)}
                                className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                              >
                                <CheckCircle2 className="size-3.5" />
                                <span className="sr-only sm:not-sr-only">
                                  Valider
                                </span>
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRejeterTarget(pre)}
                                className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                              >
                                <XCircle className="size-3.5" />
                                <span className="sr-only sm:not-sr-only">
                                  Rejeter
                                </span>
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Valider */}
      {validerTarget && (
        <ValiderDialog
          pre={validerTarget}
          onClose={closeDialogs}
          onSubmit={(body) =>
            validerMutation.mutate({ id: validerTarget.id, body })
          }
          isPending={validerMutation.isPending}
        />
      )}

      {/* Dialog Rejeter */}
      {rejeterTarget && (
        <RejeterDialog
          pre={rejeterTarget}
          onClose={closeDialogs}
          onSubmit={(motif) =>
            rejeterMutation.mutate({ id: rejeterTarget.id, motif })
          }
          isPending={rejeterMutation.isPending}
        />
      )}

      {/* Dialog Détail */}
      {detailTarget && (
        <DetailDialog pre={detailTarget} onClose={closeDialogs} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// En-tête + filtres
// ─────────────────────────────────────────────────────────────────────────────

function Header({
  onRefresh,
  isFetching,
}: {
  onRefresh: () => void;
  isFetching: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <MailOpen className="size-6 text-emerald-600" />
          Pré-inscriptions en ligne
        </h1>
        <p className="text-sm text-muted-foreground">
          Demandes soumises par les parents via le formulaire public. Validez
          pour créer l&apos;élève, ou rejetez avec un motif.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={isFetching}>
        {isFetching ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RefreshCw className="size-4" />
        )}
        Actualiser
      </Button>
    </div>
  );
}

function FilterTabs({
  active,
  onChange,
  counts,
  total,
}: {
  active: StatutPreInscription | undefined;
  onChange: (s: StatutPreInscription | undefined) => void;
  counts: Record<StatutPreInscription, number>;
  total: number;
}) {
  const tabs: { key: StatutPreInscription | undefined; label: string; count: number }[] = [
    { key: undefined, label: "Toutes", count: total },
    ...STATUTS.map((s) => ({
      key: s,
      label: STATUT_LABEL[s],
      count: counts[s],
    })),
  ];
  return (
    <div className="flex flex-wrap gap-1.5">
      {tabs.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={String(t.key)}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              isActive
                ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <span>{t.label}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                isActive
                  ? "bg-white/20 text-white"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {t.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({ statut }: { statut?: StatutPreInscription }) {
  const label = statut ? STATUT_LABEL[statut] : "toutes confondues";
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Inbox className="size-6" />
      </div>
      <p className="text-base font-medium">Aucune pré-inscription</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Aucune demande {label.toLowerCase()} pour le moment. Les nouvelles
        pré-inscriptions soumises par les parents apparaîtront ici.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog de validation
// ─────────────────────────────────────────────────────────────────────────────

function ValiderDialog({
  pre,
  onClose,
  onSubmit,
  isPending,
}: {
  pre: PreInscription;
  onClose: () => void;
  onSubmit: (body: ValiderBody) => void;
  isPending: boolean;
}) {
  const etablissement = useAuthStore((s) => s.etablissement);
  const [cycleId, setCycleId] = React.useState<string>("all");
  const [niveau, setNiveau] = React.useState<string>("all");
  const [classeId, setClasseId] = React.useState<string>(pre.classe_id ?? "");
  const [anneeId, setAnneeId] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");

  // Cascade cycles → niveaux → classes (route staff, auth OK)
  const { data: cycles } = useQuery<Cycle[]>({
    queryKey: cyclesKeys.list(etablissement?.id),
    queryFn: () => fetchCycles(etablissement?.id),
    enabled: !!etablissement,
  });
  const { data: classes } = useQuery<Classe[]>({
    queryKey: classesKeys.list(etablissement?.id),
    queryFn: () => fetchClasses(etablissement?.id),
    enabled: !!etablissement,
  });
  const { data: activeAnnee } = useQuery<AnneeScolaire>({
    queryKey: anneesKeys.active(),
    queryFn: fetchActiveAnnee,
    enabled: !!etablissement,
  });

  // Auto-présélection de l'année active
  const didPreset = React.useRef(false);
  React.useEffect(() => {
    if (activeAnnee && !didPreset.current && !anneeId) {
      didPreset.current = true;
      setAnneeId(activeAnnee.id);
    }
  }, [activeAnnee, anneeId]);

  // Cascade : reset niveau + classe quand cycle change
  const prevCycle = React.useRef(cycleId);
  React.useEffect(() => {
    if (prevCycle.current !== cycleId) {
      prevCycle.current = cycleId;
      setNiveau("all");
      setClasseId("");
    }
  }, [cycleId]);
  const prevNiveau = React.useRef(niveau);
  React.useEffect(() => {
    if (prevNiveau.current !== niveau) {
      prevNiveau.current = niveau;
      setClasseId("");
    }
  }, [niveau]);

  const availableNiveaux = React.useMemo(() => {
    if (!classes) return [];
    const filtered =
      cycleId !== "all" ? classes.filter((c) => c.cycle_id === cycleId) : classes;
    return [...new Set(filtered.map((c) => c.niveau))].sort((a, b) => a - b);
  }, [classes, cycleId]);

  const filteredClasses = React.useMemo(() => {
    if (!classes) return [];
    return classes.filter((c) => {
      if (cycleId !== "all" && c.cycle_id !== cycleId) return false;
      if (niveau !== "all" && c.niveau !== Number(niveau)) return false;
      return true;
    });
  }, [classes, cycleId, niveau]);

  const isValid = !!classeId && !!anneeId;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || isPending) return;
    onSubmit({
      classe_id: classeId,
      annee_scolaire_id: anneeId,
      notes: notes.trim(),
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="size-5 text-emerald-600" />
            Valider la pré-inscription
          </DialogTitle>
          <DialogDescription>
            Confirmez la classe et l&apos;année scolaire pour{" "}
            <span className="font-semibold text-foreground">
              {eleveNomComplet(pre)}
            </span>
            . Un élève sera créé via le workflow d&apos;inscription.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Classe : cascade Cycle → Niveau → Classe */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Cycle</Label>
              <Select value={cycleId} onValueChange={setCycleId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Tous" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous cycles</SelectItem>
                  {cycles?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Niveau</Label>
              <Select value={niveau} onValueChange={setNiveau}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Tous" />
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
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Classe <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={classeId || "none"}
                onValueChange={(v) => setClasseId(v === "none" ? "" : v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Choisir…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choisir…</SelectItem>
                  {filteredClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.libelle}
                      {c.est_classe_examen ? " (examen)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Année scolaire */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Année scolaire <span className="text-rose-500">*</span>
            </Label>
            <Select value={anneeId || "none"} onValueChange={(v) => setAnneeId(v === "none" ? "" : v)}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choisir…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Choisir…</SelectItem>
                {activeAnnee && (
                  <SelectItem value={activeAnnee.id}>
                    {activeAnnee.libelle}
                    {activeAnnee.est_active ? " (active)" : ""}
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {activeAnnee && (
              <p className="text-xs text-muted-foreground">
                Année active présélectionnée : {activeAnnee.libelle}
              </p>
            )}
          </div>

          {/* Notes staff */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Notes staff (optionnel)
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Remarques internes visibles par le parent (ex : « Inscription confirmée, passer au secrétariat pour les frais »)."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isPending}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Validation…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Confirmer l&apos;inscription
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog de rejet
// ─────────────────────────────────────────────────────────────────────────────

function RejeterDialog({
  pre,
  onClose,
  onSubmit,
  isPending,
}: {
  pre: PreInscription;
  onClose: () => void;
  onSubmit: (motif: string) => void;
  isPending: boolean;
}) {
  const [motif, setMotif] = React.useState<string>("");

  const isValid = motif.trim().length >= 5;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || isPending) return;
    onSubmit(motif.trim());
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="size-5 text-rose-600" />
            Rejeter la pré-inscription
          </DialogTitle>
          <DialogDescription>
            Indiquez le motif du rejet pour{" "}
            <span className="font-semibold text-foreground">
              {eleveNomComplet(pre)}
            </span>
            . Ce motif sera visible par le parent sur la page de suivi.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">
              Motif du rejet <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex : Dossier incomplet, veuillez fournir l'acte de naissance. / Doublon avec un élève déjà inscrit."
              rows={4}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Minimum 5 caractères.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!isValid || isPending}
              variant="destructive"
            >
              {isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Rejet…
                </>
              ) : (
                <>
                  <XCircle className="size-4" />
                  Confirmer le rejet
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog de détail
// ─────────────────────────────────────────────────────────────────────────────

function DetailDialog({
  pre,
  onClose,
}: {
  pre: PreInscription;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="size-5 text-emerald-600" />
            Détail de la pré-inscription
          </DialogTitle>
          <DialogDescription>
            Soumise le{" "}
            <span className="font-medium text-foreground">
              {formatDateTime(pre.date_soumission)}
            </span>
            {pre.date_traitement && (
              <>
                {" · traitée le "}
                <span className="font-medium text-foreground">
                  {formatDateTime(pre.date_traitement)}
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {/* Statut */}
          <div className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Statut actuel
            </span>
            <Badge
              className={cn(
                "px-2.5 py-0.5 text-xs font-semibold",
                STATUT_BADGE_CLS[pre.statut],
              )}
            >
              {STATUT_LABEL[pre.statut]}
            </Badge>
          </div>

          {/* Élève */}
          <DetailSection title="Élève" icon={User}>
            <DetailRow label="Nom complet" value={eleveNomComplet(pre) || "—"} />
            <DetailRow
              label="Date de naissance"
              value={
                pre.eleve_date_naissance
                  ? formatDate(pre.eleve_date_naissance)
                  : "—"
              }
            />
            <DetailRow label="Lieu de naissance" value={pre.eleve_lieu_naissance || "—"} />
            <DetailRow label="Sexe" value={sexeLabel(pre.eleve_sexe)} />
            <DetailRow label="Catégorie" value={categorieLabel(pre.eleve_categorie)} />
          </DetailSection>

          {/* Tuteur */}
          <DetailSection title="Tuteur / Parent" icon={Users}>
            <DetailRow label="Nom complet" value={tuteurNomComplet(pre) || "—"} />
            <DetailRow label="Téléphone" value={pre.tuteur_telephone || "—"} />
            <DetailRow label="Email" value={pre.tuteur_email || "—"} />
            <DetailRow label="Lien de parenté" value={lienParenteLabel(pre.tuteur_lien_parente)} />
          </DetailSection>

          {/* Classe souhaitée + notes */}
          <DetailSection title="Classe souhaitée & notes" icon={Send}>
            <DetailRow label="Classe" value={classeLibelle(pre)} />
            {pre.notes_parent && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Message du parent
                </p>
                <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-2.5 text-sm">
                  {pre.notes_parent}
                </p>
              </div>
            )}
            {pre.notes_staff && (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Notes staff
                </p>
                <p className="whitespace-pre-wrap rounded-md bg-emerald-50 p-2.5 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                  {pre.notes_staff}
                </p>
              </div>
            )}
            {pre.eleve_cree_id && (
              <p className="text-xs text-emerald-700 dark:text-emerald-300">
                ✓ Élève créé (ID : {pre.eleve_cree_id.slice(0, 8)}…)
              </p>
            )}
          </DetailSection>
        </div>

        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
        <Icon className="size-4" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <Separator />
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
