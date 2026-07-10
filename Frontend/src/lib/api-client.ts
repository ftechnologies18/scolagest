"use client";

/**
 * ScolaGest — Client API pour le backend Go.
 *
 * Deux modes de fonctionnement :
 * - **Production** : `NEXT_PUBLIC_API_BASE_URL` est défini (ex: https://scolagest-backend.onrender.com).
 *   Les requêtes utilisent cette URL absolue directement.
 * - **Développement (sandbox)** : `NEXT_PUBLIC_API_BASE_URL` n'est pas défini.
 *   Les requêtes passent par la gateway Caddy via le paramètre `?XTransformPort=8080`.
 *
 * Le client attache l'en-tête `Authorization: Bearer <token>` depuis le `auth-store`.
 * En cas de 401, il tente un rafraîchissement unique du token puis réessaie.
 */

import { useAuthStore } from "@/lib/auth-store";

export const API_TRANSFORM_PORT = "8080";

/**
 * URL de base du backend en production (Render).
 * En développement (sandbox), cette variable n'est pas définie → on utilise
 * la gateway Caddy avec ?XTransformPort=8080.
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

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

/**
 * Construit l'URL finale de la requête.
 * - En production : préfixe avec API_BASE_URL (URL absolue du backend Render).
 * - En dev : ajoute `?XTransformPort=8080` pour la gateway Caddy.
 */
function buildUrl(path: string): string {
  if (API_BASE_URL) {
    // Production : URL absolue du backend Render
    return `${API_BASE_URL}${path}`;
  }
  // Dev sandbox : gateway Caddy avec XTransformPort
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

  const url = buildUrl(path);

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

/** Construit l'URL complète (production ou dev) sans effectuer la requête. */
export function buildApiUrl(path: string): string {
  return buildUrl(path);
}

// ─────────────────────────────────────────────────────────────────────────────
// Téléchargement de fichiers (exports CSV / Excel / PDF)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Télécharge un fichier depuis le backend en passant par la gateway Caddy
 * (ajoute `?XTransformPort=8080` et l'en-tête Authorization), puis déclenche
 * l'enregistrement côté navigateur via un élément `<a>` éphémère.
 *
 * @param path Chemin API (ex : `/api/rapports/paiements?format=csv`).
 * @param filename Nom du fichier proposé au navigateur (ex : `paiements.csv`).
 * @returns `true` si le téléchargement a réussi, `false` sinon.
 */
export async function downloadFile(
  path: string,
  filename: string,
): Promise<boolean> {
  const url = buildUrl(path);

  const headers: Record<string, string> = {
    Accept: "*/*",
  };
  const token = useAuthStore.getState().accessToken;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, { headers });
  } catch (err) {
    throw new ApiError(
      "Impossible de contacter le serveur pour le téléchargement.",
      0,
      err,
    );
  }

  // 401 → tenter un refresh unique puis réessayer
  if (res.status === 401) {
    const refreshed = await useAuthStore.getState().refresh();
    if (refreshed) {
      return downloadFile(path, filename);
    }
    useAuthStore.getState().logout();
    throw new ApiError("Votre session a expiré. Veuillez vous reconnecter.", 401);
  }

  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.text();
    } catch {
      // ignore
    }
    const message =
      payload && typeof payload === "string" && payload.length > 0
        ? payload
        : `Erreur HTTP ${res.status}`;
    throw new ApiError(message, res.status, payload);
  }

  // Récupère le blob et déclenche le téléchargement
  let blob: Blob;
  try {
    blob = await res.blob();
  } catch (err) {
    throw new ApiError("Lecture du fichier téléchargé impossible.", 0, err);
  }

  // Tente de récupérer un nom de fichier depuis Content-Disposition
  const disposition = res.headers.get("content-disposition");
  let finalName = filename;
  if (disposition) {
    const match = /filename="?([^";]+)"?/.exec(disposition);
    if (match && match[1]) {
      finalName = decodeURIComponent(match[1]);
    }
  }

  // Crée une URL objet et un <a> éphémère pour déclencher le téléchargement
  if (typeof window === "undefined") return false;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = finalName;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Libère la mémoire après un court délai (Chrome tolère mieux)
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  return true;
}
