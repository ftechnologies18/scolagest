"use client";

import * as React from "react";

/**
 * Hook générique pour écouter une media query CSS.
 *
 * SSR-safe : retourne `false` côté serveur et lors du premier rendu client,
 * puis se met à jour après le mount via `useEffect`. Le listener est
 * nettoyé au unmount.
 *
 * @param query - La media query à évaluer, ex. `"(max-width: 768px)"`.
 * @returns `true` si la media query correspond, `false` sinon.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = React.useState(false);

  React.useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/**
 * Preset mobile : vrai si le viewport ≤ 767px.
 *
 * Compatible avec l'ancien `use-mobile.ts` (même sémantique que
 * `window.innerWidth < 768`). Le hook `use-mobile.ts` est conservé
 * intact pour ne pas casser l'existant.
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

/**
 * Preset tablette : vrai si le viewport est entre 768px et 1023px inclus.
 */
export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
}

/**
 * Preset desktop : vrai si le viewport ≥ 1024px.
 */
export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}
