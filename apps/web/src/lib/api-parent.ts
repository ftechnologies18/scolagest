"use client";

/**
 * ScolaGest — API client Phase 6 : Portail parents.
 *
 * Couvre les endpoints `/api/parent/*` exposés par le backend Go pour le
 * compte parent :
 *   - GET /api/parent/enfants                       → liste des enfants du tuteur
 *   - GET /api/parent/enfants/:id/solde             → solde détaillé d'un enfant
 *   - GET /api/parent/paiements?eleve_id=&limit=    → historique des paiements
 *   - GET /api/parent/paiements/:id/recu            → reçu (snapshot JSON)
 *   - GET /api/parent/echeances                     → 10 prochaines échéances
 *
 * Toutes les fonctions s'appuient sur le client API générique (`@/lib/api-client`)
 * qui attache automatiquement le JWT et le paramètre `?XTransformPort=8080`.
 *
 * Les clés de cache React Query sont centralisées dans `parentKeys` pour
 * faciliter l'invalidation croisée entre composants.
 */

import { apiGet } from "@/lib/api-client";

// ─────────────────────────────────────────────────────────────────────────────
// Types de réponse (contractés avec le backend Go)
// ─────────────────────────────────────────────────────────────────────────────

export interface EnfantEtablissementParent {
  id: string;
  nom: string;
  ville: string;
}

export interface SoldeSyntheseParent {
  total_attendu: number;
  total_paye: number;
  solde_du: number;
}

export interface EnfantParent {
  id: string;
  nom: string;
  prenoms: string;
  matricule_ministere: string | null;
  identifiant_interne: string;
  date_naissance: string | null;
  sexe: string;
  photo_url: string;
  categorie: string;
  etablissement: EnfantEtablissementParent;
  /** Libellé de la classe de l'inscription active (null si non inscrit). */
  classe_actuelle: string | null;
  solde: SoldeSyntheseParent;
}

export interface FraisAttenduParent {
  frais_id: string;
  type_frais: string;
  libelle: string;
  montant_attendu: number;
  montant_paye: number;
  solde: number;
}

export interface EcheanceAVenirParent {
  echeance_id: string;
  rang: number;
  libelle: string;
  montant: number;
  date_limite: string;
  montant_paye: number;
  statut: string;
}

export interface SoldeDetailParent {
  eleve_id: string;
  frais_attendus: FraisAttenduParent[];
  total_attendu: number;
  total_paye: number;
  solde_du: number;
  echeances_a_venir: EcheanceAVenirParent[];
}

export interface PaiementParent {
  id: string;
  eleve_id: string;
  eleve_nom: string;
  eleve_prenoms: string;
  classe: string;
  montant: number;
  mode_paiement: string;
  date_paiement: string;
  numero_recu: string;
  statut: string;
  frais_libelle: string | null;
}

export interface RecuParent {
  id: string;
  paiement_id: string;
  numero: string;
  contenu_snapshot: string;
  date_emission: string;
}

export type StatutEcheanceParent = "A_VENIR" | "EN_RETARD" | "PARTIEL";

export interface EcheanceParent {
  echeance_id: string;
  eleve_id: string;
  eleve_nom: string;
  classe: string;
  libelle: string;
  montant: number;
  date_limite: string;
  montant_paye: number;
  statut: StatutEcheanceParent;
  /** Négatif si l'échéance est dépassée. */
  jours_avant: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Clés de cache React Query
// ─────────────────────────────────────────────────────────────────────────────

export const parentKeys = {
  all: ["parent"] as const,
  enfants: () => [...parentKeys.all, "enfants"] as const,
  solde: (enfantId: string) =>
    [...parentKeys.all, "solde", enfantId] as const,
  paiements: (filters: { eleveId?: string; limit?: number }) =>
    [...parentKeys.all, "paiements", filters] as const,
  echeances: () => [...parentKeys.all, "echeances"] as const,
  recu: (paiementId: string) =>
    [...parentKeys.all, "recu", paiementId] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Wrappers API
// ─────────────────────────────────────────────────────────────────────────────

/** Récupère la liste des enfants du parent connecté. */
export function fetchEnfants(): Promise<EnfantParent[]> {
  return apiGet<EnfantParent[]>("/api/parent/enfants");
}

/** Récupère le solde détaillé (frais attendus + échéances) d'un enfant. */
export function fetchSoldeEnfant(enfantId: string): Promise<SoldeDetailParent> {
  return apiGet<SoldeDetailParent>(
    `/api/parent/enfants/${encodeURIComponent(enfantId)}/solde`,
  );
}

/**
 * Récupère l'historique des paiements.
 * @param eleveId Optionnel : filtre par enfant. Si omis, tous les enfants.
 */
export function fetchPaiementsParent(
  eleveId?: string,
  limit = 50,
): Promise<PaiementParent[]> {
  const qs = new URLSearchParams();
  if (eleveId) qs.set("eleve_id", eleveId);
  qs.set("limit", String(limit));
  return apiGet<PaiementParent[]>(
    `/api/parent/paiements?${qs.toString()}`,
  );
}

/** Récupère les 10 prochaines échéances (tous enfants confondus). */
export function fetchEcheancesParent(): Promise<EcheanceParent[]> {
  return apiGet<EcheanceParent[]>("/api/parent/echeances");
}

/** Récupère le reçu d'un paiement (snapshot JSON). */
export function fetchRecuParent(paiementId: string): Promise<RecuParent> {
  return apiGet<RecuParent>(
    `/api/parent/paiements/${encodeURIComponent(paiementId)}/recu`,
  );
}
