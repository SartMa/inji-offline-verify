// Service Worker for VC Verifier
const CACHE_NAME = 'vc-verifier-v1';
const urlsToCache = [
    '/',
    '/static/js/bundle.js',
    '/static/css/main.css',
    '/manifest.json'
];

self.addEventListener('install', event => {
    console.log('Service Worker installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Return cached version or fetch from network
                return response || fetch(event.request);
            })
    );
});

// Background sync
self.addEventListener('sync', event => {
    if (event.tag === 'sync-verifications') {
        console.log('Background sync triggered');
        event.waitUntil(syncData());
    }
});

async function syncData() {
    // Send message to main thread to perform sync
    try {
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({ type: 'SYNC_REQUESTED' });
        });
    } catch (error) {
        console.error('Error during background sync:', error);
    }
}

self.addEventListener('message', event => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
