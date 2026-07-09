"use client";

/**
 * ScolaGest — Dialogue de création / édition d'un frais (Phase 3).
 *
 * Champs :
 *  - type_frais (Select) — INSCRIPTION, SCOLARITE, EXAMEN, ANNEXE
 *  - libellé (Input)
 *  - Périmètre : cycle OU classe OU "Tout l'établissement". Si une classe est
 *    choisie, le cycle est dérivé automatiquement.
 *  - catégorie (Select) — AFFECTE / NON_AFFECTE / "Tarif unique (null)".
 *    Sélectionnable seulement si l'établissement applique la distinction.
 *  - montant_total (Input number, FCFA)
 *  - nb_versements_defaut (Input number)
 *  - Éditeur d'échéances : table rang / libellé / montant / date_limite.
 *    Bouton « Répartir automatiquement » → montants répartis uniformément et
 *    dates mensuelles par défaut (oct→fév pour 5 tranches, nov→fév pour 4, …).
 *
 * À la soumission : createFrais ou updateFrais avec les échéances. Le backend
 * remplace l'intégralité des échéances lors d'un update.
 */

import * as React from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Coins,
  Loader2,
  Plus,
  Trash2,
  Wand2,
  CalendarDays,
} from "lucide-react";

import { useAuthStore } from "@/lib/auth-store";
import {
  createFrais,
  updateFrais,
  deleteFrais as _unused,
  fraisKeys,
} from "@/lib/api-caisse";
import {
  anneesKeys,
  fetchActiveAnnee,
  fetchClasses,
  fetchCycles,
  classesKeys,
  cyclesKeys,
} from "@/lib/api-students";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA, isoToDateInput, todayISO } from "@/lib/format";
import type {
  CategorieFrais,
  Classe,
  Cycle,
  EcheanceDTO,
  Frais,
  FraisDTO,
  TypeFrais,
} from "@/lib/types";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// `deleteFrais` n'est pas utilisé ici ; import neutralisé pour éviter
// l'erreur d'import inutilisé côté lint (config désactivée, mais clarté).
void _unused;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_FRAIS_OPTIONS: { value: TypeFrais; label: string }[] = [
  { value: "INSCRIPTION", label: "Inscription" },
  { value: "SCOLARITE", label: "Scolarité" },
  { value: "EXAMEN", label: "Examen" },
  { value: "ANNEXE", label: "Annexe" },
];

/**
 * Calcule les dates limites par défaut pour `nb` échéances, calées sur
 * l'année scolaire en cours.
 *  - 5 tranches : oct, nov, déc, jan, fév
 *  - 4 tranches : nov, déc, jan, fév
 *  - 3 tranches : déc, jan, fév
 *  - 2 tranches : déc, fév
 *  - 1 tranche  : aujourd'hui (frais ponctuel)
 *  - autre : mensuel à partir d'octobre
 */
function defaultDatesFor(nb: number, yearStart: number): string[] {
  const monthsMap5 = [9, 10, 11, 0, 1]; // oct, nov, dec, jan, feb (0-indexed: 9=oct)
  const monthsMap4 = [10, 11, 0, 1]; // nov, dec, jan, feb
  const monthsMap3 = [11, 0, 1]; // dec, jan, feb
  const monthsMap2 = [11, 1]; // dec, feb

  let months: number[];
  if (nb === 5) months = monthsMap5;
  else if (nb === 4) months = monthsMap4;
  else if (nb === 3) months = monthsMap3;
  else if (nb === 2) months = monthsMap2;
  else if (nb === 1) {
    return [todayISO()];
  } else {
    // Au-delà de 5 : on démarre en octobre et on avance mois par mois.
    months = Array.from({ length: nb }, (_, i) => (9 + i) % 12);
  }

  // Pour les mois jan/feb, l'année est yearStart+1, sinon yearStart.
  return months.map((m) => {
    const y = m >= 9 ? yearStart : yearStart + 1;
    const lastDay = new Date(y, m + 1, 0).getDate();
    const day = String(Math.min(15, lastDay)).padStart(2, "0");
    const month = String(m + 1).padStart(2, "0");
    return `${y}-${month}-${day}`;
  });
}

function defaultLibelle(rang: number, type: TypeFrais): string {
  if (type === "SCOLARITE") return `Tranche ${rang}`;
  if (type === "INSCRIPTION") return "Inscription";
  if (type === "EXAMEN") return "Frais d'examen";
  return `Versement ${rang}`;
}

interface EcheanceRow extends EcheanceDTO {
  // local id for React keys
  _key: string;
}

let _rowKeyCounter = 0;
function nextRowKey(): string {
  _rowKeyCounter += 1;
  return `echeance-${_rowKeyCounter}-${Date.now()}`;
}

function rowsFromFrais(frais?: Frais | null): EcheanceRow[] {
  if (!frais?.echeances || frais.echeances.length === 0) return [];
  return [...frais.echeances]
    .sort((a, b) => a.rang - b.rang)
    .map((e) => ({
      _key: nextRowKey(),
      rang: e.rang,
      libelle: e.libelle,
      montant: e.montant,
      date_limite: isoToDateInput(e.date_limite) || todayISO(),
    }));
}

function emptyRows(
  nb: number,
  montantTotal: number,
  type: TypeFrais,
  yearStart: number,
): EcheanceRow[] {
  const dates = defaultDatesFor(nb, yearStart);
  const per = nb > 0 ? Math.round(montantTotal / nb) : 0;
  return Array.from({ length: nb }, (_, i) => ({
    _key: nextRowKey(),
    rang: i + 1,
    libelle: defaultLibelle(i + 1, type),
    montant: per,
    date_limite: dates[i] ?? todayISO(),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export interface FraisFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Frais à éditer (null pour création). */
  frais?: Frais | null;
  /** Année scolaire active (passée par le parent). */
  anneeId?: string;
}

const SCOPE_ALL = "all";
const SCOPE_PREFIX_CYCLE = "cycle:";
const SCOPE_PREFIX_CLASSE = "classe:";

export function FraisFormDialog({
  open,
  onOpenChange,
  frais,
  anneeId,
}: FraisFormDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const etablissement = useAuthStore((s) => s.etablissement);

  const isEdit = !!frais;

  // Cycles & classes
  const { data: cycles } = useQuery({
    queryKey: cyclesKeys.list(etablissement?.id),
    queryFn: () => fetchCycles(etablissement?.id),
    enabled: open,
  });
  const { data: classes } = useQuery({
    queryKey: classesKeys.list(etablissement?.id),
    queryFn: () => fetchClasses(etablissement?.id),
    enabled: open,
  });
  const { data: activeAnnee } = useQuery({
    queryKey: anneesKeys.active(),
    queryFn: fetchActiveAnnee,
    enabled: open && !anneeId,
  });

  const effectiveAnneeId = anneeId ?? activeAnnee?.id ?? "";

  // Helper : année de début (pour caler les dates d'échéances).
  const yearStart = React.useMemo(() => {
    const lib = activeAnnee?.libelle ?? "";
    // Format attendu "2025-2026"
    const m = lib.match(/^(\d{4})/);
    if (m) return Number(m[1]);
    return new Date().getFullYear();
  }, [activeAnnee]);

  // ─── État du formulaire ─────────────────────────────────────────────────
  const [typeFrais, setTypeFrais] = React.useState<TypeFrais>("SCOLARITE");
  const [libelle, setLibelle] = React.useState("");
  const [scope, setScope] = React.useState<string>(SCOPE_ALL);
  const [categorie, setCategorie] = React.useState<string>("__UNIQUE__");
  const [montantTotal, setMontantTotal] = React.useState<string>("60000");
  const [nbVersements, setNbVersements] = React.useState<string>("5");
  const [actif, setActif] = React.useState(true);
  const [rows, setRows] = React.useState<EcheanceRow[]>([]);

  // Initialise / réinitialise à l'ouverture
  React.useEffect(() => {
    if (!open) return;
    if (frais) {
      setTypeFrais(frais.type_frais);
      setLibelle(frais.libelle);
      if (frais.classe_id) setScope(`${SCOPE_PREFIX_CLASSE}${frais.classe_id}`);
      else if (frais.cycle_id) setScope(`${SCOPE_PREFIX_CYCLE}${frais.cycle_id}`);
      else setScope(SCOPE_ALL);
      setCategorie(frais.categorie ?? "__UNIQUE__");
      setMontantTotal(String(frais.montant_total));
      setNbVersements(String(frais.nb_versements_defaut));
      setActif(frais.actif);
      setRows(rowsFromFrais(frais));
    } else {
      setTypeFrais("SCOLARITE");
      setLibelle("");
      setScope(SCOPE_ALL);
      setCategorie("__UNIQUE__");
      setMontantTotal("60000");
      setNbVersements("5");
      setActif(true);
      setRows(emptyRows(5, 60000, "SCOLARITE", yearStart));
    }
  }, [open, frais]);

  // Lorsqu'on change le type en mode création, on régénère les libellés par défaut
  // (uniquement si l'utilisateur n'a pas encore personnalisé).
  const [userEditedLibelles, setUserEditedLibelles] = React.useState(false);
  React.useEffect(() => {
    if (!open || isEdit || userEditedLibelles) return;
    setRows((prev) =>
      prev.map((r) => ({ ...r, libelle: defaultLibelle(r.rang, typeFrais) })),
    );
  }, [typeFrais]);

  // ─── Helpers pour les échéances ──────────────────────────────────────────
  function syncRowCount(nb: number) {
    setRows((prev) => {
      if (nb === prev.length) return prev;
      if (nb < prev.length) {
        return prev.slice(0, nb).map((r, i) => ({ ...r, rang: i + 1 }));
      }
      const toAdd = nb - prev.length;
      const dates = defaultDatesFor(nb, yearStart);
      const total = Number(montantTotal) || 0;
      const per = nb > 0 ? Math.round(total / nb) : 0;
      const newRows: EcheanceRow[] = Array.from({ length: toAdd }, (_, i) => {
        const rang = prev.length + i + 1;
        return {
          _key: nextRowKey(),
          rang,
          libelle: defaultLibelle(rang, typeFrais),
          montant: per,
          date_limite: dates[rang - 1] ?? todayISO(),
        };
      });
      return [...prev, ...newRows];
    });
  }

  function handleNbChange(value: string) {
    const n = Math.max(1, Math.min(12, Number(value) || 1));
    setNbVersements(String(n));
    syncRowCount(n);
  }

  function repartir() {
    const total = Number(montantTotal) || 0;
    const nb = rows.length || Number(nbVersements) || 1;
    const per = Math.round(total / nb);
    let remainder = total - per * nb;
    setRows((prev) =>
      prev.map((r, i) => {
        let montant = per;
        if (remainder > 0) {
          montant += 1;
          remainder -= 1;
        }
        return { ...r, montant };
      }),
    );
    // S'assurer qu'on a le bon nombre de lignes
    if (rows.length !== nb) {
      syncRowCount(nb);
    }
    toast({
      title: "Répartition appliquée",
      description: `${nb} échéances de ${formatFCFA(per)} (total ${formatFCFA(
        total,
      )}).`,
    });
  }

  function updateRow(idx: number, patch: Partial<EcheanceRow>) {
    setUserEditedLibelles(true);
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  }

  function addRow() {
    const rang = rows.length + 1;
    setRows((prev) => [
      ...prev,
      {
        _key: nextRowKey(),
        rang,
        libelle: defaultLibelle(rang, typeFrais),
        montant: 0,
        date_limite: todayISO(),
      },
    ]);
    setNbVersements(String(rang));
  }

  function removeRow(idx: number) {
    setRows((prev) =>
      prev
        .filter((_, i) => i !== idx)
        .map((r, i) => ({ ...r, rang: i + 1 })),
    );
    setNbVersements(String(Math.max(1, rows.length - 1)));
  }

  // ─── Soumission ──────────────────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: async () => {
      if (!effectiveAnneeId) {
        throw new Error(
          "Aucune année scolaire active. Activez une année avant de créer un frais.",
        );
      }
      // Périmètre → cycle_id / classe_id
      let cycleId: string | null = null;
      let classeId: string | null = null;
      if (scope.startsWith(SCOPE_PREFIX_CLASSE)) {
        classeId = scope.slice(SCOPE_PREFIX_CLASSE.length);
        // dériver le cycle depuis la classe
        const found = (classes ?? []).find((c) => c.id === classeId);
        if (found) cycleId = found.cycle_id;
      } else if (scope.startsWith(SCOPE_PREFIX_CYCLE)) {
        cycleId = scope.slice(SCOPE_PREFIX_CYCLE.length);
      }

      const cat: CategorieFrais =
        categorie === "__UNIQUE__" ? null : (categorie as CategorieFrais);

      const echeances: EcheanceDTO[] = rows.map((r) => ({
        rang: r.rang,
        libelle: r.libelle || defaultLibelle(r.rang, typeFrais),
        montant: Number(r.montant) || 0,
        date_limite: r.date_limite
          ? new Date(r.date_limite).toISOString()
          : new Date().toISOString(),
      }));

      const dto: FraisDTO = {
        cycle_id: cycleId,
        classe_id: classeId,
        type_frais: typeFrais,
        categorie: cat,
        libelle: libelle.trim(),
        montant_total: Number(montantTotal) || 0,
        nb_versements_defaut: Number(nbVersements) || echeances.length,
        echeances,
        actif,
      };

      if (isEdit && frais) {
        return updateFrais(frais.id, dto);
      }
      return createFrais(dto);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: fraisKeys.all });
      toast({
        title: isEdit ? "Frais mis à jour" : "Frais créé",
        description: `« ${libelle.trim() || "—"} » a été ${
          isEdit ? "modifié" : "ajouté"
        } avec succès.`,
      });
      onOpenChange(false);
    },
    onError: (err: unknown) => {
      toast({
        title: "Erreur",
        description:
          err instanceof Error ? err.message : "Impossible d'enregistrer le frais.",
        variant: "destructive",
      });
    },
  });

  // ─── Déduction cycle depuis classe ───────────────────────────────────────
  const selectedClasseId = scope.startsWith(SCOPE_PREFIX_CLASSE)
    ? scope.slice(SCOPE_PREFIX_CLASSE.length)
    : null;
  const selectedClasse: Classe | undefined = (classes ?? []).find(
    (c) => c.id === selectedClasseId,
  );
  const selectedCycle: Cycle | undefined = selectedClasse?.cycle;

  const totalRows = rows.reduce((sum, r) => sum + (Number(r.montant) || 0), 0);
  const totalDiff = totalRows - (Number(montantTotal) || 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!libelle.trim()) {
      toast({
        title: "Libellé manquant",
        description: "Indiquez un libellé pour ce frais.",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="size-5 text-emerald-600" />
            {isEdit ? "Modifier le frais" : "Nouveau frais"}
          </DialogTitle>
          <DialogDescription>
            Configurez un frais pour l&apos;année scolaire active. Les
            échéances seront créées automatiquement.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type + libellé */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Type de frais</Label>
              <Select
                value={typeFrais}
                onValueChange={(v) => setTypeFrais(v as TypeFrais)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_FRAIS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frais-libelle">Libellé</Label>
              <Input
                id="frais-libelle"
                value={libelle}
                onChange={(e) => setLibelle(e.target.value)}
                placeholder="Ex. Scolarité 6e — Affectés"
              />
            </div>
          </div>

          {/* Périmètre + catégorie */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Périmètre d&apos;application</Label>
              <Select value={scope} onValueChange={setScope}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SCOPE_ALL}>
                    Tout l&apos;établissement
                  </SelectItem>
                  {(cycles ?? []).map((c) => (
                    <SelectItem
                      key={c.id}
                      value={`${SCOPE_PREFIX_CYCLE}${c.id}`}
                    >
                      Cycle — {c.libelle}
                    </SelectItem>
                  ))}
                  {(classes ?? []).map((c) => (
                    <SelectItem
                      key={c.id}
                      value={`${SCOPE_PREFIX_CLASSE}${c.id}`}
                    >
                      Classe — {c.libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedClasse && selectedCycle ? (
                <p className="text-xs text-muted-foreground">
                  Classe {selectedClasse.libelle} · Cycle{" "}
                  {selectedCycle.libelle}
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label>Catégorie (tarification)</Label>
              <Select
                value={categorie}
                onValueChange={setCategorie}
                disabled={!etablissement?.applique_categorie_affecte}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__UNIQUE__">
                    Tarif unique (par défaut)
                  </SelectItem>
                  <SelectItem value="AFFECTE">Affecté</SelectItem>
                  <SelectItem value="NON_AFFECTE">Non affecté</SelectItem>
                </SelectContent>
              </Select>
              {!etablissement?.applique_categorie_affecte ? (
                <p className="text-xs text-muted-foreground">
                  Cet établissement n&apos;applique pas la distinction
                  Affecté / Non affecté.
                </p>
              ) : null}
            </div>
          </div>

          {/* Montant + nb versements + actif */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="frais-montant">Montant total (FCFA)</Label>
              <Input
                id="frais-montant"
                type="number"
                min={0}
                value={montantTotal}
                onChange={(e) => setMontantTotal(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {formatFCFA(Number(montantTotal) || 0)}
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="frais-nb">Nombre de versements</Label>
              <Input
                id="frais-nb"
                type="number"
                min={1}
                max={12}
                value={nbVersements}
                onChange={(e) => handleNbChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Tranches par défaut
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Frais actif</Label>
              <div className="flex h-9 items-center gap-2">
                <Switch
                  checked={actif}
                  onCheckedChange={setActif}
                  aria-label="Frais actif"
                />
                <span className="text-sm text-muted-foreground">
                  {actif ? "Actif" : "Inactif"}
                </span>
              </div>
            </div>
          </div>

          {/* Éditeur d'échéances */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 text-sm">
                <CalendarDays className="size-3.5 text-emerald-600" />
                Échéances ({rows.length})
              </Label>
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={repartir}
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                >
                  <Wand2 className="size-3.5" />
                  Répartir automatiquement
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addRow}
                >
                  <Plus className="size-3.5" />
                  Ajouter
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Libellé</TableHead>
                    <TableHead className="w-32">Montant (FCFA)</TableHead>
                    <TableHead className="w-36">Date limite</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="py-6 text-center text-sm text-muted-foreground"
                      >
                        Aucune échéance. Cliquez sur « Ajouter ».
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r, idx) => (
                      <TableRow key={r._key}>
                        <TableCell className="text-center font-mono text-xs text-muted-foreground">
                          {r.rang}
                        </TableCell>
                        <TableCell>
                          <Input
                            value={r.libelle}
                            onChange={(e) =>
                              updateRow(idx, { libelle: e.target.value })
                            }
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            value={r.montant}
                            onChange={(e) =>
                              updateRow(idx, {
                                montant: Number(e.target.value) || 0,
                              })
                            }
                            className="h-8 font-mono"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="date"
                            value={r.date_limite}
                            onChange={(e) =>
                              updateRow(idx, { date_limite: e.target.value })
                            }
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            onClick={() => removeRow(idx)}
                            aria-label="Supprimer l'échéance"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Contrôle de cohérence */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">
                Total échéances :{" "}
                <span className="font-mono font-medium">
                  {formatFCFA(totalRows)}
                </span>
              </span>
              <Badge
                variant="outline"
                className={
                  totalDiff === 0
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }
              >
                {totalDiff === 0
                  ? "Équilibré"
                  : `Écart : ${formatFCFA(totalDiff)}`}
              </Badge>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Enregistrement…
                </>
              ) : isEdit ? (
                "Mettre à jour"
              ) : (
                "Créer le frais"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
