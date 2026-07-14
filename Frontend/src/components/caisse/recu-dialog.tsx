"use client";

/**
 * ScolaGest — Dialogue d'affichage / impression d'un reçu (Phase 3 — refonte Forêt EdTech).
 *
 * Affiche un reçu mis en forme (en-tête établissement, n° reçu, infos élève,
 * détail du paiement, solde restant, caissier, date/heure, signature) à partir
 * des données disponibles :
 *  - si `paiement` est fourni (cas post-encaissement), on l'utilise directement ;
 *  - sinon, on fetch le paiement par id ;
 *  - on tente `fetchRecu` pour récupérer le snapshot officiel ; si indisponible,
 *    on construit un snapshot de secours depuis le paiement.
 *
 * Le bouton « Imprimer / Télécharger PDF » déclenche `window.print()`. La CSS
 * d'impression (`.receipt-print` dans `globals.css`) masque tout sauf le reçu.
 *
 * Refonte : header avec badge rond gradient emerald→gold + ReceiptText +
 * bouton « Imprimer » variant success + footer grid-cols-2 mobile. Le corps
 * du reçu (ReceiptBody) reste imprimable (.receipt-print) avec son design
 * emerald/orange intact.
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
import { KentePattern } from "@/components/ds/kente-pattern";

import { fetchPaiement, fetchRecu } from "@/lib/api-caisse";
import { useAuthStore } from "@/lib/auth-store";
import {
  formatFCFA,
  formatDateTime,
  formatTime,
} from "@/lib/format";
import type {
  Eleve,
  ModePaiement,
  Paiement,
  RecuSnapshot,
} from "@/lib/types";
import { ModePaiementBadge } from "./caisse-badges";

const MODE_LABEL: Record<ModePaiement, string> = {
  ESPECES: "Espèces",
  CHEQUE: "Chèque",
  VIREMENT: "Virement",
  MOBILE_MONEY: "Mobile Money",
};

export interface RecuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Identifiant du paiement. */
  paiementId?: string;
  /** Paiement déjà chargé (ex : renvoyé par `createPaiement`). */
  paiement?: Paiement;
}

export function RecuDialog({
  open,
  onOpenChange,
  paiementId,
  paiement: paiementPrefetched,
}: RecuDialogProps) {
  const etablissement = useAuthStore((s) => s.etablissement);
  const user = useAuthStore((s) => s.user);

  // Paiement : si on a déjà l'objet, on ne refetch pas.
  const effectiveId = paiementPrefetched?.id ?? paiementId;
  const {
    data: paiementFetched,
    isLoading: loadingPaiement,
  } = useQuery({
    queryKey: ["paiements", "detail", effectiveId] as const,
    queryFn: () => fetchPaiement(effectiveId!),
    enabled: open && !!effectiveId && !paiementPrefetched,
  });
  const paiement = paiementPrefetched ?? paiementFetched;

  // Reçu : on tente de le charger (snapshot officiel).
  const {
    data: recu,
    isLoading: loadingRecu,
  } = useQuery({
    queryKey: ["paiements", "recu", effectiveId] as const,
    queryFn: () => fetchRecu(effectiveId!),
    enabled: open && !!effectiveId,
    retry: 0,
  });

  // Parse le snapshot si présent
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

  const isLoading = loadingPaiement || loadingRecu;
  const numeroRecu = recu?.numero ?? paiement?.numero_recu ?? "—";

  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 p-0 sm:max-w-3xl">
        <KentePattern variant="strip" position="top" />
        <DialogHeader className="no-print border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex size-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <ReceiptIcon className="size-4" />
            </span>
            Reçu de caisse
          </DialogTitle>
          <DialogDescription className="text-xs">
            Reçu généré automatiquement. Vous pouvez l&apos;imprimer ou
            l&apos;enregistrer en PDF via le bouton ci-dessous.
          </DialogDescription>
        </DialogHeader>

        {/* Contenu scrollable */}
        <div className="max-h-[70vh] overflow-y-auto p-6">
          {isLoading || !paiement ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Loader2 className="size-6 animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground">
                Chargement du reçu…
              </p>
            </div>
          ) : (
            <ReceiptBody
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
              caissierNom={
                snapshot?.paiement?.caissier ??
                (paiement.caissier
                  ? `${paiement.caissier.prenoms ?? ""} ${
                      paiement.caissier.nom ?? ""
                    }`.trim()
                  : user
                    ? `${user.prenoms ?? ""} ${user.nom ?? ""}`.trim()
                    : "—")
              }
            />
          )}
        </div>

        {/* Footer actions — grid-cols-2 mobile / flex sm:justify-end */}
        <div className="no-print grid grid-cols-1 gap-2 border-t px-6 py-4 sm:grid-cols-2 sm:items-center">
          <p className="text-[11px] text-muted-foreground sm:col-span-1">
            Astuce : choisissez « Enregistrer en PDF » comme imprimante pour
            générer un fichier PDF.
          </p>
          <div className="flex flex-col gap-2 sm:col-span-1 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              className="w-full sm:w-auto"
              title="Fermer le reçu"
            >
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
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Corps du reçu (imprimable)
// ─────────────────────────────────────────────────────────────────────────────

interface ReceiptBodyProps {
  paiement: Paiement;
  snapshot: RecuSnapshot | null;
  numeroRecu: string;
  etablissementNom: string;
  etablissementVille?: string;
  etablissementCode?: string;
  caissierNom: string;
}

function ReceiptBody({
  paiement,
  snapshot,
  numeroRecu,
  etablissementNom,
  etablissementVille,
  etablissementCode,
  caissierNom,
}: ReceiptBodyProps) {
  const eleve = paiement.eleve as Eleve | undefined;
  const eleveNomComplet = snapshot?.eleve
    ? `${snapshot.eleve.prenoms ?? ""} ${snapshot.eleve.nom ?? ""}`.trim()
    : eleve
      ? [eleve.prenoms, eleve.nom].filter(Boolean).join(" ").trim()
      : "—";
  const eleveMatricule =
    snapshot?.eleve?.matricule ?? eleve?.matricule_ministere ?? eleve?.identifiant_interne ?? "—";
  const eleveClasse =
    snapshot?.eleve?.classe ??
    eleve?.inscription_courante?.classe_libelle ??
    "—";

  const motif =
    snapshot?.paiement?.motif ??
    paiement.frais?.libelle ??
    paiement.echeance?.libelle ??
    "Paiement scolaire";
  const montant = snapshot?.paiement?.montant ?? paiement.montant;
  const modePaiement = snapshot?.paiement?.mode ?? paiement.mode_paiement;
  const referenceExterne =
    snapshot?.paiement?.reference_externe ?? paiement.reference_externe ?? "";
  const providerMomo =
    snapshot?.paiement?.provider_momo ?? paiement.provider_momo ?? "";
  const datePaiement = snapshot?.paiement?.date ?? paiement.date_paiement;
  const soldeRestant =
    typeof snapshot?.solde_restant === "number"
      ? snapshot.solde_restant
      : undefined;

  return (
    <div className="receipt-print rounded-lg border bg-white text-foreground">
      {/* En-tête */}
      <div className="flex flex-col gap-3 rounded-t-lg bg-emerald-700 px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-lg bg-white/15">
            <GraduationCap className="size-6" />
          </div>
          <div>
            <div className="break-words text-base font-semibold leading-snug">
              {etablissementNom}
            </div>
            <div className="break-words text-[11px] leading-snug text-emerald-100">
              {etablissementVille ? `${etablissementVille}, Côte d'Ivoire` : "Côte d'Ivoire"}
              {etablissementCode ? ` · Code ${etablissementCode}` : ""}
            </div>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <div className="text-[11px] uppercase tracking-wide text-emerald-100">
            Reçu de caisse
          </div>
          <div className="break-words font-mono text-lg font-bold leading-snug">
            {numeroRecu}
          </div>
        </div>
      </div>

      <div className="space-y-4 p-6">
        {/* Méta */}
        <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <Meta label="Date" value={formatDateTime(datePaiement).split(" à ")[0]} />
          <Meta label="Heure" value={formatTime(datePaiement)} />
          <Meta label="Caissier" value={caissierNom} />
          <Meta
            label="Statut"
            value={
              paiement.statut === "VALIDE"
                ? "Validé"
                : paiement.statut === "ANNULE"
                  ? "Annulé"
                  : "En attente"
            }
          />
        </div>

        <Separator />

        {/* Élève */}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border p-3">
            <div className="text-[11px] uppercase text-muted-foreground">
              Élève
            </div>
            <div className="break-words font-semibold leading-snug">{eleveNomComplet}</div>
            <div className="break-words text-xs leading-snug text-muted-foreground">{eleveClasse}</div>
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-[11px] uppercase text-muted-foreground">
              Matricule
            </div>
            <div className="break-words font-mono font-semibold leading-snug">{eleveMatricule}</div>
            <div className="break-words text-xs leading-snug text-muted-foreground">
              Catégorie :{" "}
              {eleve?.categorie === "AFFECTE"
                ? "Affecté"
                : eleve?.categorie === "NON_AFFECTE"
                  ? "Non affecté"
                  : "—"}
            </div>
          </div>
        </div>

        {/* Détail */}
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Désignation</th>
                <th className="px-3 py-2 text-left">Échéance</th>
                <th className="px-3 py-2 text-right">Montant</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="break-words px-3 py-2 font-medium leading-snug">{motif}</td>
                <td className="break-words px-3 py-2 leading-snug text-muted-foreground">
                  {paiement.echeance?.libelle ?? "—"}
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold">
                  {formatFCFA(montant)}
                </td>
              </tr>
            </tbody>
            <tfoot className="bg-emerald-50 dark:bg-emerald-950/30">
              <tr className="border-t">
                <td className="px-3 py-2 font-semibold" colSpan={2}>
                  Total encaissé
                </td>
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
              <span className="break-words font-semibold leading-snug">
                {MODE_LABEL[modePaiement]}
              </span>
              <ModePaiementBadge mode={modePaiement} />
            </div>
            <div className="mt-1 break-words text-xs leading-snug text-muted-foreground">
              Référence : {referenceExterne || "—"}
              {providerMomo ? ` · ${providerMomo}` : ""}
            </div>
          </div>
          <div
            className={`rounded-lg border p-3 text-sm ${
              soldeRestant === undefined
                ? ""
                : soldeRestant > 0
                  ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20"
                  : "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
            }`}
          >
            <div
              className={`text-[11px] uppercase ${
                soldeRestant === undefined
                  ? "text-muted-foreground"
                  : soldeRestant > 0
                    ? "text-amber-700"
                    : "text-emerald-700"
              }`}
            >
              {soldeRestant === undefined
                ? "Paiement enregistré"
                : soldeRestant > 0
                  ? "Solde restant dû"
                  : "Solde soldé"}
            </div>
            <div
              className={`text-lg font-bold ${
                soldeRestant === undefined
                  ? ""
                  : soldeRestant > 0
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-emerald-800 dark:text-emerald-300"
              }`}
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
          <div className="flex size-20 shrink-0 flex-col items-center justify-center rounded-md border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-900/40">
            <QrCode className="size-9" />
            <span className="text-[9px]">QR vérification</span>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="break-words">Signé : {caissierNom} (caissier)</span>
          <span className="break-words">ScolaGest · www.scolagest.ci</span>
        </div>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase text-muted-foreground">{label}</div>
      <div className="break-words font-medium leading-snug">{value}</div>
    </div>
  );
}
