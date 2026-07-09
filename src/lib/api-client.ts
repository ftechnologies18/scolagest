"use client";

/**
 * ScolaGest — Client API pour le backend Go (port 8080)
 *
 * Toutes les requêtes passent par la gateway Caddy du monorepo. Caddy route
 * vers le backend Go (8080) ou le frontend Next.js (3000) selon la présence
 * du paramètre de query `XTransformPort=8080`. Ce client ajoute
 * automatiquement ce paramètre à chaque appel.
 *
 * Le client attache également l'en-tête `Authorization: Bearer <token>` à
 * partir du `auth-store` (Zustand). En cas de 401, il tente un rafraîchissement
 * unique du token via `/api/auth/refresh` puis réessaie la requête initiale.
 */

import { useAuthStore } from "@/lib/auth-store";

export const API_TRANSFORM_PORT = "8080";

/** Erreur typée levée par le client API. */
export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/** Ajoute `?XTransformPort=8080` (ou `&XTransformPort=8080`) au chemin. */
function withTransformPort(path: string): string {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}XTransformPort=${API_TRANSFORM_PORT}`;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Ne pas attacher l'en-tête Authorization. */
  skipAuth?: boolean;
  /** Ne pas tenter de refresh automatique (évite les boucles). */
  skipRefresh?: boolean;
  /** Autorise un corps de requête vide même pour POST/PUT. */
  allowEmptyBody?: boolean;
}

async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = "GET",
    body,
    headers = {},
    skipAuth = false,
    skipRefresh = false,
  } = options;

  const url = withTransformPort(path);

  const finalHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...headers,
  };

  if (!skipAuth) {
    const token = useAuthStore.getState().accessToken;
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`;
    }
  }

  const init: RequestInit = {
    method,
    headers: finalHeaders,
  };
  if (body !== undefined && !["GET", "HEAD"].includes(method)) {
    init.body = JSON.stringify(body);
  }

  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new ApiError(
      "Impossible de contacter le serveur. Vérifiez votre connexion.",
      0,
      err,
    );
  }

  // 401 → tenter un refresh unique puis réessayer
  if (res.status === 401 && !skipAuth && !skipRefresh) {
    const refreshed = await useAuthStore.getState().refresh();
    if (refreshed) {
      return request<T>(path, { ...options, skipRefresh: true });
    }
    // refresh échoué : on déconnecte
    useAuthStore.getState().logout();
    throw new ApiError("Votre session a expiré. Veuillez vous reconnecter.", 401);
  }

  // Lecture du corps de réponse
  let data: unknown = null;
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  } else if (res.status !== 204) {
    try {
      data = await res.text();
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "error" in data
        ? String((data as Record<string, unknown>).error)
        : null) ?? `Erreur HTTP ${res.status}`;
    throw new ApiError(message, res.status, data);
  }

  return data as T;
}

/** Effectue un GET sur `path`. */
export function apiGet<T>(
  path: string,
  options?: Omit<RequestOptions, "method" | "body">,
): Promise<T> {
  return request<T>(path, { ...options, method: "GET" });
}

/** Effectue un POST sur `path` avec `body` sérialisé en JSON. */
export function apiPost<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, "method" | "body">,
): Promise<T> {
  return request<T>(path, {
    ...options,
    method: "POST",
    body: body ?? {},
  });
}

/** Effectue un PUT sur `path` avec `body` sérialisé en JSON. */
export function apiPut<T>(
  path: string,
  body?: unknown,
  options?: Omit<RequestOptions, "method" | "body">,
): Promise<T> {
  return request<T>(path, {
    ...options,
    method: "PUT",
    body: body ?? {},
  });
}

/** Effectue un DELETE sur `path`. */
export function apiDelete<T>(
  path: string,
  options?: Omit<RequestOptions, "method" | "body">,
): Promise<T> {
  return request<T>(path, { ...options, method: "DELETE" });
}

/** Construit l'URL complète (avec XTransformPort) sans effectuer la requête. */
export function buildApiUrl(path: string): string {
  return withTransformPort(path);
}
