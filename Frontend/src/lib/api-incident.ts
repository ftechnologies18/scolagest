"use client";

/**
 * ScolaGest — Client API pour les tickets d'incident disciplinaire (Phase B).
 *
 * Routes prof (auth ENSEIGNANT) :
 *  - POST /api/prof/incidents (signalement)
 *
 * Routes staff (auth DIRECTION, DIRECTEUR_ETUDES, DIRECTEUR_SUPERVISEUR, SECRETARIAT) :
 *  - GET /api/incidents?statut=...&eleve_id=...
 *  - GET /api/incidents/:id
 *  - PUT /api/incidents/:id/traiter
 *  - GET /api/discipline/eleves-risque?periode=30
 *  - GET /api/eleves/:id/incidents
 */

import { apiGet, apiPost, apiPut } from "@/lib/api-client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CategorieIncident =
  | "ABSENTEISME"
  | "IMPOLITESSE"
  | "COMPORTEMENT"
  | "TRAVAIL"
  | "RETARD";

export type GraviteIncident = "MINEUR" | "MODERE" | "SEVERE" | "CRITIQUE";

export type StatutTicket =
  | "OUVERT"
  | "EN_COURS"
  | "TRAITE"
  | "CLOTURE"
  | "REJETE";

export interface TicketIncident {
  id: string;
  etablissement_id: string;
  eleve_id: string;
  eleve?: { id: string; nom: string; prenoms: string; identifiant_interne: string };
  enseignant_id: string;
  enseignant?: { id: string; nom: string; prenoms: string; matricule: string } | null;
  classe_id?: string | null;
  classe?: { id: string; libelle: string } | null;
  matiere_id?: string | null;
  matiere?: { id: string; libelle: string } | null;
  categorie: CategorieIncident;
  gravite: GraviteIncident;
  description: string;
  date_incident: string;
  anonyme: boolean;
  photo_url: string;
  statut: StatutTicket;
  action_prise: string;
  traite_par?: string | null;
  date_traitement?: string | null;
  created_at: string;
}

export interface TicketDTO {
  eleve_id: string;
  classe_id?: string | null;
  matiere_id?: string | null;
  categorie: CategorieIncident;
  gravite: GraviteIncident;
  description: string;
  date_incident?: string;
  anonyme?: boolean;
  photo_url?: string;
}

export interface TraiterBody {
  statut: StatutTicket;
  action_prise: string;
}

export interface EleveRisque {
  eleve_id: string;
  eleve_nom: string;
  eleve_prenoms: string;
  classe_libelle: string;
  nb_tickets: number;
  nb_profs_differents: number;
  nb_critiques: number;
  dernier_ticket?: string | null;
  a_convoquer: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Labels
// ─────────────────────────────────────────────────────────────────────────────

export const CATEGORIE_LABEL: Record<CategorieIncident, string> = {
  ABSENTEISME: "Absentéisme",
  IMPOLITESSE: "Impolitesse",
  COMPORTEMENT: "Comportement",
  TRAVAIL: "Travail non fait",
  RETARD: "Retard",
};

export const GRAVITE_LABEL: Record<GraviteIncident, string> = {
  MINEUR: "Mineur",
  MODERE: "Modéré",
  SEVERE: "Sévère",
  CRITIQUE: "Critique",
};

export const STATUT_TICKET_LABEL: Record<StatutTicket, string> = {
  OUVERT: "Ouvert",
  EN_COURS: "En cours",
  TRAITE: "Traité",
  CLOTURE: "Clôturé",
  REJETE: "Rejeté",
};

// ─────────────────────────────────────────────────────────────────────────────
// API — Routes prof
// ─────────────────────────────────────────────────────────────────────────────

export function createIncident(dto: TicketDTO): Promise<TicketIncident> {
  return apiPost<TicketIncident>("/api/prof/incidents", dto);
}

// ─────────────────────────────────────────────────────────────────────────────
// API — Routes staff
// ─────────────────────────────────────────────────────────────────────────────

export function fetchIncidents(params?: {
  statut?: StatutTicket;
  eleve_id?: string;
}): Promise<TicketIncident[]> {
  const qs = new URLSearchParams();
  if (params?.statut) qs.set("statut", params.statut);
  if (params?.eleve_id) qs.set("eleve_id", params.eleve_id);
  const query = qs.toString();
  return apiGet<TicketIncident[]>(`/api/incidents${query ? `?${query}` : ""}`);
}

export function fetchIncident(id: string): Promise<TicketIncident> {
  return apiGet<TicketIncident>(`/api/incidents/${id}`);
}

export function traiterIncident(
  id: string,
  body: TraiterBody,
): Promise<TicketIncident> {
  return apiPut<TicketIncident>(`/api/incidents/${id}/traiter`, body);
}

export function fetchElevesRisque(periode?: number): Promise<EleveRisque[]> {
  const qs = new URLSearchParams();
  if (periode) qs.set("periode", String(periode));
  const query = qs.toString();
  return apiGet<EleveRisque[]>(`/api/discipline/eleves-risque${query ? `?${query}` : ""}`);
}

export function fetchIncidentsEleve(eleveId: string): Promise<TicketIncident[]> {
  return apiGet<TicketIncident[]>(`/api/eleves/${eleveId}/incidents`);
}
