"use client";

/**
 * ScolaGest — Dialogue de création / édition d'un utilisateur (Phase 5 —
 * Refonte Forêt EdTech).
 *
 * Champs principaux : nom, prenoms, email, password (création uniquement),
 * role_global, statut.
 *
 * Gestion des accès multi-établissements : pour chaque établissement du
 * groupe, on peut attribuer un rôle (RBAC) ou retirer l'accès.
 *
 * Refonte Forêt EdTech :
 *  - Header premium : badge rond gradient emerald→gold (UserCog) + titre
 *    `font-display` text-lg + description contextuelle.
 *  - 4 sous-sections GlassCard tablet avec SectionTitle (badge rond
 *    emerald/15 + icône contextuelle) :
 *      1. Identité (User) — Nom + Prénoms
 *      2. Connexion (KeyRound) — Email + Mot de passe (création uniquement)
 *      3. Rôle & statut (ShieldCheck) — Rôle global + Statut
 *      4. Accès multi-établissements (Building2) — mode édition seulement
 *  - Cards mini pour les accès existants (icône Building2 + badge rôle +
 *    bouton supprimer) + formulaire d'ajout (Select établissement + Select
 *    rôle + bouton Ajouter variant success).
 *  - Footer : grid-cols-2 sur mobile (boutons full-width) + sm:flex
 *    sm:justify-end sur desktop ; bouton submit variant="success" avec
 *    Save/Loader2.
 *
 * Soumission → `createUtilisateur` / `updateUtilisateur` puis invalidation
 * `usersKeys.list`. Gestion des accès → `addEtablissementAccess` /
 * `removeEtablissementAccess` puis invalidation `usersKeys.all`.
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query (fetchEtablissements /
 * etablissementsKeys.list), mutations createUtilisateur / updateUtilisateur
 * / addEtablissementAccess / removeEtablissementAccess, gouvernance SaaS
 * (ROLE_OPTIONS filtré selon currentUserRole), état du formulaire et
 * useEffect init [open, utilisateur]. Endpoints API inchangés.
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
  User,
  KeyRound,
  ShieldCheck,
  Power,
  type LucideIcon,
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
import { GlassCard } from "@/components/ds/glass-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL_ROLE_OPTIONS: { value: RoleGlobal; label: string }[] = [
  { value: "DIRECTEUR_ETUDES", label: "Directeur des Études" },
  { value: "DIRECTEUR_SUPERVISEUR", label: "Directeur Superviseur" },
  { value: "CAISSIER", label: "Caissier(ère)" },
  { value: "COMPTABLE", label: "Comptable" },
  { value: "SECRETARIAT", label: "Secrétariat" },
  { value: "EDUCATEUR", label: "Éducateur" },
];

// NOTE : `Record<RoleGlobal, string>` impose la présence de TOUS les rôles
// du type union (types.ts). Les rôles DIRECTEUR_ETUDES et
// DIRECTEUR_SUPERVISEUR sont ajoutés pour satisfaire le typage — même si
// l'UI de création filtre ces rôles pour DIRECTION (gouvernance SaaS), ils
// peuvent s'afficher dans la liste des accès multi-établissements.
const ROLE_LABEL: Record<RoleGlobal, string> = {
  SUPER_ADMIN: "Super Admin (SaaS)",
  CAISSIER: "Caissier(ère)",
  COMPTABLE: "Comptable",
  DIRECTION: "Direction",
  DIRECTEUR_ETUDES: "Directeur des Études",
  DIRECTEUR_SUPERVISEUR: "Directeur Superviseur",
  SECRETARIAT: "Secrétariat",
  EDUCATEUR: "Éducateur",
  PARENT: "Parent / Tuteur",
};

const STATUT_OPTIONS: { value: string; label: string }[] = [
  { value: "ACTIF", label: "Actif" },
  { value: "INACTIF", label: "Inactif" },
  { value: "SUSPENDU", label: "Suspendu" },
];

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
    return ALL_ROLE_OPTIONS.filter(
      (r) =>
        r.value !== "DIRECTION" &&
        r.value !== "DIRECTEUR_ETUDES" &&
        r.value !== "DIRECTEUR_SUPERVISEUR",
    );
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

  // Liste filtrée des établissements sans accès (pour le sélecteur d'ajout)
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
          <DialogTitle className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <UserCog className="size-5" />
            </div>
            <span className="font-display text-lg font-semibold text-forest">
              {isEdit ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
            </span>
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Met à jour les informations de l'utilisateur et gère ses accès multi-établissements."
              : "Créez un compte utilisateur et attribuez-lui un rôle global. Les accès multi-établissements se gèrent après création."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ─── Section 1 : Identité ─────────────────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="space-y-3 p-4">
            <SectionTitle icon={User}>Identité</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="u-nom">Nom</Label>
                <Input
                  id="u-nom"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  placeholder="Ex. Konan"
                  required
                  className="focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="u-prenoms">Prénoms</Label>
                <Input
                  id="u-prenoms"
                  value={prenoms}
                  onChange={(e) => setPrenoms(e.target.value)}
                  placeholder="Ex. Yao Éric"
                  className="focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                />
              </div>
            </div>
          </GlassCard>

          {/* ─── Section 2 : Connexion ────────────────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="space-y-3 p-4">
            <SectionTitle icon={KeyRound}>Connexion</SectionTitle>
            <div className="space-y-1.5">
              <Label htmlFor="u-email">Email</Label>
              <Input
                id="u-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ex. y.konan@etablissement.ci"
                required
                className="focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
              />
            </div>
            {!isEdit ? (
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
                  className="focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                />
                <p className="text-[11px] text-muted-foreground">
                  L&apos;utilisateur pourra le changer à sa première connexion.
                </p>
              </div>
            ) : null}
          </GlassCard>

          {/* ─── Section 3 : Rôle & statut ────────────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="space-y-3 p-4">
            <SectionTitle icon={ShieldCheck}>Rôle &amp; statut</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="u-role">Rôle global</Label>
                <Select
                  value={roleGlobal}
                  onValueChange={(v) => setRoleGlobal(v as RoleGlobal)}
                >
                  <SelectTrigger id="u-role" className="h-10 w-full">
                    <UserCog className="mr-1.5 size-4 shrink-0 text-emerald-600" />
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
                <Label htmlFor="u-statut">Statut</Label>
                <Select value={statut} onValueChange={setStatut}>
                  <SelectTrigger id="u-statut" className="h-10 w-full">
                    <Power className="mr-1.5 size-4 shrink-0 text-emerald-600" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUT_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </GlassCard>

          {/* ─── Section 4 : Accès multi-établissements (édition only) ── */}
          {isEdit ? (
            <GlassCard variant="tablet" noHover noAnimation className="space-y-3 p-4">
              <SectionTitle icon={Building2}>
                Accès multi-établissements
              </SectionTitle>
              <p className="text-xs text-muted-foreground">
                Pour chaque établissement, attribuez un rôle distinct. Le rôle
                effectif à la connexion dépend de l&apos;établissement
                sélectionné.
              </p>

              {accesses.length === 0 ? (
                <div className="rounded-lg border border-dashed border-muted-foreground/25 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
                  Aucun accès pour le moment. Ajoutez-en ci-dessous.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {accesses.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/40 px-3 py-2 dark:border-emerald-800/40 dark:bg-emerald-950/20"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <Building2 className="size-3.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="break-words text-sm font-medium leading-snug text-foreground">
                            {a.etablissement?.nom ?? a.etablissement_id}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {a.etablissement?.ville ?? "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-emerald-300 bg-emerald-100 text-[10px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200"
                        >
                          {ROLE_LABEL[a.role]}
                        </Badge>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="size-7 text-rose-600 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                          onClick={() => handleRemoveAccess(a.etablissement_id)}
                          disabled={removeAccessMutation.isPending}
                          aria-label="Retirer l'accès"
                          title="Retirer l'accès"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {/* Ajout d'un accès */}
              {availableEtabs.length > 0 ? (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Ajouter un accès
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[2fr_2fr_auto] sm:items-end">
                    <div className="space-y-1.5">
                      <Label htmlFor="u-new-etab" className="text-[11px]">
                        Établissement
                      </Label>
                      <Select
                        value={newAccessEtabId}
                        onValueChange={setNewAccessEtabId}
                      >
                        <SelectTrigger id="u-new-etab" className="h-10 w-full">
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
                      <Label htmlFor="u-new-role" className="text-[11px]">
                        Rôle
                      </Label>
                      <Select
                        value={newAccessRole}
                        onValueChange={(v) => setNewAccessRole(v as RoleGlobal)}
                      >
                        <SelectTrigger id="u-new-role" className="h-10 w-full">
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
                      variant="success"
                      className="h-10 w-full sm:w-auto"
                      onClick={handleAddAccess}
                      disabled={
                        addAccessMutation.isPending || !newAccessEtabId
                      }
                    >
                      {addAccessMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Plus className="size-3.5" />
                      )}
                      <span className="sm:hidden">Ajouter</span>
                      <span className="hidden sm:inline">Ajouter l&apos;accès</span>
                    </Button>
                  </div>
                </div>
              ) : null}
            </GlassCard>
          ) : null}

          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
              className="h-10"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="success"
              disabled={mutation.isPending}
              className="h-10"
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

// ─── SectionTitle : titre de sous-section avec icône dans badge rond ─────────

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <Icon className="size-3.5" />
      </span>
      <h3 className="font-display text-sm font-semibold tracking-tight text-forest">
        {children}
      </h3>
    </div>
  );
}
