"use client";

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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GlassCard } from "@/components/ds/glass-card";
import { StatCard } from "@/components/ds/stat-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { Input } from "@/components/ui/input";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/auth-store";
import { fetchUtilisateurs, createUtilisateur, updateUtilisateur, addEtablissementAccess, removeEtablissementAccess, fetchEtablissements } from "@/lib/api-phase5";
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
  SUPER_ADMIN: "border-rose-200 bg-rose-50 text-rose-700",
  DIRECTION: "border-sky-200 bg-sky-50 text-sky-700",
  DIRECTEUR_ETUDES:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300",
  DIRECTEUR_SUPERVISEUR:
    "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-300",
  CAISSIER: "border-emerald-200 bg-emerald-50 text-emerald-700",
  COMPTABLE: "border-amber-200 bg-amber-50 text-amber-700",
  SECRETARIAT: "border-muted-foreground/20 bg-muted text-muted-foreground",
};

const STATUT_CLS: Record<string, string> = {
  ACTIF: "border-emerald-200 bg-emerald-50 text-emerald-700",
  INACTIF: "border-muted-foreground/20 bg-muted text-muted-foreground",
  BLOQUE: "border-rose-200 bg-rose-50 text-rose-700",
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

const ROLE_ICON: Record<string, typeof UserCog> = {
  SUPER_ADMIN: ShieldCheck,
  DIRECTION: ShieldCheck,
  DIRECTEUR_ETUDES: UserCog,
  DIRECTEUR_SUPERVISEUR: UserCog,
  CAISSIER: UserCog,
  COMPTABLE: UserCog,
  SECRETARIAT: UserCog,
};

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

  // Fetch utilisateurs
  const { data: users, isLoading } = useQuery<Utilisateur[]>({
    queryKey: ["utilisateurs", etablissement?.id, search, roleFilter],
    queryFn: () => fetchUtilisateurs({ etablissement_id: etablissement?.id, search }),
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

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: (id: string) => updateUtilisateur(id, { nom: "", email: "", password: "" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["utilisateurs"] });
      toast({ title: "Utilisateur désactivé" });
    },
  });

  // Filtrage local par rôle
  const filteredUsers = React.useMemo(() => {
    if (!users) return [];
    let result = users;
    if (roleFilter !== "all") {
      result = result.filter((u) => u.role_global === roleFilter);
    }
    return result;
  }, [users, roleFilter]);

  const handleEdit = (u: Utilisateur) => {
    setEditingUser(u);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingUser(null);
    setDialogOpen(true);
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!etablissement?.id) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <Building2 className="size-12 text-muted-foreground/40" />
          <p className="mt-4 text-sm text-muted-foreground">
            Sélectionnez un établissement pour gérer les utilisateurs.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <KentePattern variant="strip" position="top" />
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight">Utilisateurs</h2>
          <p className="text-sm text-muted-foreground">
            Comptes staff, rôles RBAC et accès multi-établissements.
          </p>
        </div>
        <Button variant="success" onClick={handleCreate}>
          <Plus className="mr-2 size-4" />
          Nouvel utilisateur
        </Button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les rôles</SelectItem>
            <SelectItem value="DIRECTION">Direction</SelectItem>
            <SelectItem value="DIRECTEUR_ETUDES">Directeur des Études</SelectItem>
            <SelectItem value="DIRECTEUR_SUPERVISEUR">Directeur Superviseur</SelectItem>
            <SelectItem value="CAISSIER">Caissier(ère)</SelectItem>
            <SelectItem value="COMPTABLE">Comptable</SelectItem>
            <SelectItem value="SECRETARIAT">Secrétariat</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <KentePattern variant="separator" className="my-2" />

      {/* Tableau */}
      <GlassCard variant="adaptive" noHover className="overflow-hidden p-0">
        <div>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="size-8 animate-spin text-emerald-600" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <UserCog className="size-12 text-muted-foreground/40" />
              <p className="mt-4 text-sm text-muted-foreground">
                Aucun utilisateur trouvé.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Établissements</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      currentUserId={user?.id}
                      etablissements={etablissements || []}
                      onEdit={() => handleEdit(u)}
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
                      onAddAccess={(etbId, role) => {
                        addEtablissementAccess(u.id, { etablissement_id: etbId, role: role as RoleGlobal }).then(() => {
                          queryClient.invalidateQueries({ queryKey: ["utilisateurs"] });
                          toast({ title: "Accès ajouté", description: "L'utilisateur a maintenant accès à cet établissement." });
                        });
                      }}
                      onRemoveAccess={(etbId) => {
                        removeEtablissementAccess(u.id, etbId).then(() => {
                          queryClient.invalidateQueries({ queryKey: ["utilisateurs"] });
                          toast({ title: "Accès retiré" });
                        });
                      }}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Stats */}
      {filteredUsers.length > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {Object.entries(ROLE_LABELS).map(([role, label], index) => {
            const count = filteredUsers.filter((u) => u.role_global === role).length;
            if (count === 0) return null;
            return (
              <StatCard
                key={role}
                icon={ROLE_ICON[role] ?? UserCog}
                label={label}
                value={count}
                tone={ROLE_TONE[role] ?? "emerald"}
                delay={index * 0.05}
              />
            );
          })}
        </div>
      )}

      {/* Dialog création/édition */}
      <UtilisateurFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        utilisateur={editingUser}
      />
    </div>
  );
}

// ─── UserRow : ligne du tableau ──────────────────────────────────────────────

interface UserRowProps {
  user: Utilisateur;
  currentUserId?: string;
  etablissements: { id: string; nom: string }[];
  onEdit: () => void;
  onToggleStatus: () => void;
  onAddAccess: (etbId: string, role: string) => void;
  onRemoveAccess: (etbId: string) => void;
}

function UserRow({
  user: u,
  currentUserId,
  etablissements,
  onEdit,
  onToggleStatus,
  onAddAccess,
  onRemoveAccess,
}: UserRowProps) {
  const initials = `${(u.nom || "?")[0]}${(u.prenoms || "")[0]}`.toUpperCase();
  const role = u.role_global || "";
  const accesses = (u as Utilisateur & { etablissement_access?: EtablissementAccess[] }).etablissement_access || [];
  const isSelf = u.id === currentUserId;
  const [accessDialogOpen, setAccessDialogOpen] = React.useState(false);
  const [newEtbId, setNewEtbId] = React.useState("");
  const [newRole, setNewRole] = React.useState("CAISSIER");

  return (
    <TableRow className={isSelf ? "bg-emerald-50/40" : ""}>
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className="bg-emerald-100 text-emerald-700 text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">
              {u.nom} {u.prenoms}
              {isSelf && <span className="ml-2 text-xs text-emerald-600">(vous)</span>}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
      <TableCell>
        {role && (
          <Badge variant="outline" className={ROLE_CLS[role] || ""}>
            {ROLE_LABELS[role] || role}
          </Badge>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={STATUT_CLS[u.statut] || ""}>
          {u.statut === "ACTIF" ? "Actif" : u.statut === "INACTIF" ? "Inactif" : u.statut}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {accesses.length > 0 ? (
            accesses.map((a) => {
              const etb = etablissements.find((e) => e.id === a.etablissement_id);
              return (
                <Badge
                  key={a.etablissement_id}
                  variant="outline"
                  className="text-[10px] gap-1"
                >
                  {etb?.nom?.substring(0, 15) || "..."}
                  <button
                    onClick={() => onRemoveAccess(a.etablissement_id)}
                    className="text-muted-foreground hover:text-rose-600"
                  >
                    ×
                  </button>
                </Badge>
              );
            })
          ) : (
            <span className="text-xs text-muted-foreground">Aucun accès</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="size-8 p-0">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="mr-2 size-3.5" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAccessDialogOpen(true)}>
              <Building2 className="mr-2 size-3.5" />
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

      {/* Dialog gestion des accès */}
      {accessDialogOpen && (
        <AccessDialog
          open={accessDialogOpen}
          onOpenChange={setAccessDialogOpen}
          userName={`${u.nom} ${u.prenoms}`}
          accesses={accesses}
          etablissements={etablissements}
          newEtbId={newEtbId}
          setNewEtbId={setNewEtbId}
          newRole={newRole}
          setNewRole={setNewRole}
          onAdd={() => {
            if (newEtbId) {
              onAddAccess(newEtbId, newRole);
              setNewEtbId("");
            }
          }}
          onRemove={onRemoveAccess}
        />
      )}
    </TableRow>
  );
}

// ─── AccessDialog : gestion des accès multi-établissements ───────────────────

function AccessDialog({
  open,
  onOpenChange,
  userName,
  accesses,
  etablissements,
  newEtbId,
  setNewEtbId,
  newRole,
  setNewRole,
  onAdd,
  onRemove,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userName: string;
  accesses: EtablissementAccess[];
  etablissements: { id: string; nom: string }[];
  newEtbId: string;
  setNewEtbId: (v: string) => void;
  newRole: string;
  setNewRole: (v: string) => void;
  onAdd: () => void;
  onRemove: (etbId: string) => void;
}) {
  const availableEtablissements = etablissements.filter(
    (e) => !accesses.some((a) => a.etablissement_id === e.id)
  );

  return (
    <div
      className={`fixed inset-0 z-50 ${open ? "" : "hidden"}`}
      onClick={() => onOpenChange(false)}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-semibold">Accès de {userName}</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez les établissements auxquels cet utilisateur a accès.
          </p>

          {/* Accès existants */}
          <div className="mt-4 space-y-2">
            {accesses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">Aucun accès.</p>
            ) : (
              accesses.map((a) => {
                const etb = etablissements.find((e) => e.id === a.etablissement_id);
                return (
                  <div
                    key={a.etablissement_id}
                    className="flex items-center justify-between rounded-lg border p-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{etb?.nom || "Inconnu"}</p>
                      <Badge variant="outline" className="text-[10px] mt-0.5">
                        {ROLE_LABELS[a.role] || a.role}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 hover:text-rose-700"
                      onClick={() => onRemove(a.etablissement_id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          {/* Ajouter un accès */}
          {availableEtablissements.length > 0 && (
            <div className="mt-4 space-y-2 border-t pt-4">
              <p className="text-sm font-medium">Ajouter un accès</p>
              <div className="flex gap-2">
                <Select value={newEtbId} onValueChange={setNewEtbId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Établissement" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEtablissements.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DIRECTION">Direction</SelectItem>
            <SelectItem value="DIRECTEUR_ETUDES">Directeur des Études</SelectItem>
            <SelectItem value="DIRECTEUR_SUPERVISEUR">Directeur Superviseur</SelectItem>
                    <SelectItem value="CAISSIER">Caissier</SelectItem>
                    <SelectItem value="COMPTABLE">Comptable</SelectItem>
                    <SelectItem value="SECRETARIAT">Secrétariat</SelectItem>
                  </SelectContent>
                </Select>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={onAdd}>
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
