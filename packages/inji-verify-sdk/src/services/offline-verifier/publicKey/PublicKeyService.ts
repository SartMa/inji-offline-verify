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
  private readonly DB_NAME = 'pwa-key-cache';
  private readonly DB_VERSION = 1;
  private readonly STORE_NAME = 'cachedPublicKeys';

  private openCacheDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        return resolve(this.db);
      }
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      request.onerror = () => reject(new Error('Failed to open IndexedDB'));
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'keyId' });
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
      if (!this.db) {
        this.db = await this.openCacheDatabase();
      }
      
      const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
      const store = transaction.objectStore(this.STORE_NAME);
      const request = store.get(verificationMethod);
      const cachedKey: CachedPublicKey | undefined = await this.promisifyRequest(request);
      
      if (!cachedKey) {
        console.error(`❌ Public key not found in cache: ${verificationMethod}`);
        return null;
      }
      
      const now = Date.now();
      
      if (cachedKey.expiresAt && cachedKey.expiresAt < now) {
        console.error(`❌ Public key expired: ${verificationMethod}`);
        return null;
      }
      
      if (cachedKey.revokedAt) {
        console.error(`❌ Public key revoked: ${verificationMethod}`);
        return null;
      }
      
      if (!cachedKey.isActive) {
        console.error(`❌ Public key inactive: ${verificationMethod}`);
        return null;
      }
      
      // Update last verified timestamp (non-blocking)
      this.updateLastVerified(verificationMethod, now).catch(err => 
        console.warn('⚠️ Failed to update last verified timestamp:', err)
      );
      
      // Return in format expected by crypto library
      return {
        id: cachedKey.keyId,
        type: cachedKey.keyType,
        controller: cachedKey.controller,
        publicKeyMultibase: cachedKey.publicKeyMultibase
      };
      
    } catch (error) {
      console.error('💥 Error retrieving public key from cache:', error);
      return null;
    }
  }
  
  private async updateLastVerified(keyId: string, timestamp: number): Promise<void> {
    try {
      const transaction = this.db!.transaction([this.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(this.STORE_NAME);
      const getRequest = store.get(keyId);
      const cachedKey: CachedPublicKey | undefined = await this.promisifyRequest(getRequest);
      
      if (cachedKey) {
        cachedKey.lastVerified = timestamp;
        const putRequest = store.put(cachedKey);
        await this.promisifyRequest(putRequest);
      }
    } catch (error) {
      console.warn('⚠️ Failed to update last verified timestamp:', error);
    }
  }
}