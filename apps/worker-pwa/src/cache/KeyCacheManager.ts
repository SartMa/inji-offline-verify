// IndexedDB cache for public keys and contexts

const DB_NAME = 'VCVerifierCache';
// Bump to 2 to ensure 'contexts' store gets created for users who had v1
const DB_VERSION = 2;
const KEY_STORE = 'public_keys';
const CTX_STORE = 'contexts';

let db: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (db) return db;
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(KEY_STORE)) {
        const os = d.createObjectStore(KEY_STORE, { keyPath: 'key_id' });
        os.createIndex('controller', 'controller', { unique: false });
        os.createIndex('organization_id', 'organization_id', { unique: false });
        os.createIndex('is_active', 'is_active', { unique: false });
      }
      if (!d.objectStoreNames.contains(CTX_STORE)) {
        d.createObjectStore(CTX_STORE, { keyPath: 'url' });
      }
    };
    req.onsuccess = () => { db = req.result; resolve(db!); };
    req.onerror = () => reject(req.error);
  });
}

export interface CachedKey {
  key_id: string;
  key_type: string;
  public_key_multibase?: string;
  public_key_hex?: string;
  public_key_jwk?: any;
  controller: string;
  purpose?: string;
  created_at?: string;
  expires_at?: string | null;
  revoked_at?: string | null;
  revocation_reason?: string | null;
  is_active: boolean;
  organization_id?: string | null;
  cached_at: number;
}

export class KeyCacheManager {
  static async putKeys(keys: Omit<CachedKey, 'cached_at'>[]) {
    const d = await openDB();
    const tx = d.transaction([KEY_STORE], 'readwrite');
    const store = tx.objectStore(KEY_STORE);
    const now = Date.now();
    for (const k of keys) store.put({ ...k, cached_at: now });
    return new Promise<void>(res => { tx.oncomplete = () => res(); });
  }

  static async getKeysByController(controller: string): Promise<CachedKey[]> {
    const d = await openDB();
    return new Promise((resolve, reject) => {
      const idx = d.transaction([KEY_STORE], 'readonly').objectStore(KEY_STORE).index('controller');
      const req = idx.getAll(controller);
      req.onsuccess = () => resolve(req.result as CachedKey[]);
      req.onerror = () => reject(req.error);
    });
  }

  static async getKeysByOrg(orgId: string): Promise<CachedKey[]> {
    const d = await openDB();
    return new Promise((resolve, reject) => {
      const idx = d.transaction([KEY_STORE], 'readonly').objectStore(KEY_STORE).index('organization_id');
      const req = idx.getAll(orgId);
      req.onsuccess = () => resolve(req.result as CachedKey[]);
      req.onerror = () => reject(req.error);
    });
  }
}

export interface CachedContext {
  url: string;
  document: any;
  cachedAt: number;
  expiresAt?: number;
  source: 'network' | 'builtin';
}

export class ContextCache {
  static async putContext(ctx: CachedContext) {
    const d = await openDB();
    const tx = d.transaction([CTX_STORE], 'readwrite');
  tx.objectStore(CTX_STORE).put(ctx);
  tx.onerror = () => { console.error('IndexedDB putContext error:', tx.error); };
    return new Promise<void>(res => { tx.oncomplete = () => res(); });
  }

  static async getContext(url: string): Promise<CachedContext | undefined> {
    const d = await openDB();
    return new Promise((resolve, reject) => {
      const req = d.transaction([CTX_STORE], 'readonly').objectStore(CTX_STORE).get(url);
      req.onsuccess = () => resolve(req.result as CachedContext | undefined);
      req.onerror = () => reject(req.error);
    });
  }

  static async listContexts(): Promise<CachedContext[]> {
    const d = await openDB();
    return new Promise((resolve, reject) => {
      const req = d.transaction([CTX_STORE], 'readonly').objectStore(CTX_STORE).getAll();
      req.onsuccess = () => resolve((req.result || []) as CachedContext[]);
      req.onerror = () => reject(req.error);
    });
  }

  static async clearContexts() {
    const d = await openDB();
    const tx = d.transaction([CTX_STORE], 'readwrite');
    tx.objectStore(CTX_STORE).clear();
    return new Promise<void>((res, rej) => {
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error as any);
    });
  }
}
