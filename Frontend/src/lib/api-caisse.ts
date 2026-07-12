"use client";

/**
 * ScolaGest — API client Phase 3 : Module de caisse.
 *
 * Couvre : frais (configuration) + échéances, soldes (élève & liste),
 * paiements (encaissements, annulation), reçus, clôture de caisse.
 *
 * Toutes les fonctions s'appuient sur le client API générique (`@/lib/api-client`)
 * qui attache automatiquement le JWT et le paramètre `?XTransformPort=8080`.
 *
 * Les clés de cache React Query sont centralisées ici pour faciliter
 * l'invalidation croisée entre composants.
 */

import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
} from "@/lib/api-client";
import type {
  ClotureCaisse,
  ClotureDTO,
  CloturesQueryParams,
  Echeance,
  Frais,
  FraisDTO,
  Paiement,
  PaiementDTO,
  PaiementsListResponse,
  PaiementsQueryParams,
  Recu,
  SoldeEleve,
  SoldeListItem,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Clés de cache React Query
// ─────────────────────────────────────────────────────────────────────────────

export const fraisKeys = {
  all: ["frais"] as const,
  lists: () => [...fraisKeys.all, "list"] as const,
  list: (anneeId?: string) => [...fraisKeys.lists(), { anneeId }] as const,
  details: () => [...fraisKeys.all, "detail"] as const,
  detail: (id: string) => [...fraisKeys.details(), id] as const,
  echeances: (fraisId: string) =>
    [...fraisKeys.detail(fraisId), "echeances"] as const,
};

export const soldesKeys = {
  all: ["soldes"] as const,
  eleve: (eleveId: string) => [...soldesKeys.all, "eleve", eleveId] as const,
  list: (filters: {
    classe_id?: string;
    categorie?: string;
    statut?: string;
  }) => [...soldesKeys.all, "list", filters] as const,
};

export const paiementsKeys = {
  all: ["paiements"] as const,
  lists: () => [...paiementsKeys.all, "list"] as const,
  list: (params: PaiementsQueryParams) =>
    [...paiementsKeys.lists(), params] as const,
  details: () => [...paiementsKeys.all, "detail"] as const,
  detail: (id: string) => [...paiementsKeys.details(), id] as const,
  recu: (paiementId: string) =>
    [...paiementsKeys.detail(paiementId), "recu"] as const,
};

export const cloturesKeys = {
  all: ["clotures"] as const,
  aujourdhui: () => [...cloturesKeys.all, "aujourdhui"] as const,
  list: (filters: CloturesQueryParams) =>
    [...cloturesKeys.all, "list", filters] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────────

function buildPaiementsQuery(params: PaiementsQueryParams = {}): string {
  const {
    eleve_id,
    date_debut,
    date_fin,
    caissier_id,
    mode,
    page = 1,
    page_size = 20,
  } = params;
  const qs = new URLSearchParams();
  if (eleve_id) qs.set("eleve_id", eleve_id);
  if (date_debut) qs.set("date_debut", date_debut);
  if (date_fin) qs.set("date_fin", date_fin);
  if (caissier_id) qs.set("caissier_id", caissier_id);
  if (mode) qs.set("mode", mode);
  qs.set("page", String(page));
  qs.set("page_size", String(page_size));
  return qs.toString();
}

function buildSoldesQuery(filters: {
  classe_id?: string;
  categorie?: string;
  statut?: string;
}): string {
  const qs = new URLSearchParams();
  if (filters.classe_id) qs.set("classe_id", filters.classe_id);
  if (filters.categorie) qs.set("categorie", filters.categorie);
  if (filters.statut) qs.set("statut", filters.statut);
  return qs.toString();
}

function buildCloturesQuery(filters: CloturesQueryParams): string {
  const qs = new URLSearchParams();
  if (filters.date) qs.set("date", filters.date);
  if (filters.caissier_id) qs.set("caissier_id", filters.caissier_id);
  return qs.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Frais
// ─────────────────────────────────────────────────────────────────────────────

export function fetchFrais(anneeId?: string): Promise<Frais[]> {
  const qs = anneeId
    ? `?annee_scolaire_id=${encodeURIComponent(anneeId)}`
    : "";
  return apiGet<Frais[]>(`/api/frais${qs}`);
}

export function fetchFraisDetail(id: string): Promise<Frais> {
  return apiGet<Frais>(`/api/frais/${id}`);
}

export function createFrais(dto: FraisDTO): Promise<Frais> {
  return apiPost<Frais>("/api/frais", dto);
}

export function updateFrais(id: string, dto: FraisDTO): Promise<Frais> {
  return apiPut<Frais>(`/api/frais/${id}`, dto);
}

export async function deleteFrais(id: string): Promise<boolean> {
  await apiDelete<{ success: boolean }>(`/api/frais/${id}`);
  return true;
}

export function fetchEcheances(fraisId: string): Promise<Echeance[]> {
  return apiGet<Echeance[]>(`/api/frais/${fraisId}/echeances`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Soldes
// ─────────────────────────────────────────────────────────────────────────────

export function fetchSoldeEleve(eleveId: string): Promise<SoldeEleve> {
  return apiGet<SoldeEleve>(`/api/eleves/${eleveId}/solde`);
}

export function fetchSoldes(filters: {
  classe_id?: string;
  categorie?: string;
  statut?: string;
}): Promise<SoldeListItem[]> {
  const qs = buildSoldesQuery(filters);
  return apiGet<SoldeListItem[]>(`/api/soldes${qs ? `?${qs}` : ""}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Paiements
// ─────────────────────────────────────────────────────────────────────────────

export function fetchPaiements(
  params: PaiementsQueryParams = {},
): Promise<PaiementsListResponse> {
  return apiGet<PaiementsListResponse>(
    `/api/paiements?${buildPaiementsQuery(params)}`,
  );
}

export function fetchPaiement(id: string): Promise<Paiement> {
  return apiGet<Paiement>(`/api/paiements/${id}`);
}

export function createPaiement(dto: PaiementDTO): Promise<Paiement> {
  return apiPost<Paiement>("/api/paiements", dto);
}

export function annulerPaiement(
  id: string,
  motif: string,
): Promise<Paiement> {
  return apiPost<Paiement>(`/api/paiements/${id}/annuler`, { motif });
}

// ─────────────────────────────────────────────────────────────────────────────
// Reçu
// ─────────────────────────────────────────────────────────────────────────────

export function fetchRecu(paiementId: string): Promise<Recu> {
  return apiGet<Recu>(`/api/paiements/${paiementId}/recu`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Clôture de caisse
// ─────────────────────────────────────────────────────────────────────────────

export function fetchClotureAujourdhui(): Promise<ClotureCaisse | null> {
  return apiGet<ClotureCaisse | null>("/api/clotures/aujourdhui");
}

export function fetchClotures(
  filters: CloturesQueryParams,
): Promise<ClotureCaisse[]> {
  const qs = buildCloturesQuery(filters);
  return apiGet<ClotureCaisse[]>(`/api/clotures${qs ? `?${qs}` : ""}`);
}

export function createCloture(dto: ClotureDTO): Promise<ClotureCaisse> {
  return apiPost<ClotureCaisse>("/api/clotures", dto);
}

export function validerCloture(id: string): Promise<ClotureCaisse> {
  return apiPost<ClotureCaisse>(`/api/clotures/${id}/valider`, {});
}

// ─────────────────────────────────────────────────────────────────────────────
// File d'attente PRE_INSCRIT + Dashboard caisse (amélioration)
// ─────────────────────────────────────────────────────────────────────────────

/** Élève en file d'attente (PRE_INSCRIT, en attente de paiement frais inscription). */
export interface EleveFileAttente {
  eleve_id: string;
  identifiant_interne: string;
  nom: string;
  prenoms: string;
  classe_libelle: string;
  classe_id: string;
  categorie: string;
  inscription_id: string;
  date_inscription: string;
  source: string; // "PRE_INSCRIPTION" | "INSCRIPTION_MANUELLE"
  frais_inscription_id?: string | null;
  montant_attendu: number;
  montant_deja_paye: number;
  solde_du: number;
}

/** Répartition des encaissements par mode de paiement. */
export interface RepartitionModeCaisse {
  mode: string;
  label: string;
  montant: number;
  nb: number;
  pourcentage: number;
}

/** Dernier paiement du jour (pour le dashboard). */
export interface DernierPaiement {
  id: string;
  numero_recu: string;
  eleve_nom: string;
  eleve_prenoms: string;
  montant: number;
  mode_paiement: string;
  heure: string;
  frais_libelle: string;
}

/** Dashboard caisse : KPIs temps réel. */
export interface DashboardCaisse {
  date: string;
  total_encaisse: number;
  nb_transactions: number;
  nb_annulations: number;
  file_attente_count: number;
  repartition_modes: RepartitionModeCaisse[];
  derniers_paiements: DernierPaiement[];
}

/** Récupère la file d'attente des élèves PRE_INSCRIT. */
export function fetchFileAttente(): Promise<EleveFileAttente[]> {
  return apiGet<EleveFileAttente[]>("/api/caisse/file-attente");
}

/** Récupère le dashboard caisse (KPIs du jour). */
export function fetchDashboardCaisse(date?: string): Promise<DashboardCaisse> {
  const qs = new URLSearchParams();
  if (date) qs.set("date", date);
  const query = qs.toString();
  return apiGet<DashboardCaisse>(`/api/caisse/dashboard${query ? `?${query}` : ""}`);
}
