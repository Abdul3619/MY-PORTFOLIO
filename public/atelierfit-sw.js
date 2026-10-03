// Minimal service worker, scoped to /atelierfit only (see the register() call in src/pages/AtelierFit/index.tsx).
// Its only job is to satisfy the browser's installability checks (a fetch handler + a cached offline fallback) --
// this app needs a live connection to actually place an order, so there's no attempt at full offline support.
const CACHE = "atelierfit-shell-v2";
const SHELL_URL = "/atelierfit";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(SHELL_URL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(SHELL_URL).then((r) => r || Response.error()))
  );
});
