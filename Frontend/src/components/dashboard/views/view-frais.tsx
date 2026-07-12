"use client";

/**
 * ScolaGest — Vue « Frais & échéanciers » (Phase 3).
 *
 * Affiche la grille des frais configurés pour l'année scolaire active,
 * groupés par type (INSCRIPTION, SCOLARITE, EXAMEN, ANNEXE). Chaque carte
 * montre : libellé, périmètre (cycle/classe/établissement), catégorie,
 * montant_total, nb_versements et un résumé des échéances.
 *
 * Actions : « Nouveau frais » (emerald), éditer, supprimer (avec confirm).
 *
 * États : pas d'établissement, pas d'année active, chargement, vide, erreur.
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

const TYPE_ICONS: Record<TypeFrais, React.ComponentType<{ className?: string }>> = {
  INSCRIPTION: GraduationCap,
  SCOLARITE: Layers,
  EXAMEN: FileText,
  ANNEXE: Coins,
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
  } = useQuery({
    queryKey: anneesKeys.active(),
    queryFn: fetchActiveAnnee,
  });

  // Liste des frais pour l'année active
  const {
    data: fraisList,
    isLoading: loadingFrais,
    isError: fraisError,
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
        />
      </FraisShell>
    );
  }

  // Groupement par type
  const groups = TYPE_ORDER.map((type) => ({
    type,
    items: (fraisList ?? []).filter((f) => f.type_frais === type),
  }));

  return (
    <FraisShell
      anneeLabel={activeAnnee.libelle}
      onNew={openCreate}
      newDisabled={false}
    >
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
        />
      ) : (fraisList ?? []).length === 0 ? (
        <EmptyState
          icon={Coins}
          tone="emerald"
          title="Aucun frais configuré"
          description="Cliquez sur « Nouveau frais » pour créer votre premier frais (inscription, scolarité, examen, annexe)."
        />
      ) : (
        <div className="space-y-6">
          {groups.map((g) => {
            const Icon = TYPE_ICONS[g.type];
            return (
              <section key={g.type} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-emerald-600" />
                  <h2 className="font-display text-sm font-semibold tracking-tight">
                    {TYPE_FRAIS_LABEL[g.type]}
                  </h2>
                  <Badge
                    variant="outline"
                    className="border-muted-foreground/20 bg-muted/40 text-[10px] text-muted-foreground"
                  >
                    {g.items.length}
                  </Badge>
                </div>
                {g.items.length === 0 ? (
                  <p className="rounded-md border border-dashed bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
                    Aucun frais de type « {TYPE_FRAIS_LABEL[g.type]} ».
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {g.items.map((f) => (
                      <FraisCard
                        key={f.id}
                        frais={f}
                        onEdit={() => openEdit(f)}
                        onDelete={() => deleteMutation.mutate(f.id)}
                        deleting={deleteMutation.isPending}
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Coins className="size-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">
              Frais &amp; échéanciers
            </h1>
            <p className="text-sm text-muted-foreground">
              Paramétrez les frais (inscription, scolarité, examen, annexes)
              et leurs échéances.
              {anneeLabel ? (
                <span className="ml-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  Année active : {anneeLabel}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        {onNew ? (
          <Button
            variant="success"
            onClick={onNew}
            disabled={newDisabled}
          >
            <Plus className="size-4" />
            Nouveau frais
          </Button>
        ) : null}
      </div>
      <KentePattern variant="separator" className="my-4" />
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
}: {
  frais: Frais;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
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

  return (
    <GlassCard variant="adaptive" noHover className="group relative overflow-hidden">
      <div className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base font-semibold leading-tight">
            {frais.libelle}
          </h3>
          <TypeFraisBadge type={frais.type_frais} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <Badge
            variant="outline"
            className="border-muted-foreground/20 bg-muted/40 font-normal"
          >
            {scopeLabel}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "font-normal",
              frais.categorie === "AFFECTE"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : frais.categorie === "NON_AFFECTE"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-muted-foreground/20 bg-muted/40 text-muted-foreground",
            )}
          >
            {categorieLabel}
          </Badge>
          {!frais.actif ? (
            <Badge
              variant="outline"
              className="border-rose-200 bg-rose-50 text-rose-700"
            >
              Inactif
            </Badge>
          ) : null}
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-[11px] uppercase text-muted-foreground">
            Montant total
          </span>
          <span className="font-mono text-lg font-bold text-emerald-700 dark:text-emerald-300">
            {formatFCFA(frais.montant_total)}
          </span>
        </div>
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">Versements par défaut</span>
          <span className="font-medium">{frais.nb_versements_defaut}</span>
        </div>
        {echeances.length > 0 ? (
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted-foreground">Échéances</span>
            <span className="font-medium text-muted-foreground">
              {echeances.length} ·{" "}
              {firstDate ? formatDateShort(firstDate) : "—"}
              {lastDate && lastDate !== firstDate
                ? ` → ${formatDateShort(lastDate)}`
                : ""}
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            Aucune échéance configurée.
          </p>
        )}

        <div className="flex justify-end gap-1 border-t pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            className="text-emerald-700 hover:bg-emerald-50"
          >
            <Pencil className="size-3.5" />
            Modifier
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-rose-50"
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Supprimer
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
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// États vides
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  tone,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: "emerald" | "amber" | "rose";
  title: string;
  description: string;
}) {
  const cls = {
    emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  }[tone];
  return (
    <GlassCard variant="adaptive" noHover>
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-full",
            cls,
          )}
        >
          <Icon className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="text-base font-medium">{title}</p>
          <p className="max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
    </GlassCard>
  );
}
