import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

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
  description: "Application web de gestion et de caisse scolaire pour le Groupe Scolaire Le Chandelier (Dabou, Côte d'Ivoire). Phase 0 — Cadrage.",
  keywords: ["ScolaGest", "caisse scolaire", "gestion scolaire", "Dabou", "Côte d'Ivoire", "Next.js", "Go"],
  authors: [{ name: "Freelance Technologies Côte d'Ivoire" }],
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
        {children}
        <Toaster />
      </body>
    </html>
  );
}
