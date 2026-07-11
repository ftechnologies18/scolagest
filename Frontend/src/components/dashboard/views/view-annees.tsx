"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Plus,
  CheckCircle2,
  Archive,
  ArrowRight,
  Users,
  GraduationCap,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiGet, apiPost } from "@/lib/api-client";
import { formatFCFA } from "@/lib/format";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AnneeScolaire {
  id: string;
  libelle: string;
  date_debut: string;
  date_fin: string;
  statut: string;
  est_active: boolean;
  created_at: string;
}

interface AnneeStats {
  nb_eleves: number;
  nb_inscriptions: number;
  nb_classes: number;
  nb_frais: number;
}

interface PromoteResult {
  promus: number;
  diplomes: number;
  skipped: number;
  erreurs: number;
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function AnneesView() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [promoteOpen, setPromoteOpen] = React.useState(false);

  const { data: annees, isLoading } = useQuery<AnneeScolaire[]>({
    queryKey: ["annees-scolaires"],
    queryFn: () => apiGet("/api/annees-scolaires"),
    retry: 1,
    retryDelay: 1500,
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/api/annees-scolaires/${id}/activate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["annees-scolaires"] });
      toast({ title: "Année activée", description: "L'année scolaire est maintenant active." });
    },
    onError: (e: unknown) => {
      toast({ title: "Erreur", description: String(e), variant: "destructive" });
    },
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/api/annees-scolaires/${id}/close`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["annees-scolaires"] });
      toast({ title: "Année clôturée", description: "L'année scolaire a été archivée." });
    },
    onError: (e: unknown) => {
      toast({ title: "Erreur", description: String(e), variant: "destructive" });
    },
  });

  const statutBadge = (statut: string, estActive: boolean) => {
    if (estActive) return <Badge className="bg-emerald-600 text-white">Active</Badge>;
    switch (statut) {
      case "PREPARATION":
        return <Badge variant="outline" className="border-amber-300 text-amber-700">Préparation</Badge>;
      case "EN_COURS":
        return <Badge variant="outline" className="border-emerald-300 text-emerald-700">En cours</Badge>;
      case "CLOTUREE":
        return <Badge variant="outline" className="border-muted text-muted-foreground">Clôturée</Badge>;
      default:
        return <Badge variant="outline">{statut}</Badge>;
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("fr-FR");
    } catch {
      return d;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">Années scolaires</h2>
          <p className="text-sm text-muted-foreground">
            Gestion des exercices scolaires, passage et réinscriptions.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPromoteOpen(true)}>
            <ArrowRight className="mr-2 size-4" />
            Passage / Réinscription
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            Nouvelle année
          </Button>
        </div>
      </div>

      {/* Liste des années */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {annees?.map((annee) => (
          <AnneeCard
            key={annee.id}
            annee={annee}
            statutBadge={statutBadge}
            formatDate={formatDate}
            onActivate={(id) => activateMutation.mutate(id)}
            onClose={(id) => closeMutation.mutate(id)}
          />
        ))}
        {(!annees || annees.length === 0) && (
          <Card className="col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarDays className="size-12 text-muted-foreground/40" />
              <p className="mt-4 text-sm text-muted-foreground">
                Aucune année scolaire. Créez votre première année pour commencer.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Dialogs */}
      <CreateAnneeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        annees={annees || []}
      />
      <PromoteDialog
        open={promoteOpen}
        onOpenChange={setPromoteOpen}
        annees={annees || []}
      />
    </div>
  );
}

// ─── Carte d'une année scolaire ──────────────────────────────────────────────

function AnneeCard({
  annee,
  statutBadge,
  formatDate,
  onActivate,
  onClose,
}: {
  annee: AnneeScolaire;
  statutBadge: (s: string, a: boolean) => React.ReactNode;
  formatDate: (d: string) => string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const { data: stats } = useQuery<AnneeStats>({
    queryKey: ["annee-stats", annee.id],
    queryFn: () => apiGet(`/api/annees-scolaires/${annee.id}/stats`),
    enabled: !!annee.id,
    retry: 1,
    retryDelay: 1500,
  });

  return (
    <Card className={annee.est_active ? "border-emerald-400 shadow-md" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{annee.libelle}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDate(annee.date_debut)} → {formatDate(annee.date_fin)}
            </p>
          </div>
          {statutBadge(annee.statut, annee.est_active)}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-muted/40 p-2">
            <Users className="mx-auto size-4 text-muted-foreground" />
            <p className="mt-1 text-lg font-bold">{stats?.nb_eleves ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground">élèves</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <CalendarDays className="mx-auto size-4 text-muted-foreground" />
            <p className="mt-1 text-lg font-bold">{stats?.nb_inscriptions ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground">inscrits</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-2">
            <GraduationCap className="mx-auto size-4 text-muted-foreground" />
            <p className="mt-1 text-lg font-bold">{stats?.nb_frais ?? "—"}</p>
            <p className="text-[10px] text-muted-foreground">frais</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {!annee.est_active && annee.statut !== "CLOTUREE" && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              onClick={() => onActivate(annee.id)}
            >
              <CheckCircle2 className="mr-1 size-3.5" />
              Activer
            </Button>
          )}
          {annee.statut !== "CLOTUREE" && !annee.est_active && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => onClose(annee.id)}
            >
              <Archive className="mr-1 size-3.5" />
              Clôturer
            </Button>
          )}
          {annee.est_active && (
            <Badge className="w-full justify-center bg-emerald-600 py-1.5 text-white">
              <CheckCircle2 className="mr-1 size-3.5" />
              Année en cours
            </Badge>
          )}
          {annee.statut === "CLOTUREE" && (
            <Badge variant="outline" className="w-full justify-center py-1.5 text-muted-foreground">
              <Archive className="mr-1 size-3.5" />
              Archivée
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Dialog : Créer une année ────────────────────────────────────────────────

function CreateAnneeDialog({
  open,
  onOpenChange,
  annees,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  annees: AnneeScolaire[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [libelle, setLibelle] = React.useState("");
  const [dateDebut, setDateDebut] = React.useState("");
  const [dateFin, setDateFin] = React.useState("");
  const [copierFrais, setCopierFrais] = React.useState(false);
  const [sourceAnnee, setSourceAnnee] = React.useState("");

  const mutation = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {
        libelle,
        date_debut: new Date(dateDebut).toISOString(),
        date_fin: new Date(dateFin).toISOString(),
      };
      if (copierFrais && sourceAnnee) {
        body.copier_frais_de = sourceAnnee;
      }
      return apiPost("/api/annees-scolaires", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["annees-scolaires"] });
      toast({ title: "Année créée", description: copierFrais ? "Frais copiés depuis l'année source." : "Année créée sans frais." });
      onOpenChange(false);
      setLibelle("");
      setDateDebut("");
      setDateFin("");
      setCopierFrais(false);
      setSourceAnnee("");
    },
    onError: (e: unknown) => {
      toast({ title: "Erreur", description: String(e), variant: "destructive" });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nouvelle année scolaire</DialogTitle>
          <DialogDescription>
            Créez un exercice scolaire. Vous pouvez reprendre les frais d&apos;une année précédente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="libelle">Libellé</Label>
            <Input
              id="libelle"
              placeholder="ex: 2027-2028"
              value={libelle}
              onChange={(e) => setLibelle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date-debut">Date de début</Label>
              <Input
                id="date-debut"
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date-fin">Date de fin</Label>
              <Input
                id="date-fin"
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
              />
            </div>
          </div>

          {/* Reprise des frais */}
          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="copier-frais" className="cursor-pointer">
                  Reprendre les frais d&apos;une année
                </Label>
                <p className="text-xs text-muted-foreground">
                  Copie les frais et échéanciers de l&apos;année sélectionnée.
                </p>
              </div>
              <Switch
                id="copier-frais"
                checked={copierFrais}
                onCheckedChange={setCopierFrais}
              />
            </div>
            {copierFrais && (
              <Select value={sourceAnnee} onValueChange={setSourceAnnee}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner l'année source" />
                </SelectTrigger>
                <SelectContent>
                  {annees.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            disabled={!libelle || !dateDebut || !dateFin || (copierFrais && !sourceAnnee)}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
            Créer l&apos;année
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog : Passage / Réinscription ────────────────────────────────────────

function PromoteDialog({
  open,
  onOpenChange,
  annees,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  annees: AnneeScolaire[];
}) {
  const { toast } = useToast();
  const [ancienneId, setAncienneId] = React.useState("");
  const [nouvelleId, setNouvelleId] = React.useState("");
  const [result, setResult] = React.useState<PromoteResult | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      apiPost<PromoteResult>("/api/annees-scolaires/promote", {
        ancienne_annee_id: ancienneId,
        nouvelle_annee_id: nouvelleId,
      }),
    onSuccess: (data) => {
      setResult(data as PromoteResult);
      toast({
        title: "Passage effectué",
        description: `${(data as PromoteResult).promus} promus, ${(data as PromoteResult).diplomes} diplômés`,
      });
    },
    onError: (e: unknown) => {
      toast({ title: "Erreur", description: String(e), variant: "destructive" });
    },
  });

  const handleClose = () => {
    onOpenChange(false);
    setResult(null);
    setAncienneId("");
    setNouvelleId("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Passage et réinscription des élèves</DialogTitle>
          <DialogDescription>
            Fait passer tous les élèves dans la classe supérieure pour la nouvelle année.
            Les élèves en classe d&apos;examen (3e, Terminale, CM2) sont marqués comme diplômés.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          /* Résultat du passage */
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
                <p className="text-3xl font-bold text-emerald-700">{result.promus}</p>
                <p className="text-sm text-emerald-600">élèves promus</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
                <p className="text-3xl font-bold text-amber-700">{result.diplomes}</p>
                <p className="text-sm text-amber-600">diplômés</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-lg font-semibold">{result.skipped}</p>
                <p className="text-xs text-muted-foreground">ignorés (déjà inscrits)</p>
              </div>
              <div className="rounded-lg border p-3 text-center">
                <p className="text-lg font-semibold">{result.erreurs}</p>
                <p className="text-xs text-muted-foreground">erreurs</p>
              </div>
            </div>
            {result.erreurs > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>
                  {result.erreurs} élève(s) n&apos;ont pas pu être promus. Vérifiez que toutes les classes supérieures existent.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Formulaire de passage */
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Année source (actuelle)</Label>
              <Select value={ancienneId} onValueChange={setAncienneId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner l'année source" />
                </SelectTrigger>
                <SelectContent>
                  {annees.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.libelle} {a.est_active ? "(active)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-center">
              <ArrowRight className="size-5 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <Label>Année cible (nouvelle)</Label>
              <Select value={nouvelleId} onValueChange={setNouvelleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner l'année cible" />
                </SelectTrigger>
                <SelectContent>
                  {annees
                    .filter((a) => a.id !== ancienneId)
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.libelle}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <p>
                Tous les élèves actifs seront promus dans la classe supérieure. Les frais de la nouvelle année
                doivent déjà être configurés.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleClose}>
              Terminé
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>
                Annuler
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                disabled={!ancienneId || !nouvelleId || ancienneId === nouvelleId}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}
                Lancer le passage
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
