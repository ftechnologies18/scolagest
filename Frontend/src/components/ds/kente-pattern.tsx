"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type KenteVariant = "strip" | "bg" | "border" | "separator";

export interface KentePatternProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: KenteVariant;
  /** Position : top (h-1), bottom (h-1.5), full (custom). */
  position?: "top" | "bottom" | "custom";
  className?: string;
}

/**
 * KentePattern — motif décoratif africain Forêt EdTech.
 *
 * Utilisations (règles strictes) :
 * - Header strip : <KentePattern variant="strip" position="top" /> en haut de page
 * - Footer strip : <KentePattern variant="strip" position="bottom" /> en bas de page
 * - Background subtil : <KentePattern variant="bg" /> (opacity 8-15%)
 * - Séparateur : <KentePattern variant="separator" /> (ligne or horizontale)
 * - Bordure premium : utiliser la classe .kente-border-premium sur GlassCard
 *
 * JAMAIS en fond de texte. JAMAIS opacity > 15% en bg.
 */
export function KentePattern({
  variant = "strip",
  position = "custom",
  className,
  ...props
}: KentePatternProps) {
  const positionClass = {
    top: "h-1 w-full",
    bottom: "h-1.5 w-full",
    custom: "",
  }[position];

  if (variant === "separator") {
    return <div className={cn("kente-separator w-full", className)} aria-hidden="true" {...props} />;
  }

  if (variant === "bg") {
    return (
      <div
        className={cn("bg-kente-pattern opacity-10 absolute inset-0 pointer-events-none", className)}
        aria-hidden="true"
        {...props}
      />
    );
  }

  // strip (défaut) et border
  const baseClass = position === "top" ? "kente-strip-top" : position === "bottom" ? "kente-strip-bottom" : "bg-kente-strip";

  return (
    <div
      className={cn(baseClass, positionClass, className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export default KentePattern;
