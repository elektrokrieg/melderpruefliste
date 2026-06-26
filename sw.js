/* Melder-Prüfliste · Service Worker */

var CACHE_PREFIX = 'melderpruefliste-';
var VERSION_URL  = './version.json';

var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-32.png',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png'
];

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

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  if (url.pathname.endsWith('version.json')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(function (networkResponse) {
          networkResponse.clone().json().then(function (data) {
            var current = CACHE_PREFIX + data.version;
            caches.keys().then(function (keys) {
              var hasNew = keys.some(function (k) { return k === current; });
              var hasOld = keys.some(function (k) { return k.startsWith(CACHE_PREFIX) && k !== current; });
              if (hasOld && !hasNew) {
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

  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request).then(function (networkResponse) {
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
