/**
 * OrgResolver
 * - Used by the Organization app/service to resolve issuer public keys and JSON-LD contexts.
 * - Produces a "CacheBundle" the Worker can download and feed to SDKCacheManager.
 *
 * No IndexedDB writes happen here; this is purely data gathering for server-side or online usage.
 */
import { PublicKeyGetterFactory } from '../../publicKey/PublicKeyGetterFactory';
import { base58btc } from 'multiformats/bases/base58';
import type { CachedPublicKey } from './CacheHelper';
import { Base64Utils } from '../../utils/Base64Utils.js';
import { bytesToHex } from '../../publicKey/Utils.js';

export type CacheBundle = {
  publicKeys?: CachedPublicKey[];
  // Prefer including full JSON documents to avoid network in the Worker app
  contexts?: Array<{ url: string; document: any }>;
  // If you cannot provide documents, you can include URLs; Worker may fetch them once (online)
  contextUrls?: string[];
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

const normalizeEcCurveName = (curve?: string): 'P-256' | 'P-384' | null => {
  if (!curve) return null;
  const upper = curve.toUpperCase();
  if (upper === 'P-256' || upper === 'SECP256R1') {
    return 'P-256';
  }
  if (upper === 'P-384' || upper === 'SECP384R1') {
    return 'P-384';
  }
  return null;
};

function normalizeEcJwk(pk: any): any | null {
  const jwk = pk?.jwk;
  const normalizedCurve = normalizeEcCurveName(jwk?.crv);
  if (jwk?.x && jwk?.y && normalizedCurve) {
    return {
      ...jwk,
      kty: jwk.kty ?? 'EC',
      crv: normalizedCurve,
    };
  }

  const bytes: Uint8Array | undefined = pk?.bytes;
  if (bytes && bytes[0] === 0x04) {
    if (bytes.length === 65) {
      const x = bytes.slice(1, 33);
      const y = bytes.slice(33, 65);
      return {
        kty: 'EC',
        crv: 'P-256',
        x: Base64Utils.base64UrlEncode(x),
        y: Base64Utils.base64UrlEncode(y),
      };
    }
    if (bytes.length === 97) {
      const x = bytes.slice(1, 49);
      const y = bytes.slice(49, 97);
      return {
        kty: 'EC',
        crv: 'P-384',
        x: Base64Utils.base64UrlEncode(x),
        y: Base64Utils.base64UrlEncode(y),
      };
    }
  }

  return null;
}

function inferKeyType(pk: any): string {
  if (pk?.keyType) return pk.keyType;
  const algorithm: string | undefined = pk?.algorithm;
  if (algorithm === 'Ed25519') return 'Ed25519VerificationKey2020';
  if (algorithm === 'secp256k1') return 'EcdsaSecp256k1VerificationKey2019';
  const normalizedCurve = normalizeEcCurveName(pk?.jwk?.crv);
  if (algorithm === 'P-256' || normalizedCurve === 'P-256') return 'JsonWebKey2020';
  if (algorithm === 'P-384' || normalizedCurve === 'P-384') return 'JsonWebKey2020';
  if (pk?.jwk?.kty === 'EC') return 'JsonWebKey2020';
  return 'JsonWebKey2020';
}

function buildCachedPublicKey(pk: any, keyId: string): CachedPublicKey {
  const controller = keyId.split('#')[0];
  const algorithm: string | undefined = pk?.algorithm;
  const normalizedCurve = normalizeEcCurveName(pk?.jwk?.crv);
  const cached: CachedPublicKey = {
    key_id: keyId,
    key_type: inferKeyType(pk),
    controller,
    public_key_multibase: undefined,
    public_key_hex: undefined,
    public_key_jwk: undefined,
    purpose: 'assertion',
    is_active: true,
    organization_id: null,
  };

  if (algorithm === 'Ed25519' || pk?.keyType?.includes?.('Ed25519')) {
    let multibase: string | undefined = (pk as any).publicKeyMultibase;
    if (!multibase && pk?.bytes) {
      try {
        multibase = ed25519RawToMultibase(spkiToRawEd25519(pk.bytes));
      } catch {
        // ignore; we'll fall back to other representations
      }
    }
    cached.public_key_multibase = multibase;
    if (pk?.bytes) {
      cached.public_key_hex = bytesToHex(pk.bytes);
    }
    return cached;
  }

  if (algorithm === 'secp256k1' || pk?.keyType?.includes?.('Secp256k1')) {
    cached.public_key_hex = pk?.ecUncompressedHex ?? (pk?.bytes ? bytesToHex(pk.bytes) : undefined);
    if (pk?.jwk) {
      cached.public_key_jwk = pk.jwk;
    }
    return cached;
  }

  if (algorithm === 'P-256' || normalizedCurve === 'P-256') {
    const jwk = normalizeEcJwk(pk);
    cached.public_key_jwk = jwk ?? pk?.jwk;
    if (pk?.bytes && !cached.public_key_hex) {
      cached.public_key_hex = bytesToHex(pk.bytes);
    }
    return cached;
  }

  if (algorithm === 'P-384' || normalizedCurve === 'P-384') {
    const jwk = normalizeEcJwk(pk);
    cached.public_key_jwk = jwk ?? pk?.jwk;
    if (pk?.bytes && !cached.public_key_hex) {
      cached.public_key_hex = bytesToHex(pk.bytes);
    }
    return cached;
  }

  if (algorithm === 'RSA' || pk?.keyType?.includes?.('Rsa')) {
    if (pk?.jwk) {
      cached.public_key_jwk = pk.jwk;
    }
    if (pk?.pem) {
      (cached as any).public_key_pem = pk.pem;
    }
    return cached;
  }

  // Generic fallback for any other key types
  if (pk?.jwk) {
    cached.public_key_jwk = pk.jwk;
  }
  if (pk?.bytes && !cached.public_key_hex) {
    cached.public_key_hex = bytesToHex(pk.bytes);
  }

  return cached;
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
    const pk = await new PublicKeyGetterFactory().get(didOrVm);

    // Derive fields
    const keyId = vmFromProof ?? didOrVm;

    // Bundle
    const bundle: CacheBundle = {
      publicKeys: [buildCachedPublicKey(pk, keyId)],
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

    const bundle: CacheBundle = {
      publicKeys: [buildCachedPublicKey(pk, keyId)],
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

  /**
   * Build a CacheBundle from a Verifiable Presentation (VP) envelope.
   * - Resolves the holder's proof on the VP.
   * - Resolves the issuer's proof for EACH Verifiable Credential inside the VP.
   * - Merges all discovered public keys and contexts into a single bundle.
   */
  static async buildBundleFromVP(vp: any, fetchFullContexts = true): Promise<CacheBundle> {
    if (!vp || typeof vp !== 'object' || !vp.type?.includes('VerifiablePresentation')) {
      throw new Error('buildBundleFromVP: Input is not a valid Verifiable Presentation');
    }
    console.log('[OrgResolver] Building bundle from VP...');

    const allBundles: CacheBundle[] = [];

    // 1. Process the outer Presentation proof (the holder's signature)
    if (vp.proof?.verificationMethod) {
      const holderBundle = await this.buildBundleFromId(
        vp.proof.verificationMethod,
        (Array.isArray(vp['@context']) ? vp['@context'] : [vp['@context']]).filter(c => typeof c === 'string'),
        fetchFullContexts,
      );
      allBundles.push(holderBundle);
    }

    // 2. Process each inner Verifiable Credential
    const vcs = vp.verifiableCredential ?? [];
    for (const vc of Array.isArray(vcs) ? vcs : [vcs]) {
      try {
        const vcBundle = await this.buildBundleFromVC(vc, fetchFullContexts);
        allBundles.push(vcBundle);
      } catch (e) {
        console.warn('[OrgResolver] Skipping a VC inside the VP due to an error.', e);
      }
    }

    // 3. Merge all bundles into one, ensuring no duplicates
    const finalBundle: CacheBundle = {
      publicKeys: [],
      contexts: [],
      contextUrls: [],
    };
    
    const keyMap = new Map<string, CachedPublicKey>();
    const contextMap = new Map<string, any>();
    const contextUrlSet = new Set<string>();

    for (const bundle of allBundles) {
      bundle.publicKeys?.forEach(pk => keyMap.set(pk.key_id, pk));
      bundle.contexts?.forEach(ctx => contextMap.set(ctx.url, ctx.document));
      bundle.contextUrls?.forEach(url => contextUrlSet.add(url));
    }
    
    finalBundle.publicKeys = Array.from(keyMap.values());
    finalBundle.contexts = Array.from(contextMap.entries()).map(([url, document]) => ({ url, document }));
    finalBundle.contextUrls = Array.from(contextUrlSet);
    
    return finalBundle;
  }
}