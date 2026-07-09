"use client";

import { FileBarChart } from "lucide-react";
import { PlaceholderView } from "./placeholder";

export default function RapportsView() {
  return (
    <PlaceholderView
      title="Rapports"
      description="Statistiques, tableaux de bord analytiques et exports."
      icon={FileBarChart}
      phase="Phase 4"
      bullets={[
        "Synthèse des encaissements par cycle / classe / mode",
        "Taux de recouvrement par période",
        "Exports PDF et Excel paramétrables",
        "Comparaison entre exercices scolaires",
        "Graphiques de tendance mensuelle",
      ]}
    />
  );
}
