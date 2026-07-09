"use client";

/**
 * ScolaGest — Vue d'accueil du tableau de bord
 *
 * Affiche un message de bienvenue personnalisé, 4 KPIs (données de
 * démonstration — Phase 2 viendra les brancher sur le backend), des actions
 * rapides et le statut du système (ping GET /api/health).
 */

import { useEffect, useState } from "react";
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
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import { apiGet, ApiError } from "@/lib/api-client";

export type DashboardViewId =
  | "dashboard"
  | "eleves"
  | "caisse"
  | "impayes"
  | "rapports"
  | "frais"
  | "annees"
  | "utilisateurs"
  | "comptabilite"
  | "mobile-money"
  | "parametres";

interface DashboardHomeProps {
  onNavigate: (view: DashboardViewId) => void;
}

interface HealthResponse {
  status: string;
  version?: string;
  env?: string;
}

interface Kpi {
  label: string;
  value: string;
  helper: string;
  trend?: string;
  trendUp?: boolean;
  icon: typeof TrendingUp;
  accent: "emerald" | "amber" | "rose";
}

const KPI_PLACEHOLDER: Kpi[] = [
  {
    label: "Total encaissé",
    value: "142 350 000 FCFA",
    helper: "Sur l'exercice 2024-2025",
    trend: "+8,2 % vs N-1",
    trendUp: true,
    icon: Wallet,
    accent: "emerald",
  },
  {
    label: "Total attendu",
    value: "168 720 000 FCFA",
    helper: "Inscriptions + scolarités",
    icon: Target,
    accent: "emerald",
  },
  {
    label: "Taux de recouvrement",
    value: "84,4 %",
    helper: "Objectif annuel : 95 %",
    trend: "+3,1 pts",
    trendUp: true,
    icon: TrendingUp,
    accent: "emerald",
  },
  {
    label: "Impayés restants",
    value: "26 370 000 FCFA",
    helper: "412 élèves concernés",
    trend: "-12 élèves vs mois dernier",
    trendUp: true,
    icon: AlertTriangle,
    accent: "amber",
  },
];

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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function roleLabel(role: string | null): string {
  if (!role) return "Utilisateur";
  const map: Record<string, string> = {
    ADMINISTRATEUR: "Administrateur",
    CAISSIER: "Caissier(ère)",
    COMPTABLE: "Comptable",
    DIRECTION: "Direction",
    CENSEUR: "Censeur",
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

export function DashboardHome({ onNavigate }: DashboardHomeProps) {
  const user = useAuthStore((s) => s.user);
  const etablissement = useAuthStore((s) => s.etablissement);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  useEffect(() => {
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

  return (
    <div className="space-y-6">
      {/* En-tête de bienvenue */}
      <Card className="overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50 via-background to-background">
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
                <span className="text-lg font-bold">
                  {initials(user?.nom, user?.prenoms)}
                </span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-700 font-medium">
                  {getGreeting()},
                </p>
                <h1 className="text-xl font-bold tracking-tight">
                  {displayName}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-emerald-300 text-emerald-700 text-[11px]"
                  >
                    {roleLabel(useAuthStore.getState().role)}
                  </Badge>
                  {etablissement ? (
                    <Badge variant="secondary" className="text-[11px]">
                      {etablissement.nom}
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
                Année scolaire courante :{" "}
                <strong className="text-foreground">2024-2025</strong>
              </p>
            </div>
          </div>
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
            className="border-amber-300 text-amber-700 text-[10px]"
          >
            Données de démonstration — Phase 2
          </Badge>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {KPI_PLACEHOLDER.map((kpi) => {
            const Icon = kpi.icon;
            const accentClasses =
              kpi.accent === "emerald"
                ? "bg-emerald-50 text-emerald-700"
                : kpi.accent === "amber"
                  ? "bg-amber-50 text-amber-700"
                  : "bg-rose-50 text-rose-700";
            return (
              <Card key={kpi.label} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div
                      className={cn(
                        "flex size-9 items-center justify-center rounded-lg",
                        accentClasses,
                      )}
                    >
                      <Icon className="size-5" />
                    </div>
                    {kpi.trend && (
                      <span
                        className={cn(
                          "flex items-center gap-0.5 text-[11px] font-medium",
                          kpi.trendUp ? "text-emerald-600" : "text-rose-600",
                        )}
                      >
                        <ArrowUpRight
                          className={cn(
                            "size-3",
                            !kpi.trendUp && "rotate-90",
                          )}
                        />
                        {kpi.trend}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {kpi.label}
                  </p>
                  <p className="mt-1 text-xl font-bold tracking-tight">
                    {kpi.value}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {kpi.helper}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Actions rapides + Statut système */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Actions rapides</CardTitle>
            <CardDescription>
              Raccourcis vers les opérations les plus fréquentes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
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
                        ? "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/40"
                        : "border-amber-200 hover:border-amber-400 hover:bg-amber-50/40",
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
                      <p className="text-[11px] text-muted-foreground mt-0.5">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="size-4 text-emerald-600" />
              Statut du système
            </CardTitle>
            <CardDescription>
              État du backend Go sur le port 8080.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
              <span className="text-xs text-muted-foreground">API</span>
              {healthLoading ? (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Vérification…
                </span>
              ) : health && health.status === "ok" ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="size-4" />
                  Opérationnel
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs font-medium text-rose-600">
                  <XCircle className="size-4" />
                  Hors ligne
                </span>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
              <span className="text-xs text-muted-foreground">Version</span>
              <code className="text-xs">
                {health?.version ?? "—"}
              </code>
            </div>

            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2.5">
              <span className="text-xs text-muted-foreground">
                Environnement
              </span>
              <Badge variant="outline" className="text-[10px]">
                {health?.env ?? "inconnu"}
              </Badge>
            </div>

            <Separator />

            {healthError ? (
              <p className="text-[11px] text-rose-600">
                {healthError}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                {health
                  ? "Tous les services sont disponibles."
                  : "En attente de réponse du backend…"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
