"use client";

/**
 * ScolaGest — Page publique de pré-inscription en ligne (route `/pre-inscription`).
 *
 * Cette page est PUBLIQUE : accessible sans authentification. Elle ne comporte
 * PAS de sidebar staff (elle vit dans le groupe racine, hors `(staff)`).
 *
 * Le formulaire (`PreInscriptionForm`) s'occupe de tout : sélection
 * d'établissement, saisie élève/tuteur/classe souhaitée, soumission via
 * `submitPreInscription` (route publique sans JWT) et écran de succès avec
 * token de suivi + lien vers `/pre-inscription/suivi?token=XXX`.
 */

import { PreInscriptionForm } from "@/components/pre-inscription/pre-inscription-form";

export default function PreInscriptionPublicPage() {
  return <PreInscriptionForm />;
}
