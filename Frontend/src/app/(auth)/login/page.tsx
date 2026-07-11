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
 * Lien « Espace Parent » → `/parent`.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Phone } from "lucide-react";
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

      {/* Lien « Espace Parent » flottant en bas de page */}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-10 flex justify-center">
        <Link
          href="/parent"
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-background/90 px-3 py-1.5 text-xs font-medium text-amber-700 shadow-md backdrop-blur transition-colors hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-950/40"
        >
          <Phone className="size-3.5" />
          Espace Parent
          <ArrowLeft className="size-3 rotate-180 opacity-60" />
        </Link>
      </div>
    </div>
  );
}
