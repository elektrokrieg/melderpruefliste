/* Melder-Prüfliste · Service Worker */

var CACHE_PREFIX = 'melderpruefliste-';
var VERSION_URL  = './version.json';

/* Assets to cache on install — update this list if you add files */
var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-32.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

/* ── Install: cache all assets ── */
self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    fetch(VERSION_URL, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var cacheName = CACHE_PREFIX + data.version;
        return caches.open(cacheName).then(function (cache) {
          return cache.addAll(ASSETS);
        });
      })
  );
});

/* ── Activate: delete every cache that doesn't match current version ── */
self.addEventListener('activate', function (e) {
  e.waitUntil(
    fetch(VERSION_URL, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var current = CACHE_PREFIX + data.version;
        return caches.keys().then(function (keys) {
          return Promise.all(
            keys
              .filter(function (k) { return k.startsWith(CACHE_PREFIX) && k !== current; })
              .map(function (k) { return caches.delete(k); })
          );
        });
      })
      .then(function () { return self.clients.claim(); })
  );
});

/* ── Fetch: version.json always from network; everything else cache-first ── */
self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  /* Always fetch version.json fresh so we notice updates immediately */
  if (url.pathname.endsWith('version.json')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(function (networkResponse) {
          /* If version changed, tell all open tabs to reload */
          networkResponse.clone().json().then(function (data) {
            var current = CACHE_PREFIX + data.version;
            caches.keys().then(function (keys) {
              var hasNew = keys.some(function (k) { return k === current; });
              var hasOld = keys.some(function (k) { return k.startsWith(CACHE_PREFIX) && k !== current; });
              if (hasOld && !hasNew) {
                /* New version available — notify clients */
                self.clients.matchAll({ includeUncontrolled: true }).then(function (clients) {
                  clients.forEach(function (c) { c.postMessage({ type: 'UPDATE_AVAILABLE' }); });
                });
              }
            });
          });
          return networkResponse;
        })
        .catch(function () { return caches.match(e.request); })
    );
    return;
  }

  /* Cache-first for all other requests */
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request).then(function (networkResponse) {
        /* Cache a copy of fresh responses */
        if (networkResponse && networkResponse.status === 200 && e.request.method === 'GET') {
          caches.keys().then(function (keys) {
            var current = keys.find(function (k) { return k.startsWith(CACHE_PREFIX); });
            if (current) {
              caches.open(current).then(function (cache) {
                cache.put(e.request, networkResponse.clone());
              });
            }
          });
        }
        return networkResponse;
      });
    })
  );
});
