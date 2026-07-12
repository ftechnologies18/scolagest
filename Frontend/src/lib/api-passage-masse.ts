"use client";

/**
 * ScolaGest — Client API pour le passage de classe en masse (Phase 3, Innovation 2).
 *
 * Deux endpoints (backend déjà livré) :
 *   POST /api/annees-scolaires/preview
 *     body : { ancienne_annee_id }
 *     →  PreviewEleve[]  (une ligne par élève inscrit dans l'année source)
 *
 *   POST /api/annees-scolaires/promote
 *     body : { ancienne_annee_id, nouvelle_annee_id, decisions: EleveDecision[] }
 *     →  PromoteResult { promus, diplomes, redoublants, non_reinscrits, skipped, erreurs }
 *
 * Les listes d'années scolaires (sélecteurs source/cible) sont récupérées via
 * `fetchAnneesScolaires` et `fetchActiveAnnee` depuis `@/lib/api-students`
 * (réutilisation, pas de duplication).
 */

import { apiPost } from "@/lib/api-client";

// ─────────────────────────────────────────────────────────────────────────────
// Types (reflètent exactement le JSON du backend — promotion_service.go)
// ─────────────────────────────────────────────────────────────────────────────

/** Décision de passage appliquée à un élève pour la fin d'année. */
export type DecisionPassage = "PROMU" | "REDOUBLANT" | "NON_REINSCRIT";

/** Ligne d'aperçu pour un élève (renvoyée par /preview). */
export interface PreviewEleve {
  eleve_id: string;
  eleve_nom: string;
  eleve_prenoms: string;
  /** Libellé de la classe actuelle (peut être vide si pas d'inscription). */
  classe_actuelle: string;
  /** Libellé de la classe suivante suggérée (peut être vide). */
  classe_suivante: string;
  /** true si l'élève termine un cycle d'examen (BEPC, CEPE, etc.). */
  est_diplome: boolean;
  /** Décision par défaut calculée par le backend ("PROMU" en général). */
  decision: DecisionPassage;
}

/** Décision éditable soumise au backend pour un élève. */
export interface EleveDecision {
  eleve_id: string;
  decision: DecisionPassage;
}

/** Compteurs de résultat retournés par /promote. */
export interface PromoteResult {
  promus: number;
  diplomes: number;
  redoublants: number;
  non_reinscrits: number;
  /** Élèves ignorés (déjà inscrits dans l'année cible, etc.). */
  skipped: number;
  /** Élèves en erreur (transaction rollback pour eux seuls). */
  erreurs: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Génère l'aperçu du passage de classe pour une année source donnée.
 * Le backend retourne une ligne par élève inscrit dans l'année source, avec la
 * classe suivante suggérée, le drapeau `est_diplome` et la décision par défaut.
 */
export function fetchPreview(ancienneAnneeId: string): Promise<PreviewEleve[]> {
  return apiPost<PreviewEleve[]>("/api/annees-scolaires/preview", {
    ancienne_annee_id: ancienneAnneeId,
  });
}

/**
 * Valide le passage de classe : applique les décisions éditées pour chaque
 * élève et inscrit les promus dans la nouvelle année. Transaction atomique
 * par élève (un élève en erreur n'empêche pas les autres d'être traités).
 */
export function submitPromote(
  ancienneAnneeId: string,
  nouvelleAnneeId: string,
  decisions: EleveDecision[],
): Promise<PromoteResult> {
  return apiPost<PromoteResult>("/api/annees-scolaires/promote", {
    ancienne_annee_id: ancienneAnneeId,
    nouvelle_annee_id: nouvelleAnneeId,
    decisions,
  });
}
