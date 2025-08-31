// Service Worker for VC Verifier
const CACHE_NAME = 'vc-verifier-v1';
const urlsToCache = ['/'];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});

// Background sync
self.addEventListener('sync', event => {
    if (event.tag === 'sync-verifications') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    // Send message to main thread to perform sync
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
        client.postMessage({ type: 'SYNC_REQUESTED' });
    });
}