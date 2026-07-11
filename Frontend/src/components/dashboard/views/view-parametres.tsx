"use client";

/**
 * ScolaGest — Vue « Paramètres » (Phase 5).
 *
 * Trois onglets (DIRECTION uniquement, filtre nav dans
 * `dashboard-layout.tsx`) :
 *  - Établissements : liste + création / édition, code_officiel, ville,
 *    applique_categorie_affecte, actif.
 *  - Utilisateurs   : liste des utilisateurs + rôle global + accès par
 *    établissement. Création / édition via dialog dédié.
 *  - Audit          : filtres (entité, utilisateur, dates) + table paginée
 *    du journal d&apos;audit (date, utilisateur, action, entité, IP).
 *
 * Toutes les requêtes utilisent `useQuery` avec `retry: 1, retryDelay: 1500`.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Settings,
  Building2,
  Users,
  ScrollText,
  Plus,
  Pencil,
  Loader2,
  AlertCircle,
  Filter,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Globe,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore, type Etablissement } from "@/lib/auth-store";
import {
  etablissementsKeys,
  usersKeys,
  auditKeys,
  fetchEtablissements,
  fetchUtilisateurs,
  fetchAudit,
} from "@/lib/api-phase5";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, todayISO } from "@/lib/format";
import type {
  AuditQueryParams,
  JournalAudit,
  RoleGlobal,
  Utilisateur,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EtablissementFormDialog } from "@/components/parametres/etablissement-form-dialog";
import { UtilisateurFormDialog } from "@/components/parametres/utilisateur-form-dialog";

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<RoleGlobal, string> = {
  SUPER_ADMIN: "Super Admin (SaaS)",
  CAISSIER: "Caissier(ère)",
  COMPTABLE: "Comptable",
  DIRECTION: "Direction",
  DIRECTEUR_ETUDES: "Directeur des Études",
  DIRECTEUR_SUPERVISEUR: "Directeur Superviseur",
  SECRETARIAT: "Secrétariat",
  PARENT: "Parent / Tuteur",
};

const ROLE_CLS: Record<RoleGlobal, string> = {
  SUPER_ADMIN:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
  CAISSIER:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  COMPTABLE:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  DIRECTION:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300",
  SECRETARIAT:
    "border-muted-foreground/20 bg-muted text-muted-foreground",
  PARENT:
    "border-muted-foreground/20 bg-muted text-muted-foreground",
};

const PAGE_SIZE = 20;

const ENTITE_OPTIONS = [
  { value: "all", label: "Toutes entités" },
  { value: "Eleve", label: "Élèves" },
  { value: "Paiement", label: "Paiements" },
  { value: "Frais", label: "Frais" },
  { value: "Echeance", label: "Échéances" },
  { value: "Utilisateur", label: "Utilisateurs" },
  { value: "Etablissement", label: "Établissements" },
  { value: "Cloture", label: "Clôtures" },
  { value: "TransactionMomo", label: "Mobile Money" },
  { value: "EcritureComptable", label: "Écritures compta" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function ParametresView() {
  const etablissement = useAuthStore((s) => s.etablissement);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Settings className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Paramètres</h1>
            <p className="text-sm text-muted-foreground">
              Établissements du groupe, utilisateurs & rôles, journal d&apos;audit.
              {etablissement?.nom ? (
                <span className="ml-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {etablissement.nom}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="etablissements" className="w-full">
        <TabsList className="flex w-full justify-start gap-1 overflow-x-auto sm:w-auto">
          <TabsTrigger value="etablissements">
            <Building2 className="size-3.5" />
            Établissements
          </TabsTrigger>
          <TabsTrigger value="utilisateurs">
            <Users className="size-3.5" />
            Utilisateurs
          </TabsTrigger>
          <TabsTrigger value="audit">
            <ScrollText className="size-3.5" />
            Audit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="etablissements" className="mt-4">
          <EtablissementsPanel />
        </TabsContent>
        <TabsContent value="utilisateurs" className="mt-4">
          <UtilisateursPanel />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Établissements »
// ─────────────────────────────────────────────────────────────────────────────

function EtablissementsPanel() {
  const [formOpen, setFormOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Etablissement | null>(
    null,
  );

  const {
    data: etablissements,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: etablissementsKeys.list(),
    queryFn: fetchEtablissements,
    retry: 1,
    retryDelay: 1500,
  });

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(e: Etablissement) {
    setEditTarget(e);
    setFormOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {etablissements?.length ?? 0} établissement(s) dans le groupe.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <Loader2 className={cn("size-3.5", isFetching && "animate-spin")} />
            Actualiser
          </Button>
          <Button
            onClick={openCreate}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            size="sm"
          >
            <Plus className="size-4" />
            Nouvel établissement
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : (etablissements ?? []).length === 0 ? (
            <EmptyState
              title="Aucun établissement"
              message="Créez le premier établissement du groupe pour démarrer."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-4">Nom</TableHead>
                    <TableHead>Code officiel</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Catégories</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(etablissements ?? []).map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="pl-4">
                        <div className="flex items-center gap-2">
                          <div className="flex size-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                            <Building2 className="size-4" />
                          </div>
                          <span className="text-sm font-medium">{e.nom}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {e.code_officiel || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {e.ville || "—"}
                      </TableCell>
                      <TableCell>
                        {e.applique_categorie_affecte ? (
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
                          >
                            <ShieldCheck className="size-3" />
                            Affecté / Non affecté
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-muted-foreground/20 bg-muted text-muted-foreground"
                          >
                            <Globe className="size-3" />
                            Tarif unique
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {e.actif === false ? (
                          <Badge
                            variant="outline"
                            className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                          >
                            Inactif
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            Actif
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(e)}
                        >
                          <Pencil className="size-3.5" />
                          Modifier
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <EtablissementFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        etablissement={editTarget}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Utilisateurs »
// ─────────────────────────────────────────────────────────────────────────────

function UtilisateursPanel() {
  const etablissement = useAuthStore((s) => s.etablissement);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Utilisateur | null>(null);

  const {
    data: utilisateurs,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: usersKeys.list({ etablissementId: etablissement?.id }),
    queryFn: () => fetchUtilisateurs(etablissement?.id),
    retry: 1,
    retryDelay: 1500,
  });

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(u: Utilisateur) {
    setEditTarget(u);
    setFormOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {utilisateurs?.length ?? 0} utilisateur(s). La liste affiche tous les
          comptes ayant au moins un accès à l&apos;établissement courant.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <Loader2 className={cn("size-3.5", isFetching && "animate-spin")} />
            Actualiser
          </Button>
          <Button
            onClick={openCreate}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            size="sm"
          >
            <Plus className="size-4" />
            Nouvel utilisateur
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : (utilisateurs ?? []).length === 0 ? (
            <EmptyState
              title="Aucun utilisateur"
              message="Créez le premier compte utilisateur pour gérer les accès au système."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-4">Nom complet</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle global</TableHead>
                    <TableHead>Accès établissements</TableHead>
                    <TableHead>État</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(utilisateurs ?? []).map((u) => {
                    const nomComplet = `${u.prenoms ?? ""} ${u.nom ?? ""}`.trim();
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="pl-4">
                          <div className="flex items-center gap-2">
                            <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <Users className="size-4" />
                            </div>
                          <span className="text-sm font-medium">
                            {nomComplet || "—"}
                          </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u.email || "—"}
                        </TableCell>
                        <TableCell>
                          {u.role_global ? (
                            <Badge
                              variant="outline"
                              className={cn("font-medium", ROLE_CLS[u.role_global])}
                            >
                              {ROLE_LABEL[u.role_global]}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {u.accesses && u.accesses.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {u.accesses.map((a) => (
                                <span
                                  key={a.id}
                                  className="inline-flex items-center gap-1 rounded-md border border-muted-foreground/20 bg-muted/40 px-1.5 py-0.5 text-[10px]"
                                  title={ROLE_LABEL[a.role]}
                                >
                                  <Building2 className="size-2.5" />
                                  {a.etablissement?.nom ?? "Étab."}
                                  <span className="text-muted-foreground">
                                    · {ROLE_LABEL[a.role]}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Aucun accès
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {u.statut === "ACTIF" ? (
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                            >
                              Actif
                            </Badge>
                          ) : u.statut === "SUSPENDU" ? (
                            <Badge
                              variant="outline"
                              className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                            >
                              <ShieldAlert className="size-3" />
                              Suspendu
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-muted-foreground/20 bg-muted text-muted-foreground"
                            >
                              Inactif
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEdit(u)}
                          >
                            <Pencil className="size-3.5" />
                            Modifier
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <UtilisateurFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        utilisateur={editTarget}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Audit »
// ─────────────────────────────────────────────────────────────────────────────

function AuditPanel() {
  const [entite, setEntite] = React.useState<string>("all");
  const [utilisateurId, setUtilisateurId] = React.useState<string>("all");
  const [dateDebut, setDateDebut] = React.useState("");
  const [dateFin, setDateFin] = React.useState("");
  const [page, setPage] = React.useState(1);

  // Liste utilisateurs pour le filtre
  const { data: utilisateurs } = useQuery({
    queryKey: usersKeys.list({}),
    queryFn: () => fetchUtilisateurs(),
    retry: 1,
    retryDelay: 1500,
  });

  const params: AuditQueryParams = React.useMemo(
    () => ({
      entite: entite !== "all" ? entite : undefined,
      utilisateur_id: utilisateurId !== "all" ? utilisateurId : undefined,
      date_debut: dateDebut || undefined,
      date_fin: dateFin || undefined,
      page,
      page_size: PAGE_SIZE,
    }),
    [entite, utilisateurId, dateDebut, dateFin, page],
  );

  const {
    data: result,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: auditKeys.list(params),
    queryFn: () => fetchAudit(params),
    retry: 1,
    retryDelay: 1500,
  });

  React.useEffect(() => {
    setPage(1);
  }, [entite, utilisateurId, dateDebut, dateFin]);

  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Entité</Label>
            <Select value={entite} onValueChange={setEntite}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Utilisateur</Label>
            <Select value={utilisateurId} onValueChange={setUtilisateurId}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous utilisateurs</SelectItem>
                {(utilisateurs ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {`${u.prenoms ?? ""} ${u.nom ?? ""}`.trim() || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aud-debut" className="text-xs">
              Date début
            </Label>
            <Input
              id="aud-debut"
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              max={dateFin || todayISO()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aud-fin" className="text-xs">
              Date fin
            </Label>
            <Input
              id="aud-fin"
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              min={dateDebut || undefined}
              max={todayISO()}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setEntite("all");
                setUtilisateurId("all");
                setDateDebut("");
                setDateFin("");
              }}
            >
              <Filter className="size-3.5" />
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isFetching ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Mise à jour…
            </>
          ) : (
            <>
              <ScrollText className="size-3" />
              {total} entrée(s) d&apos;audit
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <Loader2 className={cn("size-3.5", isFetching && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : (result?.data ?? []).length === 0 ? (
            <EmptyState
              title="Journal d'audit vide"
              message="Aucune entrée ne correspond à vos filtres. Les actions sensibles (création, modification, suppression) sont journalisées automatiquement."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-4">Date</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entité</TableHead>
                    <TableHead>Entité ID</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(result?.data ?? []).map((entry: JournalAudit) => (
                    <TableRow key={entry.id}>
                      <TableCell className="pl-4 text-xs">
                        {formatDateTime(entry.date_action)}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {entry.utilisateur
                          ? `${entry.utilisateur.prenoms ?? ""} ${entry.utilisateur.nom ?? ""}`.trim()
                          : "Système"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-medium",
                            entry.action.toLowerCase().includes("delete") ||
                              entry.action.toLowerCase().includes("supprim")
                              ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                              : entry.action.toLowerCase().includes("create") ||
                                  entry.action.toLowerCase().includes("création")
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
                          )}
                        >
                          {entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{entry.entite}</TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {entry.entite_id ? entry.entite_id.slice(0, 8) + "…" : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {entry.adresse_ip ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                        {entry.description ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isFetching}
          >
            Précédent
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isFetching}
          >
            Suivant
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// États partagés
// ─────────────────────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
        <AlertCircle className="size-6" />
      </div>
      <div>
        <p className="text-sm font-medium">Erreur de chargement</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Le backend n&apos;a pas pu répondre. Réessayez ou vérifiez votre
          connexion.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <Loader2 className="size-3.5" />
        Réessayer
      </Button>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CheckCircle2 className="size-6" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
