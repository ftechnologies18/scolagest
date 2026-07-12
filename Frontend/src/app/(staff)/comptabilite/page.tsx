"use client";

/**
 * ScolaGest — Page comptabilité générale (route `/comptabilite`).
 *
 * Module réservé au COMPTABLE seul (séparation des responsabilités : la
 * comptabilité générale — exercices, plan comptable, écritures, grand livre,
 * bilan — est strictement du ressort du comptable de l'établissement).
 *
 * Le `RoleGuard` empêche tout autre rôle (y compris en tapant l'URL directement)
 * d'accéder au contenu : il affiche un écran « Accès refusé » à la place.
 */

import { RoleGuard } from "@/components/auth/role-guard";
import ComptabiliteView from "@/components/dashboard/views/view-comptabilite";

export default function ComptabilitePage() {
  return (
    <RoleGuard allow={["COMPTABLE"]}>
      <ComptabiliteView />
    </RoleGuard>
  );
}
