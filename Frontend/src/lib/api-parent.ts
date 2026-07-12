"use client";

/**
 * ScolaGest — API client Phase 6 : Portail parents.
 *
 * Couvre les endpoints `/api/parent/*` exposés par le backend Go pour le
 * compte parent :
 *   - GET  /api/parent/enfants                       → liste des enfants du tuteur
 *   - GET  /api/parent/enfants/:id/solde             → solde détaillé d'un enfant
 *   - GET  /api/parent/paiements?eleve_id=&limit=    → historique des paiements
 *   - GET  /api/parent/paiements/:id/recu            → reçu (snapshot JSON)
 *   - GET  /api/parent/echeances                     → 10 prochaines échéances
 *   - POST /api/parent/payer/mobile-money            → initier un paiement MoMo
 *   - GET  /api/parent/recap-caisse?eleve_id=        → récap « payer à l'école »
 *
 * Toutes les fonctions s'appuient sur `parentApiGet` / `parentApiPost`
 * (`@/lib/api-client`) qui attachent automatiquement le **token parent**
 * (`parentAccessToken`) et le paramètre `?XTransformPort=8080`. En cas de 401,
 * le client déclenche `logoutParent()` (le token parent n'est pas
 * rafraîchissable).
 *
 * Les clés de cache React Query sont centralisées dans `parentKeys` pour
 * faciliter l'invalidation croisée entre composants.
 */

import { parentApiGet, parentApiPost } from "@/lib/api-client";
import type { ProviderMomo } from "@/lib/types";

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
  /** Libellé de la classe de l'inscription active (null si non inscrit ou PRE_INSCRIT). */
  classe_actuelle: string | null;
  /** Statut de l'inscription courante. Si PRE_INSCRIT, la classe n'est pas
   * communiquée au parent (règle métier : révélée après paiement frais). */
  inscription_statut: string;
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
  recapCaisse: (enfantId: string) =>
    [...parentKeys.all, "recap-caisse", enfantId] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Wrappers API
// ─────────────────────────────────────────────────────────────────────────────

/** Récupère la liste des enfants du parent connecté. */
export function fetchEnfants(): Promise<EnfantParent[]> {
  return parentApiGet<EnfantParent[]>("/api/parent/enfants");
}

/** Récupère le solde détaillé (frais attendus + échéances) d'un enfant. */
export function fetchSoldeEnfant(enfantId: string): Promise<SoldeDetailParent> {
  return parentApiGet<SoldeDetailParent>(
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
  return parentApiGet<PaiementParent[]>(
    `/api/parent/paiements?${qs.toString()}`,
  );
}

/** Récupère les 10 prochaines échéances (tous enfants confondus). */
export function fetchEcheancesParent(): Promise<EcheanceParent[]> {
  return parentApiGet<EcheanceParent[]>("/api/parent/echeances");
}

/** Récupère le reçu d'un paiement (snapshot JSON). */
export function fetchRecuParent(paiementId: string): Promise<RecuParent> {
  return parentApiGet<RecuParent>(
    `/api/parent/paiements/${encodeURIComponent(paiementId)}/recu`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Paiement Mobile Money & récap caisse — Phase 6 redesign
// ─────────────────────────────────────────────────────────────────────────────

/** Corps de la requête POST /api/parent/payer/mobile-money. */
export interface ParentPayerMobileMoneyDTO {
  eleve_id: string;
  frais_id?: string | null;
  montant: number;
  provider: ProviderMomo;
  telephone_client: string;
}

/** Réponse de POST /api/parent/payer/mobile-money. */
export interface ParentPaiementMomoResponse {
  /** Identifiant de la transaction ou du paiement créé côté backend. */
  id: string;
  /** Référence externe (SMS/USSD) renvoyée par le provider. */
  reference_externe?: string;
  /** Statut initial de la transaction (généralement `INITIEE`). */
  statut?: string;
  montant: number;
  provider: ProviderMomo;
  message?: string;
}

/** Initie un paiement Mobile Money depuis le portail parent. */
export function payerMobileMoneyParent(
  dto: ParentPayerMobileMoneyDTO,
): Promise<ParentPaiementMomoResponse> {
  return parentApiPost<ParentPaiementMomoResponse>(
    "/api/parent/payer/mobile-money",
    dto,
  );
}

/** Informations sur l'établissement renvoyées par /api/parent/recap-caisse. */
export interface RecapCaisseEtablissement {
  id?: string;
  nom: string;
  ville?: string;
  code_officiel?: string;
  telephone?: string;
  adresse?: string;
}

/** Informations sur l'élève renvoyées par /api/parent/recap-caisse. */
export interface RecapCaisseEleve {
  id: string;
  nom: string;
  prenoms: string;
  matricule?: string | null;
  classe?: string | null;
}

/** Résumé financier renvoyé par /api/parent/recap-caisse. */
export interface RecapCaisseFinances {
  total_attendu: number;
  total_paye: number;
  solde_du: number;
}

/** Réponse de GET /api/parent/recap-caisse?eleve_id=. */
export interface RecapCaisseParent {
  etablissement: RecapCaisseEtablissement;
  eleve: RecapCaisseEleve;
  tuteur?: {
    nom?: string;
    prenoms?: string;
    telephone?: string;
  };
  finances: RecapCaisseFinances;
  /** Date/heure d'émission du récapitulatif (ISO). */
  date_emission?: string;
  /** Référence interne du récapitulatif (peut être vide). */
  reference?: string;
}

/** Récupère le récapitulatif « payer à l'école » d'un enfant. */
export function fetchRecapCaisseParent(
  enfantId: string,
): Promise<RecapCaisseParent> {
  const qs = new URLSearchParams({ eleve_id: enfantId });
  return parentApiGet<RecapCaisseParent>(
    `/api/parent/recap-caisse?${qs.toString()}`,
  );
}
