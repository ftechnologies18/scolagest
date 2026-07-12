"use client";

/**
 * ScolaGest — Liste des enseignants (module Enseignant — Phase A).
 *
 * Vue principale du module Enseignant :
 *  - Barre de recherche (debounce 300ms) sur nom / matricule / téléphone.
 *  - Filtre statut (ACTIF / INACTIF / CONGE).
 *  - Bouton « Nouvel enseignant » (emerald) qui ouvre le formulaire de création.
 *  - Tableau (shadcn Table) avec : matricule, nom complet, téléphone, statut
 *    (badge), type contrat, taux horaire défaut (FCFA/h), matières (badges) et
 *    actions (modifier / gérer matières / supprimer).
 *  - Dialog de création / édition (nom, prénoms, sexe, téléphone, email, type
 *    contrat, taux horaire défaut, diplome, spécialité, statut).
 *  - Dialog « Gérer matières » : liste les matières de l'enseignant avec leur
 *    taux horaire, et permet d'en ajouter (select matière + taux + bouton
 *    ajouter) ou d'en retirer.
 *  - Confirmation de suppression via AlertDialog.
 *
 * États : pas d'établissement, chargement (skeleton), vide, erreur.
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
  GraduationCap,
  Plus,
  Pencil,
  Trash2,
  Search,
  AlertCircle,
  BookOpen,
  Loader2,
  Mail,
  Phone,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchEnseignants,
  createEnseignant,
  updateEnseignant,
  deleteEnseignant,
  addMatiereToEnseignant,
  removeMatiereFromEnseignant,
  fetchMatieres,
  type Enseignant,
  type EnseignantDTO,
  type StatutEnseignant,
  type TypeContrat,
  type Sexe,
} from "@/lib/api-enseignant";
import { formatFCFA } from "@/lib/format";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
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

export const enseignantsKeys = {
  all: ["enseignants"] as const,
  list: (params: { search?: string; statut?: StatutEnseignant }) =>
    [...enseignantsKeys.all, "list", params] as const,
};

export const matieresKeys = {
  all: ["matieres"] as const,
  list: () => [...matieresKeys.all, "list"] as const,
};

const STATUT_LABEL: Record<StatutEnseignant, string> = {
  ACTIF: "Actif",
  INACTIF: "Inactif",
  CONGE: "En congé",
};

const STATUT_CLS: Record<StatutEnseignant, string> = {
  ACTIF:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  INACTIF:
    "border-muted-foreground/20 bg-muted text-muted-foreground",
  CONGE:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
};

const TYPE_CONTRAT_LABEL: Record<TypeContrat, string> = {
  CDI: "CDI",
  CDD: "CDD",
  VACATAIRE: "Vacataire",
  STAGIAIRE: "Stagiaire",
};

function StatutEnseignantBadge({ statut }: { statut: StatutEnseignant }) {
  return (
    <Badge variant="outline" className={cn("font-medium", STATUT_CLS[statut])}>
      {STATUT_LABEL[statut]}
    </Badge>
  );
}

function enseignantFullName(e: Enseignant): string {
  return [e.prenoms, e.nom].filter(Boolean).join(" ").trim() || "—";
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function EnseignantsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const etablissement = useAuthStore((s) => s.etablissement);

  // Filtres
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [statut, setStatut] = React.useState<StatutEnseignant | "all">("all");

  // Dialogs
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Enseignant | null>(null);
  const [matieresOpen, setMatieresOpen] = React.useState(false);
  const [matieresTarget, setMatieresTarget] = React.useState<Enseignant | null>(
    null,
  );

  // Debounce de la recherche (300ms)
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const params = React.useMemo(
    () => ({
      search: debouncedSearch || undefined,
      statut: statut !== "all" ? statut : undefined,
    }),
    [debouncedSearch, statut],
  );

  const {
    data: enseignants,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: enseignantsKeys.list(params),
    queryFn: () => fetchEnseignants(params),
    enabled: !!etablissement,
  });

  // ─── Mutations ────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (dto: EnseignantDTO) => createEnseignant(dto),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: enseignantsKeys.all });
      toast({
        title: "Enseignant créé",
        description: "L'enseignant a été ajouté avec succès.",
      });
      setFormOpen(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de créer l'enseignant.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<EnseignantDTO> }) =>
      updateEnseignant(id, dto),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: enseignantsKeys.all });
      toast({
        title: "Enseignant modifié",
        description: "Les modifications ont été enregistrées.",
      });
      setFormOpen(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de modifier l'enseignant.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteEnseignant(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: enseignantsKeys.all });
      toast({
        title: "Enseignant supprimé",
        description: "L'enseignant a été retiré de l'établissement.",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de supprimer cet enseignant.",
        variant: "destructive",
      });
    },
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(e: Enseignant) {
    setEditing(e);
    setFormOpen(true);
  }
  function openMatieres(e: Enseignant) {
    setMatieresTarget(e);
    setMatieresOpen(true);
  }

  function handleSubmit(dto: EnseignantDTO) {
    if (editing) {
      updateMutation.mutate({ id: editing.id, dto });
    } else {
      createMutation.mutate(dto);
    }
  }

  // ─── États ────────────────────────────────────────────────────────────────

  if (!etablissement) {
    return (
      <EnseignantsShell>
        <EmptyState
          icon={AlertCircle}
          tone="amber"
          title="Sélectionnez un établissement"
          description="Choisissez un établissement dans la barre latérale pour gérer ses enseignants."
        />
      </EnseignantsShell>
    );
  }

  return (
    <EnseignantsShell onNew={openCreate}>
      {/* Barre de filtres */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom, matricule, téléphone…"
              className="pl-8"
              aria-label="Rechercher un enseignant"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
                aria-label="Effacer la recherche"
              >
                <X className="size-3.5" />
              </button>
            ) : null}
          </div>
          <Select
            value={statut}
            onValueChange={(v) => setStatut(v as StatutEnseignant | "all")}
          >
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Tous les statuts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="ACTIF">Actif</SelectItem>
              <SelectItem value="INACTIF">Inactif</SelectItem>
              <SelectItem value="CONGE">En congé</SelectItem>
            </SelectContent>
          </Select>
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
              : "Impossible de charger les enseignants. Vérifiez que le backend est démarré puis réessayez."
          }
        />
      ) : (enseignants ?? []).length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          tone="emerald"
          title="Aucun enseignant"
          description="Cliquez sur « Nouvel enseignant » pour ajouter votre premier enseignant."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Matricule</TableHead>
                    <TableHead className="min-w-[180px]">Nom complet</TableHead>
                    <TableHead className="min-w-[140px]">Téléphone</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Contrat</TableHead>
                    <TableHead className="text-right">Taux/h déf.</TableHead>
                    <TableHead className="min-w-[180px]">Matières</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(enseignants ?? []).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {e.matricule || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {enseignantFullName(e)}
                        </div>
                        {e.email ? (
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                            <Mail className="size-3" />
                            <span className="truncate">{e.email}</span>
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {e.telephone ? (
                          <div className="flex items-center gap-1 text-xs">
                            <Phone className="size-3 text-muted-foreground" />
                            <span className="font-mono">{e.telephone}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatutEnseignantBadge statut={e.statut} />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-muted-foreground/20 bg-muted/40 font-normal"
                        >
                          {TYPE_CONTRAT_LABEL[e.type_contrat]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {e.taux_horaire_defaut
                          ? formatFCFA(e.taux_horaire_defaut)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex max-w-[220px] flex-wrap gap-1">
                          {(e.matieres ?? []).length === 0 ? (
                            <span className="text-[11px] italic text-muted-foreground">
                              Aucune
                            </span>
                          ) : (
                            (e.matieres ?? []).slice(0, 3).map((m) => (
                              <Badge
                                key={m.id}
                                variant="outline"
                                className="border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                              >
                                {m.matiere?.libelle ?? "—"}
                              </Badge>
                            ))
                          )}
                          {(e.matieres ?? []).length > 3 ? (
                            <Badge
                              variant="outline"
                              className="border-muted-foreground/20 bg-muted/40 text-[10px]"
                            >
                              +{(e.matieres ?? []).length - 3}
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(e)}
                            className="text-emerald-700 hover:bg-emerald-50"
                          >
                            <Pencil className="size-3.5" />
                            <span className="sr-only">Modifier</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openMatieres(e)}
                            className="text-amber-700 hover:bg-amber-50"
                          >
                            <BookOpen className="size-3.5" />
                            <span className="sr-only">Gérer matières</span>
                          </Button>
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
                                  Supprimer cet enseignant ?
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Cette action est irréversible. L&apos;enseignant
                                  « {enseignantFullName(e)} » et toutes ses
                                  associations (matières, affectations) seront
                                  supprimés.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Annuler</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    deleteMutation.mutate(e.id)
                                  }
                                  className="bg-destructive text-white hover:bg-destructive/90"
                                >
                                  Supprimer définitivement
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog création / édition */}
      <EnseignantFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        enseignant={editing}
        onSubmit={handleSubmit}
        submitting={createMutation.isPending || updateMutation.isPending}
      />

      {/* Dialog gestion matières */}
      <EnseignantMatieresDialog
        open={matieresOpen}
        onOpenChange={setMatieresOpen}
        enseignant={matieresTarget}
      />
    </EnseignantsShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell (titre + bouton)
// ─────────────────────────────────────────────────────────────────────────────

function EnseignantsShell({
  children,
  onNew,
}: {
  children: React.ReactNode;
  onNew?: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <GraduationCap className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Enseignants</h1>
            <p className="text-sm text-muted-foreground">
              Gérez le corps enseignant : fiches, contrats, matières enseignées
              et taux horaires.
            </p>
          </div>
        </div>
        {onNew ? (
          <Button
            onClick={onNew}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Plus className="size-4" />
            Nouvel enseignant
          </Button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog : formulaire création / édition
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_CONTRAT_OPTIONS: { value: TypeContrat; label: string }[] = [
  { value: "CDI", label: "CDI" },
  { value: "CDD", label: "CDD" },
  { value: "VACATAIRE", label: "Vacataire" },
  { value: "STAGIAIRE", label: "Stagiaire" },
];

const STATUT_OPTIONS: { value: StatutEnseignant; label: string }[] = [
  { value: "ACTIF", label: "Actif" },
  { value: "INACTIF", label: "Inactif" },
  { value: "CONGE", label: "En congé" },
];

interface FormState {
  nom: string;
  prenoms: string;
  sexe: Sexe;
  telephone: string;
  email: string;
  type_contrat: TypeContrat;
  statut: StatutEnseignant;
  taux_horaire_defaut: string;
  diplome: string;
  specialite: string;
}

function EnseignantFormDialog({
  open,
  onOpenChange,
  enseignant,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  enseignant: Enseignant | null;
  onSubmit: (dto: EnseignantDTO) => void;
  submitting: boolean;
}) {
  const isEdit = !!enseignant;

  const [form, setForm] = React.useState<FormState>({
    nom: "",
    prenoms: "",
    sexe: "",
    telephone: "",
    email: "",
    type_contrat: "CDI",
    statut: "ACTIF",
    taux_horaire_defaut: "",
    diplome: "",
    specialite: "",
  });
  const [submitted, setSubmitted] = React.useState(false);

  // Synchronise le formulaire à l'ouverture
  React.useEffect(() => {
    if (!open) return;
    setSubmitted(false);
    if (enseignant) {
      setForm({
        nom: enseignant.nom ?? "",
        prenoms: enseignant.prenoms ?? "",
        sexe: enseignant.sexe ?? "",
        telephone: enseignant.telephone ?? "",
        email: enseignant.email ?? "",
        type_contrat: enseignant.type_contrat ?? "CDI",
        statut: enseignant.statut ?? "ACTIF",
        taux_horaire_defaut:
          enseignant.taux_horaire_defaut != null
            ? String(enseignant.taux_horaire_defaut)
            : "",
        diplome: enseignant.diplome ?? "",
        specialite: enseignant.specialite ?? "",
      });
    } else {
      setForm({
        nom: "",
        prenoms: "",
        sexe: "",
        telephone: "",
        email: "",
        type_contrat: "CDI",
        statut: "ACTIF",
        taux_horaire_defaut: "",
        diplome: "",
        specialite: "",
      });
    }
  }, [open, enseignant]);

  const nomValid = form.nom.trim().length > 0;
  const tauxValid =
    form.taux_horaire_defaut === "" ||
    (!Number.isNaN(Number(form.taux_horaire_defaut)) &&
      Number(form.taux_horaire_defaut) >= 0);
  const formValid = nomValid && tauxValid;

  function handleSave() {
    setSubmitted(true);
    if (!formValid) return;
    const dto: EnseignantDTO = {
      nom: form.nom.trim(),
      prenoms: form.prenoms.trim() || undefined,
      sexe: form.sexe || undefined,
      telephone: form.telephone.trim() || undefined,
      email: form.email.trim() || undefined,
      type_contrat: form.type_contrat,
      statut: form.statut,
      taux_horaire_defaut: form.taux_horaire_defaut
        ? Number(form.taux_horaire_defaut)
        : 0,
      diplome: form.diplome.trim() || undefined,
      specialite: form.specialite.trim() || undefined,
    };
    onSubmit(dto);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier l'enseignant" : "Nouvel enseignant"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Mettez à jour les informations de l'enseignant."
              : "Renseignez les informations de base de l'enseignant."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2 sm:grid-cols-2">
          {/* Nom */}
          <div className="space-y-1.5">
            <Label htmlFor="ens-nom">
              Nom <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ens-nom"
              value={form.nom}
              onChange={(e) => setForm({ ...form, nom: e.target.value })}
              placeholder="Koffi"
              aria-invalid={submitted && !nomValid}
            />
            {submitted && !nomValid ? (
              <p className="text-[11px] text-destructive">Le nom est requis.</p>
            ) : null}
          </div>

          {/* Prénoms */}
          <div className="space-y-1.5">
            <Label htmlFor="ens-prenoms">Prénoms</Label>
            <Input
              id="ens-prenoms"
              value={form.prenoms}
              onChange={(e) => setForm({ ...form, prenoms: e.target.value })}
              placeholder="Jean Marc"
            />
          </div>

          {/* Sexe */}
          <div className="space-y-1.5">
            <Label htmlFor="ens-sexe">Sexe</Label>
            <Select
              value={form.sexe || "NONE"}
              onValueChange={(v) =>
                setForm({ ...form, sexe: v === "NONE" ? "" : (v as Sexe) })
              }
            >
              <SelectTrigger id="ens-sexe">
                <SelectValue placeholder="Non renseigné" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Non renseigné</SelectItem>
                <SelectItem value="M">Masculin</SelectItem>
                <SelectItem value="F">Féminin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Téléphone */}
          <div className="space-y-1.5">
            <Label htmlFor="ens-tel">Téléphone</Label>
            <Input
              id="ens-tel"
              value={form.telephone}
              onChange={(e) =>
                setForm({ ...form, telephone: e.target.value })
              }
              placeholder="+225 07 00 00 00"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="ens-email">Email</Label>
            <Input
              id="ens-email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="prof@etablissement.ci"
            />
          </div>

          {/* Diplôme */}
          <div className="space-y-1.5">
            <Label htmlFor="ens-diplome">Diplôme</Label>
            <Input
              id="ens-diplome"
              value={form.diplome}
              onChange={(e) => setForm({ ...form, diplome: e.target.value })}
              placeholder="Licence, Master, CAPES…"
            />
          </div>

          {/* Spécialité */}
          <div className="space-y-1.5">
            <Label htmlFor="ens-spec">Spécialité</Label>
            <Input
              id="ens-spec"
              value={form.specialite}
              onChange={(e) =>
                setForm({ ...form, specialite: e.target.value })
              }
              placeholder="Mathématiques, SVT…"
            />
          </div>

          {/* Type contrat */}
          <div className="space-y-1.5">
            <Label htmlFor="ens-contrat">Type de contrat</Label>
            <Select
              value={form.type_contrat}
              onValueChange={(v) =>
                setForm({ ...form, type_contrat: v as TypeContrat })
              }
            >
              <SelectTrigger id="ens-contrat">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_CONTRAT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Statut */}
          <div className="space-y-1.5">
            <Label htmlFor="ens-statut">Statut</Label>
            <Select
              value={form.statut}
              onValueChange={(v) =>
                setForm({ ...form, statut: v as StatutEnseignant })
              }
            >
              <SelectTrigger id="ens-statut">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Taux horaire défaut */}
          <div className="space-y-1.5">
            <Label htmlFor="ens-taux">Taux horaire par défaut (FCFA)</Label>
            <Input
              id="ens-taux"
              type="number"
              min={0}
              value={form.taux_horaire_defaut}
              onChange={(e) =>
                setForm({ ...form, taux_horaire_defaut: e.target.value })
              }
              placeholder="2500"
              aria-invalid={submitted && !tauxValid}
            />
            {submitted && !tauxValid ? (
              <p className="text-[11px] text-destructive">
                Montant invalide.
              </p>
            ) : null}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={submitting}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : isEdit ? (
              "Enregistrer"
            ) : (
              "Créer l'enseignant"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dialog : gestion des matières d'un enseignant
// ─────────────────────────────────────────────────────────────────────────────

function EnseignantMatieresDialog({
  open,
  onOpenChange,
  enseignant,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  enseignant: Enseignant | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [matiereId, setMatiereId] = React.useState<string>("");
  const [taux, setTaux] = React.useState<string>("");

  React.useEffect(() => {
    if (!open) {
      setMatiereId("");
      setTaux("");
    }
  }, [open]);

  // Liste toutes les matières (pour le select d'ajout)
  const { data: allMatieres, isLoading: loadingMatieres } = useQuery({
    queryKey: matieresKeys.list(),
    queryFn: fetchMatieres,
    enabled: !!enseignant && open,
  });

  // Rafraîchit l'enseignant ciblé pour avoir la liste à jour de ses matières.
  // On passe par la liste filtrée par le matricule (le backend ne expose pas
  // de route GET /api/enseignants/:id dans le client API, mais la recherche
  // par matricule est unique et permet de récupérer la fiche à jour).
  const { data: refreshed, isFetching } = useQuery({
    queryKey: [...enseignantsKeys.all, "detail", enseignant?.id, open],
    queryFn: () => fetchEnseignants({ search: enseignant!.matricule }),
    enabled: !!enseignant && open,
  });

  const current = React.useMemo<Enseignant | null>(() => {
    if (!enseignant) return null;
    const list = refreshed ?? [];
    return list.find((e) => e.id === enseignant.id) ?? enseignant;
  }, [enseignant, refreshed]);

  // Matières non encore associées
  const availableMatieres = React.useMemo(() => {
    if (!allMatieres) return [];
    const associatedIds = new Set(
      (current?.matieres ?? []).map((m) => m.matiere_id),
    );
    return allMatieres.filter((m) => !associatedIds.has(m.id) && m.actif);
  }, [allMatieres, current]);

  const addMutation = useMutation({
    mutationFn: (dto: { matiere_id: string; taux_horaire: number }) =>
      addMatiereToEnseignant(enseignant!.id, {
        matiere_id: dto.matiere_id,
        taux_horaire: dto.taux_horaire,
        est_principale: false,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: enseignantsKeys.all,
      });
      await queryClient.invalidateQueries({
        queryKey: matieresKeys.all,
      });
      toast({
        title: "Matière ajoutée",
        description: "La matière a été associée à l'enseignant.",
      });
      setMatiereId("");
      setTaux("");
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible d'associer la matière.",
        variant: "destructive",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (matiereId: string) =>
      removeMatiereFromEnseignant(enseignant!.id, matiereId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: enseignantsKeys.all,
      });
      toast({
        title: "Matière retirée",
        description: "La matière n'est plus associée à l'enseignant.",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de retirer la matière.",
        variant: "destructive",
      });
    },
  });

  function handleAdd() {
    if (!matiereId) {
      toast({
        title: "Sélection requise",
        description: "Choisissez une matière à associer.",
        variant: "destructive",
      });
      return;
    }
    const tauxNum = taux ? Number(taux) : 0;
    if (Number.isNaN(tauxNum) || tauxNum < 0) {
      toast({
        title: "Taux invalide",
        description: "Le taux horaire doit être un nombre positif.",
        variant: "destructive",
      });
      return;
    }
    addMutation.mutate({ matiere_id: matiereId, taux_horaire: tauxNum });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Matières enseignées</DialogTitle>
          <DialogDescription>
            {current
              ? `Matières de ${enseignantFullName(current)}.`
              : "Chargement…"}
          </DialogDescription>
        </DialogHeader>

        {/* Liste des matières déjà associées */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Matières associées</h3>
            {isFetching ? (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            ) : null}
          </div>
          {!current || (current.matieres ?? []).length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
              Aucune matière associée.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {(current.matieres ?? []).map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {m.matiere?.libelle ?? "Matière supprimée"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {m.matiere?.code ?? "—"} · Taux :{" "}
                      <span className="font-mono">
                        {formatFCFA(m.taux_horaire)}
                      </span>
                      /h
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:bg-rose-50"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate(m.matiere_id)}
                  >
                    <Trash2 className="size-3.5" />
                    <span className="sr-only">Retirer</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Ajouter une matière */}
        <div className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold">Associer une nouvelle matière</h3>
          {loadingMatieres ? (
            <Skeleton className="h-9 w-full" />
          ) : availableMatieres.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/20 px-3 py-3 text-center text-xs text-muted-foreground">
              Toutes les matières actives sont déjà associées (ou aucune matière
              n&apos;est configurée — voir la page « Matières »).
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-[1fr_140px_auto] sm:items-end">
              <div className="space-y-1.5">
                <Label htmlFor="add-matiere">Matière</Label>
                <Select value={matiereId} onValueChange={setMatiereId}>
                  <SelectTrigger id="add-matiere">
                    <SelectValue placeholder="Choisir une matière" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMatieres.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.libelle}{" "}
                        <span className="text-[10px] text-muted-foreground">
                          ({m.code})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-taux">Taux/h (FCFA)</Label>
                <Input
                  id="add-taux"
                  type="number"
                  min={0}
                  value={taux}
                  onChange={(e) => setTaux(e.target.value)}
                  placeholder="2500"
                />
              </div>
              <Button
                onClick={handleAdd}
                disabled={addMutation.isPending}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {addMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Plus className="size-4" />
                )}
                Ajouter
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
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

export default EnseignantsList;
