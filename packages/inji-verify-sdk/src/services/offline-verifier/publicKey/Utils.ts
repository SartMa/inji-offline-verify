import type { PublicKeyData } from './Types.js';
import { PublicKeyNotFoundError, PublicKeyTypeNotSupportedError } from './Types.js';
import { base58btc } from 'multiformats/bases/base58';
import { secp256k1 } from '@noble/curves/secp256k1';
import { p256 } from '@noble/curves/p256';
import { p384 } from '@noble/curves/p384';

// Constants analogous to Kotlin CredentialVerifierConstants
export const RSA_KEY_TYPE = 'RsaVerificationKey2018';
export const ED25519_KEY_TYPE_2018 = 'Ed25519VerificationKey2018';
export const ED25519_KEY_TYPE_2020 = 'Ed25519VerificationKey2020';
export const ES256K_KEY_TYPE_2019 = 'EcdsaSecp256k1VerificationKey2019';

export const SECP256K1 = 'secp256k1';

// DER prefix for Ed25519 SubjectPublicKeyInfo (from Kotlin DER_PUBLIC_KEY_PREFIX)
// Kotlin builds SPKI via ASN.1; here we encode static prefix and append 32-byte key.
// SPKI: 30 2a 30 05 06 03 2b 65 70 03 21 00 || 32-bytes
const ED25519_SPKI_PREFIX_HEX = '302a300506032b6570032100';

export function base64UrlDecode(s: string): Uint8Array {
  // Add padding if missing
  const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : '';
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const hasBuffer = typeof (globalThis as any).Buffer !== 'undefined';
  const bin = typeof atob === 'function' ? atob(b64) : hasBuffer ? (globalThis as any).Buffer.from(b64, 'base64').toString('binary') : atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error('Invalid hex string');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function parsePemToDer(pem: string): Uint8Array {
  const lines = pem.trim().split(/\r?\n/).filter(l => !l.startsWith('---'));
  const b64 = lines.join('');
  const hasBuffer2 = typeof (globalThis as any).Buffer !== 'undefined';
  const bin = typeof atob === 'function' ? atob(b64) : hasBuffer2 ? (globalThis as any).Buffer.from(b64, 'base64').toString('binary') : atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function buildEd25519SpkiFromRaw(raw32: Uint8Array): Uint8Array {
  if (raw32.length !== 32) throw new Error('Ed25519 raw public key must be 32 bytes');
  const prefix = hexToBytes(ED25519_SPKI_PREFIX_HEX);
  const out = new Uint8Array(prefix.length + raw32.length);
  out.set(prefix, 0);
  out.set(raw32, prefix.length);
  return out;
}

// Extract raw 32-byte Ed25519 key from SPKI DER bytes
export function spkiToRawEd25519(spki: Uint8Array): Uint8Array {
  if (spki.length === 32) return new Uint8Array(spki);
  // Minimal ASN.1 parse to find BIT STRING content
  const readLen = (buf: Uint8Array, at: number) => {
    let len = buf[at], lenBytes = 1;
    if (len & 0x80) {
      const n = len & 0x7f; len = 0;
      for (let j = 1; j <= n; j++) len = (len << 8) | buf[at + j];
      lenBytes = 1 + n;
    }
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

// Encode raw 32-byte Ed25519 as multibase (z-base58) with ed25519-pub multicodec header 0xed 0x01
export function ed25519RawToMultibase(raw32: Uint8Array): string {
  const header = new Uint8Array([0xed, 0x01]);
  const out = new Uint8Array(header.length + raw32.length);
  out.set(header, 0); out.set(raw32, header.length);
  return base58btc.encode(out);
}

const MULTICODEC_ED25519_WRONG = 0xed01; // This constant is incorrect, the codec is 0xed
const MULTICODEC_P256_UNCOMPRESSED = 0x1200;
const MULTICODEC_P256_COMPRESSED = 0x8024;
const MULTICODEC_P384_UNCOMPRESSED = 0x1201;
const MULTICODEC_P384_COMPRESSED = 0x8025;

function decodeMulticodecVarint(bytes: Uint8Array): { value: number; length: number } {
  let value = 0;
  let shift = 0;
  let index = 0;
  while (index < bytes.length) {
    const byte = bytes[index];
    value |= (byte & 0x7f) << shift;
    index += 1;
    if ((byte & 0x80) === 0) {
      return { value, length: index };
    }
    shift += 7;
    if (shift > 28) break; // prevent runaway for unexpected encodings
  }
  throw new PublicKeyTypeNotSupportedError('Invalid multicodec varint encoding');
}

function decodeDidKeyMultibase(mb: string): { multicodec: number; keyBytes: Uint8Array } {
  if (!mb || mb.length < 2) throw new PublicKeyNotFoundError('Invalid multibase key');
  if (mb[0] !== 'z') {
    throw new PublicKeyTypeNotSupportedError(`Unsupported multibase prefix: ${mb[0]}`);
  }
  const decoded = base58btc.decode(mb);
  if (decoded.length < 2) {
    throw new PublicKeyNotFoundError('Multibase key payload too short');
  }
  const { value, length } = decodeMulticodecVarint(decoded);
  const keyBytes = decoded.subarray(length);
  return { multicodec: value, keyBytes };
}

export function getPublicKeyFromPem(publicKeyPem: string, keyType: string, verificationMethod: string): PublicKeyData {
  try {
    const der = parsePemToDer(publicKeyPem);
    let algorithm: PublicKeyData['algorithm'] = 'Unknown';
    if (keyType === RSA_KEY_TYPE) algorithm = 'RSA';
    if (keyType === ED25519_KEY_TYPE_2018 || keyType === ED25519_KEY_TYPE_2020) algorithm = 'Ed25519';
    return {
      verificationMethod,
      keyType,
      algorithm,
      source: 'pem',
      bytes: der,
      pem: publicKeyPem,
    };
  } catch (e) {
    throw new PublicKeyNotFoundError('Public key object is null');
  }
}

export function getPublicKeyFromJwk(jwk: any, keyType: string, verificationMethod: string): PublicKeyData {
  const kty = jwk?.kty;
  if (!kty) throw new PublicKeyTypeNotSupportedError('Missing kty');

  // ES256K
  if (keyType === ES256K_KEY_TYPE_2019) {
    const crv = jwk.crv;
    if (crv !== SECP256K1) throw new PublicKeyTypeNotSupportedError(`Unsupported EC curve: ${crv}`);
    const x = base64UrlDecode(jwk.x);
    const y = base64UrlDecode(jwk.y);
    const uncompressed = new Uint8Array(1 + x.length + y.length);
    uncompressed[0] = 0x04; // uncompressed prefix
    uncompressed.set(x, 1);
    uncompressed.set(y, 1 + x.length);
    return {
      verificationMethod,
      keyType,
      algorithm: 'secp256k1',
      source: 'jwk',
      bytes: uncompressed,
      jwk,
      ecUncompressedHex: bytesToHex(uncompressed),
    };
  }

  const crv = jwk.crv?.toUpperCase?.();

  // ECDSA with P-256 curve (JsonWebKey2020, etc.)
  if (crv === 'P-256' || crv === 'SECP256R1') {
    if (!jwk.x || !jwk.y) {
      throw new PublicKeyTypeNotSupportedError('P-256 JWK must include x and y coordinates');
    }
    const x = base64UrlDecode(jwk.x);
    const y = base64UrlDecode(jwk.y);
    if (x.length !== 32 || y.length !== 32) {
      throw new PublicKeyTypeNotSupportedError('P-256 public key coordinates must be 32 bytes each');
    }
    const uncompressed = new Uint8Array(65);
    uncompressed[0] = 0x04;
    uncompressed.set(x, 1);
    uncompressed.set(y, 33);
    return {
      verificationMethod,
      keyType,
      algorithm: 'P-256',
      source: 'jwk',
      bytes: uncompressed,
      jwk,
      ecUncompressedHex: bytesToHex(uncompressed),
    };
  }

  // ECDSA with P-384 curve
  if (crv === 'P-384' || crv === 'SECP384R1') {
    if (!jwk.x || !jwk.y) {
      throw new PublicKeyTypeNotSupportedError('P-384 JWK must include x and y coordinates');
    }
    const x = base64UrlDecode(jwk.x);
    const y = base64UrlDecode(jwk.y);
    if (x.length !== 48 || y.length !== 48) {
      throw new PublicKeyTypeNotSupportedError('P-384 public key coordinates must be 48 bytes each');
    }
    const uncompressed = new Uint8Array(97);
    uncompressed[0] = 0x04;
    uncompressed.set(x, 1);
    uncompressed.set(y, 49);
    return {
      verificationMethod,
      keyType,
      algorithm: 'P-384',
      source: 'jwk',
      bytes: uncompressed,
      jwk,
      ecUncompressedHex: bytesToHex(uncompressed),
    };
  }

  // OKP Ed25519 as JWK (not in Kotlin JWK path, but possible via did:jwk)
  if ((jwk.kty === 'OKP' && jwk.crv === 'Ed25519') || keyType === ED25519_KEY_TYPE_2020) {
    const x = base64UrlDecode(jwk.x);
    const spki = buildEd25519SpkiFromRaw(x);
    return {
      verificationMethod,
      keyType,
      algorithm: 'Ed25519',
      source: 'jwk',
      bytes: spki,
      jwk,
    };
  }

  if (keyType === RSA_KEY_TYPE || jwk.kty === 'RSA') {
    return {
      verificationMethod,
      keyType,
      algorithm: 'RSA',
      source: 'jwk',
      jwk,
    };
  }

  throw new PublicKeyTypeNotSupportedError(`Unsupported key type: ${keyType}`);
}

export function getPublicKeyFromHex(hexKey: string, keyType: string, verificationMethod: string): PublicKeyData {
  if (keyType !== ES256K_KEY_TYPE_2019) throw new PublicKeyTypeNotSupportedError(`Unsupported key type: ${keyType}`);
  // Accept compressed hex (33 bytes). Use noble-secp256k1 to parse and get uncompressed point
  const keyBytes = hexToBytes(hexKey);
  // noble Point.fromHex accepts compressed/uncompressed. We just normalize to uncompressed bytes.
  const point = secp256k1.ProjectivePoint.fromHex(keyBytes);
  const uncompressed = point.toRawBytes(false); // false => uncompressed (0x04 || X || Y)
  return {
    verificationMethod,
    keyType,
    algorithm: 'secp256k1',
    source: 'hex',
    bytes: uncompressed,
    ecUncompressedHex: bytesToHex(uncompressed),
  };
}

export function getPublicKeyFromMultibaseEd25519(multibaseKey: string, keyType: string, verificationMethod: string): PublicKeyData {
  const { multicodec, keyBytes } = decodeDidKeyMultibase(multibaseKey);
  
  // --- FIX #1 ---
  // The multicodec for Ed25519 is 0xed, not 0xed01. The constant was wrong.
  if (multicodec === 0xed) {
    // We already have the raw 32-byte key in `keyBytes` from `decodeDidKeyMultibase`
    const spki = buildEd25519SpkiFromRaw(keyBytes);
    return {
      verificationMethod,
      keyType,
      algorithm: 'Ed25519',
      source: 'multibase',
      bytes: spki,
      publicKeyMultibase: multibaseKey,
    };
  }

  if (multicodec === MULTICODEC_P256_UNCOMPRESSED || multicodec === MULTICODEC_P256_COMPRESSED) {
    if (keyBytes.length !== 33 && keyBytes.length !== 65) {
      throw new PublicKeyTypeNotSupportedError('P-256 multibase key must be compressed (33 bytes) or uncompressed (65 bytes)');
    }
    const point = p256.ProjectivePoint.fromHex(keyBytes);
    const uncompressed = point.toRawBytes(false);
    return {
      verificationMethod,
      keyType,
      algorithm: 'P-256',
      source: 'multibase',
      bytes: uncompressed,
      ecUncompressedHex: bytesToHex(uncompressed),
      publicKeyMultibase: multibaseKey,
    };
  }

  if (multicodec === MULTICODEC_P384_UNCOMPRESSED || multicodec === MULTICODEC_P384_COMPRESSED) {
    if (keyBytes.length !== 49 && keyBytes.length !== 97) {
      throw new PublicKeyTypeNotSupportedError('P-384 multibase key must be compressed (49 bytes) or uncompressed (97 bytes)');
    }
    const point = p384.ProjectivePoint.fromHex(keyBytes);
    const uncompressed = point.toRawBytes(false);
    return {
      verificationMethod,
      keyType,
      algorithm: 'P-384',
      source: 'multibase',
      bytes: uncompressed,
      ecUncompressedHex: bytesToHex(uncompressed),
      publicKeyMultibase: multibaseKey,
    };
  }

  const hexCode = `0x${multicodec.toString(16)}`;
  throw new PublicKeyTypeNotSupportedError(`Unsupported or invalid did:key multicodec: ${hexCode}`);
}

export function decodeDidKeyMultibaseEd25519(multibaseKey: string): Uint8Array {
  const { multicodec, keyBytes } = decodeDidKeyMultibase(multibaseKey);

  // --- FIX #2 ---
  // The multicodec for Ed25519 is 0xed, not 0xed01. The constant was wrong.
  if (multicodec !== 0xed) {
    throw new PublicKeyTypeNotSupportedError('Unsupported or invalid did:key multicodec for Ed25519');
  }
  if (keyBytes.length !== 32) {
    throw new PublicKeyTypeNotSupportedError('Ed25519 multibase key must contain 32-byte raw key');
  }
  return keyBytes;
}

/**
 * A simple, lightweight, unauthenticated fetcher for retrieving public documents like
 * DID Documents or JSON-LD Contexts. This has no dependencies on the PWA's NetworkManager.
 * @param url The URL of the public document to fetch.
 * @returns A promise that resolves to the parsed JSON object.
 */
export async function fetchPublicDocument(url: string): Promise<any> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        // We specifically request 'application/did+json' and fall back to 'application/json'
        'Accept': 'application/did+json, application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch document: HTTP ${response.status} ${response.statusText}. Response: ${errorText}`);
    }

    return await response.json();
  } catch (error: any) {
    console.error(`[SDK-didFetcher] Error fetching public document from ${url}:`, error);
    // Re-throw the error so the calling function can handle it.
    throw new Error(`Could not retrieve document from ${url}. Reason: ${error.message}`);
  }
}