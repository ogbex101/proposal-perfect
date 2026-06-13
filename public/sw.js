// Service Worker — Xperience Props PWA
// Strategy: Network-first for API/server calls, Cache-first for static assets.

const CACHE_NAME = "xp-props-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
];

// Assets we never want to cache (auth, API, server functions)
const BYPASS_PATTERNS = [
  /\/_server\//,
  /\/api\//,
  /supabase\.co/,
  /lovable\.dev/,
  /pollinations\.ai/,
  /loremflickr\.com/,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== "GET") return;

  // Bypass patterns — always go to network
  if (BYPASS_PATTERNS.some((p) => p.test(request.url))) return;

  // For navigation requests (HTML pages) — network first, fall back to cache
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/")))
    );
    return;
  }

  // For static assets (JS, CSS, fonts, images) — cache first, then network
  if (
    url.pathname.match(/\.(js|css|woff2?|ttf|otf|svg|png|jpg|webp|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone)).catch(() => {});
          return res;
        });
      })
    );
  }
});
