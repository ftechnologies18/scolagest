"use client";

/**
 * ScolaGest — Providers racine.
 *
 * Encapsule l'application dans un `QueryClientProvider` (TanStack Query) pour
 * permettre aux vues Phase 2+ d'utiliser `useQuery` / `useMutation`.
 *
 * Le `QueryClient` est créé par React (useState) plutôt qu'en singleton module
 * afin d'éviter le partage d'état entre les requêtes SSR (Next.js).
 */

import * as React from "react";
import {
  QueryClient,
  QueryClientProvider,
  type DefaultOptions,
} from "@tanstack/react-query";

const defaultOptions: DefaultOptions = {
  queries: {
    // Évite les refetch automatiques bruyants en cas de refocus / remount.
    staleTime: 30 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
  },
  mutations: {
    retry: 0,
  },
};

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions,
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
