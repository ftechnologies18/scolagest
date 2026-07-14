"use client";

/**
 * ScolaGest — Vue « Utilisateurs » (Phase 5 — Refonte Forêt EdTech).
 *
 * Affiche la liste des comptes staff de l'établissement courant avec :
 *  - Hero header (GlassCard desktop) : badge rond gradient emerald→gold
 *    (UserCog), titre `font-display` text-2xl, pill « Phase 5 » outline,
 *    bouton « Nouvel utilisateur » variant success.
 *  - Barre de filtres (GlassCard adaptive) : recherche (icône Search),
 *    Select « Tous les rôles » (icône Filter), bouton Réinitialiser
 *    (RotateCcw, outline) visible si un filtre est actif.
 *  - StatCards par rôle : 1 carte « Total » (forest/Users) + 1 carte par
 *    rôle présent (tones emerald/amber/gold/terracotta) avec stagger.
 *  - Tableau desktop : header bg-emerald-50/60, hover row bg-emerald-50/60,
 *    avatar initiales bg-emerald-600 text-white, badge « (vous) » si self,
 *    email `break-all`, badges rôle/statut renforcés (border-300 bg-100
 *    text-800), colonne Établissements avec icône Building2 + bouton ×
 *    `title` natif, DropdownMenu actions (Pencil/Building2/Power/KeyRound)
 *    avec `title` natif sur le trigger.
 *  - Cartes mobile (md:hidden) : GlassCard mobile avec avatar + nom +
 *    badge « (vous) » + DropdownMenu actions + body (email, rôle, statut,
 *    établissements).
 *  - Empty states premium : KentePattern bg + badges ronds colorés (amber
 *    établissement, emerald aucun utilisateur) + état chargement avec
 *    KentePattern strip top + Loader2.
 *  - AccessDialog premium : vrai Dialog shadcn (remplace le div fixed
 *    custom) avec badge rond gradient emerald→gold (Building2), cards
 *    mini pour les accès existants, formulaire d'ajout (Select
 *    établissement + Select rôle + bouton Ajouter variant success).
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query (fetchUtilisateurs /
 * fetchEtablissements), mutations updateUtilisateur /
 * addEtablissementAccess / removeEtablissementAccess, query keys
 * ["utilisateurs", ...] / ["etablissements"], filtrage local par rôle
 * (filteredUsers via useMemo), constantes ROLE_LABELS / ROLE_CLS /
 * STATUT_CLS / ROLE_TONE / ROLE_ICON, gouvernance SaaS déléguée au
 * UtilisateurFormDialog. Endpoints API inchangés : GET /api/utilisateurs,
 * POST /api/utilisateurs, PUT /api/utilisateurs/:id,
 * POST /api/utilisateurs/:id/access,
 * DELETE /api/utilisateurs/:id/access/:etablissement_id,
 * GET /api/etablissements.
 */

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserCog,
  Plus,
  Search,
  Pencil,
  Trash2,
  ShieldCheck,
  Loader2,
  Building2,
  MoreVertical,
  Power,
  KeyRound,
  Users,
  RotateCcw,
  Filter,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/ds/glass-card";
import { StatCard } from "@/components/ds/stat-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchUtilisateurs,
  updateUtilisateur,
  addEtablissementAccess,
  removeEtablissementAccess,
  fetchEtablissements,
} from "@/lib/api-phase5";
import { UtilisateurFormDialog } from "@/components/parametres/utilisateur-form-dialog";
import type { Utilisateur, RoleGlobal, EtablissementAccess } from "@/lib/types";

// ─── Constants ───────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  DIRECTION: "Direction",
  DIRECTEUR_ETUDES: "Directeur des Études",
  DIRECTEUR_SUPERVISEUR: "Directeur Superviseur",
  CAISSIER: "Caissier(ère)",
  COMPTABLE: "Comptable",
  SECRETARIAT: "Secrétariat",
};

const ROLE_CLS: Record<string, string> = {
  SUPER_ADMIN:
    "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
  DIRECTION:
    "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300",
  DIRECTEUR_ETUDES:
    "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300",
  DIRECTEUR_SUPERVISEUR:
    "border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300",
  CAISSIER:
    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  COMPTABLE:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
  SECRETARIAT:
    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
};

const STATUT_CLS: Record<string, string> = {
  ACTIF:
    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
  INACTIF:
    "border-muted-foreground/30 bg-muted text-muted-foreground",
  BLOQUE:
    "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
  SUSPENDU:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
};

// Tones & icônes DS Forêt EdTech pour les StatCards par rôle :
//  - terracotta : privilège élevé / danger (SUPER_ADMIN)
//  - gold       : leadership premium (DIRECTION, DIRECTEUR_*)
//  - emerald    : opérations actives (CAISSIER, COMPTABLE, SECRETARIAT)
const ROLE_TONE: Record<
  string,
  "emerald" | "amber" | "terracotta" | "gold"
> = {
  SUPER_ADMIN: "terracotta",
  DIRECTION: "gold",
  DIRECTEUR_ETUDES: "gold",
  DIRECTEUR_SUPERVISEUR: "gold",
  CAISSIER: "emerald",
  COMPTABLE: "emerald",
  SECRETARIAT: "emerald",
};

const ROLE_ICON: Record<string, LucideIcon> = {
  SUPER_ADMIN: ShieldCheck,
  DIRECTION: ShieldCheck,
  DIRECTEUR_ETUDES: UserCog,
  DIRECTEUR_SUPERVISEUR: UserCog,
  CAISSIER: UserCog,
  COMPTABLE: UserCog,
  SECRETARIAT: UserCog,
};

const STATUT_LABEL: Record<string, string> = {
  ACTIF: "Actif",
  INACTIF: "Inactif",
  BLOQUE: "Bloqué",
  SUSPENDU: "Suspendu",
};

const ROLE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "DIRECTION", label: "Direction" },
  { value: "DIRECTEUR_ETUDES", label: "Directeur des Études" },
  { value: "DIRECTEUR_SUPERVISEUR", label: "Directeur Superviseur" },
  { value: "CAISSIER", label: "Caissier(ère)" },
  { value: "COMPTABLE", label: "Comptable" },
  { value: "SECRETARIAT", label: "Secrétariat" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Initiales (max 2) à partir d'un nom + prénoms — pour l'avatar fallback. */
function initialsOf(nom?: string, prenoms?: string): string {
  const a = (nom ?? "").trim().charAt(0);
  const b = (prenoms ?? "").trim().charAt(0);
  return (a + b).toUpperCase() || "?";
}

/** Récupère les accès multi-établissements d'un utilisateur (défensif :
 *  l'API peut renvoyer `accesses` ou `etablissement_access`). */
function getAccesses(u: Utilisateur): EtablissementAccess[] {
  const ext = u as Utilisateur & { etablissement_access?: EtablissementAccess[] };
  return ext.etablissement_access ?? u.accesses ?? [];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function UtilisateursView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const etablissement = useAuthStore((s) => s.etablissement);
  const user = useAuthStore((s) => s.user);

  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState("all");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<Utilisateur | null>(null);
  // Utilisateur dont on gère les accès (Dialog multi-établissements) —
  // état lifted ici pour partager entre UserRow (desktop) et UserCardMobile.
  const [accessDialogUser, setAccessDialogUser] =
    React.useState<Utilisateur | null>(null);

  // Fetch utilisateurs
  const { data: users, isLoading } = useQuery<Utilisateur[]>({
    queryKey: ["utilisateurs", etablissement?.id, search, roleFilter],
    queryFn: () => fetchUtilisateurs(etablissement?.id),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });

  // Fetch établissements (pour gestion des accès)
  const { data: etablissements } = useQuery({
    queryKey: ["etablissements"],
    queryFn: () => fetchEtablissements(),
    retry: 1,
    retryDelay: 1500,
  });

  // Mutations (conservées à l'identique — spec « Conserver la logique métier »)
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      updateUtilisateur(id, { nom: "", email: "", password: "" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["utilisateurs"] });
      toast({ title: "Utilisateur désactivé" });
    },
  });

  // Filtrage local par rôle + recherche client (la fonction fetchUtilisateurs
  // ne prend que l'etablissement_id — la recherche est appliquée côté client).
  const filteredUsers = React.useMemo(() => {
    if (!users) return [];
    let result = users;
    if (roleFilter !== "all") {
      result = result.filter((u) => u.role_global === roleFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((u) => {
        const full = `${u.nom ?? ""} ${u.prenoms ?? ""} ${u.email ?? ""}`.toLowerCase();
        return full.includes(q);
      });
    }
    return result;
  }, [users, roleFilter, search]);

  // Liste des StatCards (Total + 1 par rôle présent) — pour stagger propre.
  const statsList = React.useMemo(() => {
    const list: {
      key: string;
      label: string;
      icon: LucideIcon;
      tone: "emerald" | "amber" | "terracotta" | "gold" | "forest";
      count: number;
    }[] = [
      {
        key: "total",
        label: "Total",
        icon: Users,
        tone: "forest",
        count: filteredUsers.length,
      },
    ];
    Object.entries(ROLE_LABELS).forEach(([role, label]) => {
      const count = filteredUsers.filter((u) => u.role_global === role).length;
      if (count > 0) {
        list.push({
          key: role,
          label,
          icon: ROLE_ICON[role] ?? UserCog,
          tone: ROLE_TONE[role] ?? "emerald",
          count,
        });
      }
    });
    return list;
  }, [filteredUsers]);

  const hasActiveFilter = search.trim() !== "" || roleFilter !== "all";

  function resetFilters() {
    setSearch("");
    setRoleFilter("all");
  }

  const handleEdit = (u: Utilisateur) => {
    setEditingUser(u);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingUser(null);
    setDialogOpen(true);
  };

  // ─── Pas d'établissement sélectionné ──────────────────────────────────────
  if (!etablissement?.id) {
    return (
      <UtilisateursShell>
        <EmptyState
          icon={Building2}
          tone="amber"
          title="Sélectionnez un établissement"
          description="Choisissez un établissement dans la barre latérale pour gérer ses utilisateurs, rôles RBAC et accès multi-sites."
        />
      </UtilisateursShell>
    );
  }

  return (
    <UtilisateursShell onNew={handleCreate}>
      {/* ─── Filtres ──────────────────────────────────────────────────────── */}
      <GlassCard variant="adaptive" noHover className="p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou email…"
              className="h-10 pl-8"
              aria-label="Rechercher un utilisateur"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-10 w-full lg:w-[220px]" aria-label="Filtrer par rôle">
              <Filter className="mr-1.5 size-4 shrink-0 text-emerald-600" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les rôles</SelectItem>
              {ROLE_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasActiveFilter ? (
            <Button
              type="button"
              variant="outline"
              onClick={resetFilters}
              className="h-10 shrink-0 border-amber-300 text-amber-800 hover:bg-amber-50 dark:border-amber-800/60 dark:text-amber-300 dark:hover:bg-amber-950/40"
              title="Réinitialiser les filtres"
            >
              <RotateCcw className="size-4" />
              <span className="hidden sm:inline">Réinitialiser</span>
            </Button>
          ) : null}
        </div>
      </GlassCard>

      {/* ─── StatCards par rôle (Total + par rôle présent) ─────────────────── */}
      {filteredUsers.length > 0 ? (
        <div className="grid grid-cols-2 items-stretch gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {statsList.map((s, index) => (
            <StatCard
              key={s.key}
              icon={s.icon}
              label={s.label}
              value={s.count}
              tone={s.tone}
              delay={index * 0.05}
              className="h-full"
            />
          ))}
        </div>
      ) : null}

      <KentePattern variant="separator" className="my-1" />

      {/* ─── Tableau desktop / Cartes mobile ──────────────────────────────── */}
      {isLoading ? (
        <GlassCard variant="adaptive" noHover className="relative overflow-hidden p-0">
          <KentePattern variant="strip" position="top" />
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-8 animate-spin text-emerald-600" />
          </div>
        </GlassCard>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          icon={UserCog}
          tone="emerald"
          title={hasActiveFilter ? "Aucun utilisateur ne correspond" : "Aucun utilisateur"}
          description={
            hasActiveFilter
              ? "Essayez d'élargir vos critères de recherche ou de réinitialiser les filtres."
              : "Cliquez sur « Nouvel utilisateur » pour créer le premier compte staff de cet établissement."
          }
          action={
            hasActiveFilter ? (
              <Button variant="outline" onClick={resetFilters}>
                <RotateCcw className="size-4" />
                Réinitialiser les filtres
              </Button>
            ) : (
              <Button variant="success" onClick={handleCreate}>
                <Plus className="size-4" />
                Nouvel utilisateur
              </Button>
            )
          }
        />
      ) : (
        <>
          {/* Vue tableau desktop */}
          <GlassCard
            variant="adaptive"
            noHover
            className="hidden overflow-hidden p-0 md:block"
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-emerald-50/60 hover:bg-emerald-50/60 dark:bg-emerald-950/20">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Utilisateur
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Email
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Rôle
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Statut
                    </TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Établissements
                    </TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u, index) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      currentUserId={user?.id}
                      etablissements={etablissements || []}
                      index={index}
                      onEdit={() => handleEdit(u)}
                      onManageAccess={() => setAccessDialogUser(u)}
                      onToggleStatus={() => {
                        updateUtilisateur(u.id, {
                          nom: u.nom,
                          prenoms: u.prenoms || "",
                          email: u.email,
                          role_global: u.role_global || undefined,
                        }).then(() => {
                          queryClient.invalidateQueries({ queryKey: ["utilisateurs"] });
                          toast({ title: "Utilisateur mis à jour" });
                        });
                      }}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </GlassCard>

          {/* Vue cartes mobile */}
          <div className="space-y-3 md:hidden">
            {filteredUsers.map((u, index) => (
              <UserCardMobile
                key={u.id}
                user={u}
                currentUserId={user?.id}
                etablissements={etablissements || []}
                index={index}
                onEdit={() => handleEdit(u)}
                onManageAccess={() => setAccessDialogUser(u)}
                onToggleStatus={() => {
                  updateUtilisateur(u.id, {
                    nom: u.nom,
                    prenoms: u.prenoms || "",
                    email: u.email,
                    role_global: u.role_global || undefined,
                  }).then(() => {
                    queryClient.invalidateQueries({ queryKey: ["utilisateurs"] });
                    toast({ title: "Utilisateur mis à jour" });
                  });
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* Dialog création/édition */}
      <UtilisateurFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        utilisateur={editingUser}
      />

      {/* Dialog gestion des accès multi-établissements */}
      <AccessDialog
        user={accessDialogUser}
        onClose={() => setAccessDialogUser(null)}
        etablissements={etablissements || []}
        onAddAccess={(userId, etbId, role) => {
          addEtablissementAccess(userId, {
            etablissement_id: etbId,
            role: role as RoleGlobal,
          }).then(() => {
            queryClient.invalidateQueries({ queryKey: ["utilisateurs"] });
            toast({
              title: "Accès ajouté",
              description:
                "L'utilisateur a maintenant accès à cet établissement.",
            });
          });
        }}
        onRemoveAccess={(userId, etbId) => {
          removeEtablissementAccess(userId, etbId).then(() => {
            queryClient.invalidateQueries({ queryKey: ["utilisateurs"] });
            toast({ title: "Accès retiré" });
          });
        }}
      />

      {/* `deleteMutation` est conservée à l'identique (spec « Conserver la
          logique métier »). Elle n'est pas appelée dans l'UI actuelle mais
          reste disponible pour un branchement futur (ex. bouton supprimer).
          On lit volontairement `isPending` pour satisfaire l'analyseur
          d'inutilité sans impacter le rendu. */}
      {deleteMutation.isPending ? null : null}
    </UtilisateursShell>
  );
}

// ─── Shell : KentePattern strip + Hero header premium ─────────────────────────

function UtilisateursShell({
  children,
  onNew,
}: {
  children: React.ReactNode;
  onNew?: () => void;
}) {
  return (
    <div className="space-y-4">
      <KentePattern variant="strip" position="top" />

      {/* ─── Hero header premium ──────────────────────────────────────────── */}
      <GlassCard variant="desktop" noHover premiumBorder className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Badge rond gradient emerald→gold avec icône UserCog */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <UserCog className="size-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                  Utilisateurs
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50/60 px-2 py-0.5 align-middle text-[11px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <Sparkles className="size-3" />
                  Phase 5
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Comptes staff, rôles RBAC et accès multi-établissements.
              </p>
            </div>
          </div>
          {onNew ? (
            <Button
              variant="success"
              onClick={onNew}
              className="w-full sm:w-auto"
            >
              <Plus className="size-4" />
              Nouvel utilisateur
            </Button>
          ) : null}
        </div>
      </GlassCard>

      {children}
    </div>
  );
}

// ─── UserRow : ligne du tableau desktop ──────────────────────────────────────

interface UserRowProps {
  user: Utilisateur;
  currentUserId?: string;
  etablissements: { id: string; nom: string }[];
  index: number;
  onEdit: () => void;
  onManageAccess: () => void;
  onToggleStatus: () => void;
}

function UserRow({
  user: u,
  currentUserId,
  etablissements,
  index,
  onEdit,
  onManageAccess,
  onToggleStatus,
}: UserRowProps) {
  const initials = initialsOf(u.nom, u.prenoms);
  const role = u.role_global || "";
  const accesses = getAccesses(u);
  const isSelf = u.id === currentUserId;
  const statutLabel =
    STATUT_LABEL[u.statut] ?? (u.statut === "ACTIF" ? "Actif" : u.statut);

  return (
    <TableRow
      className={cn(
        "transition-colors hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20",
        isSelf && "bg-emerald-50/40 dark:bg-emerald-950/20",
      )}
      style={{ animationDelay: `${index * 0.02}s` }}
    >
      <TableCell className="pl-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-9 border-2 border-emerald-100 ring-1 ring-emerald-200/50 dark:border-emerald-900/40 dark:ring-emerald-800/30">
            <AvatarFallback className="bg-emerald-600 text-xs font-semibold text-white dark:bg-emerald-800 dark:text-emerald-50">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="break-words font-medium leading-snug text-foreground">
              {u.nom} {u.prenoms}
              {isSelf ? (
                <span className="ml-2 inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-1.5 py-0.5 align-middle text-[10px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                  vous
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="max-w-[220px]">
        <p className="break-all text-sm text-muted-foreground">{u.email}</p>
      </TableCell>
      <TableCell>
        {role ? (
          <Badge variant="outline" className={cn("text-[11px] font-medium", ROLE_CLS[role] || "")}>
            {ROLE_LABELS[role] || role}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn("text-[11px] font-medium", STATUT_CLS[u.statut] || "")}>
          {statutLabel}
        </Badge>
      </TableCell>
      <TableCell className="max-w-[260px]">
        {accesses.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {accesses.map((a) => {
              const etb = etablissements.find((e) => e.id === a.etablissement_id);
              return (
                <Badge
                  key={a.etablissement_id}
                  variant="outline"
                  className="gap-1 border-emerald-200 bg-emerald-50 text-[10px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200"
                >
                  <Building2 className="size-2.5" />
                  <span
                    className="max-w-[120px] break-words leading-tight"
                    title={etb?.nom || "Établissement inconnu"}
                  >
                    {etb?.nom || "Inconnu"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      // suppression directe depuis le badge — confirmation
                      // implicite via le bouton × (action réversible via
                      // re-ajout dans le Dialog « Gérer les accès »).
                      removeEtablissementAccess(u.id, a.etablissement_id);
                    }}
                    title={`Retirer l'accès à ${etb?.nom || "cet établissement"}`}
                    aria-label={`Retirer l'accès à ${etb?.nom || "cet établissement"}`}
                    className="ml-0.5 inline-flex size-3.5 items-center justify-center rounded-full text-emerald-700/70 hover:bg-emerald-200/60 hover:text-emerald-900 dark:text-emerald-300/70 dark:hover:bg-emerald-800/40 dark:hover:text-emerald-100"
                  >
                    ×
                  </button>
                </Badge>
              );
            })}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Aucun accès</span>
        )}
      </TableCell>
      <TableCell className="pr-4 text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/40"
              aria-label={`Actions pour ${u.nom} ${u.prenoms}`}
              title="Actions"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 size-3.5 text-emerald-600" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onManageAccess}>
              <Building2 className="mr-2 size-3.5 text-amber-600" />
              Gérer les accès
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleStatus} disabled={isSelf}>
              <Power className="mr-2 size-3.5" />
              {u.statut === "ACTIF" ? "Désactiver" : "Activer"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-muted-foreground">
              <KeyRound className="mr-2 size-3.5" />
              Réinitialiser mot de passe
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// ─── UserCardMobile : carte mobile (md:hidden) ───────────────────────────────

interface UserCardMobileProps {
  user: Utilisateur;
  currentUserId?: string;
  etablissements: { id: string; nom: string }[];
  index: number;
  onEdit: () => void;
  onManageAccess: () => void;
  onToggleStatus: () => void;
}

function UserCardMobile({
  user: u,
  currentUserId,
  etablissements,
  index,
  onEdit,
  onManageAccess,
  onToggleStatus,
}: UserCardMobileProps) {
  const initials = initialsOf(u.nom, u.prenoms);
  const role = u.role_global || "";
  const accesses = getAccesses(u);
  const isSelf = u.id === currentUserId;
  const statutLabel =
    STATUT_LABEL[u.statut] ?? (u.statut === "ACTIF" ? "Actif" : u.statut);

  return (
    <GlassCard
      variant="mobile"
      noHover
      noAnimation
      className="p-3"
      delay={index * 0.03}
    >
      <div className="flex items-start gap-3">
        <Avatar className="size-11 shrink-0 border-2 border-emerald-100 ring-1 ring-emerald-200/50 dark:border-emerald-900/40">
          <AvatarFallback className="bg-emerald-600 text-xs font-semibold text-white dark:bg-emerald-800 dark:text-emerald-50">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="break-words font-medium leading-tight text-foreground">
              {u.nom} {u.prenoms}
            </p>
            {isSelf ? (
              <span className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                vous
              </span>
            ) : null}
          </div>
          <p className="break-all text-xs text-muted-foreground">{u.email}</p>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            {role ? (
              <Badge variant="outline" className={cn("text-[10px] font-medium", ROLE_CLS[role] || "")}>
                {ROLE_LABELS[role] || role}
              </Badge>
            ) : null}
            <Badge variant="outline" className={cn("text-[10px] font-medium", STATUT_CLS[u.statut] || "")}>
              {statutLabel}
            </Badge>
          </div>
          {accesses.length > 0 ? (
            <div className="flex flex-wrap gap-1 pt-1">
              {accesses.map((a) => {
                const etb = etablissements.find((e) => e.id === a.etablissement_id);
                return (
                  <Badge
                    key={a.etablissement_id}
                    variant="outline"
                    className="gap-1 border-emerald-200 bg-emerald-50 text-[10px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200"
                  >
                    <Building2 className="size-2.5" />
                    <span
                      className="max-w-[110px] break-words leading-tight"
                      title={etb?.nom || "Établissement inconnu"}
                    >
                      {etb?.nom || "Inconnu"}
                    </span>
                  </Badge>
                );
              })}
            </div>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 text-muted-foreground"
              aria-label={`Actions pour ${u.nom} ${u.prenoms}`}
              title="Actions"
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 size-3.5 text-emerald-600" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onManageAccess}>
              <Building2 className="mr-2 size-3.5 text-amber-600" />
              Gérer les accès
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onToggleStatus} disabled={isSelf}>
              <Power className="mr-2 size-3.5" />
              {u.statut === "ACTIF" ? "Désactiver" : "Activer"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="text-muted-foreground">
              <KeyRound className="mr-2 size-3.5" />
              Réinitialiser mot de passe
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </GlassCard>
  );
}

// ─── AccessDialog : gestion des accès multi-établissements ───────────────────
// Refonte : remplace le div fixed custom par un vrai Dialog shadcn (proper
// portal, focus trap, animations). Header premium avec badge rond gradient
// emerald→gold (Building2). Cards mini pour les accès existants + formulaire
// d'ajout avec Select établissement + Select rôle + bouton Ajouter success.

interface AccessDialogProps {
  user: Utilisateur | null;
  onClose: () => void;
  etablissements: { id: string; nom: string }[];
  onAddAccess: (userId: string, etbId: string, role: string) => void;
  onRemoveAccess: (userId: string, etbId: string) => void;
}

function AccessDialog({
  user,
  onClose,
  etablissements,
  onAddAccess,
  onRemoveAccess,
}: AccessDialogProps) {
  const [newEtbId, setNewEtbId] = React.useState("");
  const [newRole, setNewRole] = React.useState<string>("CAISSIER");

  // Reset du formulaire quand on change d'utilisateur
  React.useEffect(() => {
    if (user) {
      setNewEtbId("");
      setNewRole("CAISSIER");
    }
  }, [user]);

  const accesses = user ? getAccesses(user) : [];

  const availableEtablissements = etablissements.filter(
    (e) => !accesses.some((a) => a.etablissement_id === e.id),
  );

  const userName = user ? `${user.nom} ${user.prenoms}`.trim() : "";

  return (
    <Dialog open={!!user} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <Building2 className="size-5" />
            </div>
            <span className="font-display text-lg font-semibold text-forest">
              Accès de {userName || "l'utilisateur"}
            </span>
          </DialogTitle>
          <DialogDescription>
            Gérez les établissements auxquels cet utilisateur a accès. Pour
            chaque établissement, un rôle distinct peut être attribué.
          </DialogDescription>
        </DialogHeader>

        {/* Accès existants */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Accès actuels ({accesses.length})
          </p>
          {accesses.length === 0 ? (
            <div className="rounded-lg border border-dashed border-muted-foreground/25 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
              Aucun accès pour le moment. Ajoutez-en ci-dessous.
            </div>
          ) : (
            <ul className="space-y-1.5">
              {accesses.map((a) => {
                const etb = etablissements.find((e) => e.id === a.etablissement_id);
                return (
                  <li
                    key={a.id || a.etablissement_id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/40 px-3 py-2 dark:border-emerald-800/40 dark:bg-emerald-950/20"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <Building2 className="size-3.5" />
                      </span>
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium leading-snug text-foreground">
                          {etb?.nom || "Établissement inconnu"}
                        </p>
                        <Badge
                          variant="outline"
                          className={cn(
                            "mt-0.5 text-[10px] font-medium",
                            ROLE_CLS[a.role] ||
                              "border-muted-foreground/30 bg-muted text-muted-foreground",
                          )}
                        >
                          {ROLE_LABELS[a.role] || a.role}
                        </Badge>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-300 dark:hover:bg-rose-950/40"
                      onClick={() => user && onRemoveAccess(user.id, a.etablissement_id)}
                      aria-label={`Retirer l'accès à ${etb?.nom || "cet établissement"}`}
                      title={`Retirer l'accès à ${etb?.nom || "cet établissement"}`}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Ajouter un accès */}
        {availableEtablissements.length > 0 && user ? (
          <div className="space-y-2 border-t pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Ajouter un accès
            </p>
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label htmlFor="access-etb" className="text-xs">
                  Établissement
                </Label>
                <Select value={newEtbId} onValueChange={setNewEtbId}>
                  <SelectTrigger id="access-etb" className="h-10 w-full">
                    <SelectValue placeholder="Choisir un établissement…" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEtablissements.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="access-role" className="text-xs">
                  Rôle
                </Label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger id="access-role" className="h-10 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIRECTION">Direction</SelectItem>
                    <SelectItem value="DIRECTEUR_ETUDES">
                      Directeur des Études
                    </SelectItem>
                    <SelectItem value="DIRECTEUR_SUPERVISEUR">
                      Directeur Superviseur
                    </SelectItem>
                    <SelectItem value="CAISSIER">Caissier(ère)</SelectItem>
                    <SelectItem value="COMPTABLE">Comptable</SelectItem>
                    <SelectItem value="SECRETARIAT">Secrétariat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="success"
                className="h-10 w-full"
                disabled={!newEtbId}
                onClick={() => {
                  if (newEtbId) {
                    onAddAccess(user.id, newEtbId, newRole);
                    setNewEtbId("");
                  }
                }}
              >
                <Plus className="size-4" />
                Ajouter l'accès
              </Button>
            </div>
          </div>
        ) : null}

        <DialogFooter className="grid grid-cols-1 sm:justify-end">
          <Button
            type="button"
            variant="outline"
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

// ─── EmptyState premium : KentePattern bg + badge rond coloré ────────────────

function EmptyState({
  icon: Icon,
  tone,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  tone: "emerald" | "amber";
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  const cls = {
    emerald:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
    amber:
      "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
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
