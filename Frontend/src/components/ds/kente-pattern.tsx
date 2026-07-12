"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type KenteVariant = "strip" | "bg" | "border" | "separator";

export interface KentePatternProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: KenteVariant;
  /** Position : top (h-4 = 16px), bottom (h-4 = 16px), full (custom).
   *  Hauteur 16px pour que le motif kente riche (4 sections, losanges/
   *  triangles/zigzags) soit distinguable. background-size adapté dans globals.css. */
  position?: "top" | "bottom" | "custom";
  className?: string;
}

/**
 * KentePattern — motif décoratif africain Forêt EdTech (refonte kente-refonte).
 *
 * Utilisations (règles strictes) :
 * - Header strip : <KentePattern variant="strip" position="top" /> en haut de page
 *   (h-4 = 16px, motif riche opaque sur fond emerald, background-size 32×16)
 * - Footer strip : <KentePattern variant="strip" position="bottom" /> en bas de page
 *   (h-4 = 16px, motif riche opaque sur fond emerald)
 * - Background subtil : <KentePattern variant="bg" /> (opacity-10, motif riche
 *   80×40 complet : 4 sections losanges/triangles/zigzags, couleurs emerald/
 *   amber/gold/terracotta/noir)
 * - Séparateur : <KentePattern variant="separator" /> (4px, mini-bande kente
 *   avec 4 sections colorées + accents gold)
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
    top: "h-6 w-full",
    bottom: "h-6 w-full",
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
