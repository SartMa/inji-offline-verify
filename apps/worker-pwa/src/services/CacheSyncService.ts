/**
 * CacheSyncService - Handles automatic synchronization of organization data
 * (contexts, public keys, revoked VCs) when network is available
 */

import { SDKCacheManager } from '../../../../packages/inji-verify-sdk/src/services/offline-verifier/cache/SDKCacheManager';
import type { CacheBundle } from '../../../../packages/inji-verify-sdk/src/services/offline-verifier/cache/utils/OrgResolver';
import { NetworkService } from './NetworkService';
import type { NetworkStatusListener } from './NetworkService';
import { NetworkManager } from '../network/NetworkManager';
import { CacheVersionService } from './CacheVersionService';

interface SyncMetadata {
  lastSyncTime: number;
  lastSyncVersion?: string;
  organizationId: string;
}

interface SyncResult {
  success: boolean;
  itemsUpdated: {
    publicKeys: number;
    contexts: number;
    revokedVCs: number;
  };
  error?: string;
}

export class CacheSyncService implements NetworkStatusListener {
  private static instance: CacheSyncService;
  private networkService: NetworkService;
  private versionService: CacheVersionService;
  private isSyncing: boolean = false;
  private syncQueue: Set<string> = new Set(); // Organization IDs to sync
  private lastSyncMetadata: Map<string, SyncMetadata> = new Map();
  private syncInterval: number | null = null;

  private constructor() {
    this.networkService = NetworkService.getInstance();
    this.versionService = CacheVersionService.getInstance();
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
        this.lastSyncMetadata = new Map(Object.entries(data));
      }
    } catch (error) {
      console.warn('[CacheSyncService] Failed to load sync metadata:', error);
    }
  }

  private saveSyncMetadata(): void {
    try {
      const data = Object.fromEntries(this.lastSyncMetadata);
      localStorage.setItem('cache_sync_metadata', JSON.stringify(data));
    } catch (error) {
      console.warn('[CacheSyncService] Failed to save sync metadata:', error);
    }
  }

  /**
   * Called when network comes online
   */
  public onOnline(): void {
    console.log('[CacheSyncService] Network online - starting cache sync');
    this.startPeriodicSync();
    
    // Force sync current organization immediately when network comes back
    const currentOrgId = this.getCurrentOrganizationId();
    if (currentOrgId) {
      console.log('[CacheSyncService] Force syncing current organization due to network reconnection');
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
    console.log('[CacheSyncService] Network offline - stopping periodic sync');
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
    // Get current user's organization(s) from local storage or API
    const currentOrgId = this.getCurrentOrganizationId();
    if (currentOrgId) {
      await this.syncOrganization(currentOrgId);
    }
  }

  /**
   * Synchronize data for a specific organization
   */
  public async syncOrganization(organizationId: string): Promise<SyncResult> {
    if (!this.networkService.getIsOnline()) {
      return {
        success: false,
        itemsUpdated: { publicKeys: 0, contexts: 0, revokedVCs: 0 },
        error: 'No network connection'
      };
    }

    const lastSync = this.lastSyncMetadata.get(organizationId);
    const now = Date.now();

    // Check if we should skip this sync (too recent) - reduced cooldown to 10 seconds  
    if (lastSync && !this.networkService.shouldSync(lastSync.lastSyncTime, 10 * 1000)) {
      console.log(`[CacheSyncService] Skipping sync for ${organizationId} - too recent (last sync: ${new Date(lastSync.lastSyncTime).toISOString()})`);
      return {
        success: true,
        itemsUpdated: { publicKeys: 0, contexts: 0, revokedVCs: 0 }
      };
    }

    // Use version service to check if sync is actually needed
    const needsSync = await this.versionService.needsSync(organizationId);
    if (!needsSync && lastSync) {
      console.log(`[CacheSyncService] Skipping sync for ${organizationId} - cache is up to date`);
      return {
        success: true,
        itemsUpdated: { publicKeys: 0, contexts: 0, revokedVCs: 0 }
      };
    }

    this.isSyncing = true;
    console.log(`[CacheSyncService] Starting sync for organization ${organizationId}`);

    try {
      // Fetch latest data from server
      const bundle = await this.fetchOrganizationData(organizationId);
      
      // Update the cache with new data using sync method (replaces instead of adds)
      await SDKCacheManager.syncFromServer(bundle, organizationId);

      // Update version tracking
      this.versionService.updateLocalVersion(
        organizationId,
        bundle.publicKeys || [],
        bundle.contexts || [],
        bundle.revokedVCs || []
      );

      // Update sync metadata
      this.lastSyncMetadata.set(organizationId, {
        lastSyncTime: now,
        organizationId
      });
      this.saveSyncMetadata();

      const result: SyncResult = {
        success: true,
        itemsUpdated: {
          publicKeys: bundle.publicKeys?.length || 0,
          contexts: bundle.contexts?.length || 0,
          revokedVCs: bundle.revokedVCs?.length || 0
        }
      };

      console.log(`[CacheSyncService] Sync completed for ${organizationId}:`, result.itemsUpdated);
      return result;

    } catch (error) {
      console.error(`[CacheSyncService] Sync failed for organization ${organizationId}:`, error);
      return {
        success: false,
        itemsUpdated: { publicKeys: 0, contexts: 0, revokedVCs: 0 },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Force synchronization for a specific organization (bypasses cooldown)
   */
  public async forceSyncOrganization(organizationId: string): Promise<SyncResult> {
    if (!this.networkService.getIsOnline()) {
      return {
        success: false,
        itemsUpdated: { publicKeys: 0, contexts: 0, revokedVCs: 0 },
        error: 'No network connection'
      };
    }

    this.isSyncing = true;
    console.log(`[CacheSyncService] Force syncing organization ${organizationId}`);

    try {
      // Fetch latest data from server
      const bundle = await this.fetchOrganizationData(organizationId);
      
      // Update the cache with new data using sync method (replaces instead of adds)
      await SDKCacheManager.syncFromServer(bundle, organizationId);

      // Update version tracking
      this.versionService.updateLocalVersion(
        organizationId,
        bundle.publicKeys || [],
        bundle.contexts || [],
        bundle.revokedVCs || []
      );

      // Update sync metadata
      const now = Date.now();
      this.lastSyncMetadata.set(organizationId, {
        lastSyncTime: now,
        organizationId
      });
      this.saveSyncMetadata();

      const result: SyncResult = {
        success: true,
        itemsUpdated: {
          publicKeys: bundle.publicKeys?.length || 0,
          contexts: bundle.contexts?.length || 0,
          revokedVCs: bundle.revokedVCs?.length || 0
        }
      };

      console.log(`[CacheSyncService] Force sync completed for ${organizationId}:`, result.itemsUpdated);
      return result;

    } catch (error) {
      console.error(`[CacheSyncService] Force sync failed for organization ${organizationId}:`, error);
      return {
        success: false,
        itemsUpdated: { publicKeys: 0, contexts: 0, revokedVCs: 0 },
        error: error instanceof Error ? error.message : 'Unknown error'
      };
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

    // Fetch revoked VCs
    const rvcRes = await NetworkManager.fetch(`/organization/api/revoked-vcs/?organization_id=${encodeURIComponent(organizationId)}`, { method: 'GET' });
    if (!rvcRes.ok) throw new Error(`Failed to fetch revoked VCs (${rvcRes.status})`);
    const rvcJson = await rvcRes.json();
    const revokedVCs = Array.isArray(rvcJson?.revoked_vcs)
      ? rvcJson.revoked_vcs.map((vc: any) => ({
          vc_id: vc.vc_id,
          issuer: vc.issuer,
          subject: vc.subject,
          reason: vc.reason,
          revoked_at: vc.revoked_at,
          organization_id: organizationId,
        }))
      : [];

    return { publicKeys, contexts, revokedVCs };
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
        itemsUpdated: { publicKeys: 0, contexts: 0, revokedVCs: 0 },
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

  /**
   * Initialize the service and start monitoring
   */
  public initialize(): void {
    console.log('[CacheSyncService] Initializing cache synchronization service');
    
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