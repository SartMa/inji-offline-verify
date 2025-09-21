import { dbService } from '../cache/DBService';
import { KEY_STORE } from '../cache/constants/CacheConstants';

export class PublicKeyService {
  /**
   * Get public key from the SDK's IndexedDB cache ONLY.
   * This does not perform network-based DID resolution.
   */
  async getPublicKey(verificationMethod: string): Promise<any | null> {
    try {
      // Use the singleton DB service to get a stable connection
      const db = await dbService.getDB();

      const tx = db.transaction([KEY_STORE], 'readonly');
      const store = tx.objectStore(KEY_STORE);
      
      // The 'idb' library returns a promise, so no promisify helper is needed.
      // We assume the verificationMethod is the key path (e.g., key_id).
      const record = await store.get(verificationMethod);

      if (!record) {
        console.error(`❌ Public key not found in cache: ${verificationMethod}`);
        return null;
      }
      if (record.is_active === false) {
        console.warn(`⚠️ Public key is marked as inactive: ${verificationMethod}`);
        return null;
      }

      // Return the key in the format expected by the verifier
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
}