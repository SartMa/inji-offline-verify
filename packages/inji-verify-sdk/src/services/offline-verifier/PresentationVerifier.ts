// High-level VC library (digitalbazaar)
import * as vc from '@digitalbazaar/vc';
// jsonld-signatures v11+ no longer exports extendContextLoader directly; implement lightweight wrapper
type JsonLdDoc = { document: any; documentUrl: string; contextUrl?: string };
function extendContextLoader(factory: (url: string) => Promise<JsonLdDoc>) {
  return async (url: string) => factory(url);
}
// We only need Ed25519 2020 suite for VP verification per requirement
import { Ed25519Signature2020 } from '@digitalbazaar/ed25519-signature-2020';
import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';

// Existing internal imports
import { CredentialsVerifier } from './CredentialsVerifier.js';
import { CredentialFormat } from './constants/CredentialFormat.js';
import { CredentialValidatorConstants } from './constants/CredentialValidatorConstants.js';
import { CredentialVerifierConstants } from './constants/CredentialVerifierConstants.js';
import { Shared } from './constants/Shared.js';
import { OfflineDocumentLoader } from './utils/OfflineDocumentLoader.js';
import { PublicKeyService } from './publicKey/PublicKeyService.js';
import { PresentationVerificationResult, VCResult, VerificationStatus, VPVerificationStatus, VerificationResult } from './data/data.js';

// --- Composite documentLoader ---
// Only resolves JSON-LD @contexts via offline cache. DID resolution is handled separately by PublicKeyService.
const offlineContextLoader = OfflineDocumentLoader.getDocumentLoader();
const baseLoader = (vc as any).defaultDocumentLoader || (vc as any).defaultDocumentLoader; // fallback
const compositeDocumentLoader = extendContextLoader(async (url: string) => {
  if (!url.startsWith('did:')) {
    try {
      return await offlineContextLoader(url);
    } catch (e) {
      // Fall back to base loader (may still succeed if online). If fully offline this will fail upstream gracefully.
    }
  }
  return baseLoader(url);
});

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

    const proofStatus = await this.verifyVpEd25519(vpObject);
    const vcs = this.extractVerifiableCredentials(vpObject);
    this.logger.info(`[PresentationVerifier] Found ${vcs.length} embedded VC(s) in VP`);

    const vcResults: VCResult[] = [];
    for (const vcItem of vcs) {
      try {
        const vcStr = typeof vcItem === 'string' ? vcItem : JSON.stringify(vcItem);
        const result: VerificationResult = await this.credentialsVerifier.verify(vcStr, CredentialFormat.LDP_VC);
        vcResults.push(new VCResult(vcStr, this.mapVerificationResultToStatus(result)));
      } catch (e) {
        this.logger.error('[PresentationVerifier] VC verification error; marking INVALID', e);
        vcResults.push(new VCResult(typeof vcItem === 'string' ? vcItem : JSON.stringify(vcItem), VerificationStatus.INVALID));
      }
    }
    return new PresentationVerificationResult(proofStatus, vcResults);
  }

  // ---- Internal helpers ----
  private extractVerifiableCredentials(vpObject: any): any[] {
    const key = Shared.KEY_VERIFIABLE_CREDENTIAL || 'verifiableCredential';
    const raw = vpObject?.[key];
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
  }

  private mapVerificationResultToStatus(res: VerificationResult): VerificationStatus {
    const expiredCode = CredentialValidatorConstants.ERROR_CODE_VC_EXPIRED;
    if (res.verificationStatus) {
      return res.verificationErrorCode === expiredCode ? VerificationStatus.EXPIRED : VerificationStatus.SUCCESS;
    }
    return res.verificationErrorCode === expiredCode ? VerificationStatus.EXPIRED : VerificationStatus.INVALID;
  }

  /**
   * Verify VP proof(s) but ONLY accept Ed25519Signature2020 per current requirement.
   * If multiple proofs exist we consider the VP VALID if at least one Ed25519Signature2020 proof verifies.
   */
  private async verifyVpEd25519(vpObject: any): Promise<VPVerificationStatus> {
    const proof = vpObject?.proof;
    if (!proof) {
      this.logger.error('[PresentationVerifier] VP is missing proof section');
      return VPVerificationStatus.INVALID;
    }
    const proofs = (Array.isArray(proof) ? proof : [proof]).filter(p => p?.type === 'Ed25519Signature2020');
    if (!proofs.length) {
      this.logger.error('[PresentationVerifier] No Ed25519Signature2020 proof present');
      return VPVerificationStatus.INVALID;
    }
    this.logger.info(`[PresentationVerifier] Processing ${proofs.length} Ed25519Signature2020 proof(s)`);

    for (const p of proofs) {
      const ok = await this.verifySingleEd25519Proof(vpObject, p);
      if (ok) return VPVerificationStatus.VALID; // one valid proof is enough
    }
    return VPVerificationStatus.INVALID;
  }

  private async verifySingleEd25519Proof(vpObject: any, proof: any): Promise<boolean> {
    try {
      if (!proof.verificationMethod) {
        this.logger.error('[PresentationVerifier] Proof missing verificationMethod');
        return false;
      }
      const pk = await this.publicKeyService.getPublicKey(proof.verificationMethod);
      if (!pk || !pk.publicKeyMultibase) {
        this.logger.error('❌ Unable to resolve Ed25519 public key (multibase required) for', proof.verificationMethod);
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          // propagate offline missing dependency so caller can surface a clear message if desired
          throw new Error(CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING);
        }
        return false;
      }

      const keyPair = await Ed25519VerificationKey2020.from({
        id: pk.id || proof.verificationMethod,
        controller: pk.controller || proof.verificationMethod.split('#')[0],
        publicKeyMultibase: pk.publicKeyMultibase
      });
      const suite = new Ed25519Signature2020({ key: keyPair, verificationMethod: keyPair.id });
      const opts: any = {
        presentation: vpObject,
        suite,
        documentLoader: compositeDocumentLoader
      };
      if (proof.challenge) opts.challenge = proof.challenge; // support auth / replay-prevention flows

      this.logger.info('[PresentationVerifier] Verifying VP with Ed25519Signature2020 using digitalbazaar/vc');
      const result = await vc.verify(opts);
      if (!result.verified) {
        this.logger.error('❌ VP Ed25519Signature2020 verification failed:', result.error || result);
        return false;
      }
      this.logger.info('✅ VP Ed25519Signature2020 proof verified');
      return true;
    } catch (e: any) {
      if (e?.message === CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING) throw e;
      this.logger.error('💥 Error during Ed25519 VP proof verification:', e);
      return false;
    }
  }
}
