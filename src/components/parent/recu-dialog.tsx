"use client";

/**
 * ScolaGest — Reçu imprimable du portail parent (Phase 6).
 *
 * Affiche un reçu mis en forme à partir d'un `PaiementParent` (déjà chargé par
 * le portail) et, si le backend le fournit, du snapshot officiel
 * (`fetchRecuParent`). Si le snapshot est indisponible, on construit le reçu
 * depuis les données du paiement.
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
  X,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

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
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "CHEQUE":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300";
    case "MOBILE_MONEY":
      return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300";
    case "VIREMENT":
    default:
      return "border-muted-foreground/20 bg-muted text-muted-foreground";
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
        <DialogHeader className="no-print border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <ReceiptIcon className="size-5 text-emerald-600" />
            Reçu de paiement
          </DialogTitle>
          <DialogDescription className="text-xs">
            Reçu généré automatiquement. Vous pouvez l&apos;imprimer ou
            l&apos;enregistrer en PDF via le bouton ci-dessous.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {isLoading || !paiement ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
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

        <div className="no-print flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-muted-foreground">
            Astuce : choisissez « Enregistrer en PDF » comme imprimante pour
            générer un fichier PDF.
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
            >
              <X className="size-4" />
              Fermer
            </Button>
            <Button
              type="button"
              onClick={handlePrint}
              disabled={isLoading || !paiement}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Printer className="size-4" />
              Imprimer / Télécharger PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Corps du reçu (imprimable)
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
    <div className="recu-print rounded-lg border bg-white text-foreground">
      {/* En-tête établissement */}
      <div className="flex flex-col gap-3 rounded-t-lg bg-emerald-700 px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-white/15">
            <GraduationCap className="size-6" />
          </div>
          <div>
            <div className="text-base font-semibold">{etablissementNom}</div>
            <div className="text-[11px] text-emerald-100">
              {etablissementVille
                ? `${etablissementVille}, Côte d'Ivoire`
                : "Côte d'Ivoire"}
              {etablissementCode ? ` · Code ${etablissementCode}` : ""}
            </div>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-[11px] uppercase tracking-wide text-emerald-100">
            Reçu de paiement
          </div>
          <div className="font-mono text-lg font-bold">{numeroRecu}</div>
        </div>
      </div>

      <div className="space-y-4 p-6">
        {/* Méta */}
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Meta
            label="Date"
            value={formatDateTime(datePaiement).split(" à ")[0]}
          />
          <Meta label="Heure" value={formatTime(datePaiement)} />
          <Meta
            label="Émis le"
            value={formatDateTime(datePaiement).split(" à ")[0]}
          />
          <Meta label="Statut" value={statutLabel(paiement.statut)} />
        </div>

        <Separator />

        {/* Élève */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="text-[11px] uppercase text-muted-foreground">
              Élève
            </div>
            <div className="font-semibold">{eleveNomComplet}</div>
            <div className="text-xs text-muted-foreground">{eleveClasse}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-[11px] uppercase text-muted-foreground">
              Réf. reçu
            </div>
            <div className="font-mono font-semibold">{numeroRecu}</div>
            <div className="text-xs text-muted-foreground">
              Conservez ce numéro pour toute réclamation.
            </div>
          </div>
        </div>

        {/* Détail du paiement */}
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Désignation</th>
                <th className="px-3 py-2 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-3 py-2 font-medium">{motif}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">
                  {formatFCFA(montant)}
                </td>
              </tr>
            </tbody>
            <tfoot className="bg-emerald-50 dark:bg-emerald-950/30">
              <tr className="border-t">
                <td className="px-3 py-2 font-semibold">Total encaissé</td>
                <td className="px-3 py-2 text-right text-lg font-bold text-emerald-800 dark:text-emerald-300">
                  {formatFCFA(montant)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mode + solde */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-3 text-sm">
            <div className="text-[11px] uppercase text-muted-foreground">
              Mode de paiement
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold">
                {MODE_LABEL[modePaiement] ?? modePaiement}
              </span>
              <Badge
                variant="outline"
                className={cn("font-medium", modeBadgeClass(modePaiement))}
              >
                {MODE_LABEL[modePaiement] ?? modePaiement}
              </Badge>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Référence : {referenceExterne || "—"}
              {providerMomo ? ` · ${providerMomo}` : ""}
            </div>
          </div>
          <div
            className={cn(
              "rounded-lg border p-3 text-sm",
              soldeRestant === undefined
                ? ""
                : soldeRestant > 0
                  ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20"
                  : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20",
            )}
          >
            <div
              className={cn(
                "text-[11px] uppercase",
                soldeRestant === undefined
                  ? "text-muted-foreground"
                  : soldeRestant > 0
                    ? "text-amber-700"
                    : "text-emerald-700",
              )}
            >
              {soldeRestant === undefined
                ? "Paiement enregistré"
                : soldeRestant > 0
                  ? "Solde restant dû"
                  : "Solde soldé"}
            </div>
            <div
              className={cn(
                "text-lg font-bold",
                soldeRestant === undefined
                  ? ""
                  : soldeRestant > 0
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-emerald-800 dark:text-emerald-300",
              )}
            >
              {soldeRestant === undefined
                ? "Merci !"
                : formatFCFA(soldeRestant)}
            </div>
            {soldeRestant !== undefined && soldeRestant > 0 ? (
              <div className="text-xs text-amber-700 dark:text-amber-400">
                Pensez à régulariser avant la prochaine échéance.
              </div>
            ) : null}
          </div>
        </div>

        {/* Pied + QR */}
        <div className="flex items-end justify-between gap-4 pt-2">
          <div className="text-[11px] text-muted-foreground">
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
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
