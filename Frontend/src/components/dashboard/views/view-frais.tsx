"use client";

/**
 * ScolaGest — Vue « Frais & échéanciers » (Phase 3 — Refonte Forêt EdTech).
 *
 * Affiche la grille des frais configurés pour l'année scolaire active,
 * groupés par type (INSCRIPTION, SCOLARITE, EXAMEN, ANNEXE). Chaque carte
 * montre : libellé, périmètre (cycle/classe/établissement), catégorie,
 * montant_total, nb_versements et un résumé des échéances.
 *
 * Refonte Forêt EdTech :
 *  - Hero header GlassCard desktop + badge rond gradient emerald→gold
 *    (Coins) + pill « Phase 3 » outline + pill « Année active » emerald.
 *  - 4 StatCards de résumé : Total frais (emerald), Frais actifs (forest),
 *    Montant total (gold), Échéances (amber).
 *  - Sections par type : badge rond gradient (emerald→gold / emerald→amber /
 *    amber→terracotta / gold→amber) avec icône contextuelle + compteur pill.
 *  - FraisCard : GlassCard adaptive (hover lift) + entête font-display +
 *    badges périmètre/catégorie renforcés (border-300 bg-100 text-800) +
 *    montant text-xl font-bold emerald + badges gold/emerald/amber pour
 *    les 3 InfoRows + barre de progression échéances/versements + actions
 *    Modifier/Supprimer avec `title` natif (icônes seules mobile, icône+texte
 *    desktop).
 *  - Empty states premium : KentePattern bg + badge rond coloré + bouton
 *    « Créer un frais » (variant success) sur l'état vide.
 *
 * Actions : « Nouveau frais » (variant success), éditer, supprimer (AlertDialog).
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query (fetchActiveAnnee / fetchFrais),
 * query keys, mutation deleteFrais + invalidateQueries, types Frais/TypeFrais,
 * groupement TYPE_ORDER/TYPE_ICONS, helper TypeFraisBadge.
 */

import * as React from "react";
import {
  useQuery,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import {
  Coins,
  Plus,
  Pencil,
  Trash2,
  AlertCircle,
  CalendarDays,
  GraduationCap,
  FileText,
  Layers,
  Loader2,
  Wallet,
  CheckCircle2,
  Sparkles,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchActiveAnnee,
  anneesKeys,
} from "@/lib/api-students";
import {
  fetchFrais,
  deleteFrais,
  fraisKeys,
} from "@/lib/api-caisse";
import { formatFCFA, formatDateShort } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";
import type { Frais, TypeFrais } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { StatCard } from "@/components/ds/stat-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { TypeFraisBadge, TYPE_FRAIS_LABEL } from "@/components/caisse/caisse-badges";
import { FraisFormDialog } from "@/components/frais/frais-form-dialog";

const TYPE_ORDER: TypeFrais[] = [
  "INSCRIPTION",
  "SCOLARITE",
  "EXAMEN",
  "ANNEXE",
];

const TYPE_ICONS: Record<TypeFrais, LucideIcon> = {
  INSCRIPTION: GraduationCap,
  SCOLARITE: Layers,
  EXAMEN: FileText,
  ANNEXE: Coins,
};

/**
 * Dégradés emerald→gold pour les badges ronds de section (par type de frais).
 *  - INSCRIPTION : emerald→gold (frais ponctuel, couleur principale)
 *  - SCOLARITE   : emerald→amber (échelonné, secondaire)
 *  - EXAMEN      : amber→terracotta (alerte chaude, examen blanc)
 *  - ANNEXE      : gold→amber (premium annexe)
 */
const TYPE_GRADIENTS: Record<TypeFrais, string> = {
  INSCRIPTION: "from-emerald-600 to-amber-500",
  SCOLARITE: "from-emerald-600 to-amber-400",
  EXAMEN: "from-amber-500 to-terracotta",
  ANNEXE: "from-amber-400 to-gold-dark",
};

export default function FraisView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const etablissement = useAuthStore((s) => s.etablissement);

  // Année active
  const {
    data: activeAnnee,
    isLoading: loadingAnnee,
    isError: anneeError,
    refetch: refetchAnnee,
  } = useQuery({
    queryKey: anneesKeys.active(),
    queryFn: fetchActiveAnnee,
  });

  // Liste des frais pour l'année active
  const {
    data: fraisList,
    isLoading: loadingFrais,
    isError: fraisError,
    refetch: refetchFrais,
  } = useQuery({
    queryKey: fraisKeys.list(activeAnnee?.id),
    queryFn: () => fetchFrais(activeAnnee!.id),
    enabled: !!activeAnnee?.id,
  });

  // États locaux
  const [formOpen, setFormOpen] = React.useState(false);
  const [editingFrais, setEditingFrais] = React.useState<Frais | null>(null);

  function openCreate() {
    setEditingFrais(null);
    setFormOpen(true);
  }
  function openEdit(f: Frais) {
    setEditingFrais(f);
    setFormOpen(true);
  }

  // Suppression
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFrais(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: fraisKeys.all });
      toast({
        title: "Frais supprimé",
        description: "Le frais et ses échéances ont été supprimés.",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error ? err.message : "Impossible de supprimer ce frais.",
        variant: "destructive",
      });
    },
  });

  // ─── États ────────────────────────────────────────────────────────────────
  if (!etablissement) {
    return (
      <FraisShell>
        <EmptyState
          icon={AlertCircle}
          tone="amber"
          title="Sélectionnez un établissement"
          description="Choisissez un établissement dans la barre latérale pour configurer ses frais."
        />
      </FraisShell>
    );
  }

  if (loadingAnnee) {
    return (
      <FraisShell>
        <Skeleton className="h-10 w-full max-w-sm" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      </FraisShell>
    );
  }

  if (anneeError || !activeAnnee) {
    return (
      <FraisShell>
        <EmptyState
          icon={CalendarDays}
          tone="amber"
          title="Aucune année scolaire active"
          description="Activez une année scolaire dans « Années scolaires » avant de configurer les frais."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchAnnee()}
              className="border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800/60 dark:text-amber-300"
            >
              <RotateCcw className="size-3.5" />
              Réessayer
            </Button>
          }
        />
      </FraisShell>
    );
  }

  // Groupement par type
  const groups = TYPE_ORDER.map((type) => ({
    type,
    items: (fraisList ?? []).filter((f) => f.type_frais === type),
  }));

  // Résumé statistique pour les 4 StatCards
  const allFrais = fraisList ?? [];
  const totalFrais = allFrais.length;
  const totalActifs = allFrais.filter((f) => f.actif).length;
  const montantTotalSum = allFrais.reduce(
    (s, f) => s + (f.montant_total ?? 0),
    0,
  );
  const totalEcheances = allFrais.reduce(
    (s, f) => s + (f.nb_versements_defaut ?? 0),
    0,
  );

  return (
    <FraisShell
      anneeLabel={activeAnnee.libelle}
      onNew={openCreate}
      newDisabled={false}
    >
      {/* ─── 4 StatCards de résumé ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Coins}
          tone="emerald"
          label="Total frais"
          value={totalFrais}
          hint={loadingFrais ? "chargement…" : "configurés cette année"}
          delay={0}
        />
        <StatCard
          icon={CheckCircle2}
          tone="forest"
          label="Frais actifs"
          value={totalActifs}
          hint={
            totalFrais > 0
              ? `${totalFrais - totalActifs} inactif(s)`
              : "—"
          }
          delay={0.05}
        />
        <StatCard
          icon={Wallet}
          tone="gold"
          label="Montant total"
          value={formatFCFA(montantTotalSum)}
          hint="somme des frais"
          delay={0.1}
        />
        <StatCard
          icon={CalendarDays}
          tone="amber"
          label="Échéances"
          value={totalEcheances}
          hint="versements attendus"
          delay={0.15}
        />
      </div>

      <KentePattern variant="separator" className="my-1" />

      {loadingFrais ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : fraisError ? (
        <EmptyState
          icon={AlertCircle}
          tone="rose"
          title="Erreur de chargement"
          description="Impossible de charger les frais. Vérifiez que le backend est démarré puis réessayez."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchFrais()}
              className="border-rose-300 text-rose-800 hover:bg-rose-50 dark:border-rose-800/60 dark:text-rose-300"
            >
              <RotateCcw className="size-3.5" />
              Réessayer
            </Button>
          }
        />
      ) : (fraisList ?? []).length === 0 ? (
        <EmptyState
          icon={Coins}
          tone="emerald"
          title="Aucun frais configuré"
          description="Cliquez sur « Nouveau frais » pour créer votre premier frais (inscription, scolarité, examen, annexe)."
          action={
            <Button variant="success" onClick={openCreate}>
              <Plus className="size-4" />
              Créer un frais
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => {
            const Icon = TYPE_ICONS[g.type];
            const gradient = TYPE_GRADIENTS[g.type];
            return (
              <section key={g.type} className="space-y-2.5">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-sm",
                      gradient,
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <h2 className="font-display text-base font-semibold tracking-tight text-forest">
                    {TYPE_FRAIS_LABEL[g.type]}
                  </h2>
                  <Badge
                    variant="outline"
                    className="border-emerald-300 bg-emerald-100 text-[10px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
                  >
                    {g.items.length}
                  </Badge>
                </div>
                {g.items.length === 0 ? (
                  <p className="rounded-md border border-dashed border-muted-foreground/20 bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                    Aucun frais de type « {TYPE_FRAIS_LABEL[g.type]} ».
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {g.items.map((f, idx) => (
                      <FraisCard
                        key={f.id}
                        frais={f}
                        onEdit={() => openEdit(f)}
                        onDelete={() => deleteMutation.mutate(f.id)}
                        deleting={deleteMutation.isPending}
                        index={idx}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <FraisFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        frais={editingFrais}
        anneeId={activeAnnee.id}
      />
    </FraisShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell
// ─────────────────────────────────────────────────────────────────────────────

function FraisShell({
  children,
  anneeLabel,
  onNew,
  newDisabled,
}: {
  children: React.ReactNode;
  anneeLabel?: string;
  onNew?: () => void;
  newDisabled?: boolean;
}) {
  return (
    <div className="space-y-4">
      <KentePattern variant="strip" position="top" />

      {/* ─── Hero header premium ──────────────────────────────────────── */}
      <GlassCard variant="desktop" noHover className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Badge rond gradient emerald→gold avec icône Coins */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <Coins className="size-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                  Frais &amp; échéanciers
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50/60 px-2 py-0.5 align-middle text-[11px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <Sparkles className="size-3" />
                  Phase 3
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Paramétrez les frais (inscription, scolarité, examen, annexes)
                et leurs échéances.
              </p>
              {anneeLabel ? (
                <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  Année active : {anneeLabel}
                </span>
              ) : null}
            </div>
          </div>
          {onNew ? (
            <Button
              variant="success"
              onClick={onNew}
              disabled={newDisabled}
              className="w-full sm:w-auto"
            >
              <Plus className="size-4" />
              Nouveau frais
            </Button>
          ) : null}
        </div>
      </GlassCard>

      <KentePattern variant="separator" className="my-1" />

      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carte d'un frais
// ─────────────────────────────────────────────────────────────────────────────

function FraisCard({
  frais,
  onEdit,
  onDelete,
  deleting,
  index = 0,
}: {
  frais: Frais;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
  index?: number;
}) {
  const scopeLabel = frais.classe
    ? `Classe ${frais.classe.libelle}`
    : frais.cycle
      ? `Cycle ${frais.cycle.libelle}`
      : "Tout l'établissement";
  const categorieLabel =
    frais.categorie === "AFFECTE"
      ? "Affecté"
      : frais.categorie === "NON_AFFECTE"
        ? "Non affecté"
        : "Tarif unique";
  const echeances = frais.echeances ?? [];
  const firstDate = echeances[0]?.date_limite;
  const lastDate = echeances[echeances.length - 1]?.date_limite;

  // Ratio échéances configurées / versements par défaut (pour la barre de progression).
  const ratio =
    frais.nb_versements_defaut > 0
      ? Math.min(
          100,
          Math.round(
            (echeances.length / frais.nb_versements_defaut) * 100,
          ),
        )
      : 0;

  return (
    <GlassCard
      variant="adaptive"
      delay={Math.min(index * 0.05, 0.3)}
      className="flex h-full flex-col"
    >
      {/* ─── En-tête : libellé + TypeFraisBadge ──────────────────────── */}
      <div className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="break-words font-display text-base font-semibold leading-snug text-forest">
            {frais.libelle}
          </h3>
          <TypeFraisBadge type={frais.type_frais} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge
            variant="outline"
            className="border-emerald-200 bg-emerald-50 text-[10px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            {scopeLabel}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] font-medium",
              frais.categorie === "AFFECTE"
                ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200"
                : frais.categorie === "NON_AFFECTE"
                  ? "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
                  : "border-muted-foreground/30 bg-muted text-muted-foreground",
            )}
          >
            {categorieLabel}
          </Badge>
          {!frais.actif ? (
            <Badge
              variant="outline"
              className="border-terracotta/40 bg-terracotta/10 text-[10px] font-medium text-terracotta"
            >
              Inactif
            </Badge>
          ) : null}
        </div>
      </div>

      {/* ─── Bloc info (s'étire pour égaliser les hauteurs en grid) ──── */}
      <div className="flex-1 space-y-3">
        {/* Montant total avec badge gold */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            <span className="flex size-5 items-center justify-center rounded-md bg-gold/15 text-gold-dark">
              <Wallet className="size-3" />
            </span>
            Montant total
          </div>
          <span className="font-mono text-xl font-bold text-emerald-700 dark:text-emerald-300">
            {formatFCFA(frais.montant_total)}
          </span>
        </div>

        {/* Versements par défaut avec badge emerald */}
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="flex size-5 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <Layers className="size-3" />
            </span>
            Versements par défaut
          </div>
          <span className="font-semibold text-foreground">
            {frais.nb_versements_defaut}
          </span>
        </div>

        {/* Échéances avec badge amber */}
        {echeances.length > 0 ? (
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <span className="flex size-5 items-center justify-center rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
                <CalendarDays className="size-3" />
              </span>
              Échéances
            </div>
            <span className="text-right font-medium text-muted-foreground">
              {echeances.length} ·{" "}
              {firstDate ? formatDateShort(firstDate) : "—"}
              {lastDate && lastDate !== firstDate
                ? ` → ${formatDateShort(lastDate)}`
                : ""}
            </span>
          </div>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            Aucune échéance configurée.
          </p>
        )}

        {/* Barre de progression échéances configurées / versements par défaut */}
        {frais.nb_versements_defaut > 0 ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Échéancier</span>
              <span className="tabular-nums">
                {echeances.length}/{frais.nb_versements_defaut}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  ratio === 100
                    ? "bg-emerald-500"
                    : ratio >= 50
                      ? "bg-amber-500"
                      : "bg-terracotta",
                )}
                style={{ width: `${ratio}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {/* ─── Actions : Modifier / Supprimer ──────────────────────────── */}
      <div className="mt-3 flex justify-end gap-1 border-t pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
          title="Modifier ce frais"
          aria-label={`Modifier le frais « ${frais.libelle} »`}
        >
          <Pencil className="size-3.5" />
          <span className="hidden lg:inline">Modifier</span>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-rose-50 dark:hover:bg-rose-950/40"
              disabled={deleting}
              title="Supprimer ce frais"
              aria-label={`Supprimer le frais « ${frais.libelle} »`}
            >
              {deleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              <span className="hidden lg:inline">Supprimer</span>
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce frais ?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est irréversible. Le frais « {frais.libelle} »
                et ses {echeances.length} échéance(s) seront supprimés. Les
                encaissements déjà enregistrés ne sont pas affectés.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                Supprimer définitivement
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// États vides premium (KentePattern bg + badge rond coloré)
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  tone,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  tone: "emerald" | "amber" | "rose";
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  const cls = {
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
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
