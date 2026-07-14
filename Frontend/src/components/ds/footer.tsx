/**
 * Footer — pied de page unifié Forêt EdTech.
 *
 * Texte discret (gris), centré, responsive mobile-first. Sur petits écrans
 * (mobiles africains, 320-375px), le texte peut wrapper sur 2 lignes sans
 * débordement. S'adapte au contexte (fond sombre sidebar/topbar vs fond clair).
 *
 * Usage :
 *   <Footer />                    // variante claire (défaut, fond blanc/light)
 *   <Footer variant="dark" />     // variante sombre (sur fond forest)
 *
 * Le texte affiché : « © 2026 ScolaGest. Développé par Freelance Technologies
 * Côte d'Ivoire. Tous droits réservés. »
 */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface FooterProps {
  /** Variante : "light" (fond clair, texte gris) ou "dark" (fond forest, texte gris clair). */
  variant?: "light" | "dark";
  /** Classe supplémentaire (padding, bordure, etc.). */
  className?: string;
}

const FOOTER_TEXT =
  "© 2026 ScolaGest. Développé par Freelance Technologies Côte d'Ivoire. Tous droits réservés.";

export function Footer({ variant = "light", className }: FooterProps) {
  const isDark = variant === "dark";
  return (
    <footer
      role="contentinfo"
      className={cn(
        "w-full border-t",
        isDark ? "border-white/10 bg-forest" : "border-muted bg-background",
        className,
      )}
    >
      <p
        className={cn(
          // Mobile-first : text-[10px] sur très petits écrans, text-xs (12px) sm+
          "mx-auto max-w-7xl px-4 py-1.5 text-center text-[10px] leading-relaxed sm:px-6 sm:text-xs",
          // Discret : gris clair (light) ou gris-vert (dark sur fond forest)
          isDark ? "text-emerald-100/50" : "text-muted-foreground/70",
        )}
      >
        {FOOTER_TEXT}
      </p>
    </footer>
  );
}

export default Footer;
