"use client";

/**
 * ScolaGest — Portail parent (route `/portal`).
 *
 * Rend le composant `ParentPortal` existant. Le guard d'authentification
 * vérifie `isParentAuthenticated` : si le parent n'est pas authentifié (ou
 * en cours de chargement), on affiche un spinner puis on redirige vers
 * `/parent` (formulaire téléphone + PIN).
 *
 * La déconnexion est gérée à l'intérieur de `ParentPortal` (appelle
 * `logoutParent()` du store) ; cet effet détecte alors la perte du token et
 * redirige automatiquement vers `/parent`.
 */

import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useAuthBootstrap } from "@/hooks/use-auth-bootstrap";
import { ParentPortal } from "@/components/parent/parent-portal";
import { ModuleHero } from "@/components/ds/module-hero";

export default function PortalPage() {
  const router = useRouter();
  useAuthBootstrap();

  const isParentAuthenticated = useAuthStore((s) => s.isParentAuthenticated);
  const parentAccessToken = useAuthStore((s) => s.parentAccessToken);
  const isLoading = useAuthStore((s) => s.isLoading);

  // Redirige vers le formulaire parent si non authentifié.
  useEffect(() => {
    if (isLoading) return;
    if (!isParentAuthenticated || !parentAccessToken) {
      router.push("/parent");
    }
  }, [isLoading, isParentAuthenticated, parentAccessToken, router]);

  // Spinner tant que le guard n'a pas validé l'accès.
  if (isLoading || !isParentAuthenticated || !parentAccessToken) {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-amber-50 via-background to-emerald-50">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-amber-200/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-emerald-200/30 blur-3xl"
        />
        <div className="relative z-10 flex flex-col items-center gap-4">
          <Image
            src="/logo.png"
            alt="ScolaGest"
            width={64}
            height={64}
            className="rounded-2xl shadow-lg shadow-amber-600/20"
            priority
          />
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">ScolaGest</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Chargement de votre espace parent…
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="font-body">
      <ModuleHero
        icon={Heart}
        title="Portail Parent"
        subtitle="Suivez vos enfants et leurs paiements"
      />
      <ParentPortal />
    </div>
  );
}
