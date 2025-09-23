/**
 * CacheVersionService - Manages cache versioning to detect server-side changes
 * and avoid unnecessary sync operations
 */

import { getAccessToken } from '../services/authService';

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
  organization_name: string;
  last_modified: string;
  data_types: {
    contexts: {
      count: number;
      last_modified: string | null;
    };
    public_keys: {
      count: number;
      last_modified: string | null;
    };
    revoked_vcs: {
      count: number;
      last_modified: string | null;
    };
  };
  cache_version: string;
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
    // Don't make API calls when offline
    if (!navigator.onLine) {
      console.log(`[CacheVersionService] Skipping server cache info fetch - offline`);
      return null;
    }

    try {
      const token = getAccessToken();
      
      // This would be a new lightweight endpoint that returns just metadata
      const response = await fetch(`/organization/api/cache-info/?organization_id=${encodeURIComponent(organizationId)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`[CacheVersionService] Server cache-info endpoint returned ${response.status} ${response.statusText} - endpoint may not be implemented yet`);
        return null;
      }

      // Check content type before parsing as JSON
      const contentType = response.headers.get('content-type');
      
      if (!contentType || !contentType.includes('application/json')) {
        console.warn(`[CacheVersionService] Server returned non-JSON response for cache-info: ${contentType} - endpoint may not be implemented yet`);
        return null;
      }

      const data = await response.json();
      return data as ServerCacheInfo;
    } catch (error) {
      if (error instanceof SyntaxError && error.message.includes('JSON')) {
        console.warn('[CacheVersionService] Server returned invalid JSON for cache-info endpoint (probably HTML error page) - endpoint may not be implemented yet');
      } else if (error instanceof TypeError && error.message.includes('fetch')) {
        console.warn('[CacheVersionService] Network error fetching cache-info - server may be down or endpoint missing');
      } else {
        console.error('[CacheVersionService] Unexpected error fetching server cache info:', error);
      }
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

      // Temporarily make version checking more lenient during development
      // until the cache-info endpoint is fully stable
      const serverInfo = await this.fetchServerCacheInfo(organizationId);
      
      // If can't reach server cache-info endpoint, use time-based fallback
      // (This handles cases where the endpoint doesn't exist yet or returns errors)
      if (!serverInfo) {
        console.log(`[CacheVersionService] Server cache-info unavailable for ${organizationId} - using time-based check`);
        
        // Use a longer time threshold (30 minutes) when version checking is unavailable
        const maxAge = 30 * 60 * 1000; // 30 minutes
        const age = Date.now() - localVersion.version;
        
        if (age > maxAge) {
          console.log(`[CacheVersionService] Cache is older than 30 minutes for ${organizationId} - sync needed`);
          return true;
        } else {
          console.log(`[CacheVersionService] Cache is recent enough for ${organizationId} - no sync needed`);
          return false;
        }
      }

      // Compare last modified timestamps
      const localTime = new Date(localVersion.lastModified).getTime();
      const serverTime = new Date(serverInfo.last_modified).getTime();

      if (serverTime > localTime) {
        console.log(`[CacheVersionService] Server data newer for ${organizationId} - sync needed`);
        return true;
      }

      // Compare cache version if available
      if (serverInfo.cache_version) {
        const localCacheVersion = `${organizationId}_${Math.floor(localTime / 1000)}`;
        
        if (serverInfo.cache_version !== localCacheVersion) {
          console.log(`[CacheVersionService] Cache version mismatch for ${organizationId} - sync needed`);
          return true;
        }
      }

      console.log(`[CacheVersionService] Cache up to date for ${organizationId} - no sync needed`);
      return false;

    } catch (error) {
      console.error(`[CacheVersionService] Error checking sync need for ${organizationId}:`, error);
      // On error, use conservative time-based fallback
      const localVersion = this.getLocalVersion(organizationId);
      if (!localVersion) return true;
      
      const age = Date.now() - localVersion.version;
      return age > (60 * 60 * 1000); // 1 hour fallback
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