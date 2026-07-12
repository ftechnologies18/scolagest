"use client";

/**
 * ScolaGest — Client API pour le tableau de bord Effectifs (Phase 3, Innovation 1).
 *
 * Endpoint unique :
 *   GET /api/effectifs?annee_scolaire_id=<uuid?>
 *     → { kpis: EffectifsKPIs, classes: EffectifClasse[] }
 *
 * Le backend filtre les données par l'établissement de la session. Si
 * `annee_scolaire_id` est omis, l'année active de l'établissement est utilisée.
 *
 * Les clés de cache React Query sont centralisées ici pour faciliter
 * l'invalidation croisée entre composants.
 */

import { apiGet } from "@/lib/api-client";

// ─────────────────────────────────────────────────────────────────────────────
// Types (reflètent exactement le JSON du backend — effectifs_service.go)
// ─────────────────────────────────────────────────────────────────────────────

/** Effectif d'une classe pour une année scolaire donnée. */
export interface EffectifClasse {
  classe_id: string;
  classe_libelle: string;
  cycle_libelle: string;
  niveau: number;
  effectif: number;
  effectif_max: number;
  /** Quota par défaut de l'établissement (utilisé si `effectif_max` <= 0). */
  quota_etablissement: number;
  /** Taux de remplissage 0-100 (effectif / effectif_max). */
  taux_remplissage: number;
  garcons: number;
  filles: number;
  redoublants: number;
  est_classe_examen: boolean;
}

/** Indicateurs agrégés au niveau établissement. */
export interface EffectifsKPIs {
  total_eleves: number;
  total_classes: number;
  garcons: number;
  filles: number;
  redoublants: number;
  /** Moyenne pondérée du taux de remplissage (0-100). */
  taux_remplissage_global: number;
  /** Nombre de classes dont l'effectif >= quota. */
  classes_pleines: number;
}

/** Résultat complet : KPIs globaux + détails par classe. */
export interface EffectifsResult {
  kpis: EffectifsKPIs;
  classes: EffectifClasse[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Clés de cache React Query
// ─────────────────────────────────────────────────────────────────────────────

/** Préfixe de toutes les clés liées aux effectifs. */
export const effectifsKeys = {
  all: ["effectifs"] as const,
  detail: (anneeId?: string) =>
    [...effectifsKeys.all, { anneeId: anneeId ?? null }] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Récupère les effectifs de l'établissement courant (filtré côté backend par
 * l'établissement de la session) pour une année scolaire donnée. Si
 * `anneeId` est omis, le backend utilise l'année active de l'établissement.
 */
export function fetchEffectifs(anneeId?: string): Promise<EffectifsResult> {
  const qs = new URLSearchParams();
  if (anneeId) qs.set("annee_scolaire_id", anneeId);
  const query = qs.toString();
  return apiGet<EffectifsResult>(query ? `/api/effectifs?${query}` : "/api/effectifs");
}
