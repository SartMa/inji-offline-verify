/**
 * SDKCacheManager
 * - Used by Worker app to seed the SDK-managed IndexedDB cache from a CacheBundle.
 * - Also supports deriving cache directly from a VC if needed (online one-time).
 */
import { CachedPublicKey, CachedRevokedVC, putContexts, putPublicKeys, putRevokedVCs, replaceRevokedVCsForOrganization, replacePublicKeysForOrganization, getContext, replaceContextsForOrganization } from './utils/CacheHelper';
import type { CacheBundle } from './utils/OrgResolver';
import { PublicKeyGetterFactory } from '../publicKey/PublicKeyGetterFactory';
import { base58btc } from 'multiformats/bases/base58';

function unique<T>(arr: T[]) { return Array.from(new Set(arr)); }

// Helpers to derive multibase when only SPKI bytes are available
function spkiToRawEd25519(spki: Uint8Array): Uint8Array {
  if (spki.length === 32) return new Uint8Array(spki);
  const readLen = (buf: Uint8Array, at: number) => {
    let len = buf[at], lenBytes = 1;
    if (len & 0x80) { const n = len & 0x7f; len = 0; for (let j = 1; j <= n; j++) len = (len << 8) | buf[at + j]; lenBytes = 1 + n; }
    return { len, lenBytes };
  };
  for (let i = 0; i < spki.length; i++) {
    if (spki[i] !== 0x03) continue;
    const { len, lenBytes } = readLen(spki, i + 1);
    const pad = spki[i + 1 + lenBytes];
    const start = i + 1 + lenBytes + 1;
    const clen = len - 1;
    if (pad === 0x00 && clen >= 32 && start + 32 <= spki.length) {
      return new Uint8Array(spki.subarray(start, start + 32));
    }
  }
  throw new Error('SPKI parse error: 32-byte Ed25519 key not found');
}
function ed25519RawToMultibase(raw32: Uint8Array): string {
  const header = new Uint8Array([0xed, 0x01]);
  const out = new Uint8Array(header.length + raw32.length);
  out.set(header, 0); out.set(raw32, header.length);
  return base58btc.encode(out);
}

export class SDKCacheManager {
  // Prime SDK cache directly with a bundle from the Organization backend
  static async primeFromServer(bundle: CacheBundle): Promise<void> {
    // 1) keys
    if (bundle.publicKeys?.length) {
      await putPublicKeys(bundle.publicKeys as CachedPublicKey[]);
    }
    // 2) contexts: prefer full docs
    if (bundle.contexts?.length) {
      await putContexts(bundle.contexts);
    } else if (bundle.contextUrls?.length && typeof navigator !== 'undefined' && navigator.onLine) {
      // fetch once and cache
      const docs: Array<{ url: string; document: any }> = [];
      for (const url of unique(bundle.contextUrls)) {
        const resp = await fetch(url, { headers: { Accept: 'application/ld+json, application/json' } });
        if (!resp.ok) { console.warn('[SDKCacheManager] Context fetch failed:', url, resp.status); continue; }
        docs.push({ url, document: await resp.json() });
      }
      if (docs.length) await putContexts(docs);
    }
    // 3) revoked VCs
    if (bundle.revokedVCs?.length) {
      await putRevokedVCs(bundle.revokedVCs as CachedRevokedVC[]);
    }
  }

  // Sync method that replaces cache data instead of adding to it (for proper sync)
  static async syncFromServer(bundle: CacheBundle, organizationId: string): Promise<void> {
    // 1) keys - REPLACE instead of add for proper sync
    await replacePublicKeysForOrganization(organizationId, (bundle.publicKeys as CachedPublicKey[]) || []);
    
    // 2) contexts - REPLACE by organization (to mirror public keys & revoked VCs behavior)
    if (bundle.contexts?.length) {
      await replaceContextsForOrganization(organizationId, bundle.contexts);
    } else if (bundle.contextUrls?.length && typeof navigator !== 'undefined' && navigator.onLine) {
      // fetch once and replace
      const docs: Array<{ url: string; document: any }> = [];
      for (const url of unique(bundle.contextUrls)) {
        const resp = await fetch(url, { headers: { Accept: 'application/ld+json, application/json' } });
        if (!resp.ok) { console.warn('[SDKCacheManager] Context fetch failed:', url, resp.status); continue; }
        docs.push({ url, document: await resp.json() });
      }
      if (docs.length) await replaceContextsForOrganization(organizationId, docs);
    }
    // 3) revoked VCs - REPLACE instead of add for proper sync
    await replaceRevokedVCsForOrganization(organizationId, (bundle.revokedVCs as CachedRevokedVC[]) || []);
  }

  // Optional: derive cache from a VC (one-time, while online)
  static async primeFromVC(vcEnvelope: any): Promise<{ cachedKeyId?: string; cachedContexts: string[] }> {
    const pickFirst = (v: any) => (Array.isArray(v) ? v[0] : v);
    const vc =
      pickFirst(vcEnvelope?.credential) ??
      pickFirst(vcEnvelope?.verifiableCredential) ??
      pickFirst(vcEnvelope?.vc) ??
      vcEnvelope;

    if (!vc || typeof vc !== 'object') throw new Error('primeFromVC: cannot locate credential object');

    const ctxs = Array.isArray(vc['@context']) ? vc['@context'] : [vc['@context']].filter(Boolean);
    const contextUrls = unique(ctxs.map((c) => (typeof c === 'string' ? c : null)).filter((x): x is string => !!x));

    const vmFromProof: string | undefined = vc?.proof?.verificationMethod;
    const issuerRaw = vc?.issuer;
    const issuerDid: string | undefined = typeof issuerRaw === 'string' ? issuerRaw : issuerRaw?.id;
    const didOrVm = vmFromProof ?? issuerDid;
    if (!didOrVm) throw new Error('primeFromVC: missing issuer or verificationMethod');

    // Resolve public key
    const pk = await new PublicKeyGetterFactory().get(didOrVm);

    const keyId = vmFromProof ?? didOrVm;
    const controller = keyId.split('#')[0];

    let publicKeyMultibase: string | undefined = (pk as any).publicKeyMultibase;
    if (!publicKeyMultibase && pk?.bytes && pk?.algorithm === 'Ed25519') {
      publicKeyMultibase = ed25519RawToMultibase(spkiToRawEd25519(pk.bytes));
    }

    await putPublicKeys([{
      key_id: keyId,
      key_type: pk.keyType ?? 'Ed25519VerificationKey2020',
      public_key_multibase: publicKeyMultibase,
      public_key_hex: pk.bytes ? Array.from(pk.bytes as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join('') : undefined,
      public_key_jwk: pk.jwk,
      controller,
      purpose: 'assertion',
      is_active: true,
      organization_id: null
    }]);

    if (typeof navigator !== 'undefined' && navigator.onLine && contextUrls.length) {
      const docs: Array<{ url: string; document: any }> = [];
      for (const url of contextUrls) {
        const resp = await fetch(url, { headers: { Accept: 'application/ld+json, application/json' } });
        if (!resp.ok) { console.warn('[SDKCacheManager] Context fetch failed:', url, resp.status); continue; }
        docs.push({ url, document: await resp.json() });
      }
      if (docs.length) await putContexts(docs);
    }

    return { cachedKeyId: keyId, cachedContexts: contextUrls };
  }

  // Quick check if a context is cached
  static async isContextCached(url: string): Promise<boolean> {
    // This now uses the refactored helper which uses the singleton
    return !!(await getContext(url));
  }
}