"use client";

/**
 * ScolaGest — Client API pour la récupération de mot de passe staff et de
 * code PIN parent.
 *
 * Routes publiques (sans auth) :
 *  - POST /api/auth/password-reset/request  (staff : demande reset par email)
 *  - POST /api/auth/password-reset/confirm  (staff : reset avec token + mdp)
 *  - POST /api/parent/reset-pin             (parent : reset PIN par vérif enfant)
 */

import { apiPost } from "@/lib/api-client";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RequestResetResult {
  reset_url: string; // mode démo seulement (vide en prod avec SMTP)
  email: string; // partiellement masqué
  sent: boolean;
}

export interface PINResetRequest {
  telephone: string;
  eleve_nom: string;
  eleve_prenoms?: string;
}

export interface PINResetResult {
  new_pin: string; // mode démo seulement (vide en prod avec SMS)
  sent: boolean;
  telephone: string; // partiellement masqué
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

/** Staff : demande un lien de réinitialisation par email. */
export function requestPasswordReset(email: string): Promise<RequestResetResult> {
  return apiPost<RequestResetResult>(
    "/api/auth/password-reset/request",
    { email },
    { skipAuth: true },
  );
}

/** Staff : consomme un token et définit un nouveau mot de passe. */
export function confirmPasswordReset(
  token: string,
  newPassword: string,
): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>(
    "/api/auth/password-reset/confirm",
    { token, new_password: newPassword },
    { skipAuth: true },
  );
}

/** Parent : vérifie l'identité (téléphone + enfant) et régénère le PIN. */
export function resetParentPIN(
  dto: PINResetRequest,
): Promise<PINResetResult> {
  return apiPost<PINResetResult>("/api/parent/reset-pin", dto, {
    skipAuth: true,
  });
}
