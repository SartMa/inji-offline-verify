// External cryptographic libraries - The "Verification Engine"
import * as jsigs from 'jsonld-signatures';
import * as vc from '@digitalbazaar/vc';
import { Ed25519Signature2020 } from '@digitalbazaar/ed25519-signature-2020';
import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';
import { Ed25519Signature2018 } from '@digitalbazaar/ed25519-signature-2018';
import { Ed25519VerificationKey2018 } from '@digitalbazaar/ed25519-verification-key-2018';
import { DataIntegrityProof } from '@digitalbazaar/data-integrity';
import { cryptosuite as ecdsaRdfc2019Cryptosuite } from '@digitalbazaar/ecdsa-rdfc-2019-cryptosuite';
import { secp256k1 } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha2.js';
import { base64url } from 'multiformats/bases/base64';

// Import SDK-internal utilities and exceptions
import { UnknownException } from '../../exception/index.js';
import { CredentialVerifierConstants } from '../../constants/CredentialVerifierConstants.js';
import { PublicKeyService } from '../../publicKey/PublicKeyService.js'; // This service should live inside the SDK
import { OfflineDocumentLoader } from '../../utils/OfflineDocumentLoader.js'; // Your smart loader, also inside the SDK
import { getContext } from '../../cache/utils/CacheHelper.js';
import {
  normalizeVerificationMethodForProof,
  computeLinkedDataVerifyArtifacts,
  concatBytes,
  resolveSecp256k1PublicKeyBytes,
} from '../../utils/VerificationMethodUtils.js';
import { RsaSignatureVerifier } from './RsaSignatureVerifier.js';
import { buildEcVerificationDocuments } from '../../signature/ecDataIntegrity.js';


/**
 * LDP (Linked Data Proof) Verifier
 *
 * PURPOSE: This class performs the CORE CRYPTOGRAPHIC verification of a credential's signature.
 * It is the forensic expert that validates the signature is genuine and the document is untampered.
 *
 * It relies on the industry-standard `jsonld-signatures` library to do the heavy lifting of
 * canonicalization and cryptographic checks, and uses our custom Document Loader to handle
 * offline-first context and key resolution.
 *
 * NOTE: This class no longer performs structural validation. It assumes it is being given
 * a structurally valid credential by an orchestrator (like a parent CredentialVerifier).
 */
export class LdpVerifier {
  private readonly logger = console;
  private readonly publicKeyService: PublicKeyService;
  private readonly rsaVerifier: RsaSignatureVerifier;

  constructor() {
    // The PublicKeyService is now an internal part of the SDK.
    // It will use the SDK's cache to resolve keys.
    this.publicKeyService = new PublicKeyService();
    this.rsaVerifier = new RsaSignatureVerifier(this.publicKeyService, this.logger);
  }

  /**
   * MAIN CRYPTOGRAPHIC VERIFICATION METHOD
   *
   * This is the entry point for verifying the signature of a credential.
   *
   * @param credential - The Verifiable Credential as a JSON string.
   * @returns A Promise that resolves to `true` if all signatures are cryptographically valid, `false` otherwise.
   */
  async verify(credential: string): Promise<boolean> {
    try {
      this.logger.info('🔍 Starting credential verification process');

      const vcJsonLdObject = JSON.parse(credential);
      const contextList = Array.isArray(vcJsonLdObject['@context']) ? vcJsonLdObject['@context'] : [vcJsonLdObject['@context']];
      const contextUris = (contextList || []).filter((ctx: any) => typeof ctx === 'string');
      this.logger.info('📄 Credential summary', {
        id: vcJsonLdObject.id ?? 'N/A',
        issuer: vcJsonLdObject.issuer ?? 'N/A',
        proofType: vcJsonLdObject.proof?.type ?? (Array.isArray(vcJsonLdObject.proof) ? vcJsonLdObject.proof.map((p: any) => p.type) : 'N/A'),
        contextUris,
      });

      // OFFLINE PREFLIGHT: ensure all @context URLs are present in cache to surface a friendly error early
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const rawCtx = vcJsonLdObject['@context'];
        const ctxList = Array.isArray(rawCtx) ? rawCtx : [rawCtx];
        const urlList = (ctxList || []).filter((c: any) => typeof c === 'string') as string[];
        for (const url of urlList) {
          const present = await getContext(url);
          if (!present) {
            throw new Error(CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING);
          }
        }
      }

      // STEP 1: Extract the proof(s). A credential can have one or more signatures.
      const proof = vcJsonLdObject.proof;
      if (!proof) {
        this.logger.error("❌ Cryptographic verification failed: No 'proof' field found in the credential.");
        return false;
      }

      const proofs = Array.isArray(proof) ? proof : [proof];
      this.logger.info(`🧾 Found ${proofs.length} proof(s) to verify`);

      // STEP 2: Verify EACH proof. For a credential to be valid, ALL its signatures must be valid.
      for (const singleProof of proofs) {
        this.logger.info(`🔐 Verifying proof of type: ${singleProof.type}`);
        this.logger.info('   Proof metadata', {
          verificationMethod: singleProof.verificationMethod,
          proofPurpose: singleProof.proofPurpose,
          created: singleProof.created,
          contextOverride: singleProof['@context'] ? 'yes' : 'no',
        });

        // We pass the full VC object and the specific proof to be verified.
        const isProofValid = await this.verifySingleProof(vcJsonLdObject, singleProof);

        if (!isProofValid) {
          this.logger.error(`❌ Proof verification FAILED for type: ${singleProof.type}. Credential is not valid.`);
          return false; // If any proof fails, the entire credential fails.
        }
      }

      this.logger.info("✅ All proofs verified successfully. Credential signature is valid!");
      return true;

    } catch (exception: any) {
      this.logger.error('💥 An unexpected error occurred during signature verification:', exception.message);
      const msg = (exception?.message ?? '').toString();
      if (msg.includes(CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING)) {
        // Propagate offline-missing-deps so upper layer can map to friendly message
        throw exception;
      }
      // Wrap unknown errors for consistent error handling upstream.
      throw new UnknownException(`Error during cryptographic verification: ${exception.message}`);
    }
  }

  /**
   * Orchestrates the verification of a SINGLE proof by routing to the correct cryptographic suite.
   *
   * @param vcObject The full credential object.
   * @param proof The specific proof object from the credential to be verified.
   * @returns A promise resolving to `true` if the proof is valid.
   */
  private async verifySingleProof(vcObject: any, proof: any): Promise<boolean> {
    // Route to the appropriate verification method based on the signature type.
    // This structure makes it easy to add support for more signature types later.
    switch (proof.type) {
      case 'Ed25519Signature2020':
        return this.verifyWithSuite(vcObject, proof, Ed25519Signature2020, Ed25519VerificationKey2020);

      case 'Ed25519Signature2018':
        return this.verifyWithSuite(vcObject, proof, Ed25519Signature2018, Ed25519VerificationKey2018);

      case 'EcdsaSecp256k1Signature2019':
        this.logger.info('🔐 Using noble secp256k1 verifier for EcdsaSecp256k1Signature2019');
        return this.verifyEcdsaWithNoble(vcObject, proof);

      case 'RsaSignature2018':
      case 'JsonWebSignature2020':
        return this.rsaVerifier.verify(vcObject, proof);

      case 'DataIntegrityProof':
        if (proof.cryptosuite === 'ecdsa-rdfc-2019') {
          this.logger.info('🔐 Using DataIntegrityProof verifier for ecdsa-rdfc-2019');
          return this.verifyDataIntegrityEcdsa(vcObject, proof);
        }
        this.logger.error(`❌ Unsupported DataIntegrityProof cryptosuite: ${proof.cryptosuite || 'unknown'}`);
        return false;

      default:
        this.logger.error(`❌ Unsupported signature type: ${proof.type}`);
        return false;
    }
  }

  private async verifyDataIntegrityEcdsa(vcObject: any, proof: any): Promise<boolean> {
    try {
      const verificationMethodUrl: string | undefined = proof?.verificationMethod;
      if (!verificationMethodUrl) {
        this.logger.error('❌ DataIntegrityProof missing verificationMethod');
        return false;
      }

      const publicKeyData = await this.publicKeyService.getPublicKey(verificationMethodUrl);
      if (!publicKeyData) {
        this.logger.error(`❌ Could not resolve public key for DataIntegrityProof: ${verificationMethodUrl}`);
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          throw new Error(CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING);
        }
        return false;
      }

      const ecDocs = buildEcVerificationDocuments(publicKeyData, verificationMethodUrl, this.logger);
      if (!ecDocs) {
        return false;
      }

  const { verificationMethodDoc, controllerDoc } = ecDocs;
  const controllerId = controllerDoc.id || verificationMethodUrl.split('#')[0] || '';

      const baseLoader = OfflineDocumentLoader.getDocumentLoader();
      const documentLoader = async (url: string) => {
        if (url === verificationMethodUrl) {
          return {
            contextUrl: null,
            documentUrl: url,
            document: verificationMethodDoc
          };
        }
        if (url === controllerId) {
          return {
            contextUrl: null,
            documentUrl: url,
            document: controllerDoc
          };
        }
        return baseLoader(url);
      };

      const suite = new DataIntegrityProof({ cryptosuite: ecdsaRdfc2019Cryptosuite });
      const credentialForVerification = {
        ...vcObject,
        proof: { ...proof }
      };

      const vcLib = vc as any;
      const verification = await vcLib.verifyCredential({
        credential: credentialForVerification,
        suite,
        documentLoader,
        checkStatus: async () => ({ verified: true })
      });

      if (verification.verified) {
        this.logger.info('✅ DataIntegrityProof (ecdsa-rdfc-2019) verification successful');
        return true;
      }

      const err = verification.error as any;
      const collectMessages = (e: any): string[] => {
        if (!e) return [];
        const out: string[] = [];
        if (typeof e.message === 'string') out.push(e.message);
        if (Array.isArray(e.errors)) {
          for (const sub of e.errors) {
            out.push(...collectMessages(sub));
          }
        }
        if (Array.isArray(e.details)) {
          for (const sub of e.details) {
            out.push(...collectMessages(sub));
          }
        }
        return out;
      };
      const messages = collectMessages(err);
      if (messages.some((m) => m.includes(CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING))) {
        throw new Error(CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING);
      }

      this.logger.error('❌ DataIntegrityProof verification failed:', verification);
      return false;
    } catch (error: any) {
      this.logger.error('💥 A critical error occurred during DataIntegrityProof verification:', error?.message ?? error);
      if (error?.message === CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING) {
        throw error;
      }
      return false;
    }
  }

  private async verifyEcdsaWithNoble(vcObject: any, proof: any): Promise<boolean> {
    try {
      const doc = { ...vcObject };
      delete doc.proof;

      const { payloadBytes } = await computeLinkedDataVerifyArtifacts(
        doc,
        proof,
        OfflineDocumentLoader.getDocumentLoader(),
      );

      const jws: string = proof.jws;
      if (!jws || typeof jws !== 'string') throw new Error('Invalid JWS in proof');
      const parts = jws.split('.');
      if (parts.length !== 3) throw new Error('Invalid JWS format; expected three parts');
      const protectedB64 = parts[0];

      const enc = new TextEncoder();
      const signingInput = concatBytes(enc.encode(protectedB64), enc.encode('.'), payloadBytes);
  // Use the named import 'sha256' directly (previous code referenced 'sha2.sha256' but no namespace import existed)
  const signingInputHash = sha256(signingInput);

      const signaturePart = parts[2];
      const signatureBytes = signaturePart.startsWith('u')
        ? base64url.decode(signaturePart)
        : base64url.decode(`u${signaturePart}`);
      const signatureObj = secp256k1.Signature.fromCompact(signatureBytes);
      const normalizedSignature = signatureObj.hasHighS() ? signatureObj.normalizeS() : signatureObj;
      const normalizedSignatureBytes = normalizedSignature.toCompactRawBytes();

      const vm = await this.publicKeyService.getPublicKey(proof.verificationMethod);
      const publicKeyBytes = resolveSecp256k1PublicKeyBytes(vm);
      if (!publicKeyBytes) {
        throw new Error('Could not resolve a valid secp256k1 public key');
      }

      const verified = secp256k1.verify(normalizedSignatureBytes, signingInputHash, publicKeyBytes);
      if (!verified) {
        this.logger.error('❌ ES256K signature verification failed (noble.verify returned false)');
        this.logger.error('   Possible causes: invalid signature, public key, signing input, or hash algorithm.');
      }
      return verified;
    } catch (error: any) {
      this.logger.error('💥 A critical error occurred during EcdsaSecp256k1Signature2019 verification:', error?.message ?? error);
      return false;
    }
  }

  /**
   * THE CORE VERIFICATION ENGINE
   *
   * This generic method uses the `jsonld-signatures` library to verify a proof
   * using a provided signature suite and key type.
   *
   * @param vcObject The full credential object.
   * @param proof The proof to verify.
   * @param Suite The signature suite class (e.g., Ed25519Signature2020).
   * @param VerificationKey The key class for the suite (e.g., Ed25519VerificationKey2020).
   * @returns A promise resolving to `true` if the signature is valid.
   */
  private async verifyWithSuite(vcObject: any, proof: any, Suite: any, VerificationKey: any): Promise<boolean> {
    try {
      // STEP A: Resolve the public key using our SDK's internal service.
      // This will use the OfflineDocumentLoader's logic (cache-first).
      const verificationMethodUrl = proof.verificationMethod;
      const publicKeyData = await this.publicKeyService.getPublicKey(verificationMethodUrl);
      if (!publicKeyData) {
        this.logger.error(`❌ Could not resolve public key for: ${verificationMethodUrl}`);
        // If we're offline, surface a specific error so the caller can show a better message
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          throw new Error(CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING);
        }
        return false;
      }

      // STEP A.1: Normalize the verification method doc for the expected suite
      const normalizedVm = normalizeVerificationMethodForProof(publicKeyData, proof.type, verificationMethodUrl);

      // STEP B: Construct the KeyPair object that the 'jsigs' library understands.
      const keyPair = await VerificationKey.from(normalizedVm);

      // STEP C: Create an instance of the signature suite (e.g., Ed25519Signature2020).
      const suite = new Suite({ key: keyPair, verificationMethod: normalizedVm.id });

      // STEP D: Construct a minimal DID Document for offline "purpose" checking.
      // This tells the library that this key is authorized for its stated purpose (e.g., "assertionMethod").
      const controllerDoc = {
        '@context': 'https://w3id.org/security/v2',
        id: normalizedVm.controller || publicKeyData.controller || (verificationMethodUrl?.split('#')[0] || ''),
        [proof.proofPurpose || 'assertionMethod']: [normalizedVm.id] // Use normalized VM id and dynamic purpose
      };

      // STEP E: Call the `jsigs.verify()` engine. This is where all the magic happens.
      // The library will internally handle canonicalization and call our Document Loader as needed.
      const verificationResult = await jsigs.verify(
        vcObject, // The full VC object (the library will handle removing the proof)
        {
          suite: suite,
          purpose: new jsigs.purposes.AssertionProofPurpose({ controller: controllerDoc }),
          // We provide our smart, offline-first loader to the engine.
          documentLoader: OfflineDocumentLoader.getDocumentLoader()
        }
      );

      // STEP F: Return the result.
      if (verificationResult.verified) {
        this.logger.info(`✅ Signature verification successful for proof type ${proof.type}!`);
        return true;
      } else {
        const err = verificationResult.error as any;
        const collectMessages = (e: any): string[] => {
          if (!e) return [];
          const out: string[] = [];
          if (typeof e.message === 'string') out.push(e.message);
          if (Array.isArray(e.errors)) {
            for (const sub of e.errors) {
              out.push(...collectMessages(sub));
            }
          }
          if (Array.isArray(e.details)) {
            for (const sub of e.details) {
              out.push(...collectMessages(sub));
            }
          }
          return out;
        };
        const messages = collectMessages(err);
        const errMsg = messages.join(' | ');
        // If the failure is due to offline-missing dependencies surfaced by the document loader,
        // propagate a specific error so the higher layer can map it to a friendly message.
        if (errMsg.includes(CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING)) {
          throw new Error(CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING);
        }
        this.logger.error(`❌ Signature verification failed for ${proof.type}:`, verificationResult.error);
        return false;
      }

    } catch (error: any) {
      this.logger.error(`💥 A critical error occurred during ${proof.type} verification:`, error.message);
      // Bubble up offline missing dependencies for higher-level handling
      if (error?.message === CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING) {
        throw error;
      }
      return false;
    }
  }

}

