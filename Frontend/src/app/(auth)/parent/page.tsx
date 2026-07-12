"use client";

/**
 * ScolaGest — Page d'accès parent (route `/parent`).
 *
 * Rend le formulaire `ParentAccessForm` existant. Au succès, le `auth-store`
 * met à jour `isParentAuthenticated` et `parentAccessToken` ; cet effet
 * détecte le changement et redirige vers `/portal`.
 *
 * Bouton « Retour » → `/` (page de choix).
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth-store";
import { useAuthBootstrap } from "@/hooks/use-auth-bootstrap";
import { ParentAccessForm } from "@/components/parent/parent-access-form";

export default function ParentAccessPage() {
  const router = useRouter();
  useAuthBootstrap();

  const parentAccessToken = useAuthStore((s) => s.parentAccessToken);
  const isLoading = useAuthStore((s) => s.isLoading);

  // Redirige automatiquement vers le portail parent si déjà authentifié.
  useEffect(() => {
    if (isLoading) return;
    if (parentAccessToken) {
      router.push("/portal");
    }
  }, [isLoading, parentAccessToken, router]);

  return <ParentAccessForm onBack={() => router.push("/")} />;
}
