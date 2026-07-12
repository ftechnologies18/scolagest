"use client";

/**
 * ScolaGest — Client API pour l'emploi du temps (Phase A étendue).
 */

import { apiGet, apiPost, apiDelete } from "@/lib/api-client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type JourSemaine = "LUNDI" | "MARDI" | "MERCREDI" | "JEUDI" | "VENDREDI" | "SAMEDI";
export type SemaineType = "TOUTES" | "PAIRE" | "IMPAIRE";

export interface CreneauEmploiTemps {
  id: string;
  etablissement_id: string;
  affectation_cours_id: string;
  enseignant_id: string;
  matiere_id: string;
  classe_id: string;
  jour_semaine: JourSemaine;
  heure_debut: string;
  heure_fin: string;
  salle: string;
  semaine_type: SemaineType;
  actif: boolean;
  affectation?: {
    enseignant?: { id: string; nom: string; prenoms: string; matricule: string };
    matiere?: { id: string; libelle: string; couleur: string };
    classe?: { id: string; libelle: string };
  };
}

export interface CreneauDTO {
  affectation_cours_id: string;
  jour_semaine: JourSemaine;
  heure_debut: string;
  heure_fin: string;
  salle?: string;
  semaine_type?: SemaineType;
}

export interface ConflitInfo {
  type: string;
  message: string;
  creneau_id_existant: string;
  description: string;
}

export interface ConflitResult {
  creneau: CreneauEmploiTemps;
  conflits: ConflitInfo[];
}

export interface CalendrierJour {
  jour: JourSemaine;
  label: string;
  creneaux: CreneauEmploiTemps[];
}

export interface CalendrierSemaine {
  jours: CalendrierJour[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Labels
// ─────────────────────────────────────────────────────────────────────────────

export const JOUR_LABELS: Record<JourSemaine, string> = {
  LUNDI: "Lundi",
  MARDI: "Mardi",
  MERCREDI: "Mercredi",
  JEUDI: "Jeudi",
  VENDREDI: "Vendredi",
  SAMEDI: "Samedi",
};

export const JOURS: JourSemaine[] = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"];

export const SEMAINE_TYPE_LABELS: Record<SemaineType, string> = {
  TOUTES: "Toutes les semaines",
  PAIRE: "Semaines paires",
  IMPAIRE: "Semaines impaires",
};

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

export function fetchCreneaux(params?: {
  classe_id?: string;
  enseignant_id?: string;
}): Promise<CreneauEmploiTemps[]> {
  const qs = new URLSearchParams();
  if (params?.classe_id) qs.set("classe_id", params.classe_id);
  if (params?.enseignant_id) qs.set("enseignant_id", params.enseignant_id);
  const query = qs.toString();
  return apiGet<CreneauEmploiTemps[]>(`/api/emploi-temps${query ? `?${query}` : ""}`);
}

export function fetchCalendrier(classeId?: string): Promise<CalendrierSemaine> {
  const qs = new URLSearchParams();
  if (classeId) qs.set("classe_id", classeId);
  const query = qs.toString();
  return apiGet<CalendrierSemaine>(`/api/emploi-temps/calendrier${query ? `?${query}` : ""}`);
}

export function createCreneau(dto: CreneauDTO): Promise<ConflitResult> {
  return apiPost<ConflitResult>("/api/emploi-temps", dto);
}

export async function deleteCreneau(id: string): Promise<boolean> {
  await apiDelete<{ success: boolean }>(`/api/emploi-temps/${id}`);
  return true;
}

export function generateSessionsFromDate(date: string): Promise<{
  success: boolean;
  sessions_generees: number;
  date: string;
}> {
  return apiPost("/api/emploi-temps/generate-sessions", { date });
}

export function generateSemaine(): Promise<{
  success: boolean;
  sessions_generees: number;
  semaine_du: string;
}> {
  return apiPost("/api/emploi-temps/generate-semaine", {});
}
