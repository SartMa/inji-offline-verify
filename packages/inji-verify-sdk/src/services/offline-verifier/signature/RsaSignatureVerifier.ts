import { CredentialVerifierConstants } from '../constants/CredentialVerifierConstants.js';
import { PublicKeyService } from '../publicKey/PublicKeyService.js';
import { parsePemToDer } from '../publicKey/Utils.js';
import { Base64Utils } from '../utils/Base64Utils.js';
import { OfflineDocumentLoader } from '../utils/OfflineDocumentLoader.js';
import {
  computeLinkedDataVerifyArtifacts,
  concatBytes,
} from '../utils/VerificationMethodUtils.js';
import { createSdkLogger } from '../../../utils/logger.js';

export class RsaSignatureVerifier {
  constructor(
    private readonly publicKeyService: PublicKeyService,
    private readonly logger: Console = createSdkLogger('RsaSignatureVerifier'),
  ) {}

  async verify(vcObject: any, proof: any): Promise<boolean> {
    try {
  this.logger.debug?.('🔎 [RSA] Starting verification', {
        verificationMethod: proof.verificationMethod,
        created: proof.created,
        proofPurpose: proof.proofPurpose,
      });

      const doc = { ...vcObject };
      delete doc.proof;

      const { payloadBytes } = await computeLinkedDataVerifyArtifacts(
        doc,
        proof,
        OfflineDocumentLoader.getDocumentLoader(),
      );
  this.logger.debug?.('🧮 [RSA] Canonicalization complete', {
        payloadBytesLength: payloadBytes.length,
      });

      const jws: string = proof.jws;
      if (!jws || typeof jws !== 'string') {
        this.logger.debug?.('❌ [RSA] Proof did not contain a valid JWS string');
        throw new Error('Invalid JWS in proof');
      }
  this.logger.debug?.('🔏 [RSA] Received JWS', {
        length: jws.length,
        preview: this.maskString(jws),
      });

      const parts = jws.split('.');
      if (parts.length !== 3) throw new Error('Invalid JWS format; expected three parts');

      const [protectedHeaderB64,, signatureB64] = parts;
      if (!protectedHeaderB64 || !signatureB64) throw new Error('Missing JWS components');

      const headerJson = Base64Utils.base64UrlDecode(protectedHeaderB64);
      const header = JSON.parse(headerJson);
  this.logger.debug?.('🧾 [RSA] Parsed JWS header', { header });

      const alg = header.alg;
      if (alg !== CredentialVerifierConstants.JWS_RS256_SIGN_ALGO_CONST && alg !== CredentialVerifierConstants.JWS_PS256_SIGN_ALGO_CONST) {
        this.logger.debug?.(`❌ Unsupported RSA JWS algorithm: ${alg}`);
        return false;
      }
  this.logger.debug?.(`⚙️ [RSA] Using algorithm ${alg}`);

      if (header.b64 !== false || !Array.isArray(header.crit) || !header.crit.includes('b64')) {
        this.logger.debug?.('⚠️ RSA proof header missing detached payload flags (b64=false, crit contains b64). Proceeding cautiously.');
      }

      const vm = await this.publicKeyService.getPublicKey(proof.verificationMethod);
      if (!vm) {
        this.logger.debug?.(`❌ Could not resolve public key for: ${proof.verificationMethod}`);
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          throw new Error(CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING);
        }
        return false;
      }
  this.logger.debug?.('🔑 [RSA] Loaded verification method', {
        controller: vm.controller,
        type: vm.type,
        material: this.describePublicKeyMaterial(vm),
      });

      const subtle = await this.getSubtleCrypto();
      const cryptoKey = await this.importRsaPublicKey(vm, alg, subtle);
      if (!cryptoKey) {
        this.logger.debug?.('❌ Unable to import RSA public key for verification');
        return false;
      }

      const encoder = new TextEncoder();
      const signingInputBytes = concatBytes(
        encoder.encode(protectedHeaderB64),
        encoder.encode('.'),
        payloadBytes,
      );

      const signatureSource = Base64Utils.base64UrlDecodeToBytes(signatureB64);
      const signatureBytes = new Uint8Array(signatureSource);
      const signingBytes = new Uint8Array(signingInputBytes);
      const verifyParams = alg === CredentialVerifierConstants.JWS_PS256_SIGN_ALGO_CONST
        ? { name: 'RSA-PSS', saltLength: CredentialVerifierConstants.PSS_PARAM_SALT_LEN }
        : { name: 'RSASSA-PKCS1-v1_5' };
  this.logger.debug?.('🪄 [RSA] Prepared signing input and signature buffers', {
        signingInputLength: signingBytes.length,
        signatureLength: signatureBytes.length,
        verifyParamsName: verifyParams.name,
      });

      const verified = await subtle.verify(
        verifyParams,
        cryptoKey,
        signatureBytes,
        signingBytes,
      );

      if (!verified) {
        this.logger.debug?.('❌ RSA signature verification failed');
      } else {
  this.logger.debug?.('✅ [RSA] Signature verified successfully');
      }
      return verified;
    } catch (error: any) {
      this.logger.debug?.('💥 A critical error occurred during RSA signature verification:', error?.message ?? error);
      if (error?.message === CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING) {
        throw error;
      }
      return false;
    }
  }

  private async getSubtleCrypto(): Promise<SubtleCrypto> {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
      return globalThis.crypto.subtle;
    }
    if (typeof window === 'undefined') {
      try {
        const { webcrypto } = await import('node:crypto');
        if (webcrypto?.subtle) {
          return webcrypto.subtle as unknown as SubtleCrypto;
        }
      } catch (error) {
        this.logger.debug?.('⚠️ Unable to load Node.js webcrypto implementation:', error);
      }
    }
    throw new Error('SubtleCrypto not available in this environment');
  }

  private async importRsaPublicKey(vm: any, alg: string, subtle: SubtleCrypto): Promise<CryptoKey | null> {
    const algorithm: RsaHashedImportParams = alg === CredentialVerifierConstants.JWS_PS256_SIGN_ALGO_CONST
      ? { name: 'RSA-PSS', hash: 'SHA-256' }
      : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };

    if (vm.publicKeyJwk) {
      try {
        const jwk = {
          ...vm.publicKeyJwk,
          alg: vm.publicKeyJwk.alg ?? alg,
          key_ops: vm.publicKeyJwk.key_ops ?? ['verify'],
          ext: vm.publicKeyJwk.ext ?? true,
        };
        const key = await subtle.importKey('jwk', jwk, algorithm, false, ['verify']);
  this.logger.debug?.('🔑 [RSA] Imported verification key from JWK', {
          jwkSummary: this.describeJwk(vm.publicKeyJwk),
        });
        return key;
      } catch (error) {
        this.logger.debug?.('⚠️ Failed to import RSA public key from JWK, falling back to PEM if available:', error);
      }
    }

    if (vm.publicKeyPem) {
      try {
        const der = parsePemToDer(vm.publicKeyPem);
        const derBytes = new Uint8Array(der);
        const key = await subtle.importKey('spki', derBytes, algorithm, false, ['verify']);
  this.logger.debug?.('🔑 [RSA] Imported verification key from PEM', {
          pemLength: vm.publicKeyPem.length,
        });
        return key;
      } catch (error) {
        this.logger.debug?.('💥 Failed to import RSA public key from PEM:', error);
      }
    }

    return null;
  }

  private maskString(value: string, visible: number = 10): string {
    if (!value) return 'N/A';
    if (value.length <= visible) return value;
    return `${value.slice(0, visible)}…(${value.length - visible} hidden)`;
  }

  private describePublicKeyMaterial(vm: any): Record<string, unknown> {
    return {
      hasJwk: !!vm?.publicKeyJwk,
      jwkKty: vm?.publicKeyJwk?.kty,
      jwkAlg: vm?.publicKeyJwk?.alg,
      jwkModulusLength: vm?.publicKeyJwk?.n ? vm.publicKeyJwk.n.length : undefined,
      hasPem: typeof vm?.publicKeyPem === 'string',
      pemLength: vm?.publicKeyPem?.length,
      hasMultibase: !!vm?.publicKeyMultibase,
      hasHex: !!vm?.publicKeyHex,
    };
  }

  private describeJwk(jwk: any): Record<string, unknown> {
    if (!jwk) {
      return { present: false };
    }
    return {
      kty: jwk.kty,
      alg: jwk.alg,
      use: jwk.use,
      key_ops: jwk.key_ops,
      nLength: typeof jwk.n === 'string' ? jwk.n.length : undefined,
      eLength: typeof jwk.e === 'string' ? jwk.e.length : undefined,
      crv: jwk.crv,
    };
  }
}
