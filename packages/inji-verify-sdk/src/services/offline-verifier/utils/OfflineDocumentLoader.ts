/**
 * OFFLINE DOCUMENT LOADER
 * 
 * This utility extracts JSON-LD contexts from IndexedDB cache for offline verification.
 * No network calls are made - everything is resolved from local cache.
 */
const DB_NAME = 'VCVerifierCache';
const DB_VERSION = 2;
const CONTEXT_STORE = 'contexts';
const KEY_STORE = 'public_keys';

async function openDB(): Promise<IDBDatabase> {
  return await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

async function getContext(db: IDBDatabase, url: string) {
  return await new Promise<any | null>((resolve) => {
    const tx = db.transaction([CONTEXT_STORE], 'readonly');
    const store = tx.objectStore(CONTEXT_STORE);
    const r = store.get(url);
    r.onsuccess = () => resolve(r.result?.document ?? null);
    r.onerror = () => resolve(null);
  });
}

async function getKeyById(db: IDBDatabase, keyId: string) {
  return await new Promise<any | null>((resolve) => {
    const tx = db.transaction([KEY_STORE], 'readonly');
    const store = tx.objectStore(KEY_STORE);
    const r = store.get(keyId);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => resolve(null);
  });
}

async function getAnyKeyForDid(db: IDBDatabase, did: string) {
  return await new Promise<any | null>((resolve) => {
    const tx = db.transaction([KEY_STORE], 'readonly');
    const store = tx.objectStore(KEY_STORE);
    const idx = store.index('controller'); // requires controller = DID without fragment
    const r = idx.get(did);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => resolve(null);
  });
}

function vmFromKey(key: any) {
  return {
    '@context': ['https://w3id.org/security/suites/ed25519-2020/v1'],
    id: key.key_id,
    type: key.key_type ?? 'Ed25519VerificationKey2020',
    controller: key.controller,
    publicKeyMultibase: key.public_key_multibase
  };
}

function didDocFromKey(did: string, key: any) {
  return {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/ed25519-2020/v1'],
    id: did,
    verificationMethod: [vmFromKey(key)],
    assertionMethod: [key.key_id]
  };
}

// Remove or comment out any BUILTIN_CONTEXTS approximations to avoid canonization drift
// const BUILTIN_CONTEXTS = { /* remove approximations */ };

// Always load from cache first; only use network when explicitly online.
// Throw if missing to avoid using wrong contexts that break verification.

export class OfflineDocumentLoader {
  /**
   * Get document loader function for jsonld-signatures library
   */
  static getDocumentLoader(): (url: string) => Promise<{ document: any; documentUrl: string; contextUrl?: string }> {
    const loader = new OfflineDocumentLoader();
    return loader.documentLoader.bind(loader);
  }

  async documentLoader(url: string) {
    console.log(`📄 [OfflineDocumentLoader] Resolving: ${url}`);

    // 1) DID resolution via key cache (unchanged)
    if (url.startsWith('did:')) {
      console.log(`🔐 [OfflineDocumentLoader] Resolving DID: ${url}`);
      if (url.includes('#')) {
        const key = await getKeyById(db, url);
        if (!key) throw new Error(`DID verification method not available offline: ${url}`);
        return { contextUrl: undefined, document: vmFromKey(key), documentUrl: url };
      } else {
        const key = await getAnyKeyForDid(db, url);
        if (!key) throw new Error(`DID document not available offline: ${url}`);
        return { contextUrl: undefined, document: didDocFromKey(url, key), documentUrl: url };
      }
    }

    // 2) Try cached contexts
    const db = await openDB();
    const ctx = await getContext(db, url);
    if (ctx) {
      console.log(`💾 [OfflineDocumentLoader] Using cached context: ${url}`);
      return { contextUrl: undefined, document: ctx, documentUrl: url };
    }

    // 3) If online, fetch and cache exact context
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      console.log(`🌐 [OfflineDocumentLoader] Fetching exact context: ${url}`);
      const resp = await fetch(url, { headers: { Accept: 'application/ld+json, application/json' } });
      if (!resp.ok) throw new Error(`Failed to fetch context: ${url} (${resp.status})`);
      const document = await resp.json();
      try {
        const tx = db.transaction(['contexts'], 'readwrite');
        tx.objectStore('contexts').put({ url, document, cachedAt: Date.now(), source: 'network' });
      } catch { /* best effort */ }
      return { contextUrl: undefined, document, documentUrl: url };
    }

    // 4) Offline and not cached -> fail fast with clear message
    throw new Error(
      `Missing JSON-LD context offline: ${url}. Pre-cache exact contexts before going offline (e.g., credentials/v1, ed25519-2020/v1, did/v1).`
    );
  }
}