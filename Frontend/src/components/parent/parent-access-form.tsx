"use client";

/**
 * ScolaGest — Formulaire d'accès Parent (Phase 6 redesign).
 *
 * Les parents n'ont plus de compte staff : ils accèdent au portail via
 * **numéro de téléphone + code PIN à 4 chiffres**. Le bouton « Accéder à mon
 * espace » appelle `loginParent(telephone, pin)` du `auth-store`, qui hit
 * `POST /api/parent/access` (endpoint public). Le backend renvoie un
 * `access_token` temporaire (2 h, scoped `/api/parent/*`) et les infos du
 * tuteur.
 *
 * Au succès, le `auth-store` met à jour `isParentAuthenticated` et
 * `isAuthenticated` ; `page.tsx` bascule alors vers `<ParentPortal />`.
 *
 * Sur erreur 401, on affiche un toast « Numéro de téléphone ou PIN incorrect ».
 */

import { useState } from "react";
import Image from "next/image";
import {
  Loader2,
  LogIn,
  ArrowLeft,
  Phone,
  KeyRound,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/auth-store";
import { ApiError } from "@/lib/api-client";

const DEMO_TELEPHONE = "+2250701020304";
const DEMO_PIN = "1234";

export interface ParentAccessFormProps {
  /** Retour à la page de choix (Espace staff / Espace parent). */
  onBack: () => void;
}

export function ParentAccessForm({ onBack }: ParentAccessFormProps) {
  const { toast } = useToast();
  const loginParent = useAuthStore((s) => s.loginParent);

  const [telephone, setTelephone] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /** Normalise le numéro de téléphone : supprime les espaces, garde `+`. */
  function normalizePhone(value: string): string {
    return value.replace(/[^\d+]/g, "");
  }

  /** Limite le PIN à 4 chiffres strictement numériques. */
  function handlePinChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 4);
    setPin(digits);
  }

  /** Préfixe `+225` automatiquement si l'utilisateur saisit juste les 10 chiffres. */
  function ensureCountryCode(value: string): string {
    const cleaned = normalizePhone(value);
    if (!cleaned) return cleaned;
    if (cleaned.startsWith("+")) return cleaned;
    if (cleaned.startsWith("00")) return `+${cleaned.slice(2)}`;
    if (cleaned.startsWith("225")) return `+${cleaned}`;
    // Numéro local ivoirien (10 chiffres) → on préfixe +225.
    if (/^\d{10}$/.test(cleaned)) return `+225${cleaned}`;
    return cleaned;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const tel = ensureCountryCode(telephone);
    if (!tel || tel.length < 8) {
      toast({
        title: "Numéro invalide",
        description:
          "Renseignez votre numéro de téléphone (ex. +225 0701020304).",
        variant: "destructive",
      });
      return;
    }
    if (pin.length !== 4) {
      toast({
        title: "PIN invalide",
        description: "Le code PIN doit comporter 4 chiffres.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      await loginParent(tel, pin);
      toast({
        title: "Accès accordé",
        description: "Bienvenue sur votre espace parent.",
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 401
            ? "Numéro de téléphone ou PIN incorrect."
            : err.message
          : "Une erreur inattendue est survenue. Réessayez.";
      toast({
        title: "Accès refusé",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function applyDemo() {
    setTelephone(DEMO_TELEPHONE);
    setPin(DEMO_PIN);
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-amber-50 via-background to-emerald-50">
      {/* Décorations d'arrière-plan */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-amber-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-emerald-200/30 blur-3xl"
      />

      <div className="relative z-10 flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* En-tête / logo */}
          <div className="mb-6 flex flex-col items-center text-center">
            <Image
              src="/logo.png"
              alt="ScolaGest"
              width={72}
              height={72}
              className="rounded-2xl shadow-lg shadow-amber-600/20"
              priority
            />
            <h1 className="mt-3 text-2xl font-bold tracking-tight">ScolaGest</h1>
            <p className="text-sm text-muted-foreground">
              Espace Parent · Groupe Le Chandelier, Dabou
            </p>
          </div>

          <Card className="border-amber-100 shadow-xl">
            <CardHeader className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <span className="flex size-7 items-center justify-center rounded-md bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  <Phone className="size-4" />
                </span>
                Espace Parent
              </CardTitle>
              <CardDescription>
                Accédez à votre espace avec votre numéro de téléphone et votre
                code PIN. Aucun mot de passe nécessaire.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Téléphone */}
                <div className="space-y-2">
                  <Label htmlFor="telephone">Numéro de téléphone</Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="telephone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="+225 0701020304"
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      disabled={submitting}
                      className="pl-9 font-mono"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Indicatif Côte d&apos;Ivoire{" "}
                    <span className="font-mono">+225</span> — saisi
                    automatiquement si omis.
                  </p>
                </div>

                {/* PIN */}
                <div className="space-y-2">
                  <Label htmlFor="pin">Code PIN (4 chiffres)</Label>
                  <div className="relative">
                    <KeyRound className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="pin"
                      type="password"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      maxLength={4}
                      placeholder="••••"
                      value={pin}
                      onChange={(e) => handlePinChange(e.target.value)}
                      disabled={submitting}
                      className="pl-9 font-mono tracking-[0.5em]"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Le PIN vous a été remis par le secrétariat de
                    l&apos;établissement.
                  </p>
                </div>

                {/* Bouton d'accès */}
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-amber-600 text-white hover:bg-amber-700"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Accès en cours…
                    </>
                  ) : (
                    <>
                      <LogIn className="size-4" />
                      Accéder à mon espace
                    </>
                  )}
                </Button>

                {/* Lien retour */}
                <button
                  type="button"
                  onClick={onBack}
                  className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-amber-700"
                >
                  <ArrowLeft className="size-3.5" />
                  Retour au choix d&apos;espace
                </button>
              </form>

              {/* Encart démo */}
              <button
                type="button"
                onClick={applyDemo}
                className="mt-5 flex w-full items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-left transition-colors hover:border-amber-300 hover:bg-amber-100/60 dark:border-amber-900/40 dark:bg-amber-950/20 dark:hover:bg-amber-950/30"
              >
                <Sparkles className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                    Démo — cliquez pour pré-remplir
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-amber-800/90 dark:text-amber-300/90">
                    Téléphone = {DEMO_TELEPHONE}
                    <br />
                    PIN = {DEMO_PIN}
                  </p>
                </div>
              </button>

              {/* Note sécurité */}
              <p className="mt-4 flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="mt-px size-3 shrink-0 text-emerald-600" />
                Votre session parent est valable 2 heures et limitée à la
                consultation de vos enfants et au paiement en ligne. Aucun accès
                au back-office du personnel.
              </p>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} ScolaGest · Freelance Technologies
            Côte d&apos;Ivoire
          </p>
        </div>
      </div>
    </div>
  );
}
