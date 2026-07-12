"use client";

/**
 * ScolaGest — Page "Code oublié" (parent, route `/code-oublie`).
 *
 * Le parent saisit son numéro de téléphone + le nom (et prénoms) d'un de ses
 * enfants pour vérification d'identité. Si OK, le backend régénère un PIN à 4
 * chiffres et l'affiche à l'écran (mode démo, pas de SMS en prod).
 *
 * En production (avec passerelle SMS), le nouveau PIN serait envoyé par SMS
 * au numéro du parent et non affiché.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
  Phone,
  User,
  KeyRound,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";

import { resetParentPIN } from "@/lib/api-password-reset";
import { ApiError } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function CodeOubliePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [telephone, setTelephone] = React.useState("");
  const [eleveNom, setEleveNom] = React.useState("");
  const [elevePrenoms, setElevePrenoms] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      resetParentPIN({
        telephone,
        eleve_nom: eleveNom,
        eleve_prenoms: elevePrenoms || undefined,
      }),
    onSuccess: () => {
      toast({
        title: "Code régénéré",
        description: "Un nouveau code PIN a été généré.",
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
  const canSubmit =
    telephone.trim().length >= 8 &&
    eleveNom.trim().length >= 2 &&
    !mutation.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setCopied(false);
    mutation.mutate();
  }

  function copyPin() {
    if (result?.new_pin) {
      navigator.clipboard.writeText(result.new_pin);
      setCopied(true);
      toast({ title: "Code copié" });
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-amber-50 via-background to-emerald-50 p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-amber-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-emerald-200/30 blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="border-amber-100 shadow-xl">
          <CardContent className="space-y-5 p-6 sm:p-8">
            {/* En-tête */}
            <div className="space-y-2 text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                <KeyRound className="size-7" />
              </div>
              <h1 className="text-xl font-bold tracking-tight">Code oublié</h1>
              <p className="text-sm text-muted-foreground">
                Pour vérifier votre identité, saisissez votre numéro de téléphone
                et le nom d&apos;un de vos enfants inscrits.
              </p>
            </div>

            {/* Formulaire */}
            {!result?.sent && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="tel" className="text-sm font-medium">
                    Votre numéro de téléphone
                  </Label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="tel"
                      type="tel"
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      placeholder="07 07 07 07 07"
                      className="pl-8"
                      required
                      disabled={mutation.isPending}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="nom" className="text-sm font-medium">
                    Nom de l&apos;élève
                  </Label>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="nom"
                      value={eleveNom}
                      onChange={(e) => setEleveNom(e.target.value.toUpperCase())}
                      placeholder="KOUASSI"
                      className="pl-8"
                      required
                      disabled={mutation.isPending}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prenoms" className="text-sm font-medium">
                    Prénoms de l&apos;élève (optionnel)
                  </Label>
                  <Input
                    id="prenoms"
                    value={elevePrenoms}
                    onChange={(e) => setElevePrenoms(e.target.value)}
                    placeholder="Yann"
                    disabled={mutation.isPending}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                  disabled={!canSubmit}
                >
                  {mutation.isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Vérification…
                    </>
                  ) : (
                    "Régénérer mon code"
                  )}
                </Button>
              </form>
            )}

            {/* Résultat : nouveau PIN */}
            {result?.sent && result.new_pin && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-4"
              >
                <div className="flex flex-col items-center gap-2 text-center">
                  <CheckCircle2 className="size-12 text-emerald-600" />
                  <p className="text-sm font-medium">
                    Identité vérifiée ({result.telephone})
                  </p>
                </div>

                {/* Mode démo : afficher le PIN */}
                <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                    <AlertCircle className="size-3.5" />
                    Mode démo (pas de SMS configuré)
                  </p>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    Votre nouveau code PIN est affiché ci-dessous. En
                    production, il serait envoyé par SMS.
                  </p>

                  <div className="mt-3 flex items-center justify-center gap-3">
                    <div className="flex gap-1.5 rounded-lg border-2 border-amber-300 bg-white px-4 py-2 dark:bg-amber-950/40">
                      {result.new_pin.split("").map((d, i) => (
                        <span
                          key={i}
                          className="font-mono text-2xl font-bold text-amber-700 dark:text-amber-300"
                        >
                          {d}
                        </span>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={copyPin}
                      className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300"
                    >
                      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    </Button>
                  </div>
                </div>

                <Button
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={() => router.push("/parent")}
                >
                  Se connecter avec le nouveau code
                </Button>
              </motion.div>
            )}

            {/* Lien retour */}
            <div className="text-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/parent")}
              >
                <ArrowLeft className="size-3.5" />
                Retour à la connexion parent
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
