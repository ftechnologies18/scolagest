"use client";

/**
 * ScolaGest — Liste des affectations prof/matière/classe (module Enseignant — Phase A).
 *
 * Vue principale du module Affectations :
 *  - Tableau (shadcn Table) avec : enseignant (nom), matière (libellé),
 *    classe, volume hebdo, titulaire (badge), actions (supprimer).
 *  - Bouton « Nouvelle affectation » (emerald) → dialog avec selects :
 *    enseignant, matière, classe, volume horaire hebdo, titulaire (switch).
 *  - Année scolaire présélectionnée sur l'année active (fetchActiveAnnee).
 *  - Alerte de surcharge : si après création le résultat `alerte_surcharge`
 *    est true → toast warning « Charge totale: Xh/semaine (> 25h) ».
 *  - Suppression avec confirmation.
 *
 * États : pas d'établissement, pas d'année active, chargement, vide, erreur.
 */

import * as React from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CalendarDays,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Star,
  Clock,
  X,
  AlertTriangle,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchAffectations,
  createAffectation,
  deleteAffectation,
  fetchEnseignants,
  fetchMatieres,
  type AffectationCours,
  type AffectationDTO,
} from "@/lib/api-enseignant";
import {
  fetchActiveAnnee,
  fetchClasses,
  anneesKeys,
  classesKeys,
} from "@/lib/api-students";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers & constantes
// ─────────────────────────────────────────────────────────────────────────────

export const affectationsKeys = {
  all: ["affectations"] as const,
  list: (anneeScolaireId?: string) =>
    [...affectationsKeys.all, "list", { anneeScolaireId }] as const,
};

const SEUIL_SURCHARGE_H = 25;

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function AffectationsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const etablissement = useAuthStore((s) => s.etablissement);

  // Année scolaire active (présélection)
  const {
    data: activeAnnee,
    isLoading: loadingAnnee,
    isError: anneeError,
  } = useQuery({
    queryKey: anneesKeys.active(),
    queryFn: fetchActiveAnnee,
    enabled: !!etablissement,
  });

  // Liste des affectations pour l'année active
  const {
    data: affectations,
    isLoading: loadingAffectations,
    isError: affectationsError,
    error,
  } = useQuery({
    queryKey: affectationsKeys.list(activeAnnee?.id),
    queryFn: () => fetchAffectations(activeAnnee!.id),
    enabled: !!activeAnnee?.id,
  });

  // Dialogs
  const [formOpen, setFormOpen] = React.useState(false);

  // ─── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (dto: AffectationDTO) => createAffectation(dto),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: affectationsKeys.all,
      });
      if (result.alerte_surcharge) {
        toast({
          title: "⚠️ Affectation créée — surcharge détectée",
          description: `Charge totale : ${result.charge_totale_hebdo}h/semaine (> ${SEUIL_SURCHARGE_H}h).`,
        });
      } else {
        toast({
          title: "Affectation créée",
          description: `Charge totale de l'enseignant : ${result.charge_totale_hebdo}h/semaine.`,
        });
      }
      setFormOpen(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de créer l'affectation.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAffectation(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: affectationsKeys.all,
      });
      toast({
        title: "Affectation supprimée",
        description: "L'affectation a été retirée de l'année scolaire.",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de supprimer cette affectation.",
        variant: "destructive",
      });
    },
  });

  function handleSubmit(dto: AffectationDTO) {
    createMutation.mutate(dto);
  }

  // ─── États ────────────────────────────────────────────────────────────────

  if (!etablissement) {
    return (
      <AffectationsShell>
        <EmptyState
          icon={AlertCircle}
          tone="amber"
          title="Sélectionnez un établissement"
          description="Choisissez un établissement dans la barre latérale pour gérer ses affectations."
        />
      </AffectationsShell>
    );
  }

  if (loadingAnnee) {
    return (
      <AffectationsShell>
        <Skeleton className="h-10 w-full max-w-sm" />
        <Card>
          <CardContent className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </AffectationsShell>
    );
  }

  if (anneeError || !activeAnnee) {
    return (
      <AffectationsShell>
        <EmptyState
          icon={CalendarDays}
          tone="amber"
          title="Aucune année scolaire active"
          description="Activez une année scolaire dans « Années scolaires » avant de gérer les affectations."
        />
      </AffectationsShell>
    );
  }

  return (
    <AffectationsShell
      anneeLabel={activeAnnee.libelle}
      onNew={() => setFormOpen(true)}
    >
      {loadingAffectations ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : affectationsError ? (
        <EmptyState
          icon={AlertCircle}
          tone="rose"
          title="Erreur de chargement"
          description={
            error instanceof Error
              ? error.message
              : "Impossible de charger les affectations. Vérifiez que le backend est démarré puis réessayez."
          }
        />
      ) : (affectations ?? []).length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          tone="emerald"
          title="Aucune affectation"
          description="Cliquez sur « Nouvelle affectation » pour assigner un enseignant à une matière et une classe."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Enseignant</TableHead>
                    <TableHead className="min-w-[160px]">Matière</TableHead>
                    <TableHead className="min-w-[140px]">Classe</TableHead>
                    <TableHead className="text-right">Volume hebdo</TableHead>
                    <TableHead>Titulaire</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(affectations ?? []).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <div className="font-medium">
                          {a.enseignant
                            ? [a.enseignant.prenoms, a.enseignant.nom]
                                .filter(Boolean)
                                .join(" ")
                                .trim() || "—"
                            : "—"}
                        </div>
                        {a.enseignant?.matricule ? (
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {a.enseignant.matricule}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {a.matiere?.libelle ?? "—"}
                        </div>
                        {a.matiere?.code ? (
                          <div className="font-mono text-[10px] text-muted-foreground">
                            {a.matiere.code}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {a.classe ? (
                          <Badge
                            variant="outline"
                            className="border-muted-foreground/20 bg-muted/40 font-normal"
                          >
                            {a.classe.libelle}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 font-mono text-xs">
                          <Clock className="size-3 text-muted-foreground" />
                          {a.volume_horaire_hebdo}h
                        </div>
                      </TableCell>
                      <TableCell>
                        {a.est_titulaire ? (
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                          >
                            <Star className="size-3" />
                            Titulaire
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Non
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-rose-50"
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="size-3.5" />
                              <span className="sr-only">Supprimer</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Supprimer cette affectation ?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Cette action est irréversible. L&apos;affectation
                                de l&apos;enseignant à la matière et la classe
                                sera supprimée pour l&apos;année scolaire{" "}
                                {activeAnnee.libelle}.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Annuler</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(a.id)}
                                className="bg-destructive text-white hover:bg-destructive/90"
                              >
                                Supprimer définitivement
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <AffectationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        anneeScolaireId={activeAnnee.id}
        anneeLabel={activeAnnee.libelle}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending}
      />
    </AffectationsShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell (titre + bouton)
// ─────────────────────────────────────────────────────────────────────────────

function AffectationsShell({
  children,
  anneeLabel,
  onNew,
}: {
  children: React.ReactNode;
  anneeLabel?: string;
  onNew?: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <CalendarDays className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Affectations</h1>
            <p className="text-sm text-muted-foreground">
              Assignez les enseignants aux matières et classes pour
              l&apos;année scolaire en cours.
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
            onClick={onNew}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Plus className="size-4" />
            Nouvelle affectation
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog : formulaire de création d'affectation
// ─────────────────────────────────────────────────────────────────────────────

interface FormState {
  enseignant_id: string;
  matiere_id: string;
  classe_id: string;
  volume_horaire_hebdo: string;
  est_titulaire: boolean;
}

function AffectationFormDialog({
  open,
  onOpenChange,
  anneeScolaireId,
  anneeLabel,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anneeScolaireId: string;
  anneeLabel: string;
  onSubmit: (dto: AffectationDTO) => void;
  submitting: boolean;
}) {
  const etablissement = useAuthStore((s) => s.etablissement);

  const [form, setForm] = React.useState<FormState>({
    enseignant_id: "",
    matiere_id: "",
    classe_id: "",
    volume_horaire_hebdo: "2",
    est_titulaire: false,
  });
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    setForm({
      enseignant_id: "",
      matiere_id: "",
      classe_id: "",
      volume_horaire_hebdo: "2",
      est_titulaire: false,
    });
  }, [open]);

  // Charge les listes nécessaires au formulaire
  const { data: enseignants, isLoading: loadingEnseignants } = useQuery({
    queryKey: ["enseignants", "list", { all: true }] as const,
    queryFn: () => fetchEnseignants({}),
    enabled: !!etablissement && open,
  });

  const { data: matieres, isLoading: loadingMatieres } = useQuery({
    queryKey: ["matieres", "list"] as const,
    queryFn: fetchMatieres,
    enabled: !!etablissement && open,
  });

  const { data: classes, isLoading: loadingClasses } = useQuery({
    queryKey: classesKeys.list(etablissement?.id),
    queryFn: () => fetchClasses(etablissement?.id),
    enabled: !!etablissement && open,
  });

  // Enseignants actifs uniquement (plus pertinent pour une affectation)
  const activeEnseignants = React.useMemo(
    () =>
      (enseignants ?? []).filter((e) => e.statut === "ACTIF"),
    [enseignants],
  );
  // Matières actives uniquement
  const activeMatieres = React.useMemo(
    () => (matieres ?? []).filter((m) => m.actif),
    [matieres],
  );

  const ensValid = form.enseignant_id !== "";
  const matValid = form.matiere_id !== "";
  const clsValid = form.classe_id !== "";
  const volValid =
    !Number.isNaN(Number(form.volume_horaire_hebdo)) &&
    Number(form.volume_horaire_hebdo) > 0;
  const formValid = ensValid && matValid && clsValid && volValid;

  function handleSave() {
    setSubmitted(true);
    if (!formValid) return;
    const dto: AffectationDTO = {
      enseignant_id: form.enseignant_id,
      matiere_id: form.matiere_id,
      classe_id: form.classe_id,
      annee_scolaire_id: anneeScolaireId,
      volume_horaire_hebdo: Number(form.volume_horaire_hebdo),
      est_titulaire: form.est_titulaire,
    };
    onSubmit(dto);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouvelle affectation</DialogTitle>
          <DialogDescription>
            Assignez un enseignant à une matière et une classe pour
            l&apos;année {anneeLabel}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Enseignant */}
          <div className="space-y-1.5">
            <Label htmlFor="aff-ens">
              Enseignant <span className="text-destructive">*</span>
            </Label>
            {loadingEnseignants ? (
              <Skeleton className="h-9 w-full" />
            ) : activeEnseignants.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Aucun enseignant actif. Ajoutez d&apos;abord un enseignant dans
                la page « Enseignants ».
              </p>
            ) : (
              <Select
                value={form.enseignant_id}
                onValueChange={(v) =>
                  setForm({ ...form, enseignant_id: v })
                }
              >
                <SelectTrigger id="aff-ens" aria-invalid={submitted && !ensValid}>
                  <SelectValue placeholder="Choisir un enseignant" />
                </SelectTrigger>
                <SelectContent>
                  {activeEnseignants.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {[e.prenoms, e.nom].filter(Boolean).join(" ").trim()}{" "}
                      <span className="text-[10px] text-muted-foreground">
                        ({e.matricule || "sans matricule"})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {submitted && !ensValid ? (
              <p className="text-[11px] text-destructive">
                Sélectionnez un enseignant.
              </p>
            ) : null}
          </div>

          {/* Matière */}
          <div className="space-y-1.5">
            <Label htmlFor="aff-mat">
              Matière <span className="text-destructive">*</span>
            </Label>
            {loadingMatieres ? (
              <Skeleton className="h-9 w-full" />
            ) : activeMatieres.length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Aucune matière active. Ajoutez d&apos;abord une matière dans la
                page « Matières ».
              </p>
            ) : (
              <Select
                value={form.matiere_id}
                onValueChange={(v) => setForm({ ...form, matiere_id: v })}
              >
                <SelectTrigger id="aff-mat" aria-invalid={submitted && !matValid}>
                  <SelectValue placeholder="Choisir une matière" />
                </SelectTrigger>
                <SelectContent>
                  {activeMatieres.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.libelle}{" "}
                      <span className="text-[10px] text-muted-foreground">
                        ({m.code})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {submitted && !matValid ? (
              <p className="text-[11px] text-destructive">
                Sélectionnez une matière.
              </p>
            ) : null}
          </div>

          {/* Classe */}
          <div className="space-y-1.5">
            <Label htmlFor="aff-cls">
              Classe <span className="text-destructive">*</span>
            </Label>
            {loadingClasses ? (
              <Skeleton className="h-9 w-full" />
            ) : (classes ?? []).length === 0 ? (
              <p className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                Aucune classe configurée. Ajoutez d&apos;abord des classes dans
                la configuration des cycles.
              </p>
            ) : (
              <Select
                value={form.classe_id}
                onValueChange={(v) => setForm({ ...form, classe_id: v })}
              >
                <SelectTrigger id="aff-cls" aria-invalid={submitted && !clsValid}>
                  <SelectValue placeholder="Choisir une classe" />
                </SelectTrigger>
                <SelectContent>
                  {(classes ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.libelle}{" "}
                      <span className="text-[10px] text-muted-foreground">
                        (niveau {c.niveau})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {submitted && !clsValid ? (
              <p className="text-[11px] text-destructive">
                Sélectionnez une classe.
              </p>
            ) : null}
          </div>

          {/* Volume horaire hebdo */}
          <div className="space-y-1.5">
            <Label htmlFor="aff-vol">
              Volume horaire hebdomadaire (heures){" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="aff-vol"
              type="number"
              min={0}
              step="0.5"
              value={form.volume_horaire_hebdo}
              onChange={(e) =>
                setForm({ ...form, volume_horaire_hebdo: e.target.value })
              }
              placeholder="2"
              aria-invalid={submitted && !volValid}
            />
            {submitted && !volValid ? (
              <p className="text-[11px] text-destructive">
                Volume horaire invalide.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Une alerte de surcharge est levée si la charge totale
                de l&apos;enseignant dépasse {SEUIL_SURCHARGE_H}h/semaine.
              </p>
            )}
          </div>

          {/* Titulaire */}
          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2.5">
            <div className="space-y-0.5">
              <Label htmlFor="aff-tit" className="cursor-pointer">
                Enseignant titulaire de la classe
              </Label>
              <p className="text-[11px] text-muted-foreground">
                L&apos;enseignant principal responsable de la classe.
              </p>
            </div>
            <Switch
              id="aff-tit"
              checked={form.est_titulaire}
              onCheckedChange={(v) =>
                setForm({ ...form, est_titulaire: v })
              }
            />
          </div>

          {/* Alerte info surcharge */}
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            <p>
              Si la création de cette affectation amène la charge totale de
              l&apos;enseignant au-dessus de {SEUIL_SURCHARGE_H}h/semaine, une
              alerte de surcharge sera affichée (sans bloquer la création).
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            <X className="size-4" />
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={submitting}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            Créer l&apos;affectation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    rose: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  }[tone];
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
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
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default AffectationsList;
