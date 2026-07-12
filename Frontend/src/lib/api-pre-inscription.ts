"use client";

/**
 * ScolaGest — Client API pour le module Pré-inscription (Phase 3, Innovation 3).
 *
 * Deux familles d'endpoints :
 *  - **Routes publiques** (sans auth, page publique `/pre-inscription`) :
 *    POST /api/public/pre-inscriptions (soumission parent)
 *    GET  /api/public/pre-inscriptions/:token (suivi par token)
 *  - **Routes staff** (avec auth, page `/pre-inscriptions`) :
 *    GET  /api/pre-inscriptions?statut=...
 *    GET  /api/pre-inscriptions/:id
 *    POST /api/pre-inscriptions/:id/valider
 *    POST /api/pre-inscriptions/:id/rejeter
 *
 * Les routes publiques passent `skipAuth: true` au client API générique (pas de
 * JWT attaché, pas de refresh automatique).
 *
 * Le backend renvoie un `WorkflowResult` (élève + inscription) sur `valider`,
 * identique au workflow d'inscription direct — on réutilise donc ce type.
 */

import { apiGet, apiPost } from "@/lib/api-client";
import type { Etablissement } from "@/lib/auth-store";
import type { AnneeScolaire, Classe, Eleve, Inscription } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Statut d'une pré-inscription (cycle de vie). */
export type StatutPreInscription =
  | "SOUMISE"
  | "EN_REVUE"
  | "VALIDEE"
  | "REJETEE";

/** Sexe de l'élève (saisi par le parent). */
export type SexeEleve = "M" | "F" | "";

/** Catégorie d'affectation (forcée à NON_APPLICABLE si l'établissement n'applique pas). */
export type CategorieEleve = "AFFECTE" | "NON_AFFECTE" | "NON_APPLICABLE";

/** Lien de parenté du tuteur. */
export type LienParente = "PERE" | "MERE" | "TUTEUR_LEGAL" | "AUTRE" | "";

/**
 * Pré-inscription soumise par un parent en ligne (réponse du backend).
 * Les champs `etablissement?` et `classe?` sont préchargés par le backend
 * sur les routes de détail.
 */
export interface PreInscription {
  id: string;
  etablissement_id: string;
  statut: StatutPreInscription;
  date_soumission: string;
  date_traitement?: string | null;

  // ── Élève ──
  eleve_nom: string;
  eleve_prenoms: string;
  eleve_date_naissance?: string | null;
  eleve_lieu_naissance: string;
  eleve_sexe: SexeEleve;
  eleve_categorie: CategorieEleve;

  // ── Tuteur ──
  tuteur_nom: string;
  tuteur_prenoms: string;
  tuteur_telephone: string;
  tuteur_email: string;
  tuteur_lien_parente: LienParente;

  // ── Classe souhaitée ──
  classe_id?: string | null;

  // ── Méta ──
  notes_parent: string;
  notes_staff: string;
  eleve_cree_id?: string | null;

  // ── Relations préchargées (selon l'endpoint) ──
  etablissement?: Pick<Etablissement, "id" | "nom" | "ville" | "applique_categorie_affecte">;
  classe?: Pick<Classe, "id" | "libelle" | "niveau" | "cycle_id"> & {
    cycle?: { id: string; libelle: string };
  };
}

/** Payload de soumission publique (parent). */
export interface PreInscriptionDTO {
  etablissement_id: string;
  eleve_nom: string;
  eleve_prenoms?: string;
  eleve_date_naissance?: string; // YYYY-MM-DD
  eleve_lieu_naissance?: string;
  eleve_sexe: SexeEleve;
  eleve_categorie: CategorieEleve;
  tuteur_nom: string;
  tuteur_prenoms?: string;
  tuteur_telephone: string;
  tuteur_email?: string;
  tuteur_lien_parente: LienParente;
  classe_id?: string;
  notes_parent?: string;
}

/** Réponse de POST /api/public/pre-inscriptions. */
export interface SubmitResult {
  pre_inscription: PreInscription;
  token_suivi: string;
  suivi_url: string;
}

/** Corps de POST /api/pre-inscriptions/:id/valider. */
export interface ValiderBody {
  classe_id: string;
  annee_scolaire_id: string;
  notes?: string;
}

/** Résultat retourné par `valider` (élève + inscription créés). */
export interface ValiderResult {
  eleve: Eleve;
  inscription: Inscription;
  annee_scolaire?: AnneeScolaire;
}

// ─────────────────────────────────────────────────────────────────────────────
// Clés de cache React Query
// ─────────────────────────────────────────────────────────────────────────────

export const preInscriptionsKeys = {
  all: ["pre-inscriptions"] as const,
  lists: () => [...preInscriptionsKeys.all, "list"] as const,
  list: (statut?: StatutPreInscription) =>
    [...preInscriptionsKeys.lists(), { statut }] as const,
  details: () => [...preInscriptionsKeys.all, "detail"] as const,
  detail: (id: string) => [...preInscriptionsKeys.details(), id] as const,
  public: () => [...preInscriptionsKeys.all, "public"] as const,
  publicByToken: (token: string) =>
    [...preInscriptionsKeys.public(), { token }] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Routes publiques (sans auth)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Soumet une pré-inscription (route PUBLIQUE — pas de JWT).
 * Retourne la pré-inscription créée + le token de suivi + l'URL de suivi.
 */
export function submitPreInscription(
  dto: PreInscriptionDTO,
): Promise<SubmitResult> {
  return apiPost<SubmitResult>("/api/public/pre-inscriptions", dto, {
    skipAuth: true,
  });
}

/**
 * Récupère une pré-inscription par son token de suivi (route PUBLIQUE).
 * Permet au parent de suivre l'état de sa demande sans compte staff.
 */
export function fetchPreInscriptionByToken(
  token: string,
): Promise<PreInscription> {
  return apiGet<PreInscription>(
    `/api/public/pre-inscriptions/${encodeURIComponent(token)}`,
    { skipAuth: true },
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes staff (avec auth)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Liste les pré-inscriptions de l'établissement courant (filtre par statut
 * optionnel). L'établissement est déterminé côté backend via la session.
 */
export function fetchPreInscriptions(
  statut?: StatutPreInscription,
): Promise<PreInscription[]> {
  const qs = new URLSearchParams();
  if (statut) qs.set("statut", statut);
  const query = qs.toString();
  return apiGet<PreInscription[]>(
    `/api/pre-inscriptions${query ? `?${query}` : ""}`,
  );
}

/** Récupère une pré-inscription par son ID (route staff). */
export function fetchPreInscription(id: string): Promise<PreInscription> {
  return apiGet<PreInscription>(`/api/pre-inscriptions/${id}`);
}

/**
 * Valide une pré-inscription : crée un élève + inscription réels via le
 * workflow d'inscription existant. Retourne le résultat du workflow
 * (élève + inscription créés).
 */
export function validerPreInscription(
  id: string,
  body: ValiderBody,
): Promise<ValiderResult> {
  return apiPost<ValiderResult>(`/api/pre-inscriptions/${id}/valider`, body);
}

/** Rejette une pré-inscription avec un motif (route staff). */
export function rejeterPreInscription(
  id: string,
  motif: string,
): Promise<{ success: boolean; date: string }> {
  return apiPost<{ success: boolean; date: string }>(
    `/api/pre-inscriptions/${id}/rejeter`,
    { motif },
  );
}
