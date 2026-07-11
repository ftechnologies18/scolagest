"use client";

/**
 * ScolaGest — Vue « Mobile Money » (Phase 5).
 *
 * Trois onglets :
 *  - Transactions       : filtres (statut, provider, dates) + table paginée
 *    avec action « Confirmer » (sandbox) pour les INITIEE / EN_COURS.
 *  - Nouvelle transaction : `<MomoInitierForm />` (recherche élève + montant +
 *    provider + téléphone).
 *  - Webhooks           : liste des derniers webhooks reçus + action
 *    « Réconcilier ».
 *
 * Rôles autorisés : CAISSIER / DIRECTION (filtre nav dans
 * `dashboard-layout.tsx`).
 *
 * Provider badges : Orange = orange, MTN = amber, Wave = slate (pas de bleu).
 */

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Smartphone,
  Send,
  Webhook,
  Loader2,
  AlertCircle,
  Filter,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  momoKeys,
  fetchTransactionsMomo,
  confirmerTransactionMomo,
  fetchWebhooksMomo,
  reconcilierWebhookMomo,
} from "@/lib/api-phase5";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA, formatDateTime, formatDateShort, todayISO } from "@/lib/format";
import type {
  ProviderMomo,
  StatutTransactionMomo,
  TransactionsMomoQueryParams,
  TransactionMomo,
  WebhookMomo,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ProviderMomoBadge,
  StatutMomoBadge,
} from "@/components/mobile-money/momo-badges";
import { MomoInitierForm } from "@/components/mobile-money/momo-initier-form";

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 15;

const STATUT_OPTIONS: { value: "all" | StatutTransactionMomo; label: string }[] = [
  { value: "all", label: "Tous statuts" },
  { value: "INITIEE", label: "Initiée" },
  { value: "EN_COURS", label: "En cours" },
  { value: "REUSSIE", label: "Réussie" },
  { value: "ECHEC", label: "Échec" },
  { value: "REMBOURSEE", label: "Remboursée" },
];

const PROVIDER_OPTIONS: { value: "all" | ProviderMomo; label: string }[] = [
  { value: "all", label: "Tous providers" },
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "MTN_MONEY", label: "MTN Money" },
  { value: "WAVE", label: "Wave" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function MobileMoneyView() {
  const etablissement = useAuthStore((s) => s.etablissement);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
            <Smartphone className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Mobile Money</h1>
            <p className="text-sm text-muted-foreground">
              Orange, MTN, Wave — transactions, webhooks et réconciliation.
              {etablissement?.nom ? (
                <span className="ml-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  {etablissement.nom}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      {!etablissement?.id ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <Filter className="size-6" />
            </div>
            <p className="text-sm font-medium">Sélectionnez un établissement</p>
            <p className="max-w-md text-xs text-muted-foreground">
              Les transactions Mobile Money sont rattachées à un établissement.
              Choisissez-en un dans la barre latérale.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="transactions" className="w-full">
          <TabsList className="flex w-full justify-start gap-1 overflow-x-auto sm:w-auto">
            <TabsTrigger value="transactions">
              <Smartphone className="size-3.5" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="nouvelle">
              <Send className="size-3.5" />
              Nouvelle
            </TabsTrigger>
            <TabsTrigger value="webhooks">
              <Webhook className="size-3.5" />
              Webhooks
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="mt-4">
            <TransactionsPanel />
          </TabsContent>
          <TabsContent value="nouvelle" className="mt-4">
            <MomoInitierForm />
          </TabsContent>
          <TabsContent value="webhooks" className="mt-4">
            <WebhooksPanel />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Transactions »
// ─────────────────────────────────────────────────────────────────────────────

function TransactionsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statut, setStatut] = React.useState<"all" | StatutTransactionMomo>(
    "all",
  );
  const [provider, setProvider] = React.useState<"all" | ProviderMomo>("all");
  const [dateDebut, setDateDebut] = React.useState("");
  const [dateFin, setDateFin] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [selectedTx, setSelectedTx] = React.useState<TransactionMomo | null>(
    null,
  );
  const [confirmTarget, setConfirmTarget] =
    React.useState<TransactionMomo | null>(null);

  const params: TransactionsMomoQueryParams = React.useMemo(
    () => ({
      statut: statut !== "all" ? statut : undefined,
      provider: provider !== "all" ? provider : undefined,
      date_debut: dateDebut || undefined,
      date_fin: dateFin || undefined,
      page,
      page_size: PAGE_SIZE,
    }),
    [statut, provider, dateDebut, dateFin, page],
  );

  const {
    data: result,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: momoKeys.transactions(params),
    queryFn: () => fetchTransactionsMomo(params),
    retry: 1,
    retryDelay: 1500,
  });

  React.useEffect(() => {
    setPage(1);
  }, [statut, provider, dateDebut, dateFin]);

  const confirmerMutation = useMutation({
    mutationFn: (id: string) => confirmerTransactionMomo(id),
    onSuccess: async (tx) => {
      await queryClient.invalidateQueries({ queryKey: momoKeys.all });
      toast({
        title: "Transaction confirmée",
        description: `Référence ${tx.reference_externe || tx.id.slice(0, 8)} · ${formatFCFA(
          tx.montant,
        )} encaissés via ${tx.provider.replace("_", " ")}.`,
      });
      setConfirmTarget(null);
    },
    onError: (err: unknown) => {
      toast({
        title: "Échec de la confirmation",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de confirmer la transaction.",
        variant: "destructive",
      });
    },
  });

  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Statut</Label>
            <Select
              value={statut}
              onValueChange={(v) =>
                setStatut(v as "all" | StatutTransactionMomo)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Provider</Label>
            <Select
              value={provider}
              onValueChange={(v) =>
                setProvider(v as "all" | ProviderMomo)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mm-debut" className="text-xs">
              Date début
            </Label>
            <Input
              id="mm-debut"
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              max={dateFin || todayISO()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mm-fin" className="text-xs">
              Date fin
            </Label>
            <Input
              id="mm-fin"
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              min={dateDebut || undefined}
              max={todayISO()}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setStatut("all");
                setProvider("all");
                setDateDebut("");
                setDateFin("");
              }}
            >
              <Filter className="size-3.5" />
              Réinitialiser
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isFetching ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Mise à jour…
            </>
          ) : (
            <>
              <Smartphone className="size-3" />
              {total} transaction(s)
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <Loader2 className={cn("size-3.5", isFetching && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : (result?.data ?? []).length === 0 ? (
            <EmptyState
              title="Aucune transaction"
              message="Aucune transaction Mobile Money ne correspond à vos filtres. Initiez une nouvelle transaction depuis l'onglet dédié."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-4">Date</TableHead>
                    <TableHead>Élève</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(result?.data ?? []).map((tx) => (
                    <TableRow
                      key={tx.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => setSelectedTx(tx)}
                    >
                      <TableCell className="pl-4 text-xs">
                        {formatDateShort(tx.date_initiation)}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {tx.eleve
                          ? `${tx.eleve.prenoms ?? ""} ${tx.eleve.nom ?? ""}`.trim()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <ProviderMomoBadge provider={tx.provider} />
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        {formatFCFA(tx.montant)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {tx.telephone_client || "—"}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate font-mono text-xs">
                        {tx.reference_externe || "—"}
                      </TableCell>
                      <TableCell>
                        <StatutMomoBadge statut={tx.statut} />
                      </TableCell>
                      <TableCell className="text-right">
                        {(tx.statut === "INITIEE" || tx.statut === "EN_COURS") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmTarget(tx);
                            }}
                            className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                          >
                            <CheckCircle2 className="size-3.5" />
                            Confirmer
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isFetching}
          >
            Précédent
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isFetching}
          >
            Suivant
          </Button>
        </div>
      )}

      <TransactionDetailDialog
        transaction={selectedTx}
        onClose={() => setSelectedTx(null)}
      />

      <ConfirmTransactionDialog
        transaction={confirmTarget}
        loading={confirmerMutation.isPending}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={() =>
          confirmTarget && confirmerMutation.mutate(confirmTarget.id)
        }
      />
    </div>
  );
}

function TransactionDetailDialog({
  transaction,
  onClose,
}: {
  transaction: TransactionMomo | null;
  onClose: () => void;
}) {
  if (!transaction) return null;
  return (
    <Dialog open={!!transaction} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Smartphone className="size-5 text-amber-500" />
            Transaction Mobile Money
          </DialogTitle>
          <DialogDescription>
            Réf. {transaction.reference_externe || transaction.id.slice(0, 8)} ·{" "}
            {formatDateTime(transaction.date_initiation)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <DetailRow label="Élève">
              {transaction.eleve
                ? `${transaction.eleve.prenoms ?? ""} ${transaction.eleve.nom ?? ""}`.trim()
                : "—"}
            </DetailRow>
            <DetailRow label="Provider">
              <ProviderMomoBadge provider={transaction.provider} />
            </DetailRow>
            <DetailRow label="Montant">
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                {formatFCFA(transaction.montant)}
              </span>
            </DetailRow>
            <DetailRow label="Téléphone">
              <span className="font-mono text-xs">
                {transaction.telephone_client || "—"}
              </span>
            </DetailRow>
            <DetailRow label="Statut">
              <StatutMomoBadge statut={transaction.statut} />
            </DetailRow>
            <DetailRow label="Paiement rattaché">
              {transaction.paiement_id ? (
                <span className="font-mono text-xs">
                  {transaction.paiement_id.slice(0, 8)}…
                </span>
              ) : (
                "—"
              )}
            </DetailRow>
          </div>

          {transaction.date_confirmation && (
            <DetailRow label="Date confirmation">
              <span className="text-xs">
                {formatDateTime(transaction.date_confirmation)}
              </span>
            </DetailRow>
          )}

          {transaction.erreur && (
            <div className="rounded-md border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-800 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300">
              <AlertCircle className="mr-1 inline size-3" />
              {transaction.erreur}
            </div>
          )}

          {transaction.payload_reponse && (
            <details className="rounded-md border bg-muted/20 p-2 text-xs">
              <summary className="cursor-pointer font-medium">
                Payload de réponse
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px]">
                {transaction.payload_reponse}
              </pre>
            </details>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function ConfirmTransactionDialog({
  transaction,
  loading,
  onCancel,
  onConfirm,
}: {
  transaction: TransactionMomo | null;
  loading: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={!!transaction}
      onOpenChange={(o) => !o && onCancel()}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="size-5 text-emerald-600" />
            Confirmer la transaction ?
          </DialogTitle>
          <DialogDescription>
            {transaction ? (
              <>
                Vous allez simuler la réception du webhook et marquer la
                transaction <strong>{transaction.reference_externe || transaction.id.slice(0, 8)}</strong>{" "}
                comme <strong>réussie</strong>. Un paiement sera généré
                automatiquement et rattaché à l&apos;élève.
              </>
            ) : (
              ""
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Annuler
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Confirmer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Webhooks »
// ─────────────────────────────────────────────────────────────────────────────

function WebhooksPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [reconcileTarget, setReconcileTarget] =
    React.useState<WebhookMomo | null>(null);

  const {
    data: webhooks,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: momoKeys.webhooks(),
    queryFn: fetchWebhooksMomo,
    retry: 1,
    retryDelay: 1500,
  });

  const reconcilierMutation = useMutation({
    mutationFn: (id: string) => reconcilierWebhookMomo(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: momoKeys.all });
      toast({
        title: "Webhook réconcilié",
        description: "Le webhook a été rattaché à la transaction correspondante.",
      });
      setReconcileTarget(null);
    },
    onError: (err: unknown) => {
      toast({
        title: "Échec de la réconciliation",
        description:
          err instanceof Error
            ? err.message
            : "Impossible de réconcilier ce webhook.",
        variant: "destructive",
      });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {webhooks?.length ?? 0} webhook(s) récemment reçus. Les webhooks
          non réconciliés peuvent être rattachés manuellement à une transaction.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <Loader2 className={cn("size-3.5", isFetching && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : (webhooks ?? []).length === 0 ? (
            <EmptyState
              title="Aucun webhook"
              message="Aucun webhook reçu pour le moment. Les notifications des providers Mobile Money apparaîtront ici."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-4">Date réception</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Référence</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(webhooks ?? []).map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="pl-4 text-xs">
                        {formatDateTime(w.date_reception)}
                      </TableCell>
                      <TableCell>
                        <ProviderMomoBadge provider={w.provider} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {w.reference_externe || "—"}
                      </TableCell>
                      <TableCell className="text-xs">{w.statut}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {w.transaction_id ? w.transaction_id.slice(0, 8) + "…" : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {!w.reconcilie ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setReconcileTarget(w)}
                            className="border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-950/30"
                          >
                            <RefreshCw className="size-3.5" />
                            Réconcilier
                          </Button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="size-3" />
                            Réconcilié
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!reconcileTarget}
        onOpenChange={(o) => !o && setReconcileTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <RefreshCw className="size-5 text-amber-500" />
              Réconcilier le webhook ?
            </DialogTitle>
            <DialogDescription>
              {reconcileTarget ? (
                <>
                  Le backend va tenter de rapprocher ce webhook{" "}
                  <strong>{reconcileTarget.reference_externe || "—"}</strong>{" "}
                  d&apos;une transaction existante et, le cas échéant, la
                  marquer comme réussie.
                </>
              ) : (
                ""
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setReconcileTarget(null)}
              disabled={reconcilierMutation.isPending}
            >
              Annuler
            </Button>
            <Button
              onClick={() =>
                reconcileTarget && reconcilierMutation.mutate(reconcileTarget.id)
              }
              disabled={reconcilierMutation.isPending}
              className="bg-amber-500 text-white hover:bg-amber-600"
            >
              {reconcilierMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Réconcilier
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// États partagés
// ─────────────────────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
        <AlertCircle className="size-6" />
      </div>
      <div>
        <p className="text-sm font-medium">Erreur de chargement</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Le backend n&apos;a pas pu répondre. Réessayez ou vérifiez votre
          connexion.
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <Loader2 className="size-3.5" />
        Réessayer
      </Button>
    </div>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
        <CheckCircle2 className="size-6" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-sm text-xs text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
