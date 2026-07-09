"use client";

import { Coins } from "lucide-react";
import { PlaceholderView } from "./placeholder";

export default function FraisView() {
  return (
    <PlaceholderView
      title="Frais & échéanciers"
      description="Paramétrage des frais de scolarité et des échéances par cycle."
      icon={Coins}
      phase="Phase 3"
      bullets={[
        "Grille des frais par classe et par catégorie",
        "Inscription, scolarité (5 ou 4 tranches), examen",
        "Frais annexes (tenue, transport, activitités)",
        "Éditeur d'échéancier avec dates de paiement",
        "Dérogation 3 tranches pour les élèves affectés",
      ]}
    />
  );
}
