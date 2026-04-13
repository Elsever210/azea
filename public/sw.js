const CACHE = "vsf-global-cargo-v3";
const ASSETS = [
  "/", "/index.html", "/styles.css", "/manifest.webmanifest",
  "/js/api.js", "/js/i18n.js", "/js/utils.js", "/js/app.js",
  "/js/components/dashboard.js", "/js/components/myorders.js",
  "/js/components/myshipments.js", "/js/components/products.js",
  "/js/components/orders.js", "/js/components/shipments.js",
  "/js/components/tracking.js", "/js/components/reports.js",
  "/js/components/inventory.js", "/js/components/finance.js",
  "/js/components/notifications.js", "/js/components/users.js",
  "/js/components/contacts.js", "/js/components/calculator.js",
  "/js/components/logs.js", "/js/components/settings.js",
  "/lang/az.json", "/lang/en.json", "/lang/tr.json",
  "/lang/ru.json", "/lang/cn.json"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  // Skip API calls, only cache static assets
  if (req.url.includes("/api/")) return;
  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached)
    )
  );
});
