"use client";

/**
 * ScolaGest — Formulaire d'accès Parent (refonte split-screen + glassmorphism).
 *
 * Layout : panneau branding animé à DROITE + formulaire glass à GAUCHE
 * (miroir du login staff qui a branding à gauche / form à droite, afin de
 * distinguer visuellement les deux espaces).
 *
 * Glassmorphism : carte formulaire en `bg-white/70 backdrop-blur-2xl` + orbes
 * flottants en `bg-white/10 backdrop-blur-xl` sur le panneau branding.
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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    <div className="relative flex min-h-screen w-full overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-gray-50">
      {/* ===== Panneau gauche : Formulaire (glassmorphism) ===== */}
      <div className="relative flex w-full items-center justify-center p-6 lg:w-1/2 xl:w-[45%]">
        {/* Décorations d'arrière-plan */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-20 -left-10 size-72 rounded-full bg-amber-200/40 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 right-0 size-72 rounded-full bg-orange-200/30 blur-3xl"
        />

        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26, delay: 0.15 }}
          className="relative z-10 w-full max-w-md"
        >
          {/* En-tête mobile compact (caché sur desktop où le branding prend le relais) */}
          <div className="mb-6 flex flex-col items-center text-center lg:hidden">
            <Image
              src="/logo.png"
              alt="ScolaGest"
              width={64}
              height={64}
              className="rounded-2xl shadow-lg shadow-amber-600/20"
              priority
            />
            <h1 className="mt-3 text-xl font-bold">ScolaGest</h1>
            <p className="text-sm text-muted-foreground">Espace Parent</p>
          </div>

          {/* Carte glass */}
          <motion.div
            whileHover={{ boxShadow: "0 25px 50px -12px rgba(217, 119, 6, 0.18)" }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-white/60 bg-white/70 p-8 shadow-xl backdrop-blur-2xl"
          >
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Espace Parent</h2>
              <p className="mt-1 text-sm text-gray-500">
                Accédez avec votre numéro de téléphone et votre code PIN.
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
                className="mb-5 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-2 text-xs font-semibold text-amber-800 shadow-sm transition-colors hover:from-amber-100 hover:to-orange-100 disabled:opacity-60"
              >
                {installing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Download className="size-3.5" />
                )}
                {installing ? "Installation…" : "Installer l'application"}
              </motion.button>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Téléphone */}
              <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                <Label htmlFor="telephone" className="text-sm font-medium text-gray-700">
                  Numéro de téléphone
                </Label>
                <motion.div
                  whileFocus={{ scale: 1.01 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      id="telephone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="+225 0701020304"
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      disabled={submitting}
                      className="border-gray-200 bg-white/60 pl-9 font-mono backdrop-blur-sm transition-colors focus:border-amber-400 focus:bg-white"
                      required
                    />
                  </div>
                </motion.div>
                <p className="text-[11px] text-gray-400">
                  Indicatif Côte d&apos;Ivoire{" "}
                  <span className="font-mono">+225</span> — ajouté automatiquement
                  si omis.
                </p>
              </motion.div>

              {/* PIN — InputOTP 4 cases (UX premium) */}
              <motion.div
                variants={itemVariants}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                <Label htmlFor="pin" className="text-sm font-medium text-gray-700">
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
                      <InputOTPSlot index={0} className="size-12 text-lg" />
                      <InputOTPSlot index={1} className="size-12 text-lg" />
                      <InputOTPSlot index={2} className="size-12 text-lg" />
                      <InputOTPSlot index={3} className="size-12 text-lg" />
                    </InputOTPGroup>
                  </InputOTP>
                </motion.div>
                <p className="text-[11px] text-gray-400">
                  Le PIN vous a été remis par le secrétariat de
                  l&apos;établissement.
                </p>
              </motion.div>

              {/* Bouton d'accès */}
              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={{ scale: submitting ? 1 : 1.02 }}
                whileTap={{ scale: submitting ? 1 : 0.98 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-amber-600/25 transition-all hover:from-amber-700 hover:to-orange-700 hover:shadow-amber-600/40 disabled:opacity-60"
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
              </motion.button>

              {/* Lien "Code oublié" */}
              <div className="text-center">
                <Link
                  href="/code-oublie"
                  className="text-xs text-gray-500 transition-colors hover:text-amber-700 hover:underline"
                >
                  Code PIN oublié ?
                </Link>
              </div>

              {/* Lien retour (discret, en bas du formulaire) */}
              <button
                type="button"
                onClick={onBack}
                className="flex w-full items-center justify-center gap-1.5 text-xs text-gray-400 transition-colors hover:text-amber-700"
              >
                <ArrowLeft className="size-3.5" />
                Retour au choix d&apos;espace
              </button>
            </form>

            {/* Panneau démo (bascule via AnimatePresence) */}
            <div className="mt-6 rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 backdrop-blur-sm">
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
                      <p className="text-[11px] text-amber-800/80">
                        Cliquez pour pré-remplir le formulaire.
                      </p>
                      <div className="rounded-lg border border-amber-200 bg-white/80 p-2.5 font-mono text-[11px] leading-relaxed text-amber-900">
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
            <p className="mt-4 flex items-start gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="mt-px size-3 shrink-0 text-emerald-600" />
              Votre session parent est valable 2 heures et limitée à la
              consultation de vos enfants et au paiement en ligne. Aucun accès
              au back-office du personnel.
            </p>
          </motion.div>

          <p className="mt-6 text-center text-[10px] leading-relaxed text-gray-400 sm:text-[11px]">
            © 2026 ScolaGest. Développé par Freelance Technologies Côte d&apos;Ivoire. Tous droits réservés.
          </p>
        </motion.div>
      </div>

      {/* ===== Panneau droit : Branding animé (glassmorphism) ===== */}
      <div className="relative hidden lg:flex lg:w-1/2 xl:w-[55%]">
        {/* Fond dégradé chaud (amber → orange) */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500 via-amber-600 to-orange-700" />

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
          className="relative z-10 flex flex-col justify-between p-12 xl:p-16"
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
                <h1 className="text-2xl font-bold text-white">ScolaGest</h1>
                <p className="text-sm text-amber-100">Espace Parent</p>
              </div>
            </motion.div>
          </div>

          {/* Slogan central */}
          <div className="my-12">
            <motion.h2
              variants={itemVariants}
              className="text-4xl font-bold leading-tight text-white xl:text-5xl"
            >
              Suivez la{" "}
              <span className="bg-gradient-to-r from-amber-300 to-amber-100 bg-clip-text text-transparent">
                scolarité
              </span>{" "}
              de vos enfants
            </motion.h2>
            <motion.p
              variants={itemVariants}
              className="mt-4 max-w-md text-lg text-amber-50/90"
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
                    className="flex items-center gap-2.5 rounded-xl bg-white/10 px-4 py-3 backdrop-blur-md ring-1 ring-white/15"
                  >
                    <Icon className="size-5 text-amber-300" />
                    <span className="text-sm font-medium text-white">
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
            <span className="text-sm">
              Conçu pour les parents · FCFA · Côte d&apos;Ivoire
            </span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
