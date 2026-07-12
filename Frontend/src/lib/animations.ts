import type { Variants, Transition } from "framer-motion";

/**
 * Variant de transition de page (initial/animate/exit).
 *
 * À utiliser avec `AnimatePresence` autour du `<motion.div>` racine des
 * routes : `y` 20 → 0 → -20, opacité 0 → 1 → 0. La durée/courbe est à
 * définir sur le composant motion via `transition={{ duration: 0.4, ease: pageTransitionEase }}`.
 */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

/**
 * Courbe d'easing standard du DS Forêt EdTech
 * (cubic-bezier 0.22, 1, 0.36, 1 — inspiration "easeOutExpo").
 * Sorties nettes, entrées douces.
 */
export const pageTransitionEase: Transition["ease"] = [0.22, 1, 0.36, 1];

/**
 * Container avec `staggerChildren: 0.08s` — pour révéler une liste
 * d'items en cascade. Combiner avec `staggerItem` sur les enfants
 * (`<motion.div variants={staggerItem}>`).
 */
export const staggerContainer: Variants = {
  animate: { transition: { staggerChildren: 0.08 } },
};

/**
 * Item enfant d'un `staggerContainer`. Opacité 0→1, `y` 16→0.
 * La transition (durée/ease) est héritée du parent ou à définir inline.
 */
export const staggerItem: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

/**
 * Hover subtil pour cartes. `y: -2` (jamais > 4px selon le DS), durée 0.2s.
 * À passer à la prop `whileHover` d'un `<motion.div>`.
 */
export const cardHover = { y: -2, transition: { duration: 0.2 } };

/**
 * Hover pour boutons. `scale: 1.02`, durée 0.2s.
 * À passer à la prop `whileHover` d'un `<motion.button>`.
 */
export const buttonHover = { scale: 1.02, transition: { duration: 0.2 } };

/**
 * Tap pour boutons. `scale: 0.98`.
 * À passer à la prop `whileTap` d'un `<motion.button>`.
 */
export const buttonTap = { scale: 0.98 };

/**
 * Apparition simple : opacité 0→1, `y` 16→0, durée 0.4s.
 * Bon défaut pour sections hero, cartes stats, modales.
 */
export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

/**
 * Apparition avec scale : opacité 0→1, `scale` 0.95→1, durée 0.3s.
 * Idéale pour dialogues, popovers, badges importants.
 */
export const scaleIn: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.3 } },
};

/**
 * Entrée latérale gauche : opacité 0→1, `x` -20→0, durée 0.4s.
 * Pour drawers/sidebar gauche, notifications push-in.
 */
export const slideInLeft: Variants = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4 } },
};

/**
 * Entrée latérale droite : opacité 0→1, `x` 20→0, durée 0.4s.
 * Pour drawers/sidebar droite, toasts entrants.
 */
export const slideInRight: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.4 } },
};

/**
 * Respect de `prefers-reduced-motion` : retourne des variants "désactivés"
 * (opacité 1, `y`/`x`/`scale` à 0/1, durée 0) si `prefersReducedMotion` est
 * vrai, sinon retourne les variants complets du DS.
 *
 * Usage type :
 * ```ts
 * const reduced = usePrefersReducedMotion();
 * const m = getMotion(reduced);
 * <motion.div variants={m.fadeInUp} initial="initial" animate="animate" />
 * ```
 *
 * @param prefersReducedMotion - Sortie de `usePrefersReducedMotion()`.
 * @returns Un objet agrégeant tous les variants du DS, animés ou désactivés.
 */
export function getMotion(prefersReducedMotion: boolean) {
  if (prefersReducedMotion) {
    return {
      pageTransition: { initial: {}, animate: { opacity: 1, y: 0 }, exit: {} },
      staggerContainer: { animate: { transition: {} } },
      staggerItem: { initial: {}, animate: { opacity: 1, y: 0 } },
      fadeInUp: { initial: {}, animate: { opacity: 1, y: 0 } },
      scaleIn: { initial: {}, animate: { opacity: 1, scale: 1 } },
      slideInLeft: { initial: {}, animate: { opacity: 1, x: 0 } },
      slideInRight: { initial: {}, animate: { opacity: 1, x: 0 } },
      cardHover: {},
      buttonHover: {},
      buttonTap: {},
    };
  }
  return {
    pageTransition,
    staggerContainer,
    staggerItem,
    fadeInUp,
    scaleIn,
    slideInLeft,
    slideInRight,
    cardHover,
    buttonHover,
    buttonTap,
  };
}
