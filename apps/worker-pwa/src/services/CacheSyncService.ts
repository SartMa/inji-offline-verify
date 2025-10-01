/**
 * CacheSyncService - Handles automatic synchronization of organization data
 * (contexts, public keys) when network is available
 */

import { SDKCacheManager } from '../../../../packages/inji-verify-sdk/src/services/offline-verifier/cache/SDKCacheManager';
import type { CacheBundle } from '../../../../packages/inji-verify-sdk/src/services/offline-verifier/cache/utils/OrgResolver';
import { NetworkService } from './NetworkService';
import type { NetworkStatusListener } from './NetworkService';
import { NetworkManager } from '../network/NetworkManager';

export interface SyncItemsUpdated {
  publicKeys: number;
  contexts: number;
  statusLists?: number; // number of status list credentials updated
}

export interface SyncMetadata {
  lastSyncTime: number;
  lastSyncVersion?: string;
  organizationId: string;
  lastItemsUpdated?: SyncItemsUpdated;
}

export interface SyncResult {
  success: boolean;
  itemsUpdated: SyncItemsUpdated;
  error?: string;
}

export interface CacheSyncEventPayload {
  organizationId: string;
  result: SyncResult;
  timestamp: number;
}

export class CacheSyncService implements NetworkStatusListener {
  private static instance: CacheSyncService;
  private networkService: NetworkService;
  private isSyncing: boolean = false;
  private syncQueue: Set<string> = new Set(); // Organization IDs to sync
  private lastSyncMetadata: Map<string, SyncMetadata> = new Map();
  private syncInterval: number | null = null;

  private constructor() {
    this.networkService = NetworkService.getInstance();
    this.networkService.addListener(this);
    this.loadSyncMetadata();
  }

  public static getInstance(): CacheSyncService {
    if (!CacheSyncService.instance) {
      CacheSyncService.instance = new CacheSyncService();
    }
    return CacheSyncService.instance;
  }

  private loadSyncMetadata(): void {
    try {
      const stored = localStorage.getItem('cache_sync_metadata');
      if (stored) {
        const data = JSON.parse(stored);
        const entries = Object.entries(data).map(([orgId, value]) => {
          const meta = (value ?? {}) as Partial<SyncMetadata> & { lastItemsUpdated?: Partial<SyncItemsUpdated> };
          const normalized: SyncMetadata = {
            organizationId: typeof meta.organizationId === 'string' && meta.organizationId.length > 0 ? meta.organizationId : orgId,
            lastSyncTime: typeof meta.lastSyncTime === 'number' ? meta.lastSyncTime : Number(meta.lastSyncTime) || 0,
            lastSyncVersion: meta.lastSyncVersion,
            lastItemsUpdated: meta.lastItemsUpdated
              ? {
                  publicKeys: Number(meta.lastItemsUpdated.publicKeys) || 0,
                  contexts: Number(meta.lastItemsUpdated.contexts) || 0,
                }
              : undefined,
          };
          return [orgId, normalized] as const;
        });
        this.lastSyncMetadata = new Map(entries);
      }
    } catch (error) {
      console.warn('[CacheSyncService] Failed to load sync metadata:', error);
    }
  }

  private saveSyncMetadata(): void {
    try {
      const data = Object.fromEntries(
        Array.from(this.lastSyncMetadata.entries()).map(([orgId, meta]) => [orgId, {
          organizationId: meta.organizationId,
          lastSyncTime: meta.lastSyncTime,
          lastSyncVersion: meta.lastSyncVersion,
          lastItemsUpdated: meta.lastItemsUpdated,
        }])
      );
      localStorage.setItem('cache_sync_metadata', JSON.stringify(data));
    } catch (error) {
      console.warn('[CacheSyncService] Failed to save sync metadata:', error);
    }
  }

  /**
   * Persist the current organization ID for periodic syncs
   */
  public setCurrentOrganizationId(organizationId: string): void {
    try {
      localStorage.setItem('organizationId', organizationId);
    } catch {}
  }

  /**
   * Notify app that cache has updated so UI can refresh without reload
   */
  private notifyCacheUpdated(organizationId: string, result: SyncResult): void {
    try {
      window.dispatchEvent(new CustomEvent('background-sync', {
        detail: {
          type: 'cache_updated',
          payload: {
            organizationId,
            result,
            timestamp: Date.now()
          }
        }
      }));
    } catch {}
  }

  /**
   * Called when network comes online
   */
  public onOnline(): void {
    this.startPeriodicSync();
    
    // Force sync current organization immediately when network comes back
    const currentOrgId = this.getCurrentOrganizationId();
    if (currentOrgId) {
      this.forceSyncOrganization(currentOrgId).catch(error => {
        console.error('[CacheSyncService] Failed to force sync on network reconnection:', error);
      });
    }
    
    this.processSyncQueue();
  }

  /**
   * Called when network goes offline
   */
  public onOffline(): void {
    this.stopPeriodicSync();
  }

  /**
   * Start periodic synchronization (every 10 minutes when online)
   */
  private startPeriodicSync(): void {
    if (this.syncInterval) return;
    
    this.syncInterval = window.setInterval(() => {
      if (this.networkService.getIsOnline()) {
        this.syncAllOrganizations();
      }
    }, 90 * 1000); // 90 seconds
  }

  /**
   * Stop periodic synchronization
   */
  private stopPeriodicSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Queue an organization for synchronization
   */
  public queueSync(organizationId: string): void {
    this.syncQueue.add(organizationId);
    
    if (this.networkService.getIsOnline()) {
      // If online, process immediately
      setTimeout(() => this.processSyncQueue(), 1000);
    }
  }

  /**
   * Process all queued sync requests
   */
  private async processSyncQueue(): Promise<void> {
    if (this.isSyncing || this.syncQueue.size === 0) return;

    const orgIds = Array.from(this.syncQueue);
    this.syncQueue.clear();

    for (const orgId of orgIds) {
      try {
        await this.syncOrganization(orgId);
      } catch (error) {
        console.error(`[CacheSyncService] Failed to sync organization ${orgId}:`, error);
        // Re-queue failed syncs for later retry
        this.syncQueue.add(orgId);
      }
    }
  }

  /**
   * Sync all organizations that need updating
   */
  private async syncAllOrganizations(): Promise<void> {
    // Gather all known organization IDs: current + any from previous syncs
    const orgIds = new Set<string>();
    const currentOrgId = this.getCurrentOrganizationId();
    if (currentOrgId) orgIds.add(currentOrgId);
    for (const orgId of this.lastSyncMetadata.keys()) orgIds.add(orgId);

    for (const orgId of orgIds) {
      await this.syncOrganization(orgId);
    }
  }

  /**
   * Synchronize data for a specific organization
   */
  public async syncOrganization(organizationId: string): Promise<SyncResult> {
    if (!this.networkService.getIsOnline()) {
      return this.createFailureResult('No network connection');
    }

    const lastSync = this.lastSyncMetadata.get(organizationId);
    const now = Date.now();

    // Check if we should skip this sync (too recent) - reduced cooldown to 10 seconds  
    if (lastSync && !this.networkService.shouldSync(lastSync.lastSyncTime, 10 * 1000)) {
      return {
        success: true,
        itemsUpdated: { publicKeys: 0, contexts: 0, statusLists: 0 }
      };
    }

    this.isSyncing = true;

    try {
      // Fetch latest data from server
      const bundle = await this.fetchOrganizationData(organizationId);
      
      const result: SyncResult = {
        success: true,
        itemsUpdated: {
          publicKeys: bundle.publicKeys?.length || 0,
          contexts: bundle.contexts?.length || 0,
          statusLists: (bundle as any).statusListCredentials?.length || 0
        }
      };

      // Update the cache with new data using sync method (replaces instead of adds)
      await SDKCacheManager.syncFromServer(bundle, organizationId);

      // Update sync metadata
      this.recordSyncMetadata(organizationId, result, now);

      // Broadcast cache update so UI can reflect changes without reload
      this.notifyCacheUpdated(organizationId, result);

      return result;

    } catch (error) {
      console.error(`[CacheSyncService] Sync failed for organization ${organizationId}:`, error);
      return this.createFailureResult(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Force synchronization for a specific organization (bypasses cooldown)
   */
  public async forceSyncOrganization(organizationId: string): Promise<SyncResult> {
    if (!this.networkService.getIsOnline()) {
      return this.createFailureResult('No network connection');
    }

    this.isSyncing = true;

    try {
      // Fetch latest data from server
      const bundle = await this.fetchOrganizationData(organizationId);
      
      // Update the cache with new data using sync method (replaces instead of adds)
      await SDKCacheManager.syncFromServer(bundle, organizationId);

      // Update sync metadata
      const now = Date.now();
      const result: SyncResult = {
        success: true,
        itemsUpdated: {
          publicKeys: bundle.publicKeys?.length || 0,
          contexts: bundle.contexts?.length || 0
        }
      };

      this.recordSyncMetadata(organizationId, result, now);

      // Broadcast cache update so UI can reflect changes without reload
      this.notifyCacheUpdated(organizationId, result);

      return result;

    } catch (error) {
      console.error(`[CacheSyncService] Force sync failed for organization ${organizationId}:`, error);
      return this.createFailureResult(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Fetch organization data from server (same as login flow)
   */
  private async fetchOrganizationData(organizationId: string): Promise<CacheBundle> {
    // Fetch contexts
    const ctxRes = await NetworkManager.fetch(`/organization/api/contexts/?organization_id=${encodeURIComponent(organizationId)}`, { method: 'GET' });
    if (!ctxRes.ok) throw new Error(`Failed to fetch contexts (${ctxRes.status})`);
    const ctxJson = await ctxRes.json();
    const contexts = Array.isArray(ctxJson?.contexts)
      ? ctxJson.contexts.map((c: any) => ({ url: c.url, document: c.document }))
      : [];

    // Fetch public keys
    const pkRes = await NetworkManager.fetch(`/organization/api/public-keys/?organization_id=${encodeURIComponent(organizationId)}`, { method: 'GET' });
    if (!pkRes.ok) throw new Error(`Failed to fetch public keys (${pkRes.status})`);
    const pkJson = await pkRes.json();
    const publicKeys = Array.isArray(pkJson?.keys)
      ? pkJson.keys.map((k: any) => ({
          key_id: k.key_id,
          key_type: k.key_type,
          public_key_multibase: k.public_key_multibase,
          public_key_hex: k.public_key_hex,
          public_key_jwk: k.public_key_jwk,
          controller: k.controller,
          purpose: k.purpose,
          is_active: k.is_active,
          organization_id: organizationId,
        }))
      : [];
    
      // Fetch status list credentials (optional endpoint)
      let statusListCredentials: any[] = [];
      try {
        const slRes = await NetworkManager.fetch(`/organization/api/status-list-credentials/?organization_id=${encodeURIComponent(organizationId)}`, { method: 'GET' });
        if (slRes.ok) {
          const slJson = await slRes.json();
          if (Array.isArray(slJson?.status_list_credentials)) {
            statusListCredentials = slJson.status_list_credentials.map((c: any) => ({
              status_list_id: c.status_list_id || c.statusListId || c.id,
              issuer: c.issuer,
              status_purpose: c.status_purpose || c.statusPurpose || c.credentialSubject?.statusPurpose || 'revocation',
              full_credential: c.full_credential || c.fullCredential || c.credential || c,
              organization_id: organizationId
            })).filter((c: any) => !!c.status_list_id);
          }
        } else {
          console.log('[CacheSyncService] Status list credentials endpoint returned', slRes.status);
        }
      } catch (e) {
        console.warn('[CacheSyncService] Failed to fetch status list credentials (non-fatal):', e);
      }

      // Return extended bundle including status list credentials for SDKCacheManager
      return {
        publicKeys,
        contexts,
        statusListCredentials
      } as any;
  }

  /**
   * Get current organization ID from storage
   */
  private getCurrentOrganizationId(): string | null {
    // Try multiple possible storage keys
    const keys = ['organization_id', 'organizationId', 'current_org_id'];
    for (const key of keys) {
      const val = localStorage.getItem(key);
      if (val) return val;
    }
    return null;
  }

  /**
   * Force immediate synchronization for current organization
   */
  public async forceSyncCurrent(): Promise<SyncResult> {
    const orgId = this.getCurrentOrganizationId();
    if (!orgId) {
      return {
        success: false,
        itemsUpdated: { publicKeys: 0, contexts: 0, statusLists: 0 },
        error: 'No current organization found'
      };
    }

    // Use force sync to bypass cooldowns and version checks
    return await this.forceSyncOrganization(orgId);
  }

  /**
   * Get sync status for an organization
   */
  public getSyncStatus(organizationId: string): SyncMetadata | null {
    return this.lastSyncMetadata.get(organizationId) || null;
  }

  public recordSyncMetadata(organizationId: string, result: SyncResult, timestamp: number = Date.now()): void {
    const existing = this.lastSyncMetadata.get(organizationId);
    const counts: SyncItemsUpdated = {
      publicKeys: result.itemsUpdated.publicKeys,
      contexts: result.itemsUpdated.contexts,
      statusLists: result.itemsUpdated.statusLists ?? 0
    };
    this.lastSyncMetadata.set(organizationId, {
      organizationId,
      lastSyncTime: timestamp,
      lastSyncVersion: existing?.lastSyncVersion,
      lastItemsUpdated: counts,
    });
    this.saveSyncMetadata();
  }

  private createFailureResult(message: string): SyncResult {
    return {
      success: false,
      itemsUpdated: { publicKeys: 0, contexts: 0, statusLists: 0 },
      error: message
    };
  }

  /**
   * Initialize the service and start monitoring
   */
  public initialize(): void {
    if (this.networkService.getIsOnline()) {
      this.onOnline();
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.stopPeriodicSync();
    this.networkService.removeListener(this);
  }
}