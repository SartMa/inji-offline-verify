import { NetworkManager } from '../network/NetworkManager';
import { ContextCache } from '../cache/KeyCacheManager';

export class ContextService {
  static REQUIRED = [
    'https://www.w3.org/2018/credentials/v1',
    'https://w3id.org/security/v1',
    'https://w3id.org/security/v2',
  ];

  // Fetch default contexts from server and cache to IndexedDB
  static async fetchAndCacheDefaults() {
    const res = await NetworkManager.fetch('/api/contexts/defaults/', { method: 'GET' });
    const json = await res.json();
    const now = Date.now();
    const items = (json.contexts || []) as Array<{ url: string; document: any }>;
  try { console.log('contexts/defaults received:', items.map(i => i.url)); } catch {}
    for (const c of items) {
      await ContextCache.putContext({ url: c.url, document: c.document, cachedAt: now, source: 'network' });
    }
  try { const all = await ContextCache.listContexts(); console.log('IDB contexts after cache:', all.map(a => a.url)); } catch {}
    return items.length;
  }

  // Attempt to refresh server-side contexts from source (admin-only route)
  static async refreshOnServerAndCache(): Promise<number> {
    try {
      const resp = await NetworkManager.fetch('/api/contexts/refresh/', { method: 'POST', retry: 0 });
      if (!resp.ok) throw new Error('refresh not permitted');
      // After refresh, pull defaults again
      return await this.fetchAndCacheDefaults();
    } catch {
      // Fall back to defaults list already stored
      return await this.fetchAndCacheDefaults();
    }
  }

  // Ensure required contexts present locally; if not and network available, fetch
  static async ensureRequiredCached() {
    let missing: string[] = [];
    for (const url of this.REQUIRED) {
      const existing = await ContextCache.getContext(url);
      if (!existing) missing.push(url);
    }
    if (missing.length) {
  try { await this.fetchAndCacheDefaults(); } catch {}
    }
  }
}
