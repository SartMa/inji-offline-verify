import { getUnsyncedVerifications, markAsSynced, type VerificationRecord } from './dbService';
import { getApiBaseUrl, getAccessToken, refreshAccessToken } from '@inji-offline-verify/shared-auth';

const SYNC_ENDPOINT = (): string | null => {
  const base = getApiBaseUrl();
  return base ? `${base}/worker/api/sync/` : null;
};

let inFlightSync: Promise<{ success: boolean; synced?: number; reason?: string; error?: string; retryInMs?: number } | undefined> | null = null;

// Simple exponential backoff to avoid spamming when server is unreachable
// Keep this short so users don't wait too long after coming back online
const COOLDOWN_BASE_MS = 10_000; // 10 seconds
const COOLDOWN_MAX_MS = 60_000; // 1 minute

function loadCooldown(): { until: number; lastMs: number } {
  try {
    const raw = localStorage.getItem('sync.cooldown');
    if (!raw) return { until: 0, lastMs: 0 };
    const parsed = JSON.parse(raw);
    return { until: Number(parsed.until) || 0, lastMs: Number(parsed.lastMs) || 0 };
  } catch {
    return { until: 0, lastMs: 0 };
  }
}

function saveCooldown(until: number, lastMs: number) {
  try {
    localStorage.setItem('sync.cooldown', JSON.stringify({ until, lastMs }));
  } catch {}
}

export function resetSyncCooldown() {
  saveCooldown(0, 0);
}

export function canSyncNow(): boolean {
  if (!navigator.onLine) return false;
  const cd = loadCooldown();
  return !(cd.until && Date.now() < cd.until);
}

export async function syncToServer() {
  if (inFlightSync) {
    console.log('Sync already in progress; coalescing request');
    return inFlightSync;
  }
  inFlightSync = (async () => {
    // Respect cooldown window when previous attempts failed
    const now = Date.now();
    const cd = loadCooldown();
    if (cd.until && now < cd.until) {
      const retryInMs = cd.until - now;
      console.log(`Sync on cooldown; skipping. Next attempt in ${Math.ceil(retryInMs / 1000)}s`);
      return { success: false, reason: 'cooldown' as const, retryInMs };
    }

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
          // Use the correct fields from the VerificationRecord type
          id: item.uuid, // The backend expects the UUID as 'id'
          verification_status: item.verification_status,
          verified_at: item.verified_at,
          vc_hash: item.vc_hash,
          credential_subject: item.credential_subject,
          error_message: item.error_message,
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
        // Reset cooldown on success
        saveCooldown(0, 0);
        // Use the uuid to mark as synced
        const syncedUuids = pendingData.map((item) => item.uuid);
        await markAsSynced(syncedUuids);
        console.log(`Successfully synced ${syncedUuids.length} items`);
        return { success: true, synced: syncedUuids.length };
      } else {
        const errorBody = await response.text();
        console.error('Server error body:', errorBody);
        throw new Error(`Server responded with ${response.status}`);
      }
    } catch (error: any) {
      console.error('Sync failed:', error);
      // Apply/update cooldown
      const prev = loadCooldown();
      const nextMs = Math.min(prev.lastMs ? prev.lastMs * 2 : COOLDOWN_BASE_MS, COOLDOWN_MAX_MS);
      const until = Date.now() + nextMs;
      saveCooldown(until, nextMs);
      console.warn(`Sync entering cooldown for ${Math.ceil(nextMs / 1000)}s due to error.`);
      return { success: false, error: error?.message ?? String(error), reason: 'backoff', retryInMs: nextMs };
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
