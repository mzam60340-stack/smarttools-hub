/* SmartTools Hub — Service Worker
   Strategy:
   - App shell (this page, manifest, icons): cache-first, refreshed in background.
   - Navigations: network-first, falling back to the cached page, then the offline page.
   - Google Fonts: stale-while-revalidate (fonts are decorative; tools work without them).
   - The QR library (cdnjs) is NOT cached as a guarantee — if it is unavailable
     offline, the QR tool shows its own "library unavailable" message.
   Note for GitHub Pages deployment: copy this file to the repository ROOT
   next to index.html (as sw.js) and register it as "sw.js" so its scope
   covers the whole site. In this preview it lives under assets/.
*/
var CACHE = 'smarttools-hub-v2-p0';
var CORE = [
  '../',
  '../index.html',
  'manifest.webmanifest',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-512.png',
  'apple-touch-icon.png',
  'offline.html'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      // Add one by one so a single 404 never breaks installation.
      return Promise.all(CORE.map(function (url) {
        return cache.add(url).catch(function () { /* skip missing entry */ });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Page navigations: network first, cache/offline fallback.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('../index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('../index.html').then(function (hit) {
          return hit || caches.match('offline.html');
        });
      })
    );
    return;
  }

  // Google Fonts: stale-while-revalidate.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.open(CACHE).then(function (cache) {
        return cache.match(req).then(function (hit) {
          var net = fetch(req).then(function (res) { cache.put(req, res.clone()); return res; }).catch(function () { return hit; });
          return hit || net;
        });
      })
    );
    return;
  }

  // Same-origin static assets: cache-first.
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        });
      })
    );
  }
  // Everything else (e.g. cdnjs QR library): go to network, no forced caching.
});
