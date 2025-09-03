import { getUnsyncedVerifications, markAsSynced, getDeviceId } from './dbService';
import { getApiBaseUrl, getAccessToken, refreshAccessToken } from './authService';

const SYNC_ENDPOINT = () => {
    const base = getApiBaseUrl();
    return base ? `${base}/api/sync/` : null;
};

export async function syncToServer() {
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

        // Prepare auth header, refresh if needed
        let token = getAccessToken();
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // Server expects a raw array of log objects
        let response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(pendingData.map(item => ({
                id: item.id || undefined,
                verification_status: item.status?.toUpperCase() === 'FAILURE' ? 'FAILED' : 'SUCCESS',
                verified_at: item.timestamp,
                vc_hash: item.hash,
                credential_subject: item,
                error_message: item.error || null,
            })))
        });

        // Try one refresh on 401
        if (response.status === 401) {
            const newAccess = await refreshAccessToken();
            if (!newAccess) throw new Error('Unauthorized and refresh failed');
            headers['Authorization'] = `Bearer ${newAccess}`;
            response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(pendingData.map(item => ({
                    id: item.id || undefined,
                    verification_status: item.status?.toUpperCase() === 'FAILURE' ? 'FAILED' : 'SUCCESS',
                    verified_at: item.timestamp,
                    vc_hash: item.hash,
                    credential_subject: item,
                    error_message: item.error || null,
                })))
            });
        }

        if (response.ok) {
            const result = await response.json();
            
            // Mark successfully synced items
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
}

export async function registerBackgroundSync() {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register('sync-verifications');
            console.log('Background sync registered');
        } catch (error) {
            console.error('Background sync registration failed:', error);
        }
    }
}