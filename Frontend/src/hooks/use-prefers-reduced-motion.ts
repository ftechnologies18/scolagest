"use client";

import * as React from "react";

/**
 * Détecte si l'utilisateur a activé `prefers-reduced-motion: reduce`
 * au niveau OS (Windows "Show animations", macOS "Reduce motion", etc.).
 *
 * SSR-safe : retourne `false` côté serveur et au premier rendu client,
 * puis se met à jour après le mount via `useEffect`. Le listener est
 * nettoyé au unmount.
 *
 * À combiner avec `getMotion()` (cf. `lib/animations.ts`) pour servir
 * des variants Framer Motion désactivés quand l'utilisateur préfère
 * réduire les animations.
 *
 * @returns `true` si l'utilisateur préfère réduire les animations.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefers, setPrefers] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setPrefers(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return prefers;
}
