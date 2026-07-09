"use client";

import { Wallet } from "lucide-react";
import { PlaceholderView } from "./placeholder";

export default function CaisseView() {
  return (
    <PlaceholderView
      title="Caisse"
      description="Encaissement, reçus PDF, soldes et clôture de caisse."
      icon={Wallet}
      phase="Phase 3"
      accent="amber"
      bullets={[
        "Recherche rapide d'un élève par matricule ou nom",
        "Encaissement espèces, chèque, Mobile Money",
        "Génération automatique du reçu PDF (numéroté)",
        "Calcul en temps réel du solde restant",
        "Clôture quotidienne de caisse avec contrôle d'écart",
      ]}
    />
  );
}
