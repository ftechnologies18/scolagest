"use client";

/**
 * ScolaGest — Historique des paiements (Phase 3).
 *
 * Tableau paginé des encaissements avec filtres :
 *  - plage de dates (date_debut / date_fin)
 *  - caissier (filtre "moi uniquement")
 *  - mode de paiement
 *
 * Colonnes : date, n° reçu, élève, motif, montant, mode, caissier, statut.
 * Clic sur une ligne → ouverture du reçu imprimable.
 * Action « Annuler » (avec motif) pour les paiements VALIDE ; réservée aux
 * rôles CAISSIER / DIRECTION / COMPTABLE.
 *
 * États : chargement (skeleton), vide, erreur.
 */

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  History,
  Loader2,
  AlertCircle,
  XCircle,
  Eye,
  Receipt as ReceiptIcon,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import {
  fetchPaiements,
  annulerPaiement,
  paiementsKeys,
} from "@/lib/api-caisse";
import { useToast } from "@/hooks/use-toast";
import {
  formatFCFA,
  formatDateShort,
  formatTime,
  todayISO,
} from "@/lib/format";
import type { ModePaiement, Paiement, PaiementsQueryParams } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  ModePaiementBadge,
  StatutPaiementBadge,
} from "./caisse-badges";
import { RecuDialog } from "./recu-dialog";

const PAGE_SIZE = 20;

const MODE_FILTER_OPTIONS: { value: "all" | ModePaiement; label: string }[] = [
  { value: "all", label: "Tous modes" },
  { value: "ESPECES", label: "Espèces" },
  { value: "CHEQUE", label: "Chèque" },
  { value: "VIREMENT", label: "Virement" },
  { value: "MOBILE_MONEY", label: "Mobile Money" },
];

export function PaiementsList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // Filtres
  const [dateDebut, setDateDebut] = React.useState<string>("");
  const [dateFin, setDateFin] = React.useState<string>("");
  const [mode, setMode] = React.useState<"all" | ModePaiement>("all");
  const [moiOnly, setMoiOnly] = React.useState(false);
  const [page, setPage] = React.useState(1);

  // Ligne sélectionnée (reçu)
  const [recuPaiementId, setRecuPaiementId] = React.useState<string | null>(
    null,
  );

  // Annulation
  const [annulationId, setAnnulationId] = React.useState<string | null>(null);
  const [motifAnnulation, setMotifAnnulation] = React.useState("");

  const params: PaiementsQueryParams = React.useMemo(
    () => ({
      date_debut: dateDebut || undefined,
      date_fin: dateFin || undefined,
      mode: mode !== "all" ? mode : undefined,
      caissier_id: moiOnly && user?.id ? user.id : undefined,
      page,
      page_size: PAGE_SIZE,
    }),
    [dateDebut, dateFin, mode, moiOnly, user?.id, page],
  );

  const {
    data,
    isLoading,
    isError,
    isFetching,
  } = useQuery({
    queryKey: paiementsKeys.list(params),
    queryFn: () => fetchPaiements(params),
  });

  const paiements = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ─── Reset page on filter change ─────────────────────────────────────────
  React.useEffect(() => {
    setPage(1);
  }, [dateDebut, dateFin, mode, moiOnly]);

  // ─── Annulation ─────────────────────────────────────────────────────────
  const annulerMutation = useMutation({
    mutationFn: (id: string) => annulerPaiement(id, motifAnnulation.trim()),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: paiementsKeys.all });
      toast({
        title: "Paiement annulé",
        description: "Le paiement a été marqué comme annulé.",
      });
      setAnnulationId(null);
      setMotifAnnulation("");
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error
            ? err.message
            : "Impossible d'annuler ce paiement.",
        variant: "destructive",
      });
    },
  });

  function handleOpenAnnulation(id: string) {
    setMotifAnnulation("");
    setAnnulationId(id);
  }

  function handleConfirmAnnulation() {
    if (!annulationId) return;
    if (motifAnnulation.trim().length < 3) {
      toast({
        title: "Motif obligatoire",
        description: "Indiquez un motif d'annulation (3 caractères min.).",
        variant: "destructive",
      });
      return;
    }
    annulerMutation.mutate(annulationId);
  }

  return (
    <div className="space-y-4">
      {/* Filtres */}
      <GlassCard variant="adaptive" noHover className="p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="date-debut" className="text-xs">
              Date début
            </Label>
            <Input
              id="date-debut"
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
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
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              min={dateDebut || undefined}
              max={todayISO()}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Mode</Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as "all" | ModePaiement)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODE_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Caissier</Label>
            <Select
              value={moiOnly ? "me" : "all"}
              onValueChange={(v) => setMoiOnly(v === "me")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous caissiers</SelectItem>
                <SelectItem value="me">Mes encaissements</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </GlassCard>

      <KentePattern variant="separator" />

      {/* Tableau */}
      <GlassCard variant="adaptive" noHover className="overflow-hidden p-0">
        <div>
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                <AlertCircle className="size-6" />
              </div>
              <p className="text-sm font-medium">Erreur de chargement</p>
              <p className="max-w-md text-xs text-muted-foreground">
                Vérifiez que le backend est démarré puis réessayez.
              </p>
            </div>
          ) : paiements.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <History className="size-6" />
              </div>
              <p className="text-sm font-medium">Aucun paiement</p>
              <p className="max-w-md text-xs text-muted-foreground">
                Aucun encaissement ne correspond à vos filtres. Modifiez les
                critères ou encaissez un premier paiement dans l&apos;onglet
                « Encaissement ».
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="pl-4">Date</TableHead>
                      <TableHead>Reçu</TableHead>
                      <TableHead>Élève</TableHead>
                      <TableHead>Motif</TableHead>
                      <TableHead className="text-right">Montant</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Caissier</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="pr-4 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paiements.map((p) => (
                      <PaiementRow
                        key={p.id}
                        paiement={p}
                        onOpenRecu={() => setRecuPaiementId(p.id)}
                        onAnnuler={() => handleOpenAnnulation(p.id)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile cards */}
              <ul className="divide-y md:hidden">
                {paiements.map((p) => (
                  <PaiementMobileCard
                    key={p.id}
                    paiement={p}
                    onOpenRecu={() => setRecuPaiementId(p.id)}
                    onAnnuler={() => handleOpenAnnulation(p.id)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      </GlassCard>

      {/* Pagination */}
      {total > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {isFetching ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Mise à jour…
              </span>
            ) : (
              <>
                {total} paiement{total > 1 ? "s" : ""} · page {page} /{" "}
                {totalPages}
              </>
            )}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || isFetching}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="size-4" />
              Précédent
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || isFetching}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Suivant
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}

      {/* Reçu dialog */}
      <RecuDialog
        open={!!recuPaiementId}
        onOpenChange={(o) => !o && setRecuPaiementId(null)}
        paiementId={recuPaiementId ?? undefined}
      />

      {/* Annulation dialog */}
      <Dialog
        open={!!annulationId}
        onOpenChange={(o) => !o && setAnnulationId(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="size-5 text-rose-600" />
              Annuler le paiement
            </DialogTitle>
            <DialogDescription>
              Cette action marque le paiement comme annulé. Le montant annulé
              sera déduit des totaux de caisse. Un motif est obligatoire.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="motif-annulation">Motif d&apos;annulation</Label>
            <Textarea
              id="motif-annulation"
              rows={3}
              value={motifAnnulation}
              onChange={(e) => setMotifAnnulation(e.target.value)}
              placeholder="Ex. Erreur de saisie — doublon avec reçu REC-…"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAnnulationId(null)}
              disabled={annulerMutation.isPending}
            >
              Fermer
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmAnnulation}
              disabled={annulerMutation.isPending}
            >
              {annulerMutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Annulation…
                </>
              ) : (
                <>
                  <XCircle className="size-4" />
                  Confirmer l&apos;annulation
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ligne desktop
// ─────────────────────────────────────────────────────────────────────────────

function PaiementRow({
  paiement,
  onOpenRecu,
  onAnnuler,
}: {
  paiement: Paiement;
  onOpenRecu: () => void;
  onAnnuler: () => void;
}) {
  const motif =
    paiement.frais?.libelle ??
    paiement.echeance?.libelle ??
    "Paiement scolaire";
  const eleveLabel = paiement.eleve
    ? [paiement.eleve.prenoms, paiement.eleve.nom].filter(Boolean).join(" ")
    : "—";
  const caissierLabel = paiement.caissier
    ? `${paiement.caissier.prenoms ?? ""} ${paiement.caissier.nom ?? ""}`.trim()
    : "—";

  return (
    <TableRow
      className={cn(
        "cursor-pointer hover:bg-muted/40",
        paiement.statut === "ANNULE" && "opacity-60",
      )}
      onClick={onOpenRecu}
    >
      <TableCell className="pl-4">
        <div className="flex flex-col">
          <span className="text-xs font-medium">
            {formatDateShort(paiement.date_paiement)}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {formatTime(paiement.date_paiement)}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <span className="font-mono text-xs font-medium">
          {paiement.numero_recu}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="text-xs font-medium">{eleveLabel}</span>
          {paiement.eleve?.inscription_courante?.classe_libelle ? (
            <span className="text-[10px] text-muted-foreground">
              {paiement.eleve.inscription_courante.classe_libelle}
            </span>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-xs">{motif}</TableCell>
      <TableCell className="text-right font-mono text-xs font-semibold">
        {formatFCFA(paiement.montant)}
      </TableCell>
      <TableCell>
        <ModePaiementBadge mode={paiement.mode_paiement} />
      </TableCell>
      <TableCell className="text-xs">{caissierLabel}</TableCell>
      <TableCell>
        <StatutPaiementBadge statut={paiement.statut} />
      </TableCell>
      <TableCell className="pr-4 text-right" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onOpenRecu}
            aria-label="Voir le reçu"
          >
            <Eye className="size-3.5" />
          </Button>
          {paiement.statut === "VALIDE" ? (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-rose-600 hover:bg-rose-50"
              onClick={onAnnuler}
              aria-label="Annuler le paiement"
            >
              <XCircle className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carte mobile
// ─────────────────────────────────────────────────────────────────────────────

function PaiementMobileCard({
  paiement,
  onOpenRecu,
  onAnnuler,
}: {
  paiement: Paiement;
  onOpenRecu: () => void;
  onAnnuler: () => void;
}) {
  const motif =
    paiement.frais?.libelle ??
    paiement.echeance?.libelle ??
    "Paiement scolaire";
  const eleveLabel = paiement.eleve
    ? [paiement.eleve.prenoms, paiement.eleve.nom].filter(Boolean).join(" ")
    : "—";
  const caissierLabel = paiement.caissier
    ? `${paiement.caissier.prenoms ?? ""} ${paiement.caissier.nom ?? ""}`.trim()
    : "—";
  return (
    <li
      className="cursor-pointer p-3 hover:bg-muted/40"
      onClick={onOpenRecu}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{eleveLabel}</p>
          <p className="truncate text-xs text-muted-foreground">{motif}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="font-mono">{paiement.numero_recu}</span>
            <span>·</span>
            <span>
              {formatDateShort(paiement.date_paiement)}{" "}
              {formatTime(paiement.date_paiement)}
            </span>
            <span>·</span>
            <span>{caissierLabel}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-300">
            {formatFCFA(paiement.montant)}
          </span>
          <StatutPaiementBadge statut={paiement.statut} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <ModePaiementBadge mode={paiement.mode_paiement} />
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={onOpenRecu}
          >
            <ReceiptIcon className="size-3.5" />
            Reçu
          </Button>
          {paiement.statut === "VALIDE" ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-rose-600 hover:bg-rose-50"
              onClick={onAnnuler}
            >
              <XCircle className="size-3.5" />
              Annuler
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
