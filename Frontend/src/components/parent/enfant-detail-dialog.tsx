"use client";

/**
 * ScolaGest — Dialogue de détail du solde d'un enfant (Portail parent — Phase 6 — Refonte Forêt EdTech).
 *
 * Affiche pour un enfant donné :
 *   - En-tête premium : badge rond gradient emerald→gold avec icône User,
 *     avatar élève ring gold, nom + classe + catégorie + établissement,
 *     badge « À jour » / « Solde à régulariser ».
 *   - GlassCard tablet pour le contenu : solde (3 mini-cards), frais attendus
 *     (tableau avec header bg-emerald-50/60), échéances à venir (tableau).
 *   - Boutons d'action : « Payer en ligne » variant success + « Voir
 *     historique » variant outline + « Fermer ».
 *
 * Le détail est chargé via `fetchSoldeEnfant(enfant.id)` au moment de l'ouverture
 * du dialogue. Le bouton « Voir l'historique » déclenche le callback
 * `onVoirHistorique` (le parent est redirigé vers la section Historique du
 * portail, pré-filtré sur cet enfant).
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  Wallet,
  GraduationCap,
  CalendarClock,
  History,
  CheckCircle2,
  AlertTriangle,
  User,
  Smartphone,
  X,
  School,
  Layers,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GlassCard } from "@/components/ds/glass-card";

import { fetchSoldeEnfant, type EnfantParent } from "@/lib/api-parent";
import { formatFCFA, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

function initials(nom?: string, prenoms?: string): string {
  const a = (nom ?? "").trim().charAt(0);
  const b = (prenoms ?? "").trim().charAt(0);
  return (a + b).toUpperCase() || "?";
}

function categorieLabel(cat: string): string {
  switch (cat) {
    case "AFFECTE":
      return "Affecté";
    case "NON_AFFECTE":
      return "Non affecté";
    case "NON_APPLICABLE":
      return "—";
    default:
      return cat;
  }
}

function typeFraisLabel(type: string): string {
  switch (type) {
    case "INSCRIPTION":
      return "Inscription";
    case "SCOLARITE":
      return "Scolarité";
    case "EXAMEN":
      return "Examen";
    case "ANNEXE":
      return "Annexe";
    default:
      return type;
  }
}

function statutEcheanceLabel(statut: string): string {
  switch (statut) {
    case "PAYE":
      return "Payée";
    case "PARTIEL":
      return "Partielle";
    case "EN_RETARD":
      return "En retard";
    case "A_VENIR":
      return "À venir";
    default:
      return statut;
  }
}

function statutEcheanceClass(statut: string): string {
  switch (statut) {
    case "PAYE":
      return "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
    case "PARTIEL":
      return "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200";
    case "EN_RETARD":
      return "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200";
    case "A_VENIR":
    default:
      return "border-muted-foreground/30 bg-muted text-muted-foreground";
  }
}

export interface EnfantDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enfant: EnfantParent | null;
  /** Appelé quand le parent clique sur « Voir l'historique ». */
  onVoirHistorique: (enfant: EnfantParent) => void;
  /** Appelé quand le parent clique sur « Payer en ligne ». */
  onPayerEnLigne?: (enfant: EnfantParent) => void;
}

export function EnfantDetailDialog({
  open,
  onOpenChange,
  enfant,
  onVoirHistorique,
  onPayerEnLigne,
}: EnfantDetailDialogProps) {
  const { data: solde, isLoading } = useQuery({
    queryKey: ["parent", "solde", enfant?.id] as const,
    queryFn: () => fetchSoldeEnfant(enfant!.id),
    enabled: open && !!enfant?.id,
    retry: 1,
    retryDelay: 1500,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl gap-0 overflow-hidden p-0 sm:max-w-4xl">
        {/* Header premium : badge rond gradient emerald→gold + icône User */}
        <DialogHeader className="border-b border-emerald-100 bg-gradient-to-br from-emerald-50 to-amber-50 px-6 py-5 dark:from-emerald-950/20 dark:to-amber-950/10">
          <DialogTitle className="flex items-center gap-3 text-base">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-md shadow-emerald-900/20">
              <User className="size-5" />
            </span>
            Détail du compte de mon enfant
          </DialogTitle>
          <DialogDescription className="ml-[52px] text-xs">
            Synthèse des frais attendus, des paiements effectués et des
            échéances à venir pour l&apos;année scolaire en cours.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {isLoading || !enfant ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-emerald-600" />
              Chargement du solde…
            </div>
          ) : (
            <DetailBody
              enfant={enfant}
              solde={solde}
              onClose={() => onOpenChange(false)}
              onVoirHistorique={() => {
                onOpenChange(false);
                onVoirHistorique(enfant);
              }}
              onPayerEnLigne={
                onPayerEnLigne
                  ? () => {
                      onOpenChange(false);
                      onPayerEnLigne(enfant);
                    }
                  : undefined
              }
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Corps du dialogue
// ─────────────────────────────────────────────────────────────────────────────

interface DetailBodyProps {
  enfant: EnfantParent;
  solde:
    | {
        frais_attendus: Array<{
          frais_id: string;
          type_frais: string;
          libelle: string;
          montant_attendu: number;
          montant_paye: number;
          solde: number;
        }>;
        total_attendu: number;
        total_paye: number;
        solde_du: number;
        echeances_a_venir: Array<{
          echeance_id: string;
          rang: number;
          libelle: string;
          montant: number;
          date_limite: string;
          montant_paye: number;
          statut: string;
        }>;
      }
    | undefined;
  onClose: () => void;
  onVoirHistorique: () => void;
  onPayerEnLigne?: () => void;
}

function DetailBody({ enfant, solde, onClose, onVoirHistorique, onPayerEnLigne }: DetailBodyProps) {
  const soldeDu = solde?.solde_du ?? enfant.solde.solde_du;
  const totalAttendu = solde?.total_attendu ?? enfant.solde.total_attendu;
  const totalPaye = solde?.total_paye ?? enfant.solde.total_paye;
  const soldeOK = soldeDu <= 0;

  return (
    <div className="space-y-5">
      {/* En-tête élève — avatar ring gold + badges renforcés */}
      <GlassCard
        variant="tablet"
        noHover
        noAnimation
        className="!p-4"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Avatar className="size-16 ring-2 ring-gold/60">
            <AvatarFallback className="bg-emerald-600 text-xl font-bold text-white">
              {initials(enfant.nom, enfant.prenoms)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="break-words text-lg font-bold leading-tight">
                {enfant.prenoms} {enfant.nom}
              </h3>
              {enfant.classe_actuelle ? (
                <Badge className="inline-flex items-center gap-1 border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                  <School className="size-3" />
                  {enfant.classe_actuelle}
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-muted-foreground/30 text-muted-foreground"
                >
                  Non inscrit·e
                </Badge>
              )}
              {enfant.categorie && enfant.categorie !== "NON_APPLICABLE" && (
                <Badge
                  variant="outline"
                  className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                >
                  <Layers className="size-3" />
                  {categorieLabel(enfant.categorie)}
                </Badge>
              )}
            </div>
            <div className="mt-1 break-words text-sm leading-snug text-muted-foreground">
              {enfant.etablissement?.nom ?? "Établissement"}
              {enfant.etablissement?.ville
                ? ` · ${enfant.etablissement.ville}`
                : ""}
              {enfant.matricule_ministere
                ? ` · Mat. ${enfant.matricule_ministere}`
                : enfant.identifiant_interne
                  ? ` · ${enfant.identifiant_interne}`
                  : ""}
            </div>
          </div>
          <div className="flex-shrink-0">
            {soldeOK ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-2 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                <CheckCircle2 className="size-4" />
                <span className="text-sm font-semibold">À jour</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                <AlertTriangle className="size-4" />
                <span className="text-sm font-semibold">Solde à régulariser</span>
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* KPI synthèse — 3 mini-cards dans une GlassCard tablet */}
      <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-3">
        <KpiCard
          label="Total attendu"
          value={formatFCFA(totalAttendu)}
          icon={<Wallet className="size-4" />}
          tone="neutral"
        />
        <KpiCard
          label="Total payé"
          value={formatFCFA(totalPaye)}
          icon={<CheckCircle2 className="size-4" />}
          tone="emerald"
        />
        <KpiCard
          label="Solde dû"
          value={formatFCFA(soldeDu)}
          icon={<AlertTriangle className="size-4" />}
          tone={soldeOK ? "emerald" : "amber"}
        />
      </div>

      <Separator />

      {/* Frais attendus — GlassCard tablet + tableau premium */}
      <GlassCard variant="tablet" noHover noAnimation className="!p-0 overflow-hidden">
        <div className="border-b border-emerald-100 bg-emerald-50/60 px-4 py-2.5 dark:bg-emerald-950/30">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <Wallet className="size-4 text-emerald-600" />
            Frais attendus pour l&apos;année
          </h4>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-emerald-100 bg-emerald-50/40 hover:bg-emerald-50/40 dark:bg-emerald-950/20">
              <TableHead>Type</TableHead>
              <TableHead>Libellé</TableHead>
              <TableHead className="text-right">Attendu</TableHead>
              <TableHead className="text-right">Payé</TableHead>
              <TableHead className="text-right">Solde</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {solde?.frais_attendus && solde.frais_attendus.length > 0 ? (
              solde.frais_attendus.map((f) => (
                <TableRow
                  key={f.frais_id}
                  className="border-emerald-100/60 hover:bg-emerald-50/60 dark:border-emerald-900/30 dark:hover:bg-emerald-950/20"
                >
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="border-emerald-300 bg-emerald-100 font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                    >
                      {typeFraisLabel(f.type_frais)}
                    </Badge>
                  </TableCell>
                  <TableCell className="break-words font-medium leading-snug">
                    {f.libelle}
                  </TableCell>
                  <TableCell className="text-right font-mono leading-snug">
                    {formatFCFA(f.montant_attendu)}
                  </TableCell>
                  <TableCell className="text-right font-mono leading-snug text-emerald-700 dark:text-emerald-300">
                    {formatFCFA(f.montant_paye)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-mono font-semibold leading-snug",
                      f.solde > 0
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-emerald-700 dark:text-emerald-300",
                    )}
                  >
                    {formatFCFA(f.solde)}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  Aucun frais enregistré pour cette année.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </GlassCard>

      {/* Échéances à venir — GlassCard tablet + tableau premium */}
      <GlassCard variant="tablet" noHover noAnimation className="!p-0 overflow-hidden">
        <div className="border-b border-amber-100 bg-amber-50/60 px-4 py-2.5 dark:bg-amber-950/30">
          <h4 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="size-4 text-amber-600" />
            Échéances à venir
          </h4>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-amber-100 bg-amber-50/40 hover:bg-amber-50/40 dark:bg-amber-950/20">
              <TableHead>Libellé</TableHead>
              <TableHead>Date limite</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead className="text-right">Payé</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {solde?.echeances_a_venir && solde.echeances_a_venir.length > 0 ? (
              solde.echeances_a_venir.map((e) => (
                <TableRow
                  key={e.echeance_id}
                  className="border-amber-100/60 hover:bg-amber-50/60 dark:border-amber-900/30 dark:hover:bg-amber-950/20"
                >
                  <TableCell className="break-words font-medium leading-snug">
                    {e.libelle}
                  </TableCell>
                  <TableCell className="break-words leading-snug">
                    {formatDate(e.date_limite)}
                  </TableCell>
                  <TableCell className="text-right font-mono leading-snug">
                    {formatFCFA(e.montant)}
                  </TableCell>
                  <TableCell className="text-right font-mono leading-snug text-emerald-700 dark:text-emerald-300">
                    {formatFCFA(e.montant_paye)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("font-medium", statutEcheanceClass(e.statut))}
                    >
                      {statutEcheanceLabel(e.statut)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  Aucune échéance planifiée.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </GlassCard>

      {/* Boutons d'action : Payer en ligne (variant success) + Voir historique (outline) + Fermer */}
      <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="w-full sm:w-auto"
        >
          <X className="size-4" />
          Fermer
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onVoirHistorique}
          title="Voir l'historique des paiements de cet enfant"
          className="w-full border-emerald-300 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/30 sm:w-auto"
        >
          <History className="size-4" />
          Voir l&apos;historique
        </Button>
        {onPayerEnLigne ? (
          <Button
            type="button"
            variant="success"
            onClick={onPayerEnLigne}
            disabled={soldeOK}
            title={
              soldeOK
                ? "Aucun solde dû — paiement inutile"
                : "Payer en ligne via Mobile Money"
            }
            className="w-full sm:w-auto"
          >
            <Smartphone className="size-4" />
            Payer en ligne
          </Button>
        ) : null}
      </DialogFooter>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI card
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone: "neutral" | "emerald" | "amber";
}) {
  return (
    <GlassCard
      variant="adaptive"
      noHover
      noAnimation
      className={cn(
        "!p-4",
        tone === "emerald" && "ring-1 ring-emerald-200/60 dark:ring-emerald-900/40",
        tone === "amber" && "ring-1 ring-amber-200/60 dark:ring-amber-900/40",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 text-[11px] uppercase tracking-wide",
          tone === "emerald" && "text-emerald-700 dark:text-emerald-300",
          tone === "amber" && "text-amber-700 dark:text-amber-300",
          tone === "neutral" && "text-muted-foreground",
        )}
      >
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "mt-1 break-words font-mono text-xl font-bold leading-snug",
          tone === "emerald" && "text-emerald-800 dark:text-emerald-300",
          tone === "amber" && "text-amber-800 dark:text-amber-300",
        )}
      >
        {value}
      </div>
    </GlassCard>
  );
}
