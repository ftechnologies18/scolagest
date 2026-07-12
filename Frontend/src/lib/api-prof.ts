"use client";

/**
 * ScolaGest — Clés React Query pour le portail enseignant (Phase B).
 *
 * Centralise les clés de cache React Query liées aux routes `/api/prof/*`
 * (sessions de cours du jour, pointage, incidents). Permet d'invalider
 * facilement le cache depuis n'importe quelle page prof après une mutation.
 */

export const profKeys = {
  all: ["prof"] as const,
  sessions: (date: string) => [...profKeys.all, "sessions", date] as const,
  incidents: () => [...profKeys.all, "incidents"] as const,
};
