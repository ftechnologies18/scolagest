"use client";

/**
 * ScolaGest — Formulaire d&apos;initiation d&apos;une transaction Mobile Money (Phase 5).
 *
 * Étapes :
 *  1. Recherche d&apos;élève (autocomplete par nom/matricule).
 *  2. À la sélection, affichage compact du solde restant de l&apos;élève.
 *  3. Motif (frais optionnel) : si l&apos;élève a un solde, on peut rattacher à un
 *     frais précis.
 *  4. Montant + provider (Orange / MTN / Wave) + téléphone client.
 *  5. Bouton « Initier la transaction » → `initierTransactionMomo(dto)`.
 *
 * En mode sandbox (V1), la transaction est créée en statut INITIEE. Une
 * action « Confirmer » (manuelle) simule la réception du webhook et passe
 * la transaction à REUSSIE → un paiement est généré.
 */

import * as React from "react";
import {
  useQuery,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import {
  Smartphone,
  Loader2,
  Search,
  User,
  X,
  CheckCircle2,
  AlertCircle,
  Send,
} from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import { fetchEleves, elevesKeys } from "@/lib/api-students";
import {
  fetchSoldeEleve,
  soldesKeys,
} from "@/lib/api-caisse";
import {
  initierTransactionMomo,
  momoKeys,
} from "@/lib/api-phase5";
import { useToast } from "@/hooks/use-toast";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { formatFCFA } from "@/lib/format";
import type { Eleve, InitierMomoDTO, ProviderMomo } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProviderMomoBadge } from "@/components/mobile-money/momo-badges";

const PROVIDER_OPTIONS: {
  value: ProviderMomo;
  label: string;
  prefix: string;
}[] = [
  { value: "ORANGE_MONEY", label: "Orange Money", prefix: "+225 07" },
  { value: "MTN_MONEY", label: "MTN Money", prefix: "+225 05" },
  { value: "WAVE", label: "Wave", prefix: "+225 01" },
];

function eleveLabel(e: Eleve): string {
  return [e.prenoms, e.nom].filter(Boolean).join(" ").trim() || "—";
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant
// ─────────────────────────────────────────────────────────────────────────────

export function MomoInitierForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const prefersReducedMotion = usePrefersReducedMotion();

  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [selectedEleve, setSelectedEleve] = React.useState<Eleve | null>(null);
  const [comboboxOpen, setComboboxOpen] = React.useState(false);

  const [fraisId, setFraisId] = React.useState<string>("");
  const [montant, setMontant] = React.useState<string>("");
  const [provider, setProvider] = React.useState<ProviderMomo>("ORANGE_MONEY");
  const [telephone, setTelephone] = React.useState("");

  // Debounce recherche
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // Recherche d&apos;élève
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

  // Solde de l&apos;élève sélectionné
  const { data: solde, isLoading: loadingSolde } = useQuery({
    queryKey: soldesKeys.eleve(selectedEleve?.id ?? ""),
    queryFn: () => fetchSoldeEleve(selectedEleve!.id),
    enabled: !!selectedEleve,
  });

  // Réinitialiser le motif quand l&apos;élève change
  React.useEffect(() => {
    setFraisId("");
    setMontant("");
  }, [selectedEleve]);

  // Pré-remplir le téléphone avec celui du tuteur si disponible
  React.useEffect(() => {
    if (selectedEleve && !telephone) {
      // Pas d&apos;accès direct au téléphone ici ; on laisse l&apos;utilisateur saisir.
      // Pourrait être étendu via fetchTuteur si besoin.
    }
  }, [selectedEleve, telephone]);

  const montantNum = Number(montant) || 0;
  const soldeDu = solde?.solde_du ?? 0;
  const soldeRestant = Math.max(0, soldeDu - montantNum);
  const isOverpay = montantNum > soldeDu;

  const canSubmit =
    !!selectedEleve &&
    montantNum > 0 &&
    telephone.trim().length >= 8 &&
    !isOverpay;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedEleve) throw new Error("Sélectionnez un élève.");
      const dto: InitierMomoDTO = {
        eleve_id: selectedEleve.id,
        frais_id: fraisId && fraisId !== "__aucun" ? fraisId : null,
        montant: montantNum,
        provider,
        telephone_client: telephone.trim(),
      };
      return initierTransactionMomo(dto);
    },
    onSuccess: async (tx) => {
      await queryClient.invalidateQueries({
        queryKey: momoKeys.all,
      });
      toast({
        title: "Transaction initiée",
        description: `Référence ${tx.reference_externe || tx.id.slice(0, 8)} · ${formatFCFA(
          tx.montant,
        )} via ${tx.provider.replace("_", " ")}.`,
      });
      // Reset partiel
      setMontant("");
      setTelephone("");
      setFraisId("");
    },
    onError: (err: unknown) => {
      toast({
        title: "Échec de l'initiation",
        description:
          err instanceof Error
            ? err.message
            : "Impossible d'initier la transaction.",
        variant: "destructive",
      });
    },
  });

  function handleSelectEleve(e: Eleve) {
    setSelectedEleve(e);
    setSearch("");
    setComboboxOpen(false);
  }

  function handleClearEleve() {
    setSelectedEleve(null);
    setMontant("");
    setFraisId("");
    setTelephone("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate();
  }

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard
        variant="adaptive"
        premiumBorder
        noHover
        noAnimation
        className="relative overflow-hidden p-0"
      >
        <KentePattern variant="strip" position="top" />

        {/* Header premium : icône dans badge rond emerald + titre */}
        <div className="flex items-center gap-3 border-b border-emerald-100/60 bg-emerald-50/40 px-5 py-4 dark:border-emerald-900/30 dark:bg-emerald-950/15">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Smartphone className="size-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-forest">
              Nouvelle transaction Mobile Money
            </h2>
            <p className="text-xs text-muted-foreground">
              Orange Money · MTN Money · Wave
            </p>
          </div>
        </div>

        <div className="space-y-4 p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Recherche d&apos;élève */}
          <div className="space-y-1.5">
            <Label>Élève concerné</Label>
            {selectedEleve ? (
              <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {eleveLabel(selectedEleve)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
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
                              <div className="flex size-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                                <User className="size-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">
                                  {eleveLabel(e)}
                                </p>
                                <p className="truncate text-xs text-muted-foreground">
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

          {/* Solde élève */}
          {selectedEleve && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              {loadingSolde ? (
                <Skeleton className="h-12 w-full" />
              ) : solde ? (
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] uppercase text-muted-foreground">
                      Solde dû
                    </p>
                    <p className="font-mono text-sm font-bold text-rose-700 dark:text-rose-300">
                      {formatFCFA(solde.solde_du)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] uppercase text-muted-foreground">
                      Payé / attendu
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {formatFCFA(solde.total_paye)} /{" "}
                      {formatFCFA(solde.total_attendu)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Solde indisponible.
                </p>
              )}
            </div>
          )}

          {/* Motif (frais) — optionnel */}
          {selectedEleve && solde && solde.frais_attendus.length > 0 && (
            <div className="space-y-1.5">
              <Label>Frais rattaché (optionnel)</Label>
              <Select value={fraisId} onValueChange={setFraisId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Aucun frais précis (avance)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__aucun">Aucun frais précis (avance)</SelectItem>
                  {solde.frais_attendus.map((sf) => (
                    <SelectItem key={sf.frais_id} value={sf.frais_id}>
                      {sf.libelle} · solde {formatFCFA(sf.solde)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Provider */}
          <div className="space-y-1.5">
            <Label>Provider Mobile Money</Label>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as ProviderMomo)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <ProviderMomoBadge provider={opt.value} />
                    <span className="ml-2">{opt.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Montant + téléphone */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="momo-montant">Montant (FCFA)</Label>
              <Input
                id="momo-montant"
                type="number"
                min={0}
                step="500"
                value={montant}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="Ex. 50000"
                className="font-mono"
              />
              {selectedEleve && soldeDu > 0 && montantNum > 0 && (
                <p
                  className={cn(
                    "text-[11px]",
                    isOverpay
                      ? "text-rose-600 dark:text-rose-400"
                      : "text-muted-foreground",
                  )}
                >
                  {isOverpay ? (
                    <>
                      <AlertCircle className="mr-1 inline size-3" />
                      Trop-perçu : {formatFCFA(montantNum - soldeDu)} au-delà du
                      solde dû.
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="mr-1 inline size-3 text-emerald-600" />
                      Solde restant après : {formatFCFA(soldeRestant)}
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="momo-tel">Téléphone client</Label>
              <Input
                id="momo-tel"
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="Ex. 0701020304"
                className="font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                Numéro Mobile Money du payeur (sans espaces).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-2.5 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300">
            <Smartphone className="mt-0.5 size-3.5 shrink-0" />
            <span>
              <strong>Mode sandbox :</strong> la transaction est créée en
              statut <strong>INITIEE</strong>. Vous pourrez la confirmer
              manuellement depuis l&apos;onglet « Transactions » pour simuler la
              réception du webhook et générer le paiement.
            </span>
          </div>

          <Button
            type="submit"
            disabled={!canSubmit || mutation.isPending}
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Initier la transaction {montantNum > 0 ? `· ${formatFCFA(montantNum)}` : ""}
          </Button>
        </form>
        </div>
      </GlassCard>
    </motion.div>
  );
}
