"use client";

/**
 * ScolaGest — Page racine (route unique /)
 *
 * Bascule entre trois états selon le store d'authentification :
 *   1. `isLoading` : spinner centré pendant la reprise de session.
 *   2. Non authentifié : <LoginForm /> plein écran.
 *   3. Authentifié : <DashboardLayout /> qui gère la vue active en interne.
 *
 * Le `auth-store` est réhydraté depuis localStorage (zustand persist) avant
 * le premier effet React. Si un token est présent, on tente un GET /api/auth/me
 * pour rafraîchir le profil ; sinon, on arrête le chargement.
 */

import { useEffect } from "react";
import { GraduationCap, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { LoginForm } from "@/components/auth/login-form";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

export default function Page() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const accessToken = useAuthStore((s) => s.accessToken);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const stopLoading = useAuthStore((s) => s.stopLoading);

  useEffect(() => {
    // Une seule initialisation après montage côté client.
    // À ce stade, le persist middleware a déjà réhydraté le store depuis
    // localStorage (sous les clés `scolagest-auth`).
    if (accessToken) {
      // On a un token : on vérifie sa validité via /api/auth/me.
      // Si le token est expiré, l'api-client tentera un refresh automatique
      // avant de propager l'erreur ; le store gère alors la déconnexion.
      fetchMe();
    } else {
      stopLoading();
    }
  }, []);

  // État 1 : chargement initial
  if (isLoading) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-background to-amber-50">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-emerald-200/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-amber-200/30 blur-3xl"
        />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20">
            <GraduationCap className="size-9" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">ScolaGest</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Chargement de votre espace…
            </div>
          </div>
        </div>
      </div>
    );
  }

  // État 2 : non authentifié
  if (!isAuthenticated) {
    return <LoginForm />;
  }

  // État 3 : authentifié
  return <DashboardLayout />;
}
