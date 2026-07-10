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
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { apiGet, apiPost } from "@/lib/api-client";

/** Liste des rôles RBAC connus (côté frontend). */
export type Role =
  | "ADMINISTRATEUR"
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

interface AuthState {
  /** Token JWT d'accès court (15 min). */
  accessToken: string | null;
  /** Token JWT de rafraîchissement long (7 j). */
  refreshToken: string | null;
  user: ScolaGestUser | null;
  etablissement: Etablissement | null;
  role: string | null;

  /** Indique si le store est en cours de chargement initial (reprise de session). */
  isLoading: boolean;
  /** Dérivé : true si un access token est présent. */
  isAuthenticated: boolean;
  /** Indique que le store a été réhydraté depuis localStorage. */
  hydrated: boolean;

  /** Connexion : appelle /api/auth/login et stocke les tokens. */
  login: (
    email: string,
    password: string,
    etablissementId?: string | null,
  ) => Promise<boolean>;
  /** Déconnexion : appelle /api/auth/logout puis vide le store. */
  logout: () => Promise<void>;
  /** Rafraîchit l'access token via le refresh token. */
  refresh: () => Promise<boolean>;
  /** Récupère le profil courant via /api/auth/me. */
  fetchMe: () => Promise<void>;
  /** Change l'établissement actif (multi-sites). */
  setEtablissement: (etablissement: Etablissement | null) => void;
  /** Marque le store comme réhydraté (appelé par le consommateur). */
  setHydrated: (value: boolean) => void;
  /** Force l'arrêt de l'état de chargement initial. */
  stopLoading: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      etablissement: null,
      role: null,
      isLoading: true,
      isAuthenticated: false,
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
            isAuthenticated: false,
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
            isAuthenticated: false,
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
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      setEtablissement: (etablissement) => set({ etablissement }),

      setHydrated: (value) => set({ hydrated: value }),

      stopLoading: () => set({ isLoading: false }),
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
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Après réhydratation, synchronise `isAuthenticated` et marque le store prêt.
          state.isAuthenticated = !!state.accessToken;
          state.hydrated = true;
        }
      },
    },
  ),
);
