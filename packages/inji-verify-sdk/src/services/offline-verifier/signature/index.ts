// src/offline-verifier/signature/index.ts
// TODO: Implement signature verification modules
// export * from './rs256';
// export * from './ps256';
// export * from './ed25519';
// export * from './es256k';
// export * from './cose';

// Placeholder export to prevent module resolution errors
export const SignatureVerifier = {
  rs256: () => { throw new Error('RS256 signature verification not implemented'); },
  ps256: () => { throw new Error('PS256 signature verification not implemented'); },
  ed25519: () => { throw new Error('Ed25519 signature verification not implemented'); },
  es256k: () => { throw new Error('ES256K signature verification not implemented'); },
  cose: () => { throw new Error('COSE signature verification not implemented'); },
};