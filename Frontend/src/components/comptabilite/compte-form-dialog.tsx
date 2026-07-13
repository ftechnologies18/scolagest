"use client";

/**
 * ScolaGest — Dialogue de création d'un compte comptable (Phase 5).
 *
 * Champs : numéro, libellé, type (ACTIF/PASSIF/PRODUIT/CHARGE), parent
 * (optionnel, filtré par type), switch actif.
 * Soumission → `createCompte(dto)` puis invalidation `comptaKeys.comptes`.
 *
 * Refonte « Forêt EdTech » (Task 4) :
 *  - Header premium : badge rond gradient emerald→gold (ListTree size-5) +
 *    titre `font-display` text-lg text-forest + description contextuelle.
 *  - 3 sous-sections GlassCard tablet avec SectionTitle (badge rond emerald/15
 *    + icône contextuelle) :
 *      1. Identification (Hash) — Numéro + Libellé
 *      2. Classification (ListTree) — Type de compte
 *      3. Hiérarchie (GitBranch) — Compte parent + Switch actif
 *  - Inputs avec `bg-background` + focus ring emerald, Select avec icône
 *    contextuelle dans le SelectTrigger.
 *  - Switch actif encadré dans un GlassCard interne (border emerald-100).
 *  - Footer : grid-cols-2 sur mobile (boutons full-width) + sm:flex
 *    sm:justify-end sur desktop ; bouton Annuler variant outline + bouton
 *    submit variant success (icône Loader2 si pending, CheckCircle2 sinon,
 *    "Créer le compte").
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query (comptaKeys.comptes /
 * fetchComptes, enabled: open && !!etablissement?.id), état local (numero /
 * libelle / type / parentId / actif), parentOptions filtré par type, useEffect
 * init [open] + reset parentId sur [type], mutation createCompte avec
 * onSuccess/onError, validation numero.trim() + libelle.trim(), endpoints API
 * inchangés.
 */

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  ListTree,
  Loader2,
  Hash,
  GitBranch,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

import { useAuthStore } from "@/lib/auth-store";
import { createCompte, comptaKeys, fetchComptes } from "@/lib/api-phase5";
import { useToast } from "@/hooks/use-toast";
import type { CompteDTO, TypeCompte } from "@/lib/types";

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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GlassCard } from "@/components/ds/glass-card";

const TYPE_OPTIONS: { value: TypeCompte; label: string; desc: string }[] = [
  { value: "ACTIF", label: "Actif", desc: "Ce que possède l'établissement" },
  { value: "PASSIF", label: "Passif", desc: "Ce que doit l'établissement" },
  { value: "PRODUIT", label: "Produit", desc: "Revenus (scolarités…)" },
  { value: "CHARGE", label: "Charge", desc: "Dépenses (salaires, fournitures…)" },
];

export interface CompteFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompteFormDialog({
  open,
  onOpenChange,
}: CompteFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const etablissement = useAuthStore((s) => s.etablissement);

  const [numero, setNumero] = React.useState("");
  const [libelle, setLibelle] = React.useState("");
  const [type, setType] = React.useState<TypeCompte>("ACTIF");
  const [parentId, setParentId] = React.useState<string>("__none__");
  const [actif, setActif] = React.useState(true);

  // Liste des comptes (pour le select "parent")
  const { data: allComptes } = useQuery({
    queryKey: comptaKeys.comptes(etablissement?.id),
    queryFn: () => fetchComptes(etablissement?.id),
    enabled: open && !!etablissement?.id,
  });

  // Parents filtrés par le type sélectionné
  const parentOptions = React.useMemo(() => {
    return (allComptes ?? []).filter((c) => c.type === type && c.actif);
  }, [allComptes, type]);

  React.useEffect(() => {
    if (!open) return;
    setNumero("");
    setLibelle("");
    setType("ACTIF");
    setParentId("__none__");
    setActif(true);
  }, [open]);

  // Réinitialiser le parent quand on change de type (cohérence)
  React.useEffect(() => {
    setParentId("__none__");
  }, [type]);

  const mutation = useMutation({
    mutationFn: async () => {
      const dto: CompteDTO = {
        numero: numero.trim(),
        libelle: libelle.trim(),
        type,
        parent_id: parentId !== "__none__" ? parentId : null,
        actif,
      };
      return createCompte(dto);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: comptaKeys.comptes(etablissement?.id),
      });
      toast({
        title: "Compte créé",
        description: `« ${numero.trim()} — ${libelle.trim()} » a été ajouté au plan comptable.`,
      });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de créer le compte.",
        variant: "destructive",
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!numero.trim() || !libelle.trim()) {
      toast({
        title: "Champs manquants",
        description: "Le numéro et le libellé du compte sont obligatoires.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {/* Badge rond gradient emerald→gold avec icône ListTree */}
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <ListTree className="size-5" />
            </div>
            <span className="font-display text-lg font-semibold text-forest">
              Nouveau compte comptable
            </span>
          </DialogTitle>
          <DialogDescription>
            Ajoutez un compte au plan comptable de l&apos;établissement. Les
            comptes sont organisés par type (actif / passif / produit / charge)
            et peuvent être hiérarchisés.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ─── Section 1 : Identification ──────────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="space-y-3 p-4">
            <SectionTitle icon={Hash}>Identification</SectionTitle>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cpt-numero">Numéro</Label>
                <Input
                  id="cpt-numero"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="Ex. 411"
                  className="font-mono bg-background focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cpt-libelle">Libellé</Label>
                <Input
                  id="cpt-libelle"
                  value={libelle}
                  onChange={(e) => setLibelle(e.target.value)}
                  placeholder="Ex. Élèves — débiteurs"
                  className="bg-background focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                  required
                />
              </div>
            </div>
          </GlassCard>

          {/* ─── Section 2 : Classification ──────────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="space-y-3 p-4">
            <SectionTitle icon={ListTree}>Classification</SectionTitle>
            <div className="space-y-1.5">
              <Label>Type de compte</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as TypeCompte)}
              >
                <SelectTrigger className="h-10 w-full bg-background">
                  <ListTree className="mr-1.5 size-4 shrink-0 text-emerald-600" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col">
                        <span>{opt.label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {opt.desc}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </GlassCard>

          {/* ─── Section 3 : Hiérarchie & état ───────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="space-y-3 p-4">
            <SectionTitle icon={GitBranch}>Hiérarchie &amp; état</SectionTitle>
            <div className="space-y-1.5">
              <Label>Compte parent (optionnel)</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="h-10 w-full bg-background">
                  <GitBranch className="mr-1.5 size-4 shrink-0 text-emerald-600" />
                  <SelectValue placeholder="Aucun (compte racine)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun (compte racine)</SelectItem>
                  {parentOptions.length === 0 ? (
                    <SelectItem value="__empty__" disabled>
                      Aucun compte de ce type disponible
                    </SelectItem>
                  ) : (
                    parentOptions.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <span className="font-mono">{c.numero}</span>
                        {" — "}
                        {c.libelle}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50/40 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div>
                <Label htmlFor="cpt-actif" className="text-sm font-medium">
                  Compte actif
                </Label>
                <p className="text-xs text-muted-foreground">
                  Un compte inactif n&apos;apparaît plus dans les sélections
                  (écritures, grand livre) mais reste dans l&apos;historique.
                </p>
              </div>
              <Switch id="cpt-actif" checked={actif} onCheckedChange={setActif} />
            </div>
          </GlassCard>

          {/* ─── Footer premium ───────────────────────────────────────── */}
          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
              className="h-10 w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="success"
              disabled={
                mutation.isPending || !numero.trim() || !libelle.trim()
              }
              className="h-10 w-full sm:w-auto"
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Créer le compte
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
