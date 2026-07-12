"use client";

/**
 * ScolaGest — Portail Parent (Phase 6).
 *
 * Interface simplifiée et rassurante pour les parents/tuteurs. Contrairement au
 * tableau de bord du personnel (sidebar + RBAC), le portail parent est une
 * page unique à sections ancrées :
 *
 *   1. « Mes enfants »   : grille de cartes (photo, nom, classe, solde dû).
 *   2. « Historique »    : table des paiements récents (filtrable par enfant),
 *                          clic sur une ligne → reçu imprimable.
 *   3. « Échéances »     : timeline des prochaines échéances (tous enfants).
 *
 * Bandeau d'accueil : « Bonjour {prénom} » + nombre d'enfants + solde dû total.
 *
 * Toutes les données proviennent des endpoints `/api/parent/*` (clés React
 * Query : `parentKeys`). Le portail rend gracieusement en cas d'erreur backend
 * (états vides / messages d'erreur).
 */

import * as React from "react";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import {
  LogOut,
  Users,
  Wallet,
  CalendarClock,
  Receipt,
  Phone,
  Download,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  AlertCircle,
  Building2,
  Mail,
  RefreshCw,
  Heart,
  Smartphone,
  Landmark,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { ProgressCircle } from "@/components/ds/progress-circle";
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
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "ANNULE":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300";
    case "EN_ATTENTE":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300";
    default:
      return "border-muted-foreground/20 bg-muted text-muted-foreground";
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
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300";
    case "PARTIEL":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300";
    case "A_VENIR":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "PAYE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300";
    default:
      return "border-muted-foreground/20 bg-muted text-muted-foreground";
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
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-emerald-50/60 via-background to-amber-50/40">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-emerald-100 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Image
            src="/logo.png"
            alt="ScolaGest"
            width={40}
            height={40}
            className="rounded-xl shadow-sm shadow-emerald-600/20"
          />
          <div className="min-w-0 flex-1">
            <p className="font-display text-base font-bold leading-tight">ScolaGest</p>
            <p className="truncate text-[11px] text-muted-foreground leading-tight">
              Portail Parent ·{" "}
              {etablissement?.nom ?? "Groupe Le Chandelier — Dabou"}
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs font-medium leading-tight">
                {tuteur
                  ? `${tuteur.prenoms ?? ""} ${tuteur.nom ?? ""}`.trim() ||
                    "Parent"
                  : "Parent"}
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                {tuteur?.telephone ?? "Parent / Tuteur"}
              </p>
            </div>
            <Avatar className="size-9 border">
              <AvatarFallback className="bg-amber-600 text-xs font-semibold text-white">
                {initials(tuteur?.nom, tuteur?.prenoms)}
              </AvatarFallback>
            </Avatar>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="hidden border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800 sm:inline-flex dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
            >
              <LogOut className="size-4" />
              Déconnexion
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="sm:hidden text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              aria-label="Déconnexion"
            >
              <LogOut className="size-5" />
            </Button>
          </div>
        </div>

        {/* Navigation ancrée */}
        <nav className="border-t border-emerald-100 bg-emerald-50/40">
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
      </header>

      {/* Contenu principal */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {/* Bandeau d'accueil */}
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {enfants.map((enfant) => (
                <EnfantCard
                  key={enfant.id}
                  enfant={enfant}
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

      {/* Footer */}
      <footer className="mt-12 border-t border-emerald-100 bg-white/70">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            <FooterBlock
              icon={<Building2 className="size-5 text-emerald-600" />}
              title="Votre établissement"
            >
              <p className="font-medium">
                {etablissement?.nom ?? "Groupe Le Chandelier"}
              </p>
              <p className="text-xs text-muted-foreground">
                {etablissement?.ville ? `${etablissement.ville}, ` : ""}
                Côte d&apos;Ivoire
              </p>
            </FooterBlock>

            <FooterBlock
              icon={<Phone className="size-5 text-emerald-600" />}
              title="Besoin d'aide ?"
            >
              <p className="text-sm">
                Contactez le secrétariat ou la comptabilité de
                l&apos;établissement pour toute question concernant les
                paiements ou les soldes.
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Du lundi au vendredi, 8h à 16h.
              </p>
            </FooterBlock>

            <FooterBlock
              icon={<Mail className="size-5 text-emerald-600" />}
              title="ScolaGest"
            >
              <p className="text-xs text-muted-foreground">
                Application de Gestion &amp; Caisse Scolaire — Collège Privé Le
                Chandelier, Dabou.
              </p>
              <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Heart className="size-3 text-rose-500" />
                Conçu pour les familles de Dabou
              </p>
            </FooterBlock>
          </div>

          <KentePattern variant="separator" className="my-6" />

          <div className="flex flex-col items-center justify-between gap-2 text-[11px] text-muted-foreground sm:flex-row">
            <p>© {new Date().getFullYear()} ScolaGest · Portail Parent</p>
            <p>Document non contractuel. En cas de litige, le registre de caisse fait foi.</p>
          </div>
        </div>
      </footer>

      {/* Dialogues */}
      <EnfantDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        enfant={selectedEnfant}
        onVoirHistorique={handleVoirHistoriqueDepuisDetail}
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
      className={cn(
        "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors",
        active
          ? "border-emerald-600 text-emerald-700 dark:text-emerald-300"
          : "border-transparent text-muted-foreground hover:text-emerald-700 dark:hover:text-emerald-300",
      )}
    >
      {icon}
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
    <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 p-6 text-white shadow-lg shadow-emerald-700/20 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 size-64 rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-12 size-64 rounded-full bg-amber-300/10 blur-3xl"
      />
      <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-emerald-100">Bienvenue sur votre espace</p>
          <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">
            Bonjour {parentPrenom} 👋
          </h1>
          <p className="mt-2 max-w-xl text-sm text-emerald-100">
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

        {!loading && !error && nbEnfants > 0 ? (
          <div className="flex flex-col gap-3 rounded-xl bg-white/10 p-4 backdrop-blur-sm sm:min-w-[280px] sm:flex-row sm:items-center sm:gap-4">
            <div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-white/15 sm:size-24">
              <ProgressCircle
                value={tauxPaiement}
                size={80}
                strokeWidth={8}
                trackColor="rgba(255, 255, 255, 0.2)"
                label={
                  <span className="font-display text-lg font-bold text-white">
                    {tauxPaiement}%
                  </span>
                }
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-emerald-100">
                <Wallet className="size-3.5" />
                Solde dû total
              </div>
              <div className="font-mono text-2xl font-bold sm:text-3xl">
                {formatFCFA(totalSoldeDu)}
              </div>
              <div
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  soldeOK ? "text-emerald-100" : "text-amber-200",
                )}
              >
                {soldeOK ? (
                  <>
                    <CheckCircle2 className="size-3.5" />
                    Tous les comptes sont à jour
                  </>
                ) : (
                  <>
                    <AlertTriangle className="size-3.5" />
                    Un solde est à régulariser
                  </>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
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
        <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/40">
          {icon}
        </div>
        <h2 className="font-display text-lg font-bold sm:text-xl">{title}</h2>
      </div>
      {subtitle ? (
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      ) : null}
    </As>
  );
}

function EnfantCard({
  enfant,
  onVoirDetail,
  onPayerEnLigne,
  onPayerALecole,
}: {
  enfant: EnfantParent;
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
      noHover
      className="flex flex-col gap-4"
    >
        {/* En-tête carte */}
        <div className="flex items-start gap-3">
          <Avatar className="size-14 border-2 border-emerald-200 dark:border-emerald-900">
            <AvatarFallback className="bg-emerald-600 text-lg font-bold text-white">
              {initials(enfant.nom, enfant.prenoms)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-bold leading-tight">
              {enfant.prenoms} {enfant.nom}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {enfant.inscription_statut === "PRE_INSCRIT" ? (
                <>
                  <Badge className="border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                    Pré-inscrit·e
                  </Badge>
                  <span className="text-[11px] text-amber-700 dark:text-amber-400">
                    Classe communiquée après paiement des frais d&apos;inscription
                  </span>
                </>
              ) : enfant.classe_actuelle ? (
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
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {enfant.etablissement?.nom ?? "Établissement"}
              {enfant.etablissement?.ville
                ? ` · ${enfant.etablissement.ville}`
                : ""}
            </p>
          </div>
        </div>

        {/* Barre de progression */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Progression des paiements</span>
            <span className="font-semibold text-foreground">{pourcentage}%</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
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

        {/* Solde dû */}
        <div
          className={cn(
            "rounded-xl border p-3",
            soldeOK
              ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/20"
              : "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20",
          )}
        >
          <div
            className={cn(
              "flex items-center gap-1.5 text-[11px] uppercase tracking-wide",
              soldeOK ? "text-emerald-700" : "text-amber-700",
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
              "font-mono text-2xl font-bold",
              soldeOK
                ? "text-emerald-800 dark:text-emerald-300"
                : "text-amber-800 dark:text-amber-300",
            )}
          >
            {formatFCFA(soldeDu)}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            sur {formatFCFA(totalAttendu)} attendus
          </div>
        </div>

        {/* Boutons d'action : détail + paiements */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button
            type="button"
            variant="ghost"
            onClick={onVoirDetail}
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
  return (
    <GlassCard variant="adaptive" noHover className="overflow-hidden p-0">
      <div>
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
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
          {paiements.map((p) => (
            <TableRow
              key={p.id}
              className="cursor-pointer hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20"
              onClick={() => onVoirRecu(p)}
            >
              <TableCell className="pl-4">
                <div className="font-medium">
                  {formatDate(p.date_paiement)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {formatDateTime(p.date_paiement).split(" à ")[1] ?? ""}
                </div>
              </TableCell>
              <TableCell>
                <div className="font-medium">
                  {p.eleve_prenoms} {p.eleve_nom}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {p.classe || "—"}
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {p.frais_libelle ?? "Paiement scolaire"}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge
                  variant="outline"
                  className={cn(
                    "font-medium",
                    modePaiementClass(p.mode_paiement),
                  )}
                >
                  {modePaiementLabel(p.mode_paiement)}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                  {formatFCFA(p.montant)}
                </span>
              </TableCell>
              <TableCell className="hidden font-mono text-xs lg:table-cell">
                {p.numero_recu || "—"}
              </TableCell>
              <TableCell className="hidden sm:table-cell">
                <Badge
                  variant="outline"
                  className={cn(
                    "font-medium",
                    statutPaiementClass(p.statut),
                  )}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    onVoirRecu(p);
                  }}
                >
                  <Download className="size-3.5" />
                  <span className="hidden sm:inline">Reçu</span>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </GlassCard>
  );
}

function EcheancesTimeline({
  echeances,
}: {
  echeances: EcheanceParent[];
}) {
  return (
    <div className="space-y-3">
      {echeances.map((e) => {
        const enRetard = e.statut === "EN_RETARD" || e.jours_avant < 0;
        const partiel = e.statut === "PARTIEL";
        const reste = Math.max(0, e.montant - e.montant_paye);
        return (
          <div
            key={e.echeance_id}
            className={cn(
              "flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center",
              enRetard
                ? "border-rose-200 bg-rose-50/50 dark:border-rose-900/50 dark:bg-rose-950/10"
                : partiel
                  ? "border-amber-200 bg-amber-50/50 dark:border-amber-900/50 dark:bg-amber-950/10"
                  : "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/10",
            )}
          >
            <div
              className={cn(
                "flex size-12 flex-col items-center justify-center rounded-lg font-semibold",
                enRetard
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                  : partiel
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
              )}
            >
              <CalendarClock className="size-5" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold">{e.libelle}</h3>
                <Badge
                  variant="outline"
                  className={cn(
                    "font-medium",
                    statutEcheanceClass(e.statut),
                  )}
                >
                  {statutEcheanceLabel(e.statut)}
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {e.eleve_nom}
                </span>
                {e.classe ? ` · ${e.classe}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Date limite :{" "}
                <span
                  className={cn(
                    "font-medium",
                    enRetard ? "text-rose-700 dark:text-rose-400" : "",
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
                  "font-mono text-lg font-bold",
                  enRetard
                    ? "text-rose-800 dark:text-rose-300"
                    : partiel
                      ? "text-amber-800 dark:text-amber-300"
                      : "text-emerald-800 dark:text-emerald-300",
                )}
              >
                {formatFCFA(partiel || (e.montant_paye > 0 && reste > 0) ? reste : e.montant)}
              </div>
              {e.montant_paye > 0 ? (
                <div className="text-[11px] text-muted-foreground">
                  {formatFCFA(e.montant_paye)} déjà payé
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
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
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-rose-200 bg-rose-50/50 py-12 text-center dark:border-rose-900/50 dark:bg-rose-950/10">
      <AlertCircle className="size-8 text-rose-500" />
      <div>
        <p className="text-sm font-medium text-rose-800 dark:text-rose-300">
          {label}
        </p>
        <p className="text-xs text-muted-foreground">
          Vérifiez votre connexion ou réessayez dans quelques instants.
        </p>
      </div>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          className="border-rose-300 text-rose-700 hover:bg-rose-50 hover:text-rose-800 dark:border-rose-900/50 dark:text-rose-300 dark:hover:bg-rose-950/30"
        >
          <RefreshCw className="size-4" />
          Réessayer
        </Button>
      ) : null}
    </div>
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
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-12 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          {message}
        </p>
      </div>
    </div>
  );
}

function FooterBlock({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      <div className="space-y-0.5 text-sm text-muted-foreground">
        {children}
      </div>
    </div>
  );
}
