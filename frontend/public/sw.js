// Service Worker for MTT Trend PWA
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass-through fetch handler to satisfy Chrome's PWA install requirement
  // without caching development assets and breaking hot reloading.
  event.respondWith(fetch(event.request));
});
