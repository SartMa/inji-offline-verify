import { DB_NAME, DB_VERSION, CONTEXT_STORE, KEY_STORE, KEY_INDEX_CONTROLLER } from '../constants/CacheConstants';

export type CachedPublicKey = {
  key_id: string;                 // e.g., did:web:...#key-0
  key_type?: string;              // e.g., Ed25519VerificationKey2020
  public_key_multibase?: string;  // z6M...
  public_key_hex?: string;        // optional
  public_key_jwk?: any;           // optional
  controller: string;             // DID without fragment
  purpose?: string;
  is_active?: boolean;
  organization_id?: string | null;
};

export async function openCacheDB(): Promise<IDBDatabase> {
  return await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(CONTEXT_STORE)) {
        const store = db.createObjectStore(CONTEXT_STORE, { keyPath: 'url' });
        try { store.createIndex('url', 'url', { unique: true }); } catch {}
      }

      if (!db.objectStoreNames.contains(KEY_STORE)) {
        const store = db.createObjectStore(KEY_STORE, { keyPath: 'key_id' });
        try { store.createIndex(KEY_INDEX_CONTROLLER, KEY_INDEX_CONTROLLER, { unique: false }); } catch {}
      } else {
        // Ensure controller index exists
        const tx = req.transaction!;
        const pkStore = tx.objectStore(KEY_STORE);
        // @ts-ignore DOMStringList -> array-like
        const idx = Array.from(pkStore.indexNames);
        if (!idx.includes(KEY_INDEX_CONTROLLER)) {
          pkStore.createIndex(KEY_INDEX_CONTROLLER, KEY_INDEX_CONTROLLER, { unique: false });
        }
      }
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

export async function putContexts(contexts: { url: string; document: any }[]): Promise<void> {
  if (!contexts?.length) return;
  const db = await openCacheDB();
  const now = Date.now();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([CONTEXT_STORE], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore(CONTEXT_STORE);
    for (const c of contexts) {
      store.put({ url: c.url, document: c.document, cachedAt: now, source: 'prime' });
    }
  });
}

export async function putPublicKeys(keys: CachedPublicKey[]): Promise<void> {
  if (!keys?.length) return;
  const db = await openCacheDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([KEY_STORE], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore(KEY_STORE);
    for (const k of keys) {
      if (!k.key_id || !k.controller) throw new Error('putPublicKeys: key_id and controller are required');
      store.put({
        key_id: k.key_id,
        key_type: k.key_type ?? 'Ed25519VerificationKey2020',
        public_key_multibase: k.public_key_multibase,
        public_key_hex: k.public_key_hex,
        public_key_jwk: k.public_key_jwk,
        controller: k.controller.split('#')[0],
        purpose: k.purpose ?? 'assertion',
        is_active: k.is_active ?? true,
        organization_id: k.organization_id ?? null
      });
    }
  });
}

// Lightweight reads used by the offline document loader
export async function getContext(db: IDBDatabase, url: string) {
  return await new Promise<any | null>((resolve) => {
    const tx = db.transaction([CONTEXT_STORE], 'readonly');
    const r = tx.objectStore(CONTEXT_STORE).get(url);
    r.onsuccess = () => resolve(r.result?.document ?? null);
    r.onerror = () => resolve(null);
  });
}

export async function getKeyById(db: IDBDatabase, keyId: string) {
  return await new Promise<any | null>((resolve) => {
    const tx = db.transaction([KEY_STORE], 'readonly');
    const r = tx.objectStore(KEY_STORE).get(keyId);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => resolve(null);
  });
}

export async function getAnyKeyForDid(db: IDBDatabase, did: string) {
  return await new Promise<any | null>((resolve) => {
    const tx = db.transaction([KEY_STORE], 'readonly');
    const idx = tx.objectStore(KEY_STORE).index(KEY_INDEX_CONTROLLER);
    const r = idx.get(did);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => resolve(null);
  });
}