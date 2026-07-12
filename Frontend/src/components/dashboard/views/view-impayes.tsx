"use client";

/**
 * ScolaGest — Vue « Impayés & relances » (Phase 4).
 *
 * Affiche la liste des élèves ayant un solde_du > 0 (filtres optionnels :
 * classe, catégorie, "échéances passées uniquement") avec :
 *  - résumé (nb élèves en retard, total solde dû, retard max en jours) ;
 *  - table desktop + cartes mobile ;
 *  - colonne checkbox pour sélectionner plusieurs élèves ;
 *  - bouton « Générer bordereau de relance » (activé si ≥1 sélectionné) qui
 *    ouvre un Dialog imprimable.
 *
 * Le bordereau est rendu client-side à partir de la sélection (pas de
 * persistance serveur en V1). Il utilise la classe `.bordereau-print` qui,
 * couplée à la règle `@media print` de `globals.css`, masque tout le reste de
 * la page lors de l'impression.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Filter,
  Loader2,
  Printer,
  X,
  GraduationCap,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Clock,
  Users,
  Wallet,
  Timer,
  Send,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import { fetchImpayes, impayesKeys } from "@/lib/api-reports";
import { fetchClasses } from "@/lib/api-students";
import { apiPost } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { formatFCFA, formatDateShort } from "@/lib/format";
import type { ImpayeItem, ImpayesFilters } from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GlassCard } from "@/components/ds/glass-card";
import { StatCard } from "@/components/ds/stat-card";
import { KentePattern } from "@/components/ds/kente-pattern";

const CATEGORIE_OPTIONS = [
  { value: "all", label: "Toutes catégories" },
  { value: "AFFECTE", label: "Affecté" },
  { value: "NON_AFFECTE", label: "Non affecté" },
  { value: "NON_APPLICABLE", label: "Non applicable" },
];

export default function ImpayesView() {
  const etablissement = useAuthStore((s) => s.etablissement);
  const etablissementId = etablissement?.id;

  // Filtres
  const [classeId, setClasseId] = React.useState<string>("all");
  const [categorie, setCategorie] = React.useState<string>("all");
  const [echeancePassee, setEcheancePassee] = React.useState(false);

  // Sélection (élèves pour le bordereau)
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bordereauOpen, setBordereauOpen] = React.useState(false);
  const [smsSending, setSmsSending] = React.useState(false);

  // Bug 4 : Envoi SMS de relance via POST /api/messages/relance-masse
  const handleSendSMS = async () => {
    if (selected.size === 0) return;
    setSmsSending(true);
    try {
      const eleveIds = Array.from(selected);
      // Récupérer le template RELANCE (ou utiliser un template par défaut)
      const result = await apiPost<{ count: number }>("/api/messages/relance-masse", {
        eleve_ids: eleveIds,
        template_id: undefined, // le backend utilisera un template par défaut
      });
      toast({
        title: "Relances envoyées",
        description: `${(result as { count: number }).count} SMS de relance envoyé(s).`,
      });
      setSelected(new Set());
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer les relances. Vérifiez que le backend est démarré.",
        variant: "destructive",
      });
    } finally {
      setSmsSending(false);
    }
  };

  // Classes pour filtre
  const { data: classes } = useQuery({
    queryKey: ["classes", { etablissementId }],
    queryFn: () => fetchClasses(etablissementId),
    enabled: !!etablissementId,
  });

  // Debounce 300 ms
  const [debouncedFilters, setDebouncedFilters] =
    React.useState<ImpayesFilters>({});
  React.useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedFilters({
        classe_id: classeId !== "all" ? classeId : undefined,
        categorie: categorie !== "all" ? categorie : undefined,
        echeance_passee: echeancePassee,
      });
    }, 300);
    return () => clearTimeout(t);
  }, [classeId, categorie, echeancePassee]);

  const {
    data: impayes,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: impayesKeys.list(debouncedFilters),
    queryFn: () => fetchImpayes(debouncedFilters),
    enabled: !!etablissementId,
    retry: 1,
    retryDelay: 1500,
  });

  const list = impayes ?? [];

  // Stats de résumé
  const totalSolde = list.reduce((s, i) => s + (i.solde_du ?? 0), 0);
  const maxRetard = list.reduce(
    (m, i) => Math.max(m, i.nb_jours_retard_max ?? 0),
    0,
  );

  // Gestion de la sélection
  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }
  function toggleAll(checked: boolean) {
    if (checked) {
      setSelected(new Set(list.map((i) => i.eleve_id)));
    } else {
      setSelected(new Set());
    }
  }

  // Reset sélection quand la liste change
  React.useEffect(() => {
    setSelected(new Set());
  }, [classeId, categorie, echeancePassee]);

  const selectedItems = list.filter((i) => selected.has(i.eleve_id));

  return (
    <div className="space-y-4">
      <KentePattern variant="strip" position="top" />
      {/* En-tête */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
            <AlertTriangle className="size-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">
              Impayés &amp; relances
            </h1>
            <p className="text-sm text-muted-foreground">
              Suivi des soldes débiteurs, échéances en retard et génération de
              bordereaux de relance.
              {etablissement?.nom ? (
                <span className="ml-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  {etablissement.nom}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      <KentePattern variant="separator" className="my-4" />

      {!etablissementId ? (
        <GlassCard variant="adaptive" noHover className="border border-dashed">
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <Filter className="size-6" />
            </div>
            <p className="text-sm font-medium">
              Sélectionnez un établissement
            </p>
            <p className="max-w-md text-xs text-muted-foreground">
              Les impayés sont calculés par établissement. Choisissez-en un dans
              la barre latérale pour commencer.
            </p>
          </div>
        </GlassCard>
      ) : (
        <>
          {/* Filtres */}
          <GlassCard variant="adaptive" noHover>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Classe</Label>
                <Select value={classeId} onValueChange={setClasseId}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes classes</SelectItem>
                    {(classes ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.libelle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Catégorie</Label>
                <Select value={categorie} onValueChange={setCategorie}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Filtre échéances</Label>
                <div className="flex h-9 items-center justify-between gap-2 rounded-md border px-3">
                  <Label
                    htmlFor="echeance-passee"
                    className="cursor-pointer text-xs"
                  >
                    En retard uniquement
                  </Label>
                  <Switch
                    id="echeance-passee"
                    checked={echeancePassee}
                    onCheckedChange={setEcheancePassee}
                  />
                </div>
              </div>
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setClasseId("all");
                    setCategorie("all");
                    setEcheancePassee(true);
                  }}
                >
                  <Filter className="size-3.5" />
                  Réinitialiser
                </Button>
              </div>
            </div>
          </GlassCard>

          <KentePattern variant="separator" className="my-4" />

          {/* Résumé */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Élèves en retard"
              value={`${list.length}`}
              icon={Users}
              tone="amber"
              delay={0}
            />
            <StatCard
              label="Total solde dû"
              value={formatFCFA(totalSolde)}
              icon={Wallet}
              tone="terracotta"
              delay={0.05}
            />
            <StatCard
              label="Retard maximum"
              value={
                maxRetard > 0
                  ? `${maxRetard} jour${maxRetard > 1 ? "s" : ""}`
                  : "—"
              }
              icon={Timer}
              tone="terracotta"
              delay={0.1}
            />
          </div>

          {/* Barre d'actions */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {isFetching ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 className="size-3 animate-spin" /> Mise à jour…
                </span>
              ) : (
                <>
                  {list.length} élève(s) · {selected.size} sélectionné(s)
                </>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                <Loader2
                  className={cn("size-3.5", isFetching && "animate-spin")}
                />
                Actualiser
              </Button>
              <Button
                size="sm"
                variant="success"
                onClick={() => setBordereauOpen(true)}
                disabled={selected.size === 0}
              >
                <Printer className="size-3.5" />
                Bordereau {selected.size > 0 ? `(${selected.size})` : ""}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={selected.size === 0 || smsSending}
                onClick={handleSendSMS}
              >
                {smsSending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                Relance SMS {selected.size > 0 ? `(${selected.size})` : ""}
              </Button>
            </div>
          </div>

          {/* Tableau */}
          <GlassCard variant="adaptive" noHover className="overflow-hidden p-0">
            <div>
              {isLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : isError ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                    <AlertCircle className="size-6" />
                  </div>
                  <p className="text-sm font-medium">Erreur de chargement</p>
                  <p className="max-w-md text-xs text-muted-foreground">
                    Le backend n&apos;a pas pu renvoyer les impayés. Vérifiez
                    qu&apos;il est démarré puis réessayez.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetch()}
                  >
                    <Loader2 className="size-3.5" />
                    Réessayer
                  </Button>
                </div>
              ) : list.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <p className="text-sm font-medium">
                    Aucun impayé {echeancePassee ? "en retard" : ""}
                  </p>
                  <p className="max-w-md text-xs text-muted-foreground">
                    Tous les élèves sont à jour de leurs paiements sur les
                    critères sélectionnés. Belle performance !
                  </p>
                </div>
              ) : (
                <>
                  {/* Desktop */}
                  <div className="hidden overflow-x-auto md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40">
                          <TableHead className="w-10 pl-4">
                            <Checkbox
                              checked={
                                list.length > 0 &&
                                selected.size === list.length
                              }
                              onCheckedChange={(v) => toggleAll(!!v)}
                              aria-label="Sélectionner tout"
                            />
                          </TableHead>
                          <TableHead>Élève</TableHead>
                          <TableHead>Classe</TableHead>
                          <TableHead>Catégorie</TableHead>
                          <TableHead className="text-right">Solde dû</TableHead>
                          <TableHead className="text-right">
                            Éch. en retard
                          </TableHead>
                          <TableHead className="text-right pr-4">
                            Retard max
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {list.map((it) => {
                          const checked = selected.has(it.eleve_id);
                          return (
                            <TableRow
                              key={it.eleve_id}
                              className={cn(
                                "hover:bg-muted/40",
                                checked && "bg-amber-50/50 dark:bg-amber-950/20",
                              )}
                            >
                              <TableCell className="pl-4">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) =>
                                    toggleOne(it.eleve_id, !!v)
                                  }
                                  aria-label={`Sélectionner ${it.eleve_nom}`}
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium">
                                    {[
                                      it.eleve_prenoms,
                                      it.eleve_nom,
                                    ]
                                      .filter(Boolean)
                                      .join(" ")
                                      .trim() || "—"}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {it.eleve_id.slice(0, 8)}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-xs">
                                {it.classe || "—"}
                              </TableCell>
                              <TableCell>
                                <CategorieMiniBadge categorie={it.categorie} />
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-semibold text-amber-700 dark:text-amber-300">
                                {formatFCFA(it.solde_du)}
                              </TableCell>
                              <TableCell className="text-right text-xs">
                                {it.echeances_en_retard?.length ?? 0}
                              </TableCell>
                              <TableCell className="pr-4 text-right">
                                <RetardBadge jours={it.nb_jours_retard_max} />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile cards */}
                  <ul className="divide-y md:hidden">
                    {list.map((it) => {
                      const checked = selected.has(it.eleve_id);
                      return (
                        <li
                          key={it.eleve_id}
                          className={cn(
                            "p-3",
                            checked && "bg-amber-50/50 dark:bg-amber-950/20",
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) =>
                                toggleOne(it.eleve_id, !!v)
                              }
                              aria-label={`Sélectionner ${it.eleve_nom}`}
                              className="mt-1"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">
                                {[
                                  it.eleve_prenoms,
                                  it.eleve_nom,
                                ]
                                  .filter(Boolean)
                                  .join(" ")
                                  .trim() || "—"}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {it.classe} · {it.categorie}
                              </p>
                              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                <span className="font-mono text-sm font-bold text-amber-700 dark:text-amber-300">
                                  {formatFCFA(it.solde_du)}
                                </span>
                                <RetardBadge jours={it.nb_jours_retard_max} />
                              </div>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </GlassCard>
        </>
      )}

      {/* Dialog du bordereau de relance */}
      <BordereauRelanceDialog
        open={bordereauOpen}
        onOpenChange={setBordereauOpen}
        items={selectedItems}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Bordereau de relance (imprimable)
// ─────────────────────────────────────────────────────────────────────────────

function BordereauRelanceDialog({
  open,
  onOpenChange,
  items,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ImpayeItem[];
}) {
  const etablissement = useAuthStore((s) => s.etablissement);
  const user = useAuthStore((s) => s.user);
  const today = new Date().toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const totalSolde = items.reduce((s, i) => s + (i.solde_du ?? 0), 0);

  function handlePrint() {
    if (typeof window !== "undefined") {
      window.print();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl gap-0 p-0 sm:max-w-4xl">
        <DialogHeader className="no-print border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Printer className="size-5 text-amber-600" />
            Bordereau de relance
          </DialogTitle>
          <DialogDescription className="text-xs">
            Document imprimable listant les élèves sélectionnés et leurs
            soldes restants à charge. Cliquez sur « Imprimer / PDF » pour
            générer le document.
          </DialogDescription>
        </DialogHeader>

        {/* Contenu imprimable */}
        <div className="max-h-[70vh] overflow-y-auto p-6">
          <div className="bordereau-print rounded-lg border bg-white text-foreground">
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
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-[11px] uppercase tracking-wide text-amber-100">
                  Bordereau de relance
                </div>
                <div className="text-xs text-amber-50">
                  Édité le {today}
                </div>
              </div>
            </div>

            <div className="space-y-5 p-6">
              {/* Titre */}
              <div>
                <h2 className="text-center text-lg font-bold uppercase tracking-wide">
                  BORDEREAU DE RELANCE
                </h2>
                <p className="mt-1 text-center text-xs text-muted-foreground">
                  Liste des élèves dont le paiement des frais scolaires est
                  attendu. Nous prions les parents/tuteurs de bien vouloir
                  régulariser la situation dans les meilleurs délais.
                </p>
              </div>

              {/* Référence bordereau */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
                <span>
                  <strong>Réf. :</strong> BR-{new Date().getFullYear()}-
                  {String(Date.now()).slice(-6)}
                </span>
                <span>
                  <strong>Étab. :</strong>{" "}
                  {etablissement?.code_officiel ?? etablissement?.nom ?? "—"}
                </span>
                <span>
                  <strong>Édité par :</strong>{" "}
                  {user
                    ? `${user.prenoms ?? ""} ${user.nom ?? ""}`.trim()
                    : "—"}
                </span>
              </div>

              {/* Tableau des élèves */}
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="bg-amber-50 text-[11px] uppercase text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                    <tr>
                      <th className="px-3 py-2 text-left">N°</th>
                      <th className="px-3 py-2 text-left">Élève</th>
                      <th className="px-3 py-2 text-left">Classe</th>
                      <th className="px-3 py-2 text-left">
                        Échéance(s) en retard
                      </th>
                      <th className="px-3 py-2 text-right">Montant dû</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => {
                      const fullName =
                        [it.eleve_prenoms, it.eleve_nom]
                          .filter(Boolean)
                          .join(" ")
                          .trim() || "—";
                      const retards =
                        it.echeances_en_retard && it.echeances_en_retard.length > 0
                          ? it.echeances_en_retard
                              .map(
                                (e) =>
                                  `${e.libelle} (${formatDateShort(
                                    e.date_limite,
                                  )}, ${e.jours_retard}j)`,
                              )
                              .join(", ")
                          : "—";
                      return (
                        <tr
                          key={it.eleve_id}
                          className="border-t text-foreground"
                        >
                          <td className="px-3 py-2 text-xs text-muted-foreground">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2">
                            <div className="text-xs font-medium">
                              {fullName}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {it.classe || "—"}
                          </td>
                          <td className="px-3 py-2 text-[11px] text-muted-foreground">
                            {retards}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs font-semibold">
                            {formatFCFA(it.solde_du)}
                          </td>
                        </tr>
                      );
                    })}
                    {items.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-6 text-center text-xs text-muted-foreground"
                        >
                          Aucun élève sélectionné.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                  <tfoot className="bg-emerald-50 dark:bg-emerald-950/30">
                    <tr className="border-t">
                      <td
                        className="px-3 py-2 font-semibold"
                        colSpan={4}
                      >
                        Total à recouvrer ({items.length} élève
                        {items.length > 1 ? "s" : ""})
                      </td>
                      <td className="px-3 py-2 text-right text-base font-bold text-emerald-800 dark:text-emerald-300">
                        {formatFCFA(totalSolde)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mention légale */}
              <div className="rounded-md border-l-4 border-amber-500 bg-amber-50/50 p-3 text-[11px] text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                <strong>Mention importante :</strong> Le présent bordereau est
                un document de relance administrative. Il ne constitue pas une
                quittance. Les paiements effectués postérieurement à son
                édition seront pris en compte au prochain relevé.
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-2 gap-6 pt-6">
                <div className="text-center">
                  <div className="text-[11px] uppercase text-muted-foreground">
                    Le Comptable / Caissier
                  </div>
                  <div className="mt-12 text-xs font-medium">
                    {user
                      ? `${user.prenoms ?? ""} ${user.nom ?? ""}`.trim()
                      : "—"}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Signature et cachet
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-[11px] uppercase text-muted-foreground">
                    Le Directeur / Surveillant Général
                  </div>
                  <div className="mt-12 text-xs font-medium">
                    {etablissement?.nom ?? "—"}
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    Signature et cachet
                  </div>
                </div>
              </div>

              <Separator />

              {/* Pied de page */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="size-3" />
                  Document généré le {today}
                </span>
                <span>ScolaGest · Gestion &amp; Caisse Scolaire</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="no-print flex flex-col-reverse gap-2 border-t px-6 py-4 sm:flex-row sm:justify-between sm:items-center">
          <p className="text-[11px] text-muted-foreground">
            Astuce : choisissez « Enregistrer en PDF » comme imprimante pour
            générer un fichier numérique.
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
              disabled={items.length === 0}
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
// Petits composants
// ─────────────────────────────────────────────────────────────────────────────

function CategorieMiniBadge({ categorie }: { categorie: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    AFFECTE: {
      label: "Affecté",
      cls: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300",
    },
    NON_AFFECTE: {
      label: "Non affecté",
      cls: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300",
    },
    NON_APPLICABLE: {
      label: "Non applicable",
      cls: "border-muted-foreground/20 bg-muted text-muted-foreground",
    },
  };
  const e = map[categorie] ?? {
    label: categorie || "—",
    cls: "border-muted-foreground/20 bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium", e.cls)}>
      {e.label}
    </Badge>
  );
}

function RetardBadge({ jours }: { jours: number }) {
  const j = jours ?? 0;
  if (j <= 0) {
    return (
      <span className="text-xs text-muted-foreground">À jour</span>
    );
  }
  const cls =
    j >= 60
      ? "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
      : j >= 30
        ? "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300"
        : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300";
  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium tabular-nums", cls)}>
      <Clock className="size-2.5" />
      {j} j
    </Badge>
  );
}
