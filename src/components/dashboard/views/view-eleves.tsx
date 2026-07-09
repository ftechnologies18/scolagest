"use client";

/**
 * ScolaGest — Vue "Élèves" (Phase 2)
 *
 * Sous-routeur client-side géré par un état local :
 *   - "list"   : liste filtrée des élèves
 *   - "detail" : fiche détaillée d'un élève
 *   - "form"   : création ou édition d'un élève
 *
 * Le `DashboardLayout` render `<ElevesView />` lorsque la nav "Élèves" est
 * active. Le nom d'export par défaut est conservé pour ne pas casser
 * l'import dans `dashboard-layout.tsx`.
 */

import * as React from "react";

import { ElevesList } from "@/components/eleves/eleves-list";
import { EleveDetail } from "@/components/eleves/eleve-detail";
import { EleveForm } from "@/components/eleves/eleve-form";

type SubView = "list" | "detail" | "form";

export default function ElevesView() {
  const [view, setView] = React.useState<SubView>("list");
  const [selectedEleveId, setSelectedEleveId] = React.useState<string | null>(
    null,
  );

  // ─── Handlers de navigation ──────────────────────────────────────────────
  function goToList() {
    setView("list");
    setSelectedEleveId(null);
  }

  function goToDetail(id: string) {
    setSelectedEleveId(id);
    setView("detail");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goToCreate() {
    setSelectedEleveId(null);
    setView("form");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goToEdit(id: string) {
    setSelectedEleveId(id);
    setView("form");
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  if (view === "detail" && selectedEleveId) {
    return (
      <EleveDetail
        eleveId={selectedEleveId}
        onBack={goToList}
        onEdit={() => goToEdit(selectedEleveId)}
      />
    );
  }

  if (view === "form") {
    return (
      <EleveForm
        eleveId={selectedEleveId ?? undefined}
        onSaved={(id) => goToDetail(id)}
        onCancel={selectedEleveId ? () => goToDetail(selectedEleveId) : goToList}
      />
    );
  }

  // Vue par défaut : liste
  return (
    <ElevesList
      onCreate={goToCreate}
      onSelect={(id) => goToDetail(id)}
      onEdit={(id) => goToEdit(id)}
    />
  );
}
