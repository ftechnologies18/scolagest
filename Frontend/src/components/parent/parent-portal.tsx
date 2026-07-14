"use client";

/**
 * ScolaGest — Portail Parent (Phase 6 — Refonte Forêt EdTech).
 *
 * Interface simplifiée et rassurante pour les parents/tuteurs. Contrairement au
 * tableau de bord du personnel (sidebar + RBAC), le portail parent est une
 * page unique à sections ancrées :
 *
 *   1. « Mes enfants »   : grille de cartes premium (avatar ring gold,
 *                          ProgressCircle mini, badges renforcés, boutons
 *                          Voir détail / Payer en ligne / Payer à l'école).
 *   2. « Historique »    : table des paiements récents (filtrable par enfant),
 *                          clic sur une ligne → reçu imprimable.
 *   3. « Échéances »     : timeline verticale des prochaines échéances (tous
 *                          enfants), bordure gauche emerald, points colorés
 *                          selon statut, GlassCard mobile par échéance.
 *
 * Header « wahou » : KentePattern strip top + bandeau gradient emerald→amber +
 * logo + nom parent + avatar avec badge gold + KentePattern strip bottom +
 * glassmorphism (backdrop-blur).
 *
 * Bandeau d'accueil : GlassCard premium avec bordure gold + KentePattern bg
 * subtil + ProgressCircle animé (taux paiement global) + 3 StatCards (Total
 * dû / Total payé / Total attendu) + message personnalisé « Bonjour {prénom} ».
 *
 * Toutes les données proviennent des endpoints `/api/parent/*` (clés React
 * Query : `parentKeys`). Le portail rend gracieusement en cas d'erreur backend
 * (états vides / messages d'erreur avec KentePattern bg).
 *
 * LOGIQUE MÉTIER INTACTE : hooks React Query (fetchEnfants, fetchPaiementsParent,
 * fetchEcheancesParent, parentKeys), useParentPWA(), helpers (initials,
 * categorieLabel, modePaiementLabel), refs scroll ancré, dialogs wiring.
 */

import * as React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  LogOut,
  Users,
  Wallet,
  CalendarClock,
  Receipt,
  Download,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  AlertCircle,
  RefreshCw,
  Heart,
  Smartphone,
  Landmark,
  Scale,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { ProgressCircle } from "@/components/ds/progress-circle";
import { StatCard } from "@/components/ds/stat-card";
import { Footer } from "@/components/ds/footer";
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

import { useAuthStore } from "@/lib/auth-store";
import { useToast } from "@/hooks/use-toast";
// PWA parent : enregistre le service worker pour le mode hors-ligne
// (cache du shell `/parent` + `/portal` + fallback API). Le hook est une
// amélioration progressive — aucune erreur n'est remontée à l'utilisateur.
import { useParentPWA } from "@/hooks/use-parent-pwa";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import {
  fetchEnfants,
  fetchEcheancesParent,
  fetchPaiementsParent,
  parentKeys,
  type EnfantParent,
  type EcheanceParent,
  type PaiementParent,
} from "@/lib/api-parent";
import { formatFCFA, formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

import { EnfantDetailDialog } from "./enfant-detail-dialog";
import { RecuDialogParent } from "./recu-dialog";
import { PaymentMomoDialog } from "./payment-momo-dialog";
import { RecapCaisseDialog } from "./recap-caisse-dialog";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

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

function modePaiementLabel(mode: string): string {
  switch (mode) {
    case "ESPECES":
      return "Espèces";
    case "CHEQUE":
      return "Chèque";
    case "VIREMENT":
      return "Virement";
    case "MOBILE_MONEY":
      return "Mobile Money";
    default:
      return mode;
  }
}

function modePaiementClass(mode: string): string {
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

function statutPaiementLabel(statut: string): string {
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

function statutPaiementClass(statut: string): string {
  switch (statut) {
    case "VALIDE":
      return "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
    case "ANNULE":
      return "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200";
    case "EN_ATTENTE":
      return "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200";
    default:
      return "border-muted-foreground/30 bg-muted text-muted-foreground";
  }
}

function statutEcheanceLabel(statut: string): string {
  switch (statut) {
    case "A_VENIR":
      return "À venir";
    case "EN_RETARD":
      return "En retard";
    case "PARTIEL":
      return "Partiel";
    case "PAYE":
      return "Payée";
    default:
      return statut;
  }
}

function statutEcheanceClass(statut: string): string {
  switch (statut) {
    case "EN_RETARD":
      return "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200";
    case "PARTIEL":
      return "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200";
    case "A_VENIR":
      return "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
    case "PAYE":
      return "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200";
    default:
      return "border-muted-foreground/30 bg-muted text-muted-foreground";
  }
}

type SectionId = "enfants" | "historique" | "echeances";

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export function ParentPortal() {
  const { toast } = useToast();
  // Le portail parent s'appuie sur `tuteur` (renvoyé par /api/parent/access).
  // L'utilisateur staff (`user`) reste null pour ce flux.
  const tuteur = useAuthStore((s) => s.tuteur);
  const etablissement = useAuthStore((s) => s.etablissement);
  const logoutParent = useAuthStore((s) => s.logoutParent);

  // PWA — enregistre le service worker parent (offline + cache API).
  // Sur la route `/portal`, le hook détecte automatiquement la route et
  // enregistre `/sw-parent.js`. Aucune interférence avec les routes staff.
  useParentPWA();

  // État UI
  const [activeSection, setActiveSection] =
    React.useState<SectionId>("enfants");
  const [filterEleveId, setFilterEleveId] = React.useState<string>("all");
  const [selectedEnfant, setSelectedEnfant] =
    React.useState<EnfantParent | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [selectedPaiement, setSelectedPaiement] =
    React.useState<PaiementParent | null>(null);
  const [recuOpen, setRecuOpen] = React.useState(false);
  // Dialogues de paiement (Phase 6 redesign)
  const [momoEnfant, setMomoEnfant] = React.useState<EnfantParent | null>(null);
  const [momoOpen, setMomoOpen] = React.useState(false);
  const [recapEnfant, setRecapEnfant] = React.useState<EnfantParent | null>(
    null,
  );
  const [recapOpen, setRecapOpen] = React.useState(false);

  // Refs pour le scroll ancré
  const enfantsRef = React.useRef<HTMLDivElement>(null);
  const historiqueRef = React.useRef<HTMLDivElement>(null);
  const echeancesRef = React.useRef<HTMLDivElement>(null);

  // Requêtes React Query
  const {
    data: enfants,
    isLoading: loadingEnfants,
    isError: errorEnfants,
    refetch: refetchEnfants,
  } = useQuery({
    queryKey: parentKeys.enfants(),
    queryFn: fetchEnfants,
    retry: 1,
    retryDelay: 1500,
  });

  const {
    data: echeances,
    isLoading: loadingEcheances,
    isError: errorEcheances,
  } = useQuery({
    queryKey: parentKeys.echeances(),
    queryFn: fetchEcheancesParent,
    retry: 1,
    retryDelay: 1500,
  });

  const {
    data: paiements,
    isLoading: loadingPaiements,
    isError: errorPaiements,
  } = useQuery({
    queryKey: parentKeys.paiements({ eleveId: filterEleveId, limit: 50 }),
    queryFn: () =>
      fetchPaiementsParent(
        filterEleveId === "all" ? undefined : filterEleveId,
        50,
      ),
    retry: 1,
    retryDelay: 1500,
  });

  // Calcul du solde dû total + taux de paiement global (tous enfants)
  const { totalSoldeDu, totalAttendu, totalPaye } = React.useMemo(() => {
    if (!enfants || enfants.length === 0) {
      return { totalSoldeDu: 0, totalAttendu: 0, totalPaye: 0 };
    }
    return enfants.reduce(
      (acc, e) => {
        const solde = e.solde ?? { solde_du: 0, total_attendu: 0, total_paye: 0 };
        return {
          totalSoldeDu: acc.totalSoldeDu + (solde.solde_du ?? 0),
          totalAttendu: acc.totalAttendu + (solde.total_attendu ?? 0),
          totalPaye: acc.totalPaye + (solde.total_paye ?? 0),
        };
      },
      { totalSoldeDu: 0, totalAttendu: 0, totalPaye: 0 },
    );
  }, [enfants]);

  const parentPrenom =
    tuteur?.prenoms?.trim() || tuteur?.nom?.trim() || "chers parents";

  function scrollToSection(section: SectionId) {
    setActiveSection(section);
    const refMap: Record<SectionId, React.RefObject<HTMLDivElement | null>> = {
      enfants: enfantsRef,
      historique: historiqueRef,
      echeances: echeancesRef,
    };
    const ref = refMap[section];
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function handleVoirDetail(enfant: EnfantParent) {
    setSelectedEnfant(enfant);
    setDetailOpen(true);
  }

  function handleVoirHistoriqueDepuisDetail(enfant: EnfantParent) {
    setFilterEleveId(enfant.id);
    // Laisse le temps au rendu de se stabiliser avant le scroll.
    setTimeout(() => scrollToSection("historique"), 100);
  }

  function handleVoirRecu(p: PaiementParent) {
    setSelectedPaiement(p);
    setRecuOpen(true);
  }

  function handlePayerEnLigne(enfant: EnfantParent) {
    setMomoEnfant(enfant);
    setMomoOpen(true);
  }

  function handlePayerALecole(enfant: EnfantParent) {
    setRecapEnfant(enfant);
    setRecapOpen(true);
  }

  function handleLogout() {
    logoutParent();
    toast({
      title: "Déconnexion",
      description: "Vous avez été déconnecté avec succès.",
    });
  }

  // ───────────────────────────────────────────────────────────────────────────
  // Rendu
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-gradient-to-br from-emerald-50/60 via-background to-amber-50/40">
      {/* Texture kente subtile en fond (max 10% opacity) */}
      <KentePattern variant="bg" className="opacity-[0.08]" />

      {/* Header « wahou » */}
      <header className="sticky top-0 z-30 shrink-0">
        {/* Strip kente top */}
        <KentePattern variant="strip" position="top" />

        {/* Bandeau gradient emerald→amber + glassmorphism */}
        <div className="relative border-b border-emerald-200/60 bg-gradient-to-r from-emerald-700 via-emerald-600 to-amber-500/90 backdrop-blur supports-[backdrop-filter]:bg-gradient-to-r supports-[backdrop-filter]:from-emerald-700/95 supports-[backdrop-filter]:via-emerald-600/95 supports-[backdrop-filter]:to-amber-500/85">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Image
                  src="/logo.png"
                  alt="ScolaGest"
                  width={40}
                  height={40}
                  className="rounded-xl bg-white/95 p-0.5 shadow-md shadow-emerald-900/30 ring-1 ring-gold/40"
                />
                <span
                  aria-hidden
                  className="absolute -bottom-1 -right-1 flex size-4 items-center justify-center rounded-full bg-gold text-[8px] font-bold text-emerald-900 ring-2 ring-white"
                >
                  ★
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-bold leading-tight text-white">
                  ScolaGest
                </p>
                <p className="break-words text-[11px] leading-tight text-emerald-50/90">
                  Portail Parent ·{" "}
                  {etablissement?.nom ?? "Groupe Le Chandelier — Dabou"}
                </p>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <div className="hidden text-right sm:block">
                <p className="break-words text-xs font-semibold leading-tight text-white">
                  {tuteur
                    ? `${tuteur.prenoms ?? ""} ${tuteur.nom ?? ""}`.trim() ||
                      "Parent"
                    : "Parent"}
                </p>
                <p className="break-all text-[10px] leading-tight text-emerald-50/80">
                  {tuteur?.telephone ?? "Parent / Tuteur"}
                </p>
              </div>
              <div className="relative">
                <Avatar className="size-9 ring-2 ring-gold/70">
                  <AvatarFallback className="bg-amber-600 text-xs font-bold text-white">
                    {initials(tuteur?.nom, tuteur?.prenoms)}
                  </AvatarFallback>
                </Avatar>
                <span
                  aria-hidden
                  className="absolute -bottom-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-gold text-[8px] text-emerald-900 ring-2 ring-white"
                >
                  ★
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="hidden border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white sm:inline-flex"
                title="Se déconnecter du portail parent"
              >
                <LogOut className="size-4" />
                Déconnexion
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="text-white hover:bg-white/20 hover:text-white sm:hidden"
                aria-label="Déconnexion"
                title="Se déconnecter"
              >
                <LogOut className="size-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Navigation ancrée premium */}
        <nav className="border-b border-emerald-200/60 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70">
          <div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-2 sm:px-6">
            <NavTab
              icon={<Users className="size-4" />}
              label="Mes enfants"
              active={activeSection === "enfants"}
              onClick={() => scrollToSection("enfants")}
            />
            <NavTab
              icon={<Receipt className="size-4" />}
              label="Historique"
              active={activeSection === "historique"}
              onClick={() => scrollToSection("historique")}
            />
            <NavTab
              icon={<CalendarClock className="size-4" />}
              label="Échéances"
              active={activeSection === "echeances"}
              onClick={() => scrollToSection("echeances")}
            />
          </div>
        </nav>

        {/* KentePattern separator sous la nav */}
        <KentePattern variant="separator" />
      </header>

      {/* Contenu principal scrollable — le footer est hors du main pour
          rester toujours visible en bas du viewport (sticky flex). */}
      <main className="relative mx-auto w-full max-w-6xl flex-1 overflow-y-auto px-4 py-6 pb-20 sm:px-6 sm:py-8 sm:pb-24">
        {/* Bandeau d'accueil enrichi */}
        <WelcomeBanner
          parentPrenom={parentPrenom}
          nbEnfants={enfants?.length ?? 0}
          totalSoldeDu={totalSoldeDu}
          totalAttendu={totalAttendu}
          totalPaye={totalPaye}
          loading={loadingEnfants}
          error={errorEnfants}
        />

        <KentePattern variant="separator" className="my-6" />

        {/* Section 1 : Mes enfants */}
        <section
          ref={enfantsRef}
          className="mt-8 scroll-mt-32"
          aria-label="Mes enfants"
        >
          <SectionTitle
            icon={<Users className="size-5 text-emerald-600" />}
            title="Mes enfants"
            subtitle="Vue d'ensemble du compte scolaire de chaque enfant."
          />

          {loadingEnfants ? (
            <LoadingBlock label="Chargement des enfants…" />
          ) : errorEnfants ? (
            <ErrorBlock
              label="Impossible de charger vos enfants"
              onRetry={() => refetchEnfants()}
            />
          ) : !enfants || enfants.length === 0 ? (
            <EmptyState
              icon={<Users className="size-8" />}
              title="Aucun enfant rattaché"
              message="Votre compte n'est pas encore lié à un élève. Veuillez contacter le secrétariat de l'établissement."
            />
          ) : (
            <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {enfants.map((enfant, idx) => (
                <EnfantCard
                  key={enfant.id}
                  enfant={enfant}
                  index={idx}
                  onVoirDetail={() => handleVoirDetail(enfant)}
                  onPayerEnLigne={() => handlePayerEnLigne(enfant)}
                  onPayerALecole={() => handlePayerALecole(enfant)}
                />
              ))}
            </div>
          )}
        </section>

        {/* Section 2 : Historique des paiements */}
        <section
          ref={historiqueRef}
          className="mt-12 scroll-mt-32"
          aria-label="Historique des paiements"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <SectionTitle
              icon={<Receipt className="size-5 text-emerald-600" />}
              title="Historique des paiements"
              subtitle="Vos 50 derniers paiements enregistrés. Cliquez sur une ligne pour afficher le reçu."
              as="div"
            />
            <div className="flex items-center gap-2">
              <label
                htmlFor="filter-eleve"
                className="text-xs text-muted-foreground"
              >
                Filtrer :
              </label>
              <Select
                value={filterEleveId}
                onValueChange={setFilterEleveId}
                disabled={!enfants || enfants.length === 0}
              >
                <SelectTrigger
                  id="filter-eleve"
                  className="h-9 w-48 bg-background"
                >
                  <SelectValue placeholder="Tous les enfants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les enfants</SelectItem>
                  {enfants?.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.prenoms} {e.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loadingPaiements ? (
            <LoadingBlock label="Chargement de l'historique…" />
          ) : errorPaiements ? (
            <ErrorBlock label="Impossible de charger l'historique des paiements" />
          ) : !paiements || paiements.length === 0 ? (
            <EmptyState
              icon={<Receipt className="size-8" />}
              title="Aucun paiement pour le moment"
              message={
                filterEleveId !== "all"
                  ? "Cet enfant n'a pas encore de paiement enregistré."
                  : "Votre historique de paiements apparaîtra ici dès le premier encaissement."
              }
            />
          ) : (
            <PaiementsTable
              paiements={paiements}
              onVoirRecu={handleVoirRecu}
            />
          )}
        </section>

        {/* Section 3 : Échéances à venir */}
        <section
          ref={echeancesRef}
          className="mt-12 scroll-mt-32"
          aria-label="Échéances à venir"
        >
          <SectionTitle
            icon={<CalendarClock className="size-5 text-amber-600" />}
            title="Échéances à venir"
            subtitle="Les 10 prochaines échéances de vos enfants, triées par date limite."
          />

          {loadingEcheances ? (
            <LoadingBlock label="Chargement des échéances…" />
          ) : errorEcheances ? (
            <ErrorBlock label="Impossible de charger les échéances" />
          ) : !echeances || echeances.length === 0 ? (
            <EmptyState
              icon={<CalendarClock className="size-8" />}
              title="Aucune échéance à venir"
              message="Vous êtes à jour sur toutes les échéances connues. Merci !"
            />
          ) : (
            <EcheancesTimeline echeances={echeances} />
          )}
        </section>
      </main>

      <Footer className="shrink-0" />

      {/* Dialogues */}
      <EnfantDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        enfant={selectedEnfant}
        onVoirHistorique={handleVoirHistoriqueDepuisDetail}
        onPayerEnLigne={handlePayerEnLigne}
      />
      <RecuDialogParent
        open={recuOpen}
        onOpenChange={setRecuOpen}
        paiement={selectedPaiement}
      />
      <PaymentMomoDialog
        open={momoOpen}
        onOpenChange={setMomoOpen}
        enfant={momoEnfant}
      />
      <RecapCaisseDialog
        open={recapOpen}
        onOpenChange={setRecapOpen}
        enfant={recapEnfant}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sous-composants
// ─────────────────────────────────────────────────────────────────────────────

function NavTab({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
        active
          ? "border-emerald-600 text-emerald-700 dark:text-emerald-300"
          : "border-transparent text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-300",
      )}
    >
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-md transition-colors",
          active
            ? "bg-emerald-600 text-white"
            : "bg-muted text-muted-foreground",
        )}
        aria-hidden
      >
        {icon}
      </span>
      {label}
    </button>
  );
}

function WelcomeBanner({
  parentPrenom,
  nbEnfants,
  totalSoldeDu,
  totalAttendu,
  totalPaye,
  loading,
  error,
}: {
  parentPrenom: string;
  nbEnfants: number;
  totalSoldeDu: number;
  totalAttendu: number;
  totalPaye: number;
  loading: boolean;
  error: boolean;
}) {
  const soldeOK = totalSoldeDu <= 0;
  const tauxPaiement =
    totalAttendu > 0
      ? Math.min(100, Math.round((totalPaye / totalAttendu) * 100))
      : 0;

  return (
    <GlassCard
      variant="premium"
      premiumBorder
      noHover
      className="relative overflow-hidden p-0"
    >
      {/* Bandeau gradient emerald→amber */}
      <div className="relative overflow-hidden bg-gradient-to-br from-emerald-700 via-emerald-600 to-amber-500 p-6 text-white sm:p-8">
        {/* Texture kente subtile */}
        <KentePattern variant="bg" className="opacity-10" />
        {/* Orbes décoratifs */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-20 -left-12 size-64 rounded-full bg-amber-300/15 blur-3xl"
        />

        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Salutation */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-emerald-50/90">
              <SparklesHeart />
              Bienvenue sur votre espace
            </div>
            <h1 className="mt-2 font-display text-2xl font-bold leading-tight sm:text-3xl">
              Bonjour {parentPrenom} 👋
            </h1>
            <p className="mt-2 max-w-xl break-words text-sm leading-snug text-emerald-50/95">
              {loading
                ? "Nous récupérons les informations de vos enfants…"
                : error
                  ? "Impossible de charger vos informations pour le moment. Veuillez réessayer."
                  : nbEnfants === 0
                    ? "Aucun enfant n'est encore rattaché à votre compte. Contactez le secrétariat."
                    : nbEnfants === 1
                      ? "Vous suivez 1 enfant scolarisé dans nos établissements."
                      : `Vous suivez ${nbEnfants} enfants scolarisés dans nos établissements.`}
            </p>
          </div>

          {/* ProgressCircle global */}
          {!loading && !error && nbEnfants > 0 ? (
            <div className="flex shrink-0 items-center justify-center">
              <div className="relative flex size-32 items-center justify-center rounded-full bg-white/15 backdrop-blur-sm sm:size-36">
                <ProgressCircle
                  value={tauxPaiement}
                  size={120}
                  strokeWidth={10}
                  trackColor="rgba(255, 255, 255, 0.25)"
                  label={
                    <div className="flex flex-col items-center">
                      <span className="font-display text-2xl font-bold text-white">
                        {tauxPaiement}%
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-emerald-50/90">
                        Payé
                      </span>
                    </div>
                  }
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Indicateur solde global */}
        {!loading && !error && nbEnfants > 0 ? (
          <div
            className={cn(
              "relative z-10 mt-6 flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm",
              soldeOK ? "text-emerald-50" : "text-amber-100",
            )}
          >
            {soldeOK ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <AlertTriangle className="size-4" />
            )}
            <span className="text-xs font-medium">
              {soldeOK
                ? "Tous les comptes sont à jour"
                : "Un solde est à régulariser"}
            </span>
          </div>
        ) : null}
      </div>

      {/* 3 StatCards — Total dû / Total payé / Total attendu */}
      {!loading && !error && nbEnfants > 0 ? (
        <div className="grid grid-cols-1 items-stretch gap-3 p-4 sm:grid-cols-3 sm:p-5">
          <StatCard
            icon={Wallet}
            label="Total dû"
            value={formatFCFA(totalSoldeDu)}
            tone={soldeOK ? "emerald" : "terracotta"}
            delay={0}
            hint={soldeOK ? "Comptes à jour" : "À régulariser"}
          />
          <StatCard
            icon={CheckCircle2}
            label="Total payé"
            value={formatFCFA(totalPaye)}
            tone="emerald"
            delay={0.05}
            hint={`${tauxPaiement}% de l'attendu`}
          />
          <StatCard
            icon={Scale}
            label="Total attendu"
            value={formatFCFA(totalAttendu)}
            tone="gold"
            delay={0.1}
            hint="Année scolaire en cours"
          />
        </div>
      ) : null}
    </GlassCard>
  );
}

/** Petit motif décoratif (cœur stylisé) pour le badge Bienvenue. */
function SparklesHeart() {
  return (
    <span
      aria-hidden
      className="flex size-4 items-center justify-center rounded-full bg-gold/30 text-gold"
    >
      <Heart className="size-2.5" />
    </span>
  );
}

function SectionTitle({
  icon,
  title,
  subtitle,
  as: As = "div",
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  as?: "div" | "h2";
}) {
  return (
    <As className="mb-4 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 ring-1 ring-emerald-200/60 dark:bg-emerald-950/40 dark:ring-emerald-900/40">
          {icon}
        </div>
        <h2 className="font-display text-lg font-bold sm:text-xl">{title}</h2>
      </div>
      {subtitle ? (
        <p className="break-words text-sm leading-snug text-muted-foreground">
          {subtitle}
        </p>
      ) : null}
    </As>
  );
}

function EnfantCard({
  enfant,
  index,
  onVoirDetail,
  onPayerEnLigne,
  onPayerALecole,
}: {
  enfant: EnfantParent;
  index: number;
  onVoirDetail: () => void;
  onPayerEnLigne: () => void;
  onPayerALecole: () => void;
}) {
  const soldeDu = enfant.solde?.solde_du ?? 0;
  const soldeOK = soldeDu <= 0;
  const totalPaye = enfant.solde?.total_paye ?? 0;
  const totalAttendu = enfant.solde?.total_attendu ?? 0;
  const pourcentage =
    totalAttendu > 0 ? Math.min(100, Math.round((totalPaye / totalAttendu) * 100)) : 0;

  return (
    <GlassCard
      variant="adaptive"
      delay={Math.min(index * 0.05, 0.4)}
      className="flex h-full flex-col gap-4"
    >
      {/* En-tête carte */}
      <div className="flex items-start gap-3">
        <Avatar className="size-14 ring-2 ring-gold/60">
          <AvatarFallback className="bg-emerald-600 text-lg font-bold text-white">
            {initials(enfant.nom, enfant.prenoms)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-bold leading-tight">
            {enfant.prenoms} {enfant.nom}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {enfant.inscription_statut === "PRE_INSCRIT" ? (
              <>
                <Badge className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
                  Pré-inscrit·e
                </Badge>
                <span className="break-words text-[11px] leading-snug text-amber-700 dark:text-amber-400">
                  Classe communiquée après paiement des frais d&apos;inscription
                </span>
              </>
            ) : enfant.classe_actuelle ? (
              <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                {enfant.classe_actuelle}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-muted-foreground/30 text-muted-foreground"
              >
                Non inscrit·e
              </Badge>
            )}
            {enfant.categorie && enfant.categorie !== "NON_APPLICABLE" && (
              <Badge
                variant="outline"
                className="border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
              >
                {categorieLabel(enfant.categorie)}
              </Badge>
            )}
          </div>
          <p className="mt-1 break-words text-xs leading-snug text-muted-foreground">
            {enfant.etablissement?.nom ?? "Établissement"}
            {enfant.etablissement?.ville
              ? ` · ${enfant.etablissement.ville}`
              : ""}
          </p>
        </div>
      </div>

      {/* ProgressCircle mini + barre de progression */}
      <div className="flex items-center gap-4 rounded-xl bg-muted/40 p-3">
        <div className="shrink-0">
          <ProgressCircle
            value={pourcentage}
            size={56}
            strokeWidth={6}
            trackColor="rgba(4, 120, 87, 0.15)"
            label={
              <span className="font-display text-sm font-bold text-forest">
                {pourcentage}%
              </span>
            }
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Progression des paiements</span>
            <span className="font-semibold text-foreground">{pourcentage}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                soldeOK
                  ? "bg-emerald-500"
                  : pourcentage > 50
                    ? "bg-amber-500"
                    : "bg-rose-500",
              )}
              style={{ width: `${pourcentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Solde dû */}
      <div
        className={cn(
          "rounded-xl border p-3",
          soldeOK
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20"
            : "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20",
        )}
      >
        <div
          className={cn(
            "flex items-center gap-1.5 text-[11px] uppercase tracking-wide",
            soldeOK ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
          )}
        >
          {soldeOK ? (
            <CheckCircle2 className="size-3.5" />
          ) : (
            <AlertTriangle className="size-3.5" />
          )}
          Solde dû
        </div>
        <div
          className={cn(
            "font-mono text-2xl font-bold leading-snug",
            soldeOK
              ? "text-emerald-800 dark:text-emerald-300"
              : "text-amber-800 dark:text-amber-300",
          )}
        >
          {formatFCFA(soldeDu)}
        </div>
        <div className="mt-0.5 break-words text-[11px] leading-snug text-muted-foreground">
          sur {formatFCFA(totalAttendu)} attendus
        </div>
      </div>

      {/* Boutons d'action : détail + paiements */}
      <div className="mt-auto grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onVoirDetail}
          title="Voir le détail du compte de cet enfant"
          className="border border-emerald-200 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
        >
          Voir le détail
          <ChevronRight className="size-4" />
        </Button>
        <Button
          type="button"
          variant="success"
          onClick={onPayerEnLigne}
          disabled={soldeOK}
          title={
            soldeOK
              ? "Aucun solde dû — paiement inutile"
              : "Payer en ligne via Mobile Money"
          }
        >
          <Smartphone className="size-4" />
          Payer en ligne
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onPayerALecole}
          title="Imprimer un récapitulatif à présenter à la caisse"
          className="border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/40"
        >
          <Landmark className="size-4" />
          Payer à l&apos;école
        </Button>
      </div>
    </GlassCard>
  );
}

function PaiementsTable({
  paiements,
  onVoirRecu,
}: {
  paiements: PaiementParent[];
  onVoirRecu: (p: PaiementParent) => void;
}) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <GlassCard variant="adaptive" noHover premiumBorder className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow className="border-emerald-200/60 bg-emerald-50/60 hover:bg-emerald-50/60 dark:bg-emerald-950/30">
            <TableHead className="pl-4">Date</TableHead>
            <TableHead>Enfant</TableHead>
            <TableHead className="hidden md:table-cell">Motif</TableHead>
            <TableHead className="hidden sm:table-cell">Mode</TableHead>
            <TableHead className="text-right">Montant</TableHead>
            <TableHead className="hidden lg:table-cell">N° reçu</TableHead>
            <TableHead className="hidden sm:table-cell">Statut</TableHead>
            <TableHead className="pr-4 text-right">Reçu</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paiements.map((p, idx) => (
            <motion.tr
              key={p.id}
              initial={
                prefersReducedMotion ? false : { opacity: 0, y: 8 }
              }
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.3,
                delay: Math.min(idx * 0.03, 0.4),
                ease: "easeOut",
              }}
              className="cursor-pointer border-b border-emerald-100/60 transition-colors hover:bg-emerald-50/60 dark:border-emerald-900/30 dark:hover:bg-emerald-950/20"
              onClick={() => onVoirRecu(p)}
            >
              <TableCell className="pl-4">
                <div className="font-medium">
                  {formatDate(p.date_paiement)}
                </div>
                <div className="break-words text-[11px] leading-snug text-muted-foreground">
                  {formatDateTime(p.date_paiement).split(" à ")[1] ?? ""}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-semibold text-white ring-1 ring-emerald-200/60 dark:bg-emerald-800 dark:text-emerald-50 dark:ring-emerald-800/40">
                    {initials(p.eleve_nom, p.eleve_prenoms)}
                  </div>
                  <div className="min-w-0">
                    <div className="break-words font-medium leading-snug">
                      {p.eleve_prenoms} {p.eleve_nom}
                    </div>
                    <div className="break-words text-[11px] leading-snug text-muted-foreground">
                      {p.classe || "—"}
                    </div>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className="break-words leading-snug">
                  {p.frais_libelle ?? "Paiement scolaire"}
                </span>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge
                  variant="outline"
                  className={cn("font-medium", modePaiementClass(p.mode_paiement))}
                >
                  {modePaiementLabel(p.mode_paiement)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                  {formatFCFA(p.montant)}
                </span>
              </TableCell>
              <TableCell className="hidden font-mono text-xs lg:table-cell">
                <span className="break-all leading-snug">
                  {p.numero_recu || "—"}
                </span>
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge
                  variant="outline"
                  className={cn("font-medium", statutPaiementClass(p.statut))}
                >
                  {statutPaiementLabel(p.statut)}
                </Badge>
              </TableCell>
              <TableCell className="pr-4 text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
                  title="Voir le reçu de ce paiement"
                  onClick={(e) => {
                    e.stopPropagation();
                    onVoirRecu(p);
                  }}
                >
                  <Download className="size-3.5" />
                  <span className="hidden sm:inline">Reçu</span>
                </Button>
              </TableCell>
            </motion.tr>
          ))}
        </TableBody>
      </Table>
    </GlassCard>
  );
}

function EcheancesTimeline({
  echeances,
}: {
  echeances: EcheanceParent[];
}) {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <div className="relative space-y-3">
      {/* Bordure gauche emerald (timeline) */}
      <div
        aria-hidden
        className="absolute bottom-2 left-[22px] top-2 w-0.5 bg-gradient-to-b from-emerald-300 via-amber-200 to-rose-300 sm:left-[26px]"
      />

      {echeances.map((e, idx) => {
        const enRetard = e.statut === "EN_RETARD" || e.jours_avant < 0;
        const partiel = e.statut === "PARTIEL";
        const reste = Math.max(0, e.montant - e.montant_paye);
        const pointClass = enRetard
          ? "bg-rose-500 ring-rose-200 dark:ring-rose-900"
          : partiel
            ? "bg-amber-500 ring-amber-200 dark:ring-amber-900"
            : "bg-emerald-500 ring-emerald-200 dark:ring-emerald-900";

        return (
          <motion.div
            key={e.echeance_id}
            initial={prefersReducedMotion ? false : { opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{
              duration: 0.35,
              delay: Math.min(idx * 0.05, 0.5),
              ease: "easeOut",
            }}
            className="relative pl-12 sm:pl-16"
          >
            {/* Point coloré sur la timeline */}
            <div
              className={cn(
                "absolute left-3 top-5 flex size-7 items-center justify-center rounded-full ring-4 ring-background sm:left-4 sm:top-6 sm:size-8",
                pointClass,
              )}
              aria-hidden
            >
              <CalendarClock className="size-3.5 text-white sm:size-4" />
            </div>

            <GlassCard
              variant="mobile"
              noHover
              noAnimation
              className={cn(
                "border-l-4 p-4",
                enRetard
                  ? "border-l-rose-400 dark:border-l-rose-700"
                  : partiel
                    ? "border-l-amber-400 dark:border-l-amber-700"
                    : "border-l-emerald-400 dark:border-l-emerald-700",
              )}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="break-words font-semibold leading-snug">
                      {e.libelle}
                    </h3>
                    <Badge
                      variant="outline"
                      className={cn("font-medium", statutEcheanceClass(e.statut))}
                    >
                      {statutEcheanceLabel(e.statut)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 break-words text-sm leading-snug text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {e.eleve_nom}
                    </span>
                    {e.classe ? ` · ${e.classe}` : ""}
                  </p>
                  <p className="mt-0.5 break-words text-xs leading-snug text-muted-foreground">
                    Date limite :{" "}
                    <span
                      className={cn(
                        "font-medium",
                        enRetard ? "text-rose-700 dark:text-rose-300" : "",
                      )}
                    >
                      {formatDate(e.date_limite)}
                    </span>
                    {e.jours_avant > 0
                      ? ` · dans ${e.jours_avant} jour${e.jours_avant > 1 ? "s" : ""}`
                      : e.jours_avant < 0
                        ? ` · en retard de ${Math.abs(e.jours_avant)} jour${Math.abs(e.jours_avant) > 1 ? "s" : ""}`
                        : " · aujourd'hui"}
                  </p>
                </div>

                <div className="flex flex-col items-start gap-1 sm:items-end">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {partiel || (e.montant_paye > 0 && reste > 0)
                      ? "Reste à payer"
                      : "Montant"}
                  </div>
                  <div
                    className={cn(
                      "font-mono text-lg font-bold leading-snug",
                      enRetard
                        ? "text-rose-800 dark:text-rose-300"
                        : partiel
                          ? "text-amber-800 dark:text-amber-300"
                          : "text-emerald-800 dark:text-emerald-300",
                    )}
                  >
                    {formatFCFA(
                      partiel || (e.montant_paye > 0 && reste > 0)
                        ? reste
                        : e.montant,
                    )}
                  </div>
                  {e.montant_paye > 0 ? (
                    <div className="break-words text-[11px] leading-snug text-muted-foreground">
                      {formatFCFA(e.montant_paye)} déjà payé
                    </div>
                  ) : null}
                </div>
              </div>
            </GlassCard>
          </motion.div>
        );
      })}
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <GlassCard variant="adaptive" noHover className="border border-dashed">
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin text-emerald-600" />
        {label}
      </div>
    </GlassCard>
  );
}

function ErrorBlock({
  label,
  onRetry,
}: {
  label: string;
  onRetry?: () => void;
}) {
  return (
    <GlassCard variant="adaptive" noHover className="border border-dashed">
      <div className="relative overflow-hidden px-4 py-12">
        <KentePattern variant="bg" />
        <div className="relative flex flex-col items-center justify-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-rose-100 text-rose-700 shadow-lg shadow-rose-900/10 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="size-7" />
          </div>
          <div>
            <p className="break-words text-sm font-semibold text-rose-800 dark:text-rose-300">
              {label}
            </p>
            <p className="mx-auto mt-1 max-w-md break-words text-xs leading-snug text-muted-foreground">
              Vérifiez votre connexion ou réessayez dans quelques instants.
            </p>
          </div>
          {onRetry ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/30"
            >
              <RefreshCw className="size-4" />
              Réessayer
            </Button>
          ) : null}
        </div>
      </div>
    </GlassCard>
  );
}

function EmptyState({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <GlassCard variant="adaptive" noHover className="border border-dashed">
      <div className="relative overflow-hidden px-4 py-12">
        <KentePattern variant="bg" />
        <div className="relative flex flex-col items-center justify-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {icon}
          </div>
          <div>
            <p className="break-words text-sm font-semibold">{title}</p>
            <p className="mx-auto mt-1 max-w-md break-words text-xs leading-snug text-muted-foreground">
              {message}
            </p>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
