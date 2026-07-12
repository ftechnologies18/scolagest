/**
 * ScolaGest Parent — Service Worker (PWA offline).
 *
 * Scope volontairement large (`/`) mais n'intercepte QUE les ressources
 * explicitly mises en cache (ASSETS) et les requêtes API/GET qui passent
 * par le cache. Les routes staff (`/dashboard`, `/prof`, `/caisse`, etc.)
 * ne sont jamais mises en cache et ne sont pas interceptées par ce SW —
 * elles tombent dans le `fetch(event.request)` par défaut du navigateur.
 *
 * Stratégies :
 *   - Install : pré-cache des ressources parent essentielles (shell PWA).
 *   - Activate : nettoyage des anciens caches (v1 → v2, etc.).
 *   - Fetch :
 *       • API (`/api/*`, GET uniquement) → network-first avec fallback cache
 *         (permet de consulter offline les dernières données chargées).
 *       • Assets statiques (CSS/JS/images/polices) → cache-first.
 *       • Routes parent HTML (`/parent`, `/portal`) → cache-first avec mise
 *         à jour en arrière-plan (stale-while-revalidate simplifié).
 *       • Tout le reste → réseau (pas d'interception).
 *
 * Le SW est une amélioration progressive : en cas d'erreur d'enregistrement
 * ou d'exécution, l'app reste pleinement fonctionnelle en mode navigateur.
 */

const CACHE_NAME = "scolagest-parent-v1";

// Ressources pré-cachées au install (shell minimal du portail parent).
// On n'inclut QUE des routes/ressources parent — pas de routes staff/prof.
const ASSETS = [
  "/parent",
  "/portal",
  "/logo.png",
  "/icon.png",
  "/favicon.png",
  "/manifest-parent.json",
];

// ===== INSTALL : pré-cache du shell PWA parent =====
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        // addAll échoue si une seule ressource est introuvable ; on ignore
        // les erreurs individuelles pour ne pas casser l'installation.
        Promise.allSettled(ASSETS.map((url) => cache.add(url))),
      ),
  );
  self.skipWaiting();
});

// ===== ACTIVATE : nettoyage des anciens caches =====
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// ===== FETCH : stratégies de cache conditionnelles =====
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // N'intercepter que les requêtes same-origin (ignorer les CDN tiers,
  // Google Fonts, etc. qui ont leurs propres politiques de cache).
  if (url.origin !== self.location.origin) return;

  // Ignorer les méthodes non-GET (POST/PUT/DELETE) — jamais mises en cache.
  if (request.method !== "GET") return;

  // --- API : network-first avec fallback cache (consultation offline) ---
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Ne mettre en cache que les réponses valides (200) et CORS-ok.
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  // --- Assets statiques (CSS/JS/polices/images) : cache-first ---
  const isStaticAsset =
    /\.(?:css|js|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|ico|avif)$/i.test(
      url.pathname,
    ) || url.pathname.startsWith("/_next/");

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok && response.type === "basic") {
              const copy = response.clone();
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // --- Routes HTML (navigation) : stale-while-revalidate ---
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response.ok && response.type === "basic") {
              const copy = response.clone();
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, copy));
            }
            return response;
          })
          // Si pas de réseau et pas de cache, on tente le fallback /parent.
          .catch(() => cached || caches.match("/parent"));
        return cached || networkFetch;
      }),
    );
    return;
  }

  // --- Tout le reste : pas d'interception (laisser le navigateur gérer) ---
});
