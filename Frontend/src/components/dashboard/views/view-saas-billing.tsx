"use client";

/**
 * ScolaGest — Vue « Facturation SaaS » (SUPER_ADMIN).
 *
 * Vue principale de facturation avec 4 onglets :
 *  - Vue d'ensemble : KPIs de revenus (mensuel, annuel, en attente,
 *    abonnements actifs/essai, factures impayées/payées).
 *  - Plans : grille de cartes (Basic / Pro / Enterprise) avec édition.
 *  - Abonnements : table avec établissement, plan, cycle, statut, dates,
 *    auto-renouvellement, action « Annuler ».
 *  - Factures : table filtrable (statut, établissement) avec génération et
 *    paiement.
 *
 * Données :
 *  - `GET  /api/saas/billing/stats`          → fetchBillingStats
 *  - `GET  /api/saas/billing/plans`          → fetchPlans
 *  - `GET  /api/saas/billing/subscriptions`  → fetchSubscriptions
 *  - `GET  /api/saas/billing/invoices`       → fetchInvoices(filters)
 *  - `POST /api/saas/billing/subscriptions/:id/cancel` → cancelSubscription
 *
 * États : chargement (skeleton), erreur (retry), vide.
 */

import * as React from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CreditCard,
  Wallet,
  TrendingUp,
  CalendarClock,
  Users,
  UserCog,
  Plus,
  Pencil,
  Ban,
  Check,
  AlertCircle,
  RotateCw,
  Banknote,
  Hourglass,
  XCircle,
  Loader2,
  Building2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  billingKeys,
  fetchBillingStats,
  fetchPlans,
  fetchSubscriptions,
  fetchInvoices,
  cancelSubscription,
  type SaaPlan,
  type SaaSubscription,
  type SaaInvoice,
  type SubscriptionStatut,
  type InvoiceStatut,
  type CycleFacturation,
} from "@/lib/api-saas-billing";
import { fetchSaasEstablishments } from "@/lib/api-saas";
import { useToast } from "@/hooks/use-toast";
import {
  formatFCFA,
  formatDateShort,
  formatDateTime,
} from "@/lib/format";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { GlassCard } from "@/components/ds/glass-card";
import { StatCard } from "@/components/ds/stat-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { ProgressCircle } from "@/components/ds/progress-circle";

import { PlanFormDialog } from "@/components/saas-billing/plan-form-dialog";
import { SubscriptionFormDialog } from "@/components/saas-billing/subscription-form-dialog";
import { InvoiceGenerateDialog } from "@/components/saas-billing/invoice-generate-dialog";
import { InvoicePayDialog } from "@/components/saas-billing/invoice-pay-dialog";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers d'affichage
// ─────────────────────────────────────────────────────────────────────────────

const SUB_STATUT_LABEL: Record<SubscriptionStatut, string> = {
  ACTIVE: "Actif",
  TRIALING: "Essai",
  PAST_DUE: "En retard",
  CANCELLED: "Annulé",
  SUSPENDED: "Suspendu",
};

function SubStatutBadge({ statut }: { statut: SubscriptionStatut }) {
  const cls: Record<SubscriptionStatut, string> = {
    ACTIVE:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    TRIALING:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
    PAST_DUE:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
    CANCELLED:
      "border-muted-foreground/20 bg-muted/40 text-muted-foreground",
    SUSPENDED:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", cls[statut])}>
      {SUB_STATUT_LABEL[statut]}
    </Badge>
  );
}

const INV_STATUT_LABEL: Record<InvoiceStatut, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyée",
  PAID: "Payée",
  OVERDUE: "En retard",
  CANCELLED: "Annulée",
};

function InvoiceStatutBadge({ statut }: { statut: InvoiceStatut }) {
  const cls: Record<InvoiceStatut, string> = {
    DRAFT: "border-muted-foreground/20 bg-muted/40 text-muted-foreground",
    SENT: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
    PAID: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    OVERDUE:
      "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300",
    CANCELLED:
      "border-muted-foreground/20 bg-muted/40 text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", cls[statut])}>
      {INV_STATUT_LABEL[statut]}
    </Badge>
  );
}

function cycleLabel(c: CycleFacturation): string {
  return c === "MONTHLY" ? "Mensuel" : "Annuel";
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function SaasBillingView() {
  const [tab, setTab] = React.useState<"overview" | "plans" | "subs" | "invoices">(
    "overview",
  );

  // ─── Dialogues ─────────────────────────────────────────────────────────
  const [planDialogOpen, setPlanDialogOpen] = React.useState(false);
  const [editingPlan, setEditingPlan] = React.useState<SaaPlan | null>(null);
  const [subDialogOpen, setSubDialogOpen] = React.useState(false);
  const [invGenDialogOpen, setInvGenDialogOpen] = React.useState(false);
  const [payDialogOpen, setPayDialogOpen] = React.useState(false);
  const [payingInvoice, setPayingInvoice] = React.useState<SaaInvoice | null>(
    null,
  );

  // ─── Filtres factures ──────────────────────────────────────────────────
  const [invStatutFilter, setInvStatutFilter] = React.useState<string>("ALL");
  const [invEtabFilter, setInvEtabFilter] = React.useState<string>("ALL");

  function openCreatePlan() {
    setEditingPlan(null);
    setPlanDialogOpen(true);
  }
  function openEditPlan(plan: SaaPlan) {
    setEditingPlan(plan);
    setPlanDialogOpen(true);
  }

  function openPayInvoice(inv: SaaInvoice) {
    setPayingInvoice(inv);
    setPayDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <KentePattern variant="strip" position="top" />
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <CreditCard className="size-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">Facturation SaaS</h1>
            <p className="text-sm text-muted-foreground">
              Plans, abonnements et factures de la plateforme ScolaGest.
            </p>
          </div>
        </div>
      </div>

      {/* Onglets */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <div className="overflow-x-auto">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="overview">Vue d&apos;ensemble</TabsTrigger>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="subs">Abonnements</TabsTrigger>
            <TabsTrigger value="invoices">Factures</TabsTrigger>
          </TabsList>
        </div>

        {/* ─── Vue d'ensemble ──────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          <OverviewTab />
        </TabsContent>

        {/* ─── Plans ───────────────────────────────────────────────────── */}
        <TabsContent value="plans" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Plans tarifaires
            </h2>
            <Button
              variant="success"
              size="sm"
              onClick={openCreatePlan}
            >
              <Plus className="size-3.5" />
              Nouveau plan
            </Button>
          </div>
          <PlansTab onEdit={openEditPlan} />
        </TabsContent>

        {/* ─── Abonnements ─────────────────────────────────────────────── */}
        <TabsContent value="subs" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Abonnements
            </h2>
            <Button
              variant="success"
              size="sm"
              onClick={() => setSubDialogOpen(true)}
            >
              <Plus className="size-3.5" />
              Nouvel abonnement
            </Button>
          </div>
          <SubscriptionsTab />
        </TabsContent>

        {/* ─── Factures ────────────────────────────────────────────────── */}
        <TabsContent value="invoices" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Factures
            </h2>
            <Button
              variant="premium"
              size="sm"
              onClick={() => setInvGenDialogOpen(true)}
            >
              <Plus className="size-3.5" />
              Générer facture
            </Button>
          </div>
          <InvoicesTab
            statutFilter={invStatutFilter}
            setStatutFilter={setInvStatutFilter}
            etabFilter={invEtabFilter}
            setEtabFilter={setInvEtabFilter}
            onPay={openPayInvoice}
          />
        </TabsContent>
      </Tabs>

      {/* ─── Dialogues ────────────────────────────────────────────────── */}
      <PlanFormDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        plan={editingPlan}
      />
      <SubscriptionFormDialog
        open={subDialogOpen}
        onOpenChange={setSubDialogOpen}
      />
      <InvoiceGenerateDialog
        open={invGenDialogOpen}
        onOpenChange={setInvGenDialogOpen}
      />
      <InvoicePayDialog
        open={payDialogOpen}
        onOpenChange={setPayDialogOpen}
        invoice={payingInvoice}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Vue d'ensemble
// ─────────────────────────────────────────────────────────────────────────────

function OverviewTab() {
  const {
    data: stats,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: billingKeys.stats(),
    queryFn: fetchBillingStats,
    retry: 1,
    retryDelay: 1500,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <GlassCard variant="adaptive" noHover className="border-rose-200 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/20">
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <div className="flex size-11 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            <XCircle className="size-5" />
          </div>
          <p className="text-sm font-medium">Statistiques indisponibles</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Le backend n&apos;a pas pu renvoyer les agrégats de facturation.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RotateCw className={cn("size-3.5", isFetching && "animate-spin")} />
            Réessayer
          </Button>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* KPIs principaux */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <GlassCard variant="premium" premiumBorder noHover className="p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Revenu mensuel
              </p>
              <p className="mt-1 truncate font-display text-2xl font-bold tracking-tight text-foreground">
                {formatFCFA(stats?.revenu_mensuel ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                MRR — abonnements actifs
              </p>
            </div>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold/20 text-gold-dark">
              <TrendingUp className="size-5" aria-hidden="true" />
            </div>
          </div>
        </GlassCard>
        <GlassCard variant="premium" premiumBorder noHover className="p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Revenu annuel
              </p>
              <p className="mt-1 truncate font-display text-2xl font-bold tracking-tight text-foreground">
                {formatFCFA(stats?.revenu_annuel ?? 0)}
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                ARR — engagement annuel
              </p>
            </div>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold/20 text-gold-dark">
              <Wallet className="size-5" aria-hidden="true" />
            </div>
          </div>
        </GlassCard>
        <StatCard
          label="Revenu en attente"
          value={formatFCFA(stats?.revenu_en_attente ?? 0)}
          hint="Factures émises non réglées"
          icon={Hourglass}
          tone="amber"
          delay={0.1}
        />
        <StatCard
          label="Abonnements actifs"
          value={String(stats?.nb_abonnements_actifs ?? 0)}
          hint="Établissements souscrits"
          icon={CreditCard}
          tone="gold"
          delay={0.15}
        />
      </div>

      <KentePattern variant="separator" className="my-2" />

      {/* KPIs secondaires + taux de paiement */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Abonnements en essai"
          value={String(stats?.nb_abonnements_essai ?? 0)}
          hint="Période d'essai"
          icon={CalendarClock}
          tone="amber"
          delay={0}
        />
        <StatCard
          label="Factures impayées"
          value={String(stats?.nb_factures_impayees ?? 0)}
          hint="À relancer"
          icon={AlertCircle}
          tone="terracotta"
          delay={0.05}
        />
        <StatCard
          label="Factures payées"
          value={String(stats?.nb_factures_payees ?? 0)}
          hint="Encaissées"
          icon={Check}
          tone="emerald"
          delay={0.1}
        />
        <GlassCard
          variant="premium"
          premiumBorder
          noHover
          className="flex items-center justify-between gap-4 p-5"
        >
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Taux de paiement
            </span>
            <span className="font-display text-2xl font-bold text-foreground">
              {(() => {
                const paid = stats?.nb_factures_payees ?? 0;
                const unpaid = stats?.nb_factures_impayees ?? 0;
                const total = paid + unpaid;
                return total > 0 ? `${((paid / total) * 100).toFixed(1)} %` : "—";
              })()}
            </span>
            <span className="text-xs text-muted-foreground">
              Payées / (Payées + Impayées)
            </span>
          </div>
          <ProgressCircle
            value={(() => {
              const paid = stats?.nb_factures_payees ?? 0;
              const unpaid = stats?.nb_factures_impayees ?? 0;
              const total = paid + unpaid;
              return total > 0 ? (paid / total) * 100 : 0;
            })()}
            size={88}
            strokeWidth={8}
          />
        </GlassCard>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Plans
// ─────────────────────────────────────────────────────────────────────────────

function PlansTab({ onEdit }: { onEdit: (plan: SaaPlan) => void }) {
  const {
    data: plans,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: billingKeys.plans(),
    queryFn: fetchPlans,
    retry: 1,
    retryDelay: 1500,
  });

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-56" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <GlassCard variant="adaptive" noHover className="border-rose-200 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/20">
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <AlertCircle className="size-5 text-rose-600" />
          <p className="text-sm font-medium">Plans indisponibles</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RotateCw className={cn("size-3.5", isFetching && "animate-spin")} />
            Réessayer
          </Button>
        </div>
      </GlassCard>
    );
  }
  if ((plans ?? []).length === 0) {
    return (
      <GlassCard variant="adaptive" noHover className="border-dashed">
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <CreditCard className="size-6 text-muted-foreground/70" />
          <p>Aucun plan tarifaire enregistré.</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {(plans ?? []).map((p) => (
        <PlanCard key={p.id} plan={p} onEdit={() => onEdit(p)} />
      ))}
    </div>
  );
}

function PlanCard({
  plan,
  onEdit,
}: {
  plan: SaaPlan;
  onEdit: () => void;
}) {
  const highlight =
    plan.code === "PRO" || plan.code === "PROFESSIONNEL";
  return (
    <GlassCard
      variant={highlight ? "premium" : "adaptive"}
      premiumBorder={highlight}
      noHover
      className={cn(
        "relative p-5",
        !plan.actif ? "opacity-70" : "",
      )}
    >
      {highlight ? (
        <div className="absolute right-3 top-3">
          <Badge className="bg-gold text-white">Populaire</Badge>
        </div>
      ) : null}
      <div className="pb-2">
        <div className="flex items-center gap-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <CreditCard className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-base font-semibold leading-tight text-foreground">
              {plan.nom}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              {plan.code}
            </p>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <div>
          <p className="font-display text-2xl font-bold tracking-tight text-foreground">
            {formatFCFA(plan.prix_mensuel)}
            <span className="ml-1 text-xs font-normal text-muted-foreground">
              / mois
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            ou {formatFCFA(plan.prix_annuel)} / an
          </p>
        </div>

        {plan.description ? (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {plan.description}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2 border-t pt-3 text-xs">
          <div className="flex items-center gap-1.5">
            <Users className="size-3.5 text-emerald-600" aria-hidden="true" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Élèves
              </p>
              <p className="font-medium">
                {plan.nb_eleves_max === 0 ? "Illimité" : plan.nb_eleves_max}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <UserCog className="size-3.5 text-emerald-600" aria-hidden="true" />
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Utilisateurs
              </p>
              <p className="font-medium">
                {plan.nb_users_max === 0 ? "Illimité" : plan.nb_users_max}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          {plan.actif ? (
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
            >
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Actif
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="border-muted-foreground/20 bg-muted/40 text-muted-foreground"
            >
              <span className="size-1.5 rounded-full bg-muted-foreground" />
              Inactif
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onEdit}
            className="h-7 gap-1 text-xs"
          >
            <Pencil className="size-3" />
            Modifier
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Abonnements
// ─────────────────────────────────────────────────────────────────────────────

function SubscriptionsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const {
    data: subs,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: billingKeys.subscriptions(),
    queryFn: fetchSubscriptions,
    retry: 1,
    retryDelay: 1500,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelSubscription(id),
    onSuccess: async (sub) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: billingKeys.subscriptions(),
        }),
        queryClient.invalidateQueries({ queryKey: billingKeys.stats() }),
      ]);
      toast({
        title: "Abonnement annulé",
        description: `L'abonnement de « ${
          sub.etablissement?.nom ?? "l'établissement"
        } » ne sera plus renouvelé.`,
      });
    },
    onError: (err: unknown) => {
      toast({
        title: "Annulation impossible",
        description:
          err instanceof Error ? err.message : "Erreur inattendue.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <GlassCard variant="adaptive" noHover className="space-y-2 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </GlassCard>
    );
  }
  if (isError) {
    return (
      <GlassCard variant="adaptive" noHover className="border-rose-200 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/20">
        <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
          <AlertCircle className="size-5 text-rose-600" />
          <p className="text-sm font-medium">Abonnements indisponibles</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RotateCw className={cn("size-3.5", isFetching && "animate-spin")} />
            Réessayer
          </Button>
        </div>
      </GlassCard>
    );
  }
  if ((subs ?? []).length === 0) {
    return (
      <GlassCard variant="adaptive" noHover className="border-dashed">
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <CalendarClock className="size-6 text-muted-foreground/70" />
          <p>Aucun abonnement enregistré.</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard variant="adaptive" noHover className="overflow-hidden p-0">
      <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="pl-4">Établissement</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Cycle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date début</TableHead>
                <TableHead>Prochaine facture</TableHead>
                <TableHead className="text-center">Auto-renouvel.</TableHead>
                <TableHead className="pr-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(subs ?? []).map((s) => {
                const canCancel =
                  s.statut !== "CANCELLED" && s.statut !== "SUSPENDED";
                return (
                  <TableRow key={s.id}>
                    <TableCell className="pl-4">
                      <div className="flex items-center gap-2">
                        <div className="flex size-8 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                          <Building2 className="size-4" />
                        </div>
                        <span className="text-sm font-medium">
                          {s.etablissement?.nom ?? "—"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{s.plan?.nom ?? "—"}</span>
                      {s.plan ? (
                        <span className="ml-1 font-mono text-[10px] uppercase text-muted-foreground">
                          {s.plan.code}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs">
                      {cycleLabel(s.cycle_facturation)}
                    </TableCell>
                    <TableCell>
                      <SubStatutBadge statut={s.statut} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateShort(s.date_debut)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateShort(s.prochaine_facture)}
                    </TableCell>
                    <TableCell className="text-center">
                      {s.auto_renouvellement ? (
                        <Check className="mx-auto size-4 text-emerald-600" />
                      ) : (
                        <XCircle className="mx-auto size-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      {canCancel ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={
                                cancelMutation.isPending &&
                                cancelMutation.variables === s.id
                              }
                              className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/40"
                            >
                              {cancelMutation.isPending &&
                              cancelMutation.variables === s.id ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Ban className="size-3.5" />
                              )}
                              Annuler
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Annuler l&apos;abonnement ?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                « {s.etablissement?.nom ?? "Cet établissement"}{" "}
                                » ne sera plus facturé ni renouvelé. L&apos;accès
                                restera actif jusqu&apos;à la fin de la période
                                courante ({formatDateShort(s.prochaine_facture)}).
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Retour</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => cancelMutation.mutate(s.id)}
                                className="bg-rose-600 text-white hover:bg-rose-700"
                              >
                                Confirmer l&apos;annulation
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">
                          —
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet Factures
// ─────────────────────────────────────────────────────────────────────────────

function InvoicesTab({
  statutFilter,
  setStatutFilter,
  etabFilter,
  setEtabFilter,
  onPay,
}: {
  statutFilter: string;
  setStatutFilter: (v: string) => void;
  etabFilter: string;
  setEtabFilter: (v: string) => void;
  onPay: (inv: SaaInvoice) => void;
}) {
  // Liste des établissements pour le filtre
  const { data: establishments } = useQuery({
    queryKey: ["saas", "establishments"],
    queryFn: fetchSaasEstablishments,
    retry: 1,
    retryDelay: 1500,
  });

  // Construction des filtres API : on ne filtre que si une valeur réelle est
  // choisie (différente de "ALL").
  const apiParams = React.useMemo(() => {
    const p: { statut?: string; etablissement_id?: string } = {};
    if (statutFilter && statutFilter !== "ALL") p.statut = statutFilter;
    if (etabFilter && etabFilter !== "ALL") p.etablissement_id = etabFilter;
    return p;
  }, [statutFilter, etabFilter]);

  const {
    data: invoices,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: billingKeys.invoices(apiParams),
    queryFn: () => fetchInvoices(apiParams),
    retry: 1,
    retryDelay: 1500,
  });

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <GlassCard variant="adaptive" noHover className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Statut
            </p>
            <Select value={statutFilter} onValueChange={setStatutFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous</SelectItem>
                <SelectItem value="PAID">Payées</SelectItem>
                <SelectItem value="SENT">Impayées (envoyées)</SelectItem>
                <SelectItem value="OVERDUE">En retard</SelectItem>
                <SelectItem value="DRAFT">Brouillons</SelectItem>
                <SelectItem value="CANCELLED">Annulées</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Établissement
            </p>
            <Select value={etabFilter} onValueChange={setEtabFilter}>
              <SelectTrigger className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Tous établissements</SelectItem>
                {(establishments ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="h-9"
          >
            <RotateCw className={cn("size-3.5", isFetching && "animate-spin")} />
            Actualiser
          </Button>
        </div>
      </GlassCard>

      {/* Table */}
      <GlassCard variant="adaptive" noHover className="overflow-hidden p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-sm text-muted-foreground">
            <AlertCircle className="size-5 text-rose-600" />
            <p>Impossible de charger les factures.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RotateCw className="size-3.5" />
              Réessayer
            </Button>
          </div>
        ) : (invoices ?? []).length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">
            Aucune facture ne correspond aux filtres sélectionnés.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="pl-4">Numéro</TableHead>
                  <TableHead>Établissement</TableHead>
                  <TableHead>Période</TableHead>
                  <TableHead className="text-right">Montant TTC</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Émission</TableHead>
                  <TableHead>Échéance</TableHead>
                  <TableHead>Paiement</TableHead>
                  <TableHead className="pr-4 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(invoices ?? []).map((inv) => {
                  const canPay =
                    inv.statut === "SENT" || inv.statut === "OVERDUE";
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="pl-4 font-mono text-xs font-medium">
                        {inv.numero}
                      </TableCell>
                      <TableCell className="text-sm">
                        {inv.etablissement?.nom ?? "—"}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {formatDateShort(inv.periode_debut)} →{" "}
                        {formatDateShort(inv.periode_fin)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium">
                        {formatFCFA(inv.montant_ttc)}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatutBadge statut={inv.statut} />
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {formatDateShort(inv.date_emission)}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {formatDateShort(inv.date_echeance)}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {inv.date_paiement
                          ? formatDateTime(inv.date_paiement)
                          : "—"}
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        {canPay ? (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={() => onPay(inv)}
                          >
                            <Banknote className="size-3.5" />
                            Marquer payée
                          </Button>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">
                            —
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
