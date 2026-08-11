/* sw.js — Modern PWA Service Worker (Cache-First with Network Fallback) */
const CACHE_NAME = 'effusion-labs-v1'
const ASSETS = [
  '/',
  '/assets/css/app.css',
  '/assets/js/app.js',
  '/favicon.svg',
  '/site.webmanifest',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS)
    }),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      )
    }),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse

      return fetch(event.request).then((networkResponse) => {
        if (
          !networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic'
        ) {
          return networkResponse
        }

        const responseToCache = networkResponse.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache)
        })

        return networkResponse
      }).catch(() => {
        // Fallback for offline mode if needed
      })
    }),
  )
})
