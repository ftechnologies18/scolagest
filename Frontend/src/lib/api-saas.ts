"use client";

/**
 * ScolaGest — API client SaaS (super-admin).
 *
 * Wrappers pour les endpoints réservés au `SUPER_ADMIN` (propriétaire de la
 * plateforme SaaS) :
 *  - `GET  /api/saas/stats`            : agrégats globaux (nb établissements,
 *    nb élèves total, nb utilisateurs, nb paiements, montant total encaissé,
 *    statut du mode support).
 *  - `GET  /api/saas/establishments`   : liste de tous les établissements
 *    (tous tenants) avec leurs compteurs.
 *  - `GET  /api/saas/audit`            : journal d'audit global (cross-tenant).
 *  - `POST /api/saas/support/activate` : active le mode support pour un
 *    établissement (permet au SUPER_ADMIN de consulter ses données).
 *  - `POST /api/saas/support/deactivate`: désactive le mode support.
 *
 * Toutes les fonctions s'appuient sur le client API générique
 * (`@/lib/api-client`) qui attache automatiquement le JWT staff et le
 * paramètre `?XTransformPort=8080`.
 */

import { apiGet, apiPost } from "@/lib/api-client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Statut du mode support (visible par le SUPER_ADMIN). */
export interface SaasSupportStatus {
  actif: boolean;
  /** Identifiant de l'établissement en support (null si inactif). */
  etablissement_id?: string | null;
  etablissement_nom?: string | null;
  /** Date ISO d'expiration du mode support. */
  expire_at?: string | null;
}

/** Agrégats globaux renvoyés par `GET /api/saas/stats`. */
export interface SaasStats {
  nb_etablissements: number;
  nb_etablissements_actifs: number;
  nb_eleves_total: number;
  nb_utilisateurs_total: number;
  nb_paiements_total: number;
  montant_total_encaisse: number;
  support: SaasSupportStatus;
}

/** Établissement vu côté SaaS (avec compteurs agrégés). */
export interface SaasEstablishment {
  id: string;
  nom: string;
  code_officiel?: string;
  ville?: string;
  nb_eleves: number;
  nb_utilisateurs: number;
  actif: boolean;
  /** Date ISO de création. */
  created_at?: string;
}

/** Paramètres de filtrage du journal d'audit global. */
export interface SaasAuditQueryParams {
  entite?: string;
  utilisateur_id?: string;
  etablissement_id?: string;
  date_debut?: string;
  date_fin?: string;
  page?: number;
  page_size?: number;
}

/** Entrée du journal d'audit global. */
export interface SaasAuditEntry {
  id: string;
  /** Date ISO. */
  date_action: string;
  utilisateur_id?: string | null;
  utilisateur_nom?: string | null;
  action: string;
  entite: string;
  entite_id?: string | null;
  description?: string;
  etablissement_id?: string | null;
  etablissement_nom?: string | null;
  adresse_ip?: string;
}

/** Réponse paginée du journal d'audit global. */
export interface SaasAuditResponse {
  data: SaasAuditEntry[];
  total: number;
  page: number;
  page_size: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Clés de cache React Query
// ─────────────────────────────────────────────────────────────────────────────

export const saasKeys = {
  all: ["saas"] as const,
  stats: () => [...saasKeys.all, "stats"] as const,
  establishments: () => [...saasKeys.all, "establishments"] as const,
  audit: (params: SaasAuditQueryParams) =>
    [...saasKeys.all, "audit", params] as const,
  support: () => [...saasKeys.all, "support"] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────────

function buildAuditQuery(params: SaasAuditQueryParams = {}): string {
  const qs = new URLSearchParams();
  if (params.entite) qs.set("entite", params.entite);
  if (params.utilisateur_id) qs.set("utilisateur_id", params.utilisateur_id);
  if (params.etablissement_id)
    qs.set("etablissement_id", params.etablissement_id);
  if (params.date_debut) qs.set("date_debut", params.date_debut);
  if (params.date_fin) qs.set("date_fin", params.date_fin);
  qs.set("page", String(params.page ?? 1));
  qs.set("page_size", String(params.page_size ?? 20));
  return qs.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/** Récupère les statistiques globales de la plateforme SaaS. */
export function fetchSaasStats(): Promise<SaasStats> {
  return apiGet<SaasStats>("/api/saas/stats");
}

/** Liste tous les établissements (tous tenants) avec compteurs agrégés. */
export function fetchSaasEstablishments(): Promise<SaasEstablishment[]> {
  return apiGet<SaasEstablishment[]>("/api/saas/establishments");
}

/** Récupère le journal d'audit global (cross-tenant). */
export function fetchSaasAudit(
  params: SaasAuditQueryParams = {},
): Promise<SaasAuditResponse> {
  return apiGet<SaasAuditResponse>(
    `/api/saas/audit?${buildAuditQuery(params)}`,
  );
}

/**
 * Active le mode support pour un établissement.
 *
 * Le SUPER_ADMIN peut alors consulter les données de l'établissement ciblé
 * (élèves, paiements, caisse…) pendant une durée limitée. Tous les accès
 * sont tracés dans le journal d'audit.
 */
export function activateSupport(
  etablissementId: string,
): Promise<SaasSupportStatus> {
  return apiPost<SaasSupportStatus>("/api/saas/support/activate", {
    etablissement_id: etablissementId,
  });
}

/** Désactive le mode support précédemment activé. */
export function deactivateSupport(): Promise<SaasSupportStatus> {
  return apiPost<SaasSupportStatus>("/api/saas/support/deactivate", {});
}
