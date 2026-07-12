"use client";

/**
 * ScolaGest — Client API pour la paie enseignants (Phase C).
 *
 * Routes staff (DIRECTION, DIRECTEUR_*) :
 *  - GET /api/paie/bulletins?mois=&annee=
 *  - GET /api/paie/bulletins/:id
 *  - POST /api/paie/bulletins/generate
 *  - POST /api/paie/bulletins/:id/valider
 *  - POST /api/paie/bulletins/:id/payer
 *  - GET /api/paie/avances?statut=
 *  - POST /api/paie/avances
 *  - POST /api/paie/avances/:id/traiter
 *
 * Routes prof (ENSEIGNANT) :
 *  - GET /api/prof/bulletins
 */

import { apiGet, apiPost } from "@/lib/api-client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type StatutBulletin = "BROUILLON" | "VALIDE" | "PAYE";
export type StatutAvance = "DEMANDEE" | "APPROUVEE" | "REJETEE" | "DEDUITE";

export interface BulletinPaie {
  id: string;
  etablissement_id: string;
  enseignant_id: string;
  enseignant?: { id: string; nom: string; prenoms: string; matricule: string };
  annee_scolaire_id: string;
  mois: number;
  annee: number;
  heures_pointees: number;
  heures_planifiees: number;
  nb_sessions_pointees: number;
  nb_sessions_total: number;
  taux_horaire_moyen: number;
  salaire_brut: number;
  total_avances: number;
  cotisations: number;
  salaire_net: number;
  statut: StatutBulletin;
  valide_par?: string | null;
  date_validation?: string | null;
  paye_par?: string | null;
  date_paie?: string | null;
  reference_paiement: string;
  pdf_url: string;
  notes: string;
}

export interface GenerateBulletinResult {
  bulletin: BulletinPaie;
  alerte_ecart?: string;
}

export interface AvanceSalaire {
  id: string;
  etablissement_id: string;
  enseignant_id: string;
  enseignant?: { id: string; nom: string; prenoms: string; matricule: string };
  montant: number;
  date_demande: string;
  date_versement?: string | null;
  motif: string;
  statut: StatutAvance;
  approuve_par?: string | null;
  date_approbation?: string | null;
  motif_rejet: string;
  bulletin_paie_id?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Labels
// ─────────────────────────────────────────────────────────────────────────────

export const STATUT_BULLETIN_LABEL: Record<StatutBulletin, string> = {
  BROUILLON: "Brouillon",
  VALIDE: "Validé",
  PAYE: "Payé",
};

export const STATUT_AVANCE_LABEL: Record<StatutAvance, string> = {
  DEMANDEE: "Demandée",
  APPROUVEE: "Approuvée",
  REJETEE: "Rejetée",
  DEDUITE: "Déduite",
};

export const MOIS_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

export function moisLabel(mois: number): string {
  return MOIS_LABELS[mois - 1] ?? `Mois ${mois}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// API — Bulletins (staff)
// ─────────────────────────────────────────────────────────────────────────────

export function fetchBulletins(params?: {
  mois?: number;
  annee?: number;
}): Promise<BulletinPaie[]> {
  const qs = new URLSearchParams();
  if (params?.mois) qs.set("mois", String(params.mois));
  if (params?.annee) qs.set("annee", String(params.annee));
  const query = qs.toString();
  return apiGet<BulletinPaie[]>(`/api/paie/bulletins${query ? `?${query}` : ""}`);
}

export function fetchBulletin(id: string): Promise<BulletinPaie> {
  return apiGet<BulletinPaie>(`/api/paie/bulletins/${id}`);
}

export function generateBulletin(body: {
  enseignant_id: string;
  mois: number;
  annee: number;
}): Promise<GenerateBulletinResult> {
  return apiPost<GenerateBulletinResult>("/api/paie/bulletins/generate", body);
}

export function validerBulletin(
  id: string,
  cotisations: number,
): Promise<BulletinPaie> {
  return apiPost<BulletinPaie>(`/api/paie/bulletins/${id}/valider`, {
    cotisations,
  });
}

export function payerBulletin(
  id: string,
  reference: string,
): Promise<BulletinPaie> {
  return apiPost<BulletinPaie>(`/api/paie/bulletins/${id}/payer`, {
    reference,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// API — Avances (staff)
// ─────────────────────────────────────────────────────────────────────────────

export function fetchAvances(statut?: StatutAvance): Promise<AvanceSalaire[]> {
  const qs = new URLSearchParams();
  if (statut) qs.set("statut", statut);
  const query = qs.toString();
  return apiGet<AvanceSalaire[]>(`/api/paie/avances${query ? `?${query}` : ""}`);
}

export function createAvance(body: {
  enseignant_id: string;
  montant: number;
  motif?: string;
}): Promise<AvanceSalaire> {
  return apiPost<AvanceSalaire>("/api/paie/avances", body);
}

export function traiterAvance(
  id: string,
  body: { approuver: boolean; motif_rejet?: string },
): Promise<AvanceSalaire> {
  return apiPost<AvanceSalaire>(`/api/paie/avances/${id}/traiter`, body);
}

// ─────────────────────────────────────────────────────────────────────────────
// API — Bulletins prof
// ─────────────────────────────────────────────────────────────────────────────

export function fetchMesBulletins(): Promise<BulletinPaie[]> {
  return apiGet<BulletinPaie[]>("/api/prof/bulletins");
}

// ─────────────────────────────────────────────────────────────────────────────
// API — Avances prof (l'enseignant fait ses propres demandes)
// ─────────────────────────────────────────────────────────────────────────────

export function fetchMesAvances(): Promise<AvanceSalaire[]> {
  return apiGet<AvanceSalaire[]>("/api/prof/avances");
}

export function createMesAvance(body: {
  montant: number;
  motif?: string;
}): Promise<AvanceSalaire> {
  return apiPost<AvanceSalaire>("/api/prof/avances", body);
}
