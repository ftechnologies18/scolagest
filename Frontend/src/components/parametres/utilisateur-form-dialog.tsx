"use client";

/**
 * ScolaGest — Dialogue de création / édition d&apos;un utilisateur (Phase 5).
 *
 * Champs principaux : nom, prenoms, email, password (création uniquement),
 * role_global, statut.
 *
 * Gestion des accès multi-établissements : pour chaque établissement du
 * groupe, on peut attribuer un rôle (RBAC) ou retirer l&apos;accès.
 *
 * Soumission → `createUtilisateur` / `updateUtilisateur` puis invalidation
 * `usersKeys.list`.
 */

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  UserCog,
  Loader2,
  Save,
  Plus,
  Trash2,
  Building2,
} from "lucide-react";

import {
  createUtilisateur,
  updateUtilisateur,
  fetchEtablissements,
  etablissementsKeys,
  addEtablissementAccess,
  removeEtablissementAccess,
  usersKeys,
} from "@/lib/api-phase5";
import { useToast } from "@/hooks/use-toast";
import type {
  EtablissementAccess,
  RoleGlobal,
  Utilisateur,
  UtilisateurDTO,
} from "@/lib/types";
import type { Etablissement } from "@/lib/auth-store";
import { useAuthStore } from "@/lib/auth-store";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_ROLE_OPTIONS: { value: RoleGlobal; label: string }[] = [
  { value: "DIRECTION", label: "Direction" },
  { value: "CAISSIER", label: "Caissier(ère)" },
  { value: "COMPTABLE", label: "Comptable" },
  { value: "SECRETARIAT", label: "Secrétariat" },
];

const ROLE_LABEL: Record<RoleGlobal, string> = {
  SUPER_ADMIN: "Super Admin (SaaS)",
  CAISSIER: "Caissier(ère)",
  COMPTABLE: "Comptable",
  DIRECTION: "Direction",
  SECRETARIAT: "Secrétariat",
  PARENT: "Parent / Tuteur",
};

export interface UtilisateurFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Utilisateur à éditer (null pour création). */
  utilisateur?: Utilisateur | null;
}

export function UtilisateurFormDialog({
  open,
  onOpenChange,
  utilisateur,
}: UtilisateurFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!utilisateur;
  const currentUserRole = useAuthStore((s) => s.role);

  // ── Gouvernance SaaS : filtrer les rôles créables ──
  // SUPER_ADMIN → peut créer DIRECTION (lié à l'abonnement) + CAISSIER/COMPTABLE/SECRETARIAT
  // DIRECTION → peut créer CAISSIER, COMPTABLE, SECRETARIAT uniquement
  const ROLE_OPTIONS = React.useMemo(() => {
    if (currentUserRole === "SUPER_ADMIN") {
      return ALL_ROLE_OPTIONS; // tous les rôles sauf SUPER_ADMIN et PARENT
    }
    // DIRECTION et autres : pas DIRECTION
    return ALL_ROLE_OPTIONS.filter((r) => r.value !== "DIRECTION");
  }, [currentUserRole]);

  const [nom, setNom] = React.useState("");
  const [prenoms, setPrenoms] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [roleGlobal, setRoleGlobal] = React.useState<RoleGlobal>("CAISSIER");
  const [statut, setStatut] = React.useState<string>("ACTIF");

  // Pour la gestion des accès : liste des établissements + accès existants
  const [accesses, setAccesses] = React.useState<EtablissementAccess[]>([]);
  const [newAccessEtabId, setNewAccessEtabId] = React.useState<string>("");
  const [newAccessRole, setNewAccessRole] =
    React.useState<RoleGlobal>("CAISSIER");

  const { data: etablissements } = useQuery({
    queryKey: etablissementsKeys.list(),
    queryFn: fetchEtablissements,
    enabled: open,
  });

  React.useEffect(() => {
    if (!open) return;
    if (utilisateur) {
      setNom(utilisateur.nom ?? "");
      setPrenoms(utilisateur.prenoms ?? "");
      setEmail(utilisateur.email ?? "");
      setPassword("");
      setRoleGlobal(utilisateur.role_global ?? "CAISSIER");
      setStatut(utilisateur.statut ?? "ACTIF");
      setAccesses(utilisateur.accesses ?? []);
    } else {
      setNom("");
      setPrenoms("");
      setEmail("");
      setPassword("");
      setRoleGlobal("CAISSIER");
      setStatut("ACTIF");
      setAccesses([]);
    }
    setNewAccessEtabId("");
    setNewAccessRole("CAISSIER");
  }, [open, utilisateur]);

  // Liste filtrée des établissements sans accès (pour le sélecteur d&apos;ajout)
  const availableEtabs = React.useMemo(() => {
    const usedIds = new Set(accesses.map((a) => a.etablissement_id));
    return (etablissements ?? []).filter((e) => !usedIds.has(e.id));
  }, [etablissements, accesses]);

  const mutation = useMutation({
    mutationFn: async () => {
      const dto: UtilisateurDTO = {
        nom: nom.trim(),
        prenoms: prenoms.trim(),
        email: email.trim(),
        role_global: roleGlobal,
        statut,
      };
      if (!isEdit && password) {
        dto.password = password;
      }
      if (isEdit && utilisateur) {
        return updateUtilisateur(utilisateur.id, dto);
      }
      return createUtilisateur(dto);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: usersKeys.all });
      toast({
        title: isEdit ? "Utilisateur mis à jour" : "Utilisateur créé",
        description: `« ${nom.trim()} ${prenoms.trim()} » a été ${
          isEdit ? "modifié" : "créé"
        } avec succès.`,
      });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible d'enregistrer l'utilisateur.",
        variant: "destructive",
      });
    },
  });

  const addAccessMutation = useMutation({
    mutationFn: async ({
      etabId,
      role,
    }: {
      etabId: string;
      role: RoleGlobal;
    }) => {
      if (!utilisateur) throw new Error("Utilisateur non chargé.");
      return addEtablissementAccess(utilisateur.id, {
        etablissement_id: etabId,
        role,
      });
    },
    onSuccess: async (newAccess) => {
      setAccesses((prev) => [...prev, newAccess]);
      setNewAccessEtabId("");
      await queryClient.invalidateQueries({ queryKey: usersKeys.all });
      toast({
        title: "Accès ajouté",
        description: `L'utilisateur a désormais accès à l'établissement sélectionné en tant que ${ROLE_LABEL[newAccess.role]}.`,
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible d'ajouter l'accès.",
        variant: "destructive",
      });
    },
  });

  const removeAccessMutation = useMutation({
    mutationFn: async ({
      etabId,
    }: {
      etabId: string;
    }) => {
      if (!utilisateur) throw new Error("Utilisateur non chargé.");
      return removeEtablissementAccess(utilisateur.id, etabId);
    },
    onSuccess: async (_res, vars) => {
      setAccesses((prev) =>
        prev.filter((a) => a.etablissement_id !== vars.etabId),
      );
      await queryClient.invalidateQueries({ queryKey: usersKeys.all });
      toast({
        title: "Accès retiré",
        description: "L'accès à l'établissement a été retiré.",
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de retirer l'accès.",
        variant: "destructive",
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim() || !email.trim()) {
      toast({
        title: "Champs manquants",
        description: "Le nom et l'email sont obligatoires.",
        variant: "destructive",
      });
      return;
    }
    if (!isEdit && !password.trim()) {
      toast({
        title: "Mot de passe requis",
        description: "Définissez un mot de passe initial pour cet utilisateur.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate();
  }

  function handleAddAccess() {
    if (!newAccessEtabId) {
      toast({
        title: "Sélection incomplète",
        description: "Choisissez un établissement et un rôle.",
        variant: "destructive",
      });
      return;
    }
    addAccessMutation.mutate({
      etabId: newAccessEtabId,
      role: newAccessRole,
    });
  }

  function handleRemoveAccess(etabId: string) {
    removeAccessMutation.mutate({ etabId });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="size-5 text-emerald-600" />
            {isEdit ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
          </DialogTitle>
          <DialogDescription>
            Créez un compte utilisateur et attribuez-lui des accès par
            établissement (multi-sites).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="u-nom">Nom</Label>
              <Input
                id="u-nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex. Konan"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-prenoms">Prénoms</Label>
              <Input
                id="u-prenoms"
                value={prenoms}
                onChange={(e) => setPrenoms(e.target.value)}
                placeholder="Ex. Yao Éric"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="u-email">Email</Label>
            <Input
              id="u-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ex. y.konan@etablissement.ci"
              required
            />
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="u-password">Mot de passe initial</Label>
              <Input
                id="u-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={6}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                L&apos;utilisateur pourra le changer à sa première connexion.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Rôle global</Label>
              <Select
                value={roleGlobal}
                onValueChange={(v) => setRoleGlobal(v as RoleGlobal)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select value={statut} onValueChange={setStatut}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIF">Actif</SelectItem>
                  <SelectItem value="INACTIF">Inactif</SelectItem>
                  <SelectItem value="SUSPENDU">Suspendu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Gestion des accès multi-établissements (mode édition seulement) */}
          {isEdit && (
            <>
              <Separator />
              <div className="space-y-3">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Building2 className="size-4 text-emerald-600" />
                    Accès par établissement
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Pour chaque établissement, attribuez un rôle distinct. Le
                    rôle effectif à la connexion dépend de l&apos;établissement
                    sélectionné.
                  </p>
                </div>

                {accesses.length === 0 ? (
                  <p className="rounded-md border border-dashed p-3 text-center text-xs text-muted-foreground">
                    Aucun accès pour le moment. Ajoutez-en ci-dessous.
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {accesses.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-2 rounded-md border bg-muted/20 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {a.etablissement?.nom ?? a.etablissement_id}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {a.etablissement?.ville ?? "—"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                          >
                            {ROLE_LABEL[a.role]}
                          </Badge>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-7 text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                            onClick={() => handleRemoveAccess(a.etablissement_id)}
                            disabled={removeAccessMutation.isPending}
                            aria-label="Retirer l'accès"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Ajout d&apos;un accès */}
                {availableEtabs.length > 0 && (
                  <div className="grid grid-cols-[2fr_2fr_auto] items-end gap-2">
                    <div className="space-y-1.5">
                      <Label className="text-[11px]">Établissement</Label>
                      <Select
                        value={newAccessEtabId}
                        onValueChange={setNewAccessEtabId}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Choisir…" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableEtabs.map((e: Etablissement) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.nom}
                              {e.ville ? ` — ${e.ville}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px]">Rôle</Label>
                      <Select
                        value={newAccessRole}
                        onValueChange={(v) => setNewAccessRole(v as RoleGlobal)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddAccess}
                      disabled={
                        addAccessMutation.isPending || !newAccessEtabId
                      }
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <Plus className="size-3.5" />
                      Ajouter
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {isEdit ? "Enregistrer" : "Créer l'utilisateur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
