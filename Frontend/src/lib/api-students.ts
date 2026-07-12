"use client";

/**
 * ScolaGest — API client Phase 2 : Gestion des élèves.
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
  AnneeScolaire,
  Classe,
  Cycle,
  Eleve,
  EleveDTO,
  EleveStats,
  ElevesListResponse,
  ElevesQueryParams,
  Inscription,
  InscriptionDTO,
  Tuteur,
  TuteurDTO,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Clés de cache React Query
// ─────────────────────────────────────────────────────────────────────────────

/** Préfixe de toutes les clés liées aux élèves. */
export const elevesKeys = {
  all: ["eleves"] as const,
  lists: () => [...elevesKeys.all, "list"] as const,
  list: (params: ElevesQueryParams) =>
    [...elevesKeys.lists(), params] as const,
  details: () => [...elevesKeys.all, "detail"] as const,
  detail: (id: string) => [...elevesKeys.details(), id] as const,
};

export const tuteursKeys = {
  all: ["tuteurs"] as const,
  lists: () => [...tuteursKeys.all, "list"] as const,
  list: (search?: string) => [...tuteursKeys.lists(), { search }] as const,
};

export const classesKeys = {
  all: ["classes"] as const,
  list: (etablissementId?: string) =>
    [...classesKeys.all, { etablissementId }] as const,
};

export const cyclesKeys = {
  all: ["cycles"] as const,
  list: (etablissementId?: string) =>
    [...cyclesKeys.all, { etablissementId }] as const,
};

export const anneesKeys = {
  all: ["annees-scolaires"] as const,
  list: () => [...anneesKeys.all, "list"] as const,
  active: () => [...anneesKeys.all, "active"] as const,
};

export const inscriptionsKeys = {
  all: ["inscriptions"] as const,
  list: (eleveId: string) =>
    [...inscriptionsKeys.all, "list", { eleveId }] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers interne
// ─────────────────────────────────────────────────────────────────────────────

/** Construit la query string pour les paramètres de liste d'élèves. */
function buildElevesQuery(params: ElevesQueryParams = {}): string {
  const {
    search,
    classe_id,
    cycle_id,
    niveau,
    categorie,
    statut,
    page = 1,
    page_size = 20,
  } = params;
  const qs = new URLSearchParams();
  if (search) qs.set("search", search);
  if (classe_id) qs.set("classe_id", classe_id);
  if (cycle_id) qs.set("cycle_id", cycle_id);
  if (niveau !== undefined) qs.set("niveau", String(niveau));
  if (categorie) qs.set("categorie", categorie);
  if (statut) qs.set("statut", statut);
  qs.set("page", String(page));
  qs.set("page_size", String(page_size));
  return qs.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Élèves
// ─────────────────────────────────────────────────────────────────────────────

export function fetchEleves(
  params: ElevesQueryParams = {},
): Promise<ElevesListResponse> {
  return apiGet<ElevesListResponse>(`/api/eleves?${buildElevesQuery(params)}`);
}

/** Exporte TOUS les élèves correspondant aux filtres (sans pagination). */
export function fetchElevesExport(
  params: ElevesQueryParams = {},
): Promise<Eleve[]> {
  // On retire page/page_size (non pertinents pour l'export)
  const { page: _page, page_size: _ps, ...exportParams } = params;
  return apiGet<Eleve[]>(`/api/eleves/export?${buildElevesQuery(exportParams)}`);
}

/** Statistiques agrégées (total, garçons/filles, redoublants) sur les élèves
 * correspondant aux filtres. */
export function fetchElevesStats(
  params: ElevesQueryParams = {},
): Promise<EleveStats> {
  const { page: _page, page_size: _ps, ...statsParams } = params;
  return apiGet<EleveStats>(`/api/eleves/stats?${buildElevesQuery(statsParams)}`);
}

export function fetchEleve(id: string): Promise<Eleve> {
  return apiGet<Eleve>(`/api/eleves/${id}`);
}

export function createEleve(dto: EleveDTO): Promise<Eleve> {
  return apiPost<Eleve>("/api/eleves", dto);
}

export function updateEleve(id: string, dto: Partial<EleveDTO>): Promise<Eleve> {
  return apiPut<Eleve>(`/api/eleves/${id}`, dto);
}

export async function deleteEleve(id: string): Promise<boolean> {
  await apiDelete<{ success: boolean }>(`/api/eleves/${id}`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tuteurs
// ─────────────────────────────────────────────────────────────────────────────

export function fetchTuteurs(search?: string): Promise<Tuteur[]> {
  const qs = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiGet<Tuteur[]>(`/api/tuteurs${qs}`);
}

export function fetchTuteur(id: string): Promise<Tuteur> {
  return apiGet<Tuteur>(`/api/tuteurs/${id}`);
}

export function createTuteur(dto: TuteurDTO): Promise<Tuteur> {
  return apiPost<Tuteur>("/api/tuteurs", dto);
}

export function updateTuteur(
  id: string,
  dto: Partial<TuteurDTO>,
): Promise<Tuteur> {
  return apiPut<Tuteur>(`/api/tuteurs/${id}`, dto);
}

export async function deleteTuteur(id: string): Promise<boolean> {
  await apiDelete<{ success: boolean }>(`/api/tuteurs/${id}`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Inscriptions
// ─────────────────────────────────────────────────────────────────────────────

export function fetchInscriptions(eleveId: string): Promise<Inscription[]> {
  return apiGet<Inscription[]>(`/api/inscriptions?eleve_id=${eleveId}`);
}

export function createInscription(
  eleveId: string,
  dto: InscriptionDTO,
): Promise<Inscription> {
  return apiPost<Inscription>(`/api/eleves/${eleveId}/inscriptions`, dto);
}

export function updateInscription(
  id: string,
  dto: Partial<InscriptionDTO>,
): Promise<Inscription> {
  return apiPut<Inscription>(`/api/inscriptions/${id}`, dto);
}

// ─────────────────────────────────────────────────────────────────────────────
// Cycles & Classes (lecture seule)
// ─────────────────────────────────────────────────────────────────────────────

export function fetchCycles(etablissementId?: string): Promise<Cycle[]> {
  const qs = etablissementId
    ? `?etablissement_id=${encodeURIComponent(etablissementId)}`
    : "";
  return apiGet<Cycle[]>(`/api/cycles${qs}`);
}

export function fetchClasses(etablissementId?: string): Promise<Classe[]> {
  const qs = etablissementId
    ? `?etablissement_id=${encodeURIComponent(etablissementId)}`
    : "";
  return apiGet<Classe[]>(`/api/classes${qs}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Années scolaires
// ─────────────────────────────────────────────────────────────────────────────

export function fetchAnneesScolaires(): Promise<AnneeScolaire[]> {
  return apiGet<AnneeScolaire[]>("/api/annees-scolaires");
}

export function fetchActiveAnnee(): Promise<AnneeScolaire> {
  return apiGet<AnneeScolaire>("/api/annees-scolaires/active");
}
