"use client";

import { BookOpen } from "lucide-react";
import { PlaceholderView } from "./placeholder";

export default function ComptabiliteView() {
  return (
    <PlaceholderView
      title="Comptabilité générale"
      description="Journal, plan comptable, grand livre et bilan (partie double)."
      icon={BookOpen}
      phase="Phase 5"
      bullets={[
        "Plan comptable paramétrable",
        "Journal des écritures avec partie double",
        "Grand livre par compte",
        "Balance générale et bilan annuel",
        "Clôture d'exercice comptable",
      ]}
    />
  );
}
