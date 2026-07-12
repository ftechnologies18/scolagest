"use client";

/**
 * ScolaGest — Tableau de bord (Phase 4).
 *
 * Vue d'accueil du tableau de bord. Affiche des données réelles issues de
 * `GET /api/dashboard` :
 *  - 4 cartes KPI (total encaissé / total attendu / taux de recouvrement /
 *    nb impayés) ;
 *  - filtre de période (date début/fin) avec 4 presets (aujourd'hui, 7 jours,
 *    ce mois, cette année) ;
 *  - bar chart « Encaissements par cycle » (CSS pur, attendu vs encaissé) ;
 *  - bar chart « Répartition par mode de paiement » ;
 *  - bar chart vertical « Évolution mensuelle » (12 derniers mois) ;
 *  - table « Derniers paiements » (10 derniers, raccourci vers la caisse) ;
 *  - carte « Statut du système » (ping GET /api/health) ;
 *  - actions rapides (naviguent vers les autres vues).
 *
 * États : pas d'établissement, chargement (skeleton), erreur, vide.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  Wallet,
  Target,
  AlertTriangle,
  UserPlus,
  Banknote,
  ListChecks,
  Lock,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowUpRight,
  CalendarRange,
  RotateCw,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import { apiGet, ApiError } from "@/lib/api-client";
import { fetchDashboard, dashboardKeys } from "@/lib/api-reports";
import { KpiCard } from "@/components/reports/kpi-card";
import { BarChart } from "@/components/reports/bar-chart";
import {
  formatFCFA,
  formatDateShort,
  formatTime,
  todayISO,
  isoToDateInput,
} from "@/lib/format";
import { ModePaiementBadge } from "@/components/caisse/caisse-badges";
import type {
  DashboardData,
  RepartitionItem,
  RepartitionModePaiement,
} from "@/lib/types";
import SaasDashboardView from "./views/view-saas-dashboard";

export type DashboardViewId =
  | "dashboard"
  | "eleves"
  | "inscription"
  | "caisse"
  | "impayes"
  | "rapports"
  | "frais"
  | "annees"
  | "utilisateurs"
  | "effectifs"
  | "passage-masse"
  | "comptabilite"
  | "mobile-money"
  | "parametres"
  | "pre-inscriptions"
  // Pédagogie (module Enseignant — Phase A)
  | "enseignants"
  | "matieres"
  | "affectations"
  // Pédagogie — Phase B (pointage temps réel + discipline)
  | "pointage-ecran"
  | "discipline"
  // Pédagogie — Phase C (paie enseignants)
  | "paie"
  // Pédagogie — Phase A étendue (emploi du temps)
  | "emploi-du-temps"
  // Vues SaaS (SUPER_ADMIN uniquement)
  | "saas-dashboard"
  | "saas-establishments"
  | "saas-audit"
  | "saas-billing"
  | "saas-support";

interface DashboardHomeProps {
  onNavigate: (view: DashboardViewId) => void;
}

interface HealthResponse {
  status: string;
  version?: string;
  env?: string;
}

const QUICK_ACTIONS: {
  label: string;
  description: string;
  icon: typeof UserPlus;
  view: DashboardViewId;
  accent: "emerald" | "amber";
}[] = [
  {
    label: "Nouvel élève",
    description: "Créer une fiche élève",
    icon: UserPlus,
    view: "eleves",
    accent: "emerald",
  },
  {
    label: "Nouvel encaissement",
    description: "Encaisser un paiement",
    icon: Banknote,
    view: "caisse",
    accent: "emerald",
  },
  {
    label: "Voir impayés",
    description: "Relances & soldes débiteurs",
    icon: ListChecks,
    view: "impayes",
    accent: "amber",
  },
  {
    label: "Clôturer caisse",
    description: "Clôture journalière",
    icon: Lock,
    view: "caisse",
    accent: "amber",
  },
];

type PeriodPreset = "today" | "7d" | "month" | "year" | "custom";

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function roleLabel(role: string | null): string {
  if (!role) return "Utilisateur";
  const map: Record<string, string> = {
    SUPER_ADMIN: "Super Admin (SaaS)",
    CAISSIER: "Caissier(ère)",
    COMPTABLE: "Comptable",
    DIRECTION: "Direction",
  DIRECTEUR_ETUDES: "Directeur des Études",
  DIRECTEUR_SUPERVISEUR: "Directeur Superviseur",
    SECRETARIAT: "Secrétariat",
    PARENT: "Parent / Tuteur",
  };
  return map[role] ?? role;
}

function initials(nom?: string, prenoms?: string): string {
  const a = (nom ?? "").trim().charAt(0);
  const b = (prenoms ?? "").trim().charAt(0);
  return (a + b).toUpperCase() || "?";
}

/** Calcule date_debut/date_fin ISO pour un preset. */
function presetRange(preset: PeriodPreset): { debut: string; fin: string } {
  const now = new Date();
  const fin = todayISO();
  const fmt = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  switch (preset) {
    case "today":
      return { debut: fin, fin };
    case "7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { debut: fmt(d), fin };
    }
    case "month": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      return { debut: fmt(d), fin };
    }
    case "year": {
      const d = new Date(now.getFullYear(), 0, 1);
      return { debut: fmt(d), fin };
    }
    default:
      return { debut: "", fin };
  }
}

/** Normalise un item de répartition (cycle/classe/categorie → libellé). */
function normalizeRepartition<T extends RepartitionItem>(items: T[]): T[] {
  return items.map((it) => ({
    ...it,
    libelle:
      it.libelle || it.cycle || it.classe || it.categorie || "—",
  }));
}

export function DashboardHome({ onNavigate }: DashboardHomeProps) {
  const user = useAuthStore((s) => s.user);
  const etablissement = useAuthStore((s) => s.etablissement);
  const role = useAuthStore((s) => s.role);

  // ─── Période sélectionnée ────────────────────────────────────────────────
  const [preset, setPreset] = React.useState<PeriodPreset>("year");
  const [dateDebut, setDateDebut] = React.useState<string>(
    presetRange("year").debut,
  );
  const [dateFin, setDateFin] = React.useState<string>(
    presetRange("year").fin,
  );

  function applyPreset(p: PeriodPreset) {
    setPreset(p);
    if (p !== "custom") {
      const r = presetRange(p);
      setDateDebut(r.debut);
      setDateFin(r.fin);
    }
  }

  function handleDateDebutChange(v: string) {
    setDateDebut(v);
    setPreset("custom");
  }
  function handleDateFinChange(v: string) {
    setDateFin(v);
    setPreset("custom");
  }

  // ─── Données du tableau de bord ──────────────────────────────────────────
  const {
    data: dashboard,
    isLoading: loadingDashboard,
    isError: dashboardError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: dashboardKeys.data({ date_debut: dateDebut, date_fin: dateFin }),
    queryFn: () =>
      fetchDashboard({
        date_debut: dateDebut || undefined,
        date_fin: dateFin || undefined,
      }),
    enabled: !!etablissement?.id,
    retry: 1,
    retryDelay: 1500,
  });

  // ─── Statut du système (ping /api/health) ─────────────────────────────────
  const [health, setHealth] = React.useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = React.useState(true);
  const [healthError, setHealthError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<HealthResponse>("/api/health", {
          skipAuth: true,
        });
        if (!cancelled) {
          setHealth(data);
          setHealthError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setHealthError(
            err instanceof ApiError
              ? err.message
              : "Backend injoignable pour le moment.",
          );
        }
      } finally {
        if (!cancelled) setHealthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = user
    ? `${user.prenoms ?? ""} ${user.nom ?? ""}`.trim() || user.email
    : "Utilisateur";

  // ─── SUPER_ADMIN : redirige vers le tableau de bord SaaS ────────────────
  // Le SUPER_ADMIN n'a pas accès aux données d'établissement (sauf mode
  // support actif). On affiche directement la vue SaaS plutôt que le
  // tableau de bord d'établissement.
  if (role === "SUPER_ADMIN") {
    return (
      <SaasDashboardView
        onNavigate={(v) =>
          onNavigate(
            v as
              | "saas-establishments"
              | "saas-audit"
              | "saas-billing"
              | "saas-support",
          )
        }
      />
    );
  }

  // ─── Pas d'établissement : message d'invite ──────────────────────────────
  if (!etablissement?.id) {
    return (
      <div className="space-y-6">
        <WelcomeCard
          displayName={displayName}
          role={role}
          etablissementNom={etablissement?.nom}
          user={user}
        />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="size-6" />
            </div>
            <p className="text-sm font-medium">
              Sélectionnez un établissement
            </p>
            <p className="max-w-md text-xs text-muted-foreground">
              Choisissez un établissement dans la barre latérale pour afficher
              les indicateurs et graphiques du tableau de bord.
            </p>
          </CardContent>
        </Card>
        <SystemStatusCard
          health={health}
          loading={healthLoading}
          error={healthError}
        />
      </div>
    );
  }

  const kpis = dashboard?.kpis;
  const parCycle = normalizeRepartition(dashboard?.par_cycle ?? []);
  const parMode = dashboard?.par_mode_paiement ?? [];
  const evolution = dashboard?.evolution_mensuelle ?? [];
  const derniersPaiements = dashboard?.derniers_paiements ?? [];

  // ─── Compute taux pour display ────────────────────────────────────────────
  const tauxRecouvrement = kpis?.taux_recouvrement ?? 0;

  return (
    <div className="space-y-6">
      <WelcomeCard
        displayName={displayName}
        role={role}
        etablissementNom={etablissement.nom}
        user={user}
      />

      {/* Filtre de période + rafraîchir */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Période</Label>
              <Select
                value={preset}
                onValueChange={(v) => applyPreset(v as PeriodPreset)}
              >
                <SelectTrigger className="w-[180px]">
                  <CalendarRange className="size-3.5 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Aujourd&apos;hui</SelectItem>
                  <SelectItem value="7d">7 derniers jours</SelectItem>
                  <SelectItem value="month">Ce mois-ci</SelectItem>
                  <SelectItem value="year">Cette année</SelectItem>
                  <SelectItem value="custom">Personnalisé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date-debut" className="text-xs">
                Date début
              </Label>
              <Input
                id="date-debut"
                type="date"
                className="w-[160px]"
                value={dateDebut}
                onChange={(e) => handleDateDebutChange(e.target.value)}
                max={dateFin || todayISO()}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date-fin" className="text-xs">
                Date fin
              </Label>
              <Input
                id="date-fin"
                type="date"
                className="w-[160px]"
                value={dateFin}
                onChange={(e) => handleDateFinChange(e.target.value)}
                min={dateDebut || undefined}
                max={todayISO()}
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RotateCw className="size-3.5" />
            )}
            Actualiser
          </Button>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Indicateurs clés
          </h2>
          <Badge
            variant="outline"
            className="border-emerald-300 text-emerald-700 text-[10px] dark:border-emerald-800 dark:text-emerald-300"
          >
            Phase 4 · Données temps réel
          </Badge>
        </div>
        {loadingDashboard ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : dashboardError ? (
          <Card className="border-rose-200 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/20">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
              <div className="flex size-11 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                <XCircle className="size-5" />
              </div>
              <p className="text-sm font-medium">
                Tableau de bord indisponible
              </p>
              <p className="max-w-md text-xs text-muted-foreground">
                Le backend n&apos;a pas pu renvoyer les agrégats. Vérifiez que
                le serveur Go est démarré puis réessayez.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <RotateCw className="size-3.5" />
                Réessayer
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Total encaissé (période)"
              value={formatFCFA(kpis?.total_encaisse ?? 0)}
              icon={Wallet}
              accent="emerald"
              subtitle={`Aujourd'hui : ${formatFCFA(kpis?.montant_jour ?? 0)}`}
            />
            <KpiCard
              label="Total attendu (année)"
              value={formatFCFA(kpis?.total_attendu ?? 0)}
              icon={Target}
              accent="sky"
              subtitle={`Sur ${kpis?.nb_eleves ?? 0} élève${
                (kpis?.nb_eleves ?? 0) > 1 ? "s" : ""
              } inscrit(s)`}
            />
            <KpiCard
              label="Taux de recouvrement"
              value={`${tauxRecouvrement.toFixed(1)} %`}
              icon={TrendingUp}
              accent="emerald"
              subtitle={`Objectif annuel : 95 %`}
              trend={
                tauxRecouvrement >= 80
                  ? "Bon rythme"
                  : tauxRecouvrement >= 50
                    ? "À surveiller"
                    : "Critique"
              }
              trendUp={tauxRecouvrement >= 50}
            />
            <KpiCard
              label="Impayés (élèves)"
              value={`${kpis?.nb_impayes ?? 0}`}
              icon={AlertTriangle}
              accent={kpis && kpis.nb_impayes > 0 ? "amber" : "emerald"}
              subtitle={`Paiements du jour : ${kpis?.nb_paiements_jour ?? 0}`}
            />
          </div>
        )}
      </div>

      {/* Graphiques */}
      {dashboard ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Encaissements par cycle */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Encaissements par cycle
              </CardTitle>
              <CardDescription>
                Comparaison du total attendu et encaissé par cycle.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {parCycle.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Aucune donnée par cycle sur la période.
                </p>
              ) : (
                <BarChart
                  data={parCycle.map((c) => ({
                    label: c.libelle,
                    value: c.encaisse,
                    value2: c.attendu,
                  }))}
                  formatValue={formatFCFA}
                  height={Math.max(140, parCycle.length * 36)}
                  legendLabel="Encaissé"
                  legendLabel2="Attendu"
                />
              )}
            </CardContent>
          </Card>

          {/* Répartition par mode de paiement */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Encaissements par mode de paiement
              </CardTitle>
              <CardDescription>
                Part de chaque mode sur le montant total encaissé.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {parMode.length === 0 ? (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  Aucun paiement enregistré sur la période.
                </p>
              ) : (
                <ModePaiementChart data={parMode} />
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Évolution mensuelle */}
      {dashboard ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Évolution mensuelle des encaissements
            </CardTitle>
            <CardDescription>
              12 derniers mois — montants encaissés par mois.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {evolution.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Pas encore d&apos;historique mensuel disponible.
              </p>
            ) : (
              <BarChart
                data={evolution.map((e) => ({ label: e.mois, value: e.montant }))}
                orientation="vertical"
                formatValue={formatFCFA}
                height={220}
                showLegend={false}
                hideValues
              />
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Derniers paiements + Actions rapides */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  Derniers paiements
                </CardTitle>
                <CardDescription>
                  10 derniers encaissements validés.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate("caisse")}
              >
                Voir l&apos;historique
                <ArrowUpRight className="size-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {derniersPaiements.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                Aucun paiement récent.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="pl-4">Date</TableHead>
                      <TableHead>Reçu</TableHead>
                      <TableHead>Élève</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead className="pr-4">Caissier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {derniersPaiements.map((p) => {
                      const eleveLabel = p.eleve
                        ? [p.eleve.prenoms, p.eleve.nom]
                            .filter(Boolean)
                            .join(" ")
                        : "—";
                      const caissierLabel = p.caissier
                        ? `${p.caissier.prenoms ?? ""} ${p.caissier.nom ?? ""}`.trim()
                        : "—";
                      return (
                        <TableRow key={p.id} className="hover:bg-muted/40">
                          <TableCell className="pl-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-medium">
                                {formatDateShort(p.date_paiement)}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {formatTime(p.date_paiement)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-xs">
                              {p.numero_recu}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs font-medium">
                            {eleveLabel}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            {formatFCFA(p.montant)}
                          </TableCell>
                          <TableCell>
                            <ModePaiementBadge mode={p.mode_paiement} />
                          </TableCell>
                          <TableCell className="pr-4 text-xs text-muted-foreground">
                            {caissierLabel}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions rapides */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions rapides</CardTitle>
            <CardDescription>
              Raccourcis vers les opérations fréquentes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {QUICK_ACTIONS.map((action) => {
                const Icon = action.icon;
                const isEmerald = action.accent === "emerald";
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={() => onNavigate(action.view)}
                    className={cn(
                      "group flex items-start gap-3 rounded-xl border p-3 text-left transition-all hover:shadow-sm",
                      isEmerald
                        ? "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-emerald-900/40 dark:hover:bg-emerald-950/30"
                        : "border-amber-200 hover:border-amber-400 hover:bg-amber-50/40 dark:border-amber-900/40 dark:hover:bg-amber-950/30",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm",
                        isEmerald ? "bg-emerald-600" : "bg-amber-500",
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">
                        {action.label}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {action.description}
                      </p>
                    </div>
                    <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Statut du système */}
      <SystemStatusCard
        health={health}
        loading={healthLoading}
        error={healthError}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

function WelcomeCard({
  displayName,
  role,
  etablissementNom,
  user,
}: {
  displayName: string;
  role: string | null;
  etablissementNom?: string;
  user: { nom?: string; prenoms?: string } | null;
}) {
  return (
    <Card className="overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50 via-background to-background dark:border-emerald-900/40">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
              <span className="text-lg font-bold">
                {initials(user?.nom, user?.prenoms)}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                {getGreeting()},
              </p>
              <h1 className="text-xl font-bold tracking-tight">
                {displayName}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className="border-emerald-300 text-[11px] text-emerald-700 dark:border-emerald-800 dark:text-emerald-300"
                >
                  {roleLabel(role)}
                </Badge>
                {etablissementNom ? (
                  <Badge variant="secondary" className="text-[11px]">
                    {etablissementNom}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[11px]">
                    Tous établissements
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="text-xs text-muted-foreground sm:text-right">
            <p>
              Nous sommes le{" "}
              <strong className="text-foreground">
                {new Date().toLocaleDateString("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </strong>
            </p>
            <p className="mt-1">
              Tableau de bord — Phase 4 :{" "}
              <strong className="text-foreground">
                Rapports &amp; statistiques
              </strong>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SystemStatusCard({
  health,
  loading,
  error,
}: {
  health: HealthResponse | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-4 text-emerald-600" />
          Statut du système
        </CardTitle>
        <CardDescription>État du backend Go sur le port 8080.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
          <span className="text-xs text-muted-foreground">API</span>
          {loading ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Vérification…
            </span>
          ) : health && health.status === "ok" ? (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="size-4" />
              Opérationnel
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-medium text-rose-600 dark:text-rose-300">
              <XCircle className="size-4" />
              Hors ligne
            </span>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
          <span className="text-xs text-muted-foreground">Version</span>
          <code className="text-xs">{health?.version ?? "—"}</code>
        </div>

        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
          <span className="text-xs text-muted-foreground">Environnement</span>
          <Badge variant="outline" className="text-[10px]">
            {health?.env ?? "inconnu"}
          </Badge>
        </div>

        <Separator />

        {error ? (
          <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            {health
              ? "Tous les services sont disponibles."
              : "En attente de réponse du backend…"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/** Mini graphique par mode de paiement (barres horizontales + compte). */
function ModePaiementChart({ data }: { data: RepartitionModePaiement[] }) {
  const total = data.reduce((s, d) => s + (d.montant ?? 0), 0) || 1;
  const sorted = [...data].sort((a, b) => (b.montant ?? 0) - (a.montant ?? 0));
  return (
    <div className="space-y-2.5">
      {sorted.map((d) => {
        const pct = Math.max(2, ((d.montant ?? 0) / total) * 100);
        const label = modeLabel(d.mode);
        return (
          <div
            key={d.mode}
            className="grid grid-cols-[110px_1fr_auto] items-center gap-3 text-xs sm:grid-cols-[140px_1fr_auto]"
            title={`${label} : ${formatFCFA(d.montant)} (${d.count} paiement(s))`}
          >
            <span className="truncate text-muted-foreground">{label}</span>
            <div className="relative h-5 overflow-hidden rounded-md bg-muted/40">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-md transition-all duration-300",
                  modeBarColor(d.mode),
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-mono text-[11px] tabular-nums text-foreground/80">
              {formatFCFA(d.montant)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function modeLabel(mode: string): string {
  const m = mode as keyof typeof MODE_LABELS;
  return MODE_LABELS[m] ?? mode;
}

const MODE_LABELS: Record<string, string> = {
  ESPECES: "Espèces",
  CHEQUE: "Chèque",
  VIREMENT: "Virement",
  MOBILE_MONEY: "Mobile Money",
};

function modeBarColor(mode: string): string {
  switch (mode) {
    case "ESPECES":
      return "bg-emerald-500";
    case "CHEQUE":
      return "bg-amber-400";
    case "VIREMENT":
      return "bg-slate-400";
    case "MOBILE_MONEY":
      return "bg-orange-400";
    default:
      return "bg-emerald-500";
  }
}
