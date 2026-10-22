const CACHE = "ihsan-academy-pwa-v101-20261022-137";
const SHELL = ["/", "/index.html", "/style.css?v=20261022-137", "/app.js?v=20261022-137", "/startup.js?v=20261022-137", "/manifest.json", "/icon.svg", "/icon-192.svg", "/icon-512.svg", "/about.html", "/privacy.html", "/robots.txt", "/sitemap.xml"];
self.addEventListener("install", event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== "GET" || url.pathname.startsWith("/api/")) return;
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).then(response => { if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {})); } return response; }).catch(() => caches.match(event.request, {ignoreSearch:true}).then(cached => cached || caches.match("/index.html"))));
    return;
  }
  event.respondWith(fetch(event.request).then(response => { if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)).catch(() => {})); } return response; }).catch(() => caches.match(event.request, {ignoreSearch:true})));
});
