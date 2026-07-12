import type { Metadata, Viewport } from "next";

/**
 * ScolaGest — Layout Server Component pour la route `/parent` (login).
 *
 * La page `page.tsx` est un Client Component (`"use client"`) car elle
 * utilise `useEffect` (redirection conditionnelle) et `useAuthStore`.
 * Next.js App Router n'autorise l'export `metadata` QUE depuis des Server
 * Components : ce layout (Server) est donc le seul endroit où référencer
 * le manifest PWA parent pour la page de connexion.
 *
 * Manifest root (`layout.tsx` racine) : INTACT — il garde `/manifest.json`
 * pour le portail prof. Ici on surcharge avec `/manifest-parent.json`
 * uniquement pour `/parent`.
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

export default function ParentAuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <>{children}</>;
}
