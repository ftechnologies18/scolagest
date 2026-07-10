/**
 * ScolaGest — Helpers de formatage (Phase 3).
 *
 * Centralise le formatage des montants en FCFA, des dates et des heures pour
 * tout le module de caisse. Importé depuis `@/lib/format` pour éviter la
 * duplication dans les composants.
 */

const fcfaFormatter = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
});

/** Formate un montant en FCFA avec séparateur de milliers (espace insécable). */
export function formatFCFA(amount: number | null | undefined): string {
  const value = typeof amount === "number" ? amount : 0;
  return `${fcfaFormatter.format(value)} FCFA`;
}

/** Formate une date ISO au format "12 mars 2026". */
export function formatDate(
  iso: string | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    ...opts,
  });
}

/** Formate une date ISO au format court "12/03/2026". */
export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Formate une date/heure ISO au format "12/03/2026 à 14:30". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${date} à ${time}`;
}

/** Retourne l'heure au format "14:30". */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Retourne la date du jour au format ISO YYYY-MM-DD (pour <input type="date">). */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Convertit une date ISO en valeur utilisable dans un <input type="date">. */
export function isoToDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Convertit une valeur de <input type="date"> (YYYY-MM-DD) en ISO datetime. */
export function dateInputToISO(value: string): string {
  if (!value) return new Date().toISOString();
  // Construit une date à midi (local) pour éviter les décalages UTC.
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return new Date().toISOString();
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}
