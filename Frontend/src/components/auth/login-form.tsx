"use client";

/**
 * ScolaGest — Formulaire de connexion Staff (refonte Forêt EdTech).
 *
 * Layout : panneau branding animé à gauche + formulaire glass à droite.
 *
 * Refonte Forêt EdTech (aligné sur le login /parent) :
 *  - Gradient emerald→amber en fond d'écran + texture kente subtile (opacity 6%).
 *  - Hero engageant : titre « Connexion » + sous-titre rassurant dans une
 *    GlassCard premium (bordure gold + KentePattern bg).
 *  - Formulaire glassmorphism : GlassCard desktop + champs avec icônes
 *    (Mail pour email, Lock pour mot de passe, Building2 pour établissement)
 *    + focus ring emerald + validation en temps réel.
 *  - Bouton « Se connecter » variant premium (gradient emerald, CTA fort) +
 *    animation pulse subtile.
 *
 * Animations : Framer Motion (entrée staggerée, orbes flottants en boucle,
 * micro-interactions whileHover / whileFocus / whileTap, AnimatePresence pour
 * la bascule du panneau démo + l'icône œil show/hide password).
 *
 * Palette STAFF = EMERALD (distincte du parent amber) : dégradé
 * `from-emerald-600 to-emerald-700`. L'amber est conservé pour le panneau
 * démo (cohérent avec le parent).
 */

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Loader2,
  LogIn,
  Eye,
  EyeOff,
  Building2,
  ShieldAlert,
  KeyRound,
  ChevronDown,
  ArrowLeft,
  GraduationCap,
  Wallet,
  Smartphone,
  ShieldCheck,
  Sparkles,
  Mail,
  Lock,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";

const DEMO_ACCOUNTS = [
  { role: "Super Admin", email: "admin@scolagest.ci", password: "admin123" },
  { role: "Caissier", email: "caissier@scolagest.ci", password: "caissier123" },
  { role: "Comptable", email: "comptable@scolagest.ci", password: "comptable123" },
  { role: "Direction", email: "direction@scolagest.ci", password: "direction123" },
  { role: "Secrétariat", email: "secretariat@scolagest.ci", password: "secretariat123" },
  { role: "Éducateur", email: "educateur@scolagest.ci", password: "educateur123" },
  { role: "Enseignant (Maths)", email: "ykouadio@chandelier.ci", password: "enseignant123" },
  { role: "Enseignant (Français)", email: "atraore@chandelier.ci", password: "enseignant123" },
];

const BRAND_FEATURES = [
  { icon: GraduationCap, label: "Gestion des élèves" },
  { icon: Wallet, label: "Caisse scolaire" },
  { icon: Smartphone, label: "Mobile Money" },
  { icon: ShieldCheck, label: "Multi-sites sécurisé" },
];

// ===== Animations Framer Motion (typées explicitement) =====
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

/** Helper : orbe flottant en boucle infinie (y/x oscillent sur 6 s). */
const floatingOrb = (delay: number) => ({
  animate: {
    y: [0, -20, 0],
    x: [0, 10, 0],
    transition: { duration: 6, repeat: Infinity, delay, ease: "easeInOut" as const },
  },
});

/** Animation pulse subtile pour le bouton « Se connecter ». */
const pulseAnimation = {
  boxShadow: [
    "0 10px 25px -5px rgba(5, 150, 105, 0.30)",
    "0 10px 35px -3px rgba(5, 150, 105, 0.55)",
    "0 10px 25px -5px rgba(5, 150, 105, 0.30)",
  ],
  transition: {
    duration: 2.2,
    repeat: Infinity,
    ease: "easeInOut" as const,
  },
};

export function LoginForm({ onBack }: { onBack?: () => void }) {
  const { toast } = useToast();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [etablissementId, setEtablissementId] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [etablissements, setEtablissements] = useState<Etablissement[]>([]);
  const [loadingEtablissements, setLoadingEtablissements] = useState(true);
  const [demoOpen, setDemoOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGet<Etablissement[]>("/api/etablissements", { skipAuth: true });
        if (!cancelled) setEtablissements(data || []);
      } catch {
        // Silencieux
      } finally {
        if (!cancelled) setLoadingEtablissements(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Validation en temps réel : email format + mot de passe non vide. */
  const isEmailValid =
    email.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const isPasswordValid = password.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "Champs requis",
        description:
          "Veuillez renseigner votre email et votre mot de passe.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      // "none" = SUPER_ADMIN (rôle plateforme, pas d'établissement).
      // "all"  = pas d'établissement choisi (rôle global, ex. direction
      //           multi-sites) — converti en null pour l'API.
      // Sinon  = un établissement spécifique (staff standard).
      const etabId =
        etablissementId === "none" || etablissementId === "all"
          ? null
          : etablissementId || null;
      await login(email, password, etabId);
      toast({ title: "Connexion réussie", description: "Bienvenue sur ScolaGest." });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.status === 401
            ? "Identifiants invalides."
            : err.message
          : "Une erreur est survenue.";
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
    <div className="relative flex min-h-screen w-full overflow-hidden bg-gray-50">
      {/* Texture kente subtile en fond */}
      <KentePattern variant="bg" className="opacity-[0.06]" />

      {/* ===== Panneau gauche : Branding animé ===== */}
      <div className="relative hidden lg:flex lg:w-1/2 xl:w-[55%]">
        {/* Fond dégradé animé */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-900" />

        {/* Orbes flottants (glassmorphism) */}
        <motion.div
          aria-hidden
          className="absolute -left-20 top-10 size-72 rounded-full bg-white/10 backdrop-blur-xl"
          {...floatingOrb(0)}
        />
        <motion.div
          aria-hidden
          className="absolute right-10 top-1/3 size-96 rounded-full bg-amber-400/15 backdrop-blur-xl"
          {...floatingOrb(1.5)}
        />
        <motion.div
          aria-hidden
          className="absolute bottom-10 left-1/3 size-64 rounded-full bg-white/5 backdrop-blur-xl"
          {...floatingOrb(0.8)}
        />

        {/* Grille de points subtile */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Contenu branding */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 flex flex-col justify-between p-8 lg:p-10 xl:p-14"
        >
          {/* Logo + titre */}
          <div>
            <motion.div variants={itemVariants} className="flex items-center gap-3">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md ring-1 ring-white/20">
                <Image
                  src="/logo.png"
                  alt="ScolaGest"
                  width={36}
                  height={36}
                  className="rounded-xl"
                  priority
                />
              </div>
              <div>
                <h1 className="font-display text-2xl font-bold text-white">ScolaGest</h1>
                <p className="text-sm text-emerald-100">Gestion & Caisse Scolaire</p>
              </div>
            </motion.div>
          </div>

          {/* Slogan central */}
          <div className="my-12">
            <motion.h2
              variants={itemVariants}
              className="font-display text-3xl font-bold leading-tight text-white lg:text-4xl xl:text-5xl"
            >
              Digitalisez votre{" "}
              <span className="bg-gradient-to-r from-amber-300 to-amber-100 bg-clip-text text-transparent">
                caisse scolaire
              </span>
            </motion.h2>
            <motion.p
              variants={itemVariants}
              className="mt-4 max-w-md break-words text-lg leading-snug text-emerald-100/90"
            >
              De l&apos;inscription au solde de scolarité. Encaissez, suivez,
              imprimez vos reçus — adapté au contexte ivoirien.
            </motion.p>

            {/* Features animées */}
            <motion.div
              variants={itemVariants}
              className="mt-8 grid grid-cols-2 gap-3"
            >
              {BRAND_FEATURES.map((feat) => {
                const Icon = feat.icon;
                return (
                  <motion.div
                    key={feat.label}
                    whileHover={{ scale: 1.05, y: -2 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    className="flex items-center gap-2.5 rounded-xl bg-white/10 px-4 py-3 ring-1 ring-gold/20 backdrop-blur-md"
                  >
                    <Icon className="size-5 text-amber-300" />
                    <span className="break-words text-sm font-medium text-white">
                      {feat.label}
                    </span>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>

          {/* Badge bas */}
          <motion.div
            variants={itemVariants}
            className="flex items-center gap-3 text-emerald-100/70"
          >
            <Sparkles className="size-4 text-amber-300" />
            <span className="break-words text-sm">
              Conçu pour les établissements africains · FCFA · Mobile Money
            </span>
          </motion.div>
        </motion.div>
      </div>

      {/* ===== Panneau droit : Formulaire (glassmorphism) ===== */}
      <div className="relative flex w-full items-center justify-center p-6 lg:w-1/2 lg:pt-6 xl:w-[45%]">
        {/* Décorations d'arrière-plan */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 right-0 size-72 rounded-full bg-emerald-200/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 -left-10 size-72 rounded-full bg-amber-200/25 blur-3xl"
        />

        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.15 }}
          className="relative z-10 w-full max-w-md"
        >
          {/* En-tête mobile compact (caché sur desktop où le branding prend le relais) */}
          <div className="mb-3 flex flex-col items-center text-center lg:hidden">
            <Image
              src="/logo.png"
              alt="ScolaGest"
              width={52}
              height={52}
              className="rounded-xl bg-white p-1 shadow-lg shadow-emerald-600/20 ring-1 ring-gold/40"
              priority
            />
            <h1 className="mt-2 font-display text-lg font-bold">ScolaGest</h1>
            <p className="text-xs text-muted-foreground">Espace Staff</p>
          </div>

          {/* Carte glass premium (refonte Forêt EdTech) */}
          <GlassCard
            variant="desktop"
            premiumBorder
            className="relative overflow-hidden !p-8"
          >
            {/* Texture kente subtile en fond de carte */}
            <KentePattern variant="bg" className="opacity-[0.05]" />

            {/* Hero engageant : titre + sous-titre rassurant */}
            <div className="relative mb-4 sm:mb-6">
              <div className="mb-2 flex items-center gap-2 sm:mb-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-md shadow-emerald-900/20 sm:size-10">
                  <UserRound className="size-5" />
                </span>
                <div className="flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                  <Sparkles className="size-3" />
                  Espace Staff
                </div>
              </div>
              <h2 className="font-display text-xl font-bold text-forest sm:text-2xl">
                Connexion
              </h2>
              <p className="mt-1 break-words text-sm leading-snug text-muted-foreground sm:mt-1.5">
                Accédez à votre espace de gestion.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="relative space-y-4 sm:space-y-5">
              {/* Email — icône Mail + focus ring emerald */}
              <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                <Label
                  htmlFor="email"
                  className="flex items-center gap-1.5 text-sm font-medium text-foreground"
                >
                  <Mail className="size-3.5 text-emerald-600" />
                  Email
                </Label>
                <motion.div
                  whileFocus={{ scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <div className="relative">
                    <Mail
                      className={cn(
                        "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 transition-colors",
                        isEmailValid ? "text-emerald-600" : "text-muted-foreground",
                      )}
                    />
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      placeholder="vous@etablissement.ci"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={submitting}
                      className={cn(
                        "h-11 border-2 bg-white/70 pl-10 backdrop-blur-sm transition-colors",
                        "focus:border-emerald-500 focus:bg-white focus-visible:ring-emerald-500/30",
                        isEmailValid
                          ? "border-emerald-400"
                          : "border-muted-foreground/20",
                      )}
                      required
                    />
                    {isEmailValid ? (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600">
                        <ShieldCheck className="size-4" />
                      </span>
                    ) : null}
                  </div>
                </motion.div>
              </motion.div>

              {/* Mot de passe — icône Lock + focus ring emerald + toggle œil */}
              <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                <Label
                  htmlFor="password"
                  className="flex items-center gap-1.5 text-sm font-medium text-foreground"
                >
                  <Lock className="size-3.5 text-emerald-600" />
                  Mot de passe
                </Label>
                <motion.div
                  whileFocus={{ scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <div className="relative">
                    <Lock
                      className={cn(
                        "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 transition-colors",
                        isPasswordValid
                          ? "text-emerald-600"
                          : "text-muted-foreground",
                      )}
                    />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={submitting}
                      className={cn(
                        "h-11 border-2 bg-white/70 px-10 backdrop-blur-sm transition-colors",
                        "focus:border-emerald-500 focus:bg-white focus-visible:ring-emerald-500/30",
                        isPasswordValid
                          ? "border-emerald-400"
                          : "border-muted-foreground/20",
                      )}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-emerald-600 transition-colors"
                      aria-label={showPassword ? "Masquer" : "Afficher"}
                      tabIndex={-1}
                    >
                      <AnimatePresence mode="wait">
                        {showPassword ? (
                          <motion.span
                            key="hide"
                            initial={{ opacity: 0, rotate: -90 }}
                            animate={{ opacity: 1, rotate: 0 }}
                            exit={{ opacity: 0, rotate: 90 }}
                          >
                            <EyeOff className="size-4" />
                          </motion.span>
                        ) : (
                          <motion.span
                            key="show"
                            initial={{ opacity: 0, rotate: -90 }}
                            animate={{ opacity: 1, rotate: 0 }}
                            exit={{ opacity: 0, rotate: 90 }}
                          >
                            <Eye className="size-4" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </button>
                  </div>
                </motion.div>
              </motion.div>

              {/* Établissement — icône Building2 + focus ring emerald */}
              <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                <Label
                  htmlFor="etablissement"
                  className="flex items-center gap-1.5 text-sm font-medium text-foreground"
                >
                  <Building2 className="size-3.5 text-emerald-600" />
                  Établissement
                </Label>
                <Select
                  value={etablissementId}
                  onValueChange={setEtablissementId}
                  disabled={submitting || loadingEtablissements}
                >
                  <SelectTrigger
                    id="etablissement"
                    className="h-11 border-2 border-muted-foreground/20 bg-white/70 backdrop-blur-sm focus:border-emerald-500 focus:ring-emerald-500/30"
                  >
                    <Building2 className="size-4 text-muted-foreground" />
                    <SelectValue
                      placeholder={
                        loadingEtablissements ? "Chargement…" : "Sélectionnez…"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Option pour le SUPER_ADMIN (rôle plateforme, pas d'établissement). */}
                    <SelectItem value="none">
                      Aucun — Super Admin (plateforme)
                    </SelectItem>
                    {etablissements.map((etab) => (
                      <SelectItem key={etab.id} value={etab.id}>
                        {etab.nom}
                        {etab.ville ? ` — ${etab.ville}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="break-words text-[11px] leading-snug text-muted-foreground">
                  Sélectionnez votre établissement, ou « Aucun — Super Admin »
                  pour un accès plateforme.
                </p>
              </motion.div>

              {/* Bouton « Se connecter » — gradient emerald + pulse subtil */}
              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={{ scale: submitting ? 1 : 1.02 }}
                whileTap={{ scale: submitting ? 1 : 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                animate={!submitting ? pulseAnimation : {}}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition-all hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-60"
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
              </motion.button>

              {/* Lien "Mot de passe oublié" */}
              <div className="text-center">
                <Link
                  href="/mot-de-passe-oublie"
                  className="text-xs text-muted-foreground transition-colors hover:text-emerald-700 hover:underline"
                >
                  Mot de passe oublié ?
                </Link>
              </div>

              {/* Bouton « Espace Parent » — retour au choix d'espace */}
              {onBack ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={onBack}
                  className="w-full border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900 dark:border-amber-800 dark:text-amber-200 dark:hover:bg-amber-950/30"
                  title="Retour à la page de choix d'espace"
                >
                  <ArrowLeft className="size-4" />
                  Espace Parent
                </Button>
              ) : null}
            </form>

            {/* Identifiants de démo (bascule via Collapsible) */}
            <Collapsible
              open={demoOpen}
              onOpenChange={setDemoOpen}
              className="relative mt-4 sm:mt-6 rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 backdrop-blur-sm"
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
                  <motion.div
                    animate={{ rotate: demoOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="size-4 text-amber-700" />
                  </motion.div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-1.5">
                <p className="break-words text-[11px] leading-snug text-amber-800/80">
                  Cliquez sur un compte pour pré-remplir le formulaire.
                </p>
                <div className="grid gap-1.5">
                  {DEMO_ACCOUNTS.map((acc) => (
                    <motion.button
                      key={acc.email}
                      type="button"
                      whileHover={{ x: 4 }}
                      transition={{ type: "spring", stiffness: 400 }}
                      onClick={() => applyDemoAccount(acc.email, acc.password)}
                      className="group flex items-center justify-between rounded-lg border border-amber-200 bg-white/80 px-3 py-1.5 text-left text-xs hover:border-emerald-300 hover:bg-emerald-50/80 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-emerald-300 text-emerald-700 text-[10px]"
                        >
                          {acc.role}
                        </Badge>
                        <span className="font-mono text-[11px] text-gray-700">
                          {acc.email}
                        </span>
                      </span>
                      <span className="font-mono text-[11px] text-gray-400 group-hover:text-emerald-600">
                        {acc.password}
                      </span>
                    </motion.button>
                  ))}
                </div>
                <p className="flex items-start gap-1.5 pt-1 text-[10px] text-amber-800/70">
                  <ShieldAlert className="mt-px size-3 shrink-0" />
                  Comptes de test — à supprimer avant la mise en production.
                </p>
              </CollapsibleContent>
            </Collapsible>

            {/* Note de sécurité (emerald) */}
            <p className="relative mt-3 sm:mt-4 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3 shrink-0 text-emerald-600" />
              Votre session staff est protégée par JWT + RBAC. Les actions
              sensibles sont journalisées dans le journal d&apos;audit.
            </p>
          </GlassCard>

          <p className="mt-4 sm:mt-6 break-words text-center text-[10px] leading-relaxed text-muted-foreground sm:text-[11px]">
            © 2026 ScolaGest. Développé par Freelance Technologies Côte
            d&apos;Ivoire. Tous droits réservés.
          </p>
        </motion.div>
      </div>
    </div>
  );
}
