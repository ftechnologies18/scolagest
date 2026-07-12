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
  RotateCcw,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      <KentePattern variant="strip" position="top" />
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold">Années scolaires</h2>
          <p className="text-sm text-muted-foreground">
            Gestion des exercices scolaires, passage et réinscriptions.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setPromoteOpen(true)}>
            <ArrowRight className="mr-2 size-4" />
            Passage / Réinscription
          </Button>
          <Button variant="success" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            Nouvelle année
          </Button>
        </div>
      </div>

      <KentePattern variant="separator" className="my-4" />

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
          <GlassCard variant="adaptive" noHover className="col-span-full">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CalendarDays className="size-12 text-muted-foreground/40" />
              <p className="mt-4 text-sm text-muted-foreground">
                Aucune année scolaire. Créez votre première année pour commencer.
              </p>
            </div>
          </GlassCard>
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
    <GlassCard variant="adaptive" noHover className={annee.est_active ? "ring-2 ring-emerald-400/60" : ""}>
      <div className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-semibold">{annee.libelle}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDate(annee.date_debut)} → {formatDate(annee.date_fin)}
            </p>
          </div>
          {statutBadge(annee.statut, annee.est_active)}
        </div>
      </div>
      <div className="space-y-3">
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
      </div>
    </GlassCard>
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

// ─── Dialog : Passage / Réinscription avec décisions ────────────────────────

interface PreviewEleve {
  eleve_id: string;
  eleve_nom: string;
  eleve_prenoms: string;
  classe_actuelle: string;
  classe_suivante: string;
  est_diplome: boolean;
  decision: string;
}

interface PromoteResult {
  promus: number;
  diplomes: number;
  redoublants: number;
  non_reinscrits: number;
  skipped: number;
  erreurs: number;
}

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
  const [decisions, setDecisions] = React.useState<Record<string, string>>({});

  // Preview des élèves
  const { data: preview, isLoading: previewLoading } = useQuery<PreviewEleve[]>({
    queryKey: ["promotion-preview", ancienneId],
    queryFn: () => apiPost<PreviewEleve[]>("/api/annees-scolaires/preview", { ancienne_annee_id: ancienneId }),
    enabled: !!ancienneId && open && !result,
    retry: 1,
    retryDelay: 1500,
  });

  const mutation = useMutation({
    mutationFn: () => {
      const decisionsArray = Object.entries(decisions).map(([eleveId, decision]) => ({
        eleve_id: eleveId,
        decision,
      }));
      return apiPost<PromoteResult>("/api/annees-scolaires/promote", {
        ancienne_annee_id: ancienneId,
        nouvelle_annee_id: nouvelleId,
        decisions: decisionsArray,
      });
    },
    onSuccess: (data) => {
      setResult(data as PromoteResult);
      toast({
        title: "Passage effectué",
        description: `${(data as PromoteResult).promus} promus, ${(data as PromoteResult).redoublants} redoublants, ${(data as PromoteResult).diplomes} diplômés`,
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
    setDecisions({});
  };

  const updateDecision = (eleveId: string, decision: string) => {
    setDecisions((prev) => ({ ...prev, [eleveId]: decision }));
  };

  // Stats rapides des décisions
  const stats = React.useMemo(() => {
    if (!preview) return { promus: 0, redoublants: 0, nonReinscrits: 0, diplomes: 0 };
    return preview.reduce(
      (acc, e) => {
        const d = decisions[e.eleve_id] || "PROMU";
        if (e.est_diplome && d === "PROMU") acc.diplomes++;
        else if (d === "PROMU") acc.promus++;
        else if (d === "REDOUBLANT") acc.redoublants++;
        else if (d === "NON_REINSCRIT") acc.nonReinscrits++;
        return acc;
      },
      { promus: 0, redoublants: 0, nonReinscrits: 0, diplomes: 0 },
    );
  }, [preview, decisions]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Passage et réinscription des élèves</DialogTitle>
          <DialogDescription>
            Fait passer les élèves dans la classe supérieure. Marquez les redoublants
            et les non-réinscrits individuellement avant de valider.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          /* ─── Résultat ─── */
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
                <p className="text-3xl font-bold text-emerald-700">{result.promus}</p>
                <p className="text-xs text-emerald-600">promus</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
                <p className="text-3xl font-bold text-amber-700">{result.redoublants}</p>
                <p className="text-xs text-amber-600">redoublants</p>
              </div>
              <div className="rounded-lg border border-sky-200 bg-sky-50 p-4 text-center">
                <p className="text-3xl font-bold text-sky-700">{result.diplomes}</p>
                <p className="text-xs text-sky-600">diplômés</p>
              </div>
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-center">
                <p className="text-3xl font-bold text-rose-700">{result.non_reinscrits}</p>
                <p className="text-xs text-rose-600">non réinscrits</p>
              </div>
            </div>
            {result.erreurs > 0 && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>{result.erreurs} erreur(s) lors du traitement.</p>
              </div>
            )}
          </div>
        ) : !ancienneId || !nouvelleId ? (
          /* ─── Sélection des années ─── */
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Année source (actuelle)</Label>
              <Select value={ancienneId} onValueChange={setAncienneId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner l'année source" /></SelectTrigger>
                <SelectContent>
                  {annees.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.libelle} {a.est_active ? "(active)" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-center"><ArrowRight className="size-5 text-muted-foreground" /></div>
            <div className="space-y-2">
              <Label>Année cible (nouvelle)</Label>
              <Select value={nouvelleId} onValueChange={setNouvelleId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner l'année cible" /></SelectTrigger>
                <SelectContent>
                  {annees.filter((a) => a.id !== ancienneId).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {ancienneId && nouvelleId && (
              <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => {}}>
                Voir les élèves
              </Button>
            )}
          </div>
        ) : previewLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="size-8 animate-spin text-emerald-600" /></div>
        ) : preview && preview.length > 0 ? (
          /* ─── Liste des élèves avec décisions ─── */
          <div className="space-y-4">
            {/* Stats rapides */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="rounded-lg bg-emerald-50 p-2">
                <p className="text-xl font-bold text-emerald-700">{stats.promus}</p>
                <p className="text-[10px] text-emerald-600">promus</p>
              </div>
              <div className="rounded-lg bg-amber-50 p-2">
                <p className="text-xl font-bold text-amber-700">{stats.redoublants}</p>
                <p className="text-[10px] text-amber-600">redoublants</p>
              </div>
              <div className="rounded-lg bg-sky-50 p-2">
                <p className="text-xl font-bold text-sky-700">{stats.diplomes}</p>
                <p className="text-[10px] text-sky-600">diplômés</p>
              </div>
              <div className="rounded-lg bg-rose-50 p-2">
                <p className="text-xl font-bold text-rose-700">{stats.nonReinscrits}</p>
                <p className="text-[10px] text-rose-600">non réinscrits</p>
              </div>
            </div>

            {/* Tableau des élèves */}
            <div className="max-h-[40vh] overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Classe actuelle</TableHead>
                    <TableHead>Classe suivante</TableHead>
                    <TableHead>Décision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((e) => {
                    const decision = decisions[e.eleve_id] || "PROMU";
                    return (
                      <TableRow key={e.eleve_id}>
                        <TableCell>
                          {decision === "REDOUBLANT" ? (
                            <RotateCcw className="size-4 text-amber-600" />
                          ) : decision === "NON_REINSCRIT" ? (
                            <UserX className="size-4 text-rose-600" />
                          ) : e.est_diplome ? (
                            <GraduationCap className="size-4 text-sky-600" />
                          ) : (
                            <ArrowRight className="size-4 text-emerald-600" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium text-sm">
                          {e.eleve_nom} {e.eleve_prenoms}
                        </TableCell>
                        <TableCell className="text-sm">{e.classe_actuelle}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {decision === "REDOUBLANT" ? e.classe_actuelle : e.classe_suivante}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={decision}
                            onValueChange={(v) => updateDecision(e.eleve_id, v)}
                          >
                            <SelectTrigger className="h-8 w-[140px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="PROMU">
                                {e.est_diplome ? "Diplôme" : "Promu"}
                              </SelectItem>
                              <SelectItem value="REDOUBLANT">Redoublant</SelectItem>
                              <SelectItem value="NON_REINSCRIT">Non réinscrit</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <p>
                Vérifiez les décisions puis validez. Les redoublants seront réinscrits
                dans la même classe. Les non-réinscrits ne recevront pas de nouvelle inscription.
              </p>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Aucun élève actif trouvé dans l&apos;année source.
          </div>
        )}

        <DialogFooter>
          {result ? (
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleClose}>
              Terminé
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose}>Annuler</Button>
              {ancienneId && nouvelleId && preview && preview.length > 0 && (
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate()}
                >
                  {mutation.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ArrowRight className="mr-2 size-4" />}
                  Valider le passage ({preview.length} élèves)
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
