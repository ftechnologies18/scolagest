"use client";

/**
 * ScolaGest — Page de connexion staff (route `/login`).
 *
 * Rend le formulaire `LoginForm` existant. Au succès de la connexion, le
 * `auth-store` met à jour `isAuthenticated` et `accessToken` ; cet effet
 * détecte le changement et redirige vers `/dashboard` (ou `/saas/dashboard`
 * pour le SUPER_ADMIN).
 *
 * Bouton « Retour » → `/` (page de choix).
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { useAuthBootstrap } from "@/hooks/use-auth-bootstrap";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  const router = useRouter();
  useAuthBootstrap();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);

  // Redirige automatiquement vers le tableau de bord si déjà authentifié.
  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated && accessToken) {
      router.push(role === "SUPER_ADMIN" ? "/saas/dashboard" : "/dashboard");
    }
  }, [isLoading, isAuthenticated, accessToken, role, router]);

  return (
    <div className="relative">
      <LoginForm onBack={() => router.push("/")} />
    </div>
  );
}
