"use client";

/**
 * ScolaGest — API client Phase 5 : Modules avancés.
 *
 * Couvre :
 *  - Comptabilité générale : exercices, plan comptable, journaux, écritures,
 *    grand livre, bilan, journal de caisse.
 *  - Mobile Money : transactions, initier, confirmer, webhooks, réconciliation.
 *  - SMS / Email : templates, envois, envoi unitaire, relance de masse.
 *  - Multi-sites & Paramètres : utilisateurs + accès par établissement,
 *    journal d'audit.
 *
 * Toutes les fonctions s'appuient sur le client API générique (`@/lib/api-client`)
 * qui attache automatiquement le JWT et le paramètre `?XTransformPort=8080`.
 *
 * Les clés de cache React Query (`comptaKeys`, `momoKeys`, `messageKeys`,
 * `usersKeys`, `auditKeys`) sont centralisées ici pour faciliter
 * l'invalidation croisée entre composants.
 */

import {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
} from "@/lib/api-client";
import type { Etablissement } from "@/lib/auth-store";
import type {
  AuditListResponse,
  AuditQueryParams,
  BilanResult,
  CompteComptable,
  CompteDTO,
  EcritureComptable,
  EcrituresListResponse,
  EcrituresQueryParams,
  EtablissementAccess,
  EtablissementAccessDTO,
  EnvoiMessage,
  EnvoiMessageDTO,
  EnvoisMessageListResponse,
  EnvoisMessageQueryParams,
  ExerciceComptable,
  ExerciceDTO,
  GrandLivreQueryParams,
  GrandLivreResult,
  InitierMomoDTO,
  JournalAudit,
  JournalComptable,
  RelanceMasseDTO,
  RelanceMasseResult,
  TemplateMessage,
  TemplateMessageDTO,
  TransactionMomo,
  TransactionsMomoListResponse,
  TransactionsMomoQueryParams,
  Utilisateur,
  UtilisateurDTO,
  WebhookMomo,
} from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Clés de cache React Query
// ─────────────────────────────────────────────────────────────────────────────

export const comptaKeys = {
  all: ["comptabilite"] as const,
  exercices: (etablissementId?: string) =>
    [...comptaKeys.all, "exercices", { etablissementId }] as const,
  exercice: (id: string) =>
    [...comptaKeys.all, "exercice", id] as const,
  comptes: (etablissementId?: string) =>
    [...comptaKeys.all, "comptes", { etablissementId }] as const,
  journaux: (etablissementId?: string) =>
    [...comptaKeys.all, "journaux", { etablissementId }] as const,
  ecritures: (params: EcrituresQueryParams) =>
    [...comptaKeys.all, "ecritures", params] as const,
  ecriture: (id: string) =>
    [...comptaKeys.all, "ecriture", id] as const,
  grandLivre: (params: GrandLivreQueryParams) =>
    [...comptaKeys.all, "grand-livre", params] as const,
  bilan: (exerciceId?: string) =>
    [...comptaKeys.all, "bilan", { exerciceId }] as const,
};

export const momoKeys = {
  all: ["mobile-money"] as const,
  transactions: (params: TransactionsMomoQueryParams) =>
    [...momoKeys.all, "transactions", params] as const,
  transaction: (id: string) =>
    [...momoKeys.all, "transaction", id] as const,
  webhooks: () => [...momoKeys.all, "webhooks"] as const,
};

export const messageKeys = {
  all: ["messages"] as const,
  templates: (etablissementId?: string) =>
    [...messageKeys.all, "templates", { etablissementId }] as const,
  envois: (params: EnvoisMessageQueryParams) =>
    [...messageKeys.all, "envois", params] as const,
};

export const usersKeys = {
  all: ["utilisateurs"] as const,
  list: (params: { etablissementId?: string }) =>
    [...usersKeys.all, "list", params] as const,
  detail: (id: string) => [...usersKeys.all, "detail", id] as const,
};

export const etablissementsKeys = {
  all: ["etablissements"] as const,
  list: () => [...etablissementsKeys.all, "list"] as const,
};

export const auditKeys = {
  all: ["audit"] as const,
  list: (params: AuditQueryParams) =>
    [...auditKeys.all, "list", params] as const,
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes — construction des query strings
// ─────────────────────────────────────────────────────────────────────────────

function buildEcrituresQuery(params: EcrituresQueryParams = {}): string {
  const qs = new URLSearchParams();
  if (params.exercice_id) qs.set("exercice_id", params.exercice_id);
  if (params.journal_id) qs.set("journal_id", params.journal_id);
  if (params.date_debut) qs.set("date_debut", params.date_debut);
  if (params.date_fin) qs.set("date_fin", params.date_fin);
  qs.set("page", String(params.page ?? 1));
  qs.set("page_size", String(params.page_size ?? 20));
  return qs.toString();
}

function buildGrandLivreQuery(params: GrandLivreQueryParams): string {
  const qs = new URLSearchParams();
  if (params.exercice_id) qs.set("exercice_id", params.exercice_id);
  if (params.compte_id) qs.set("compte_id", params.compte_id);
  if (params.date_debut) qs.set("date_debut", params.date_debut);
  if (params.date_fin) qs.set("date_fin", params.date_fin);
  return qs.toString();
}

function buildTransactionsMomoQuery(
  params: TransactionsMomoQueryParams = {},
): string {
  const qs = new URLSearchParams();
  if (params.statut) qs.set("statut", params.statut);
  if (params.provider) qs.set("provider", params.provider);
  if (params.date_debut) qs.set("date_debut", params.date_debut);
  if (params.date_fin) qs.set("date_fin", params.date_fin);
  qs.set("page", String(params.page ?? 1));
  qs.set("page_size", String(params.page_size ?? 20));
  return qs.toString();
}

function buildEnvoisMessageQuery(
  params: EnvoisMessageQueryParams = {},
): string {
  const qs = new URLSearchParams();
  if (params.statut) qs.set("statut", params.statut);
  if (params.type) qs.set("type", params.type);
  if (params.date_debut) qs.set("date_debut", params.date_debut);
  if (params.date_fin) qs.set("date_fin", params.date_fin);
  qs.set("page", String(params.page ?? 1));
  qs.set("page_size", String(params.page_size ?? 20));
  return qs.toString();
}

function buildAuditQuery(params: AuditQueryParams = {}): string {
  const qs = new URLSearchParams();
  if (params.entite) qs.set("entite", params.entite);
  if (params.utilisateur_id) qs.set("utilisateur_id", params.utilisateur_id);
  if (params.date_debut) qs.set("date_debut", params.date_debut);
  if (params.date_fin) qs.set("date_fin", params.date_fin);
  qs.set("page", String(params.page ?? 1));
  qs.set("page_size", String(params.page_size ?? 20));
  return qs.toString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Comptabilité — Exercices
// ─────────────────────────────────────────────────────────────────────────────

export function fetchExercices(etablissementId?: string): Promise<ExerciceComptable[]> {
  const qs = etablissementId
    ? `?etablissement_id=${encodeURIComponent(etablissementId)}`
    : "";
  return apiGet<ExerciceComptable[]>(`/api/comptabilite/exercices${qs}`);
}

export function createExercice(dto: ExerciceDTO): Promise<ExerciceComptable> {
  return apiPost<ExerciceComptable>("/api/comptabilite/exercices", dto);
}

export function cloturerExercice(id: string): Promise<ExerciceComptable> {
  return apiPost<ExerciceComptable>(
    `/api/comptabilite/exercices/${id}/cloturer`,
    {},
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Comptabilité — Plan comptable
// ─────────────────────────────────────────────────────────────────────────────

export function fetchComptes(etablissementId?: string): Promise<CompteComptable[]> {
  const qs = etablissementId
    ? `?etablissement_id=${encodeURIComponent(etablissementId)}`
    : "";
  return apiGet<CompteComptable[]>(`/api/comptabilite/comptes${qs}`);
}

export function createCompte(dto: CompteDTO): Promise<CompteComptable> {
  return apiPost<CompteComptable>("/api/comptabilite/comptes", dto);
}

// ─────────────────────────────────────────────────────────────────────────────
// Comptabilité — Journaux
// ─────────────────────────────────────────────────────────────────────────────

export function fetchJournaux(etablissementId?: string): Promise<JournalComptable[]> {
  const qs = etablissementId
    ? `?etablissement_id=${encodeURIComponent(etablissementId)}`
    : "";
  return apiGet<JournalComptable[]>(`/api/comptabilite/journaux${qs}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Comptabilité — Écritures
// ─────────────────────────────────────────────────────────────────────────────

export function fetchEcritures(
  params: EcrituresQueryParams = {},
): Promise<EcrituresListResponse> {
  return apiGet<EcrituresListResponse>(
    `/api/comptabilite/ecritures?${buildEcrituresQuery(params)}`,
  );
}

export function fetchEcriture(id: string): Promise<EcritureComptable> {
  return apiGet<EcritureComptable>(`/api/comptabilite/ecritures/${id}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Comptabilité — Grand livre
// ─────────────────────────────────────────────────────────────────────────────

export function fetchGrandLivre(
  params: GrandLivreQueryParams,
): Promise<GrandLivreResult> {
  return apiGet<GrandLivreResult>(
    `/api/comptabilite/grand-livre?${buildGrandLivreQuery(params)}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Comptabilité — Bilan
// ─────────────────────────────────────────────────────────────────────────────

export function fetchBilan(exerciceId?: string): Promise<BilanResult> {
  const qs = exerciceId
    ? `?exercice_id=${encodeURIComponent(exerciceId)}`
    : "";
  return apiGet<BilanResult>(`/api/comptabilite/bilan${qs}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mobile Money
// ─────────────────────────────────────────────────────────────────────────────

export function fetchTransactionsMomo(
  params: TransactionsMomoQueryParams = {},
): Promise<TransactionsMomoListResponse> {
  return apiGet<TransactionsMomoListResponse>(
    `/api/mobile-money/transactions?${buildTransactionsMomoQuery(params)}`,
  );
}

export function initierTransactionMomo(
  dto: InitierMomoDTO,
): Promise<TransactionMomo> {
  return apiPost<TransactionMomo>("/api/mobile-money/initier", dto);
}

export function confirmerTransactionMomo(
  id: string,
): Promise<TransactionMomo> {
  return apiPost<TransactionMomo>(
    `/api/mobile-money/transactions/${id}/confirmer`,
    {},
  );
}

export function fetchWebhooksMomo(): Promise<WebhookMomo[]> {
  return apiGet<WebhookMomo[]>("/api/mobile-money/webhooks");
}

export function reconcilierWebhookMomo(
  id: string,
): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>(
    `/api/mobile-money/webhooks/${id}/reconcilier`,
    {},
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SMS / Email — Templates
// ─────────────────────────────────────────────────────────────────────────────

export function fetchTemplates(
  etablissementId?: string,
): Promise<TemplateMessage[]> {
  const qs = etablissementId
    ? `?etablissement_id=${encodeURIComponent(etablissementId)}`
    : "";
  return apiGet<TemplateMessage[]>(`/api/messages/templates${qs}`);
}

export function createTemplate(
  dto: TemplateMessageDTO,
): Promise<TemplateMessage> {
  return apiPost<TemplateMessage>("/api/messages/templates", dto);
}

export function updateTemplate(
  id: string,
  dto: TemplateMessageDTO,
): Promise<TemplateMessage> {
  return apiPut<TemplateMessage>(`/api/messages/templates/${id}`, dto);
}

// ─────────────────────────────────────────────────────────────────────────────
// SMS / Email — Envois
// ─────────────────────────────────────────────────────────────────────────────

export function fetchEnvois(
  params: EnvoisMessageQueryParams = {},
): Promise<EnvoisMessageListResponse> {
  return apiGet<EnvoisMessageListResponse>(
    `/api/messages/envois?${buildEnvoisMessageQuery(params)}`,
  );
}

export function envoyerMessage(
  dto: EnvoiMessageDTO,
): Promise<EnvoiMessage> {
  return apiPost<EnvoiMessage>("/api/messages/envoyer", dto);
}

export function relanceMasse(
  dto: RelanceMasseDTO,
): Promise<RelanceMasseResult> {
  return apiPost<RelanceMasseResult>("/api/messages/relance-masse", dto);
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-sites & Paramètres — Établissements
// ─────────────────────────────────────────────────────────────────────────────

export function fetchEtablissements(): Promise<Etablissement[]> {
  return apiGet<Etablissement[]>("/api/etablissements");
}

export function createEtablissement(
  dto: Partial<Etablissement>,
): Promise<Etablissement> {
  return apiPost<Etablissement>("/api/etablissements", dto);
}

export function updateEtablissement(
  id: string,
  dto: Partial<Etablissement>,
): Promise<Etablissement> {
  return apiPut<Etablissement>(`/api/etablissements/${id}`, dto);
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-sites & Paramètres — Utilisateurs
// ─────────────────────────────────────────────────────────────────────────────

export function fetchUtilisateurs(
  etablissementId?: string,
): Promise<Utilisateur[]> {
  const qs = etablissementId
    ? `?etablissement_id=${encodeURIComponent(etablissementId)}`
    : "";
  return apiGet<Utilisateur[]>(`/api/utilisateurs${qs}`);
}

export function createUtilisateur(
  dto: UtilisateurDTO,
): Promise<Utilisateur> {
  return apiPost<Utilisateur>("/api/utilisateurs", dto);
}

export function updateUtilisateur(
  id: string,
  dto: Partial<UtilisateurDTO>,
): Promise<Utilisateur> {
  return apiPut<Utilisateur>(`/api/utilisateurs/${id}`, dto);
}

export function addEtablissementAccess(
  utilisateurId: string,
  dto: EtablissementAccessDTO,
): Promise<EtablissementAccess> {
  return apiPost<EtablissementAccess>(
    `/api/utilisateurs/${utilisateurId}/access`,
    dto,
  );
}

export async function removeEtablissementAccess(
  utilisateurId: string,
  etablissementId: string,
): Promise<boolean> {
  await apiDelete<{ success: boolean }>(
    `/api/utilisateurs/${utilisateurId}/access/${etablissementId}`,
  );
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-sites & Paramètres — Journal d'audit
// ─────────────────────────────────────────────────────────────────────────────

export function fetchAudit(
  params: AuditQueryParams = {},
): Promise<AuditListResponse> {
  return apiGet<AuditListResponse>(
    `/api/audit?${buildAuditQuery(params)}`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-export des types JournalAudit pour faciliter l'usage côté composants.
// ─────────────────────────────────────────────────────────────────────────────

export type { JournalAudit };
