"use client";

/**
 * ScolaGest — Formulaire d'encaissement (Phase 3 — cœur de la caisse).
 *
 * Étapes :
 *  1. Recherche d'élève (autocomplete par nom/matricule).
 *  2. À la sélection, affichage d'une carte « Solde » :
 *     - tableau des frais attendus (type, libellé, attendu, payé, solde)
 *     - statut des échéances.
 *  3. Motif : choix d'un frais parmi les frais_attendus + (option) une
 *     échéance spécifique.
 *  4. Montant (FCFA) avec affichage live du solde restant + alerte si
 *     montant > solde.
 *  5. Mode de paiement (Espèces / Chèque / Virement / Mobile Money). Si MoMo,
 *     provider (Orange/MTN/Wave) + référence. Si chèque : n° + banque.
 *  6. Date de paiement (défaut = aujourd'hui).
 *  7. Bouton « Encaisser » (emerald). Succès → toast + ouverture du reçu.
 *
 * Toutes les mutations invalident les caches `paiementsKeys`, `soldesKeys`.
 */

import * as React from "react";
import {
  useQuery,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import {
  Search,
  Loader2,
  Wallet,
  AlertCircle,
  CheckCircle2,
  User,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  fetchEleves,
  elevesKeys,
} from "@/lib/api-students";
import {
  fetchSoldeEleve,
  createPaiement,
  paiementsKeys,
  soldesKeys,
} from "@/lib/api-caisse";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA, formatDateShort, todayISO, dateInputToISO } from "@/lib/format";
import type {
  Eleve,
  ModePaiement,
  Paiement,
  SoldeEleve,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GlassCard } from "@/components/ds/glass-card";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  StatutEcheanceBadge,
  TypeFraisBadge,
} from "./caisse-badges";
import { RecuDialog } from "./recu-dialog";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers locaux
// ─────────────────────────────────────────────────────────────────────────────

const MODE_OPTIONS: { value: ModePaiement; label: string; desc: string }[] = [
  { value: "ESPECES", label: "Espèces", desc: "Encaissement en numéraire" },
  { value: "CHEQUE", label: "Chèque", desc: "Chèque bancaire" },
  { value: "VIREMENT", label: "Virement", desc: "Virement bancaire" },
  {
    value: "MOBILE_MONEY",
    label: "Mobile Money",
    desc: "Orange / MTN / Wave",
  },
];

const PROVIDER_OPTIONS = ["Orange Money", "MTN MoMo", "Wave"] as const;

function eleveLabel(e: Eleve): string {
  return [e.prenoms, e.nom].filter(Boolean).join(" ").trim() || "—";
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function PaiementEntryForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // État local
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [selectedEleve, setSelectedEleve] = React.useState<Eleve | null>(null);
  const [comboboxOpen, setComboboxOpen] = React.useState(false);

  const [fraisId, setFraisId] = React.useState<string>("");
  const [echeanceId, setEcheanceId] = React.useState<string>("");
  const [montant, setMontant] = React.useState<string>("");
  const [mode, setMode] = React.useState<ModePaiement>("ESPECES");
  const [provider, setProvider] = React.useState<string>(PROVIDER_OPTIONS[0]);
  const [reference, setReference] = React.useState<string>("");
  const [banque, setBanque] = React.useState<string>("");
  const [datePaiement, setDatePaiement] = React.useState<string>(todayISO());

  const [paiementCree, setPaiementCree] = React.useState<Paiement | null>(null);
  const [recuOpen, setRecuOpen] = React.useState(false);

  // Debounce recherche
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Recherche d'élève
  const { data: elevesResult, isFetching: searching } = useQuery({
    queryKey: elevesKeys.list({
      search: debouncedSearch || undefined,
      page: 1,
      page_size: 10,
    }),
    queryFn: () =>
      fetchEleves({
        search: debouncedSearch || undefined,
        page: 1,
        page_size: 10,
      }),
    enabled: debouncedSearch.length >= 2 && !selectedEleve,
  });
  const searchResults = elevesResult?.data ?? [];

  // Solde de l'élève sélectionné
  const {
    data: solde,
    isLoading: loadingSolde,
    isError: soldeError,
    refetch: refetchSolde,
  } = useQuery({
    queryKey: soldesKeys.eleve(selectedEleve?.id ?? ""),
    queryFn: () => fetchSoldeEleve(selectedEleve!.id),
    enabled: !!selectedEleve,
  });

  // Réinitialiser le motif quand l'élève change
  React.useEffect(() => {
    setFraisId("");
    setEcheanceId("");
    setMontant("");
  }, [selectedEleve]);

  // Faisabilité du paiement
  const montantNum = Number(montant) || 0;
  const soldeDu = solde?.solde_du ?? 0;
  const soldeRestant = Math.max(0, soldeDu - montantNum);
  const isOverpay = montantNum > soldeDu;

  const canSubmit =
    !!selectedEleve && montantNum > 0 && (!!fraisId || soldeDu > 0);

  // Mutation
  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedEleve) throw new Error("Sélectionnez un élève.");
      const referenceExterne = [reference, banque].filter(Boolean).join(" · ");
      const realFraisId =
        fraisId && fraisId !== "__avance" ? fraisId : null;
      const realEcheanceId =
        echeanceId && echeanceId !== "__aucune" ? echeanceId : null;
      return createPaiement({
        eleve_id: selectedEleve.id,
        frais_id: realFraisId,
        echeance_id: realEcheanceId,
        montant: montantNum,
        mode_paiement: mode,
        provider_momo: mode === "MOBILE_MONEY" ? provider : null,
        reference_externe: referenceExterne || undefined,
        date_paiement: datePaiement ? dateInputToISO(datePaiement) : undefined,
      });
    },
    onSuccess: async (paiement) => {
      // Invalide les caches
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: paiementsKeys.all }),
        queryClient.invalidateQueries({ queryKey: soldesKeys.all }),
      ]);
      toast({
        title: "Encaissement réussi",
        description: `Reçu ${paiement.numero_recu} · ${formatFCFA(
          paiement.montant,
        )} encaissés.`,
      });
      setPaiementCree(paiement);
      setRecuOpen(true);
      // Refresh le solde
      refetchSolde();
      // Reset partiel
      setMontant("");
      setReference("");
      setBanque("");
      setEcheanceId("");
    },
    onError: (err: unknown) => {
      toast({
        title: "Échec de l'encaissement",
        description:
          err instanceof Error
            ? err.message
            : "Impossible d'enregistrer le paiement.",
        variant: "destructive",
      });
    },
  });

  // ─── Handlers ───────────────────────────────────────────────────────────
  function handleSelectEleve(e: Eleve) {
    setSelectedEleve(e);
    setSearch("");
    setComboboxOpen(false);
  }

  function handleClearEleve() {
    setSelectedEleve(null);
    setMontant("");
    setFraisId("");
    setEcheanceId("");
  }

  // Liste des échéances pour le frais sélectionné (à venir / partielles)
  const echeancesPourFrais = React.useMemo(() => {
    if (!solde) return [];
    return solde.echeances_a_venir.filter((e) => {
      // On garde toutes les échéances à venir ou partielles, mais on n'a pas
      // le frais_id direct dans EcheanceStatut ; le backend doit le renvoyer
      // ou bien on l'associe par ordre. Simplification : on garde tout.
      return e.statut !== "PAYE";
    });
  }, [solde]);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Colonne principale : formulaire */}
      <div className="space-y-4 lg:col-span-2">
        <GlassCard variant="adaptive" noHover>
          <div className="mb-4 flex items-center gap-2">
            <Wallet className="size-4 text-emerald-600" />
            <h3 className="font-display text-base font-semibold">Nouvel encaissement</h3>
          </div>
          <div className="space-y-4">
            {/* Recherche d'élève */}
            <div className="space-y-1.5">
              <Label>Élève</Label>
              {selectedEleve ? (
                <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium leading-snug">
                      {eleveLabel(selectedEleve)}
                    </p>
                    <p className="break-words text-xs leading-snug text-muted-foreground">
                      {selectedEleve.identifiant_interne}
                      {selectedEleve.inscription_courante?.classe_libelle
                        ? ` · ${selectedEleve.inscription_courante.classe_libelle}`
                        : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={handleClearEleve}
                    aria-label="Changer d'élève"
                    title="Changer d'élève"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                  <PopoverTrigger asChild>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(e) => {
                          setSearch(e.target.value);
                          setComboboxOpen(true);
                        }}
                        onFocus={() => setComboboxOpen(true)}
                        placeholder="Rechercher par nom ou matricule…"
                        className="pl-8"
                      />
                      {searching ? (
                        <Loader2 className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                      ) : null}
                    </div>
                  </PopoverTrigger>
                  <PopoverContent
                    className="p-0"
                    align="start"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <div className="max-h-72 overflow-y-auto">
                      {debouncedSearch.length < 2 ? (
                        <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                          Saisissez au moins 2 caractères.
                        </p>
                      ) : searchResults.length === 0 ? (
                        <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                          Aucun élève trouvé.
                        </p>
                      ) : (
                        <ul className="divide-y">
                          {searchResults.map((e) => (
                            <li key={e.id}>
                              <button
                                type="button"
                                onClick={() => handleSelectEleve(e)}
                                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                              >
                                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                                  {eleveLabel(e).charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="break-words font-medium leading-snug">
                                    {eleveLabel(e)}
                                  </p>
                                  <p className="break-words text-xs leading-snug text-muted-foreground">
                                    {e.identifiant_interne}
                                    {e.inscription_courante?.classe_libelle
                                      ? ` · ${e.inscription_courante.classe_libelle}`
                                      : ""}
                                  </p>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Motif (frais) — visible seulement si élève sélectionné */}
            {selectedEleve && solde ? (
              <div className="space-y-1.5">
                <Label>Motif du paiement</Label>
                <Select value={fraisId} onValueChange={(v) => { setFraisId(v); setEcheanceId(""); }}>
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={
                        solde.frais_attendus.length === 0
                          ? "Aucun frais attendu (régularisation)"
                          : "Sélectionner un frais…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__avance">Avance / régularisation</SelectItem>
                    {solde.frais_attendus.map((sf) => (
                      <SelectItem key={sf.frais_id} value={sf.frais_id}>
                        {sf.libelle} · solde {formatFCFA(sf.solde)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {echeancesPourFrais.length > 0 ? (
                  <Select value={echeanceId} onValueChange={setEcheanceId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Échéance (optionnel)…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__aucune">Aucune échéance précise</SelectItem>
                      {echeancesPourFrais.map((e) => (
                        <SelectItem key={e.echeance_id} value={e.echeance_id}>
                          {e.libelle} · {formatFCFA(e.montant - e.montant_paye)}{" "}
                          restant · {formatDateShort(e.date_limite)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
            ) : null}

            {/* Montant */}
            <div className="space-y-1.5">
              <Label htmlFor="montant">Montant encaissé (FCFA)</Label>
              <Input
                id="montant"
                type="number"
                min={0}
                step="500"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="Ex. 60000"
                className="font-mono"
                disabled={!selectedEleve}
              />
              {selectedEleve && solde ? (
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    Solde restant après encaissement :{" "}
                    <span
                      className={cn(
                        "font-mono font-medium",
                        soldeRestant === 0
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-foreground",
                      )}
                    >
                      {formatFCFA(soldeRestant)}
                    </span>
                  </span>
                  {isOverpay ? (
                    <span className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-300">
                      <AlertCircle className="size-3.5" />
                      Trop-perçu de {formatFCFA(montantNum - soldeDu)}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>

            {/* Mode de paiement */}
            <div className="space-y-1.5">
              <Label>Mode de paiement</Label>
              <RadioGroup
                value={mode}
                onValueChange={(v) => setMode(v as ModePaiement)}
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
              >
                {MODE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    htmlFor={`mode-${opt.value}`}
                    className={cn(
                      "flex cursor-pointer flex-col gap-0.5 rounded-lg border p-2.5 text-xs transition-colors",
                      mode === opt.value
                        ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                        : "hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem id={`mode-${opt.value}`} value={opt.value} />
                      <span className="font-medium">{opt.label}</span>
                    </div>
                    <span className="pl-5 text-[10px] text-muted-foreground">
                      {opt.desc}
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </div>

            {/* Champs conditionnels : MoMo / Chèque */}
            {mode === "MOBILE_MONEY" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="provider">Opérateur Mobile Money</Label>
                  <Select value={provider} onValueChange={setProvider}>
                    <SelectTrigger id="provider" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDER_OPTIONS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ref-momo">Référence transaction</Label>
                  <Input
                    id="ref-momo"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Ex. TXN-20260115-001"
                  />
                </div>
              </div>
            ) : null}

            {mode === "CHEQUE" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="num-cheque">N° de chèque</Label>
                  <Input
                    id="num-cheque"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Ex. 0123456"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="banque">Banque</Label>
                  <Input
                    id="banque"
                    value={banque}
                    onChange={(e) => setBanque(e.target.value)}
                    placeholder="Ex. Ecobank Dabou"
                  />
                </div>
              </div>
            ) : null}

            {mode === "VIREMENT" ? (
              <div className="space-y-1.5">
                <Label htmlFor="ref-virement">Référence virement</Label>
                <Input
                  id="ref-virement"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Ex. VIR-2026-001234"
                />
              </div>
            ) : null}

            {/* Date */}
            <div className="space-y-1.5">
              <Label htmlFor="date-paiement">Date du paiement</Label>
              <Input
                id="date-paiement"
                type="date"
                value={datePaiement}
                onChange={(e) => setDatePaiement(e.target.value)}
                max={todayISO()}
              />
            </div>

            {/* Submit */}
            <div className="grid grid-cols-2 gap-2 border-t pt-3 sm:flex sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setMontant("");
                  setReference("");
                  setBanque("");
                  setEcheanceId("");
                  setMode("ESPECES");
                }}
                disabled={!selectedEleve || mutation.isPending}
                className="w-full sm:w-auto"
                title="Réinitialiser le formulaire"
              >
                Réinitialiser
              </Button>
              <Button
                type="button"
                variant="success"
                disabled={!canSubmit || mutation.isPending}
                onClick={() => mutation.mutate()}
                className="w-full sm:w-auto"
                title="Valider l'encaissement et générer le reçu"
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Encaissement…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" />
                    Encaisser {montantNum > 0 ? formatFCFA(montantNum) : ""}
                  </>
                )}
              </Button>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Colonne latérale : solde */}
      <div className="space-y-4">
        <SoldeCard
          eleve={selectedEleve}
          solde={solde}
          loading={loadingSolde}
          error={soldeError}
        />
      </div>

      {/* Reçu dialog (succès) */}
      <RecuDialog
        open={recuOpen}
        onOpenChange={setRecuOpen}
        paiement={paiementCree ?? undefined}
        paiementId={paiementCree?.id}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Carte Solde (lateral)
// ─────────────────────────────────────────────────────────────────────────────

function SoldeCard({
  eleve,
  solde,
  loading,
  error,
}: {
  eleve: Eleve | null;
  solde?: SoldeEleve;
  loading: boolean;
  error: boolean;
}) {
  if (!eleve) {
    return (
      <GlassCard variant="adaptive" noHover className="border-dashed">
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <User className="size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            Sélectionnez un élève pour afficher son solde.
          </p>
        </div>
      </GlassCard>
    );
  }
  if (loading) {
    return (
      <GlassCard variant="adaptive" noHover className="overflow-hidden p-0">
        <div className="px-5 py-4">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="space-y-2 px-5 pb-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </GlassCard>
    );
  }
  if (error || !solde) {
    return (
      <GlassCard variant="adaptive" noHover className="border-amber-200 bg-amber-50/40 dark:border-amber-900/40 dark:bg-amber-950/10">
        <div className="flex items-center gap-2 py-6 text-sm">
          <AlertCircle className="size-4 text-amber-600" />
          <span className="text-amber-800 dark:text-amber-300">
            Solde indisponible pour cet élève. Vous pouvez tout même encaisser
            un paiement.
          </span>
        </div>
      </GlassCard>
    );
  }

  const isSolde = solde.solde_du <= 0;
  return (
    <GlassCard
      variant="adaptive"
      noHover
      className={cn(
        "overflow-hidden",
        isSolde
          ? "border-emerald-200 dark:border-emerald-900/50"
          : "border-amber-200 dark:border-amber-900/40",
      )}
    >
      <div className="mb-3">
        <h3 className="font-display text-sm font-semibold">Solde de l&apos;élève</h3>
      </div>
      <div className="space-y-3">
        {/* Totaux */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border bg-muted/20 p-2">
            <p className="text-[10px] uppercase text-muted-foreground">
              Attendu
            </p>
            <p className="font-mono text-sm font-semibold">
              {formatFCFA(solde.total_attendu)}
            </p>
          </div>
          <div className="rounded-lg border bg-emerald-50 p-2 dark:bg-emerald-950/20">
            <p className="text-[10px] uppercase text-emerald-700 dark:text-emerald-300">
              Payé
            </p>
            <p className="font-mono text-sm font-semibold text-emerald-700 dark:text-emerald-300">
              {formatFCFA(solde.total_paye)}
            </p>
          </div>
          <div
            className={cn(
              "rounded-lg border p-2",
              isSolde
                ? "bg-emerald-50 dark:bg-emerald-950/20"
                : "bg-amber-50 dark:bg-amber-950/20",
            )}
          >
            <p
              className={cn(
                "text-[10px] uppercase",
                isSolde
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-amber-700 dark:text-amber-300",
              )}
            >
              Restant
            </p>
            <p
              className={cn(
                "font-mono text-sm font-bold",
                isSolde
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-amber-700 dark:text-amber-300",
              )}
            >
              {formatFCFA(solde.solde_du)}
            </p>
          </div>
        </div>

        {/* Détail par frais */}
        {solde.frais_attendus.length > 0 ? (
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-[11px]">Frais</TableHead>
                  <TableHead className="text-right text-[11px]">Solde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {solde.frais_attendus.map((sf) => (
                  <TableRow key={sf.frais_id}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium">
                          {sf.libelle}
                        </span>
                        <TypeFraisBadge type={sf.type_frais} />
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={cn(
                          "font-mono text-xs font-semibold",
                          sf.solde <= 0
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {formatFCFA(sf.solde)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="rounded-md border border-dashed bg-muted/20 px-3 py-3 text-xs text-muted-foreground">
            Aucun frais attendu pour cet élève.
          </p>
        )}

        {/* Échéances */}
        {solde.echeances_a_venir.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase text-muted-foreground">
              Prochaines échéances
            </p>
            <ul className="space-y-1">
              {solde.echeances_a_venir.slice(0, 4).map((e) => (
                <li
                  key={e.echeance_id}
                  className="flex items-center justify-between rounded-md border px-2 py-1.5 text-xs"
                >
                  <div className="min-w-0">
                    <p className="break-words font-medium leading-snug">{e.libelle}</p>
                    <p className="break-words text-[10px] leading-snug text-muted-foreground">
                      {formatDateShort(e.date_limite)} ·{" "}
                      {formatFCFA(e.montant - e.montant_paye)} restant
                    </p>
                  </div>
                  <StatutEcheanceBadge statut={e.statut} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </GlassCard>
  );
}
