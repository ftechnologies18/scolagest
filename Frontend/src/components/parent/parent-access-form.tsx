"use client";

/**
 * ScolaGest — Formulaire d'accès Parent (refonte Forêt EdTech).
 *
 * Layout : panneau branding animé à DROITE + formulaire glass à GAUCHE
 * (miroir du login staff qui a branding à gauche / form à droite, afin de
 * distinguer visuellement les deux espaces).
 *
 * Refonte Forêt EdTech :
 *  - KentePattern strip top + gradient emerald→amber en haut de l'écran.
 *  - Hero engageant : titre « Accédez au portail familial » + sous-titre
 *    rassurant dans une GlassCard premium (bordure gold + KentePattern bg).
 *  - Formulaire glassmorphism : GlassCard desktop + champs avec icônes
 *    (Phone pour téléphone, KeyRound pour PIN) + focus ring emerald +
 *    validation en temps réel.
 *  - Bouton « Se connecter » variant premium (gradient amber, CTA fort) +
 *    animation pulse subtile.
 *  - Bouton « Espace Staff » (variant outline) pour retour.
 *
 * Animations : Framer Motion (entrée staggerée, orbes flottants en boucle,
 * micro-interactions whileHover / whileFocus / whileTap, AnimatePresence pour
 * la bascule du panneau démo).
 *
 * Palette PARENT = AMBER (distincte du staff emerald) : dégradé
 * `from-amber-500 via-amber-600 to-orange-700`. L'emerald est conservé pour la
 * note de sécurité (cohérent avec le reste de l'app).
 *
 * Logique métier préservée : les parents n'ont pas de compte staff ; ils
 * accèdent au portail via **numéro de téléphone + code PIN à 4 chiffres**.
 * Le bouton « Accéder à mon espace » appelle `loginParent(telephone, pin)` du
 * `auth-store`, qui hit `POST /api/parent/access` (endpoint public). Le backend
 * renvoie un `access_token` temporaire (2 h, scoped `/api/parent/*`) et les
 * infos du tuteur. Au succès, le `auth-store` met à jour
 * `isParentAuthenticated` ; `page.tsx` bascule vers `<ParentPortal />`.
 *
 * Sur erreur 401, on affiche un toast « Numéro de téléphone ou PIN incorrect ».
 */

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  Loader2,
  LogIn,
  ArrowLeft,
  Phone,
  KeyRound,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  GraduationCap,
  Wallet,
  ReceiptText,
  Smartphone,
  Download,
  UserRound,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
// PWA parent : enregistrement du service worker + prompt d'installation.
import { useParentPWA, useParentInstallPrompt } from "@/hooks/use-parent-pwa";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/lib/auth-store";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ds/glass-card";
import { KentePattern } from "@/components/ds/kente-pattern";

const DEMO_TELEPHONE = "+2250701020304";
const DEMO_PIN = "1234";

/** Features du panneau branding (4 cartes icônes). */
const PARENT_FEATURES = [
  { icon: GraduationCap, label: "Vos enfants" },
  { icon: Wallet, label: "Soldes & échéances" },
  { icon: ReceiptText, label: "Reçus PDF" },
  { icon: Smartphone, label: "Paiement Mobile Money" },
] as const;

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
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 300, damping: 24 },
  },
};

/** Helper : orbe flottant en boucle infinie (y/x oscillent sur 6 s). */
const floatingOrb = (delay: number) => ({
  animate: {
    y: [0, -20, 0],
    x: [0, 10, 0],
    transition: {
      duration: 6,
      repeat: Infinity,
      delay,
      ease: "easeInOut" as const,
    },
  },
});

/** Animation pulse subtile pour le bouton « Se connecter ». */
const pulseAnimation = {
  boxShadow: [
    "0 10px 25px -5px rgba(217, 119, 6, 0.30)",
    "0 10px 35px -3px rgba(217, 119, 6, 0.55)",
    "0 10px 25px -5px rgba(217, 119, 6, 0.30)",
  ],
  transition: {
    duration: 2.2,
    repeat: Infinity,
    ease: "easeInOut" as const,
  },
};

export interface ParentAccessFormProps {
  /** Retour à la page de choix (Espace staff / Espace parent). */
  onBack: () => void;
}

export function ParentAccessForm({ onBack }: ParentAccessFormProps) {
  const { toast } = useToast();
  const loginParent = useAuthStore((s) => s.loginParent);

  // PWA — enregistre le service worker parent (offline + cache API).
  // Capture aussi l'événement `beforeinstallprompt` pour afficher un bouton
  // « Installer l'app » (Chrome/Edge/Android uniquement — iOS Safari ne
  // déclenche jamais cet événement, le bouton reste caché).
  useParentPWA();
  const { canInstall, promptInstall } = useParentInstallPrompt();
  const [installing, setInstalling] = useState(false);

  const [telephone, setTelephone] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

  /** Déclenche l'installation native de la PWA (Chrome/Edge/Android). */
  async function handleInstall() {
    setInstalling(true);
    try {
      const accepted = await promptInstall();
      if (accepted) {
        toast({
          title: "Application installée",
          description:
            "ScolaGest Parent est maintenant sur votre écran d'accueil.",
        });
      }
    } finally {
      setInstalling(false);
    }
  }

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

  /** Validation en temps réel : téléphone >= 8 chiffres après normalisation. */
  const telClean = normalizePhone(telephone);
  const isTelValid = telClean.length >= 8;
  const isPinValid = pin.length === 4;

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
    <div className="relative flex min-h-screen w-full overflow-hidden bg-gradient-to-br from-emerald-50/50 via-amber-50 to-orange-50">
      {/* KentePattern strip top (motif kente enrichi).
          `!fixed` obligatoire : .kente-strip-top { position: relative } dans
          globals.css (CSS non-layeré) override l'utilitaire `fixed` (layered).
          Sans `!`, le strip reste dans le flux flex et écrase les panneaux. */}
      <KentePattern
        variant="strip"
        position="top"
        className="!h-10 !fixed top-0 left-0 right-0 z-50"
      />

      {/* Texture kente subtile en fond */}
      <KentePattern variant="bg" className="opacity-[0.06]" />

      {/* ===== Panneau gauche : Formulaire (glassmorphism) ===== */}
      <div className="relative flex w-full items-center justify-center p-4 pt-14 sm:p-6 sm:pt-16 lg:w-1/2 lg:pt-6 xl:w-[45%]">
        {/* Décorations d'arrière-plan */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -left-10 size-72 rounded-full bg-amber-200/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 size-72 rounded-full bg-emerald-200/30 blur-3xl"
        />

        <motion.div
          initial={{ opacity: 0, x: -30 }}
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
              className="rounded-xl bg-white p-1 shadow-lg shadow-amber-600/20 ring-1 ring-gold/40"
              priority
            />
            <h1 className="mt-2 font-display text-lg font-bold">ScolaGest</h1>
            <p className="text-xs text-muted-foreground">Espace Parent</p>
          </div>

          {/* Carte glass premium (refonte Forêt EdTech) */}
          <GlassCard
            variant="desktop"
            premiumBorder
            className="relative overflow-hidden !p-6 sm:!p-8"
          >
            {/* Texture kente subtile en fond de carte */}
            <KentePattern variant="bg" className="opacity-[0.05]" />

            {/* Hero engageant : titre + sous-titre rassurant */}
            <div className="relative mb-4 sm:mb-6">
              <div className="mb-2 flex items-center gap-2 sm:mb-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-amber-500 text-white shadow-md shadow-emerald-900/20 sm:size-10">
                  <UserRound className="size-5" />
                </span>
                <div className="flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  <Sparkles className="size-3" />
                  Portail familial
                </div>
              </div>
              <h2 className="font-display text-xl font-bold text-forest sm:text-2xl">
                Accédez au portail familial
              </h2>
              <p className="mt-1 break-words text-sm leading-snug text-muted-foreground sm:mt-1.5">
                Suivez la scolarité de vos enfants, consultez les soldes et
                réglez en ligne — en toute simplicité.
              </p>
            </div>

            {/* Bandeau d'installation PWA (uniquement si `beforeinstallprompt`
                capturé — Chrome/Edge/Android. Caché sur iOS Safari). */}
            {canInstall ? (
              <motion.button
                type="button"
                onClick={handleInstall}
                disabled={installing}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                whileHover={{ scale: installing ? 1 : 1.01 }}
                whileTap={{ scale: installing ? 1 : 0.99 }}
                className="relative mb-5 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2 text-xs font-semibold text-amber-800 shadow-sm transition-colors hover:from-amber-100 hover:to-orange-100 disabled:opacity-60"
              >
                {installing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                {installing ? "Installation…" : "Installer l'application"}
              </motion.button>
            ) : null}

            <form onSubmit={handleSubmit} className="relative space-y-4 sm:space-y-5">
              {/* Téléphone — icône Phone + focus ring emerald */}
              <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                <Label
                  htmlFor="telephone"
                  className="flex items-center gap-1.5 text-sm font-medium text-foreground"
                >
                  <Phone className="size-3.5 text-emerald-600" />
                  Numéro de téléphone
                </Label>
                <motion.div
                  whileFocus={{ scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <div className="relative">
                    <Phone
                      className={cn(
                        "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 transition-colors",
                        isTelValid
                          ? "text-emerald-600"
                          : "text-muted-foreground",
                      )}
                    />
                    <Input
                      id="telephone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="+225 0701020304"
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      disabled={submitting}
                      className={cn(
                        "h-11 border-2 bg-white/70 pl-10 font-mono text-base backdrop-blur-sm transition-colors",
                        "focus:border-emerald-500 focus:bg-white focus-visible:ring-emerald-500/30",
                        isTelValid && telephone.length > 0
                          ? "border-emerald-400"
                          : "border-muted-foreground/20",
                      )}
                      required
                    />
                    {isTelValid && telephone.length > 0 ? (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600">
                        <ShieldCheck className="size-4" />
                      </span>
                    ) : null}
                  </div>
                </motion.div>
                <p className="break-words text-[11px] leading-snug text-muted-foreground">
                  Indicatif Côte d&apos;Ivoire{" "}
                  <span className="font-mono">+225</span> — ajouté automatiquement
                  si omis.
                </p>
              </motion.div>

              {/* PIN — InputOTP 4 cases (UX premium) + icône KeyRound */}
              <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                <Label
                  htmlFor="pin"
                  className="flex items-center gap-1.5 text-sm font-medium text-foreground"
                >
                  <KeyRound className="size-3.5 text-emerald-600" />
                  Code PIN (4 chiffres)
                </Label>
                <motion.div
                  whileFocus={{ scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 400 }}
                  className="flex justify-center"
                >
                  <InputOTP
                    id="pin"
                    maxLength={4}
                    value={pin}
                    onChange={(v) => handlePinChange(v)}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    disabled={submitting}
                    aria-label="Code PIN à 4 chiffres"
                    containerClassName="justify-center"
                  >
                    <InputOTPGroup>
                      <InputOTPSlot
                        index={0}
                        className={cn(
                          "size-12 text-lg",
                          isPinValid && pin.length === 4
                            ? "border-emerald-500 ring-2 ring-emerald-500/20"
                            : "",
                        )}
                      />
                      <InputOTPSlot
                        index={1}
                        className={cn(
                          "size-12 text-lg",
                          isPinValid && pin.length === 4
                            ? "border-emerald-500 ring-2 ring-emerald-500/20"
                            : "",
                        )}
                      />
                      <InputOTPSlot
                        index={2}
                        className={cn(
                          "size-12 text-lg",
                          isPinValid && pin.length === 4
                            ? "border-emerald-500 ring-2 ring-emerald-500/20"
                            : "",
                        )}
                      />
                      <InputOTPSlot
                        index={3}
                        className={cn(
                          "size-12 text-lg",
                          isPinValid && pin.length === 4
                            ? "border-emerald-500 ring-2 ring-emerald-500/20"
                            : "",
                        )}
                      />
                    </InputOTPGroup>
                  </InputOTP>
                </motion.div>
                <p className="break-words text-[11px] leading-snug text-muted-foreground">
                  Le PIN vous a été remis par le secrétariat de
                  l&apos;établissement.
                </p>
              </motion.div>

              {/* Bouton « Se connecter » — variant premium (gradient amber)
                  + animation pulse subtile */}
              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={{ scale: submitting ? 1 : 1.02 }}
                whileTap={{ scale: submitting ? 1 : 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                animate={!submitting ? pulseAnimation : {}}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-amber-600/25 transition-all hover:from-amber-700 hover:to-orange-700 disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Accès en cours…
                  </>
                ) : (
                  <>
                    <LogIn className="size-4" />
                    Se connecter
                  </>
                )}
              </motion.button>

              {/* Lien "Code oublié" */}
              <div className="text-center">
                <Link
                  href="/code-oublie"
                  className="text-xs text-muted-foreground transition-colors hover:text-amber-700 hover:underline"
                >
                  Code PIN oublié ?
                </Link>
              </div>

              {/* Bouton « Espace Staff » — retour au choix d'espace */}
              <Button
                type="button"
                variant="outline"
                onClick={onBack}
                className="w-full border-emerald-300 text-emerald-800 hover:bg-emerald-50 hover:text-emerald-900 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/30"
                title="Retour à la page de choix d'espace"
              >
                <ArrowLeft className="size-4" />
                Espace Staff
              </Button>
            </form>

            {/* Panneau démo (bascule via AnimatePresence) */}
            <div className="relative mt-4 sm:mt-6 rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 backdrop-blur-sm">
              <button
                type="button"
                onClick={() => setDemoOpen((v) => !v)}
                aria-expanded={demoOpen}
                aria-controls="parent-demo-content"
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
              <AnimatePresence initial={false}>
                {demoOpen ? (
                  <motion.div
                    key="parent-demo-content"
                    id="parent-demo-content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" as const }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-2 pt-3">
                      <p className="break-words text-[11px] leading-snug text-amber-800/80">
                        Cliquez pour pré-remplir le formulaire.
                      </p>
                      <div className="break-all rounded-lg border border-amber-200 bg-white/80 p-2.5 font-mono text-[11px] leading-relaxed text-amber-900">
                        Téléphone = {DEMO_TELEPHONE}
                        <br />
                        PIN = {DEMO_PIN}
                      </div>
                      <motion.button
                        type="button"
                        whileHover={{ x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: "spring", stiffness: 400 }}
                        onClick={applyDemo}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100/80 px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-200/80"
                      >
                        <Sparkles className="size-3.5" />
                        Pré-remplir le formulaire
                      </motion.button>
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {/* Note de sécurité (emerald, cohérent avec l'existant) */}
            <p className="relative mt-3 sm:mt-4 flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
              <ShieldCheck className="mt-0.5 size-3 shrink-0 text-emerald-600" />
              Votre session parent est valable 2 heures et limitée à la
              consultation de vos enfants et au paiement en ligne. Aucun accès
              au back-office du personnel.
            </p>
          </GlassCard>

          <p className="mt-4 sm:mt-6 break-words text-center text-[10px] leading-relaxed text-muted-foreground sm:text-[11px]">
            © 2026 ScolaGest. Développé par Freelance Technologies Côte d&apos;Ivoire. Tous droits réservés.
          </p>
        </motion.div>
      </div>

      {/* ===== Panneau droit : Branding animé (glassmorphism) ===== */}
      <div className="relative hidden lg:flex lg:w-1/2 xl:w-[55%]">
        {/* Fond dégradé chaud (amber → orange) avec gradient emerald→amber en haut */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-700 via-amber-500 to-orange-700" />

        {/* Orbes flottants (glassmorphism) */}
        <motion.div
          aria-hidden
          className="absolute -right-20 top-10 size-72 rounded-full bg-white/10 backdrop-blur-xl"
          {...floatingOrb(0)}
        />
        <motion.div
          aria-hidden
          className="absolute left-10 top-1/3 size-96 rounded-full bg-amber-300/15 backdrop-blur-xl"
          {...floatingOrb(1.5)}
        />
        <motion.div
          aria-hidden
          className="absolute bottom-10 right-1/3 size-64 rounded-full bg-white/5 backdrop-blur-xl"
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
              <div className="flex size-14 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-gold/40 backdrop-blur-md">
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
                <p className="text-sm text-amber-100">Espace Parent</p>
              </div>
            </motion.div>
          </div>

          {/* Slogan central */}
          <div className="my-12">
            <motion.h2
              variants={itemVariants}
              className="font-display text-3xl font-bold leading-tight text-white lg:text-4xl xl:text-5xl"
            >
              Suivez la{" "}
              <span className="bg-gradient-to-r from-amber-300 to-amber-100 bg-clip-text text-transparent">
                scolarité
              </span>{" "}
              de vos enfants
            </motion.h2>
            <motion.p
              variants={itemVariants}
              className="mt-4 max-w-md break-words text-lg leading-snug text-amber-50/90"
            >
              Consultez les soldes, les échéances, l&apos;historique de
              paiements et téléchargez vos reçus — directement depuis votre
              téléphone.
            </motion.p>

            {/* Features animées */}
            <motion.div
              variants={itemVariants}
              className="mt-8 grid grid-cols-2 gap-3"
            >
              {PARENT_FEATURES.map((feat) => {
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
            className="flex items-center gap-3 text-amber-50/70"
          >
            <Sparkles className="size-4 text-amber-300" />
            <span className="break-words text-sm">
              Conçu pour les parents · FCFA · Côte d&apos;Ivoire
            </span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
