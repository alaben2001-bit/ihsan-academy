const CACHE = 'ihsan-academy-shell-v81-2026-10-22';
const SHELL = [
  '/',
  '/index.html',
  '/assets/app.css?v=73.0',
  '/assets/admin-mobile.css?v=70.0',
  '/assets/ui-organize.css?v=1.0',
  '/assets/login-redesign.css?v=2.0',
  '/assets/premium-interface.css?v=76.0',
  '/assets/messaging.css?v=1.0',
  '/assets/app.js?v=81.0',
  '/assets/icon.svg',
  '/assets/ihsan-emblem.svg',
  '/manifest.json',
  '/offline.html'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  // API responses may contain private or changing records; never cache them here.
  if (url.origin !== self.location.origin ||
      request.method !== 'GET' ||
      url.pathname.startsWith('/api/')) {
    return;
  }

  const cachedFallback = () => caches.match(request, { ignoreSearch: true });

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}));
        }
        return response;
      }).catch(async () => {
        return (await cachedFallback()) || (await caches.match('/offline.html'));
      })
    );
    return;
  }

  event.respondWith(
    fetch(request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE).then(cache => cache.put(request, copy)).catch(() => {}));
      }
      return response;
    }).catch(() => cachedFallback())
  );
});
