import { Base64Utils } from '../utils/Base64Utils.js';
import { hexToBytes } from '../publicKey/Utils.js';

interface CachedEcKey {
  type?: string;
  controller?: string;
  publicKeyMultibase?: string;
  publicKeyJwk?: JsonWebKey;
  publicKeyHex?: string;
}

export interface EcVerificationDocuments {
  verificationMethodDoc: any;
  controllerDoc: any;
}

export function buildEcVerificationDocuments(
  publicKeyData: CachedEcKey,
  verificationMethodUrl: string,
  logger: Pick<Console, 'error'> & Partial<Pick<Console, 'debug'>>
): EcVerificationDocuments | null {
  const jwk = extractEcJwk(publicKeyData, logger);
  const hasMultibase = publicKeyData.type === 'Multikey' && publicKeyData.publicKeyMultibase;
  if (!jwk && !hasMultibase) {
  logger.debug?.('❌ Unable to derive EC key material (expected P-256 or P-384) from cached public key');
    return null;
  }

  const controllerId = publicKeyData.controller || verificationMethodUrl.split('#')[0] || '';
  const vmContexts = new Set([
    'https://www.w3.org/ns/did/v1',
    'https://w3id.org/security/data-integrity/v2'
  ]);
  if (publicKeyData.type === 'Multikey') {
    vmContexts.add('https://w3id.org/security/multikey/v1');
  }

  const verificationMethodDoc: any = {
    '@context': Array.from(vmContexts),
    id: verificationMethodUrl,
    type: publicKeyData.type || (publicKeyData.publicKeyMultibase ? 'Multikey' : 'JsonWebKey2020'),
    controller: controllerId,
  };
  if (publicKeyData.type === 'Multikey' && publicKeyData.publicKeyMultibase) {
    verificationMethodDoc.publicKeyMultibase = publicKeyData.publicKeyMultibase;
  } else if (jwk) {
    verificationMethodDoc.publicKeyJwk = jwk;
  }

  const controllerContexts = new Set([
    'https://www.w3.org/ns/did/v1',
    'https://w3id.org/security/data-integrity/v2'
  ]);
  if (publicKeyData.type === 'Multikey') {
    controllerContexts.add('https://w3id.org/security/multikey/v1');
  }

  const controllerDoc = {
    '@context': Array.from(controllerContexts),
    id: controllerId,
    assertionMethod: [verificationMethodUrl]
  };

  return { verificationMethodDoc, controllerDoc };
}

export function extractEcJwk(
  publicKeyData: CachedEcKey,
  logger: Pick<Console, 'error'> & Partial<Pick<Console, 'debug'>>
): JsonWebKey | null {
  const jwk = publicKeyData?.publicKeyJwk;
  const crv = jwk?.crv?.toUpperCase?.();
  if (jwk && jwk.x && jwk.y && crv) {
    if (crv === 'P-256' || crv === 'SECP256R1') {
      return {
        kty: jwk.kty ?? 'EC',
        crv: 'P-256',
        x: jwk.x,
        y: jwk.y
      };
    }
    if (crv === 'P-384' || crv === 'SECP384R1') {
      return {
        kty: jwk.kty ?? 'EC',
        crv: 'P-384',
        x: jwk.x,
        y: jwk.y
      };
    }
  }

  const hex = publicKeyData?.publicKeyHex;
  if (typeof hex === 'string' && hex.length > 0) {
    try {
      const bytes = hexToBytes(hex);
      if (bytes.length === 65 && bytes[0] === 0x04) {
        const xBytes = bytes.slice(1, 33);
        const yBytes = bytes.slice(33, 65);
        return {
          kty: 'EC',
          crv: 'P-256',
          x: Base64Utils.base64UrlEncode(xBytes),
          y: Base64Utils.base64UrlEncode(yBytes)
        };
      }
      if (bytes.length === 97 && bytes[0] === 0x04) {
        const xBytes = bytes.slice(1, 49);
        const yBytes = bytes.slice(49, 97);
        return {
          kty: 'EC',
          crv: 'P-384',
          x: Base64Utils.base64UrlEncode(xBytes),
          y: Base64Utils.base64UrlEncode(yBytes)
        };
      }
    } catch (e) {
  logger.debug?.('⚠️ Failed to derive EC JWK from hex encoding:', (e as Error).message);
    }
  }

  return null;
}
