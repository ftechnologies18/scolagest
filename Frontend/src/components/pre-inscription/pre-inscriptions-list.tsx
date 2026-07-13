"use client";

/**
 * ScolaGest — Liste des pré-inscriptions pour le staff (Phase 3 — Refonte Forêt EdTech).
 *
 * Affiche les pré-inscriptions en ligne soumises par les parents, avec :
 *  - Hero header (GlassCard desktop) : badge rond gradient emerald→gold avec
 *    icône MailOpen, titre `font-display text-2xl`, sous-titre descriptif,
 *    pill établissement emerald, pill "Phase 3" outline + bouton Actualiser.
 *  - FilterTabs premium : GlassCard desktop noHover noAnimation, tabs actifs
 *    bg-emerald-600 text-white, compteurs en pills, icônes contextuelles
 *    (Inbox / Send / Eye / CheckCircle2 / XCircle), scrollable mobile.
 *  - 4 StatCards de résumé : Total demandes (emerald), En attente (amber),
 *    Validées (gold), Rejetées (terracotta).
 *  - Tableau desktop : GlassCard adaptive p-0, header bg-emerald-50/60,
 *    hover row bg-emerald-50/60, avatar élève emerald + avatar tuteur amber,
 *    classe souhaitée badge School, statut border-300 bg-100 text-800,
 *    actions avec `title` natif (pas de Tooltip Radix), row VALIDEE
 *    bg-emerald-50/30, row REJETEE opacity-60.
 *  - Cartes mobile (md:hidden) : GlassCard mobile cliquable (ouvre détail),
 *    avatar élève + nom + statut, tuteur + classe + date, boutons
 *    Valider/Rejeter/Détail (≥44px).
 *  - Dialogs premium : ValiderDialog (badge rond gradient emerald→gold,
 *    cascade Cycle→Niveau→Classe avec icônes, bouton submit variant
 *    "success"), RejeterDialog (badge rond gradient rose, focus ring rose,
 *    bouton submit variant "destructive"), DetailDialog (badge rond gradient
 *    emerald→gold, 3 sections en GlassCard mobile, icônes contextuelles,
 *    notes parent amber/10 + notes staff emerald/10).
 *  - Empty states premium : KentePattern bg + badges ronds colorés
 *    (amber établissement manquant, emerald aucune demande, rose erreur).
 *
 * Couleurs sémantiques : SOUMISE=amber, EN_REVUE=sky, VALIDEE=emerald,
 * REJETEE=rose. Pas d'indigo/bleu.
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query (fetchPreInscriptions /
 * preInscriptionsKeys / validerPreInscription / rejeterPreInscription),
 * types (PreInscription, StatutPreInscription, ValiderBody), mutations
 * avec onSuccess/onError (toast + invalidateQueries + closeDialogs),
 * compteurs via `counts` (useMemo sur `allPres`), cascade Cycle → Niveau →
 * Classe du ValiderDialog (refs `prevCycle`/`prevNiveau`/`didPreset`),
 * auto-présélection de l'année active, validation du motif (≥5 caractères).
 * Aucun endpoint backend modifié.
 */

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BarChart3,
  Calendar,
  CheckCircle2,
  Eye,
  Inbox,
  Layers,
  Loader2,
  MailOpen,
  MessageSquare,
  Phone,
  RefreshCw,
  School,
  Send,
  Sparkles,
  StickyNote,
  User,
  Users,
  XCircle,
  type LucideIcon,
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

// Tooltips Radix interdis (BUG À ÉVITER #1) : on utilise l'attribut `title`
// natif HTML pour les boutons d'action. Le `Tooltip` Radix cassait onClick
// sur les boutons ghost (cf. refontes /eleves et /impayes).

import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { StatCard } from "@/components/ds/stat-card";

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

// Contrastes renforcés (BUG À ÉVITER #6) : border-300 bg-100 text-800
// (au lieu de border-200 bg-50 text-700 dans la version d'origine).
const STATUT_BADGE_CLS: Record<StatutPreInscription, string> = {
  SOUMISE:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
  EN_REVUE:
    "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-700 dark:bg-sky-950/50 dark:text-sky-200",
  VALIDEE:
    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
  REJETEE:
    "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-200",
};

// Icônes contextuelles par statut (pour les FilterTabs premium).
const STATUT_ICON: Record<StatutPreInscription, LucideIcon> = {
  SOUMISE: Send,
  EN_REVUE: Eye,
  VALIDEE: CheckCircle2,
  REJETEE: XCircle,
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

/** Initiales (max 2) à partir d'un nom + prénoms — pour l'avatar fallback. */
function initialsOf(nom?: string, prenoms?: string): string {
  const a = (nom ?? "").trim().charAt(0);
  const b = (prenoms ?? "").trim().charAt(0);
  return (a + b).toUpperCase() || "?";
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

  const pres = data ?? [];

  return (
    <div className="space-y-4">
      <KentePattern variant="strip" position="top" />

      {/* ─── Hero header ─────────────────────────────────────────────────── */}
      <HeroHeader
        etablissementNom={etablissement?.nom}
        etablissementVille={etablissement?.ville}
        onRefresh={() => refetch()}
        isFetching={isFetching}
      />

      {/* ─── Pas d'établissement ─────────────────────────────────────────── */}
      {!etablissement ? (
        <EmptyStateEtablissement />
      ) : isError ? (
        <EmptyStateErreur
          message={
            error instanceof Error
              ? error.message
              : "Impossible de charger les pré-inscriptions. Veuillez réessayer."
          }
          onRetry={() => refetch()}
        />
      ) : (
        <>
          {/* ─── Onglets de filtre avec compteurs ─────────────────────────── */}
          <FilterTabs
            active={statutFilter}
            onChange={setStatutFilter}
            counts={counts}
            total={allPres?.length ?? 0}
          />

          {/* ─── StatCards de résumé ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Inbox}
              tone="emerald"
              label="Total demandes"
              value={allPres?.length ?? 0}
              hint="toutes statuts confondus"
              delay={0}
            />
            <StatCard
              icon={Send}
              tone="amber"
              label="En attente"
              value={counts.SOUMISE + counts.EN_REVUE}
              hint="à traiter par le secrétariat"
              delay={0.05}
            />
            <StatCard
              icon={CheckCircle2}
              tone="gold"
              label="Validées"
              value={counts.VALIDEE}
              hint="élèves créés via le workflow"
              delay={0.1}
            />
            <StatCard
              icon={XCircle}
              tone="terracotta"
              label="Rejetées"
              value={counts.REJETEE}
              hint="demandes archivées"
              delay={0.15}
            />
          </div>

          <KentePattern variant="separator" className="my-1" />

          {/* ─── Tableau desktop + cartes mobile ─────────────────────────── */}
          <GlassCard variant="adaptive" noHover className="overflow-hidden p-0">
            {isLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : pres.length === 0 ? (
              <EmptyState statut={statutFilter} />
            ) : (
              <>
                {/* Vue table (desktop / tablette) */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-emerald-50/60 hover:bg-emerald-50/60 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/20">
                        <TableHead className="w-[140px] text-emerald-900 dark:text-emerald-200">
                          Soumise le
                        </TableHead>
                        <TableHead className="text-emerald-900 dark:text-emerald-200">
                          Élève
                        </TableHead>
                        <TableHead className="text-emerald-900 dark:text-emerald-200">
                          Tuteur
                        </TableHead>
                        <TableHead className="text-emerald-900 dark:text-emerald-200">
                          Classe souhaitée
                        </TableHead>
                        <TableHead className="w-[110px] text-emerald-900 dark:text-emerald-200">
                          Statut
                        </TableHead>
                        <TableHead className="w-[280px] text-right text-emerald-900 dark:text-emerald-200">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pres.map((pre, idx) => (
                        <PreRow
                          key={pre.id}
                          pre={pre}
                          index={idx}
                          onDetail={() => setDetailTarget(pre)}
                          onValider={() => setValiderTarget(pre)}
                          onRejeter={() => setRejeterTarget(pre)}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Vue cartes (mobile) */}
                <div className="space-y-2 p-3 md:hidden">
                  {pres.map((pre, idx) => (
                    <PreRowMobile
                      key={pre.id}
                      pre={pre}
                      index={idx}
                      onDetail={() => setDetailTarget(pre)}
                      onValider={() => setValiderTarget(pre)}
                      onRejeter={() => setRejeterTarget(pre)}
                    />
                  ))}
                </div>
              </>
            )}
          </GlassCard>
        </>
      )}

      {/* ─── Dialogs ─────────────────────────────────────────────────────── */}
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

      {detailTarget && (
        <DetailDialog pre={detailTarget} onClose={closeDialogs} />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero header premium
// ─────────────────────────────────────────────────────────────────────────────

function HeroHeader({
  etablissementNom,
  etablissementVille,
  onRefresh,
  isFetching,
}: {
  etablissementNom?: string;
  etablissementVille?: string;
  onRefresh: () => void;
  isFetching: boolean;
}) {
  return (
    <GlassCard variant="desktop" noHover className="p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 sm:gap-4">
          {/* Badge rond gradient emerald→gold avec icône MailOpen */}
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
            <MailOpen className="size-6" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                Pré-inscriptions en ligne
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50/60 px-2 py-0.5 align-middle text-[11px] font-medium text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                <Sparkles className="size-3" />
                Phase 3
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Demandes soumises par les parents via le formulaire public.
              Validez pour créer l&apos;élève, ou rejetez avec un motif.
            </p>
            {etablissementNom && (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                <School className="size-3" />
                {etablissementNom}
                {etablissementVille ? ` · ${etablissementVille}` : ""}
              </span>
            )}
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isFetching}
          className="h-9 shrink-0 border-emerald-300 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
          aria-label={isFetching ? "Actualisation en cours" : "Actualiser la liste"}
        >
          {isFetching ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          <span className="hidden sm:inline">Actualiser</span>
          <span className="sr-only">Actualiser la liste</span>
        </Button>
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FilterTabs premium
// ─────────────────────────────────────────────────────────────────────────────

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
  const tabs: {
    key: StatutPreInscription | undefined;
    label: string;
    count: number;
    icon: LucideIcon;
  }[] = [
    { key: undefined, label: "Toutes", count: total, icon: Inbox },
    ...STATUTS.map((s) => ({
      key: s,
      label: STATUT_LABEL[s],
      count: counts[s],
      icon: STATUT_ICON[s],
    })),
  ];

  return (
    <GlassCard
      variant="desktop"
      noHover
      noAnimation
      className="p-2"
    >
      {/* Sur mobile : scrollable horizontalement (overflow-x-auto) ; sur
          desktop : flex-wrap pour afficher tous les onglets. */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
        {tabs.map((t) => {
          const isActive = active === t.key;
          const Icon = t.icon;
          return (
            <button
              key={String(t.key)}
              type="button"
              onClick={() => onChange(t.key)}
              aria-pressed={isActive}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                isActive
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : "border-border bg-background text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300",
              )}
            >
              <Icon className="size-3.5" aria-hidden="true" />
              <span className="whitespace-nowrap">{t.label}</span>
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
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ligne desktop (tableau)
// ─────────────────────────────────────────────────────────────────────────────

function PreRow({
  pre,
  index,
  onDetail,
  onValider,
  onRejeter,
}: {
  pre: PreInscription;
  index: number;
  onDetail: () => void;
  onValider: () => void;
  onRejeter: () => void;
}) {
  const isValidee = pre.statut === "VALIDEE";
  const isRejetee = pre.statut === "REJETEE";
  const canAct = pre.statut === "SOUMISE" || pre.statut === "EN_REVUE";
  return (
    <TableRow
      className={cn(
        "cursor-default transition-colors hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20",
        isValidee && "bg-emerald-50/30 dark:bg-emerald-950/10",
        isRejetee && "opacity-60",
      )}
      style={{ animationDelay: `${index * 0.02}s` }}
    >
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Calendar className="size-3 shrink-0 text-emerald-600/70" aria-hidden="true" />
          {formatDate(pre.date_soumission)}
        </span>
      </TableCell>

      {/* Élève : avatar initials bg-emerald-600 text-white (BUG À ÉVITER #5) */}
      <TableCell>
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-semibold text-white ring-1 ring-emerald-200/60 dark:bg-emerald-800 dark:text-emerald-50 dark:ring-emerald-800/40">
            {initialsOf(pre.eleve_nom, pre.eleve_prenoms)}
          </div>
          <div className="min-w-0">
            <p className="break-words text-sm font-medium leading-snug">
              {eleveNomComplet(pre) || "—"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {sexeLabel(pre.eleve_sexe)} · {categorieLabel(pre.eleve_categorie)}
              {pre.eleve_date_naissance
                ? ` · ${formatDate(pre.eleve_date_naissance)}`
                : ""}
            </p>
          </div>
        </div>
      </TableCell>

      {/* Tuteur : avatar initials bg-amber-600 text-white */}
      <TableCell>
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-600 text-[11px] font-semibold text-white ring-1 ring-amber-200/60 dark:bg-amber-800 dark:text-amber-50 dark:ring-amber-800/40">
            {initialsOf(pre.tuteur_nom, pre.tuteur_prenoms)}
          </div>
          <div className="min-w-0">
            <p className="break-words text-sm font-medium leading-snug">
              {tuteurNomComplet(pre) || "—"}
            </p>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Phone className="size-3 shrink-0" aria-hidden="true" />
              <span className="break-all">{pre.tuteur_telephone || "—"}</span>
            </p>
          </div>
        </div>
      </TableCell>

      {/* Classe souhaitée : badge avec icône School */}
      <TableCell>
        <Badge
          variant="outline"
          className="inline-flex items-center gap-1 border-emerald-200 bg-emerald-50/60 font-medium text-emerald-800 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          <School className="size-3 shrink-0" aria-hidden="true" />
          <span className="break-words">{classeLibelle(pre)}</span>
        </Badge>
      </TableCell>

      {/* Statut : badge renforcé border-300 bg-100 text-800 */}
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

      {/* Actions : `title` natif (pas de Tooltip Radix — BUG À ÉVITER #1).
          Icônes seules sur petits écrans, icône + texte sur md+. */}
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDetail}
            className="h-8 px-2 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40"
            title="Voir le détail"
            aria-label={`Voir le détail de ${eleveNomComplet(pre)}`}
          >
            <Eye className="size-3.5" />
            <span className="hidden lg:inline">Détail</span>
          </Button>
          {canAct && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={onValider}
                className="h-8 border-emerald-300 px-2 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
                title="Valider la pré-inscription"
                aria-label={`Valider la pré-inscription de ${eleveNomComplet(pre)}`}
              >
                <CheckCircle2 className="size-3.5" />
                <span className="hidden lg:inline">Valider</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onRejeter}
                className="h-8 border-rose-300 px-2 text-rose-800 hover:bg-rose-50 hover:text-rose-900 dark:border-rose-700 dark:text-rose-200 dark:hover:bg-rose-950/40"
                title="Rejeter la pré-inscription"
                aria-label={`Rejeter la pré-inscription de ${eleveNomComplet(pre)}`}
              >
                <XCircle className="size-3.5" />
                <span className="hidden lg:inline">Rejeter</span>
              </Button>
            </>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carte mobile (md:hidden)
// ─────────────────────────────────────────────────────────────────────────────

function PreRowMobile({
  pre,
  index,
  onDetail,
  onValider,
  onRejeter,
}: {
  pre: PreInscription;
  index: number;
  onDetail: () => void;
  onValider: () => void;
  onRejeter: () => void;
}) {
  const canAct = pre.statut === "SOUMISE" || pre.statut === "EN_REVUE";
  const isRejetee = pre.statut === "REJETEE";

  // Carte cliquable (ouvre le détail). On n'utilise PAS `<button>` pour la
  // carte entière car les boutons du footer seraient imbriqués (BUG À ÉVITER
  // #3). On utilise `<div role="button" tabIndex={0}>` avec onKeyDown.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onDetail();
    }
  };

  return (
    <GlassCard
      variant="mobile"
      noHover
      noAnimation
      delay={Math.min(index * 0.03, 0.3)}
      onClick={onDetail}
      className={cn(
        "p-3.5",
        isRejetee && "opacity-70",
      )}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`Pré-inscription de ${eleveNomComplet(pre)} — ouvrir le détail`}
    >
      {/* Header : avatar élève + nom + statut */}
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white ring-1 ring-emerald-200/60 dark:bg-emerald-800 dark:text-emerald-50 dark:ring-emerald-800/40">
          {initialsOf(pre.eleve_nom, pre.eleve_prenoms)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold leading-snug">
            {eleveNomComplet(pre) || "—"}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {sexeLabel(pre.eleve_sexe)} · {categorieLabel(pre.eleve_categorie)}
          </p>
        </div>
        <Badge
          className={cn(
            "shrink-0 px-2 py-0.5 text-[10px] font-semibold",
            STATUT_BADGE_CLS[pre.statut],
          )}
        >
          {STATUT_LABEL[pre.statut]}
        </Badge>
      </div>

      {/* Body : tuteur + classe souhaitée + date soumission */}
      <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Users className="size-3.5 shrink-0 text-amber-600" aria-hidden="true" />
          <span className="break-words">
            {tuteurNomComplet(pre) || "—"}
            {pre.tuteur_lien_parente
              ? ` · ${lienParenteLabel(pre.tuteur_lien_parente)}`
              : ""}
          </span>
        </p>
        <p className="flex items-center gap-1.5">
          <Phone className="size-3.5 shrink-0 text-amber-600" aria-hidden="true" />
          <span className="break-all">{pre.tuteur_telephone || "—"}</span>
        </p>
        <p className="flex items-center gap-1.5">
          <School className="size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
          <span className="break-words">{classeLibelle(pre)}</span>
        </p>
        <p className="flex items-center gap-1.5">
          <Calendar className="size-3.5 shrink-0 text-emerald-600/70" aria-hidden="true" />
          <span>Soumise le {formatDate(pre.date_soumission)}</span>
        </p>
      </div>

      {/* Footer : boutons Valider/Rejeter (si SOUMISE/EN_REVUE) + Détail.
          Touch target ≥ 44px (h-11). stopPropagation pour éviter l'ouverture
          du détail quand on clique sur une action. */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {canAct ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onValider();
              }}
              className="h-11 border-emerald-300 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
              title="Valider la pré-inscription"
              aria-label={`Valider la pré-inscription de ${eleveNomComplet(pre)}`}
            >
              <CheckCircle2 className="size-4" />
              Valider
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRejeter();
              }}
              className="h-11 border-rose-300 text-rose-800 hover:bg-rose-50 hover:text-rose-900 dark:border-rose-700 dark:text-rose-200 dark:hover:bg-rose-950/40"
              title="Rejeter la pré-inscription"
              aria-label={`Rejeter la pré-inscription de ${eleveNomComplet(pre)}`}
            >
              <XCircle className="size-4" />
              Rejeter
            </Button>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDetail();
            }}
            className="col-span-2 h-11 border-emerald-300 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 dark:border-emerald-700 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
            title="Voir le détail"
            aria-label={`Voir le détail de ${eleveNomComplet(pre)}`}
          >
            <Eye className="size-4" />
            Voir le détail
          </Button>
        )}
      </div>
    </GlassCard>
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
          <div className="flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 shadow-lg shadow-amber-900/10 dark:bg-amber-950/40 dark:text-amber-300">
            <AlertCircle className="size-7" />
          </div>
          <p className="font-display text-base font-semibold">
            Sélectionnez un établissement
          </p>
          <p className="max-w-md text-xs text-muted-foreground">
            Les pré-inscriptions sont listées par établissement. Choisissez un
            établissement dans la barre latérale pour voir les demandes
            soumises par les parents.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

function EmptyStateErreur({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <GlassCard variant="adaptive" noHover className="border border-dashed">
      <div className="relative overflow-hidden px-4 py-12">
        <KentePattern variant="bg" />
        <div className="relative flex flex-col items-center justify-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-rose-100 text-rose-700 shadow-lg shadow-rose-900/10 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="size-7" />
          </div>
          <p className="font-display text-base font-semibold">
            Erreur de chargement
          </p>
          <p className="max-w-md break-words text-xs text-muted-foreground">
            {message}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-1 h-9 border-rose-300 text-rose-800 hover:bg-rose-50 hover:text-rose-900 dark:border-rose-700 dark:text-rose-200 dark:hover:bg-rose-950/40"
          >
            <RefreshCw className="size-3.5" />
            Réessayer
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

function EmptyState({ statut }: { statut?: StatutPreInscription }) {
  const label = statut ? STATUT_LABEL[statut] : "toutes confondues";
  return (
    <div className="relative overflow-hidden px-4 py-16">
      <KentePattern variant="bg" />
      <div className="relative flex flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 shadow-lg shadow-emerald-900/10 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Inbox className="size-7" />
        </div>
        <p className="font-display text-base font-semibold">
          Aucune pré-inscription
        </p>
        <p className="max-w-md text-xs text-muted-foreground">
          Aucune demande {label.toLowerCase()} pour le moment. Les nouvelles
          pré-inscriptions soumises par les parents apparaîtront ici.
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog de validation (premium)
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
            {/* Badge rond gradient emerald→gold avec icône CheckCircle2 */}
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-md shadow-emerald-900/20">
              <CheckCircle2 className="size-5" />
            </span>
            Valider la pré-inscription
          </DialogTitle>
          <DialogDescription>
            Confirmez la classe et l&apos;année scolaire pour{" "}
            <span className="font-semibold text-foreground break-words">
              {eleveNomComplet(pre)}
            </span>
            . Un élève sera créé via le workflow d&apos;inscription.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cascade Cycle → Niveau → Classe (icônes contextuelles dans les SelectTrigger) */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="valider-cycle" className="text-xs font-medium">
                Cycle
              </Label>
              <Select value={cycleId} onValueChange={setCycleId}>
                <SelectTrigger id="valider-cycle" className="h-10 w-full">
                  <Layers className="mr-1.5 size-4 shrink-0 text-emerald-600" />
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
              <Label htmlFor="valider-niveau" className="text-xs font-medium">
                Niveau
              </Label>
              <Select value={niveau} onValueChange={setNiveau}>
                <SelectTrigger id="valider-niveau" className="h-10 w-full">
                  <BarChart3 className="mr-1.5 size-4 shrink-0 text-emerald-600" />
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
              <Label htmlFor="valider-classe" className="text-xs font-medium">
                Classe <span className="text-rose-500">*</span>
              </Label>
              <Select
                value={classeId || "none"}
                onValueChange={(v) => setClasseId(v === "none" ? "" : v)}
              >
                <SelectTrigger id="valider-classe" className="h-10 w-full">
                  <School className="mr-1.5 size-4 shrink-0 text-emerald-600" />
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

          {/* Année scolaire (auto-présélectionnée) */}
          <div className="space-y-1.5">
            <Label htmlFor="valider-annee" className="text-xs font-medium">
              Année scolaire <span className="text-rose-500">*</span>
            </Label>
            <Select value={anneeId || "none"} onValueChange={(v) => setAnneeId(v === "none" ? "" : v)}>
              <SelectTrigger id="valider-annee" className="h-10 w-full">
                <Calendar className="mr-1.5 size-4 shrink-0 text-emerald-600" />
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
              <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Sparkles className="size-3 shrink-0 text-emerald-600" aria-hidden="true" />
                Année active présélectionnée : {activeAnnee.libelle}
              </p>
            )}
          </div>

          {/* Notes staff (optionnel — visible par le parent) */}
          <div className="space-y-1.5">
            <Label htmlFor="valider-notes" className="text-xs font-medium">
              Notes staff (optionnel)
            </Label>
            <Textarea
              id="valider-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Remarques internes visibles par le parent (ex : « Inscription confirmée, passer au secrétariat pour les frais »)."
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Optionnel — visible par le parent sur la page de suivi.
            </p>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-10 w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="success"
              disabled={!isValid || isPending}
              className="h-10 w-full sm:w-auto"
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
// Dialog de rejet (premium)
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
            {/* Badge rond gradient rose (from-rose-500 to-rose-700) avec icône XCircle */}
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-md shadow-rose-900/20">
              <XCircle className="size-5" />
            </span>
            Rejeter la pré-inscription
          </DialogTitle>
          <DialogDescription>
            Indiquez le motif du rejet pour{" "}
            <span className="font-semibold text-foreground break-words">
              {eleveNomComplet(pre)}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rejeter-motif" className="text-xs font-medium">
              Motif du rejet <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="rejeter-motif"
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Ex : Dossier incomplet, veuillez fournir l'acte de naissance. / Doublon avec un élève déjà inscrit."
              rows={4}
              autoFocus
              className="focus-visible:ring-rose-500/40"
            />
            <p className="text-xs text-muted-foreground">
              Minimum 5 caractères. Ce motif sera visible par le parent sur la
              page de suivi.
            </p>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-10 w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!isValid || isPending}
              className="h-10 w-full sm:w-auto"
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
// Dialog de détail (premium)
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
            {/* Badge rond gradient emerald→gold avec icône Eye */}
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-md shadow-emerald-900/20">
              <Eye className="size-5" />
            </span>
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
          {/* Statut (en haut, badge renforcé) */}
          <div className="flex items-center justify-between rounded-lg border border-emerald-200/60 bg-emerald-50/40 p-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
            <span className="text-xs font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
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
          <DetailSection title="Élève" icon={User} tone="emerald">
            <DetailRow
              icon={User}
              label="Nom complet"
              value={eleveNomComplet(pre) || "—"}
            />
            <DetailRow
              icon={Calendar}
              label="Date de naissance"
              value={
                pre.eleve_date_naissance
                  ? formatDate(pre.eleve_date_naissance)
                  : "—"
              }
            />
            <DetailRow
              icon={School}
              label="Lieu de naissance"
              value={pre.eleve_lieu_naissance || "—"}
            />
            <DetailRow
              icon={User}
              label="Sexe"
              value={sexeLabel(pre.eleve_sexe)}
            />
            <DetailRow
              icon={Layers}
              label="Catégorie"
              value={categorieLabel(pre.eleve_categorie)}
            />
            {pre.eleve_ancien_etablissement && (
              <DetailRow
                icon={School}
                label="Ancien établissement"
                value={pre.eleve_ancien_etablissement}
              />
            )}
          </DetailSection>

          {/* Tuteur */}
          <DetailSection title="Tuteur / Parent" icon={Users} tone="amber">
            <DetailRow
              icon={Users}
              label="Nom complet"
              value={tuteurNomComplet(pre) || "—"}
            />
            <DetailRow
              icon={Phone}
              label="Téléphone"
              value={pre.tuteur_telephone || "—"}
            />
            <DetailRow
              icon={MailOpen}
              label="Email"
              value={pre.tuteur_email || "—"}
            />
            <DetailRow
              icon={User}
              label="Lien de parenté"
              value={lienParenteLabel(pre.tuteur_lien_parente)}
            />
          </DetailSection>

          {/* Classe souhaitée & notes */}
          <DetailSection title="Classe souhaitée & notes" icon={Send} tone="emerald">
            <DetailRow
              icon={School}
              label="Classe"
              value={classeLibelle(pre)}
            />

            {/* Notes parent : card avec icône MessageSquare + fond amber/10 */}
            {pre.notes_parent && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/60 bg-amber-50/60 p-3 dark:border-amber-800/40 dark:bg-amber-950/20">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <MessageSquare className="size-3.5" />
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200">
                    Message du parent
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                    {pre.notes_parent}
                  </p>
                </div>
              </div>
            )}

            {/* Notes staff : card avec icône StickyNote + fond emerald/10 */}
            {pre.notes_staff && (
              <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200/60 bg-emerald-50/60 p-3 dark:border-emerald-800/40 dark:bg-emerald-950/20">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <StickyNote className="size-3.5" />
                </span>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
                    Notes staff
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                    {pre.notes_staff}
                  </p>
                </div>
              </div>
            )}

            {/* Élève créé : badge emerald "✓ Élève créé (ID: xxx)" */}
            {pre.eleve_cree_id && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">
                <CheckCircle2 className="size-3.5" />
                Élève créé (ID : {pre.eleve_cree_id.slice(0, 8)}…)
              </div>
            )}
          </DetailSection>
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={onClose}
            className="h-10 w-full sm:w-auto"
          >
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants du dialog de détail
// ─────────────────────────────────────────────────────────────────────────────

function DetailSection({
  title,
  icon: Icon,
  tone,
  children,
}: {
  title: string;
  icon: React.ElementType;
  tone: "emerald" | "amber";
  children: React.ReactNode;
}) {
  const badgeCls =
    tone === "emerald"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300";
  return (
    <GlassCard variant="mobile" noHover noAnimation className="space-y-3 p-4">
      {/* SectionHeader : icône dans badge rond emerald/15 (ou amber/15) */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full",
            badgeCls,
          )}
        >
          <Icon className="size-4" />
        </span>
        <h3 className="font-display text-sm font-semibold text-forest">
          {title}
        </h3>
      </div>
      <div className="space-y-2">{children}</div>
    </GlassCard>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: React.ReactNode;
}) {
  return (
    // flex items-start (PAS items-center) + mt-0.5 sur l'icône badge
    // (BUG À ÉVITER #4) pour aligner verticalement avec la première ligne
    // du label/value quand ils passent sur 2 lignes.
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="break-words text-sm font-medium leading-snug text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}
