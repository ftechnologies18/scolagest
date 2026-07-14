"use client";

/**
 * ScolaGest — Dialogue de création d'un exercice comptable (Phase 5).
 *
 * Champs : libellé, date_debut, date_fin, année scolaire (optionnelle).
 * Soumission → `createExercice(dto)` puis invalidation `comptaKeys.exercices`.
 *
 * Refonte « Forêt EdTech » (Task 4) :
 *  - Header premium : badge rond gradient emerald→gold (CalendarRange size-5) +
 *    titre `font-display` text-lg text-forest + description contextuelle.
 *  - 3 sous-sections GlassCard tablet avec SectionTitle (badge rond emerald/15
 *    + icône contextuelle) :
 *      1. Libellé (BookOpen)
 *      2. Période (CalendarRange) — Date de début + Date de fin
 *      3. Année scolaire (School) — Select (optionnel)
 *  - Inputs avec `bg-background` + focus ring emerald, Select avec icône
 *    contextuelle dans le SelectTrigger.
 *  - Alerte amber renforcée (border-300 bg-100 text-800) avec icône
 *    CalendarRange et `mt-0.5` (flex items-start).
 *  - Footer : grid-cols-2 sur mobile (boutons full-width) + sm:flex
 *    sm:justify-end sur desktop ; bouton Annuler variant outline + bouton
 *    submit variant success (icône Loader2 si pending, BookOpen sinon,
 *    "Créer l'exercice").
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query (anneesKeys.list /
 * fetchAnneesScolaires, enabled: open), état local (libelle / dateDebut /
 * dateFin / anneeId), mutation createExercice avec onSuccess/onError,
 * useEffect init [open], validation libelle.trim() + dateDebut + dateFin,
 * endpoints API inchangés.
 */

import * as React from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Loader2,
  CalendarRange,
  School,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

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
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";

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
      <DialogContent className="max-h-[90vh] overflow-y-auto overflow-hidden p-0 sm:max-w-md">
        <KentePattern variant="strip" position="top" />
        <div className="p-6 pt-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            {/* Badge rond gradient emerald→gold avec icône CalendarRange */}
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <CalendarRange className="size-5" />
            </div>
            <span className="font-display text-lg font-semibold text-forest">
              Nouvel exercice comptable
            </span>
          </DialogTitle>
          <DialogDescription>
            Un exercice correspond à la période sur laquelle les écritures
            seront rattachées (généralement l&apos;année scolaire).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ─── Section 1 : Libellé ──────────────────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="space-y-3 p-4">
            <SectionTitle icon={BookOpen}>Libellé</SectionTitle>
            <div className="space-y-1.5">
              <Label htmlFor="ex-libelle">Libellé</Label>
              <Input
                id="ex-libelle"
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                placeholder="Ex. Exercice 2026-2027"
                required
                className="bg-background focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
              />
            </div>
          </GlassCard>

          {/* ─── Section 2 : Période ──────────────────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="space-y-3 p-4">
            <SectionTitle icon={CalendarRange}>Période</SectionTitle>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ex-debut">Date de début</Label>
                <Input
                  id="ex-debut"
                  type="date"
                  value={dateDebut}
                  onChange={(e) => setDateDebut(e.target.value)}
                  max={dateFin || undefined}
                  required
                  className="bg-background focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
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
                  className="bg-background focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                />
              </div>
            </div>
          </GlassCard>

          {/* ─── Section 3 : Année scolaire (optionnel) ───────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="space-y-3 p-4">
            <SectionTitle icon={School}>Année scolaire</SectionTitle>
            <div className="space-y-1.5">
              <Label>Année scolaire (optionnel)</Label>
              <Select value={anneeId} onValueChange={setAnneeId}>
                <SelectTrigger className="h-10 w-full bg-background">
                  <School className="mr-1.5 size-4 shrink-0 text-emerald-600" />
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
          </GlassCard>

          {/* ─── Alerte amber renforcée ───────────────────────────────── */}
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-100/80 p-2.5 text-xs text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
            <CalendarRange className="mt-0.5 size-3.5 shrink-0" />
            <span>
              La date de fin doit être postérieure à la date de début. L&apos;exercice
              sera créé avec le statut <strong>OUVERT</strong>.
            </span>
          </div>

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
                mutation.isPending || !libelle.trim() || !dateDebut || !dateFin
              }
              className="h-10 w-full sm:w-auto"
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Créer l&apos;exercice
            </Button>
          </DialogFooter>
        </form>
        </div>
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
