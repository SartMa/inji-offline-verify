import { CONTEXT_STORE, KEY_STORE, KEY_INDEX_CONTROLLER, STATUS_LIST_STORE } from '../constants/CacheConstants';
import { dbService } from '../DBService'; // Import the singleton instance

export type CachedPublicKey = {
  key_id: string;                 // e.g., did:web:...#key-0
  key_type?: string;              // e.g., Ed25519VerificationKey2020
  public_key_multibase?: string;  // z6M...
  public_key_hex?: string;        // optional
  public_key_jwk?: any;           // optional
  public_key_pem?: string;        // optional PEM for RSA keys
  controller: string;             // DID without fragment
  purpose?: string;
  is_active?: boolean;
  organization_id?: string | null;
};

export async function putContexts(contexts: { url: string; document: any; organization_id?: string | null }[]): Promise<void> {
  if (!contexts?.length) return;
  const db = await dbService.getDB(); // Use the singleton
  const now = Date.now();
  const tx = db.transaction([CONTEXT_STORE], 'readwrite');
  const store = tx.objectStore(CONTEXT_STORE);
  await Promise.all(contexts.map(c => store.put({ url: c.url, document: c.document, cachedAt: now, source: 'prime', organization_id: c.organization_id ?? null })));
  await tx.done;
}

export async function replaceContextsForOrganization(organizationId: string, contexts: { url: string; document: any }[]): Promise<void> {
  const db = await dbService.getDB();
  // Find existing contexts for this organization
  const tx1 = db.transaction(CONTEXT_STORE, 'readonly');
  const store1 = tx1.objectStore(CONTEXT_STORE);
  let existing: any[] = [];
  try {
    const idx = store1.index('organization_id');
    existing = await idx.getAll(organizationId);
  } catch {
    // If index not found, treat as none
    existing = [];
  }
  await tx1.done;

  // Delete existing contexts for this org
  if (existing.length > 0) {
    const tx2 = db.transaction(CONTEXT_STORE, 'readwrite');
    const store2 = tx2.objectStore(CONTEXT_STORE);
    for (const c of existing) {
      await store2.delete(c.url);
    }
    await tx2.done;
  }

  // Insert new contexts with organization_id
  if (contexts.length > 0) {
    const tx3 = db.transaction(CONTEXT_STORE, 'readwrite');
    const store3 = tx3.objectStore(CONTEXT_STORE);
    const now = Date.now();
    for (const c of contexts) {
      await store3.put({ url: c.url, document: c.document, cachedAt: now, source: 'org-sync', organization_id: organizationId });
    }
    await tx3.done;
  }
  console.log(`[CacheHelper] Replaced ${existing.length} existing contexts with ${contexts.length} new contexts for organization ${organizationId}`);
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
      public_key_pem: k.public_key_pem,
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

export async function replacePublicKeysForOrganization(organizationId: string, publicKeys: CachedPublicKey[]): Promise<void> {
  const db = await dbService.getDB();
  
  // First, get all existing public keys and filter by organization_id
  const tx1 = db.transaction(KEY_STORE, 'readonly');
  const store1 = tx1.objectStore(KEY_STORE);
  const allKeys = await store1.getAll();
  const existingKeys = allKeys.filter(key => key.organization_id === organizationId);
  await tx1.done;
  
  // Delete all existing keys for this organization
  if (existingKeys.length > 0) {
    const tx2 = db.transaction(KEY_STORE, 'readwrite');
    const store2 = tx2.objectStore(KEY_STORE);
    
    for (const key of existingKeys) {
      await store2.delete(key.key_id);
    }
    await tx2.done;
  }
  
  // Add the new keys
  if (publicKeys.length > 0) {
    const tx3 = db.transaction(KEY_STORE, 'readwrite');
    const store3 = tx3.objectStore(KEY_STORE);
    
    for (const publicKey of publicKeys) {
      await store3.put({
        key_id: publicKey.key_id,
        key_type: publicKey.key_type ?? 'Ed25519VerificationKey2020',
        public_key_multibase: publicKey.public_key_multibase,
        public_key_hex: publicKey.public_key_hex,
        public_key_jwk: publicKey.public_key_jwk,
        public_key_pem: publicKey.public_key_pem,
        controller: publicKey.controller.split('#')[0],
        purpose: publicKey.purpose ?? 'assertion',
        is_active: publicKey.is_active ?? true,
        organization_id: publicKey.organization_id ?? null
      });
    }
    await tx3.done;
  }
  
  console.log(`[CacheHelper] Replaced ${existingKeys.length} existing public keys with ${publicKeys.length} new keys for organization ${organizationId}`);
}

// ---------------- Status List Credential Helpers -----------------
export interface CachedStatusListCredential {
  status_list_id: string; // credential.id
  issuer: string;
  status_purpose: string; // e.g., revocation
  full_credential: any;   // full JSON document
  organization_id: string;
  cachedAt?: number;
}

export async function putStatusListCredentials(creds: CachedStatusListCredential[]): Promise<void> {
  if (!creds?.length) return;
  const db = await dbService.getDB();
  const tx = db.transaction(STATUS_LIST_STORE, 'readwrite');
  const store = tx.objectStore(STATUS_LIST_STORE);
  const now = Date.now();
  for (const c of creds) {
    if (!c.status_list_id) throw new Error('putStatusListCredentials: status_list_id required');
    await store.put({ ...c, cachedAt: now });
  }
  await tx.done;
}

export async function replaceStatusListCredentialsForOrganization(organizationId: string, creds: CachedStatusListCredential[]): Promise<void> {
  const db = await dbService.getDB();
  // Fetch existing for org
  const tx1 = db.transaction(STATUS_LIST_STORE, 'readonly');
  const store1 = tx1.objectStore(STATUS_LIST_STORE);
  let existing: any[] = [];
  try {
    const idx = store1.index('organization_id');
    existing = await idx.getAll(organizationId);
  } catch {
    existing = [];
  }
  await tx1.done;

  if (existing.length) {
    const tx2 = db.transaction(STATUS_LIST_STORE, 'readwrite');
    const store2 = tx2.objectStore(STATUS_LIST_STORE);
    for (const e of existing) await store2.delete(e.status_list_id);
    await tx2.done;
  }

  if (creds.length) {
    const tx3 = db.transaction(STATUS_LIST_STORE, 'readwrite');
    const store3 = tx3.objectStore(STATUS_LIST_STORE);
    const now = Date.now();
    for (const c of creds) {
      await store3.put({ ...c, cachedAt: now });
    }
    await tx3.done;
  }
  console.log(`[CacheHelper] Replaced ${existing.length} existing status list credentials with ${creds.length} new credentials for organization ${organizationId}`);
}

export async function getStatusListCredentialById(statusListId: string): Promise<CachedStatusListCredential | null> {
  const db = await dbService.getDB();
  try {
    const res = await db.get(STATUS_LIST_STORE, statusListId);
    return res || null;
  } catch {
    return null;
  }
}