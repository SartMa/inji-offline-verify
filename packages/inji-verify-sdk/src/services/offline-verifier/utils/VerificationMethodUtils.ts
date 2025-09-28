import { MultibaseUtils } from './MultibaseUtils.js';
import { decodeDidKeyMultibaseEd25519 } from '../publicKey/Utils.js';
import { base64url } from 'multiformats/bases/base64';
import { base58btc } from 'multiformats/bases/base58';
import jsonld from 'jsonld';
import { sha256 } from '@noble/hashes/sha2';

const textEncoder = new TextEncoder();

export type LinkedDataVerifyArtifacts = {
  payloadBytes: Uint8Array;
  proofHashBytes: Uint8Array;
  docHashBytes: Uint8Array;
  proofCanonicalBytes: Uint8Array;
  docCanonicalBytes: Uint8Array;
  proofNQuads: string;
  docNQuads: string;
};

/**
 * Normalize a verification method document for the expected proof/suite.
 * - For Ed25519Signature2018, ensure type is Ed25519VerificationKey2018 and publicKeyBase58 is set.
 * - For Ed25519Signature2020, ensure type is Ed25519VerificationKey2020 and publicKeyMultibase is set.
 */
export function normalizeVerificationMethodForProof(publicKeyData: any, proofType: string, vmId: string) {
  const id = publicKeyData?.id || vmId;
  const controller = publicKeyData?.controller || (vmId?.includes('#') ? vmId.split('#')[0] : undefined);

  if (proofType === 'Ed25519Signature2018') {
    let publicKeyBase58 = publicKeyData?.publicKeyBase58;
    if (!publicKeyBase58 && typeof publicKeyData?.publicKeyMultibase === 'string') {
      try {
        // Remove Ed25519 multicodec header if present and get raw 32-byte key
        const raw = decodeDidKeyMultibaseEd25519(publicKeyData.publicKeyMultibase);
        const encoded = MultibaseUtils.encode(raw, 'base58btc');
        publicKeyBase58 = encoded.startsWith('z') ? encoded.slice(1) : encoded;
      } catch {
        const mb = publicKeyData.publicKeyMultibase;
        publicKeyBase58 = mb.startsWith('z') ? mb.slice(1) : mb;
      }
    }
    return { id, controller, type: 'Ed25519VerificationKey2018', publicKeyBase58 };
  }

  if (proofType === 'Ed25519Signature2020') {
    let publicKeyMultibase = publicKeyData?.publicKeyMultibase;
    if (!publicKeyMultibase && typeof publicKeyData?.publicKeyBase58 === 'string') {
      // Construct multibase (z + base58btc)
      publicKeyMultibase = `z${publicKeyData.publicKeyBase58}`;
    }
    return { id, controller, type: 'Ed25519VerificationKey2020', publicKeyMultibase };
  }

  // Default passthrough
  return { id, controller, ...publicKeyData };
}

export function resolveSecp256k1PublicKeyBytes(vm: any): Uint8Array | undefined {
  const jwk = vm?.publicKeyJwk || vm?.public_key_jwk;
  if (jwk?.x && jwk?.y) {
    try {
      const x = decodeBase64UrlWithoutPrefix(jwk.x);
      const y = decodeBase64UrlWithoutPrefix(jwk.y);
      if (x.length === 32 && y.length === 32) {
        const uncompressed = new Uint8Array(65);
        uncompressed[0] = 0x04;
        uncompressed.set(x, 1);
        uncompressed.set(y, 33);
        return uncompressed;
      }
    } catch {/* ignore */}
  }

  const hex = vm?.publicKeyHex || vm?.public_key_hex;
  if (typeof hex === 'string') {
    const bytes = hexToBytes(hex);
    if (bytes?.length === 33 || bytes?.length === 65) return bytes;
  }

  const mb = vm?.publicKeyMultibase || vm?.public_key_multibase;
  if (typeof mb === 'string') {
    try {
      const normalized = mb.startsWith('z') ? mb : `z${mb}`;
      const decoded = base58btc.decode(normalized);
      if (decoded.length === 35 && decoded[0] === 0xe7 && decoded[1] === 0x01) {
        return decoded.slice(2);
      }
      return decoded;
    } catch {
      try {
        const decoded = decodeBase64UrlWithoutPrefix(mb);
        if (decoded.length === 33 || decoded.length === 65) return decoded;
      } catch {/* ignore */}
    }
  }

  return undefined;
}

export async function computeLinkedDataVerifyArtifacts(
  doc: any,
  proof: any,
  documentLoader: any,
): Promise<LinkedDataVerifyArtifacts> {
  const proofOpts: any = { ...proof };
  delete proofOpts.jws;
  delete proofOpts.proofValue;
  if (!('@context' in proofOpts) || proofOpts['@context'] == null) {
    const docContext = doc?.['@context'];
    proofOpts['@context'] = docContext ?? resolveProofContext(proof?.type);
  }

  const proofNQuads = await canonizeWithJsonLd(proofOpts, documentLoader);
  const docNQuads = await canonizeWithJsonLd(doc, documentLoader);

  const proofCanonicalBytes = textEncoder.encode(proofNQuads);
  const docCanonicalBytes = textEncoder.encode(docNQuads);
  const proofHashBytes = sha256(proofCanonicalBytes);
  const docHashBytes = sha256(docCanonicalBytes);
  const payloadBytes = concatBytes(proofHashBytes, docHashBytes);

  return {
    payloadBytes,
    proofHashBytes,
    docHashBytes,
    proofCanonicalBytes,
    docCanonicalBytes,
    proofNQuads,
    docNQuads,
  };
}

export async function canonizeWithJsonLd(input: any, documentLoader: any): Promise<string> {
  const options = {
    algorithm: 'URDNA2015',
    format: 'application/n-quads',
    documentLoader,
    useNative: false,
    safe: false,
  } as const;
  return await (jsonld as any).canonize(input, options);
}

export function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrs) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

export function resolveProofContext(proofType: string): string[] | null {
  switch (proofType) {
    case 'Ed25519Signature2020':
    case 'Ed25519Signature2018':
      return [
        'https://w3id.org/security/v2',
        'https://w3id.org/security/suites/ed25519-2020/v1'
      ];
    // ... other cases
  }
  return null;
}

function hexToBytes(hex: string): Uint8Array | undefined {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) return undefined;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    const v = Number.parseInt(clean.slice(i, i + 2), 16);
    if (Number.isNaN(v)) return undefined;
    out[i / 2] = v;
  }
  return out;
}

function decodeBase64UrlWithoutPrefix(input: string): Uint8Array {
  const value = input.startsWith('u') ? input : `u${input}`;
  return base64url.decode(value);
}
