interface CachedPublicKey {
  keyId: string;                    // "did:web:university.edu#key-1"
  organizationDid: string;          // "did:web:university.edu"
  keyType: string;                  // "Ed25519VerificationKey2020"
  publicKeyMultibase: string;       // "z6Mk4k..." (actual key bytes)
  publicKeyHex: string;             // "a1b2c3..." (for compatibility)
  controller: string;               // Who owns this key
  purpose: string;                  // "assertion", "authentication"
  isActive: boolean;
  expiresAt: number | null;         // Unix timestamp
  revokedAt: number | null;         // Unix timestamp
  cachedAt: number;                 // When we cached this
  lastVerified: number;             // Last successful verification
}

export class PublicKeyService {
  private db: IDBDatabase | null = null;
  private readonly DB_NAME = 'VCVerifierCache';
  private readonly DB_VERSION = 2;
  private readonly STORE_NAME = 'public_keys';

  private openCacheDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db) return resolve(this.db);
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      request.onsuccess = () => { this.db = request.result; resolve(this.db!); };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'key_id' });
          store.createIndex('controller', 'controller', { unique: false });
          store.createIndex('organization_id', 'organization_id', { unique: false });
          store.createIndex('is_active', 'is_active', { unique: false });
        }
      };
    });
  }

  private promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get public key from PWA cache ONLY
   * No DID resolution - PWA team handles that part
   */
  async getPublicKey(verificationMethod: string): Promise<any> {
    try {
      if (!this.db) this.db = await this.openCacheDatabase();

      const tx = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = tx.objectStore(this.STORE_NAME);
      const record = await this.promisifyRequest<any>(store.get(verificationMethod));

      if (!record) {
        console.error(`❌ Public key not found in cache: ${verificationMethod}`);
        return null;
      }
      if (record.is_active === false) return null;

      return {
        id: record.key_id,
        type: record.key_type,
        controller: record.controller,
        publicKeyMultibase: record.public_key_multibase,
      };
    } catch (e) {
      console.error('💥 Error retrieving public key from cache:', e);
      return null;
    }
  }

  private async updateLastVerified(_: string, __: number): Promise<void> { /* no-op with this schema */ }
}