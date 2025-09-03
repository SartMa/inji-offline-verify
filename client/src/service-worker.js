/* eslint-disable no-undef */
// PWA Service Worker (Workbox InjectManifest)
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';

// Immediately take control on update
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Precache build assets
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// SPA navigation fallback to index.html
const handler = createHandlerBoundToURL('/index.html');
const navigationRoute = new NavigationRoute(handler, {
    denylist: [/^\/api\//],
});
registerRoute(navigationRoute);

// Background sync to trigger app sync hook
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-verifications') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    try {
        const clients = await self.clients.matchAll();
        clients.forEach((client) => client.postMessage({ type: 'SYNC_REQUESTED' }));
    } catch (err) {
        console.error('SW sync error', err);
    }
}