import type { PublicKeyData } from './Types.js';
import { PublicKeyNotFoundError, PublicKeyTypeNotSupportedError } from './Types.js';
import { base58btc } from 'multiformats/bases/base58';
import { secp256k1 } from '@noble/curves/secp256k1';

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

export function decodeDidKeyMultibaseEd25519(mb: string): Uint8Array {
  // Expect leading multibase char 'z' for base58btc
  if (!mb || mb.length < 2) throw new PublicKeyNotFoundError('Invalid multibase key');
  const code = mb[0];
  let bytes: Uint8Array;
  if (code === 'z') {
    bytes = base58btc.decode(mb);
  } else {
    throw new PublicKeyTypeNotSupportedError(`Unsupported multibase prefix: ${code}`);
  }
  // Check multicodec header 0xed 0x01 and length 34 (header 2 + 32)
  if (bytes.length !== 34 || bytes[0] !== 0xed || bytes[1] !== 0x01) {
    throw new PublicKeyTypeNotSupportedError('Unsupported or invalid did:key multicodec for Ed25519');
  }
  return bytes.slice(2);
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
  const raw = decodeDidKeyMultibaseEd25519(multibaseKey);
  const spki = buildEd25519SpkiFromRaw(raw);
  return {
    verificationMethod,
    keyType,
    algorithm: 'Ed25519',
    source: 'multibase',
    bytes: spki,
  };
}
