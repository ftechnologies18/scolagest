"use client";

/**
 * ScolaGest — Dialogue de création d'un exercice comptable (Phase 5).
 *
 * Champs : libellé, date_debut, date_fin, année scolaire (optionnelle).
 * Soumission → `createExercice(dto)` puis invalidation `comptaKeys.exercices`.
 */

import * as React from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { BookOpen, Loader2, CalendarRange } from "lucide-react";

import { useAuthStore } from "@/lib/auth-store";
import { createExercice, comptaKeys } from "@/lib/api-phase5";
import { fetchAnneesScolaires, anneesKeys } from "@/lib/api-students";
import { useToast } from "@/hooks/use-toast";
import type { ExerciceDTO } from "@/lib/types";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";

export interface ExerciceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExerciceFormDialog({
  open,
  onOpenChange,
}: ExerciceFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const etablissement = useAuthStore((s) => s.etablissement);

  const [libelle, setLibelle] = React.useState("");
  const [dateDebut, setDateDebut] = React.useState("");
  const [dateFin, setDateFin] = React.useState("");
  const [anneeId, setAnneeId] = React.useState<string>("__none__");

  // Liste des années scolaires (optionnel)
  const { data: annees } = useQuery({
    queryKey: anneesKeys.list(),
    queryFn: fetchAnneesScolaires,
    enabled: open,
  });

  // Initialise à l'ouverture
  React.useEffect(() => {
    if (!open) return;
    const year = new Date().getFullYear();
    setLibelle(`Exercice ${year}-${year + 1}`);
    setDateDebut(`${year}-09-01`);
    setDateFin(`${year + 1}-08-31`);
    setAnneeId("__none__");
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!dateDebut || !dateFin) {
        throw new Error("Veuillez renseigner les dates de début et de fin.");
      }
      const dto: ExerciceDTO = {
        libelle: libelle.trim(),
        date_debut: new Date(dateDebut).toISOString(),
        date_fin: new Date(dateFin).toISOString(),
        annee_scolaire_id: anneeId !== "__none__" ? anneeId : null,
      };
      return createExercice(dto);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: comptaKeys.exercices(etablissement?.id),
      });
      toast({
        title: "Exercice créé",
        description: `« ${libelle.trim()} » a été ajouté avec succès.`,
      });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de créer l'exercice.",
        variant: "destructive",
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!libelle.trim()) {
      toast({
        title: "Libellé manquant",
        description: "Indiquez un libellé pour cet exercice.",
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
            <BookOpen className="size-5 text-emerald-600" />
            Nouvel exercice comptable
          </DialogTitle>
          <DialogDescription>
            Un exercice correspond à la période sur laquelle les écritures
            seront rattachées (généralement l&apos;année scolaire).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ex-libelle">Libellé</Label>
            <Input
              id="ex-libelle"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
              placeholder="Ex. Exercice 2026-2027"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ex-debut">Date de début</Label>
              <Input
                id="ex-debut"
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                max={dateFin || undefined}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ex-fin">Date de fin</Label>
              <Input
                id="ex-fin"
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                min={dateDebut || undefined}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Année scolaire (optionnel)</Label>
            <Select value={anneeId} onValueChange={setAnneeId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Aucune" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Aucune</SelectItem>
                {(annees ?? []).map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.libelle}
                    {a.est_active ? " (active)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
            <CalendarRange className="mt-0.5 size-3.5 shrink-0" />
            <span>
              La date de fin doit être postérieure à la date de début. L&apos;exercice
              sera créé avec le statut <strong>OUVERT</strong>.
            </span>
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
                mutation.isPending || !libelle.trim() || !dateDebut || !dateFin
              }
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <BookOpen className="size-4" />
              )}
              Créer l&apos;exercice
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
