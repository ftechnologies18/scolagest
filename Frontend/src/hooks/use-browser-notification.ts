"use client";

/**
 * ScolaGest — Hook de notification navigateur (Web Notifications API).
 *
 * Remplace l'ancien bouton « Installer l'application » (PWA `beforeinstallprompt`,
 * limité à Chrome/Edge/Android) par des notifications navigateur qui
 * fonctionnent sur tous les navigateurs modernes (desktop + mobile, y compris
 * iOS Safari 16.4+ via PWA installée).
 *
 * États exposés :
 *   - `permission` : "default" | "granted" | "denied" | "unsupported"
 *   - `requestPermission()` : demande la permission (retourne true si accordée)
 *   - `showNotification(title, options?)` : affiche une notification si la
 *     permission est accordée. Si la permission est "default", la demande
 *     d'abord. Retourne true si la notification a été affichée.
 *
 * Amélioration progressive : si l'API n'est pas supportée (`unsupported`),
 * `permission` reste "unsupported" et les fonctions sont des no-op — l'app
 * reste pleinement fonctionnelle.
 */

import { useCallback, useEffect, useState } from "react";

export type NotificationPermissionState =
  | "default"
  | "granted"
  | "denied"
  | "unsupported";

export interface BrowserNotificationOptions
  extends Omit<NotificationOptions, "silent"> {
  /** Icône affichée dans la notification (URL). */
  icon?: string;
  /** Badge Android (URL). */
  badge?: string;
}

export interface UseBrowserNotificationResult {
  /** État courant de la permission. */
  permission: NotificationPermissionState;
  /** true si l'API Notification est supportée par le navigateur. */
  supported: boolean;
  /** Demande la permission. Retourne true si accordée. */
  requestPermission: () => Promise<boolean>;
  /**
   * Affiche une notification. Si la permission est "default", la demande
   * d'abord. Retourne true si la notification a effectivement été affichée.
   */
  showNotification: (
    title: string,
    options?: BrowserNotificationOptions,
  ) => Promise<boolean>;
}

export function useBrowserNotification(): UseBrowserNotificationResult {
  const supported =
    typeof window !== "undefined" && "Notification" in window;

  const [permission, setPermission] = useState<NotificationPermissionState>(
    () => {
      if (!supported) return "unsupported";
      // `Notification.permission` : "default" | "granted" | "denied"
      return Notification.permission as NotificationPermissionState;
    },
  );

  // Synchronise l'état si la permission change ailleurs (ex: réglages navigateur).
  useEffect(() => {
    if (!supported) return;
    const sync = () =>
      setPermission(Notification.permission as NotificationPermissionState);
    sync();
    // L'API Notification n'émet pas d'événement de changement de permission,
    // mais on resync au focus au cas où l'utilisateur change les réglages.
    window.addEventListener("focus", sync);
    return () => window.removeEventListener("focus", sync);
  }, [supported]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;
    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermissionState);
      return result === "granted";
    } catch {
      return false;
    }
  }, [supported]);

  const showNotification = useCallback(
    async (
      title: string,
      options?: BrowserNotificationOptions,
    ): Promise<boolean> => {
      if (!supported) return false;

      // Si la permission n'est pas encore accordée, la demander d'abord.
      let currentPerm = Notification.permission;
      if (currentPerm === "default") {
        const granted = await requestPermission();
        if (!granted) return false;
        currentPerm = "granted";
      }
      if (currentPerm !== "granted") return false;

      try {
        // Notification de fenêtre (simple, pas de service worker requis).
        // Utilise l'icône de l'app par défaut si non fournie.
        const opts: NotificationOptions = {
          icon: options?.icon ?? "/icon.png",
          badge: options?.badge ?? "/icon.png",
          tag: options?.tag ?? "scolagest-parent",
          ...options,
        };
        new Notification(title, opts);
        return true;
      } catch {
        return false;
      }
    },
    [supported, requestPermission],
  );

  return {
    permission,
    supported,
    requestPermission,
    showNotification,
  };
}
