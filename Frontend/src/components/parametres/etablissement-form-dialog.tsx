"use client";

/**
 * ScolaGest — Dialogue de création / édition d&apos;un établissement (Phase 5).
 *
 * Champs : nom, code_officiel, ville, applique_categorie_affecte (switch),
 * actif (switch). Soumission → `createEtablissement` ou
 * `updateEtablissement`, puis invalidation `etablissementsKeys.list`.
 */

import * as React from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Building2, Loader2, Save } from "lucide-react";

import {
  createEtablissement,
  updateEtablissement,
  etablissementsKeys,
} from "@/lib/api-phase5";
import { useToast } from "@/hooks/use-toast";
import type { Etablissement } from "@/lib/auth-store";

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

export interface EtablissementFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Établissement à éditer (null pour création). */
  etablissement?: Etablissement | null;
}

export function EtablissementFormDialog({
  open,
  onOpenChange,
  etablissement,
}: EtablissementFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isEdit = !!etablissement;

  const [nom, setNom] = React.useState("");
  const [codeOfficiel, setCodeOfficiel] = React.useState("");
  const [ville, setVille] = React.useState("");
  const [appliqueCategorie, setAppliqueCategorie] = React.useState(true);
  const [actif, setActif] = React.useState(true);
  const [quotaClasse, setQuotaClasse] = React.useState(45);

  React.useEffect(() => {
    if (!open) return;
    if (etablissement) {
      setNom(etablissement.nom ?? "");
      setCodeOfficiel(etablissement.code_officiel ?? "");
      setVille(etablissement.ville ?? "");
      setAppliqueCategorie(etablissement.applique_categorie_affecte ?? true);
      setActif(etablissement.actif ?? true);
      setQuotaClasse((etablissement as Etablissement & { quota_classe?: number }).quota_classe ?? 45);
    } else {
      setNom("");
      setCodeOfficiel("");
      setVille("");
      setAppliqueCategorie(true);
      setActif(true);
      setQuotaClasse(45);
    }
  }, [open, etablissement]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Partial<Etablissement> = {
        nom: nom.trim(),
        code_officiel: codeOfficiel.trim() || undefined,
        ville: ville.trim() || undefined,
        applique_categorie_affecte: appliqueCategorie,
        actif,
        quota_classe: quotaClasse,
      };
      if (isEdit && etablissement) {
        return updateEtablissement(etablissement.id, payload);
      }
      return createEtablissement(payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: etablissementsKeys.list(),
      });
      toast({
        title: isEdit ? "Établissement mis à jour" : "Établissement créé",
        description: `« ${nom.trim()} » a été ${
          isEdit ? "modifié" : "ajouté"
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
            : "Impossible d'enregistrer l'établissement.",
        variant: "destructive",
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim()) {
      toast({
        title: "Nom manquant",
        description: "Indiquez le nom de l'établissement.",
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
            <Building2 className="size-5 text-emerald-600" />
            {isEdit ? "Modifier l'établissement" : "Nouvel établissement"}
          </DialogTitle>
          <DialogDescription>
            Un établissement représente une école du groupe (multi-sites).
            Chaque établissement a son propre plan comptable, ses frais et ses
            élèves.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="etab-nom">Nom</Label>
            <Input
              id="etab-nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex. Collège Privé Le Chandelier"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="etab-code">Code officiel</Label>
              <Input
                id="etab-code"
                value={codeOfficiel}
                onChange={(e) => setCodeOfficiel(e.target.value)}
                placeholder="Ex. 13062"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="etab-ville">Ville</Label>
              <Input
                id="etab-ville"
                value={ville}
                onChange={(e) => setVille(e.target.value)}
                placeholder="Ex. Dabou"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="etab-cat" className="text-sm font-medium">
                Distinction Affecté / Non affecté
              </Label>
              <p className="text-xs text-muted-foreground">
                Active la gestion des catégories d&apos;élèves (frais
                différenciés selon l&apos;affectation).
              </p>
            </div>
            <Switch
              id="etab-cat"
              checked={appliqueCategorie}
              onCheckedChange={setAppliqueCategorie}
            />
          </div>

          {/* Quota classe */}
          <div className="space-y-2">
            <Label htmlFor="etab-quota" className="text-sm font-medium">
              Quota d&apos;élèves par classe
            </Label>
            <p className="text-xs text-muted-foreground">
              Nombre maximum d&apos;élèves par classe. Quand le quota est atteint,
              une nouvelle classe est créée automatiquement (ex: 6e A → 6e B).
            </p>
            <Input
              id="etab-quota"
              type="number"
              min={1}
              max={200}
              value={quotaClasse}
              onChange={(e) => setQuotaClasse(parseInt(e.target.value) || 45)}
              className="w-24"
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label htmlFor="etab-actif" className="text-sm font-medium">
                Établissement actif
              </Label>
              <p className="text-xs text-muted-foreground">
                Un établissement inactif n&apos;apparaît plus dans les
                sélections mais conserve son historique.
              </p>
            </div>
            <Switch
              id="etab-actif"
              checked={actif}
              onCheckedChange={setActif}
            />
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
              disabled={mutation.isPending || !nom.trim()}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {isEdit ? "Enregistrer" : "Créer l'établissement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
