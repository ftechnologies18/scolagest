"use client";

/**
 * ScolaGest — Client API pour le pointage enseignant (Phase B).
 *
 * Routes prof (auth ENSEIGNANT) :
 *  - GET /api/prof/sessions?date=YYYY-MM-DD
 *  - POST /api/prof/pointage
 *
 * Routes staff (auth DIRECTION, DIRECTEUR_ETUDES, DIRECTEUR_SUPERVISEUR, SECRETARIAT) :
 *  - GET /api/pointage/ecran?date=YYYY-MM-DD
 *  - POST /api/pointage/:id/valider
 *  - POST /api/pointage/generate-sessions
 */

import { apiGet, apiPost } from "@/lib/api-client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type StatutSession = "PLANIFIEE" | "EN_COURS" | "TERMINEE" | "ANNULEE";
export type StatutPointage =
  | "SYNC_EN_ATTENTE"
  | "VALIDE"
  | "VALIDATION_REQUISE"
  | "FRAUDE_SUSPECTEE"
  | "VALIDE_MANUEL";
export type TypePointage = "ENTREE" | "SORTIE";

export interface SessionCours {
  id: string;
  enseignant_id: string;
  matiere_id: string;
  classe_id: string;
  date_cours: string;
  heure_debut: string;
  heure_fin: string;
  salle: string;
  statut: StatutSession;
  affectation?: {
    matiere?: { id: string; libelle: string; couleur: string };
    classe?: { id: string; libelle: string };
  };
  pointages?: Pointage[];
}

export interface Pointage {
  id: string;
  session_cours_id: string;
  enseignant_id: string;
  type: TypePointage;
  date_heure_client: string;
  date_heure_serveur: string;
  geo_lat: number;
  geo_lng: number;
  geo_precision: number;
  statut: StatutPointage;
  methode: string;
  motif_rejet: string;
}

export interface PointageDTO {
  session_cours_id: string;
  type: TypePointage;
  date_heure_client: string;
  geo_lat: number;
  geo_lng: number;
  geo_precision: number;
  methode: string;
}

export interface PointageResult {
  pointage: Pointage;
  alerte?: string;
}

// Pour l'écran secrétariat
export type StatutAffichage = "VERT" | "JAUNE" | "ROUGE" | "ORANGE";

export interface SessionAvecStatut extends SessionCours {
  statut_affichage: StatutAffichage;
  pointage_entree?: Pointage | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// API — Routes prof
// ─────────────────────────────────────────────────────────────────────────────

export function fetchMesSessions(date?: string): Promise<SessionCours[]> {
  const qs = new URLSearchParams();
  if (date) qs.set("date", date);
  const query = qs.toString();
  return apiGet<SessionCours[]>(`/api/prof/sessions${query ? `?${query}` : ""}`);
}

export function createPointage(dto: PointageDTO): Promise<PointageResult> {
  return apiPost<PointageResult>("/api/prof/pointage", dto);
}

// ─────────────────────────────────────────────────────────────────────────────
// API — Routes staff
// ─────────────────────────────────────────────────────────────────────────────

export function fetchSessionsEcran(date?: string): Promise<SessionAvecStatut[]> {
  const qs = new URLSearchParams();
  if (date) qs.set("date", date);
  const query = qs.toString();
  return apiGet<SessionAvecStatut[]>(`/api/pointage/ecran${query ? `?${query}` : ""}`);
}

export function validePointageManuel(id: string): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>(`/api/pointage/${id}/valider`, {});
}

export function generateSessions(): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>("/api/pointage/generate-sessions", {});
}
