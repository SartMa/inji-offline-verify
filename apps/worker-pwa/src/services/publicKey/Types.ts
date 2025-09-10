export type KeySource = 'pem' | 'jwk' | 'hex' | 'multibase' | 'did';

export interface PublicKeyData {
  // Original verification method URI used to fetch/derive this key
  verificationMethod: string;
  // DID key type (e.g., Ed25519VerificationKey2020, EcdsaSecp256k1VerificationKey2019, RsaVerificationKey2018)
  keyType: string;
  // Algorithm family (Ed25519, secp256k1, RSA)
  algorithm: 'Ed25519' | 'secp256k1' | 'RSA' | 'Unknown';
  // Where we derived this from
  source: KeySource;
  // Raw public key bytes if applicable (e.g., SPKI DER or raw point for EC)
  bytes?: Uint8Array;
  // For JWK keys, the JWK itself
  jwk?: any;
  // Optional uncompressed EC point hex (04||X||Y) for secp256k1
  ecUncompressedHex?: string;
  // Optional PEM text if came as PEM
  pem?: string;
}

export class PublicKeyErrors extends Error {
  constructor(message: string) { super(message); this.name = 'PublicKeyErrors'; }
}

export class PublicKeyNotFoundError extends PublicKeyErrors {
  constructor(message = 'Public key not found') { super(message); this.name = 'PublicKeyNotFoundError'; }
}

export class PublicKeyTypeNotSupportedError extends PublicKeyErrors {
  constructor(message = 'Public key type is not supported') { super(message); this.name = 'PublicKeyTypeNotSupportedError'; }
}
