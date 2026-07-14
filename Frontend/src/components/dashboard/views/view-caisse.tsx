"use client";

/**
 * ScolaGest — Vue « Caisse » (Phase 3 — refonte Forêt EdTech).
 *
 * Cinq onglets :
 *  1. Tableau de bord : `<DashboardCaissePanel />` (KPIs du jour, répartition
 *     par mode, derniers encaissements). Le bouton « File d'attente » du
 *     tableau de bord navigue vers l'onglet #2.
 *  2. File d'attente : `<FileAttente />` (élèves PRE_INSCRIT, encaissement
 *     rapide). Un badge compteur est affiché sur le trigger si > 0.
 *  3. Encaissement : `<PaiementEntryForm />` (recherche élève + saisie)
 *  4. Historique   : `<PaiementsList />` (filtres + table + annulation + reçu)
 *  5. Clôture      : `<ClotureCaissePanel />` (clôture quotidienne)
 *
 * La vue s'adapte aux rôles : tous les rôles caisse/accueil peuvent encaisser
 * et voir l'historique ; seuls COMPTABLE/DIRECTION peuvent valider une
 * clôture.
 *
 * Refonte : hero header premium (GlassCard desktop + badge rond gradient
 * emerald→gold + Wallet + pill "Phase 3" + pill établissement) + TabsList
 * premium (glass-desktop subtile + tab actif bg-emerald-600 text-white +
 * icônes + badge file d'attente renforcé).
 */

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  ReceiptText,
  History,
  Lock,
  LayoutDashboard,
  Users,
} from "lucide-react";

import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { fetchFileAttente } from "@/lib/api-caisse";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";
import { PaiementEntryForm } from "@/components/caisse/paiement-entry-form";
import { PaiementsList } from "@/components/caisse/paiements-list";
import { ClotureCaissePanel } from "@/components/caisse/cloture-caisse";
import { FileAttente, fileAttenteKeys } from "@/components/caisse/file-attente";
import {
  DashboardCaissePanel,
} from "@/components/caisse/dashboard-caisse";

type CaisseTab =
  | "dashboard"
  | "file"
  | "encaissement"
  | "historique"
  | "cloture";

export default function CaisseView() {
  const etablissement = useAuthStore((s) => s.etablissement);
  const [tab, setTab] = React.useState<CaisseTab>("dashboard");

  // Compteur léger pour le badge sur l'onglet « File d'attente ».
  const { data: fileAttente } = useQuery({
    queryKey: fileAttenteKeys.list(),
    queryFn: fetchFileAttente,
    enabled: !!etablissement,
    refetchInterval: 30_000, // polling 30s
    refetchOnWindowFocus: true,
  });
  const fileCount = fileAttente?.length ?? 0;

  return (
    <div className="space-y-4 sm:space-y-6">
      <KentePattern variant="strip" position="top" />

      {/* ─── Hero header premium ──────────────────────────────────────── */}
      <GlassCard variant="desktop" noHover premiumBorder className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Badge rond gradient emerald→gold avec icône Wallet */}
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-lg shadow-emerald-900/20">
              <Wallet className="size-6" />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-display text-2xl font-bold tracking-tight text-forest">
                  Caisse
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Tableau de bord, file d&apos;attente, encaissement, historique
                et clôture quotidienne.
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

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as CaisseTab)}
        className="w-full"
      >
        <TabsList className="glass-desktop h-auto w-full gap-1 overflow-x-auto border-0 p-1 sm:w-auto">
          <TabsTrigger
            value="dashboard"
            className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <LayoutDashboard className="size-4" />
            <span className="hidden sm:inline">Tableau de bord</span>
            <span className="sm:hidden">Tableau</span>
          </TabsTrigger>
          <TabsTrigger
            value="file"
            className="relative gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <Users className="size-4" />
            <span>File d&apos;attente</span>
            {fileCount > 0 ? (
              <span
                className={cn(
                  "ml-0.5 flex size-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none",
                  tab === "file"
                    ? "bg-amber-600 text-white"
                    : "border border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/60 dark:text-amber-200",
                )}
                title={`${fileCount} élève(s) en attente`}
              >
                {fileCount > 99 ? "99+" : fileCount}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger
            value="encaissement"
            className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <ReceiptText className="size-4" />
            <span>Encaissement</span>
          </TabsTrigger>
          <TabsTrigger
            value="historique"
            className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <History className="size-4" />
            <span>Historique</span>
          </TabsTrigger>
          <TabsTrigger
            value="cloture"
            className="gap-1.5 data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=active]:shadow-sm"
          >
            <Lock className="size-4" />
            <span>Clôture</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-4">
          <DashboardCaissePanel onJumpToFileAttente={() => setTab("file")} />
        </TabsContent>
        <TabsContent value="file" className="mt-4">
          <FileAttente />
        </TabsContent>
        <TabsContent value="encaissement" className="mt-4">
          <PaiementEntryForm />
        </TabsContent>
        <TabsContent value="historique" className="mt-4">
          <PaiementsList />
        </TabsContent>
        <TabsContent value="cloture" className="mt-4">
          <ClotureCaissePanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
