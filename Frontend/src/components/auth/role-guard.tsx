"use client";

/**
 * ScolaGest — Guard de rôle RBAC pour les pages staff.
 *
 * Composant client qui vérifie que l'utilisateur courant possède l'un des
 * rôles autorisés. Si non, affiche un écran « Accès refusé » professionnel
 * (avec lien de retour vers le tableau de bord) au lieu de rendre le contenu.
 *
 * Ce guard complète le filtrage de la sidebar (qui masque seulement les liens
 * de navigation) : il empêche un utilisateur d'accéder à une page en tapant
 * directement son URL dans la barre d'adresse (sécurité en profondeur).
 *
 * Usage :
 *
 *   import { RoleGuard } from "@/components/auth/role-guard";
 *
 *   export default function ComptabilitePage() {
 *     return (
 *       <RoleGuard allow={["COMPTABLE"]}>
 *         <ComptabiliteView />
 *       </RoleGuard>
 *     );
 *   }
 *
 * Si `allow` est omis, tous les rôles authentifiés sont autorisés (le guard
 * ne fait alors que vérifier l'authentification — utile pour factoriser).
 */

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShieldX, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore, type Role } from "@/lib/auth-store";
import { useAuthBootstrap } from "@/hooks/use-auth-bootstrap";

export interface RoleGuardProps {
  /** Rôles autorisés à voir le contenu. Si omis, tous les rôles authentifiés. */
  allow?: Role[];
  /** Contenu à rendre si l'utilisateur est autorisé. */
  children: React.ReactNode;
  /** URL de fallback si l'utilisateur n'est pas authentifié (défaut : /login). */
  loginRedirect?: string;
  /** URL de retour affichée sur l'écran « Accès refusé » (défaut : /dashboard). */
  fallbackHref?: string;
}

export function RoleGuard({
  allow,
  children,
  loginRedirect = "/login",
  fallbackHref = "/dashboard",
}: RoleGuardProps) {
  const router = useRouter();
  useAuthBootstrap();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const accessToken = useAuthStore((s) => s.accessToken);
  const role = useAuthStore((s) => s.role);

  // Redirige vers /login si non authentifié après chargement.
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !accessToken) {
      router.push(loginRedirect);
    }
  }, [isLoading, isAuthenticated, accessToken, loginRedirect, router]);

  // État transitoire : chargement initial.
  if (isLoading || !isAuthenticated || !accessToken) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Vérification de vos droits d'accès…
        </div>
      </div>
    );
  }

  // Vérification du rôle.
  const allowed = !allow || allow.length === 0 || (role !== null && allow.includes(role as Role));

  if (!allowed) {
    return (
      <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden bg-gradient-to-br from-rose-50 via-background to-amber-50 p-6">
        {/* Décorations */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-rose-200/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-amber-200/30 blur-3xl"
        />

        <div className="relative z-10 flex max-w-md flex-col items-center text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 shadow-lg shadow-rose-600/20">
            <ShieldX className="size-8" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">
            Accès refusé
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Vous n&apos;avez pas les droits nécessaires pour consulter cette
            page. Ce module est réservé à un autre profil utilisateur.
          </p>
          {role ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Votre rôle actuel :{" "}
              <span className="font-mono font-medium">{role}</span>
            </p>
          ) : null}
          <Button asChild className="mt-6" variant="default">
            <Link href={fallbackHref}>
              <ArrowLeft className="size-4" />
              Retour au tableau de bord
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
