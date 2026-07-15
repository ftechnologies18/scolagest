import type { NextConfig } from "next";

/**
 * ScolaGest — Configuration Next.js
 *
 * Sécurité :
 *  - output: "standalone" (optimisation Docker/Vercel)
 *  - headers() : CSP stricte, X-Frame-Options, HSTS, etc.
 *  - reactStrictMode: false (évite les double-renders en dev qui perturbent
 *    les wizards multi-étapes avec state local)
 *
 * CSP (Content-Security-Policy) :
 *  - default-src 'self' : charge uniquement les ressources du même domaine
 *  - script-src : 'self' + 'unsafe-inline' (Next.js inline scripts) + 'unsafe-eval' (dev HMR)
 *  - style-src : 'self' + 'unsafe-inline' (Tailwind CSS inline styles)
 *  - img-src : 'self' + data: + blob: + https: (avatars, photos R2 potentiel)
 *  - connect-src : 'self' + backend Render (API calls)
 *  - frame-ancestors 'none' : empêche l'intégration en iframe (clickjacking)
 *  - base-uri 'self' : empêche la réécriture de <base>
 *  - form-action 'self' : empêche les soumissions de formulaire vers l'extérieur
 */
const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "";
    const connectSrc = backendUrl
      ? `'self' ${backendUrl}`
      : "'self'";

    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
      `style-src 'self' 'unsafe-inline'`,
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src ${connectSrc}`,
      "media-src 'self'",
      "object-src 'none'",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
};

export default nextConfig;
