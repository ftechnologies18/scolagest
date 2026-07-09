"use client";

import { Users } from "lucide-react";
import { PlaceholderView } from "./placeholder";

export default function ElevesView() {
  return (
    <PlaceholderView
      title="Élèves"
      description="Fiches élèves, matricules, cycles, classes et tuteurs."
      icon={Users}
      phase="Phase 2"
      bullets={[
        "Création / édition d'une fiche élève avec photo",
        "Génération automatique du matricule MEN et identifiant interne",
        "Catégorie AFFECTÉ / NON AFFECTÉ (selon cycle)",
        "Affectation à un cycle, une classe et un tuteur",
        "Dérogation sociale (3 tranches) pour les affectés",
      ]}
    />
  );
}
