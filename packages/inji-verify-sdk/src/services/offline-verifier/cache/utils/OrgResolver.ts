/**
 * OrgResolver
 * - Used by the Organization app/service to resolve issuer public keys and JSON-LD contexts.
 * - Produces a "CacheBundle" the Worker can download and feed to SDKCacheManager.
 *
 * No IndexedDB writes happen here; this is purely data gathering for server-side or online usage.
 */
import { PublicKeyGetterFactory } from '../../publicKey/PublicKeyGetterFactory';
import { base58btc } from 'multiformats/bases/base58';
import type { CachedPublicKey, CachedRevokedVC } from './CacheHelper';

export type CacheBundle = {
  publicKeys?: CachedPublicKey[];
  // Prefer including full JSON documents to avoid network in the Worker app
  contexts?: Array<{ url: string; document: any }>;
  // If you cannot provide documents, you can include URLs; Worker may fetch them once (online)
  contextUrls?: string[];
  // Revoked VCs for offline revocation checking
  revokedVCs?: CachedRevokedVC[];
};

function unique<T>(arr: T[]) { return Array.from(new Set(arr)); }

// Minimal helpers to derive multibase from SPKI if needed
function spkiToRawEd25519(spki: Uint8Array): Uint8Array {
  if (spki.length === 32) return new Uint8Array(spki);
  const readLen = (buf: Uint8Array, at: number) => {
    let len = buf[at], lenBytes = 1;
    if (len & 0x80) { const n = len & 0x7f; len = 0; for (let j = 1; j <= n; j++) len = (len << 8) | buf[at + j]; lenBytes = 1 + n; }
    return { len, lenBytes };
  };
  for (let i = 0; i < spki.length; i++) {
    if (spki[i] !== 0x03) continue; // BIT STRING
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
  const header = new Uint8Array([0xed, 0x01]); // ed25519-pub multicodec
  const out = new Uint8Array(header.length + raw32.length);
  out.set(header, 0); out.set(raw32, header.length);
  return base58btc.encode(out);
}

async function fetchContext(url: string) {
  const resp = await fetch(url, { headers: { Accept: 'application/ld+json, application/json' } });
  if (!resp.ok) throw new Error(`Context fetch failed: ${url} (${resp.status})`);
  return await resp.json();
}

export class OrgResolver {
  /**
   * Build a CacheBundle from a raw VC envelope (supports {credential}, {verifiableCredential}, array, or bare VC).
   */
  static async buildBundleFromVC(vcEnvelope: any, fetchFullContexts = true): Promise<CacheBundle> {
    const pickFirst = (v: any) => (Array.isArray(v) ? v[0] : v);
    const vc =
      pickFirst(vcEnvelope?.credential) ??
      pickFirst(vcEnvelope?.verifiableCredential) ??
      pickFirst(vcEnvelope?.vc) ??
      vcEnvelope;

    if (!vc || typeof vc !== 'object') throw new Error('buildBundleFromVC: cannot locate credential object');

    // contexts
    const ctxs = Array.isArray(vc['@context']) ? vc['@context'] : [vc['@context']].filter(Boolean);
    const contextUrls = unique(ctxs.map((c) => (typeof c === 'string' ? c : null)).filter((x): x is string => !!x));

    // DID/VM
    const vmFromProof: string | undefined = vc?.proof?.verificationMethod;
    const issuerRaw = vc?.issuer;
    const issuerDid: string | undefined = typeof issuerRaw === 'string' ? issuerRaw : issuerRaw?.id;
    const didOrVm = vmFromProof ?? issuerDid;
    if (!didOrVm) throw new Error('buildBundleFromVC: missing issuer or verificationMethod');

    // Resolve public key
// Resolve public key
    const pk = await new PublicKeyGetterFactory().get(didOrVm);

    // Derive fields
    const keyId = vmFromProof ?? didOrVm;
    const controller = keyId.split('#')[0];
    let publicKeyMultibase: string | undefined = (pk as any).publicKeyMultibase;
    if (!publicKeyMultibase && pk?.bytes && pk?.algorithm === 'Ed25519') {
      publicKeyMultibase = ed25519RawToMultibase(spkiToRawEd25519(pk.bytes));
    }

    // Bundle
    const bundle: CacheBundle = {
      publicKeys: [{
        key_id: keyId,
        key_type: pk.keyType ?? 'Ed25519VerificationKey2020',
        public_key_multibase: publicKeyMultibase,
        public_key_hex: pk.bytes ? Array.from(pk.bytes as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join('') : undefined,
        public_key_jwk: pk.jwk,
        controller,
        purpose: 'assertion',
        is_active: true,
        organization_id: null
      }],
      contextUrls
    };

    if (fetchFullContexts && contextUrls.length) {
      bundle.contexts = [];
      for (const url of contextUrls) {
        try {
          const doc = await fetchContext(url);
          bundle.contexts.push({ url, document: doc });
        } catch (e) {
          // Non-fatal; worker can still fetch later if online
          // eslint-disable-next-line no-console
          console.warn('[OrgResolver] Context fetch skipped:', url, e);
        }
      }
    }

    return bundle;
  }

  /**
   * Build a CacheBundle when you only have a DID or verificationMethod string and optional context URLs.
   */
  static async buildBundleFromId(didOrVm: string, contextUrls: string[] = [], fetchFullContexts = true): Promise<CacheBundle> {
    if (!didOrVm) throw new Error('buildBundleFromId: didOrVm is required');

    const pk = await new PublicKeyGetterFactory().get(didOrVm);

    const keyId = didOrVm;
    const controller = keyId.split('#')[0];
    let publicKeyMultibase: string | undefined = (pk as any).publicKeyMultibase;
    if (!publicKeyMultibase && pk?.bytes && pk?.algorithm === 'Ed25519') {
      publicKeyMultibase = ed25519RawToMultibase(spkiToRawEd25519(pk.bytes));
    }

    const bundle: CacheBundle = {
      publicKeys: [{
        key_id: keyId,
        key_type: pk.keyType ?? 'Ed25519VerificationKey2020',
        public_key_multibase: publicKeyMultibase,
        public_key_hex: pk.bytes ? Array.from(pk.bytes as Uint8Array).map((b: number) => b.toString(16).padStart(2, '0')).join('') : undefined,
        public_key_jwk: pk.jwk,
        controller,
        purpose: 'assertion',
        is_active: true,
        organization_id: null
      }],
      contextUrls: unique(contextUrls)
    };

    if (fetchFullContexts && bundle.contextUrls?.length) {
      bundle.contexts = [];
      for (const url of bundle.contextUrls) {
        try {
          const doc = await fetchContext(url);
          bundle.contexts.push({ url, document: doc });
        } catch (e) {
          console.warn('[OrgResolver] Context fetch skipped:', url, e);
        }
      }
    }

    return bundle;
  }
}