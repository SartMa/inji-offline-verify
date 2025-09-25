import * as jsigs from 'jsonld-signatures';
import { Ed25519Signature2020 } from '@digitalbazaar/ed25519-signature-2020';
import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';
import { Ed25519Signature2018 } from '@digitalbazaar/ed25519-signature-2018';
import { Ed25519VerificationKey2018 } from '@digitalbazaar/ed25519-verification-key-2018';

import { CredentialsVerifier } from './CredentialsVerifier.js';
import { CredentialFormat } from './constants/CredentialFormat.js';
import { CredentialValidatorConstants } from './constants/CredentialValidatorConstants.js';
import { CredentialVerifierConstants } from './constants/CredentialVerifierConstants.js';
import { Shared } from './constants/Shared.js';
import { OfflineDocumentLoader } from './utils/OfflineDocumentLoader.js';
import { PublicKeyService } from './publicKey/PublicKeyService.js';
import { normalizeVerificationMethodForProof } from './utils/VerificationMethodUtils.js';
import {
  PresentationVerificationResult,
  VCResult,
  VerificationStatus,
  VPVerificationStatus,
  VerificationResult,
} from './data/data.js';

/**
 * PresentationVerifier
 *
 * Verifies a Verifiable Presentation (VP) offline:
 * - Verifies the VP's Linked Data Proof (currently supports Ed25519Signature2018/2020)
 * - Verifies each enclosed Verifiable Credential (VC) using CredentialsVerifier (LDP VC)
 */
export class PresentationVerifier {
  private readonly logger = console;
  private readonly credentialsVerifier = new CredentialsVerifier();
  private readonly publicKeyService = new PublicKeyService();

  async verify(presentation: string): Promise<PresentationVerificationResult> {
    this.logger.info('[PresentationVerifier] Received Presentation for verification');

    let vpObject: any;
    try {
      vpObject = JSON.parse(presentation);
    } catch {
      throw new Error('Unsupported VP Token type');
    }

    // 1) Verify VP proof (LDP)
    const proofStatus = await this.verifyVpProof(vpObject);

    // 2) Verify each embedded VC
    const vcs = this.extractVerifiableCredentials(vpObject);
    const vcResults: VCResult[] = [];
    for (const vc of vcs) {
      try {
        const vcStr = typeof vc === 'string' ? vc : JSON.stringify(vc);
        const result: VerificationResult = await this.credentialsVerifier.verify(vcStr, CredentialFormat.LDP_VC);
        const status = this.mapVerificationResultToStatus(result);
        vcResults.push(new VCResult(vcStr, status));
      } catch (e) {
        vcResults.push(new VCResult(typeof vc === 'string' ? vc : JSON.stringify(vc), VerificationStatus.INVALID));
      }
    }

    return new PresentationVerificationResult(proofStatus, vcResults);
  }

  private extractVerifiableCredentials(vpObject: any): any[] {
    const key = Shared.KEY_VERIFIABLE_CREDENTIAL || 'verifiableCredential';
    const raw = vpObject?.[key];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  private mapVerificationResultToStatus(res: VerificationResult): VerificationStatus {
    const expiredCode = CredentialValidatorConstants.ERROR_CODE_VC_EXPIRED;
    if (res.verificationStatus) {
      return res.verificationErrorCode === expiredCode
        ? VerificationStatus.EXPIRED
        : VerificationStatus.SUCCESS;
    }
    return res.verificationErrorCode === expiredCode
      ? VerificationStatus.EXPIRED
      : VerificationStatus.INVALID;
  }

  private async verifyVpProof(vpObject: any): Promise<VPVerificationStatus> {
    try {
      const proof = vpObject?.proof;
      if (!proof) return VPVerificationStatus.INVALID;
      const proofs = Array.isArray(proof) ? proof : [proof];

      for (const p of proofs) {
        const ok = await this.verifySingleVpProof(vpObject, p);
        if (!ok) return VPVerificationStatus.INVALID;
      }
      return VPVerificationStatus.VALID;
    } catch (e: any) {
      const msg = (e?.message ?? '').toString();
      // Bubble up offline missing dependencies for a friendlier upstream message
      if (msg.includes(CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING)) {
        throw e;
      }
      return VPVerificationStatus.INVALID;
    }
  }

  private async verifySingleVpProof(vpObject: any, proof: any): Promise<boolean> {
    switch (proof?.type) {
      case 'Ed25519Signature2020':
        return this.verifyWithSuite(vpObject, proof, Ed25519Signature2020, Ed25519VerificationKey2020);
      case 'Ed25519Signature2018':
        return this.verifyWithSuite(vpObject, proof, Ed25519Signature2018, Ed25519VerificationKey2018);
      case 'JsonWebSignature2020':
        // Not implemented without additional dependencies; treat as invalid for now
        this.logger.warn('[PresentationVerifier] JsonWebSignature2020 not supported without extra deps');
        return false;
      default:
        this.logger.error(`[PresentationVerifier] Unsupported VP proof type: ${proof?.type}`);
        return false;
    }
  }

  private async verifyWithSuite(vpObject: any, proof: any, Suite: any, VerificationKey: any): Promise<boolean> {
    // Resolve public key via SDK cache (with online fallback when available)
    const vm = proof.verificationMethod;
    const publicKeyData = await this.publicKeyService.getPublicKey(vm);
    if (!publicKeyData) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        throw new Error(CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING);
      }
      return false;
    }

    // Normalize for suite expectations (2018 expects Base58, 2020 expects Multibase)
  const normalizedVm = normalizeVerificationMethodForProof(publicKeyData, proof.type, vm);
    const keyPair = await VerificationKey.from(normalizedVm);
    const suite = new Suite({ key: keyPair, verificationMethod: normalizedVm.id });

    // For VP, the common proofPurpose is 'authentication'; build minimal controller doc accordingly
    const controllerDoc = {
      '@context': 'https://w3id.org/security/v2',
      id: normalizedVm.controller || publicKeyData.controller,
      authentication: [normalizedVm.id],
    };

    const result = await jsigs.verify(
      { ...vpObject },
      {
        suite,
        purpose: new jsigs.purposes.AuthenticationProofPurpose({ controller: controllerDoc }),
        documentLoader: OfflineDocumentLoader.getDocumentLoader(),
      }
    );

    if (result.verified) return true;

    // If jsonld-signatures surfaced offline missing contexts, propagate a specific error
    const err = result.error as any;
    const flatten = (e: any): string[] => {
      if (!e) return [];
      const out: string[] = [];
      if (typeof e.message === 'string') out.push(e.message);
      if (Array.isArray(e.errors)) e.errors.forEach((sub: any) => out.push(...flatten(sub)));
      if (Array.isArray(e.details)) e.details.forEach((sub: any) => out.push(...flatten(sub)));
      return out;
    };
    const msg = flatten(err).join(' | ');
    if (msg.includes(CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING)) {
      throw new Error(CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING);
    }
    this.logger.error('[PresentationVerifier] VP proof verification failed:', result.error);
    return false;
  }

}
