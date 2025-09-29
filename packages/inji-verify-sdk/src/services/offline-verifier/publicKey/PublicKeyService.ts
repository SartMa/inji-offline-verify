import { dbService } from '../cache/DBService';
import { KEY_STORE } from '../cache/constants/CacheConstants';
import { PublicKeyGetterFactory } from './PublicKeyGetterFactory';
import { putPublicKeys } from '../cache/utils/CacheHelper';
import { bytesToHex, spkiToRawEd25519, ed25519RawToMultibase, parsePemToDer, base64UrlDecode } from './Utils';

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
      let record = await store.get(verificationMethod);
      const controller = verificationMethod.split('#')[0];

      const isIncomplete = (rec: any) => {
        if (!rec) return true;
        if (rec.key_type === 'Multikey' && !rec.public_key_multibase) return true;
        return !rec.public_key_multibase && !rec.public_key_jwk && !rec.public_key_hex;
      };

      if (!record || isIncomplete(record)) {
          console.warn(`⚠️ Public key not found in cache: ${verificationMethod}`);
          // Online fallback: resolve and cache
          if (typeof navigator !== 'undefined' && navigator.onLine) {
            try {
              const pk = await new PublicKeyGetterFactory().get(verificationMethod);
              let public_key_multibase: string | undefined;
              let public_key_jwk: any | undefined;
              let public_key_hex: string | undefined;
              let public_key_pem: string | undefined;

              // Prefer multibase for did:key
              if (controller.startsWith('did:key:')) {
                public_key_multibase = controller.split('did:key:')[1];
              }
              if ((pk as any).publicKeyMultibase) {
                public_key_multibase = (pk as any).publicKeyMultibase;
              }
              // If getter returned JWK or EC hex, capture it
              if ((pk as any).jwk) public_key_jwk = (pk as any).jwk;
              if ((pk as any).ecUncompressedHex) public_key_hex = (pk as any).ecUncompressedHex;
              if ((pk as any).pem) public_key_pem = (pk as any).pem;
              // As a last resort, if bytes are present for EC keys, compute hex
              if (
                !public_key_hex &&
                (pk as any).bytes &&
                ((pk as any).algorithm === 'secp256k1' || (pk as any).algorithm === 'P-256' || (pk as any).algorithm === 'P-384')
              ) {
                public_key_hex = bytesToHex((pk as any).bytes as Uint8Array);
              }

              // For Ed25519 keys (common with did:web), attempt to compute multibase from available material
              if (!public_key_multibase && (pk as any).algorithm === 'Ed25519') {
                // 1) If bytes (SPKI) available, derive raw32 and encode multibase
                if ((pk as any).bytes instanceof Uint8Array) {
                  try {
                    const raw = spkiToRawEd25519((pk as any).bytes as Uint8Array);
                    public_key_multibase = ed25519RawToMultibase(raw);
                  } catch { /* ignore, try other forms */ }
                }
                // 2) If PEM present, parse to DER -> raw32 -> multibase
                if (!public_key_multibase && (pk as any).pem) {
                  try {
                    const der = parsePemToDer((pk as any).pem as string);
                    const raw = spkiToRawEd25519(der);
                    public_key_multibase = ed25519RawToMultibase(raw);
                  } catch { /* ignore */ }
                }
                // 3) If JWK OKP Ed25519 present, derive multibase from x
                if (!public_key_multibase && public_key_jwk?.kty === 'OKP' && public_key_jwk?.crv === 'Ed25519' && public_key_jwk?.x) {
                  try {
                    const raw = base64UrlDecode(public_key_jwk.x);
                    public_key_multibase = ed25519RawToMultibase(raw);
                  } catch { /* ignore */ }
                }
              }

              await putPublicKeys([
                {
                  key_id: verificationMethod,
                  key_type: pk.keyType,
                  controller,
                  public_key_multibase,
                  public_key_jwk,
                  public_key_hex,
                  public_key_pem,
                  is_active: true,
                  purpose: 'assertion',
                  organization_id: null
                }
              ]);
              // Re-read from cache using a fresh transaction (avoid TransactionInactiveError)
              const tx2 = db.transaction([KEY_STORE], 'readonly');
              const store2 = tx2.objectStore(KEY_STORE);
              record = await store2.get(verificationMethod);
            } catch (e: any) {
              console.error('💥 Error resolving public key online:', e);
              return null;
            }
          } else {
            return null;
          }
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
        publicKeyJwk: record.public_key_jwk,
        publicKeyHex: record.public_key_hex,
        publicKeyPem: record.public_key_pem,
      };
    } catch (e: any) {
      console.error('💥 Error retrieving public key from cache:', e);
      return null;
    }
  }
}