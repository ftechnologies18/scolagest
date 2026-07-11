"use client";

/**
 * ScolaGest — Page liste des élèves (route `/eleves`).
 *
 * Rend la vue `ElevesView` existante, autonome (pas de prop de navigation).
 */

import ElevesView from "@/components/dashboard/views/view-eleves";

export default function ElevesPage() {
  return <ElevesView />;
}
