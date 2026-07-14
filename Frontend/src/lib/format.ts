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

// ─────────────────────────────────────────────────────────────────────────────
// Niveaux scolaires (mapping cycle + niveau → libellé français)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mapping `niveau` (entier relatif au cycle, stocké en DB) → libellé français
 * affiché à l'utilisateur final. Le `niveau` est un ordinal (1, 2, 3...) dont
 * la signification dépend du cycle :
 *   - PRÉSCOLAIRE : 1=PS, 2=MS, 3=GS
 *   - PRIMAIRE    : 1=CP1, 2=CP2, 3=CE1, 4=CE2, 5=CM1, 6=CM2
 *   - PREMIER CYCLE (COLLEGE) : 1=6ème, 2=5ème, 3=4ème, 4=3ème
 *   - SECOND CYCLE  (LYCEE)   : 1=2nde, 2=1ère, 3=Terminale
 *
 * Rappel : la classe elle-même a un `libelle` (ex: "6e 1", "Première D 1",
 * "Terminale D 1") qui identifie la subdivision (numéro de section, et série
 * A/C/D pour le second cycle). Le `niveau` est l'année scolaire dans le cycle
 * (ex: 6ème = 1ère année du premier cycle).
 *
 * Note dénomination (2026-07) : les codes enum DB COLLEGE / LYCEE restent
 * inchangés en base, mais sont affichés comme "Premier cycle" / "Second cycle"
 * via formatCycleCourt() ci-dessous.
 */
const NIVEAUX_BY_CYCLE: Record<string, Record<number, string>> = {
  PRESCOLAIRE: { 1: "Petite Section", 2: "Moyenne Section", 3: "Grande Section" },
  PRIMAIRE: { 1: "CP1", 2: "CP2", 3: "CE1", 4: "CE2", 5: "CM1", 6: "CM2" },
  COLLEGE: { 1: "6ème", 2: "5ème", 3: "4ème", 4: "3ème" },
  LYCEE: { 1: "2nde", 2: "1ère", 3: "Terminale" },
};

/**
 * Formate un `niveau` (entier) en libellé français lisible, en fonction du
 * cycle. Retourne "Niveau N" si le cycle est inconnu (fallback sûr).
 *
 * @example formatNiveau("COLLEGE", 1) → "6ème"
 * @example formatNiveau("LYCEE", 3)   → "Terminale"
 * @example formatNiveau("PRIMAIRE", 6) → "CM2"
 */
export function formatNiveau(
  cycleLibelle: string | null | undefined,
  niveau: number | null | undefined,
): string {
  if (niveau == null) return "—";
  const map = cycleLibelle ? NIVEAUX_BY_CYCLE[cycleLibelle] : undefined;
  const label = map?.[niveau];
  return label ?? `Niveau ${niveau}`;
}

/**
 * Retourne le libellé court du cycle (pour affichage compact).
 *
 * Dénomination 2026-07 : "Collège" → "Premier cycle", "Lycée" → "Second cycle".
 * Les codes enum DB (COLLEGE / LYCEE) restent inchangés en base ; cette
 * fonction assure la traduction vers le libellé affiché à l'utilisateur final.
 *
 * @example formatCycleCourt("COLLEGE") → "Premier cycle"
 * @example formatCycleCourt("LYCEE")   → "Second cycle"
 * @example formatCycleCourt("PRIMAIRE") → "Primaire"
 */
export function formatCycleCourt(
  cycleLibelle: string | null | undefined,
): string {
  switch (cycleLibelle) {
    case "PRESCOLAIRE":
      return "Préscolaire";
    case "PRIMAIRE":
      return "Primaire";
    case "COLLEGE":
      return "Premier cycle";
    case "LYCEE":
      return "Second cycle";
    default:
      return cycleLibelle ?? "—";
  }
}

