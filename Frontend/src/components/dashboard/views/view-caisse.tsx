"use client";

/**
 * ScolaGest — Vue « Caisse » (Phase 3 — améliorée).
 *
 * Cinq onglets (deux nouveaux en tête) :
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
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Wallet className="size-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Caisse</h1>
            <p className="text-sm text-muted-foreground">
              Tableau de bord, file d'attente, encaissement, historique et
              clôture quotidienne.
              {etablissement?.nom ? (
                <span className="ml-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {etablissement.nom}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as CaisseTab)}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:grid-cols-none">
          <TabsTrigger value="dashboard">
            <LayoutDashboard className="size-3.5" />
            <span className="truncate">Tableau de bord</span>
          </TabsTrigger>
          <TabsTrigger value="file" className="relative">
            <Users className="size-3.5" />
            <span className="truncate">File d'attente</span>
            {fileCount > 0 && (
              <span
                className={cn(
                  "ml-1 flex size-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none",
                  tab === "file"
                    ? "bg-amber-600 text-white"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
                )}
              >
                {fileCount > 99 ? "99+" : fileCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="encaissement">
            <ReceiptText className="size-3.5" />
            <span className="truncate">Encaissement</span>
          </TabsTrigger>
          <TabsTrigger value="historique" className="col-span-2 sm:col-span-1">
            <History className="size-3.5" />
            <span className="truncate">Historique</span>
          </TabsTrigger>
          <TabsTrigger value="cloture">
            <Lock className="size-3.5" />
            <span className="truncate">Clôture</span>
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
