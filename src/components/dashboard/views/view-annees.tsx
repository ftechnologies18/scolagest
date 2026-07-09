"use client";

import { CalendarDays } from "lucide-react";
import { PlaceholderView } from "./placeholder";

export default function AnneesView() {
  return (
    <PlaceholderView
      title="Années scolaires"
      description="Gestion des exercices scolaires, passage et réinscriptions."
      icon={CalendarDays}
      phase="Phase 2"
      bullets={[
        "Création d'un exercice avec reprise des paramètres",
        "Passage des élèves dans la classe supérieure",
        "Réinscription massive avec facturation auto",
        "Archivage des exercices clos",
        "Comparaison entre exercices",
      ]}
    />
  );
}
