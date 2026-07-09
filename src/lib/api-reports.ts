"use client";

/**
 * ScolaGest — API client Phase 4 : Rapports & tableaux de bord.
 *
 * Couvre :
 *  - GET /api/dashboard                → KPIs + répartitions (cycle / classe /
 *    catégorie / mode de paiement) + évolution mensuelle + derniers paiements.
 *  - GET /api/rapports/paiements       → rapport détaillé des encaissements
 *    (filtre multicritère). Le paramètre `format=csv|excel` déclenche un
 *    téléchargement de fichier via `downloadFile()`.
 *  - GET /api/rapports/soldes          → soldes par élève (filtres classe,
 *    catégorie, statut) + totaux.
 *  - GET /api/rapports/recouvrement    → taux de recouvrement par classe +
 *    résumé global.
 *  - GET /api/impayes                  → élèves avec solde_du > 0 (filtres
 *    classe, catégorie, échéances en retard uniquement).
 *
 * Les clés de cache React Query (`dashboardKeys`, `rapportsKeys`, `impayesKeys`)
 * sont centralisées ici pour faciliter l'invalidation croisée.
 */

import { apiGet, downloadFile } from "@/lib/api-client";
import type {
  DashboardData,
  ImpayeItem,
  ImpayesFilters,
  RapportPaiementsFilters,
  RapportPaiementsResult,
  RapportRecouvrementFilters,
  RapportRecouvrementResult,
  RapportSoldesFilters,
  RapportSoldesResult,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Clés de cache React Query
// ─────────────────────────────────────────────────────────────────────────────

export const dashboardKeys = {
  all: ["dashboard"] as const,
  /** Tableau de bord agrégé (KPIs + répartitions). */
  data: (filters: { date_debut?: string; date_fin?: string }) =>
    [...dashboardKeys.all, "data", filters] as const,
};

export const rapportsKeys = {
  all: ["rapports"] as const,
  paiements: (filters: RapportPaiementsFilters) =>
    [...rapportsKeys.all, "paiements", filters] as const,
  soldes: (filters: RapportSoldesFilters) =>
    [...rapportsKeys.all, "soldes", filters] as const,
  recouvrement: (filters: RapportRecouvrementFilters) =>
    [...rapportsKeys.all, "recouvrement", filters] as const,
};

export const impayesKeys = {
  all: ["impayes"] as const,
  list: (filters: ImpayesFilters) =>
    [...impayesKeys.all, "list", filters] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes — construction des query strings
// ─────────────────────────────────────────────────────────────────────────────

function buildDashboardQuery(filters: {
  date_debut?: string;
  date_fin?: string;
}): string {
  const qs = new URLSearchParams();
  if (filters.date_debut) qs.set("date_debut", filters.date_debut);
  if (filters.date_fin) qs.set("date_fin", filters.date_fin);
  return qs.toString();
}

function buildRapportPaiementsQuery(filters: RapportPaiementsFilters): string {
  const qs = new URLSearchParams();
  if (filters.date_debut) qs.set("date_debut", filters.date_debut);
  if (filters.date_fin) qs.set("date_fin", filters.date_fin);
  if (filters.cycle_id) qs.set("cycle_id", filters.cycle_id);
  if (filters.classe_id) qs.set("classe_id", filters.classe_id);
  if (filters.categorie) qs.set("categorie", filters.categorie);
  if (filters.mode_paiement) qs.set("mode_paiement", filters.mode_paiement);
  if (filters.caissier_id) qs.set("caissier_id", filters.caissier_id);
  return qs.toString();
}

function buildSoldesQuery(filters: RapportSoldesFilters): string {
  const qs = new URLSearchParams();
  if (filters.classe_id) qs.set("classe_id", filters.classe_id);
  if (filters.categorie) qs.set("categorie", filters.categorie);
  if (filters.statut) qs.set("statut", filters.statut);
  return qs.toString();
}

function buildRecouvrementQuery(filters: RapportRecouvrementFilters): string {
  const qs = new URLSearchParams();
  if (filters.cycle_id) qs.set("cycle_id", filters.cycle_id);
  if (filters.classe_id) qs.set("classe_id", filters.classe_id);
  return qs.toString();
}

function buildImpayesQuery(filters: ImpayesFilters): string {
  const qs = new URLSearchParams();
  if (filters.classe_id) qs.set("classe_id", filters.classe_id);
  if (filters.categorie) qs.set("categorie", filters.categorie);
  if (filters.echeance_passee) qs.set("echeance_passee", "true");
  return qs.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Tableau de bord
// ─────────────────────────────────────────────────────────────────────────────

export function fetchDashboard(filters: {
  date_debut?: string;
  date_fin?: string;
}): Promise<DashboardData> {
  const qs = buildDashboardQuery(filters);
  return apiGet<DashboardData>(`/api/dashboard${qs ? `?${qs}` : ""}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rapport paiements
// ─────────────────────────────────────────────────────────────────────────────

export function fetchRapportPaiements(
  filters: RapportPaiementsFilters,
): Promise<RapportPaiementsResult> {
  const qs = buildRapportPaiementsQuery(filters);
  return apiGet<RapportPaiementsResult>(
    `/api/rapports/paiements${qs ? `?${qs}` : ""}`,
  );
}

/**
 * Déclenche le téléchargement du rapport des paiements au format CSV ou
 * "Excel" (.xls — fichier CSV avec extension .xls, lisible par Excel).
 */
export async function downloadRapportPaiements(
  filters: RapportPaiementsFilters,
  format: "csv" | "excel",
): Promise<boolean> {
  const base = buildRapportPaiementsQuery({
    ...filters,
    format: undefined,
  });
  const qs = new URLSearchParams(base);
  qs.set("format", format);
  const path = `/api/rapports/paiements?${qs.toString()}`;
  const ext = format === "excel" ? "xls" : "csv";
  const date = new Date().toISOString().slice(0, 10);
  const filename = `rapport_paiements_${date}.${ext}`;
  return downloadFile(path, filename);
}

// ─────────────────────────────────────────────────────────────────────────────
// Rapport soldes
// ─────────────────────────────────────────────────────────────────────────────

export function fetchRapportSoldes(
  filters: RapportSoldesFilters,
): Promise<RapportSoldesResult> {
  const qs = buildSoldesQuery(filters);
  return apiGet<RapportSoldesResult>(
    `/api/rapports/soldes${qs ? `?${qs}` : ""}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rapport recouvrement
// ─────────────────────────────────────────────────────────────────────────────

export function fetchRapportRecouvrement(
  filters: RapportRecouvrementFilters,
): Promise<RapportRecouvrementResult> {
  const qs = buildRecouvrementQuery(filters);
  return apiGet<RapportRecouvrementResult>(
    `/api/rapports/recouvrement${qs ? `?${qs}` : ""}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Impayés & relances
// ─────────────────────────────────────────────────────────────────────────────

export function fetchImpayes(filters: ImpayesFilters): Promise<ImpayeItem[]> {
  const qs = buildImpayesQuery(filters);
  return apiGet<ImpayeItem[]>(`/api/impayes${qs ? `?${qs}` : ""}`);
}
