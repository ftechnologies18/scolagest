"use client";

import { UserCog } from "lucide-react";
import { PlaceholderView } from "./placeholder";

export default function UtilisateursView() {
  return (
    <PlaceholderView
      title="Utilisateurs"
      description="Comptes utilisateurs, rôles RBAC et accès multi-établissements."
      icon={UserCog}
      phase="Phase 1"
      bullets={[
        "Création / activation / désactivation d'utilisateurs",
        "Attribution d'un rôle (RBAC)",
        "Accès à un ou plusieurs établissements (multi-sites)",
        "Réinitialisation du mot de passe",
        "Journal d'audit des connexions",
      ]}
    />
  );
}
