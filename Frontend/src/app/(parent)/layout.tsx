import type { Metadata, Viewport } from "next";

/**
 * ScolaGest — Layout Server Component pour le groupe de routes `(parent)`.
 *
 * Routes concernées : `/portal` (et toute future route du portail parent).
 *
 * Pourquoi un layout dédié ? Les pages du portail parent sont des Client
 * Components (`"use client"`) car elles utilisent hooks React (useEffect,
 * useState, React Query…). Or, Next.js App Router n'autorise l'export
 * `metadata` / `viewport` QUE depuis des Server Components. Ce layout est
 * un Server Component (pas de `"use client"`) : il peut donc exporter la
 * metadata PWA parent (manifest dédié, theme color, icône Apple) sans
 * casser l'interactivité des pages enfants.
 *
 * Le manifest root (`layout.tsx` racine) reste inchangé : il référence
 * `/manifest.json` pour le portail prof. Ici, on surcharge avec
 * `/manifest-parent.json` uniquement pour les routes `/portal*`.
 */

export const metadata: Metadata = {
  title: "ScolaGest Parent — Portail familles",
  description:
    "Consultez les soldes et paiements scolaires de vos enfants.",
  manifest: "/manifest-parent.json",
  appleWebApp: {
    capable: true,
    title: "ScolaGest Parent",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/icon.png", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function ParentLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
