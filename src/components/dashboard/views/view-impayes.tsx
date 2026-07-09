"use client";

import { AlertTriangle } from "lucide-react";
import { PlaceholderView } from "./placeholder";

export default function ImpayesView() {
  return (
    <PlaceholderView
      title="Impayés & relances"
      description="Suivi des soldes débiteurs, relances SMS/Email et bordereaux."
      icon={AlertTriangle}
      phase="Phase 4"
      accent="amber"
      bullets={[
        "Liste des élèves avec solde restant à charge",
        "Filtres par classe, cycle, montant, ancienneté",
        "Relance SMS et Email (modèles personnalisables)",
        "Génération de bordereaux de relance PDF",
        "Historique des relances envoyées par élève",
      ]}
    />
  );
}
