const CACHE = "ihsan-academy-pwa-v169-20261121-14";
const ASSET_VERSION = "20261121-14";

const SHELL = [
  "/",
  "/index.html",
  "/fonts.css?v=" + ASSET_VERSION,
  "/style.css?v=" + ASSET_VERSION,
  "/app.js?v=" + ASSET_VERSION,
  "/qr.js?v=" + ASSET_VERSION,
  "/jsQR.js?v=" + ASSET_VERSION,
  "/scanner.js?v=" + ASSET_VERSION,
  "/startup.js?v=" + ASSET_VERSION,
  "/manifest.json",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
  "/about",
  "/privacy"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      // Tolerate individual misses so a single 404 never blocks the whole install.
      .then(cache => Promise.allSettled(SHELL.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", event => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // Pages: network first, fall back to the cached page, then to the app shell.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}));
          }
          return response;
        })
        .catch(() =>
          caches.match(request, { ignoreSearch: true })
            .then(cached => cached || caches.match("/") || caches.match("/index.html"))
        )
    );
    return;
  }

  // Immutable self-hosted fonts: cache first.
  if (url.pathname.startsWith("/fonts/")) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}));
        }
        return response;
      }))
    );
    return;
  }

  // Other static assets: fresh when online, cached when offline.
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true }))
  );
});
