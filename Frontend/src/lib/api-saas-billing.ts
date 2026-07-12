"use client";

/**
 * ScolaGest — Client API Facturation SaaS (SUPER_ADMIN).
 *
 * Wrappers pour les endpoints de facturation réservés au `SUPER_ADMIN` :
 *  - Plans : `GET / POST / PUT /api/saas/billing/plans`
 *  - Abonnements : `GET / POST /api/saas/billing/subscriptions`,
 *    `POST /api/saas/billing/subscriptions/:id/cancel`
 *  - Factures : `GET / POST /api/saas/billing/invoices`,
 *    `POST /api/saas/billing/invoices/:id/pay`
 *  - Stats : `GET /api/saas/billing/stats`
 *
 * Toutes les fonctions s'appuient sur le client API générique
 * (`@/lib/api-client`) qui attache automatiquement le JWT staff et le
 * paramètre `?XTransformPort=8080`.
 */

import { apiGet, apiPost, apiPut } from "@/lib/api-client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Plan tarifaire SaaS (Basic / Pro / Enterprise). */
export interface SaaPlan {
  id: string;
  /** Code court : BASIC, PRO, ENTERPRISE. */
  code: string;
  /** Nom affiché : « Basique », « Professionnel », « Entreprise ». */
  nom: string;
  description: string;
  /** Prix mensuel en FCFA. */
  prix_mensuel: number;
  /** Prix annuel en FCFA. */
  prix_annuel: number;
  /** Nombre maximum d'élèves (0 = illimité). */
  nb_eleves_max: number;
  /** Nombre maximum d'utilisateurs (0 = illimité). */
  nb_users_max: number;
  actif: boolean;
}

/** Corps de requête pour créer / mettre à jour un plan. */
export interface PlanDTO {
  code: string;
  nom: string;
  description: string;
  prix_mensuel: number;
  prix_annuel: number;
  nb_eleves_max: number;
  nb_users_max: number;
  actif: boolean;
}

/** Statut d'un abonnement. */
export type SubscriptionStatut =
  | "ACTIVE"
  | "TRIALING"
  | "PAST_DUE"
  | "CANCELLED"
  | "SUSPENDED";

/** Cycle de facturation. */
export type CycleFacturation = "MONTHLY" | "YEARLY";

/** Abonnement d'un établissement à un plan. */
export interface SaaSubscription {
  id: string;
  etablissement_id: string;
  etablissement?: { id: string; nom: string };
  plan_id: string;
  plan?: SaaPlan;
  statut: SubscriptionStatut;
  cycle_facturation: CycleFacturation;
  /** Date ISO de début. */
  date_debut: string;
  /** Date ISO de fin d'essai (null si pas d'essai). */
  date_fin_essai?: string | null;
  /** Date ISO de la prochaine facture. */
  prochaine_facture: string;
  auto_renouvellement: boolean;
}

/** Corps de requête pour créer un abonnement. */
export interface SubscriptionDTO {
  etablissement_id: string;
  plan_id: string;
  cycle_facturation: CycleFacturation;
  duree_essai_jours: number;
}

/** Statut d'une facture. */
export type InvoiceStatut =
  | "DRAFT"
  | "SENT"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

/** Facture émise pour un abonnement. */
export interface SaaInvoice {
  id: string;
  subscription_id: string;
  etablissement_id: string;
  etablissement?: { id: string; nom: string };
  /** Numéro lisible : INV-2026-0001. */
  numero: string;
  /** Date ISO de début de période facturée. */
  periode_debut: string;
  /** Date ISO de fin de période facturée. */
  periode_fin: string;
  montant_ht: number;
  /** Taux de TVA (ex : 0.18 pour 18 %). */
  taux_tva: number;
  montant_tva: number;
  montant_ttc: number;
  statut: InvoiceStatut;
  /** Date ISO d'émission. */
  date_emission: string;
  /** Date ISO d'échéance. */
  date_echeance: string;
  /** Date ISO de paiement (null si non payée). */
  date_paiement?: string | null;
  /** Mode de paiement renseigné lors du règlement. */
  mode_paiement?: string;
  /** Rérence de paiement renseignée lors du règlement. */
  reference_paiement?: string;
}

/** Agrégats de revenus renvoyés par `GET /api/saas/billing/stats`. */
export interface BillingStats {
  /** Revenu mensuel récurrent (FCFA). */
  revenu_mensuel: number;
  /** Revenu annuel récurrent (FCFA). */
  revenu_annuel: number;
  /** Montant en attente de règlement (FCFA). */
  revenu_en_attente: number;
  nb_abonnements_actifs: number;
  nb_abonnements_essai: number;
  nb_factures_impayees: number;
  nb_factures_payees: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Clés de cache React Query
// ─────────────────────────────────────────────────────────────────────────────

export const billingKeys = {
  all: ["saas-billing"] as const,
  stats: () => [...billingKeys.all, "stats"] as const,
  plans: () => [...billingKeys.all, "plans"] as const,
  subscriptions: () => [...billingKeys.all, "subscriptions"] as const,
  invoices: (filters?: { etablissement_id?: string; statut?: string }) =>
    [...billingKeys.all, "invoices", filters ?? {}] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────────

export interface InvoiceQueryParams {
  etablissement_id?: string;
  statut?: string;
}

function buildInvoiceQuery(params: InvoiceQueryParams = {}): string {
  const qs = new URLSearchParams();
  if (params.etablissement_id)
    qs.set("etablissement_id", params.etablissement_id);
  if (params.statut) qs.set("statut", params.statut);
  const s = qs.toString();
  return s ? `?${s}` : "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Plans
// ─────────────────────────────────────────────────────────────────────────────

/** Liste tous les plans tarifaires. */
export function fetchPlans(): Promise<SaaPlan[]> {
  return apiGet<SaaPlan[]>("/api/saas/billing/plans");
}

/** Crée un nouveau plan tarifaire. */
export function createPlan(dto: PlanDTO): Promise<SaaPlan> {
  return apiPost<SaaPlan>("/api/saas/billing/plans", dto);
}

/** Met à jour un plan tarifaire existant. */
export function updatePlan(id: string, dto: PlanDTO): Promise<SaaPlan> {
  return apiPut<SaaPlan>(`/api/saas/billing/plans/${id}`, dto);
}

// ─────────────────────────────────────────────────────────────────────────────
// Abonnements
// ─────────────────────────────────────────────────────────────────────────────

/** Liste tous les abonnements (avec établissement + plan joints). */
export function fetchSubscriptions(): Promise<SaaSubscription[]> {
  return apiGet<SaaSubscription[]>("/api/saas/billing/subscriptions");
}

/** Crée un nouvel abonnement pour un établissement. */
export function createSubscription(
  dto: SubscriptionDTO,
): Promise<SaaSubscription> {
  return apiPost<SaaSubscription>("/api/saas/billing/subscriptions", dto);
}

/** Annule un abonnement (fin de période, plus de renouvellement). */
export function cancelSubscription(
  id: string,
): Promise<SaaSubscription> {
  return apiPost<SaaSubscription>(
    `/api/saas/billing/subscriptions/${id}/cancel`,
    {},
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Factures
// ─────────────────────────────────────────────────────────────────────────────

/** Liste les factures (filtrables par établissement et statut). */
export function fetchInvoices(
  params: InvoiceQueryParams = {},
): Promise<SaaInvoice[]> {
  return apiGet<SaaInvoice[]>(
    `/api/saas/billing/invoices${buildInvoiceQuery(params)}`,
  );
}

/** Génère une nouvelle facture pour un abonnement. */
export function generateInvoice(subscriptionId: string): Promise<SaaInvoice> {
  return apiPost<SaaInvoice>("/api/saas/billing/invoices", {
    subscription_id: subscriptionId,
  });
}

/** Marque une facture comme payée. */
export function payInvoice(
  id: string,
  body: { mode_paiement: string; reference_paiement: string },
): Promise<SaaInvoice> {
  return apiPost<SaaInvoice>(`/api/saas/billing/invoices/${id}/pay`, body);
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────────────────────────────────────

/** Récupère les agrégats de revenus SaaS. */
export function fetchBillingStats(): Promise<BillingStats> {
  return apiGet<BillingStats>("/api/saas/billing/stats");
}
