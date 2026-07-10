"use client";

/**
 * ScolaGest — Formulaire de connexion
 *
 * Carte centrée sur un fond dégradé (emerald + subtil amber, sans indigo/bleu).
 * Champs : email, mot de passe, sélecteur d'établissement (optionnel).
 * Au succès, le `auth-store` met à jour `isAuthenticated` et le parent
 * (`page.tsx`) bascule automatiquement vers le tableau de bord.
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Loader2,
  LogIn,
  Eye,
  EyeOff,
  Building2,
  ShieldAlert,
  KeyRound,
  ChevronDown,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore, type Etablissement } from "@/lib/auth-store";
import { apiGet, ApiError } from "@/lib/api-client";

const DEMO_ACCOUNTS = [
  { role: "Administrateur", email: "admin@scolagest.ci", password: "admin123" },
  { role: "Caissier", email: "caissier@scolagest.ci", password: "caissier123" },
  {
    role: "Comptable",
    email: "comptable@scolagest.ci",
    password: "comptable123",
  },
  { role: "Direction", email: "direction@scolagest.ci", password: "direction123" },
  { role: "Censeur", email: "censeur@scolagest.ci", password: "censeur123" },
  {
    role: "Secrétariat",
    email: "secretariat@scolagest.ci",
    password: "secretariat123",
  },
];

export function LoginForm() {
  const { toast } = useToast();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [etablissementId, setEtablissementId] = useState<string>("all");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [etablissements, setEtablissements] = useState<Etablissement[]>([]);
  const [loadingEtablissements, setLoadingEtablissements] = useState(true);
  const [demoOpen, setDemoOpen] = useState(false);

  // Chargement de la liste des établissements (endpoint public).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<Etablissement[]>(
          "/api/etablissements",
          { skipAuth: true },
        );
        if (!cancelled) {
          setEtablissements(data || []);
        }
      } catch {
        // Silencieux : le sélecteur reste désactivé avec un libellé par défaut.
      } finally {
        if (!cancelled) setLoadingEtablissements(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Champs requis",
        description: "Veuillez renseigner votre email et votre mot de passe.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const etabId = etablissementId === "all" ? null : etablissementId;
      await login(email, password, etabId);
      toast({
        title: "Connexion réussie",
        description: "Bienvenue sur ScolaGest.",
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 401
            ? "Identifiants invalides. Veuillez réessayer."
            : err.message
          : "Une erreur inattendue est survenue. Réessayez.";
      toast({
        title: "Échec de la connexion",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  }

  function applyDemoAccount(demoEmail: string, demoPassword: string) {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setDemoOpen(false);
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-emerald-50 via-background to-amber-50">
      {/* Décorations d'arrière-plan */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-emerald-200/40 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-24 size-96 rounded-full bg-amber-200/30 blur-3xl"
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
              className="rounded-2xl shadow-lg shadow-emerald-600/20"
              priority
            />
            <h1 className="mt-3 text-2xl font-bold tracking-tight">ScolaGest</h1>
            <p className="text-sm text-muted-foreground">
              Gestion &amp; Caisse Scolaire — Groupe Le Chandelier, Dabou
            </p>
          </div>

          <Card className="border-emerald-100 shadow-xl">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">Connexion</CardTitle>
              <CardDescription>
                Accédez à votre espace de gestion. Utilisez votre adresse
                professionnelle.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="vous@etablissement.ci"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Mot de passe</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submitting}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={
                        showPassword
                          ? "Masquer le mot de passe"
                          : "Afficher le mot de passe"
                      }
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="etablissement">Établissement</Label>
                  <Select
                    value={etablissementId}
                    onValueChange={setEtablissementId}
                    disabled={submitting || loadingEtablissements}
                  >
                    <SelectTrigger id="etablissement" className="w-full">
                      <Building2 className="size-4 text-muted-foreground" />
                      <SelectValue
                        placeholder={
                          loadingEtablissements
                            ? "Chargement…"
                            : "Tous établissements"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous établissements</SelectItem>
                      {etablissements.map((etab) => (
                        <SelectItem key={etab.id} value={etab.id}>
                          {etab.nom}
                          {etab.ville ? ` — ${etab.ville}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Optionnel — laissez « Tous établissements » pour utiliser
                    votre établissement principal.
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-emerald-600 text-white hover:bg-emerald-700"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Connexion en cours…
                    </>
                  ) : (
                    <>
                      <LogIn className="size-4" />
                      Se connecter
                    </>
                  )}
                </Button>
              </form>

              {/* Identifiants de démo */}
              <Collapsible
                open={demoOpen}
                onOpenChange={setDemoOpen}
                className="mt-5 rounded-lg border border-amber-200 bg-amber-50/60 p-3"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between text-left"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-amber-800">
                      <KeyRound className="size-4" />
                      Identifiants de démonstration
                    </span>
                    <ChevronDown
                      className={`size-4 text-amber-700 transition-transform ${
                        demoOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-1.5">
                  <p className="text-[11px] text-amber-800/80">
                    Cliquez sur un compte pour pré-remplir le formulaire.
                  </p>
                  <div className="grid gap-1.5">
                    {DEMO_ACCOUNTS.map((acc) => (
                      <button
                        key={acc.email}
                        type="button"
                        onClick={() =>
                          applyDemoAccount(acc.email, acc.password)
                        }
                        className="group flex items-center justify-between rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-left text-xs hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="border-emerald-300 text-emerald-700 text-[10px]"
                          >
                            {acc.role}
                          </Badge>
                          <span className="font-mono text-[11px] text-foreground">
                            {acc.email}
                          </span>
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground group-hover:text-emerald-700">
                          {acc.password}
                        </span>
                      </button>
                    ))}
                  </div>
                  <p className="flex items-start gap-1.5 pt-1 text-[10px] text-amber-800/70">
                    <ShieldAlert className="mt-px size-3 shrink-0" />
                    Comptes de test — à supprimer avant la mise en production.
                  </p>
                </CollapsibleContent>
              </Collapsible>
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
