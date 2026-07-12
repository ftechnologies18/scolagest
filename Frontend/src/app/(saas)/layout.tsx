"use client";

/**
 * ScolaGest — Layout des routes SaaS (groupe `(saas)`).
 *
 * Englobe toutes les routes réservées au `SUPER_ADMIN` : `/saas/dashboard`,
 * `/saas/establishments`, `/saas/billing`, `/saas/audit`, `/saas/support`.
 * Affiche la coquille `DashboardShell` (sidebar + topbar + footer) avec les
 * groupes de navigation SaaS, sans sélecteur d'établissement (le SUPER_ADMIN
 * gère tous les tenants via les vues SaaS).
 *
 * Guards :
 *   - Si l'utilisateur n'est pas authentifié (ou en cours de chargement) :
 *     spinner, puis redirection vers `/login` si non authentifié.
 *   - Si l'utilisateur est authentifié mais n'est PAS `SUPER_ADMIN` :
 *     redirection vers `/dashboard` (espace staff standard).
 */

import Image from "next/image";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { useAuthBootstrap } from "@/hooks/use-auth-bootstrap";
import {
  DashboardShell,
  SAAS_NAV_GROUPS,
} from "@/components/dashboard/dashboard-shell";
import { KentePattern } from "@/components/ds/kente-pattern";

export default function SaasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  useAuthBootstrap();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);

  // Redirections après chargement.
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !accessToken) {
      router.push("/login");
      return;
    }
    if (role !== "SUPER_ADMIN") {
      router.push("/dashboard");
    }
  }, [isLoading, isAuthenticated, accessToken, role, router]);

  // États transitoires : chargement initial OU utilisateur non autorisé.
  // On affiche un spinner plein écran en attendant que la redirection
  // s'opère (cela évite un flash de contenu non autorisé).
  if (
    isLoading ||
    !isAuthenticated ||
    !accessToken ||
    role !== "SUPER_ADMIN"
  ) {
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
          <Image
            src="/logo.png"
            alt="ScolaGest"
            width={64}
            height={64}
            className="rounded-2xl shadow-lg shadow-emerald-600/20"
            priority
          />
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight">ScolaGest</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Chargement de votre espace SaaS…
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="font-body">
      <KentePattern variant="strip" position="top" />
      <DashboardShell
        navGroups={SAAS_NAV_GROUPS}
        showEtablissement={false}
        logoutRedirect="/login"
      >
        {children}
      </DashboardShell>
    </div>
  );
}
