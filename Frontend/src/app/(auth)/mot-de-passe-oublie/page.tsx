"use client";

/**
 * ScolaGest — Page "Mot de passe oublié" (staff, route `/mot-de-passe-oublie`).
 *
 * L'utilisateur saisit son email. Le backend génère un token de reset et
 * retourne un reset_url (mode démo, affiché à l'écran car pas de SMTP).
 * En production (avec SMTP), le lien serait envoyé par email et non affiché.
 */

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  KeyRound,
} from "lucide-react";

import { requestPasswordReset } from "@/lib/api-password-reset";
import { ApiError } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function MotDePasseOubliePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = React.useState("");

  const mutation = useMutation({
    mutationFn: (e: string) => requestPasswordReset(e),
    onSuccess: (data) => {
      toast({
        title: "Demande envoyée",
        description: data.reset_url
          ? "Lien de réinitialisation généré (mode démo)."
          : `Un email a été envoyé à ${data.email} si ce compte existe.`,
      });
    },
    onError: (err) => {
      toast({
        title: "Échec",
        description:
          err instanceof ApiError ? err.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    },
  });

  const result = mutation.data;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    mutation.mutate(email.trim());
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-emerald-50 via-background to-amber-50 p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-emerald-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-amber-200/30 blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="border-emerald-100 shadow-xl">
          <CardContent className="space-y-5 p-6 sm:p-8">
            {/* En-tête */}
            <div className="space-y-2 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <KeyRound className="size-7" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">
                Mot de passe oublié
              </h1>
              <p className="text-sm text-muted-foreground">
                Saisissez votre adresse email. Un lien de réinitialisation sera
                généré.
              </p>
            </div>

            {/* Formulaire */}
            {!result?.sent && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium">
                    Email professionnel
                  </Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vous@etablissement.ci"
                      className="pl-8"
                      required
                      disabled={mutation.isPending}
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  disabled={mutation.isPending || !email.trim()}
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Envoi en cours…
                    </>
                  ) : (
                    "Envoyer le lien"
                  )}
                </Button>
              </form>
            )}

            {/* Résultat */}
            {result?.sent && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="flex flex-col items-center gap-2 text-center">
                  <CheckCircle2 className="size-12 text-emerald-600" />
                  <p className="text-sm font-medium">
                    Demande traitée
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {result.reset_url
                      ? `Un lien de réinitialisation a été généré pour ${result.email}.`
                      : `Si un compte existe pour ${result.email}, un email lui a été envoyé.`}
                  </p>
                </div>

                {/* Mode démo : afficher le lien directement */}
                {result.reset_url && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-900/50 dark:bg-amber-950/20">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                      <AlertCircle className="size-3.5" />
                      Mode démo (pas d&apos;SMTP configuré)
                    </p>
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      Le lien de réinitialisation est affiché ci-dessous. En
                      production, il serait envoyé par email.
                    </p>
                    <Button
                      asChild
                      variant="outline"
                      size="sm"
                      className="mt-2 w-full border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300"
                    >
                      <Link href={result.reset_url}>
                        <ExternalLink className="size-3.5" />
                        Ouvrir le lien de réinitialisation
                      </Link>
                    </Button>
                  </div>
                )}

                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => router.push("/login")}
                >
                  <ArrowLeft className="size-4" />
                  Retour à la connexion
                </Button>
              </motion.div>
            )}

            {/* Lien retour (formulaire) */}
            {!result?.sent && (
              <div className="text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push("/login")}
                >
                  <ArrowLeft className="size-3.5" />
                  Retour à la connexion
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
