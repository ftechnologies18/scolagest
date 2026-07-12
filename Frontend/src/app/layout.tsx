import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ScolaGest — Gestion & Caisse Scolaire",
  description:
    "Application web de gestion et de caisse scolaire pour le Groupe Scolaire Le Chandelier (Dabou, Côte d'Ivoire).",
  keywords: [
    "ScolaGest",
    "caisse scolaire",
    "gestion scolaire",
    "Dabou",
    "Côte d'Ivoire",
  ],
  authors: [{ name: "Freelance Technologies Côte d'Ivoire" }],
  // PWA — manifeste pour l'installation sur smartphone (portail prof).
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "ScolaGest",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/favicon-icon.png", type: "image/png" },
    ],
    apple: [{ url: "/icon.png", type: "image/png" }],
  },
};

// PWA — couleur de thème (barre d'état mobile). Next.js 14+ attend ce champ
// dans l'export `viewport`, pas dans `metadata`.
export const viewport: Viewport = {
  themeColor: "#059669",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
