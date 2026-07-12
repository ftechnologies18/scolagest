"use client";

/**
 * ScolaGest — Page de réinitialisation de mot de passe (route `/reset-password`).
 *
 * Lit le token depuis l'URL (?token=XXX). L'utilisateur saisit un nouveau mot
 * de passe + confirmation. Le backend valide le token et met à jour le mdp.
 */

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Lock,
  Eye,
  EyeOff,
  XCircle,
} from "lucide-react";

import { confirmPasswordReset } from "@/lib/api-password-reset";
import { ApiError } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function ResetPasswordPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <ResetPasswordContent />
    </React.Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);

  const mutation = useMutation({
    mutationFn: ({
      t,
      pwd,
    }: {
      t: string;
      pwd: string;
    }) => confirmPasswordReset(t, pwd),
    onSuccess: () => {
      toast({
        title: "Mot de passe réinitialisé",
        description: "Vous pouvez vous connecter avec votre nouveau mot de passe.",
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

  const passwordsMatch = password === confirm;
  const passwordLongEnough = password.length >= 6;
  const canSubmit = !!token && passwordLongEnough && passwordsMatch && !mutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    mutation.mutate({ t: token, pwd: password });
  }

  // Pas de token
  if (!token) {
    return (
      <Shell>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <XCircle className="size-12 text-rose-500" />
            <p className="text-base font-semibold">Lien invalide</p>
            <p className="text-sm text-muted-foreground">
              Aucun token de réinitialisation dans l&apos;URL. Le lien est peut-être
              incomplet ou expiré.
            </p>
            <Button variant="outline" onClick={() => router.push("/mot-de-passe-oublie")}>
              Demander un nouveau lien
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  // Succès
  if (mutation.isSuccess) {
    return (
      <Shell>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="border-emerald-200">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="size-14 text-emerald-600" />
              <p className="text-lg font-bold">Mot de passe réinitialisé !</p>
              <p className="text-sm text-muted-foreground">
                Votre mot de passe a été mis à jour avec succès. Vous pouvez
                vous connecter avec vos nouveaux identifiants.
              </p>
              <Button
                className="mt-2 bg-emerald-600 hover:bg-emerald-700"
                onClick={() => router.push("/login")}
              >
                Se connecter
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </Shell>
    );
  }

  // Formulaire
  return (
    <Shell>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="border-emerald-100 shadow-xl">
          <CardContent className="space-y-5 p-6 sm:p-8">
            <div className="space-y-2 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                <Lock className="size-7" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">
                Nouveau mot de passe
              </h1>
              <p className="text-sm text-muted-foreground">
                Choisissez un nouveau mot de passe (6 caractères minimum).
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium">
                  Nouveau mot de passe
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-8 pr-10"
                    required
                    disabled={mutation.isPending}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {password.length > 0 && !passwordLongEnough && (
                  <p className="text-xs text-rose-500">
                    Le mot de passe doit faire au moins 6 caractères.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-sm font-medium">
                  Confirmer le mot de passe
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-8"
                    required
                    disabled={mutation.isPending}
                    placeholder="••••••••"
                  />
                </div>
                {confirm.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-rose-500">
                    Les mots de passe ne correspondent pas.
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                disabled={!canSubmit}
              >
                {mutation.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Réinitialisation…
                  </>
                ) : (
                  "Réinitialiser le mot de passe"
                )}
              </Button>
            </form>

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
          </CardContent>
        </Card>
      </motion.div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
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
      <div className="relative z-10 w-full max-w-md">{children}</div>
    </div>
  );
}
