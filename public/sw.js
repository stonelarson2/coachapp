// CoachFit service worker.
// Deliberately conservative so it can't serve stale app code on a live site:
//  - Navigations: network-first, falling back to cache only when offline.
//  - Hashed build assets (/_next/static, immutable): stale-while-revalidate.
//  - Everything else (APIs, non-GET): straight to the network, untouched.

const CACHE = "coachfit-v1";

self.addEventListener("install", (event) => {
  // Activate this worker immediately on first install.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(["/", "/icon.svg"]).catch(() => {})),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop caches from older versions.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // never touch cross-origin (Firebase, APIs)
  if (url.pathname.startsWith("/api/")) return;

  // Immutable, content-hashed build assets: serve from cache, refresh in background.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((res) => {
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  // Page navigations: network-first so users always get fresh app code online.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("/").then((r) => r || caches.match(request))),
    );
  }
});
