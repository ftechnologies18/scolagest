"use client";

/**
 * ScolaGest — Vue « Caisse » (Phase 3).
 *
 * Trois onglets :
 *  - Encaissement : `<PaiementEntryForm />` (recherche élève + saisie paiement)
 *  - Historique   : `<PaiementsList />` (filtres + table + annulation + reçu)
 *  - Clôture      : `<ClotureCaissePanel />` (clôture quotidienne)
 *
 * La vue s'adapte aux rôles : tous les rôles caisse/accueil peuvent encaisser
 * et voir l'historique ; seuls COMPTABLE/ADMINISTRATEUR peuvent valider une
 * clôture.
 */

import * as React from "react";
import { Wallet, ReceiptText, History, Lock } from "lucide-react";

import { useAuthStore } from "@/lib/auth-store";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PaiementEntryForm } from "@/components/caisse/paiement-entry-form";
import { PaiementsList } from "@/components/caisse/paiements-list";
import { ClotureCaissePanel } from "@/components/caisse/cloture-caisse";

export default function CaisseView() {
  const etablissement = useAuthStore((s) => s.etablissement);

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
              Encaissement, historique des paiements et clôture quotidienne.
              {etablissement?.nom ? (
                <span className="ml-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  {etablissement.nom}
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="encaissement" className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:grid-cols-none">
          <TabsTrigger value="encaissement">
            <ReceiptText className="size-3.5" />
            Encaissement
          </TabsTrigger>
          <TabsTrigger value="historique">
            <History className="size-3.5" />
            Historique
          </TabsTrigger>
          <TabsTrigger value="cloture">
            <Lock className="size-3.5" />
            Clôture
          </TabsTrigger>
        </TabsList>

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
