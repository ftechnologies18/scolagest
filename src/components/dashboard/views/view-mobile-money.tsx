"use client";

import { Smartphone } from "lucide-react";
import { PlaceholderView } from "./placeholder";

export default function MobileMoneyView() {
  return (
    <PlaceholderView
      title="Mobile Money"
      description="Orange, MTN, Wave — transactions, webhooks et réconciliation."
      icon={Smartphone}
      phase="Phase 5"
      accent="amber"
      bullets={[
        "Configuration des providers (Orange, MTN, Wave)",
        "Suivi temps réel des transactions entrantes",
        "Réconciliation automatique avec les encaissements",
        "Gestion des webhooks et des échecs",
        "Export des transactions pour la compta",
      ]}
    />
  );
}
