"use client";

/**
 * ScolaGest — Hook d'amorce d'authentification.
 *
 * Le store `auth-store` (zustand + persist) se réhydrate depuis localStorage
 * lors du premier rendu côté client. L'état `isLoading` vaut `true` tant que
 * la réhydratation n'est pas terminée ET (si un token staff existe) que la
 * requête `/api/auth/me` n'est pas terminée.
 *
 * Avant la refactorisation multi-pages, c'était `app/page.tsx` qui appelait
 * `fetchMe()` une fois au montage. Désormais chaque layout/page a besoin du
 * même comportement : si un access token staff existe et qu'on ne sait pas
 * encore s'il est valide, on appelle `fetchMe()` ; sinon on arrête le
 * chargement.
 *
 * Ce hook factorise cette logique pour qu'elle puisse être appelée par les
 * layouts `(staff)`, `(saas)`, `(parent)` et par la page racine.
 *
 * Il ne renvoie rien : les consommateurs lisent directement `useAuthStore`.
 */

import { useEffect } from "react";
import { useAuthStore } from "@/lib/auth-store";

export function useAuthBootstrap() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isLoading = useAuthStore((s) => s.isLoading);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const stopLoading = useAuthStore((s) => s.stopLoading);

  useEffect(() => {
    // Une seule initialisation après montage côté client.
    if (accessToken) {
      // Token staff : on vérifie sa validité via /api/auth/me.
      void fetchMe();
    } else {
      // Pas de token staff : on s'arrête (parent ou non connecté).
      stopLoading();
    }
    // On ne dépend que de l'état initial — on ne veut PAS re-déclencher
    // l'effet à chaque changement de token (sinon boucle après login/logout).
  }, []);
}
