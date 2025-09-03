import { getUnsyncedVerifications, markAsSynced, getDeviceId } from './dbService';

const SYNC_ENDPOINT = 'https://your-django-server.com/api/sync'; // Configure your Django endpoint

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

        console.log(`Syncing ${pendingData.length} items to server...`);
        
        // Batch sync to Django server
        const response = await fetch(SYNC_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                verifications: pendingData,
                deviceId: getDeviceId(),
                timestamp: new Date().toISOString()
            })
        });

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