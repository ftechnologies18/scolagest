"use client";

/**
 * ScolaGest — Reçu imprimable du portail parent (Phase 6 — Refonte Forêt EdTech).
 *
 * Affiche un reçu mis en forme à partir d'un `PaiementParent` (déjà chargé par
 * le portail) et, si le backend le fournit, du snapshot officiel
 * (`fetchRecuParent`). Si le snapshot est indisponible, on construit le reçu
 * depuis les données du paiement.
 *
 * Refonte Forêt EdTech :
 *  - Header premium : badge rond gradient emerald→gold + icône Receipt.
 *  - Reçu premium : GlassCard avec bordure gold/40% (`.kente-border-premium`)
 *    + `.recu-print` intact (impression A4).
 *  - Footer grid-cols-2 + bouton « Imprimer / PDF » variant success.
 *
 * Le bouton « Imprimer / Télécharger PDF » déclenche `window.print()`. La
 * règle `@media print .recu-print` (définie dans `globals.css`) masque tout le
 * reste de la page pour n'imprimer que le reçu.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  GraduationCap,
  Loader2,
  Receipt as ReceiptIcon,
  QrCode,
  CheckCircle2,
  AlertCircle,
  X,
  Calendar,
  Clock,
  Hash,
  User,
  CreditCard,
  type LucideIcon,
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
import { Separator } from "@/components/ui/separator";
import { GlassCard } from "@/components/ds/glass-card";

import { fetchRecuParent, type PaiementParent } from "@/lib/api-parent";
import { useAuthStore } from "@/lib/auth-store";
import {
  formatFCFA,
  formatDateTime,
  formatTime,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RecuSnapshot } from "@/lib/types";

/** Labels des modes de paiement (alignés avec le backend). */
const MODE_LABEL: Record<string, string> = {
  ESPECES: "Espèces",
  CHEQUE: "Chèque",
  VIREMENT: "Virement",
  MOBILE_MONEY: "Mobile Money",
};

function modeBadgeClass(mode: string): string {
  switch (mode) {
    case "ESPECES":
      return "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
    case "CHEQUE":
      return "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200";
    case "MOBILE_MONEY":
      return "border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950/50 dark:text-orange-200";
    case "VIREMENT":
    default:
      return "border-muted-foreground/30 bg-muted text-muted-foreground";
  }
}

function statutLabel(statut: string): string {
  switch (statut) {
    case "VALIDE":
      return "Validé";
    case "ANNULE":
      return "Annulé";
    case "EN_ATTENTE":
      return "En attente";
    default:
      return statut;
  }
}

export interface RecuDialogParentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Paiement déjà chargé par le portail parent. */
  paiement: PaiementParent | null;
}

export function RecuDialogParent({
  open,
  onOpenChange,
  paiement,
}: RecuDialogParentProps) {
  const etablissement = useAuthStore((s) => s.etablissement);

  // Snapshot officiel du reçu (optionnel — on tolère une erreur 404).
  const { data: recu, isLoading: loadingRecu } = useQuery({
    queryKey: ["parent", "recu", paiement?.id] as const,
    queryFn: () => fetchRecuParent(paiement!.id),
    enabled: open && !!paiement?.id,
    retry: 0,
  });

  const snapshot: RecuSnapshot | null = React.useMemo(() => {
    if (recu?.contenu_snapshot) {
      try {
        return JSON.parse(recu.contenu_snapshot) as RecuSnapshot;
      } catch {
        return null;
      }
    }
    return null;
  }, [recu]);

  const isLoading = loadingRecu;
  const numeroRecu = recu?.numero ?? paiement?.numero_recu ?? "—";

  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0 sm:max-w-3xl">
        {/* Header premium : badge rond gradient emerald→gold + Receipt */}
        <DialogHeader className="no-print border-b border-emerald-100 bg-gradient-to-br from-emerald-50 to-amber-50 px-6 py-5 dark:from-emerald-950/20 dark:to-amber-950/10">
          <DialogTitle className="flex items-center gap-3 text-base">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-md shadow-emerald-900/20">
              <ReceiptIcon className="size-5" />
            </span>
            Reçu de paiement
          </DialogTitle>
          <DialogDescription className="ml-[52px] text-xs">
            Reçu généré automatiquement. Vous pouvez l&apos;imprimer ou
            l&apos;enregistrer en PDF via le bouton ci-dessous.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {isLoading || !paiement ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-emerald-600" />
              Chargement du reçu…
            </div>
          ) : (
            <RecuBody
              paiement={paiement}
              snapshot={snapshot}
              numeroRecu={numeroRecu}
              etablissementNom={
                snapshot?.etablissement?.nom ??
                etablissement?.nom ??
                "Établissement"
              }
              etablissementVille={snapshot?.etablissement?.ville}
              etablissementCode={snapshot?.etablissement?.code_officiel}
            />
          )}
        </div>

        {/* Footer grid-cols-2 + bouton Imprimer / PDF variant success */}
        <div className="no-print flex flex-col-reverse gap-2 border-t border-emerald-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="break-words text-[11px] leading-snug text-muted-foreground">
            Astuce : choisissez « Enregistrer en PDF » comme imprimante pour
            générer un fichier PDF.
          </p>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
            >
              <X className="size-4" />
              Fermer
            </Button>
            <Button
              type="button"
              variant="success"
              onClick={handlePrint}
              disabled={isLoading || !paiement}
              className="w-full sm:w-auto"
              title="Imprimer le reçu ou l'enregistrer en PDF"
            >
              <Printer className="size-4" />
              Imprimer / PDF
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Corps du reçu (imprimable) — GlassCard premium avec bordure gold/40%
// ─────────────────────────────────────────────────────────────────────────────

interface RecuBodyProps {
  paiement: PaiementParent;
  snapshot: RecuSnapshot | null;
  numeroRecu: string;
  etablissementNom: string;
  etablissementVille?: string;
  etablissementCode?: string;
}

function RecuBody({
  paiement,
  snapshot,
  numeroRecu,
  etablissementNom,
  etablissementVille,
  etablissementCode,
}: RecuBodyProps) {
  const eleveNomComplet = snapshot?.eleve
    ? `${snapshot.eleve.prenoms ?? ""} ${snapshot.eleve.nom ?? ""}`.trim()
    : `${paiement.eleve_prenoms ?? ""} ${paiement.eleve_nom ?? ""}`.trim();
  const eleveClasse =
    snapshot?.eleve?.classe ?? paiement.classe ?? "—";
  const motif =
    snapshot?.paiement?.motif ??
    paiement.frais_libelle ??
    "Paiement scolaire";
  const montant = snapshot?.paiement?.montant ?? paiement.montant;
  const modePaiement =
    snapshot?.paiement?.mode ?? paiement.mode_paiement ?? "ESPECES";
  const datePaiement = snapshot?.paiement?.date ?? paiement.date_paiement;
  const soldeRestant =
    typeof snapshot?.solde_restant === "number"
      ? snapshot.solde_restant
      : undefined;
  const referenceExterne = snapshot?.paiement?.reference_externe ?? "";
  const providerMomo = snapshot?.paiement?.provider_momo ?? "";

  return (
    <GlassCard
      variant="premium"
      premiumBorder
      noHover
      noAnimation
      className="!p-0 overflow-hidden"
    >
      <div className="recu-print rounded-lg border border-gold/40 bg-white text-foreground">
        {/* En-tête établissement */}
        <div className="flex flex-col gap-3 rounded-t-lg bg-gradient-to-r from-emerald-700 via-emerald-600 to-amber-500 px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-white/15 ring-1 ring-gold/40">
              <GraduationCap className="size-6" />
            </div>
            <div>
              <div className="break-words text-base font-semibold leading-tight">{etablissementNom}</div>
              <div className="break-words text-[11px] leading-snug text-emerald-50">
                {etablissementVille
                  ? `${etablissementVille}, Côte d'Ivoire`
                  : "Côte d'Ivoire"}
                {etablissementCode ? ` · Code ${etablissementCode}` : ""}
              </div>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-[11px] uppercase tracking-wide text-emerald-50">
              Reçu de paiement
            </div>
            <div className="break-all font-mono text-lg font-bold leading-snug">{numeroRecu}</div>
          </div>
        </div>

        <div className="space-y-4 p-6">
          {/* Méta — InfoRows avec icônes */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Meta
              icon={Calendar}
              label="Date"
              value={formatDateTime(datePaiement).split(" à ")[0]}
            />
            <Meta
              icon={Clock}
              label="Heure"
              value={formatTime(datePaiement)}
            />
            <Meta
              icon={Calendar}
              label="Émis le"
              value={formatDateTime(datePaiement).split(" à ")[0]}
            />
            <Meta
              icon={CheckCircle2}
              label="Statut"
              value={statutLabel(paiement.statut)}
            />
          </div>

          <Separator />

          {/* Élève + Réf. reçu — InfoRows avec icônes */}
          <div className="grid gap-3 md:grid-cols-2">
            <InfoRow icon={User} label="Élève">
              <div className="break-words font-semibold leading-snug">{eleveNomComplet}</div>
              <div className="break-words text-xs leading-snug text-muted-foreground">{eleveClasse}</div>
            </InfoRow>
            <InfoRow icon={Hash} label="Réf. reçu">
              <div className="break-all font-mono font-semibold leading-snug">{numeroRecu}</div>
              <div className="break-words text-xs leading-snug text-muted-foreground">
                Conservez ce numéro pour toute réclamation.
              </div>
            </InfoRow>
          </div>

          {/* Détail du paiement */}
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-emerald-50/60 text-[11px] uppercase tracking-wide text-muted-foreground dark:bg-emerald-950/30">
                <tr>
                  <th className="px-3 py-2 text-left">Désignation</th>
                  <th className="px-3 py-2 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-emerald-100 dark:border-emerald-900/30">
                  <td className="px-3 py-2 break-words font-medium leading-snug">{motif}</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold leading-snug">
                    {formatFCFA(montant)}
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-emerald-50 dark:bg-emerald-950/30">
                <tr className="border-t border-emerald-200 dark:border-emerald-900/40">
                  <td className="px-3 py-2 font-semibold">Total encaissé</td>
                  <td className="px-3 py-2 text-right text-lg font-bold text-gold-dark leading-snug">
                    {formatFCFA(montant)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mode + solde — InfoRows avec icônes */}
          <div className="grid gap-3 md:grid-cols-2">
            <InfoRow icon={CreditCard} label="Mode de paiement">
              <div className="flex items-center justify-between">
                <span className="break-words font-semibold leading-snug">
                  {MODE_LABEL[modePaiement] ?? modePaiement}
                </span>
                <Badge
                  variant="outline"
                  className={cn("font-medium", modeBadgeClass(modePaiement))}
                >
                  {MODE_LABEL[modePaiement] ?? modePaiement}
                </Badge>
              </div>
              <div className="mt-1 break-all text-xs leading-snug text-muted-foreground">
                Référence : {referenceExterne || "—"}
                {providerMomo ? ` · ${providerMomo}` : ""}
              </div>
            </InfoRow>
            <div
              className={cn(
                "rounded-lg border p-3 text-sm",
                soldeRestant === undefined
                  ? "border-muted-foreground/20 bg-muted/20"
                  : soldeRestant > 0
                    ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20"
                    : "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20",
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-1.5 text-[11px] uppercase tracking-wide",
                  soldeRestant === undefined
                    ? "text-muted-foreground"
                    : soldeRestant > 0
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-emerald-700 dark:text-emerald-300",
                )}
              >
                {soldeRestant === undefined ? (
                  <CheckCircle2 className="size-3.5" />
                ) : soldeRestant > 0 ? (
                  <AlertCircle className="size-3.5" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                {soldeRestant === undefined
                  ? "Paiement enregistré"
                  : soldeRestant > 0
                    ? "Solde restant dû"
                    : "Solde soldé"}
              </div>
              <div
                className={cn(
                  "mt-0.5 break-words text-lg font-bold leading-snug",
                  soldeRestant === undefined
                    ? ""
                    : soldeRestant > 0
                      ? "text-gold-dark"
                      : "text-emerald-700 dark:text-emerald-300",
                )}
              >
                {soldeRestant === undefined
                  ? "Merci !"
                  : formatFCFA(soldeRestant)}
              </div>
              {soldeRestant !== undefined && soldeRestant > 0 ? (
                <div className="break-words text-xs leading-snug text-amber-700 dark:text-amber-400">
                  Pensez à régulariser avant la prochaine échéance.
                </div>
              ) : null}
            </div>
          </div>

          {/* Pied + QR */}
          <div className="flex items-end justify-between gap-4 pt-2">
            <div className="break-words text-[11px] leading-snug text-muted-foreground">
              <div className="flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-3.5" />
                Document généré électroniquement par ScolaGest
              </div>
              <div className="mt-1">
                Reçu valable comme justificatif de paiement. Conservez-le
                précieusement.
              </div>
              <div className="mt-2 italic">Merci de votre confiance.</div>
            </div>
            <div className="flex size-20 flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-900/40">
              <QrCode className="size-9" />
              <span className="text-[9px]">QR vérification</span>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Portail Parent · ScolaGest</span>
            <span>ScolaGest · www.scolagest.ci</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

function Meta({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0">
        <div className="break-words text-[11px] uppercase text-muted-foreground">{label}</div>
        <div className="break-words font-medium leading-snug">{value}</div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 dark:border-emerald-900/30 dark:bg-emerald-950/20">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5 text-emerald-600" />
        {label}
      </div>
      <div className="mt-1 break-words text-sm leading-snug text-foreground">
        {children}
      </div>
    </div>
  );
}

/** Petit wrapper pour l'icône AlertCircle quand le solde restant est > 0. */
// (Note : on utilise AlertCircle de lucide-react directement ci-dessus.)
