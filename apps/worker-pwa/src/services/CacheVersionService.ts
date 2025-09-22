/**
 * CacheVersionService - Manages cache versioning to detect server-side changes
 * and avoid unnecessary sync operations
 */

export interface CacheVersion {
  organizationId: string;
  publicKeysHash: string;
  contextsHash: string;
  revokedVCsHash: string;
  lastModified: string;
  version: number;
}

export interface ServerCacheInfo {
  organization_id: string;
  public_keys_count: number;
  contexts_count: number;
  revoked_vcs_count: number;
  last_modified: string;
  content_hash: string;
}

export class CacheVersionService {
  private static instance: CacheVersionService;
  private localVersions: Map<string, CacheVersion> = new Map();

  private constructor() {
    this.loadLocalVersions();
  }

  public static getInstance(): CacheVersionService {
    if (!CacheVersionService.instance) {
      CacheVersionService.instance = new CacheVersionService();
    }
    return CacheVersionService.instance;
  }

  private loadLocalVersions(): void {
    try {
      const stored = localStorage.getItem('cache_versions');
      if (stored) {
        const data = JSON.parse(stored);
        this.localVersions = new Map(Object.entries(data));
      }
    } catch (error) {
      console.warn('[CacheVersionService] Failed to load cache versions:', error);
    }
  }

  private saveLocalVersions(): void {
    try {
      const data = Object.fromEntries(this.localVersions);
      localStorage.setItem('cache_versions', JSON.stringify(data));
    } catch (error) {
      console.warn('[CacheVersionService] Failed to save cache versions:', error);
    }
  }

  /**
   * Generate hash for array of items to detect changes
   */
  private generateHash(items: any[]): string {
    const content = JSON.stringify(items.sort((a, b) => {
      const aKey = a.key_id || a.vc_id || a.url || JSON.stringify(a);
      const bKey = b.key_id || b.vc_id || b.url || JSON.stringify(b);
      return aKey.localeCompare(bKey);
    }));
    
    // Simple hash function (for production, consider using crypto.subtle.digest)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  /**
   * Update local cache version after successful sync
   */
  public updateLocalVersion(
    organizationId: string,
    publicKeys: any[],
    contexts: any[],
    revokedVCs: any[]
  ): void {
    const version: CacheVersion = {
      organizationId,
      publicKeysHash: this.generateHash(publicKeys),
      contextsHash: this.generateHash(contexts),
      revokedVCsHash: this.generateHash(revokedVCs),
      lastModified: new Date().toISOString(),
      version: Date.now()
    };

    this.localVersions.set(organizationId, version);
    this.saveLocalVersions();

    console.log(`[CacheVersionService] Updated local version for ${organizationId}:`, version);
  }

  /**
   * Get local cache version for organization
   */
  public getLocalVersion(organizationId: string): CacheVersion | null {
    return this.localVersions.get(organizationId) || null;
  }

  /**
   * Fetch server cache info for organization
   */
  public async fetchServerCacheInfo(organizationId: string): Promise<ServerCacheInfo | null> {
    try {
      // This would be a new lightweight endpoint that returns just metadata
      const response = await fetch(`/organization/api/cache-info/?organization_id=${encodeURIComponent(organizationId)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`[CacheVersionService] Failed to fetch server cache info: ${response.status}`);
        return null;
      }

      const data = await response.json();
      return data as ServerCacheInfo;
    } catch (error) {
      console.error('[CacheVersionService] Error fetching server cache info:', error);
      return null;
    }
  }

  /**
   * Check if local cache is outdated compared to server
   */
  public async needsSync(organizationId: string): Promise<boolean> {
    try {
      const localVersion = this.getLocalVersion(organizationId);
      
      // If no local version, definitely need sync
      if (!localVersion) {
        console.log(`[CacheVersionService] No local version for ${organizationId} - sync needed`);
        return true;
      }

      const serverInfo = await this.fetchServerCacheInfo(organizationId);
      
      // If can't reach server cache-info endpoint, force sync to be safe
      // (This handles cases where the endpoint doesn't exist yet)
      if (!serverInfo) {
        console.log(`[CacheVersionService] Cannot reach server cache-info for ${organizationId} - forcing sync`);
        return true;
      }

      // Compare last modified timestamps
      const localTime = new Date(localVersion.lastModified).getTime();
      const serverTime = new Date(serverInfo.last_modified).getTime();

      if (serverTime > localTime) {
        console.log(`[CacheVersionService] Server data newer for ${organizationId} - sync needed`);
        return true;
      }

      // Compare content hashes if available
      if (serverInfo.content_hash) {
        const localContentHash = this.generateHash([
          localVersion.publicKeysHash,
          localVersion.contextsHash,
          localVersion.revokedVCsHash
        ]);

        if (serverInfo.content_hash !== localContentHash) {
          console.log(`[CacheVersionService] Content hash mismatch for ${organizationId} - sync needed`);
          return true;
        }
      }

      console.log(`[CacheVersionService] Cache up to date for ${organizationId} - no sync needed`);
      return false;

    } catch (error) {
      console.error(`[CacheVersionService] Error checking sync need for ${organizationId}:`, error);
      // On error, err on the side of syncing
      return true;
    }
  }

  /**
   * Clear cache version for organization (force next sync)
   */
  public clearLocalVersion(organizationId: string): void {
    this.localVersions.delete(organizationId);
    this.saveLocalVersions();
    console.log(`[CacheVersionService] Cleared local version for ${organizationId}`);
  }

  /**
   * Get all local cache versions
   */
  public getAllLocalVersions(): Map<string, CacheVersion> {
    return new Map(this.localVersions);
  }

  /**
   * Check if sync is needed based on time threshold
   */
  public needsSyncByTime(organizationId: string, maxAgeMs: number = 30 * 60 * 1000): boolean {
    const localVersion = this.getLocalVersion(organizationId);
    
    if (!localVersion) {
      return true;
    }

    const age = Date.now() - localVersion.version;
    return age > maxAgeMs;
  }

  /**
   * Get sync status summary for organization
   */
  public getSyncStatus(organizationId: string): {
    hasLocalCache: boolean;
    lastSyncTime: number | null;
    cacheAge: number;
    needsTimeBasedSync: boolean;
  } {
    const localVersion = this.getLocalVersion(organizationId);
    
    return {
      hasLocalCache: !!localVersion,
      lastSyncTime: localVersion?.version || null,
      cacheAge: localVersion ? Date.now() - localVersion.version : -1,
      needsTimeBasedSync: this.needsSyncByTime(organizationId)
    };
  }
}