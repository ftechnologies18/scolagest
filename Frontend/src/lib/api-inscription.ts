"use client";

/**
 * ScolaGest — Client API pour le module Inscription (Phase 2).
 *
 * Trois endpoints :
 *  - POST /api/inscriptions/workflow : création atomique élève+tuteur+inscription
 *  - GET  /api/eleves/check-doublon  : détection de doublon (temps réel)
 *  - GET  /api/eleves/next-identifiant : aperçu du prochain identifiant interne
 */

import { apiGet, apiPost } from "@/lib/api-client";
import type { Eleve, Inscription, Tuteur } from "@/lib/types";
import type { StatutAnneePrecedente } from "@/lib/api-pre-inscription";

// ─────────────────────────────────────────────────────────────────────────────
// Types du workflow
// ─────────────────────────────────────────────────────────────────────────────

export type LienParente = "PERE" | "MERE" | "TUTEUR_LEGAL" | "AUTRE";
export type SexeEleve = "M" | "F" | "";
export type CategorieEleve = "AFFECTE" | "NON_AFFECTE" | "NON_APPLICABLE";
export type StatutInscription = "PRE_INSCRIT" | "INSCRIT" | "REINSCRIT" | "TRANSFERE" | "ABANDON";

/** Tuteur du workflow : existant (tuteur_id) ou nouveau (champs). */
export interface WorkflowTuteur {
  tuteur_id?: string | null;
  // Champs nouveau tuteur (ignorés si tuteur_id est défini)
  nom?: string;
  prenoms?: string;
  telephone?: string;
  telephone2?: string;
  email?: string;
  adresse?: string;
  lien_parente?: LienParente;
  profession?: string;
}

export interface WorkflowEleve {
  nom: string;
  prenoms?: string;
  date_naissance?: string | null; // YYYY-MM-DD (parsé côté backend, pas RFC3339)
  lieu_naissance?: string;
  sexe?: SexeEleve;
  categorie: CategorieEleve;
  matricule_ministere?: string | null;
  // Champs complémentaires (alignement wizard public — réforme 2026-07)
  nationalite?: string;
  ancien_etablissement?: string;
  statut_annee_precedente?: StatutAnneePrecedente;
  allergies?: string;
  notes_sante?: string;
}

export interface WorkflowInscription {
  classe_id: string;
  annee_scolaire_id: string;
  statut?: StatutInscription;
  derogation_inscription?: boolean;
  motif_derogation?: string;
  notes?: string;
}

export interface WorkflowDTO {
  eleve: WorkflowEleve;
  tuteur: WorkflowTuteur;
  inscription: WorkflowInscription;
}

export interface WorkflowResult {
  eleve: Eleve;
  inscription: Inscription;
}

export interface DoublonResult {
  doublons: Eleve[];
}

export interface NextIdentifiantResult {
  identifiant: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

/** Soumet le workflow d'inscription complet (transaction atomique). */
export function submitInscriptionWorkflow(
  dto: WorkflowDTO,
): Promise<WorkflowResult> {
  return apiPost<WorkflowResult>("/api/inscriptions/workflow", dto);
}

/**
 * Vérifie si un élève similaire existe déjà (détection de doublon temps réel).
 * Recherche par nom + date_naissance, ou par matricule ministériel.
 */
export function checkDoublon(params: {
  nom?: string;
  prenoms?: string;
  date_naissance?: string;
  matricule?: string;
}): Promise<DoublonResult> {
  const qs = new URLSearchParams();
  if (params.nom) qs.set("nom", params.nom);
  if (params.prenoms) qs.set("prenoms", params.prenoms);
  if (params.date_naissance) qs.set("date_naissance", params.date_naissance);
  if (params.matricule) qs.set("matricule", params.matricule);
  return apiGet<DoublonResult>(`/api/eleves/check-doublon?${qs.toString()}`);
}

/** Aperçu du prochain identifiant interne généré (ex: COL-2026-0007). */
export function fetchNextIdentifiant(): Promise<NextIdentifiantResult> {
  return apiGet<NextIdentifiantResult>("/api/eleves/next-identifiant");
}

/** Recherche un tuteur existant par téléphone (pour fratrie). */
export function searchTuteurByPhone(
  telephone: string,
): Promise<Tuteur[]> {
  const qs = new URLSearchParams();
  qs.set("search", telephone);
  return apiGet<Tuteur[]>(`/api/tuteurs?${qs.toString()}`);
}
