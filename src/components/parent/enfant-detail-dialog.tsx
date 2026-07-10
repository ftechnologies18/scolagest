"use client";

/**
 * ScolaGest — Dialogue de détail du solde d'un enfant (Portail parent — Phase 6).
 *
 * Affiche pour un enfant donné :
 *   - En-tête : avatar, nom complet, classe, établissement.
 *   - Synthèse du solde : 3 KPI (Attendu, Payé, Solde dû).
 *   - Tableau des frais attendus (type, libellé, attendu, payé, solde).
 *   - Tableau des échéances à venir (libellé, date limite, montant, statut).
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
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "PARTIEL":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300";
    case "EN_RETARD":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300";
    case "A_VENIR":
    default:
      return "border-muted-foreground/20 bg-muted text-muted-foreground";
  }
}

export interface EnfantDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enfant: EnfantParent | null;
  /** Appelé quand le parent clique sur « Voir l'historique ». */
  onVoirHistorique: (enfant: EnfantParent) => void;
}

export function EnfantDetailDialog({
  open,
  onOpenChange,
  enfant,
  onVoirHistorique,
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
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="size-5 text-emerald-600" />
            Détail du compte de mon enfant
          </DialogTitle>
          <DialogDescription className="text-xs">
            Synthèse des frais attendus, des paiements effectués et des
            échéances à venir pour l&apos;année scolaire en cours.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          {isLoading || !enfant ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Chargement du solde…
            </div>
          ) : (
            <DetailBody
              enfant={enfant}
              solde={solde}
              onVoirHistorique={() => {
                onOpenChange(false);
                onVoirHistorique(enfant);
              }}
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
  onVoirHistorique: () => void;
}

function DetailBody({ enfant, solde, onVoirHistorique }: DetailBodyProps) {
  const soldeDu = solde?.solde_du ?? enfant.solde.solde_du;
  const totalAttendu = solde?.total_attendu ?? enfant.solde.total_attendu;
  const totalPaye = solde?.total_paye ?? enfant.solde.total_paye;
  const soldeOK = soldeDu <= 0;

  return (
    <div className="space-y-5">
      {/* En-tête élève */}
      <div className="flex flex-col gap-4 rounded-xl border bg-gradient-to-br from-emerald-50 to-amber-50 p-4 dark:from-emerald-950/20 dark:to-amber-950/10 sm:flex-row sm:items-center">
        <Avatar className="size-16 border-2 border-emerald-200 dark:border-emerald-900">
          <AvatarFallback className="bg-emerald-600 text-xl font-bold text-white">
            {initials(enfant.nom, enfant.prenoms)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold">
              {enfant.prenoms} {enfant.nom}
            </h3>
            {enfant.classe_actuelle ? (
              <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                {enfant.classe_actuelle}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Non inscrit·e
              </Badge>
            )}
            {enfant.categorie && enfant.categorie !== "NON_APPLICABLE" && (
              <Badge variant="outline" className="text-muted-foreground">
                {categorieLabel(enfant.categorie)}
              </Badge>
            )}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
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
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-100 px-3 py-2 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
              <CheckCircle2 className="size-4" />
              <span className="text-sm font-semibold">À jour</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-3 py-2 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="size-4" />
              <span className="text-sm font-semibold">Solde à régulariser</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI synthèse */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

      {/* Frais attendus */}
      <div>
        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <Wallet className="size-4 text-emerald-600" />
          Frais attendus pour l&apos;année
        </h4>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableRow key={f.frais_id}>
                    <TableCell>
                      <Badge variant="outline" className="font-medium">
                        {typeFraisLabel(f.type_frais)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{f.libelle}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatFCFA(f.montant_attendu)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-700 dark:text-emerald-400">
                      {formatFCFA(f.montant_paye)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-mono font-semibold",
                        f.solde > 0
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-emerald-700 dark:text-emerald-400",
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
        </div>
      </div>

      {/* Échéances à venir */}
      <div>
        <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="size-4 text-amber-600" />
          Échéances à venir
        </h4>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
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
                  <TableRow key={e.echeance_id}>
                    <TableCell className="font-medium">{e.libelle}</TableCell>
                    <TableCell>{formatDate(e.date_limite)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatFCFA(e.montant)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-emerald-700 dark:text-emerald-400">
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
        </div>
      </div>

      {/* Action : voir l'historique */}
      <div className="flex justify-end pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onVoirHistorique}
          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-900/50 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
        >
          <History className="size-4" />
          Voir l&apos;historique des paiements
        </Button>
      </div>
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
    <div
      className={cn(
        "rounded-xl border p-4",
        tone === "emerald" &&
          "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20",
        tone === "amber" &&
          "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20",
        tone === "neutral" && "bg-background",
      )}
    >
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={cn(
          "mt-1 font-mono text-xl font-bold",
          tone === "emerald" && "text-emerald-800 dark:text-emerald-300",
          tone === "amber" && "text-amber-800 dark:text-amber-300",
        )}
      >
        {value}
      </div>
    </div>
  );
}
