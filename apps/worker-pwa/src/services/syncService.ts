import { getUnsyncedVerifications, markAsSynced, getDeviceId, type VerificationRecord } from './dbService';
import { getApiBaseUrl, getAccessToken, refreshAccessToken } from './authService';

const SYNC_ENDPOINT = (): string | null => {
  const base = getApiBaseUrl();
  return base ? `${base}/worker/api/sync/` : null;
};

let inFlightSync: Promise<{ success: boolean; synced?: number; reason?: string; error?: string } | undefined> | null = null;

export async function syncToServer() {
  if (inFlightSync) {
    console.log('Sync already in progress; coalescing request');
    return inFlightSync;
  }
  inFlightSync = (async () => {
    if (!navigator.onLine) {
      console.log('Offline - sync skipped');
      return { success: false, reason: 'offline' as const };
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
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const body = JSON.stringify(
        pendingData.map((item: VerificationRecord) => ({
          verification_status: item.status?.toUpperCase() === 'FAILURE' ? 'FAILED' : 'SUCCESS',
          verified_at: item.timestamp,
          vc_hash: (item as any).hash,
          credential_subject: item,
          error_message: item.error || null,
          device_id: getDeviceId(),
        }))
      );

      let response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body,
      });

      if (response.status === 401) {
        const newAccess = await refreshAccessToken();
        if (!newAccess) throw new Error('Unauthorized and refresh failed');
        headers['Authorization'] = `Bearer ${newAccess}`;
        response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body,
        });
      }

      if (response.ok) {
        const syncedIds = pendingData.map((item) => item.id!).filter(Boolean) as number[];
        await markAsSynced(syncedIds);
        console.log(`Successfully synced ${syncedIds.length} items`);
        return { success: true, synced: syncedIds.length };
      } else {
        throw new Error(`Server responded with ${response.status}`);
      }
    } catch (error: any) {
      console.error('Sync failed:', error);
      return { success: false, error: error?.message ?? String(error) };
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
      const tags = await (registration as any).sync.getTags();
      if (!tags.includes('sync-verifications')) {
        await (registration as any).sync.register('sync-verifications');
        console.log('Background sync registered');
      } else {
        console.log('Background sync already registered');
      }
    } catch (error) {
      console.error('Background sync registration failed:', error);
    }
  }
}
