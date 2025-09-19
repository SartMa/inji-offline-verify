import type { PublicKeyGetter } from '../PublicKeyGetter.js';
import type { PublicKeyData } from '../Types.js';
import { fetchPublicDocument } from '../Utils.js';
import { getPublicKeyFromPem, getPublicKeyFromJwk, getPublicKeyFromHex, getPublicKeyFromMultibaseEd25519 } from '../Utils.js';

export class HttpsPublicKeyGetter implements PublicKeyGetter {
  async get(verificationMethod: string): Promise<PublicKeyData> {
    
    const json = await fetchPublicDocument(verificationMethod);
    // Kotlin checks for presence of keys and uses a key_type field
    const keyType = json.key_type || json.type || json.keyType;
    if (!keyType) throw new Error('Public key string not found');

    if (json.public_key_pem || json.publicKeyPem) {
      const pem = json.public_key_pem || json.publicKeyPem;
      return getPublicKeyFromPem(pem, keyType, verificationMethod);
    }
    if (json.public_key_multibase || json.publicKeyMultibase) {
      const mb = json.public_key_multibase || json.publicKeyMultibase;
      return getPublicKeyFromMultibaseEd25519(mb, keyType, verificationMethod);
    }
    if (json.public_key_jwk || json.publicKeyJwk) {
      const jwk = json.public_key_jwk || json.publicKeyJwk;
      return getPublicKeyFromJwk(jwk, keyType, verificationMethod);
    }
    if (json.public_key_hex || json.publicKeyHex) {
      const hex = json.public_key_hex || json.publicKeyHex;
      return getPublicKeyFromHex(hex, keyType, verificationMethod);
    }
    throw new Error('Public key string not found');
  }
}
