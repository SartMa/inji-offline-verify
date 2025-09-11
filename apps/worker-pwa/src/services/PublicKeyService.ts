import { NetworkManager } from '../network/NetworkManager';
import { KeyCacheManager } from '../cache/KeyCacheManager';
import type { CachedKey } from '../cache/KeyCacheManager';
import { PublicKeyGetterFactory } from '../../../../packages/inji-verify-sdk/src/services/offline-verifier/publicKey/PublicKeyGetterFactory.ts';
import type { PublicKeyData } from '../../../../packages/inji-verify-sdk/src/services/offline-verifier/publicKey/Types.ts';

export class PublicKeyService {
  // Submit DID for an organization; backend resolves and stores keys
  static async submitDID(orgId: string, did: string) {
    const res = await NetworkManager.fetch(`/organization/api/submit-did/`, {
      method: 'POST',
      body: JSON.stringify({ org_id: orgId, did }),
    });
    return res.json();
  }

  // Fetch keys from server and cache locally
  static async fetchAndCacheKeys(params: { organization_id?: string; did?: string }) {
    const q = new URLSearchParams();
    if (params.organization_id) q.set('organization_id', params.organization_id);
    if (params.did) q.set('did', params.did);
    const res = await NetworkManager.fetch(`/organization/api/public-keys/?${q.toString()}`, { method: 'GET' });
    const json = await res.json();
    const keys: CachedKey[] = (json.keys || []).map((k: any) => ({
      key_id: k.key_id,
      key_type: k.key_type,
      public_key_multibase: k.public_key_multibase,
      public_key_hex: k.public_key_hex,
      public_key_jwk: k.public_key_jwk,
      controller: k.controller,
      purpose: k.purpose,
      created_at: k.created_at,
      expires_at: k.expires_at,
      revoked_at: k.revoked_at,
      revocation_reason: k.revocation_reason,
      is_active: k.is_active,
      organization_id: json.organization_id || null,
      cached_at: Date.now(),
    }));
    if (keys.length) await KeyCacheManager.putKeys(keys);
    return keys.length;
  }

  // Resolve a verification method URI to a PublicKeyData (client-side parity with Kotlin)
  static async resolveVerificationMethod(verificationMethod: string): Promise<PublicKeyData> {
    const factory = new PublicKeyGetterFactory();
    return factory.get(verificationMethod);
  }
}
