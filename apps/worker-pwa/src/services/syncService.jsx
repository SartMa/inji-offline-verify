import { getUnsyncedVerifications, markAsSynced, getDeviceId } from './dbService';
import { getApiBaseUrl, getAccessToken, refreshAccessToken } from './authService';

const SYNC_ENDPOINT = () => {
    const base = getApiBaseUrl();
    return base ? `${base}/worker/api/sync/` : null;
};

let inFlightSync = null;

export async function syncToServer() {
    if (inFlightSync) {
        console.log('Sync already in progress; coalescing request');
        return inFlightSync;
    }
    inFlightSync = (async () => {
        if (!navigator.onLine) {
            console.log('Offline - sync skipped');
            return { success: false, reason: 'offline' };
        }

        try {
            const pendingData = await getUnsyncedVerifications();

            if (pendingData.length === 0) {
                console.log('No pending data to sync');
                return { success: true, synced: 0 };
            }

            const endpoint = SYNC_ENDPOINT();
            if (!endpoint) throw new Error('Base URL not set. Login first.');

            console.log(`Syncing ${pendingData.length} items to server...`);

            let token = getAccessToken();
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = `Bearer ${token}`;

            // Do not send local "id" to avoid PK collisions during concurrent posts
            let response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(pendingData.map(item => ({
                    // id: item.id, // removed to avoid duplicate PK conflicts
                    verification_status: item.status?.toUpperCase() === 'FAILURE' ? 'FAILED' : 'SUCCESS',
                    verified_at: item.timestamp,
                    vc_hash: item.hash,
                    credential_subject: item,
                    error_message: item.error || null,
                    device_id: getDeviceId(),
                })))
            });

            if (response.status === 401) {
                const newAccess = await refreshAccessToken();
                if (!newAccess) throw new Error('Unauthorized and refresh failed');
                headers['Authorization'] = `Bearer ${newAccess}`;
                response = await fetch(endpoint, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(pendingData.map(item => ({
                        verification_status: item.status?.toUpperCase() === 'FAILURE' ? 'FAILED' : 'SUCCESS',
                        verified_at: item.timestamp,
                        vc_hash: item.hash,
                        credential_subject: item,
                        error_message: item.error || null,
                        device_id: getDeviceId(),
                    })))
                });
            }

            if (response.ok) {
                const syncedIds = pendingData.map(item => item.id);
                await markAsSynced(syncedIds);
                console.log(`Successfully synced ${syncedIds.length} items`);
                return { success: true, synced: syncedIds.length };
            } else {
                throw new Error(`Server responded with ${response.status}`);
            }
        } catch (error) {
            console.error('Sync failed:', error);
            return { success: false, error: error.message };
        }
    })();

    try {
        return await inFlightSync;
    } finally {
        inFlightSync = null;
    }
}

export async function registerBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
            const registration = await navigator.serviceWorker.ready;
            const tags = await registration.sync.getTags();
            if (!tags.includes('sync-verifications')) {
                await registration.sync.register('sync-verifications');
                console.log('Background sync registered');
            } else {
                console.log('Background sync already registered');
            }
        } catch (error) {
            console.error('Background sync registration failed:', error);
        }
    }
}