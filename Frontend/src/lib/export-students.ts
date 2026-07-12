"use client";

/**
 * ScolaGest — Utilitaire d'export des listes d'élèves.
 *
 * Génère des fichiers CSV, Excel (.xlsx) et PDF à partir d'une liste d'élèves
 * (récupérée via GET /api/eleves/export). Toute la génération se fait côté
 * frontend — le backend ne renvoie que les données JSON.
 *
 * Formats :
 *  - CSV  : natif (Blob), encodage UTF-8 avec BOM (Excel FR lit les accents)
 *  - Excel: via SheetJS (xlsx)
 *  - PDF  : via jsPDF + jspdf-autotable (tableau formaté, en-tête établissement)
 */

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { Eleve, Inscription } from "@/lib/types";
import type { Etablissement } from "@/lib/auth-store";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Nom complet d'un élève : "Prénoms NOM". */
function fullName(e: Eleve): string {
  return [e.prenoms, e.nom].filter(Boolean).join(" ").trim() || "—";
}

/** Sexe lisible. */
function sexeLabel(e: Eleve): string {
  return e.sexe === "M" ? "M" : e.sexe === "F" ? "F" : "—";
}

/** Date de naissance au format JJ/MM/AAAA. */
function dateNaissLabel(e: Eleve): string {
  if (!e.date_naissance) return "—";
  const d = new Date(e.date_naissance);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR");
}

/**
 * Récupère l'inscription la plus récente (dernière classe fréquentée).
 * Les inscriptions sont triées par date de création desc par convention.
 */
function derniereInscription(e: Eleve): Inscription | null {
  if (!e.inscriptions || e.inscriptions.length === 0) return null;
  const sorted = [...e.inscriptions].sort(
    (a, b) =>
      new Date(b.date_inscription).getTime() -
      new Date(a.date_inscription).getTime(),
  );
  return sorted[0];
}

/** Libellé de la classe courante (dernière inscription). */
function classeCourante(e: Eleve): string {
  if (e.inscription_courante?.classe_libelle) {
    return e.inscription_courante.classe_libelle;
  }
  const ins = derniereInscription(e);
  return ins?.classe?.libelle ?? "—";
}

/** Téléphone du tuteur principal. */
function tuteurTelephone(e: Eleve): string {
  return e.tuteur?.telephone ?? "—";
}

/** Nom du tuteur principal. */
function tuteurNom(e: Eleve): string {
  if (!e.tuteur) return "—";
  return [e.tuteur.prenoms, e.tuteur.nom].filter(Boolean).join(" ").trim();
}

/** Construit un nom de fichier basé sur le contexte (établissement + filtre). */
function buildFilename(
  prefix: string,
  etablissement: Etablissement | null,
  classeLibelle: string | undefined,
  ext: string,
): string {
  const parts: string[] = [prefix];
  if (etablissement?.nom) {
    // Nettoie le nom de l'établissement (sans espaces ni accents)
    parts.push(etablissement.nom.replace(/[^a-zA-Z0-9]/g, ""));
  }
  if (classeLibelle) {
    parts.push(classeLibelle.replace(/[^a-zA-Z0-9]/g, ""));
  }
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  parts.push(date);
  return `${parts.join("-")}.${ext}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Données tabulaires communes
// ─────────────────────────────────────────────────────────────────────────────

interface ExportContext {
  etablissement: Etablissement | null;
  /** Libellé de la classe si le filtre classe est actif (pour le titre). */
  classeLibelle?: string;
}

/** Colonnes exportées (ordre fixed). */
function buildRows(eleves: Eleve[]): string[][] {
  return eleves.map((e, i) => [
    String(i + 1),
    e.identifiant_interne || "—",
    e.matricule_ministere || "—",
    fullName(e),
    sexeLabel(e),
    dateNaissLabel(e),
    e.lieu_naissance || "—",
    classeCourante(e),
    tuteurNom(e),
    tuteurTelephone(e),
    e.statut || "—",
  ]);
}

const HEADERS = [
  "N°",
  "Identifiant",
  "Matricule Min.",
  "Nom complet",
  "Sexe",
  "Date naiss.",
  "Lieu naiss.",
  "Classe",
  "Tuteur",
  "Téléphone",
  "Statut",
];

// ─────────────────────────────────────────────────────────────────────────────
// CSV
// ─────────────────────────────────────────────────────────────────────────────

/** Échappe une cellule CSV (guillemets si virgule, guillemet ou newline). */
function csvCell(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportElevesCSV(
  eleves: Eleve[],
  ctx: ExportContext,
): void {
  const rows = buildRows(eleves);
  const header = HEADERS.join(",");
  const lines = rows.map((r) => r.map(csvCell).join(","));
  // BOM UTF-8 pour qu'Excel lise correctement les accents
  const csv = "\uFEFF" + [header, ...lines].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const filename = buildFilename(
    "liste-eleves",
    ctx.etablissement,
    ctx.classeLibelle,
    "csv",
  );
  downloadBlob(blob, filename);
}

// ─────────────────────────────────────────────────────────────────────────────
// Excel
// ─────────────────────────────────────────────────────────────────────────────

export function exportElevesExcel(
  eleves: Eleve[],
  ctx: ExportContext,
): void {
  const rows = buildRows(eleves);
  const aoa: (string | number)[][] = [HEADERS, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Largeurs de colonnes (en caractères)
  ws["!cols"] = [
    { wch: 5 },
    { wch: 18 },
    { wch: 18 },
    { wch: 28 },
    { wch: 6 },
    { wch: 12 },
    { wch: 18 },
    { wch: 14 },
    { wch: 24 },
    { wch: 14 },
    { wch: 12 },
  ];

  const wb = XLSX.utils.book_new();
  const sheetName = (ctx.classeLibelle || "Élèves").slice(0, 31);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const filename = buildFilename(
    "liste-eleves",
    ctx.etablissement,
    ctx.classeLibelle,
    "xlsx",
  );
  XLSX.writeFile(wb, filename);
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF
// ─────────────────────────────────────────────────────────────────────────────

export function exportElevesPDF(
  eleves: Eleve[],
  ctx: ExportContext,
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // ── En-tête ──
  const etabNom = ctx.etablissement?.nom ?? "Établissement";
  const etabVille = ctx.etablissement?.ville ?? "";
  const titre = ctx.classeLibelle
    ? `Liste de classe — ${ctx.classeLibelle}`
    : "Liste des élèves";
  const sousTitre = [etabNom, etabVille].filter(Boolean).join(" — ");
  const dateStr = new Date().toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  doc.setFontSize(16);
  doc.text(titre, 14, 16);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(sousTitre, 14, 22);
  doc.text(`Édité le ${dateStr} — ${eleves.length} élève(s)`, 14, 27);
  doc.setTextColor(0);

  // ── Tableau ──
  const rows = buildRows(eleves);
  autoTable(doc, {
    head: [HEADERS],
    body: rows,
    startY: 32,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [16, 122, 87], textColor: 255 }, // emerald-700
    alternateRowStyles: { fillColor: [245, 250, 247] },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 28 },
      2: { cellWidth: 28 },
      4: { cellWidth: 12 },
      5: { cellWidth: 20 },
    },
    margin: { left: 14, right: 14 },
  });

  // ── Pied de page ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      "ScolaGest — Groupe Scolaire Le Chandelier",
      14,
      doc.internal.pageSize.getHeight() - 8,
    );
    doc.text(
      `Page ${i}/${pageCount}`,
      doc.internal.pageSize.getWidth() - 24,
      doc.internal.pageSize.getHeight() - 8,
    );
    doc.setTextColor(0);
  }

  const filename = buildFilename(
    "liste-eleves",
    ctx.etablissement,
    ctx.classeLibelle,
    "pdf",
  );
  doc.save(filename);
}

// ─────────────────────────────────────────────────────────────────────────────
// Téléchargement (helper)
// ─────────────────────────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
