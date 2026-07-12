"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { fadeInUp, cardHover, getMotion } from "@/lib/animations";

/**
 * Variante glassmorphism disponible pour `GlassCard`.
 *
 * - `mobile` / `tablet` / `desktop` : forcent un niveau de glass fixe
 *   (quelle que soit la largeur du viewport) — utile pour les layouts
 *   qui ne changent pas de présentation entre breakpoints.
 * - `premium` : verre sombre dégradé forêt + bordure gold épaisse,
 *   pour les cartes "Premium SaaS" (abonnements, factures pro).
 * - `adaptive` (défaut) : passe automatiquement de `mobile` à `tablet`
 *   puis `desktop` via les media queries définies dans `globals.css`
 *   (`.glass-adaptive`).
 */
type GlassVariant = "mobile" | "tablet" | "desktop" | "premium" | "adaptive";

export interface GlassCardProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  children: React.ReactNode;
  className?: string;
  /** Variante glassmorphism. "adaptive" (défaut) = responsive mobile→tablet→desktop. */
  variant?: GlassVariant;
  /** Bordure premium (gold) en plus du glass. */
  premiumBorder?: boolean;
  /** Désactive l'animation d'entrée (utile pour les listes/loops). */
  noAnimation?: boolean;
  /** Désactive le hover lift (utile pour cartes non-interactives). */
  noHover?: boolean;
  /** Délai de l'animation d'entrée (en secondes, pour stagger). */
  delay?: number;
}

const variantClass: Record<GlassVariant, string> = {
  mobile: "glass-mobile",
  tablet: "glass-tablet",
  desktop: "glass-desktop",
  premium: "glass-premium",
  adaptive: "glass-adaptive",
};

/**
 * `GlassCard` — carte glassmorphism du Design System "Forêt EdTech".
 *
 * Wrapper de `Card` shadcn basé sur `motion.div` (Framer Motion) pour
 * bénéficier des animations d'entrée / hover lift. Style visuel
 * cohérent avec le `Card` shadcn (rounded-2xl, p-5).
 *
 * Comportement :
 * - `variant="adaptive"` (défaut) : responsive mobile→tablet→desktop
 *   via `.glass-adaptive` de `globals.css`.
 * - `premiumBorder` ajoute la bordure gold kente (`.kente-border-
 *   premium`) par-dessus le glass.
 * - Respect de `prefers-reduced-motion` via `getMotion()` + le hook
 *   `usePrefersReducedMotion()`. Si l'utilisateur préfère réduire les
 *   animations, l'entrée et le hover sont désactivés.
 * - `delay` (secondes) permet le stagger dans les listes
 *   (`delay={index * 0.05}`).
 * - `HTMLMotionProps<"div">` autorise toutes les props Framer Motion
 *   (onClick, drag, layout, onAnimationStart, etc.).
 *
 * Tokens fe-1a consommés (classes CSS) : `.glass-mobile`, `.glass-
 * tablet`, `.glass-desktop`, `.glass-premium`, `.glass-adaptive`,
 * `.kente-border-premium`.
 *
 * Hooks fe-1b consommés : `usePrefersReducedMotion`, `getMotion`.
 *
 * @example Carte simple responsive
 * ```tsx
 * <GlassCard>
 *   <h3 className="font-display text-lg">Solde du jour</h3>
 *   <p className="text-2xl font-semibold">1 250 000 FCFA</p>
 * </GlassCard>
 * ```
 *
 * @example Liste avec stagger
 * ```tsx
 * {items.map((item, i) => (
 *   <GlassCard key={item.id} delay={i * 0.05} noHover>
 *     {item.label}
 *   </GlassCard>
 * ))}
 * ```
 *
 * @example Carte premium avec bordure gold
 * ```tsx
 * <GlassCard variant="premium" premiumBorder>
 *   <PlanProContent />
 * </GlassCard>
 * ```
 */
export function GlassCard({
  children,
  className,
  variant = "adaptive",
  premiumBorder = false,
  noAnimation = false,
  noHover = false,
  delay = 0,
  onClick,
  onKeyDown,
  ...props
}: GlassCardProps) {
  // NB : la variable locale est nommée `motionVariants` (et non `motion`)
  // pour éviter de masquer l'import `motion` de framer-motion utilisé dans
  // le JSX `<motion.div>` ci-dessous. Convention documentée dans
  // `lib/animations.ts` (alias `m` dans la docstring de `getMotion`).
  const prefersReducedMotion = usePrefersReducedMotion();
  const motionVariants = getMotion(prefersReducedMotion);

  // Accessibilité : si la carte est cliqueable (onClick), on la rend
  // focusable au clavier (tabindex=0, role=button) avec un handler clavier
  // (Entrée / Espace) et un anneau de focus visible. Le `cursor-pointer`
  // est également ajouté automatiquement pour ne pas avoir à le passer dans
  // chaque consommateur (ex: StatCard).
  const interactive = Boolean(onClick);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (interactive && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      (e.currentTarget as HTMLElement).click();
    }
  };

  const animationProps = noAnimation
    ? {}
    : {
        initial: prefersReducedMotion ? {} : { opacity: 0, y: 16 },
        animate: prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 },
        transition: { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] as const },
      };

  const hoverProps = noHover || prefersReducedMotion ? {} : { whileHover: { y: -2, transition: { duration: 0.2 } } };

  return (
    <motion.div
      className={cn(
        "rounded-2xl p-5",
        variantClass[variant],
        premiumBorder && "kente-border-premium",
        interactive &&
          "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className
      )}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={interactive ? handleKeyDown : onKeyDown}
      {...animationProps}
      {...hoverProps}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export default GlassCard;
