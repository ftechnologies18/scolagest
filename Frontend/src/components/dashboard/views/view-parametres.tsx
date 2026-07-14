"use client";

/**
 * ScolaGest — Vue « Paramètres » (Phase 5).
 *
 * Trois onglets (DIRECTION uniquement, filtre nav dans
 * `dashboard-layout.tsx`) :
 *  - Établissements : liste + création / édition, code_officiel, ville,
 *    applique_categorie_affecte, actif.
 *  - Utilisateurs   : liste des utilisateurs + rôle global + accès par
 *    établissement. Création / édition via dialog dédié.
 *  - Audit          : filtres (entité, utilisateur, dates) + table paginée
 *    du journal d'audit (date, utilisateur, action, entité, IP).
 *
 * Toutes les requêtes utilisent `useQuery` avec `retry: 1, retryDelay: 1500`.
 *
 * Refonte « Forêt EdTech » (Task 4) :
 *  - Hero header premium (KentePattern strip + GlassCard desktop + badge
 *    rond gradient emerald→gold + titre font-display text-2xl + pill
 *    "Phase 5" outline avec Sparkles).
 *  - TabsList premium (glass-desktop subtile + tab actif bg-emerald-600
 *    text-white + icônes Building2 / Users / ScrollText + scrollable mobile).
 *  - Onglet Établissements : 4 StatCards (Total emerald / Actifs forest /
 *    Avec catégories amber / Inactifs terracotta) + tableau header
 *    bg-emerald-50/60 + hover bg-emerald-50/60 + avatar Building2 en badge
 *    emerald/15 + nom font-display + badges renforcés + bouton Modifier
 *    avec title natif + motion.tr stagger.
 *  - Onglet Utilisateurs : 4 StatCards (Total emerald / Actifs forest /
 *    Suspendus terracotta / Multi-établissements gold) + tableau header
 *    bg-emerald-50/60 + hover bg-emerald-50/60 + avatar initiales
 *    bg-emerald-600 text-white + nom font-display + email break-all +
 *    badges renforcés + bouton Modifier avec title natif + motion.tr stagger.
 *  - Onglet Audit : filtres GlassCard adaptive + icônes contextuelles dans
 *    les SelectTrigger (Filter / User / Calendar) + bouton Réinitialiser
 *    variant outline avec RotateCcw + tableau header bg-emerald-50/60 +
 *    hover bg-emerald-50/60 + badges action renforcés + description
 *    break-words (pas de truncate) + motion.tr stagger + pagination boutons
 *    avec title natif + "Page X sur Y".
 *  - Empty states premium (KentePattern bg + badges ronds colorés + icônes).
 *  - Loading state premium (KentePattern strip top + Skeletons en GlassCard).
 *  - Animations Framer Motion (StatCards stagger delay index*0.05 + rows
 *    motion.tr stagger delay index*0.02 capé 0.4s) avec respect de
 *    `usePrefersReducedMotion()`.
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Settings,
  Building2,
  Users,
  ScrollText,
  Plus,
  Pencil,
  Loader2,
  AlertCircle,
  Filter,
  CheckCircle2,
  ShieldCheck,
  ShieldAlert,
  Globe,
  Sparkles,
  RotateCcw,
  Calendar,
  User,
  UserX,
  Hash,
} from "lucide-react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";
import { useAuthStore, type Etablissement } from "@/lib/auth-store";
import {
  etablissementsKeys,
  usersKeys,
  auditKeys,
  fetchEtablissements,
  fetchUtilisateurs,
  fetchAudit,
} from "@/lib/api-phase5";
import { formatDateTime, todayISO } from "@/lib/format";
import type {
  AuditQueryParams,
  JournalAudit,
  RoleGlobal,
  Utilisateur,
} from "@/lib/types";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { StatCard } from "@/components/ds/stat-card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EtablissementFormDialog } from "@/components/parametres/etablissement-form-dialog";
import { UtilisateurFormDialog } from "@/components/parametres/utilisateur-form-dialog";

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<RoleGlobal, string> = {
  SUPER_ADMIN: "Super Admin (SaaS)",
  CAISSIER: "Caissier(ère)",
  COMPTABLE: "Comptable",
  DIRECTION: "Direction",
  DIRECTEUR_ETUDES: "Directeur des Études",
  DIRECTEUR_SUPERVISEUR: "Directeur Superviseur",
  SECRETARIAT: "Secrétariat",
  EDUCATEUR: "Éducateur(-trice)",
  PARENT: "Parent / Tuteur",
};

const ROLE_CLS: Record<RoleGlobal, string> = {
  SUPER_ADMIN:
    "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200",
  CAISSIER:
    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200",
  COMPTABLE:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200",
  DIRECTION:
    "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/50 dark:text-sky-200",
  DIRECTEUR_ETUDES:
    "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200",
  DIRECTEUR_SUPERVISEUR:
    "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200",
  SECRETARIAT:
    "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
  EDUCATEUR:
    "border-forest/40 bg-forest/10 text-forest dark:border-forest/40 dark:bg-forest/10 dark:text-forest",
  PARENT:
    "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200",
};

const PAGE_SIZE = 20;

const ENTITE_OPTIONS = [
  { value: "all", label: "Toutes entités" },
  { value: "Eleve", label: "Élèves" },
  { value: "Paiement", label: "Paiements" },
  { value: "Frais", label: "Frais" },
  { value: "Echeance", label: "Échéances" },
  { value: "Utilisateur", label: "Utilisateurs" },
  { value: "Etablissement", label: "Établissements" },
  { value: "Cloture", label: "Clôtures" },
  { value: "TransactionMomo", label: "Mobile Money" },
  { value: "EcritureComptable", label: "Écritures compta" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Initiales (max 2 lettres) d'un utilisateur pour son avatar. */
function userInitials(u: Utilisateur): string {
  const p = (u.prenoms ?? "").trim();
  const n = (u.nom ?? "").trim();
  const a = p ? p[0] : "";
  const b = n ? n[0] : "";
  const out = (a + b).toUpperCase();
  return out || "?";
}

// ─────────────────────────────────────────────────────────────────────────────
// Composant principal
// ─────────────────────────────────────────────────────────────────────────────

export default function ParametresView() {
  const etablissement = useAuthStore((s) => s.etablissement);

  return (
    <div className="space-y-4 sm:space-y-6">
      <KentePattern variant="strip" position="top" />

      {/* ─── Hero header premium ──────────────────────────────────────── */}
      <GlassCard variant="desktop" noHover premiumBorder className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Badge rond gradient emerald→gold avec icône Settings */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <Settings className="size-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                  Paramètres
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50/60 px-2 py-0.5 align-middle text-[11px] font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <Sparkles className="size-3" />
                  Phase 5
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Établissements du groupe, utilisateurs &amp; rôles, journal
                d&apos;audit.
              </p>
              {etablissement?.nom ? (
                <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {etablissement.nom}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </GlassCard>

      <KentePattern variant="separator" className="my-1" />

      <Tabs defaultValue="etablissements" className="w-full">
        <TabsList className="glass-desktop h-auto w-full gap-1 overflow-x-auto border-0 p-1 sm:w-auto">
          <TabsTrigger
            value="etablissements"
            className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <Building2 className="size-4" />
            Établissements
          </TabsTrigger>
          <TabsTrigger
            value="utilisateurs"
            className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <Users className="size-4" />
            Utilisateurs
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <ScrollText className="size-4" />
            Audit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="etablissements" className="mt-4">
          <EtablissementsPanel />
        </TabsContent>
        <TabsContent value="utilisateurs" className="mt-4">
          <UtilisateursPanel />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Établissements »
// ─────────────────────────────────────────────────────────────────────────────

function EtablissementsPanel() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [formOpen, setFormOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Etablissement | null>(
    null,
  );

  const {
    data: etablissements,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: etablissementsKeys.list(),
    queryFn: fetchEtablissements,
    retry: 1,
    retryDelay: 1500,
  });

  // ─── KPIs calculés sur la liste des établissements ──────────────────────
  const list = etablissements ?? [];
  const kpis = React.useMemo(() => {
    let actifs = 0;
    let inactifs = 0;
    let avecCategories = 0;
    for (const e of list) {
      if (e.actif === false) {
        inactifs += 1;
      } else {
        actifs += 1;
      }
      if (e.applique_categorie_affecte) avecCategories += 1;
    }
    return { total: list.length, actifs, inactifs, avecCategories };
  }, [list]);

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(e: Etablissement) {
    setEditTarget(e);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Bandeau : compte + actions ─────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {etablissements?.length ?? 0} établissement(s) dans le groupe.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Actualiser la liste des établissements"
          >
            <Loader2 className={cn("size-3.5", isFetching && "animate-spin")} />
            Actualiser
          </Button>
          <Button
            onClick={openCreate}
            variant="success"
            size="sm"
            title="Créer un nouvel établissement"
          >
            <Plus className="size-4" />
            Nouvel établissement
          </Button>
        </div>
      </div>

      {/* ─── 4 StatCards de résumé ────────────────────────────────────────── */}
      <section
        aria-label="Résumé des établissements"
        className="grid grid-cols-2 items-stretch gap-3 sm:gap-4 md:grid-cols-4"
      >
        <StatCard
          icon={Building2}
          tone="emerald"
          label="Total établissements"
          value={kpis.total}
          hint={isLoading ? "chargement…" : "dans le groupe"}
          delay={0}
          className="h-full"
        />
        <StatCard
          icon={CheckCircle2}
          tone="forest"
          label="Actifs"
          value={kpis.actifs}
          hint="opérationnels"
          delay={0.05}
          className="h-full"
        />
        <StatCard
          icon={ShieldCheck}
          tone="amber"
          label="Avec catégories"
          value={kpis.avecCategories}
          hint="affecté / non affecté"
          delay={0.1}
          className="h-full"
        />
        <StatCard
          icon={AlertCircle}
          tone="terracotta"
          label="Inactifs"
          value={kpis.inactifs}
          hint="désactivés"
          delay={0.15}
          className="h-full"
        />
      </section>

      <KentePattern variant="separator" className="my-1" />

      {/* ─── Contenu : tableau / skeleton / empty / error ─────────────────── */}
      {isLoading ? (
        <LoadingState rows={4} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          title="Aucun établissement"
          message="Créez le premier établissement du groupe pour démarrer."
        />
      ) : (
        <GlassCard
          variant="adaptive"
          noHover
          noAnimation
          premiumBorder
          className="overflow-hidden p-0"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <TableHead className="min-w-[220px] pl-4 text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Nom
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Code officiel
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Ville
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Catégories
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    État
                  </TableHead>
                  <TableHead className="pr-4 text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((e, index) => (
                  <EtablissementRow
                    key={e.id}
                    etablissement={e}
                    index={index}
                    prefersReducedMotion={prefersReducedMotion}
                    onEdit={() => openEdit(e)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      )}

      <EtablissementFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        etablissement={editTarget}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ligne du tableau Établissement (motion.tr avec stagger delay index*0.02)
// ─────────────────────────────────────────────────────────────────────────────

function EtablissementRow({
  etablissement: e,
  index,
  prefersReducedMotion,
  onEdit,
}: {
  etablissement: Etablissement;
  index: number;
  prefersReducedMotion: boolean;
  onEdit: () => void;
}) {
  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.3,
          delay: Math.min(index * 0.02, 0.4),
          ease: [0.22, 1, 0.36, 1] as const,
        },
      };
  return (
    <motion.tr
      data-slot="table-row"
      className="hover:bg-emerald-50/60 border-b transition-colors dark:hover:bg-emerald-950/20"
      {...motionProps}
    >
      <TableCell className="pl-4">
        <div className="flex items-center gap-3">
          {/* Avatar Building2 en badge emerald/15 */}
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
            aria-hidden="true"
          >
            <Building2 className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="break-words font-display text-sm font-semibold leading-snug text-forest">
              {e.nom}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {e.code_officiel ? (
          <span className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground">
            <Hash className="size-3 text-muted-foreground" aria-hidden="true" />
            {e.code_officiel}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {e.ville || "—"}
      </TableCell>
      <TableCell>
        {e.applique_categorie_affecte ? (
          <Badge
            variant="outline"
            className="gap-1 border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200"
          >
            <ShieldCheck className="size-3" />
            Affecté / Non affecté
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="gap-1 border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200"
          >
            <Globe className="size-3" />
            Tarif unique
          </Badge>
        )}
      </TableCell>
      <TableCell>
        {e.actif === false ? (
          <Badge
            variant="outline"
            className="border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200"
          >
            Inactif
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
          >
            Actif
          </Badge>
        )}
      </TableCell>
      <TableCell className="pr-4 text-right">
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          title="Modifier cet établissement"
          aria-label={`Modifier l'établissement « ${e.nom} »`}
        >
          <Pencil className="size-3.5" />
          <span className="hidden lg:inline">Modifier</span>
          <span className="lg:hidden">Modifier</span>
        </Button>
      </TableCell>
    </motion.tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Utilisateurs »
// ─────────────────────────────────────────────────────────────────────────────

function UtilisateursPanel() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const etablissement = useAuthStore((s) => s.etablissement);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Utilisateur | null>(null);

  const {
    data: utilisateurs,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: usersKeys.list({ etablissementId: etablissement?.id }),
    queryFn: () => fetchUtilisateurs(etablissement?.id),
    retry: 1,
    retryDelay: 1500,
  });

  // ─── KPIs calculés sur la liste des utilisateurs ───────────────────────
  const list = utilisateurs ?? [];
  const kpis = React.useMemo(() => {
    let actifs = 0;
    let suspendus = 0;
    let multiEtab = 0;
    for (const u of list) {
      if (u.statut === "ACTIF") actifs += 1;
      if (u.statut === "SUSPENDU") suspendus += 1;
      if (u.accesses && u.accesses.length > 1) multiEtab += 1;
    }
    return { total: list.length, actifs, suspendus, multiEtab };
  }, [list]);

  function openCreate() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(u: Utilisateur) {
    setEditTarget(u);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Bandeau : compte + actions ─────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {utilisateurs?.length ?? 0} utilisateur(s). La liste affiche tous les
          comptes ayant au moins un accès à l&apos;établissement courant.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Actualiser la liste des utilisateurs"
          >
            <Loader2 className={cn("size-3.5", isFetching && "animate-spin")} />
            Actualiser
          </Button>
          <Button
            onClick={openCreate}
            variant="success"
            size="sm"
            title="Créer un nouvel utilisateur"
          >
            <Plus className="size-4" />
            Nouvel utilisateur
          </Button>
        </div>
      </div>

      {/* ─── 4 StatCards de résumé ────────────────────────────────────────── */}
      <section
        aria-label="Résumé des utilisateurs"
        className="grid grid-cols-2 items-stretch gap-3 sm:gap-4 md:grid-cols-4"
      >
        <StatCard
          icon={Users}
          tone="emerald"
          label="Total utilisateurs"
          value={kpis.total}
          hint={isLoading ? "chargement…" : "comptes actifs ou non"}
          delay={0}
          className="h-full"
        />
        <StatCard
          icon={CheckCircle2}
          tone="forest"
          label="Actifs"
          value={kpis.actifs}
          hint="utilisateurs validés"
          delay={0.05}
          className="h-full"
        />
        <StatCard
          icon={ShieldAlert}
          tone="terracotta"
          label="Suspendus"
          value={kpis.suspendus}
          hint="accès bloqués"
          delay={0.1}
          className="h-full"
        />
        <StatCard
          icon={Building2}
          tone="gold"
          label="Multi-établissements"
          value={kpis.multiEtab}
          hint="≥ 2 accès établissement"
          delay={0.15}
          className="h-full"
        />
      </section>

      <KentePattern variant="separator" className="my-1" />

      {/* ─── Contenu : tableau / skeleton / empty / error ─────────────────── */}
      {isLoading ? (
        <LoadingState rows={5} />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : list.length === 0 ? (
        <EmptyState
          title="Aucun utilisateur"
          message="Créez le premier compte utilisateur pour gérer les accès au système."
        />
      ) : (
        <GlassCard
          variant="adaptive"
          noHover
          noAnimation
          premiumBorder
          className="overflow-hidden p-0"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <TableHead className="min-w-[220px] pl-4 text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Nom complet
                  </TableHead>
                  <TableHead className="min-w-[200px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Email
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Rôle global
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Accès établissements
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    État
                  </TableHead>
                  <TableHead className="pr-4 text-right text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((u, index) => (
                  <UtilisateurRow
                    key={u.id}
                    utilisateur={u}
                    index={index}
                    prefersReducedMotion={prefersReducedMotion}
                    onEdit={() => openEdit(u)}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      )}

      <UtilisateurFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        utilisateur={editTarget}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ligne du tableau Utilisateur (motion.tr avec stagger delay index*0.02)
// ─────────────────────────────────────────────────────────────────────────────

function UtilisateurRow({
  utilisateur: u,
  index,
  prefersReducedMotion,
  onEdit,
}: {
  utilisateur: Utilisateur;
  index: number;
  prefersReducedMotion: boolean;
  onEdit: () => void;
}) {
  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.3,
          delay: Math.min(index * 0.02, 0.4),
          ease: [0.22, 1, 0.36, 1] as const,
        },
      };
  const nomComplet = `${u.prenoms ?? ""} ${u.nom ?? ""}`.trim();
  return (
    <motion.tr
      data-slot="table-row"
      className="hover:bg-emerald-50/60 border-b transition-colors dark:hover:bg-emerald-950/20"
      {...motionProps}
    >
      <TableCell className="pl-4">
        <div className="flex items-center gap-3">
          {/* Avatar initiales bg-emerald-600 text-white */}
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white"
            aria-hidden="true"
          >
            {userInitials(u)}
          </div>
          <div className="min-w-0">
            <div className="break-words font-display text-sm font-semibold leading-snug text-forest">
              {nomComplet || "—"}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        {u.email ? (
          <span className="break-all text-xs leading-snug text-muted-foreground">
            {u.email}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {u.role_global ? (
          <Badge
            variant="outline"
            className={cn("font-medium", ROLE_CLS[u.role_global])}
          >
            {ROLE_LABEL[u.role_global]}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {u.accesses && u.accesses.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {u.accesses.map((a) => (
              <span
                key={a.id}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200"
                title={ROLE_LABEL[a.role]}
              >
                <Building2 className="size-2.5" aria-hidden="true" />
                {a.etablissement?.nom ?? "Étab."}
                <span className="text-muted-foreground">
                  · {ROLE_LABEL[a.role]}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Aucun accès</span>
        )}
      </TableCell>
      <TableCell>
        {u.statut === "ACTIF" ? (
          <Badge
            variant="outline"
            className="border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
          >
            Actif
          </Badge>
        ) : u.statut === "SUSPENDU" ? (
          <Badge
            variant="outline"
            className="gap-1 border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200"
          >
            <ShieldAlert className="size-3" />
            Suspendu
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200"
          >
            Inactif
          </Badge>
        )}
      </TableCell>
      <TableCell className="pr-4 text-right">
        <Button
          variant="outline"
          size="sm"
          onClick={onEdit}
          title="Modifier cet utilisateur"
          aria-label={`Modifier l'utilisateur « ${nomComplet || u.email} »`}
        >
          <Pencil className="size-3.5" />
          <span className="hidden lg:inline">Modifier</span>
          <span className="lg:hidden">Modifier</span>
        </Button>
      </TableCell>
    </motion.tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Onglet « Audit »
// ─────────────────────────────────────────────────────────────────────────────

function AuditPanel() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [entite, setEntite] = React.useState<string>("all");
  const [utilisateurId, setUtilisateurId] = React.useState<string>("all");
  const [dateDebut, setDateDebut] = React.useState("");
  const [dateFin, setDateFin] = React.useState("");
  const [page, setPage] = React.useState(1);

  // Liste utilisateurs pour le filtre
  const { data: utilisateurs } = useQuery({
    queryKey: usersKeys.list({}),
    queryFn: () => fetchUtilisateurs(),
    retry: 1,
    retryDelay: 1500,
  });

  const params: AuditQueryParams = React.useMemo(
    () => ({
      entite: entite !== "all" ? entite : undefined,
      utilisateur_id: utilisateurId !== "all" ? utilisateurId : undefined,
      date_debut: dateDebut || undefined,
      date_fin: dateFin || undefined,
      page,
      page_size: PAGE_SIZE,
    }),
    [entite, utilisateurId, dateDebut, dateFin, page],
  );

  const {
    data: result,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: auditKeys.list(params),
    queryFn: () => fetchAudit(params),
    retry: 1,
    retryDelay: 1500,
  });

  React.useEffect(() => {
    setPage(1);
  }, [entite, utilisateurId, dateDebut, dateFin]);

  const total = result?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rows = result?.data ?? [];

  function resetFilters() {
    setEntite("all");
    setUtilisateurId("all");
    setDateDebut("");
    setDateFin("");
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Filtres premium ─────────────────────────────────────────────── */}
      <GlassCard
        variant="adaptive"
        noHover
        noAnimation
        className="p-4 sm:p-5"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Entité</Label>
            <Select value={entite} onValueChange={setEntite}>
              <SelectTrigger
                className="w-full bg-background"
                aria-label="Filtrer par entité"
              >
                <Filter className="size-4 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Utilisateur</Label>
            <Select value={utilisateurId} onValueChange={setUtilisateurId}>
              <SelectTrigger
                className="w-full bg-background"
                aria-label="Filtrer par utilisateur"
              >
                <User className="size-4 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous utilisateurs</SelectItem>
                {(utilisateurs ?? []).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {`${u.prenoms ?? ""} ${u.nom ?? ""}`.trim() || u.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aud-debut" className="text-xs">
              Date début
            </Label>
            <div className="relative">
              <Calendar
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="aud-debut"
                type="date"
                value={dateDebut}
                onChange={(e) => setDateDebut(e.target.value)}
                max={dateFin || todayISO()}
                className="bg-background pl-8"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aud-fin" className="text-xs">
              Date fin
            </Label>
            <div className="relative">
              <Calendar
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="aud-fin"
                type="date"
                value={dateFin}
                onChange={(e) => setDateFin(e.target.value)}
                min={dateDebut || undefined}
                max={todayISO()}
                className="bg-background pl-8"
              />
            </div>
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={resetFilters}
              title="Réinitialiser les filtres d'audit"
            >
              <RotateCcw className="size-3.5" />
              Réinitialiser
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* ─── Bandeau : compte + actualiser ───────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {isFetching ? (
            <>
              <Loader2 className="size-3 animate-spin" />
              Mise à jour…
            </>
          ) : (
            <>
              <ScrollText className="size-3" />
              {total} entrée(s) d&apos;audit
            </>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          title="Actualiser le journal d'audit"
        >
          <Loader2 className={cn("size-3.5", isFetching && "animate-spin")} />
          Actualiser
        </Button>
      </div>

      {/* ─── Contenu : tableau / skeleton / empty / error ─────────────────── */}
      {isLoading ? (
        <LoadingState rows={8} rowHeight="h-10" />
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState
          title="Journal d'audit vide"
          message="Aucune entrée ne correspond à vos filtres. Les actions sensibles (création, modification, suppression) sont journalisées automatiquement."
        />
      ) : (
        <GlassCard
          variant="adaptive"
          noHover
          noAnimation
          premiumBorder
          className="overflow-hidden p-0"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-emerald-100 bg-emerald-50/60 hover:bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                  <TableHead className="min-w-[150px] pl-4 text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Date
                  </TableHead>
                  <TableHead className="min-w-[180px] text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Utilisateur
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Action
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Entité
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Entité ID
                  </TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    IP
                  </TableHead>
                  <TableHead className="min-w-[280px] pr-4 text-xs font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-200">
                    Description
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((entry, index) => (
                  <AuditRow
                    key={entry.id}
                    entry={entry}
                    index={index}
                    prefersReducedMotion={prefersReducedMotion}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </GlassCard>
      )}

      {/* ─── Pagination ─────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1 || isFetching}
            title="Page précédente"
          >
            Précédent
          </Button>
          <span className="text-xs font-medium text-muted-foreground">
            Page {page} sur {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages || isFetching}
            title="Page suivante"
          >
            Suivant
          </Button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Ligne du tableau Audit (motion.tr avec stagger delay index*0.02)
// ─────────────────────────────────────────────────────────────────────────────

function AuditRow({
  entry,
  index,
  prefersReducedMotion,
}: {
  entry: JournalAudit;
  index: number;
  prefersReducedMotion: boolean;
}) {
  const motionProps = prefersReducedMotion
    ? {}
    : {
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        transition: {
          duration: 0.3,
          delay: Math.min(index * 0.02, 0.4),
          ease: [0.22, 1, 0.36, 1] as const,
        },
      };
  const actionLower = entry.action.toLowerCase();
  const actionCls = actionLower.includes("delete") ||
    actionLower.includes("supprim")
    ? "border-rose-300 bg-rose-100 text-rose-800 dark:border-rose-800/60 dark:bg-rose-950/50 dark:text-rose-200"
    : actionLower.includes("create") || actionLower.includes("création")
      ? "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200"
      : "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/50 dark:text-amber-200";
  return (
    <motion.tr
      data-slot="table-row"
      className="hover:bg-emerald-50/60 border-b transition-colors dark:hover:bg-emerald-950/20"
      {...motionProps}
    >
      <TableCell className="pl-4 text-xs whitespace-nowrap">
        {formatDateTime(entry.date_action)}
      </TableCell>
      <TableCell className="text-xs font-medium">
        {entry.utilisateur
          ? `${entry.utilisateur.prenoms ?? ""} ${entry.utilisateur.nom ?? ""}`.trim()
          : "Système"}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={cn("font-medium", actionCls)}>
          {entry.action}
        </Badge>
      </TableCell>
      <TableCell className="text-xs">{entry.entite}</TableCell>
      <TableCell className="font-mono text-[11px] text-muted-foreground">
        {entry.entite_id ? entry.entite_id.slice(0, 8) + "…" : "—"}
      </TableCell>
      <TableCell className="font-mono text-[11px] text-muted-foreground">
        {entry.adresse_ip ?? "—"}
      </TableCell>
      <TableCell className="pr-4 text-xs text-muted-foreground">
        <span className="break-words leading-snug">
          {entry.description ?? "—"}
        </span>
      </TableCell>
    </motion.tr>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// États partagés (premium)
// ─────────────────────────────────────────────────────────────────────────────

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <GlassCard
      variant="adaptive"
      noHover
      className="relative overflow-hidden"
    >
      <KentePattern variant="bg" />
      <div className="relative flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="font-display text-base font-semibold text-forest">
            Erreur de chargement
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Le backend n&apos;a pas pu répondre. Réessayez ou vérifiez votre
            connexion.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          title="Réessayer le chargement"
        >
          <Loader2 className="size-3.5" />
          Réessayer
        </Button>
      </div>
    </GlassCard>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <GlassCard
      variant="adaptive"
      noHover
      className="relative overflow-hidden"
    >
      <KentePattern variant="bg" />
      <div className="relative flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="size-6" />
        </div>
        <div className="space-y-1">
          <p className="font-display text-base font-semibold text-forest">
            {title}
          </p>
          <p className="max-w-md text-sm text-muted-foreground">{message}</p>
        </div>
      </div>
    </GlassCard>
  );
}

function LoadingState({
  rows = 5,
  rowHeight = "h-14",
}: {
  rows?: number;
  rowHeight?: string;
}) {
  return (
    <GlassCard
      variant="adaptive"
      noHover
      noAnimation
      className="relative overflow-hidden p-0"
    >
      <KentePattern variant="strip" position="top" />
      <div className="space-y-2 p-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className={cn("w-full", rowHeight)} />
        ))}
      </div>
    </GlassCard>
  );
}
