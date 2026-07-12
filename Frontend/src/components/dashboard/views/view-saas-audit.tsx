"use client";

/**
 * ScolaGest — Vue « Audit » (SUPER_ADMIN, SaaS).
 *
 * Journal d&apos;audit global (cross-tenant) consultable par le SUPER_ADMIN.
 * Filtres disponibles : entité, utilisateur, établissement, plage de dates.
 * Table paginée affichant date, utilisateur, action, entité, établissement,
 * adresse IP et description.
 *
 * Données :
 *  - `GET /api/saas/audit` → fetchSaasAudit
 *  - `GET /api/saas/establishments` → fetchSaasEstablishments (filtre)
 *
 * États : chargement (skeleton), erreur (retry), vide.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ScrollText,
  Loader2,
  AlertCircle,
  Filter,
  CheckCircle2,
  RotateCw,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  saasKeys,
  fetchSaasAudit,
  fetchSaasEstablishments,
  type SaasAuditQueryParams,
  type SaasAuditEntry,
} from "@/lib/api-saas";
import { formatDateTime, todayISO } from "@/lib/format";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { GlassCard } from "@/components/ds/glass-card";
import { StatCard } from "@/components/ds/stat-card";
import { KentePattern } from "@/components/ds/kente-pattern";

const PAGE_SIZE = 20;

const ENTITE_OPTIONS = [
  { value: "all", label: "Toutes entités" },
  { value: "Eleve", label: "Élèves" },
  { value: "Paiement", label: "Paiements" },
  { value: "Frais", label: "Frais" },
  { value: "Echeance", label: "Échéances" },
  { value: "Utilisateur", label: "Utilisateurs" },
  { value: "Etablissement", label: "Établissements" },
  { value: "Cloture", label: "Clôtures" },
  { value: "TransactionMomo", label: "Mobile Money" },
  { value: "EcritureComptable", label: "Écritures compta" },
  { value: "SupportSaaS", label: "Mode support SaaS" },
];

export default function SaasAuditView() {
  const [entite, setEntite] = React.useState<string>("all");
  const [etablissementId, setEtablissementId] = React.useState<string>("all");
  const [dateDebut, setDateDebut] = React.useState("");
  const [dateFin, setDateFin] = React.useState("");
  const [page, setPage] = React.useState(1);

  // Liste des établissements pour le filtre
  const { data: establishments } = useQuery({
    queryKey: saasKeys.establishments(),
    queryFn: fetchSaasEstablishments,
    retry: 1,
    retryDelay: 1500,
  });

  const params: SaasAuditQueryParams = React.useMemo(
    () => ({
      entite: entite !== "all" ? entite : undefined,
      etablissement_id:
        etablissementId !== "all" ? etablissementId : undefined,
      date_debut: dateDebut || undefined,
      date_fin: dateFin || undefined,
      page,
      page_size: PAGE_SIZE,
    }),
    [entite, etablissementId, dateDebut, dateFin, page],
  );

  const {
    data: result,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: saasKeys.audit(params),
    queryFn: () => fetchSaasAudit(params),
    retry: 1,
    retryDelay: 1500,
  });

  React.useEffect(() => {
    setPage(1);
  }, [entite, etablissementId, dateDebut, dateFin]);

  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <KentePattern variant="strip" position="top" />
      {/* En-tête */}
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
          <ScrollText className="size-6" />
        </div>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">
            Journal d&apos;audit global
          </h1>
          <p className="text-sm text-muted-foreground">
            Toutes les actions sensibles journalisées sur la plateforme, tous
            établissements confondus (y compris les activations du mode
            support).
          </p>
        </div>
      </div>

      {/* KPIs synthèse */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Entrées totales"
            value={String(total)}
            hint="Tous filtres confondus"
            icon={ScrollText}
            tone="emerald"
            delay={0}
          />
          <StatCard
            label="Entrées sur cette page"
            value={String(result?.data?.length ?? 0)}
            hint={`Page ${page} / ${totalPages}`}
            icon={Filter}
            tone="amber"
            delay={0.05}
          />
          <StatCard
            label="Pages totales"
            value={String(totalPages)}
            hint={`${PAGE_SIZE} entrées / page`}
            icon={CheckCircle2}
            tone="gold"
            delay={0.1}
          />
        </div>
      )}

      {/* Filtres */}
      <GlassCard variant="adaptive" noHover className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Entité</Label>
            <Select value={entite} onValueChange={setEntite}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Établissement</Label>
            <Select
              value={etablissementId}
              onValueChange={setEtablissementId}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous établissements</SelectItem>
                {(establishments ?? []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aud-debut" className="text-xs">
              Date début
            </Label>
            <Input
              id="aud-debut"
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              max={dateFin || todayISO()}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aud-fin" className="text-xs">
              Date fin
            </Label>
            <Input
              id="aud-fin"
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
                setEntite("all");
                setEtablissementId("all");
                setDateDebut("");
                setDateFin("");
              }}
            >
              <Filter className="size-3.5" />
              Réinitialiser
            </Button>
          </div>
        </div>
      </GlassCard>

      <KentePattern variant="separator" className="my-2" />

      {/* Compteur + actualiser */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isFetching ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Mise à jour…
            </>
          ) : (
            <>
              <ScrollText className="size-3" />
              {total} entrée(s) d&apos;audit
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RotateCw className={cn("size-3.5", isFetching && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      {/* Table */}
      <GlassCard variant="adaptive" noHover className="overflow-hidden p-0">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : (result?.data ?? []).length === 0 ? (
          <EmptyState
            title="Journal d'audit vide"
            message="Aucune entrée ne correspond à vos filtres. Les actions sensibles (création, modification, suppression) sont journalisées automatiquement."
          />
        ) : (
          <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="pl-4">Date</TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entité</TableHead>
                    <TableHead>Établissement</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead className="pr-4">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(result?.data ?? []).map((entry: SaasAuditEntry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="pl-4 text-xs">
                        {formatDateTime(entry.date_action)}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {entry.utilisateur_nom || "Système"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "font-medium",
                            entry.action
                              .toLowerCase()
                              .includes("delete") ||
                              entry.action.toLowerCase().includes("supprim")
                              ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
                              : entry.action
                                      .toLowerCase()
                                      .includes("create") ||
                                    entry.action
                                      .toLowerCase()
                                      .includes("création")
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
                          )}
                        >
                          {entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {entry.entite}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {entry.etablissement_nom ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {entry.adresse_ip ?? "—"}
                      </TableCell>
                      <TableCell className="max-w-[260px] truncate pr-4 text-xs text-muted-foreground">
                        {entry.description ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
      </GlassCard>

      {/* Pagination */}
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
