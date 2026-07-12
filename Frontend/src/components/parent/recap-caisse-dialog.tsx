"use client";

/**
 * ScolaGest — Dialogue « Payer à l'école » (Portail parent — Phase 6).
 *
 * Affiche un récapitulatif imprimable que le parent peut présenter à la caisse
 * de l'établissement pour effectuer un paiement en espèces / chèque.
 *
 * Données chargées via `fetchRecapCaisseParent(enfant.id)` qui hit
 * `GET /api/parent/recap-caisse?eleve_id=` (token parent). Le bouton
 * « Imprimer » déclenche `window.print()` ; la règle `@media print .recap-print`
 * (définie dans `globals.css`) masque tout le reste de la page.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  GraduationCap,
  Loader2,
  Building2,
  Wallet,
  QrCode,
  X,
  Info,
  CalendarClock,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import {
  fetchRecapCaisseParent,
  parentKeys,
  type EnfantParent,
  type RecapCaisseParent,
} from "@/lib/api-parent";
import { formatFCFA, formatDateTime } from "@/lib/format";

export interface RecapCaisseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enfant: EnfantParent | null;
}

export function RecapCaisseDialog({
  open,
  onOpenChange,
  enfant,
}: RecapCaisseDialogProps) {
  // Charge le récap côté backend (token parent).
  const { data: recap, isLoading } = useQuery({
    queryKey: parentKeys.recapCaisse(enfant?.id ?? ""),
    queryFn: () => fetchRecapCaisseParent(enfant!.id),
    enabled: open && !!enfant?.id,
    retry: 1,
    retryDelay: 1500,
  });

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
            <Building2 className="size-5 text-amber-600" />
            Payer à l&apos;école — Récapitulatif
          </DialogTitle>
          <DialogDescription className="text-xs">
            Présentez ce récapitulatif à la caisse de l&apos;établissement pour
            effectuer votre paiement en espèces ou par chèque.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {isLoading || !enfant ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Chargement du récapitulatif…
            </div>
          ) : (
            <RecapBody
              recap={recap}
              enfantFallback={enfant}
            />
          )}
        </div>

        <div className="no-print flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] text-muted-foreground">
            Astuce : choisissez « Enregistrer en PDF » comme imprimante pour
            générer un fichier.
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
              disabled={isLoading || !recap}
              className="bg-amber-600 text-white hover:bg-amber-700"
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
// Corps imprimable
// ─────────────────────────────────────────────────────────────────────────────

function RecapBody({
  recap,
  enfantFallback,
}: {
  recap: RecapCaisseParent | undefined;
  enfantFallback: EnfantParent;
}) {
  const etablissement = recap?.etablissement;
  const eleve = recap?.eleve;
  const finances = recap?.finances;
  const dateEmission = recap?.date_emission ?? new Date().toISOString();
  const reference = recap?.reference ?? "";

  const eleveNomComplet = eleve
    ? `${eleve.prenoms ?? ""} ${eleve.nom ?? ""}`.trim()
    : `${enfantFallback.prenoms ?? ""} ${enfantFallback.nom ?? ""}`.trim();
  const eleveClasse = eleve?.classe ?? enfantFallback.classe_actuelle ?? "—";
  const eleveMatricule =
    eleve?.matricule ??
    enfantFallback.matricule_ministere ??
    enfantFallback.identifiant_interne ??
    "—";

  const soldeDu = finances?.solde_du ?? enfantFallback.solde?.solde_du ?? 0;
  const totalAttendu =
    finances?.total_attendu ?? enfantFallback.solde?.total_attendu ?? 0;
  const totalPaye = finances?.total_paye ?? enfantFallback.solde?.total_paye ?? 0;

  return (
    <div className="recap-print rounded-lg border bg-white text-foreground">
      {/* En-tête établissement */}
      <div className="flex flex-col gap-3 rounded-t-lg bg-amber-600 px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-white/15">
            <GraduationCap className="size-6" />
          </div>
          <div>
            <div className="text-base font-semibold">
              {etablissement?.nom ?? "Établissement"}
            </div>
            <div className="text-[11px] text-amber-100">
              {etablissement?.ville
                ? `${etablissement.ville}, Côte d'Ivoire`
                : "Côte d'Ivoire"}
              {etablissement?.code_officiel
                ? ` · Code ${etablissement.code_officiel}`
                : ""}
            </div>
            {etablissement?.telephone ? (
              <div className="text-[11px] text-amber-100">
                Tél. {etablissement.telephone}
              </div>
            ) : null}
          </div>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-[11px] uppercase tracking-wide text-amber-100">
            Récapitulatif de caisse
          </div>
          <div className="font-mono text-sm font-bold">
            {reference || `REF-${enfantFallback.identifiant_interne}`}
          </div>
          <div className="text-[11px] text-amber-100">
            {formatDateTime(dateEmission)}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-6">
        {/* Élève + tuteur */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="text-[11px] uppercase text-muted-foreground">
              Élève concerné
            </div>
            <div className="font-semibold">{eleveNomComplet}</div>
            <div className="text-xs text-muted-foreground">
              {eleveClasse ? `Classe : ${eleveClasse}` : ""}
            </div>
            <div className="text-xs text-muted-foreground">
              Matricule : {eleveMatricule}
            </div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-[11px] uppercase text-muted-foreground">
              Tuteur / Parent
            </div>
            <div className="font-semibold">
              {recap?.tuteur
                ? `${recap.tuteur.prenoms ?? ""} ${recap.tuteur.nom ?? ""}`.trim() ||
                  "—"
                : "—"}
            </div>
            <div className="text-xs text-muted-foreground">
              Tél. {recap?.tuteur?.telephone ?? "—"}
            </div>
          </div>
        </div>

        {/* Synthèse financière */}
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Rubrique</th>
                <th className="px-3 py-2 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="px-3 py-2">Total frais attendus (année en cours)</td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatFCFA(totalAttendu)}
                </td>
              </tr>
              <tr className="border-t">
                <td className="px-3 py-2">Total déjà payé</td>
                <td className="px-3 py-2 text-right font-mono text-emerald-700 dark:text-emerald-400">
                  {formatFCFA(totalPaye)}
                </td>
              </tr>
            </tbody>
            <tfoot className="bg-amber-50 dark:bg-amber-950/30">
              <tr className="border-t">
                <td className="px-3 py-2 font-semibold">Solde dû à régulariser</td>
                <td className="px-3 py-2 text-right text-lg font-bold text-amber-800 dark:text-amber-300">
                  {formatFCFA(soldeDu)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Instruction à la caisse */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
          <Wallet className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800 dark:text-amber-300">
              Présentez ce récapitulatif à la caisse de l&apos;établissement
            </p>
            <p className="mt-0.5 text-xs text-amber-800/90 dark:text-amber-300/90">
              Indiquez le montant que vous souhaitez régler (total ou partiel).
              Le caissier enregistrera votre paiement et vous remettra un reçu
              officiel.
            </p>
          </div>
        </div>

        {/* Modes acceptés */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-3 text-sm">
            <div className="text-[11px] uppercase text-muted-foreground">
              Modes de paiement acceptés
            </div>
            <ul className="mt-1 space-y-0.5 text-xs">
              <li>• Espèces (FCFA)</li>
              <li>• Chèque barré à l&apos;ordre de l&apos;établissement</li>
              <li>• Virement bancaire (RIB sur demande)</li>
            </ul>
          </div>
          <div className="rounded-lg border p-3 text-sm">
            <div className="text-[11px] uppercase text-muted-foreground">
              Heures d&apos;ouverture de la caisse
            </div>
            <p className="mt-1 text-xs">
              Du lundi au vendredi, 8h à 16h.
              <br />
              Samedi, 8h à 12h (sur rendez-vous).
            </p>
          </div>
        </div>

        {/* Prochaine échéance rappel */}
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-2.5 text-[11px] text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300">
          <CalendarClock className="size-3.5 shrink-0" />
          Pensez à régulariser avant la prochaine échéance pour éviter les
          retards.
        </div>

        {/* Pied + QR */}
        <div className="flex items-end justify-between gap-4 pt-2">
          <div className="text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
              <Info className="size-3.5" />
              Document généré par ScolaGest — Portail Parent
            </div>
            <div className="mt-1">
              Ce récapitulatif ne constitue pas un justificatif de paiement.
              Conservez le reçu remis par la caisse.
            </div>
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
