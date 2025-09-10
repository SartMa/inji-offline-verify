import type { PublicKeyGetter } from '../PublicKeyGetter.ts';
import type { PublicKeyData } from '../Types.ts';
import { base64UrlDecode, buildEd25519SpkiFromRaw } from '../Utils.ts';

export class DidJwkPublicKeyGetter implements PublicKeyGetter {
  async get(verificationMethod: string): Promise<PublicKeyData> {
    // Format: did:jwk:<base64url(JWK JSON)>, optional #fragment ignored for key material
    const base = verificationMethod.split('#')[0];
    const encoded = base.split('did:jwk:')[1];
    if (!encoded) throw new Error('Invalid did:jwk');
    const jwkJson = new TextDecoder().decode(base64UrlDecode(encoded));
    const jwk = JSON.parse(jwkJson);
    // Kotlin treats this as Ed25519 OctetKeyPair
    if (jwk.kty === 'OKP' && jwk.crv === 'Ed25519' && jwk.x) {
      const raw = base64UrlDecode(jwk.x);
      const spki = buildEd25519SpkiFromRaw(raw);
      return {
        verificationMethod,
        keyType: 'Ed25519VerificationKey2020',
        algorithm: 'Ed25519',
        source: 'jwk',
        bytes: spki,
        jwk,
      };
    }
    throw new Error('Unsupported jws signature algorithm');
  }
}
