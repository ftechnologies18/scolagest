"use client";

/**
 * ScolaGest — Page "Mes avances sur salaire" (portail enseignant).
 *
 * L'enseignant peut :
 *  - Voir l'historique de ses demandes d'avance + leur statut
 *  - Faire une nouvelle demande d'avance (montant + motif)
 *
 * La direction/superviseur approuve ou rejète ensuite la demande depuis
 * la page staff /paie (onglet "Avances sur salaire").
 */

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Wallet,
  CheckCircle2,
  XCircle,
  Clock,
  Receipt,
} from "lucide-react";

import {
  fetchMesAvances,
  createMesAvance,
  STATUT_AVANCE_LABEL,
  type AvanceSalaire,
  type StatutAvance,
} from "@/lib/api-paie";
import { ApiError } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const STATUT_CLS: Record<StatutAvance, string> = {
  DEMANDEE: "border-amber-300 bg-amber-100 text-amber-800",
  APPROUVEE: "border-emerald-300 bg-emerald-100 text-emerald-800",
  REJETEE: "border-rose-300 bg-rose-100 text-rose-800",
  DEDUITE: "border-slate-300 bg-slate-100 text-slate-600",
};

const STATUT_ICON: Record<StatutAvance, React.ElementType> = {
  DEMANDEE: Clock,
  APPROUVEE: CheckCircle2,
  REJETEE: XCircle,
  DEDUITE: Receipt,
};

function formatFCFA(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(n) + " FCFA";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MesAvancesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [montant, setMontant] = React.useState("");
  const [motif, setMotif] = React.useState("");

  const { data: avances, isLoading } = useQuery({
    queryKey: ["prof", "avances"],
    queryFn: fetchMesAvances,
  });

  const mutation = useMutation({
    mutationFn: () =>
      createMesAvance({
        montant: Number(montant),
        motif: motif.trim() || undefined,
      }),
    onSuccess: () => {
      toast({
        title: "Demande envoyée",
        description: "Votre demande d'avance a été enregistrée. Elle sera examinée par la direction.",
      });
      queryClient.invalidateQueries({ queryKey: ["prof", "avances"] });
      setDialogOpen(false);
      setMontant("");
      setMotif("");
    },
    onError: (err) => {
      toast({
        title: "Échec",
        description:
          err instanceof ApiError ? err.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const m = Number(montant);
    if (!m || m <= 0) {
      toast({
        title: "Montant invalide",
        description: "Veuillez saisir un montant positif.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/prof")}>
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Mes avances sur salaire</h1>
            <p className="text-sm text-muted-foreground">
              Demandez une avance et suivez son statut.
            </p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="size-4" />
          <span className="hidden sm:inline">Nouvelle demande</span>
        </Button>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="size-8 animate-spin text-emerald-600" />
        </div>
      ) : !avances || avances.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Wallet className="size-12 text-muted-foreground/40" />
            <p className="text-sm font-medium">Aucune demande d&apos;avance</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              Vous n&apos;avez pas encore fait de demande d&apos;avance sur salaire.
              Cliquez sur « Nouvelle demande » pour en créer une.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {avances.map((av, i) => {
            const Icon = STATUT_ICON[av.statut] ?? Clock;
            return (
              <motion.div
                key={av.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-full",
                        av.statut === "APPROUVEE"
                          ? "bg-emerald-100 text-emerald-600"
                          : av.statut === "REJETEE"
                            ? "bg-rose-100 text-rose-600"
                            : av.statut === "DEDUITE"
                              ? "bg-slate-100 text-slate-500"
                              : "bg-amber-100 text-amber-600",
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold">{formatFCFA(av.montant)}</span>
                        <Badge className={cn("text-xs", STATUT_CLS[av.statut])}>
                          {STATUT_AVANCE_LABEL[av.statut]}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Demandée le {formatDate(av.date_demande)}
                        {av.motif ? ` · ${av.motif}` : ""}
                      </p>
                      {av.statut === "REJETEE" && av.motif_rejet && (
                        <p className="mt-1 text-xs text-rose-600">
                          Motif du rejet : {av.motif_rejet}
                        </p>
                      )}
                      {av.statut === "DEDUITE" && av.date_versement && (
                        <p className="mt-1 text-xs text-slate-500">
                          Versée le {formatDate(av.date_versement)} — déduite de votre bulletin
                        </p>
                      )}
                      {av.statut === "APPROUVEE" && av.date_versement && (
                        <p className="mt-1 text-xs text-emerald-600">
                          Versée le {formatDate(av.date_versement)} — sera déduite de votre prochain bulletin
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Dialog nouvelle demande */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demande d&apos;avance sur salaire</DialogTitle>
            <DialogDescription>
              Votre demande sera examinée par la direction. Vous serez notifié
              dès qu&apos;elle sera traitée.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="montant" className="text-sm font-medium">
                Montant souhaité (FCFA)
              </Label>
              <Input
                id="montant"
                type="number"
                min="1"
                step="500"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="ex: 50000"
                required
                disabled={mutation.isPending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="motif" className="text-sm font-medium">
                Motif (optionnel)
              </Label>
              <Textarea
                id="motif"
                value={motif}
                onChange={(e) => setMotif(e.target.value)}
                placeholder="ex: Urgence médicale, réparation véhicule…"
                rows={2}
                disabled={mutation.isPending}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                type="submit"
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={mutation.isPending || !montant}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Envoi…
                  </>
                ) : (
                  "Envoyer la demande"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
