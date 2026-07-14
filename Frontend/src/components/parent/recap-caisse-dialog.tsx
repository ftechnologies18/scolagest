"use client";

/**
 * ScolaGest — Dialogue « Payer à l'école » (Portail parent — Phase 6 — Refonte Forêt EdTech).
 *
 * Affiche un récapitulatif imprimable que le parent peut présenter à la caisse
 * de l'établissement pour effectuer un paiement en espèces / chèque.
 *
 * Refonte Forêt EdTech :
 *  - Header premium : badge rond gradient emerald→gold + icône Landmark.
 *  - Récap élégant : GlassCard tablet + InfoRows avec icônes contextuelles +
 *    montants en text-gold-dark.
 *  - Footer : bouton « Imprimer » variant success + « Fermer » variant outline.
 *
 * Données chargées via `fetchRecapCaisseParent(enfant.id)` qui hit
 * `GET /api/parent/recap-caisse?eleve_id=` (token parent). Le bouton
 * « Imprimer » déclenche `window.print()` ; la règle `@media print .recap-print`
 * (définie dans `globals.css`) masque tout le reste de la page.
 *
 * Le corps imprimable `.recap-print` reste intact (structure claire pour
 * impression A4) — la refonte porte uniquement sur le chrome visuel (header,
 * footer, body styling) qui est masqué à l'impression.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Printer,
  GraduationCap,
  Loader2,
  Wallet,
  QrCode,
  X,
  Info,
  CalendarClock,
  Landmark,
  User,
  Users,
  Clock,
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
import { Separator } from "@/components/ui/separator";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";

import {
  fetchRecapCaisseParent,
  parentKeys,
  type EnfantParent,
  type RecapCaisseParent,
} from "@/lib/api-parent";
import { formatFCFA, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

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
        <KentePattern variant="strip" position="top" />
        {/* Header premium : badge rond gradient emerald→gold + Landmark */}
        <DialogHeader className="no-print border-b border-emerald-100 bg-gradient-to-br from-emerald-50 to-amber-50 px-6 py-5 dark:from-emerald-950/20 dark:to-amber-950/10">
          <DialogTitle className="flex items-center gap-3 text-base">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-md shadow-emerald-900/20">
              <Landmark className="size-5" />
            </span>
            Payer à l&apos;école — Récapitulatif
          </DialogTitle>
          <DialogDescription className="ml-[52px] text-xs">
            Présentez ce récapitulatif à la caisse de l&apos;établissement pour
            effectuer votre paiement en espèces ou par chèque.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {isLoading || !enfant ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin text-emerald-600" />
              Chargement du récapitulatif…
            </div>
          ) : (
            <RecapBody
              recap={recap}
              enfantFallback={enfant}
            />
          )}
        </div>

        {/* Footer : Imprimer variant success + Fermer variant outline */}
        <div className="no-print flex flex-col-reverse gap-2 border-t border-emerald-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="break-words text-[11px] leading-snug text-muted-foreground">
            Astuce : choisissez « Enregistrer en PDF » comme imprimante pour
            générer un fichier.
          </p>
          <DialogFooter className="flex gap-2 sm:justify-end">
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
              disabled={isLoading || !recap}
              className="w-full sm:w-auto"
              title="Imprimer le récapitulatif ou l'enregistrer en PDF"
            >
              <Printer className="size-4" />
              Imprimer / Télécharger PDF
            </Button>
          </DialogFooter>
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
    <GlassCard variant="tablet" noHover noAnimation className="!p-0 overflow-hidden">
      <div className="recap-print rounded-lg border bg-white text-foreground">
        {/* En-tête établissement */}
        <div className="flex flex-col gap-3 rounded-t-lg bg-gradient-to-r from-emerald-700 via-emerald-600 to-amber-500 px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-white/15 ring-1 ring-gold/40">
              <GraduationCap className="size-6" />
            </div>
            <div>
              <div className="break-words text-base font-semibold leading-tight">
                {etablissement?.nom ?? "Établissement"}
              </div>
              <div className="break-words text-[11px] leading-snug text-emerald-50">
                {etablissement?.ville
                  ? `${etablissement.ville}, Côte d'Ivoire`
                  : "Côte d'Ivoire"}
                {etablissement?.code_officiel
                  ? ` · Code ${etablissement.code_officiel}`
                  : ""}
              </div>
              {etablissement?.telephone ? (
                <div className="break-all text-[11px] leading-snug text-emerald-50">
                  Tél. {etablissement.telephone}
                </div>
              ) : null}
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-[11px] uppercase tracking-wide text-emerald-50">
              Récapitulatif de caisse
            </div>
            <div className="break-all font-mono text-sm font-bold leading-snug">
              {reference || `REF-${enfantFallback.identifiant_interne}`}
            </div>
            <div className="break-words text-[11px] leading-snug text-emerald-50">
              {formatDateTime(dateEmission)}
            </div>
          </div>
        </div>

        <div className="space-y-4 p-6">
          {/* Élève + tuteur — InfoRows avec icônes */}
          <div className="grid gap-3 md:grid-cols-2">
            <InfoRow icon={User} label="Élève concerné">
              <div className="break-words font-semibold leading-snug">{eleveNomComplet}</div>
              <div className="break-words text-xs leading-snug text-muted-foreground">
                {eleveClasse ? `Classe : ${eleveClasse}` : ""}
              </div>
              <div className="break-words text-xs leading-snug text-muted-foreground">
                Matricule : {eleveMatricule}
              </div>
            </InfoRow>
            <InfoRow icon={Users} label="Tuteur / Parent">
              <div className="break-words font-semibold leading-snug">
                {recap?.tuteur
                  ? `${recap.tuteur.prenoms ?? ""} ${recap.tuteur.nom ?? ""}`.trim() ||
                    "—"
                  : "—"}
              </div>
              <div className="break-all text-xs leading-snug text-muted-foreground">
                Tél. {recap?.tuteur?.telephone ?? "—"}
              </div>
            </InfoRow>
          </div>

          {/* Synthèse financière — montants en text-gold-dark */}
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-emerald-50/60 text-[11px] uppercase tracking-wide text-muted-foreground dark:bg-emerald-950/30">
                <tr>
                  <th className="px-3 py-2 text-left">Rubrique</th>
                  <th className="px-3 py-2 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-emerald-100 dark:border-emerald-900/30">
                  <td className="px-3 py-2">Total frais attendus (année en cours)</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-gold-dark leading-snug">
                    {formatFCFA(totalAttendu)}
                  </td>
                </tr>
                <tr className="border-t border-emerald-100 dark:border-emerald-900/30">
                  <td className="px-3 py-2">Total déjà payé</td>
                  <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400 leading-snug">
                    {formatFCFA(totalPaye)}
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-amber-50 dark:bg-amber-950/30">
                <tr className="border-t border-amber-200 dark:border-amber-900/40">
                  <td className="px-3 py-2 font-semibold">Solde dû à régulariser</td>
                  <td className="px-3 py-2 text-right text-lg font-bold text-gold-dark leading-snug">
                    {formatFCFA(soldeDu)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Instruction à la caisse */}
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-800 dark:bg-amber-950/20">
            <Wallet className="mt-0.5 size-5 shrink-0 text-amber-700 dark:text-amber-300" />
            <div className="text-sm">
              <p className="break-words font-semibold text-amber-800 dark:text-amber-300">
                Présentez ce récapitulatif à la caisse de l&apos;établissement
              </p>
              <p className="mt-0.5 break-words text-xs leading-snug text-amber-800/90 dark:text-amber-300/90">
                Indiquez le montant que vous souhaitez régler (total ou partiel).
                Le caissier enregistrera votre paiement et vous remettra un reçu
                officiel.
              </p>
            </div>
          </div>

          {/* Modes acceptés + heures d'ouverture — InfoRows avec icônes */}
          <div className="grid gap-3 md:grid-cols-2">
            <InfoRow icon={CreditCard} label="Modes de paiement acceptés">
              <ul className="mt-1 space-y-0.5 break-words text-xs leading-snug">
                <li>• Espèces (FCFA)</li>
                <li>• Chèque barré à l&apos;ordre de l&apos;établissement</li>
                <li>• Virement bancaire (RIB sur demande)</li>
              </ul>
            </InfoRow>
            <InfoRow icon={Clock} label="Heures d&apos;ouverture de la caisse">
              <p className="mt-1 break-words text-xs leading-snug">
                Du lundi au vendredi, 8h à 16h.
                <br />
                Samedi, 8h à 12h (sur rendez-vous).
              </p>
            </InfoRow>
          </div>

          {/* Prochaine échéance rappel */}
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-2.5 text-[11px] text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
            <CalendarClock className="size-3.5 shrink-0" />
            <span className="break-words leading-snug">
              Pensez à régulariser avant la prochaine échéance pour éviter les
              retards.
            </span>
          </div>

          {/* Pied + QR */}
          <div className="flex items-end justify-between gap-4 pt-2">
            <div className="break-words text-[11px] leading-snug text-muted-foreground">
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
    </GlassCard>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InfoRow — ligne d'info avec icône contextuelle (BUG À ÉVITER #4 : flex
// items-start + mt-0.5 sur le badge icône)
// ─────────────────────────────────────────────────────────────────────────────

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
    <div className="flex items-start gap-3 rounded-lg border border-emerald-100 bg-emerald-50/40 p-3 dark:border-emerald-900/30 dark:bg-emerald-950/20">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="break-words text-[11px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 break-words text-sm leading-snug text-foreground">
          {children}
        </div>
      </div>
    </div>
  );
}
