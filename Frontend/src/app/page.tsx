"use client";

/**
 * ScolaGest — Page racine (route unique /)
 *
 * Bascule entre quatre états selon le store d'authentification :
 *   1. `isLoading` : spinner centré pendant la reprise de session.
 *   2. Non authentifié (ni staff ni parent) : <ChoicePage /> offrant deux
 *      grands boutons — « Espace Staff » (email/mot de passe) et
 *      « Espace Parent » (téléphone + PIN).
 *      - Si l'utilisateur choisit « staff » → <LoginForm /> plein écran.
 *      - Si l'utilisateur choisit « parent » → <ParentAccessForm /> plein écran.
 *   3. Authentifié staff : <DashboardLayout /> (tableau de bord existant).
 *   4. Authentifié parent : <ParentPortal /> (portail parent, adapté).
 *
 * Le `auth-store` est réhydraté depuis localStorage (zustand persist) avant
 * le premier effet React. Si un token staff est présent, on tente un GET
 * /api/auth/me pour rafraîchir le profil ; sinon on arrête le chargement.
 * Le token parent est non-rafraîchissable : on l'utilise tel quel.
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Loader2,
  Users,
  Phone,
  ArrowLeft,
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
import { LoginForm } from "@/components/auth/login-form";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { ParentPortal } from "@/components/parent/parent-portal";
import { ParentAccessForm } from "@/components/parent/parent-access-form";

type Choice = "choice" | "staff" | "parent";

export default function Page() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const accessToken = useAuthStore((s) => s.accessToken);
  const parentAccessToken = useAuthStore((s) => s.parentAccessToken);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const stopLoading = useAuthStore((s) => s.stopLoading);

  // État local : page de choix vs formulaire staff vs formulaire parent.
  const [choice, setChoice] = useState<Choice>("choice");

  useEffect(() => {
    // Une seule initialisation après montage côté client.
    // À ce stade, le persist middleware a déjà réhydraté le store depuis
    // localStorage (sous les clés `scolagest-auth`).
    if (accessToken) {
      // Token staff : on vérifie sa validité via /api/auth/me.
      fetchMe();
    } else {
      // Pas de token staff : on s'arrête (parent ou non connecté).
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

  // État 4 : parent authentifié (prioritaire sur le staff si les deux tokens
  // coexistent — cas exceptionnel).
  if (parentAccessToken) {
    return <ParentPortal />;
  }

  // État 3 : staff authentifié
  if (isAuthenticated && accessToken) {
    return <DashboardLayout />;
  }

  // État 2 : non authentifié → choix d'espace ou formulaire sélectionné.
  if (choice === "staff") {
    return <LoginForm onBack={() => setChoice("choice")} />;
  }
  if (choice === "parent") {
    return <ParentAccessForm onBack={() => setChoice("choice")} />;
  }
  return <ChoicePage onPick={setChoice} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Page de choix — deux cartes (staff / parent)
// ─────────────────────────────────────────────────────────────────────────────

function ChoicePage({
  onPick,
}: {
  onPick: (choice: Choice) => void;
}) {
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
            <button
              type="button"
              onClick={() => onPick("staff")}
              className="group text-left"
            >
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
            </button>

            {/* Espace Parent */}
            <button
              type="button"
              onClick={() => onPick("parent")}
              className="group text-left"
            >
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
            </button>
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
