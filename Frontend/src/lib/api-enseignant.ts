"use client";

/**
 * ScolaGest — Client API pour le module Enseignant (Phase A).
 *
 * Routes staff (avec auth) :
 *  - Enseignants : CRUD + association matières
 *  - Matières : CRUD
 *  - Affectations : liste + création + suppression (assignation prof/matière/classe)
 */

import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api-client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type StatutEnseignant = "ACTIF" | "INACTIF" | "CONGE";
export type TypeContrat = "CDI" | "CDD" | "VACATAIRE" | "STAGIAIRE";
export type Sexe = "M" | "F" | "";

export interface Enseignant {
  id: string;
  etablissement_id: string;
  utilisateur_id?: string | null;
  matricule: string;
  nom: string;
  prenoms: string;
  date_naissance?: string | null;
  sexe: Sexe;
  photo_url: string;
  telephone: string;
  email: string;
  adresse: string;
  statut: StatutEnseignant;
  type_contrat: TypeContrat;
  date_embauche?: string | null;
  diplome: string;
  specialite: string;
  cv_url: string;
  taux_horaire_defaut: number;
  matieres?: EnseignantMatiere[];
  affectations?: AffectationCours[];
}

export interface EnseignantDTO {
  nom: string;
  prenoms?: string;
  date_naissance?: string | null;
  sexe?: Sexe;
  photo_url?: string;
  telephone?: string;
  email?: string;
  adresse?: string;
  statut?: StatutEnseignant;
  type_contrat?: TypeContrat;
  date_embauche?: string | null;
  diplome?: string;
  specialite?: string;
  cv_url?: string;
  taux_horaire_defaut?: number;
}

export interface Matiere {
  id: string;
  etablissement_id: string;
  code: string;
  libelle: string;
  coefficient: number;
  cycle_id?: string | null;
  cycle?: { id: string; libelle: string } | null;
  couleur: string;
  actif: boolean;
}

export interface MatiereDTO {
  code: string;
  libelle: string;
  coefficient?: number;
  cycle_id?: string | null;
  couleur?: string;
  actif?: boolean;
}

export interface EnseignantMatiere {
  id: string;
  enseignant_id: string;
  matiere_id: string;
  matiere?: Matiere;
  taux_horaire: number;
  est_principale: boolean;
}

export interface EnseignantMatiereDTO {
  matiere_id: string;
  taux_horaire: number;
  est_principale?: boolean;
}

export interface AffectationCours {
  id: string;
  enseignant_id: string;
  enseignant?: Enseignant;
  matiere_id: string;
  matiere?: Matiere;
  classe_id: string;
  classe?: { id: string; libelle: string; niveau: number };
  etablissement_id: string;
  annee_scolaire_id: string;
  annee_scolaire?: { id: string; libelle: string };
  volume_horaire_hebdo: number;
  est_titulaire: boolean;
  actif: boolean;
}

export interface AffectationDTO {
  enseignant_id: string;
  matiere_id: string;
  classe_id: string;
  annee_scolaire_id: string;
  volume_horaire_hebdo: number;
  est_titulaire?: boolean;
}

export interface AffectationResult {
  affectation: AffectationCours;
  charge_totale_hebdo: number;
  alerte_surcharge: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// API — Enseignants
// ─────────────────────────────────────────────────────────────────────────────

export function fetchEnseignants(params?: {
  search?: string;
  statut?: StatutEnseignant;
}): Promise<Enseignant[]> {
  const qs = new URLSearchParams();
  if (params?.search) qs.set("search", params.search);
  if (params?.statut) qs.set("statut", params.statut);
  const query = qs.toString();
  return apiGet<Enseignant[]>(`/api/enseignants${query ? `?${query}` : ""}`);
}

export function fetchEnseignant(id: string): Promise<Enseignant> {
  return apiGet<Enseignant>(`/api/enseignants/${id}`);
}

export function createEnseignant(dto: EnseignantDTO): Promise<Enseignant> {
  return apiPost<Enseignant>("/api/enseignants", dto);
}

export function updateEnseignant(
  id: string,
  dto: Partial<EnseignantDTO>,
): Promise<Enseignant> {
  return apiPut<Enseignant>(`/api/enseignants/${id}`, dto);
}

export async function deleteEnseignant(id: string): Promise<boolean> {
  await apiDelete<{ success: boolean }>(`/api/enseignants/${id}`);
  return true;
}

export function addMatiereToEnseignant(
  enseignantId: string,
  dto: EnseignantMatiereDTO,
): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>(
    `/api/enseignants/${enseignantId}/matieres`,
    dto,
  );
}

export async function removeMatiereFromEnseignant(
  enseignantId: string,
  matiereId: string,
): Promise<boolean> {
  await apiDelete<{ success: boolean }>(
    `/api/enseignants/${enseignantId}/matieres/${matiereId}`,
  );
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// API — Matières
// ─────────────────────────────────────────────────────────────────────────────

export function fetchMatieres(): Promise<Matiere[]> {
  return apiGet<Matiere[]>("/api/matieres");
}

export function createMatiere(dto: MatiereDTO): Promise<Matiere> {
  return apiPost<Matiere>("/api/matieres", dto);
}

export function updateMatiere(
  id: string,
  dto: Partial<MatiereDTO>,
): Promise<Matiere> {
  return apiPut<Matiere>(`/api/matieres/${id}`, dto);
}

export async function deleteMatiere(id: string): Promise<boolean> {
  await apiDelete<{ success: boolean }>(`/api/matieres/${id}`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// API — Affectations
// ─────────────────────────────────────────────────────────────────────────────

export function fetchAffectations(anneeScolaireId?: string): Promise<AffectationCours[]> {
  const qs = new URLSearchParams();
  if (anneeScolaireId) qs.set("annee_scolaire_id", anneeScolaireId);
  const query = qs.toString();
  return apiGet<AffectationCours[]>(`/api/affectations${query ? `?${query}` : ""}`);
}

export function createAffectation(dto: AffectationDTO): Promise<AffectationResult> {
  return apiPost<AffectationResult>("/api/affectations", dto);
}

export async function deleteAffectation(id: string): Promise<boolean> {
  await apiDelete<{ success: boolean }>(`/api/affectations/${id}`);
  return true;
}
