import { normalizeVerificationMethodForProof } from '../utils/VerificationMethodUtils.js';
import { base64UrlDecode, ed25519RawToMultibase } from '../publicKey/Utils.js';

interface CachedEd25519Key {
  id?: string;
  type?: string;
  controller?: string;
  publicKeyMultibase?: string;
  publicKeyBase58?: string;
}

export interface Ed25519VerificationDocuments {
  verificationMethodDoc: any;
  controllerDoc: any;
}

export function buildEd25519VerificationDocuments(
  publicKeyData: CachedEd25519Key,
  verificationMethodUrl: string,
  logger: Pick<Console, 'error'> & Partial<Pick<Console, 'debug'>>
): Ed25519VerificationDocuments | null {
  let publicKeyMultibase = publicKeyData?.publicKeyMultibase;

  if (!publicKeyMultibase) {
    try {
      const jwk = (publicKeyData as any)?.publicKeyJwk;
      if (jwk?.kty === 'OKP' && jwk?.crv === 'Ed25519' && typeof jwk?.x === 'string') {
        const raw = base64UrlDecode(jwk.x);
        publicKeyMultibase = ed25519RawToMultibase(raw);
      }
    } catch (error: any) {
      logger.debug?.('⚠️ Failed to derive multibase key from JWK:', error?.message ?? error);
    }
  }

  const normalized = normalizeVerificationMethodForProof(
    {
      id: publicKeyData?.id ?? verificationMethodUrl,
      controller: publicKeyData?.controller,
      type: publicKeyData?.type,
      publicKeyMultibase,
      publicKeyBase58: (publicKeyData as any)?.publicKeyBase58,
    },
    'Ed25519Signature2020',
    verificationMethodUrl
  );

  const normalizedMultibase = normalized?.publicKeyMultibase;
  if (!normalizedMultibase) {
  logger.debug?.('❌ Unable to derive Ed25519 public key material from cached verification method');
    return null;
  }

  const controllerId = normalized?.controller || verificationMethodUrl.split('#')[0] || '';
  const prefixedMultibase = normalizedMultibase.startsWith('z') ? normalizedMultibase : `z${normalizedMultibase}`;

  const verificationMethodDoc = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/v2',
      'https://w3id.org/security/suites/ed25519-2020/v1'
    ],
    id: normalized?.id ?? verificationMethodUrl,
    type: 'Ed25519VerificationKey2020',
    controller: controllerId,
    publicKeyMultibase: prefixedMultibase
  };

  const controllerDoc = {
    '@context': [
      'https://www.w3.org/ns/did/v1',
      'https://w3id.org/security/v2'
    ],
    id: controllerId,
    authentication: [verificationMethodUrl],
    assertionMethod: [verificationMethodUrl]
  };

  return { verificationMethodDoc, controllerDoc };
}
