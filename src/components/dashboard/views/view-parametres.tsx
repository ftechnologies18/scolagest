"use client";

import { Settings } from "lucide-react";
import { PlaceholderView } from "./placeholder";

export default function ParametresView() {
  return (
    <PlaceholderView
      title="Paramètres"
      description="Établissements, cycles, classes, providers et journal d'audit."
      icon={Settings}
      phase="Phase 1"
      bullets={[
        "Gestion des établissements du groupe (multi-sites)",
        "Arbre cycles / classes / sections",
        "Configuration des providers SMS et Mobile Money",
        "Préférences de l'application (devise, langue)",
        "Journal d'audit des actions sensibles",
      ]}
    />
  );
}
