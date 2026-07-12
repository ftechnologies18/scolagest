"use client";

/**
 * ScolaGest Parent — Hooks PWA (Service Worker + install prompt).
 *
 * Deux hooks sont exportés :
 *
 *   1. `useParentPWA()` — enregistre `/sw-parent.js` au mount du composant
 *      appelant. Le SW ne s'enregistre QUE sur les routes parent
 *      (`/parent`, `/portal`, `/parent/*`) afin de ne jamais interférer
 *      avec la PWA prof (`/prof`) ni les routes staff.
 *
 *   2. `useParentInstallPrompt()` — capture l'événement `beforeinstallprompt`
 *      (Chrome/Edge/Android) et expose un déclencheur `promptInstall()`.
 *      Permet d'afficher un bouton « Installer l'app » dans l'UI parent.
 *      Sur iOS Safari, l'événement n'est jamais déclenché (installation
 *      manuelle via « Partager → Sur l'écran d'accueil ») → `canInstall`
 *      reste false et le bouton ne s'affiche pas (comportement attendu).
 *
 * Le SW et l'install prompt sont des améliorations progressives : toute
 * erreur est silencieusement ignorée, l'app reste pleinement fonctionnelle.
 */

import { useCallback, useEffect, useState } from "react";

/** Routes pour lesquelles le SW parent doit être actif. */
function isParentRoute(pathname: string): boolean {
  if (pathname === "/parent" || pathname === "/portal") return true;
  if (pathname.startsWith("/parent/")) return true;
  return false;
}

export function useParentPWA(): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    // Garde-fou : n'enregistrer le SW que sur les routes parent.
    if (!isParentRoute(window.location.pathname)) return;

    // Enregistrement silencieux — erreurs non bloquantes.
    navigator.serviceWorker.register("/sw-parent.js").catch(() => {
      /* No-op : le SW est une amélioration progressive. */
    });
  }, []);
}

/**
 * Type minimal pour l'événement `beforeinstallprompt` (Chrome/Edge).
 * La spec W3C n'est pas encore stabilisée, on déclare donc un type local
 * plutôt que de dépendre d'un package tiers.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface UseParentInstallPromptResult {
  /** true si l'événement `beforeinstallprompt` a été capturé. */
  canInstall: boolean;
  /** Déclenche la prompt native d'installation. true si acceptée. */
  promptInstall: () => Promise<boolean>;
}

export function useParentInstallPrompt(): UseParentInstallPromptResult {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (e: Event) => {
      // Empêcher la mini-infobar Chrome d'apparaître — on gère nous-mêmes
      // l'invite via un bouton dédié dans l'UI.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => {
      // `appinstalled` : l'utilisateur a installé l'app → on retire le badge.
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferred) return false;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      // L'événement est consommé après `userChoice` — on reset l'état pour
      // masquer le bouton (la prompt ne peut être réutilisée).
      setDeferred(null);
      return choice.outcome === "accepted";
    } catch {
      setDeferred(null);
      return false;
    }
  }, [deferred]);

  return {
    canInstall: deferred !== null,
    promptInstall,
  };
}
