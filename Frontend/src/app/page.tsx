"use client";

/**
 * ScolaGest — Page racine (route `/`).
 *
 * Comportement :
 *   1. `isLoading` : spinner centré pendant la reprise de session.
 *   2. Authentifié staff (et non parent) : redirection vers `/dashboard`.
 *   3. Authentifié parent : redirection vers `/portal`.
 *   4. Authentifié staff en tant que SUPER_ADMIN : redirection vers
 *      `/saas/dashboard`.
 *   5. Non authentifié : page de choix (deux cartes : « Espace Staff » →
 *      `/login`, « Espace Parent » → `/parent`).
 *
 * Le `auth-store` est réhydraté depuis localStorage (zustand persist) avant
 * le premier effet React. Si un token staff est présent, on tente un GET
 * /api/auth/me pour rafraîchir le profil ; sinon on arrête le chargement.
 * Le token parent est non-rafraîchissable : on l'utilise tel quel.
 */

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Users,
  Phone,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuthStore } from "@/lib/auth-store";
import { useAuthBootstrap } from "@/hooks/use-auth-bootstrap";

export default function Page() {
  const router = useRouter();
  useAuthBootstrap();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const accessToken = useAuthStore((s) => s.accessToken);
  const parentAccessToken = useAuthStore((s) => s.parentAccessToken);
  const role = useAuthStore((s) => s.role);

  // Redirige automatiquement si l'utilisateur est déjà authentifié.
  useEffect(() => {
    if (isLoading) return;
    if (parentAccessToken) {
      router.push("/portal");
      return;
    }
    if (isAuthenticated && accessToken) {
      router.push(role === "SUPER_ADMIN" ? "/saas/dashboard" : "/dashboard");
    }
  }, [
    isLoading,
    isAuthenticated,
    accessToken,
    parentAccessToken,
    role,
    router,
  ]);

  // État 1 : chargement initial
  if (isLoading || parentAccessToken || (isAuthenticated && accessToken)) {
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
              Chargement de votre espace…
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <ChoicePage />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page de choix — deux cartes (staff / parent)
// ─────────────────────────────────────────────────────────────────────────────

function ChoicePage() {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-emerald-50 via-background to-amber-50">
      {/* Décorations */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-emerald-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-amber-200/30 blur-3xl"
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          {/* En-tête */}
          <div className="mb-8 flex flex-col items-center text-center">
            <Image
              src="/logo.png"
              alt="ScolaGest"
              width={72}
              height={72}
              className="rounded-2xl shadow-lg shadow-emerald-600/20"
              priority
            />
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
              ScolaGest
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Gestion &amp; Caisse Scolaire — Groupe Le Chandelier, Dabou.
              Choisissez votre espace pour continuer.
            </p>
          </div>

          {/* Deux cartes */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {/* Espace Staff */}
            <Link href="/login" className="group text-left">
              <Card className="h-full overflow-hidden border-emerald-200 shadow-md transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-lg hover:shadow-emerald-200/40">
                <CardHeader className="gap-3">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-700/30">
                    <Users className="size-6" />
                  </div>
                  <CardTitle className="text-xl text-emerald-800 dark:text-emerald-300">
                    Espace Staff
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Réservé au personnel de l&apos;établissement :
                    administrateurs, caissiers, comptables, direction,
                    secrétariat.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex items-start gap-1.5">
                      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                      Connexion sécurisée par email &amp; mot de passe
                    </li>
                    <li className="flex items-start gap-1.5">
                      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
                      Gestion des élèves, caisse, rapports, multi-sites
                    </li>
                  </ul>
                  <Button
                    type="button"
                    className="mt-5 w-full bg-emerald-600 text-white hover:bg-emerald-700 group-hover:bg-emerald-700"
                  >
                    Se connecter
                  </Button>
                </CardContent>
              </Card>
            </Link>

            {/* Espace Parent */}
            <Link href="/parent" className="group text-left">
              <Card className="h-full overflow-hidden border-amber-200 shadow-md transition-all hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-lg hover:shadow-amber-200/40">
                <CardHeader className="gap-3">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm shadow-amber-600/30">
                    <Phone className="size-6" />
                  </div>
                  <CardTitle className="text-xl text-amber-800 dark:text-amber-300">
                    Espace Parent
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Pour les parents &amp; tuteurs : suivez les comptes scolaires
                    de vos enfants, payez en ligne ou à l&apos;école.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    <li className="flex items-start gap-1.5">
                      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                      Accès simple par téléphone &amp; code PIN à 4 chiffres
                    </li>
                    <li className="flex items-start gap-1.5">
                      <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                      Soldes, échéances, historique &amp; paiement Mobile Money
                    </li>
                  </ul>
                  <Button
                    type="button"
                    className="mt-5 w-full bg-amber-600 text-white hover:bg-amber-700 group-hover:bg-amber-700"
                  >
                    Accéder à mon espace
                  </Button>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Bandeau info */}
          <div className="mt-8 flex items-center justify-center gap-2 text-center text-[11px] text-muted-foreground">
            <GraduationCap className="size-3.5 text-emerald-600" />
            Collège Privé Le Chandelier — Dabou, Côte d&apos;Ivoire
          </div>

          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} ScolaGest · Freelance Technologies
            Côte d&apos;Ivoire
          </p>
        </div>
      </div>
    </div>
  );
}
