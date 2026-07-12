"use client";

/**
 * ScolaGest — Layout du portail enseignant (route `/prof`).
 *
 * Layout plein écran SANS sidebar staff (contrairement au groupe `(staff)`).
 * Vérifie l'authentification et le rôle `ENSEIGNANT` côté client :
 *   - Si non authentifié (ou en cours de chargement) : spinner puis redirection
 *     vers `/login`.
 *   - Si authentifié mais rôle ≠ `ENSEIGNANT` : écran « Accès refusé » + lien
 *     vers le tableau de bord staff correspondant.
 *
 * Le prof accède à `/prof` directement après connexion. L'en-tête contient
 * « Mon espace enseignant », le logo, le nom de l'utilisateur et un bouton de
 * déconnexion. Le footer est sticky (mt-auto sur flex-col).
 */

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, ShieldX, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/auth-store";
import { useAuthBootstrap } from "@/hooks/use-auth-bootstrap";

export default function ProfLayout({
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
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  // Redirections après chargement.
  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || !accessToken) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, accessToken, router]);

  // État transitoire : chargement initial.
  if (isLoading || !isAuthenticated || !accessToken) {
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
              Chargement de votre espace enseignant…
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Vérification du rôle : seul `ENSEIGNANT` a accès au portail prof.
  if (role !== "ENSEIGNANT") {
    return (
      <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-rose-50 via-background to-amber-50 p-6">
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
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Accès refusé</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Cet espace est réservé aux enseignants. Votre compte n&apos;a pas le
            rôle <span className="font-mono font-medium">ENSEIGNANT</span>.
          </p>
          {role ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Votre rôle actuel :{" "}
              <span className="font-mono font-medium">{role}</span>
            </p>
          ) : null}
          <Button asChild className="mt-6">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Retour au tableau de bord
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const displayName = user
    ? [user.prenoms, user.nom].filter(Boolean).join(" ") || user.email
    : "Enseignant";

  async function handleLogout() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b bg-emerald-600 text-emerald-50 shadow-sm">
        <div className="mx-auto flex w-full max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Image
            src="/logo.png"
            alt="ScolaGest"
            width={36}
            height={36}
            className="rounded-lg bg-white/90 p-0.5 shadow"
            priority
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight sm:text-base">
              Mon espace enseignant
            </p>
            <p className="truncate text-xs text-emerald-100/90">
              {displayName}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={handleLogout}
            className="h-9 gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>

      <footer className="mt-auto border-t bg-muted/30">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
          ScolaGest — Portail enseignant · Pointage &amp; signalements
        </div>
      </footer>
    </div>
  );
}
