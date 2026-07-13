"use client";

/**
 * ScolaGest — Vue « Années scolaires » (Phase 2 — Refonte Forêt EdTech).
 *
 * Affiche la liste des années scolaires sous forme de cards premium
 * (libellé, dates, statut, stats élèves/inscriptions/frais) avec actions
 * « Activer », « Clôturer », badge « Année en cours ».
 *
 * Deux dialogs :
 *  - CreateAnneeDialog : libellé, dates début/fin, option « copier frais
 *    d'une année source » (POST /api/annees-scolaires avec copier_frais_de).
 *  - PromoteDialog : passage / réinscription — sélection année source →
 *    année cible, preview des élèves avec décisions PROMU / REDOUBLANT /
 *    NON_REINSCRIT / DIPLOME, validation massive.
 *
 * Refonte Forêt EdTech :
 *  - Hero header GlassCard desktop + badge rond gradient emerald→gold
 *    (CalendarDays) + pill « Phase 2 » outline + pill « Année active »
 *    emerald + boutons « Passage / Réinscription » (outline) et
 *    « Nouvelle année » (success).
 *  - 4 StatCards de résumé : Total années (emerald), Année active (gold),
 *    En préparation (amber), Clôturées (forest).
 *  - AnneeCard : GlassCard adaptive (hover lift) + premiumBorder pour
 *    l'année active ; libellé font-display + statut badge à droite ; dates
 *    avec badge emerald/15 ; 3 mini-cards stats avec icônes colorées
 *    (Users emerald, CalendarDays amber, GraduationCap gold) ; actions
 *    Activer/Clôturer avec `title` natif (icônes seules mobile, icône+texte
 *    desktop) ; badge « Année en cours » en gradient emerald→gold ; badge
 *    « Archivée » en terracotta/10.
 *  - CreateAnneeDialog premium : header badge rond gradient + 3 sous-sections
 *    GlassCard tablet (Libellé, Dates, Reprise des frais avec Switch) +
 *    footer grid-cols-2 mobile + bouton submit variant success.
 *  - PromoteDialog premium : header badge rond gradient + 2 selects avec
 *    flèche de transition + 4 StatCards horizontales (PROMU emerald,
 *    REDOUBLANT amber, DIPLOME sky, NON_REINSCRIT rose) + tableau avec
 *    header bg-emerald-50/60 + bandeau d'info + étape résultat avec 4
 *    StatCards.
 *  - Empty state premium : KentePattern bg + badge rond emerald + bouton
 *    « Créer une année » (variant success).
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query (annees-scolaires, annee-stats,
 * promotion-preview), mutations activate / close / create / promote, types
 * AnneeScolaire / AnneeStats / PreviewEleve / PromoteResult, helpers
 * statutBadge / formatDate. Aucun endpoint backend modifié.
 */

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Calendar,
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
  Sparkles,
  Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { StatCard } from "@/components/ds/stat-card";
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
import { cn } from "@/lib/utils";

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
    if (estActive)
      return (
        <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200">
          Active
        </Badge>
      );
    switch (statut) {
      case "PREPARATION":
        return (
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200"
          >
            Préparation
          </Badge>
        );
      case "EN_COURS":
        return (
          <Badge
            variant="outline"
            className="border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
          >
            En cours
          </Badge>
        );
      case "CLOTUREE":
        return (
          <Badge
            variant="outline"
            className="border-terracotta/40 bg-terracotta/10 text-terracotta"
          >
            Clôturée
          </Badge>
        );
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

  // ─── Résumés pour les 4 StatCards ─────────────────────────────────────────
  const totalAnnees = annees?.length ?? 0;
  const anneeActive = annees?.find((a) => a.est_active);
  const enPreparation =
    annees?.filter((a) => !a.est_active && a.statut === "PREPARATION").length ?? 0;
  const cloturees =
    annees?.filter((a) => a.statut === "CLOTUREE").length ?? 0;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <KentePattern variant="strip" position="top" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-emerald-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <KentePattern variant="strip" position="top" />

      {/* ─── Hero header premium ─────────────────────────────────────────── */}
      <GlassCard variant="desktop" noHover className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Badge rond gradient emerald→gold avec icône CalendarDays */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <CalendarDays className="size-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                  Années scolaires
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50/60 px-2 py-0.5 align-middle text-[11px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <Sparkles className="size-3" />
                  Phase 2
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Gestion des exercices scolaires, passage et réinscriptions.
              </p>
              {anneeActive ? (
                <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 className="size-3" />
                  Année en cours : {anneeActive.libelle}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={() => setPromoteOpen(true)}
              className="w-full sm:w-auto"
            >
              <ArrowRight className="size-4" />
              Passage / Réinscription
            </Button>
            <Button
              variant="success"
              onClick={() => setCreateOpen(true)}
              className="w-full sm:w-auto"
            >
              <Plus className="size-4" />
              Nouvelle année
            </Button>
          </div>
        </div>
      </GlassCard>

      <KentePattern variant="separator" className="my-1" />

      {/* ─── 4 StatCards de résumé ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={CalendarDays}
          tone="emerald"
          label="Total années"
          value={totalAnnees}
          hint={isLoading ? "chargement…" : "exercices configurés"}
          delay={0}
        />
        <StatCard
          icon={CheckCircle2}
          tone="gold"
          label="Année active"
          value={anneeActive ? anneeActive.libelle : "—"}
          hint={anneeActive ? "en cours" : "aucune active"}
          delay={0.05}
        />
        <StatCard
          icon={AlertCircle}
          tone="amber"
          label="En préparation"
          value={enPreparation}
          hint="à activer"
          delay={0.1}
        />
        <StatCard
          icon={Archive}
          tone="forest"
          label="Clôturées"
          value={cloturees}
          hint="archivées"
          delay={0.15}
        />
      </div>

      <KentePattern variant="separator" className="my-1" />

      {/* ─── Liste des années ────────────────────────────────────────────── */}
      {(!annees || annees.length === 0) ? (
        <EmptyState
          icon={CalendarDays}
          title="Aucune année scolaire"
          description="Créez votre première année scolaire pour commencer à configurer les frais, inscrire les élèves et suivre les encaissements."
          action={
            <Button variant="success" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Créer une année
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {annees.map((annee, idx) => (
            <AnneeCard
              key={annee.id}
              annee={annee}
              index={idx}
              statutBadge={statutBadge}
              formatDate={formatDate}
              onActivate={(id) => activateMutation.mutate(id)}
              onClose={(id) => closeMutation.mutate(id)}
            />
          ))}
        </div>
      )}

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
  index = 0,
  statutBadge,
  formatDate,
  onActivate,
  onClose,
}: {
  annee: AnneeScolaire;
  index?: number;
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
    <GlassCard
      variant="adaptive"
      delay={Math.min(index * 0.05, 0.3)}
      premiumBorder={annee.est_active}
      className="flex h-full flex-col"
    >
      {/* ─── En-tête : libellé + statut ──────────────────────────────────── */}
      <div className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <h3 className="break-words font-display text-lg font-semibold leading-snug text-forest">
              {annee.libelle}
            </h3>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="flex size-4 items-center justify-center rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                <CalendarDays className="size-3" />
              </span>
              <span className="tabular-nums">
                {formatDate(annee.date_debut)} → {formatDate(annee.date_fin)}
              </span>
            </div>
          </div>
          {statutBadge(annee.statut, annee.est_active)}
        </div>
      </div>

      {/* ─── Bloc stats (s'étire pour égaliser les hauteurs en grid) ─────── */}
      <div className="flex-1 space-y-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-emerald-200/60 bg-emerald-50/60 p-2 dark:border-emerald-800/40 dark:bg-emerald-950/20">
            <span className="mx-auto flex size-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
              <Users className="size-3.5" />
            </span>
            <p className="mt-1 text-lg font-bold text-emerald-800 dark:text-emerald-200">
              {stats?.nb_eleves ?? "—"}
            </p>
            <p className="text-[10px] font-medium text-emerald-700/80 dark:text-emerald-300/70">
              élèves
            </p>
          </div>
          <div className="rounded-lg border border-amber-200/60 bg-amber-50/60 p-2 dark:border-amber-800/40 dark:bg-amber-950/20">
            <span className="mx-auto flex size-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
              <CalendarDays className="size-3.5" />
            </span>
            <p className="mt-1 text-lg font-bold text-amber-800 dark:text-amber-200">
              {stats?.nb_inscriptions ?? "—"}
            </p>
            <p className="text-[10px] font-medium text-amber-700/80 dark:text-amber-300/70">
              inscrits
            </p>
          </div>
          <div className="rounded-lg border border-gold/30 bg-gold/10 p-2 dark:bg-gold/5">
            <span className="mx-auto flex size-6 items-center justify-center rounded-md bg-gold/20 text-gold-dark dark:text-gold">
              <GraduationCap className="size-3.5" />
            </span>
            <p className="mt-1 text-lg font-bold text-gold-dark dark:text-gold">
              {stats?.nb_frais ?? "—"}
            </p>
            <p className="text-[10px] font-medium text-gold-dark/80 dark:text-gold/70">
              frais
            </p>
          </div>
        </div>

        {/* ─── Actions / Badge état ──────────────────────────────────────── */}
        <div className="flex gap-2">
          {!annee.est_active && annee.statut !== "CLOTUREE" && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200"
              onClick={() => onActivate(annee.id)}
              title="Activer cette année scolaire"
              aria-label={`Activer l'année ${annee.libelle}`}
            >
              <CheckCircle2 className="size-3.5" />
              <span className="lg:inline">Activer</span>
            </Button>
          )}
          {annee.statut !== "CLOTUREE" && !annee.est_active && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 border-terracotta/40 bg-terracotta/5 text-terracotta hover:bg-terracotta/10"
              onClick={() => onClose(annee.id)}
              title="Clôturer et archiver cette année"
              aria-label={`Clôturer l'année ${annee.libelle}`}
            >
              <Archive className="size-3.5" />
              <span className="lg:inline">Clôturer</span>
            </Button>
          )}
          {annee.est_active && (
            <div className="flex w-full items-center justify-center gap-1.5 rounded-md bg-gradient-to-r from-emerald-600 to-amber-500 py-1.5 text-xs font-semibold text-white shadow-sm">
              <CheckCircle2 className="size-3.5" />
              Année en cours
            </div>
          )}
          {annee.statut === "CLOTUREE" && (
            <div className="flex w-full items-center justify-center gap-1.5 rounded-md border border-terracotta/40 bg-terracotta/10 py-1.5 text-xs font-semibold text-terracotta">
              <Archive className="size-3.5" />
              Archivée
            </div>
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

  const canSubmit =
    !!libelle && !!dateDebut && !!dateFin && (!copierFrais || !!sourceAnnee);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <CalendarDays className="size-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="font-display text-lg font-semibold text-forest">
                Nouvelle année scolaire
              </DialogTitle>
              <DialogDescription>
                Créez un exercice scolaire. Vous pouvez reprendre les frais
                d&apos;une année précédente.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* ─── Section 1 : Libellé ─────────────────────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="p-4">
            <div className="space-y-2">
              <Label htmlFor="libelle" className="text-sm font-semibold text-forest">
                Libellé
              </Label>
              <Input
                id="libelle"
                placeholder="ex: 2027-2028"
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                className="bg-background focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
              />
              <p className="text-xs text-muted-foreground">
                Format recommandé : 2027-2028
              </p>
            </div>
          </GlassCard>

          {/* ─── Section 2 : Dates ──────────────────────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date-debut" className="text-sm font-semibold text-forest">
                  Date de début
                </Label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-emerald-600" />
                  <Input
                    id="date-debut"
                    type="date"
                    value={dateDebut}
                    onChange={(e) => setDateDebut(e.target.value)}
                    className="bg-background pl-8 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-fin" className="text-sm font-semibold text-forest">
                  Date de fin
                </Label>
                <div className="relative">
                  <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-emerald-600" />
                  <Input
                    id="date-fin"
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    className="bg-background pl-8 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                  />
                </div>
              </div>
            </div>
          </GlassCard>

          {/* ─── Section 3 : Reprise des frais ──────────────────────────── */}
          <GlassCard variant="tablet" noHover noAnimation className="p-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-gold/15 text-gold-dark dark:text-gold">
                    <Coins className="size-4" />
                  </span>
                  <div className="space-y-1">
                    <Label htmlFor="copier-frais" className="cursor-pointer text-sm font-semibold text-forest">
                      Reprendre les frais d&apos;une année
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Copie les frais et échéanciers de l&apos;année sélectionnée.
                    </p>
                  </div>
                </div>
                <Switch
                  id="copier-frais"
                  checked={copierFrais}
                  onCheckedChange={setCopierFrais}
                />
              </div>
              {copierFrais && (
                <div className="space-y-2">
                  <Label htmlFor="source-annee" className="text-xs font-medium text-muted-foreground">
                    Année source
                  </Label>
                  <Select value={sourceAnnee} onValueChange={setSourceAnnee}>
                    <SelectTrigger
                      id="source-annee"
                      className="bg-background focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                    >
                      <SelectValue placeholder="Sélectionner l'année source" />
                    </SelectTrigger>
                    <SelectContent>
                      {annees.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.libelle}
                          {a.est_active ? " (active)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </GlassCard>
        </div>

        <DialogFooter>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button
              variant="success"
              className="w-full sm:w-auto"
              disabled={!canSubmit || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <CheckCircle2 className="size-4" />
              )}
              Créer l&apos;année
            </Button>
          </div>
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
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <ArrowRight className="size-5" />
            </div>
            <div className="space-y-1">
              <DialogTitle className="font-display text-lg font-semibold text-forest">
                Passage et réinscription des élèves
              </DialogTitle>
              <DialogDescription>
                Fait passer les élèves dans la classe supérieure. Marquez les
                redoublants et les non-réinscrits individuellement avant de
                valider.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {result ? (
          /* ─── Étape 3 : Résultat ─── */
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                icon={ArrowRight}
                tone="emerald"
                label="Promus"
                value={result.promus}
                delay={0}
              />
              <StatCard
                icon={RotateCcw}
                tone="amber"
                label="Redoublants"
                value={result.redoublants}
                delay={0.05}
              />
              <StatCard
                icon={GraduationCap}
                tone="sky"
                label="Diplômés"
                value={result.diplomes}
                delay={0.1}
              />
              <StatCard
                icon={UserX}
                tone="terracotta"
                label="Non réinscrits"
                value={result.non_reinscrits}
                delay={0.15}
              />
            </div>
            {result.erreurs > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                <p>
                  {result.erreurs} erreur(s) lors du traitement. Vérifiez les
                  logs serveur pour plus de détails.
                </p>
              </div>
            )}
            {result.skipped > 0 && (
              <p className="text-xs text-muted-foreground">
                {result.skipped} élève(s) ignoré(s) (déjà réinscrits ou sans
                classe suivante).
              </p>
            )}
          </div>
        ) : !ancienneId || !nouvelleId ? (
          /* ─── Étape 1 : Sélection des années ─── */
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="ancienne-id" className="text-sm font-semibold text-forest">
                Année source (actuelle)
              </Label>
              <Select value={ancienneId} onValueChange={setAncienneId}>
                <SelectTrigger
                  id="ancienne-id"
                  className="bg-background focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                >
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

            {/* Flèche de transition */}
            <div className="flex justify-center py-1">
              <span className="flex size-8 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                <ArrowRight className="size-4" />
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nouvelle-id" className="text-sm font-semibold text-forest">
                Année cible (nouvelle)
              </Label>
              <Select value={nouvelleId} onValueChange={setNouvelleId}>
                <SelectTrigger
                  id="nouvelle-id"
                  className="bg-background focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                >
                  <SelectValue placeholder="Sélectionner l'année cible" />
                </SelectTrigger>
                <SelectContent>
                  {annees.filter((a) => a.id !== ancienneId).map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.libelle}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {ancienneId && nouvelleId && (
              <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                <p>
                  Les élèves de l&apos;année source seront chargés automatiquement
                  pour que vous puissiez définir leurs décisions.
                </p>
              </div>
            )}
          </div>
        ) : previewLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-8 animate-spin text-emerald-600" />
          </div>
        ) : preview && preview.length > 0 ? (
          /* ─── Étape 2 : Liste des élèves avec décisions ─── */
          <div className="space-y-3">
            {/* Stats rapides en 4 StatCards horizontales */}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <StatCard
                icon={ArrowRight}
                tone="emerald"
                label="Promus"
                value={stats.promus}
                delay={0}
              />
              <StatCard
                icon={RotateCcw}
                tone="amber"
                label="Redoublants"
                value={stats.redoublants}
                delay={0.05}
              />
              <StatCard
                icon={GraduationCap}
                tone="sky"
                label="Diplômés"
                value={stats.diplomes}
                delay={0.1}
              />
              <StatCard
                icon={UserX}
                tone="terracotta"
                label="Non réinscrits"
                value={stats.nonReinscrits}
                delay={0.15}
              />
            </div>

            {/* Tableau des élèves */}
            <div className="max-h-[40vh] overflow-y-auto rounded-lg border border-emerald-200/60 dark:border-emerald-800/40">
              <Table>
                <TableHeader className="sticky top-0 bg-emerald-50/80 backdrop-blur dark:bg-emerald-950/60">
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Élève
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Classe actuelle
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Classe suivante
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-emerald-900 dark:text-emerald-200">
                      Décision
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((e) => {
                    const decision = decisions[e.eleve_id] || "PROMU";
                    return (
                      <TableRow
                        key={e.eleve_id}
                        className="hover:bg-emerald-50/60 dark:hover:bg-emerald-950/20"
                      >
                        <TableCell>
                          {decision === "REDOUBLANT" ? (
                            <span className="flex size-6 items-center justify-center rounded-md bg-amber-500/15 text-amber-700 dark:text-amber-300">
                              <RotateCcw className="size-3.5" />
                            </span>
                          ) : decision === "NON_REINSCRIT" ? (
                            <span className="flex size-6 items-center justify-center rounded-md bg-rose-500/15 text-rose-700 dark:text-rose-300">
                              <UserX className="size-3.5" />
                            </span>
                          ) : e.est_diplome ? (
                            <span className="flex size-6 items-center justify-center rounded-md bg-sky-500/15 text-sky-700 dark:text-sky-300">
                              <GraduationCap className="size-3.5" />
                            </span>
                          ) : (
                            <span className="flex size-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                              <ArrowRight className="size-3.5" />
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="break-words text-sm font-medium leading-snug text-foreground">
                          {e.eleve_nom} {e.eleve_prenoms}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {e.classe_actuelle}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {decision === "REDOUBLANT" ? e.classe_actuelle : e.classe_suivante}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={decision}
                            onValueChange={(v) => updateDecision(e.eleve_id, v)}
                          >
                            <SelectTrigger
                              className="h-8 w-[140px] text-xs focus-visible:border-emerald-500 focus-visible:ring-emerald-500/30"
                              aria-label={`Décision pour ${e.eleve_nom} ${e.eleve_prenoms}`}
                            >
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

            {/* Bandeau d'info */}
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 text-sm text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
              <p>
                Vérifiez les décisions puis validez. Les redoublants seront
                réinscrits dans la même classe. Les non-réinscrits ne recevront
                pas de nouvelle inscription.
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
            <div className="grid grid-cols-1 gap-2 sm:flex sm:justify-end">
              <Button
                variant="success"
                onClick={handleClose}
                className="w-full sm:w-auto"
              >
                <CheckCircle2 className="size-4" />
                Terminé
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button
                variant="outline"
                onClick={handleClose}
                className="w-full sm:w-auto"
              >
                Annuler
              </Button>
              {ancienneId && nouvelleId && preview && preview.length > 0 && (
                <Button
                  variant="success"
                  className="w-full sm:w-auto"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate()}
                >
                  {mutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ArrowRight className="size-4" />
                  )}
                  Valider le passage ({preview.length} élèves)
                </Button>
              )}
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// États vides premium (KentePattern bg + badge rond coloré)
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <GlassCard variant="adaptive" noHover className="relative overflow-hidden">
      <KentePattern variant="bg" />
      <div className="relative flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <Icon className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="font-display text-base font-semibold text-forest">
            {title}
          </p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        {action}
      </div>
    </GlassCard>
  );
}
