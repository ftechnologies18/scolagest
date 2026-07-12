"use client";

/**
 * ScolaGest — Helper de géolocalisation (Phase B — pointage enseignant).
 *
 * Wrappe `navigator.geolocation.getCurrentPosition` avec un timeout de 10 s.
 * Si la géolocalisation est indisponible, refusée ou expire, on renvoie des
 * coordonnées par défaut (0, 0) — le backend marquera alors le pointage en
 * `VALIDATION_REQUISE` (le surveillant validera manuellement).
 *
 * L'objectif : NE JAMAIS bloquer le pointage côté UI. Le prof doit pouvoir
 * pointer même sans GPS (en salle, sur un vieux téléphone, permission refusée).
 */

export interface GeoPosition {
  lat: number;
  lng: number;
  precision: number;
}

export type GeoErrorCode =
  | "UNAVAILABLE"
  | "PERMISSION_DENIED"
  | "POSITION_UNAVAILABLE"
  | "TIMEOUT"
  | "UNKNOWN";

export class GeoError extends Error {
  code: GeoErrorCode;

  constructor(code: GeoErrorCode, message: string) {
    super(message);
    this.name = "GeoError";
    this.code = code;
  }
}

/** Coordonnées par défaut renvoyées en cas d'échec (le backend gère le rejet). */
export const DEFAULT_GEO_POSITION: GeoPosition = {
  lat: 0,
  lng: 0,
  precision: 0,
};

/** Timeout GPS en ms. Au-delà, on abandonne et on renvoie la position par défaut. */
const GEO_TIMEOUT_MS = 10_000;
/** Âge max d'une position mise en cache par le navigateur (ms). */
const GEO_MAX_AGE_MS = 30_000;

/**
 * Récupère la position GPS courante du navigateur.
 *
 * @returns Une `Promise<GeoPosition>` — toujours résolue (jamais rejetée).
 *          En cas d'échec, résout avec `DEFAULT_GEO_POSITION` et l'avertissement
 *          est renvoyé dans le second élément du tuple si `withError=true`.
 *
 * Deux variantes :
 *   - `getCurrentPosition()` : résout toujours avec une `GeoPosition`. Simple.
 *   - `getCurrentPositionWithStatus()` : résout avec `{ position, error? }`
 *     pour que l'UI puisse afficher un message (« GPS refusé »).
 */
export function getCurrentPosition(): Promise<GeoPosition> {
  return new Promise((resolve) => {
    if (
      typeof navigator === "undefined" ||
      !("geolocation" in navigator) ||
      !navigator.geolocation
    ) {
      resolve(DEFAULT_GEO_POSITION);
      return;
    }

    let settled = false;
    const safeResolve = (pos: GeoPosition) => {
      if (settled) return;
      settled = true;
      resolve(pos);
    };

    // Filet de sécurité : si le navigateur n'appelle ni succès ni erreur
    // dans les 10 s, on résout avec la position par défaut.
    const fallbackTimer = setTimeout(() => {
      safeResolve(DEFAULT_GEO_POSITION);
    }, GEO_TIMEOUT_MS + 500);

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(fallbackTimer);
          safeResolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            precision: pos.coords.accuracy ?? 0,
          });
        },
        () => {
          clearTimeout(fallbackTimer);
          // Permission refusée / position indisponible / timeout : on dégrade
          // gracieusement vers une position nulle. Le backend marquera le
          // pointage en VALIDATION_REQUISE.
          safeResolve(DEFAULT_GEO_POSITION);
        },
        {
          enableHighAccuracy: true,
          timeout: GEO_TIMEOUT_MS,
          maximumAge: GEO_MAX_AGE_MS,
        },
      );
    } catch {
      clearTimeout(fallbackTimer);
      safeResolve(DEFAULT_GEO_POSITION);
    }
  });
}

/**
 * Variante qui expose aussi l'erreur éventuelle, pour permettre à l'UI
 * d'afficher un message informatif (« GPS désactivé », « permission refusée »).
 */
export async function getCurrentPositionWithStatus(): Promise<{
  position: GeoPosition;
  error: GeoError | null;
}> {
  if (
    typeof navigator === "undefined" ||
    !("geolocation" in navigator) ||
    !navigator.geolocation
  ) {
    return {
      position: DEFAULT_GEO_POSITION,
      error: new GeoError("UNAVAILABLE", "Géolocalisation indisponible sur cet appareil."),
    };
  }

  return new Promise((resolve) => {
    let settled = false;
    const settle = (position: GeoPosition, error: GeoError | null) => {
      if (settled) return;
      settled = true;
      resolve({ position, error });
    };

    const fallbackTimer = setTimeout(() => {
      settle(DEFAULT_GEO_POSITION, new GeoError("TIMEOUT", "GPS : délai dépassé (10 s)."));
    }, GEO_TIMEOUT_MS + 500);

    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(fallbackTimer);
          settle(
            {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              precision: pos.coords.accuracy ?? 0,
            },
            null,
          );
        },
        (err) => {
          clearTimeout(fallbackTimer);
          const code: GeoErrorCode =
            err.code === err.PERMISSION_DENIED
              ? "PERMISSION_DENIED"
              : err.code === err.POSITION_UNAVAILABLE
                ? "POSITION_UNAVAILABLE"
                : err.code === err.TIMEOUT
                  ? "TIMEOUT"
                  : "UNKNOWN";
          const message =
            code === "PERMISSION_DENIED"
              ? "Permission de localisation refusée. Le pointage sera soumis à validation."
              : code === "POSITION_UNAVAILABLE"
                ? "Position GPS indisponible. Le pointage sera soumis à validation."
                : code === "TIMEOUT"
                  ? "GPS : délai dépassé (10 s). Le pointage sera soumis à validation."
                  : "Erreur GPS inconnue. Le pointage sera soumis à validation.";
          settle(DEFAULT_GEO_POSITION, new GeoError(code, message));
        },
        {
          enableHighAccuracy: true,
          timeout: GEO_TIMEOUT_MS,
          maximumAge: GEO_MAX_AGE_MS,
        },
      );
    } catch {
      clearTimeout(fallbackTimer);
      settle(
        DEFAULT_GEO_POSITION,
        new GeoError("UNKNOWN", "Erreur GPS inattendue. Le pointage sera soumis à validation."),
      );
    }
  });
}

/**
 * Indique si la géolocalisation est *probablement* disponible côté client.
 * Utilisé pour afficher une icône / un message d'avertissement avant le clic.
 */
export function isGeolocationAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    "geolocation" in navigator &&
    !!navigator.geolocation
  );
}
