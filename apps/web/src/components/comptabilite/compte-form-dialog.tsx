"use client";

/**
 * ScolaGest — Dialogue de création d'un compte comptable (Phase 5).
 *
 * Champs : numéro, libellé, type (ACTIF/PASSIF/PRODUIT/CHARGE), parent
 * (optionnel, filtré par type), switch actif.
 * Soumission → `createCompte(dto)` puis invalidation `comptaKeys.comptes`.
 */

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { ListTree, Loader2, Plus } from "lucide-react";

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListTree className="size-5 text-emerald-600" />
            Nouveau compte comptable
          </DialogTitle>
          <DialogDescription>
            Ajoutez un compte au plan comptable de l&apos;établissement. Les
            comptes sont organisés par type (actif / passif / produit / charge)
            et peuvent être hiérarchisés.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-[1fr_2fr] gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cpt-numero">Numéro</Label>
              <Input
                id="cpt-numero"
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ex. 411"
                className="font-mono"
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
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Type de compte</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as TypeCompte)}
            >
              <SelectTrigger className="w-full">
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

          <div className="space-y-1.5">
            <Label>Compte parent (optionnel)</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger className="w-full">
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

          <div className="flex items-center justify-between rounded-md border p-3">
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
              disabled={
                mutation.isPending || !numero.trim() || !libelle.trim()
              }
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Plus className="size-4" />
              )}
              Créer le compte
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
