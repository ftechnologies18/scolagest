"use client";

/**
 * ScolaGest — Store d'authentification (Zustand + persist)
 *
 * Stocke les tokens JWT (access + refresh), l'utilisateur courant,
 * l'établissement actif et le rôle. Les tokens sont persistés dans
 * localStorage pour survivre aux rechargements de page.
 *
 * Le client API (`api-client.ts`) lit le `accessToken` via
 * `useAuthStore.getState()` pour attacher l'en-tête Authorization. En cas de
 * 401, il appelle `refresh()` ; en cas d'échec, il appelle `logout()`.
 *
 * ── Accès parent (Phase 6 redesign) ──────────────────────────────────────
 * Les parents n'ont plus de compte staff : ils accèdent au portail via
 * téléphone + PIN. Le backend renvoie un `access_token` temporaire (2 h,
 * scoped aux endpoints `/api/parent/*`), stocké dans `parentAccessToken`.
 *
 * `isAuthenticated` est `true` si l'utilisateur est authentifié **soit** comme
 * staff **soit** comme parent. `isParentAuthenticated` est dérivé de
 * `parentAccessToken`. Les deux flux sont indépendants.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { apiGet, apiPost } from "@/lib/api-client";

/**
 * Liste des rôles RBAC connus (côté frontend).
 *
 * `SUPER_ADMIN` = propriétaire de la plateforme SaaS (gestion multi-tenant,
 * audit global, mode support). N'a PAS accès aux données d'un établissement
 * sauf si le « mode support » est activé. `DIRECTION` est désormais
 * l'administrateur d'établissement (rôle historiquement tenu par
 * `ADMINISTRATEUR`).
 */
export type Role =
  | "SUPER_ADMIN"
  | "CAISSIER"
  | "COMPTABLE"
  | "DIRECTION"
  | "SECRETARIAT"
  | "PARENT";

export interface ScolaGestUser {
  id: string;
  nom: string;
  prenoms: string;
  email: string;
  role_global: string;
  statut: string;
}

export interface Etablissement {
  id: string;
  nom: string;
  code_officiel?: string;
  ville?: string;
  applique_categorie_affecte?: boolean;
  actif?: boolean;
}

/** Tuteur renvoyé par POST /api/parent/access. */
export interface TuteurParent {
  id: string;
  nom: string;
  prenoms: string;
  telephone: string;
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: ScolaGestUser;
  etablissement: Etablissement | null;
  role: string;
}

interface MeResponse {
  user: ScolaGestUser;
  etablissement: Etablissement | null;
  role: string;
}

interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

interface ParentAccessResponse {
  access_token: string;
  tuteur: TuteurParent;
}

interface AuthState {
  /** Token JWT d'accès court (15 min) — staff. */
  accessToken: string | null;
  /** Token JWT de rafraîchissement long (7 j) — staff. */
  refreshToken: string | null;
  user: ScolaGestUser | null;
  etablissement: Etablissement | null;
  role: string | null;

  /** Token JWT temporaire (2 h) — parent (scoped /api/parent/*). */
  parentAccessToken: string | null;
  /** Tuteur renvoyé par /api/parent/access. */
  tuteur: TuteurParent | null;

  /** Indique si le store est en cours de chargement initial (reprise de session). */
  isLoading: boolean;
  /** Dérivé : true si un access token staff OU parent est présent. */
  isAuthenticated: boolean;
  /** Dérivé : true si un parent token est présent. */
  isParentAuthenticated: boolean;
  /** Indique que le store a été réhydraté depuis localStorage. */
  hydrated: boolean;

  /** Connexion staff : appelle /api/auth/login et stocke les tokens. */
  login: (
    email: string,
    password: string,
    etablissementId?: string | null,
  ) => Promise<boolean>;
  /** Déconnexion staff : appelle /api/auth/logout puis vide le store staff. */
  logout: () => Promise<void>;
  /** Rafraîchit l'access token staff via le refresh token. */
  refresh: () => Promise<boolean>;
  /** Récupère le profil courant via /api/auth/me. */
  fetchMe: () => Promise<void>;
  /** Change l'établissement actif (multi-sites). */
  setEtablissement: (etablissement: Etablissement | null) => void;
  /** Marque le store comme réhydraté (appelé par le consommateur). */
  setHydrated: (value: boolean) => void;
  /** Force l'arrêt de l'état de chargement initial. */
  stopLoading: () => void;

  /** Connexion parent : appelle POST /api/parent/access (téléphone + PIN). */
  loginParent: (telephone: string, pin: string) => Promise<boolean>;
  /** Déconnexion parent : vide uniquement les champs parent. */
  logoutParent: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      etablissement: null,
      role: null,
      parentAccessToken: null,
      tuteur: null,
      isLoading: true,
      isAuthenticated: false,
      isParentAuthenticated: false,
      hydrated: false,

      login: async (email, password, etablissementId = null) => {
        const data = await apiPost<LoginResponse>(
          "/api/auth/login",
          {
            email,
            password,
            etablissement_id: etablissementId,
          },
          { skipAuth: true },
        );
        set({
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          user: data.user,
          etablissement: data.etablissement,
          role: data.role,
          isAuthenticated: true,
          isLoading: false,
        });
        return true;
      },

      logout: async () => {
        // Best-effort : on prévient le backend, mais on vide le store quoi qu'il arrive.
        try {
          if (get().accessToken) {
            await apiPost("/api/auth/logout", {}, { skipRefresh: true });
          }
        } catch {
          // ignore: le backend peut être injoignable ou le token déjà expiré
        } finally {
          set({
            accessToken: null,
            refreshToken: null,
            user: null,
            etablissement: null,
            role: null,
            isAuthenticated: get().isParentAuthenticated,
            isLoading: false,
          });
          if (typeof window !== "undefined") {
            // Force la persistance à se réinitialiser
            try {
              window.localStorage.removeItem("scolagest-auth");
            } catch {
              // ignore
            }
          }
        }
      },

      refresh: async () => {
        const currentRefresh = get().refreshToken;
        if (!currentRefresh) return false;
        try {
          const data = await apiPost<RefreshResponse>(
            "/api/auth/refresh",
            { refresh_token: currentRefresh },
            { skipAuth: true, skipRefresh: true },
          );
          set({
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            isAuthenticated: true,
          });
          return true;
        } catch {
          set({
            accessToken: null,
            refreshToken: null,
            user: null,
            etablissement: null,
            role: null,
            isAuthenticated: get().isParentAuthenticated,
          });
          return false;
        }
      },

      fetchMe: async () => {
        if (!get().accessToken) {
          set({ isLoading: false });
          return;
        }
        try {
          const data = await apiGet<MeResponse>("/api/auth/me", {
            skipRefresh: false,
          });
          set({
            user: data.user,
            etablissement: data.etablissement,
            role: data.role,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch {
          set({
            accessToken: null,
            refreshToken: null,
            user: null,
            etablissement: null,
            role: null,
            isAuthenticated: get().isParentAuthenticated,
            isLoading: false,
          });
        }
      },

      setEtablissement: (etablissement) => set({ etablissement }),

      setHydrated: (value) => set({ hydrated: value }),

      stopLoading: () => set({ isLoading: false }),

      loginParent: async (telephone, pin) => {
        const data = await apiPost<ParentAccessResponse>(
          "/api/parent/access",
          { telephone, pin },
          { skipAuth: true },
        );
        set({
          parentAccessToken: data.access_token,
          tuteur: data.tuteur,
          isParentAuthenticated: true,
          isAuthenticated: true,
          isLoading: false,
        });
        return true;
      },

      logoutParent: () => {
        set({
          parentAccessToken: null,
          tuteur: null,
          isParentAuthenticated: false,
          isAuthenticated: !!get().accessToken,
        });
      },
    }),
    {
      name: "scolagest-auth",
      storage: createJSONStorage(() => {
        if (typeof window !== "undefined") {
          return window.localStorage;
        }
        // Fallback SSR : un Storage vide qui ne persiste rien.
        return {
          getItem: () => null,
          setItem: () => undefined,
          removeItem: () => undefined,
        };
      }),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        etablissement: state.etablissement,
        role: state.role,
        parentAccessToken: state.parentAccessToken,
        tuteur: state.tuteur,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Après réhydratation, synchronise les drapeaux dérivés.
          const staff = !!state.accessToken;
          const parent = !!state.parentAccessToken;
          state.isAuthenticated = staff || parent;
          state.isParentAuthenticated = parent;
          state.hydrated = true;
        }
      },
    },
  ),
);
