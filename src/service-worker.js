
const CACHE_NAME = 'effusion-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/assets/css/app.css',
    '/assets/js/app.js',
    '/assets/js/cursor.js',
    '/favicon.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (event) => {
    // Network first, fall back to cache for HTML, Cache first for assets
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => caches.match('/404.html') || caches.match('/'))
        );
    } else {
        event.respondWith(
            caches.match(event.request).then((response) => response || fetch(event.request))
        );
    }
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.map((key) => {
                if (!key.includes(CACHE_NAME)) return caches.delete(key);
            })
        ))
    );
});
