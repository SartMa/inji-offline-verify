import { DB_NAME, DB_VERSION, CONTEXT_STORE, KEY_STORE, KEY_INDEX_CONTROLLER } from '../constants/CacheConstants';
import { dbService } from '../DBService'; // Import the singleton instance

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

export async function putContexts(contexts: { url: string; document: any }[]): Promise<void> {
  if (!contexts?.length) return;
  const db = await dbService.getDB(); // Use the singleton
  const now = Date.now();
  const tx = db.transaction([CONTEXT_STORE], 'readwrite');
  const store = tx.objectStore(CONTEXT_STORE);
  await Promise.all(contexts.map(c => store.put({ url: c.url, document: c.document, cachedAt: now, source: 'prime' })));
  await tx.done;
}

export async function putPublicKeys(keys: CachedPublicKey[]): Promise<void> {
  if (!keys?.length) return;
  const db = await dbService.getDB(); // Use the singleton
  const tx = db.transaction([KEY_STORE], 'readwrite');
  const store = tx.objectStore(KEY_STORE);
  await Promise.all(keys.map(k => {
    if (!k.key_id || !k.controller) throw new Error('putPublicKeys: key_id and controller are required');
    return store.put({
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
  }));
  await tx.done;
}

// Lightweight reads used by the offline document loader
export async function getContext(url: string): Promise<any | null> {
  const db = await dbService.getDB(); // Use the singleton
  const result = await db.get(CONTEXT_STORE, url);
  return result?.document ?? null;
}

export async function getKeyById(keyId: string): Promise<any | null> {
  const db = await dbService.getDB(); // Use the singleton
  return await db.get(KEY_STORE, keyId);
}

export async function getAnyKeyForDid(did: string): Promise<any | null> {
  const db = await dbService.getDB(); // Use the singleton
  // This requires an index on 'controller'. Let's ensure the upgrade logic handles it.
  // For now, assuming the index exists.
  const result = await db.getFromIndex(KEY_STORE, KEY_INDEX_CONTROLLER, did);
  return result ?? null;
}