// Import our custom validation logic and exceptions
import { CredentialValidatorConstants } from '../../constants/CredentialValidatorConstants.js';
import { ValidationException, UnknownException } from '../../exception/index.js';
import { LdpValidator } from '../validators/LdpValidator.js';
// Add this import after your existing imports
import { OfflineDocumentLoader } from '../../utils/OfflineDocumentLoader.js';
// External cryptographic libraries for digital signature verification
import * as jsigs from 'jsonld-signatures';              // Main library for JSON-LD signature verification
import { Ed25519Signature2020 } from '@digitalbazaar/ed25519-signature-2020';  // Ed25519 signature algorithm

import { Ed25519VerificationKey2020 } from '@digitalbazaar/ed25519-verification-key-2020';  // Ed25519 key handling
import { PublicKeyService } from '../../publicKey/PublicKeyService.js';
/**
 * LDP (Linked Data Proof) Verifier
 * 
 * PURPOSE: This class verifies the cryptographic signatures on Verifiable Credentials
 * that use Linked Data Proofs (LDP) format. Think of it like verifying a digital
 * signature on a document to ensure it hasn't been tampered with and was signed
 * by the claimed issuer.
 * 
 * WHAT IT DOES:
 * 1. Takes a Verifiable Credential (VC) as JSON string
 * 2. Validates the structure and format
 * 3. Extracts the cryptographic proof/signature
 * 4. Verifies the signature using the issuer's public key
 * 5. Returns true if valid, false if invalid
 * 
 * ANALOGY: Like checking if a signed contract is genuine by:
 * - Checking the document format is correct
 * - Finding the signature
 * - Using the signer's public key to verify the signature
 */
export class LdpVerifier {
  private readonly logger = console;                     // For debugging and error tracking
  private readonly validator: LdpValidator;              // Validates credential structure
  private readonly publicKeyService: PublicKeyService;

  // Maps signature algorithm names to their implementation classes
  // This tells us which cryptographic method to use for each signature type
  private readonly SIGNATURE_SUITES = new Map([
    ['Ed25519Signature2020', Ed25519Signature2020],     // Modern, secure signature algorithm
    ['Ed25519Signature2018', Ed25519Signature2020],     // Older version, backward compatibility
    // Future: Add RSA, ECDSA when packages are available
  ]);

  constructor() {
    this.validator = new LdpValidator();                 // Initialize structure validator
    this.publicKeyService = new PublicKeyService();
  }

  /**
   * MAIN VERIFICATION METHOD
   * 
   * This is the entry point that external code calls to verify a credential.
   * It orchestrates the entire verification process.
   * 
   * @param credential - The Verifiable Credential as a JSON string
   * @returns Promise<boolean> - true if signature is valid, false otherwise
   * 
   * PROCESS FLOW:
   * 1. Parse JSON credential
   * 2. Validate structure (required fields, format)
   * 3. Extract proof(s) from credential
   * 4. Verify each proof cryptographically
   * 5. Return result
   */
  async verify(credential: string): Promise<boolean> {
    try {
      this.logger.info("🔍 Starting credential verification process");

      // STEP 1: Parse the JSON credential string into an object
      // This converts the string into a JavaScript object we can work with
      const vcJsonLdObject = JSON.parse(credential);

      // STEP 2: Validate the credential structure using LdpValidator
      // This checks if all required fields are present and properly formatted
      // (like @context, type, issuer, credentialSubject, etc.)
      const validationResult = this.validator.validate(credential);
      
      // If structure validation failed (except for expiration), return false
      if (validationResult.validationMessage && 
          validationResult.validationErrorCode !== CredentialValidatorConstants.ERROR_CODE_VC_EXPIRED) {
        this.logger.error("❌ Credential structure validation failed:", validationResult.validationMessage);
        return false;
      }

      // STEP 3: Extract the cryptographic proof from the credential
      // The 'proof' field contains the digital signature and metadata needed for verification
      const ldProof = vcJsonLdObject.proof;
      if (!ldProof) {
        this.logger.error("❌ No cryptographic proof found in credential");
        return false;
      }

      // STEP 4: Handle multiple proofs (a credential can have multiple signatures)
      // Convert single proof to array for uniform processing
      const proofs = Array.isArray(ldProof) ? ldProof : [ldProof];
      
      // STEP 5: Verify each proof - ALL must be valid for credential to be valid
      for (const proof of proofs) {
        this.logger.info(`🔐 Verifying proof of type: ${proof.type}`);
        const isProofValid = await this.verifyProof(vcJsonLdObject, proof);
        if (!isProofValid) {
          this.logger.error(`❌ Proof verification failed for type: ${proof.type}`);
          return false;
        }
      }

      this.logger.info("✅ All proofs verified successfully - credential is valid!");
      return true;

    } catch (exception: any) {
      this.logger.error('💥 Unexpected error during verification:', exception.message);
      
      // Re-throw known exceptions, wrap unknown ones
      if (exception instanceof ValidationException) {
        throw exception;
      }
      throw new UnknownException("Error while doing verification of verifiable credential");
    }
  }

  /**
   * PROOF VERIFICATION ORCHESTRATOR
   * 
   * This method handles the verification of a single cryptographic proof.
   * Different signature types require different verification algorithms.
   * 
   * @param vcObject - The credential object (without proof for signature verification)
   * @param proof - The specific proof to verify
   * @returns Promise<boolean> - true if this specific proof is valid
   * 
   * WHAT HAPPENS HERE:
   * 1. Remove proof from credential (needed for signature verification)
   * 2. Determine which signature algorithm was used
   * 3. Call the appropriate verification method
   */
  private async verifyProof(vcObject: any, proof: any): Promise<boolean> {
    try {
      // Create a copy of the credential WITHOUT the proof
      // This is necessary because the signature was created over the credential
      // content WITHOUT the signature itself (obviously!)
      const vcCopy = { ...vcObject };
      delete vcCopy.proof;

      // Route to the appropriate verification method based on signature type
      // Each signature algorithm has different verification requirements
      if (proof.type === 'Ed25519Signature2020' || proof.type === 'Ed25519Signature2018') {
        return await this.verifyEd25519Proof(vcCopy, proof);
      } else if (proof.type === 'RsaSignature2018') {
        return await this.verifyRsaProof(vcCopy, proof);
      } else if (proof.type === 'EcdsaSecp256k1Signature2019') {
        return await this.verifyEcdsaProof(vcCopy, proof);
      } else {
        this.logger.error(`❌ Unsupported signature type: ${proof.type}`);
        return false;
      }

    } catch (error: any) {
      this.logger.error('💥 Error during proof verification:', error.message);
      return false;
    }
  }

  /**
   * ED25519 SIGNATURE VERIFICATION
   * 
   * Ed25519 is a modern, secure elliptic curve signature algorithm.
   * It's fast, secure, and produces small signatures.
   * 
   * @param vcObject - Credential content (without proof)
   * @param proof - Ed25519 proof object containing signature and metadata
   * @returns Promise<boolean> - true if Ed25519 signature is valid
   * 
   * VERIFICATION PROCESS:
   * 1. Get the public key from the verification method
   * 2. Create an Ed25519 key pair object
   * 3. Set up the signature suite
   * 4. Use jsonld-signatures to verify (handles canonicalization + crypto)
   */
  private async verifyEd25519Proof(vcObject: any, proof: any): Promise<boolean> {
    try {
      console.log('🔐 [Ed25519] Starting signature verification');
      console.log('📝 [Ed25519] Proof:', JSON.stringify(proof, null, 2));

      // 1) Resolve public key from local cache
      const publicKey = await this.getPublicKey(proof.verificationMethod);
      if (!publicKey) {
        this.logger.error(`❌ Could not resolve public key for: ${proof.verificationMethod}`);
        return false;
      }
      console.log('🔑 [Ed25519] Public key info:', JSON.stringify(publicKey, null, 2));

      // 2) Build minimal controller + VM docs for offline purpose authorization
      const controllerDid = publicKey.controller || proof.verificationMethod.split('#')[0];

      const verificationMethodDoc = {
        id: proof.verificationMethod,
        type: 'Ed25519VerificationKey2020',
        controller: controllerDid,
        publicKeyMultibase: publicKey.publicKeyMultibase
      };

      const controllerDoc = {
        '@context': [
          'https://www.w3.org/ns/did/v1',
          'https://w3id.org/security/suites/ed25519-2020/v1'
        ],
        id: controllerDid,
        verificationMethod: [verificationMethodDoc],
        assertionMethod: [verificationMethodDoc.id]
      };

      // 3) Create suite
      const keyPair = await Ed25519VerificationKey2020.from(verificationMethodDoc);
      const suite = new Ed25519Signature2020({
        key: keyPair,
        verificationMethod: verificationMethodDoc.id
      });

      console.log('🔒 [Ed25519] Starting jsigs.verify...');
      const verificationResult = await jsigs.verify(
        { ...vcObject, proof },
        {
          suite,
          // Supply controller so purpose check passes offline
          purpose: new jsigs.purposes.AssertionProofPurpose({ controller: controllerDoc }),
          documentLoader: this.getConfigurableDocumentLoader()
        }
      );

      console.log('✅ [Ed25519] Verification result:', verificationResult);
      console.log('✅ [Ed25519] Verification verified:', verificationResult.verified);

      if (verificationResult.verified) {
        this.logger.info("✅ Ed25519 signature verification successful!");
        return true;
      } else {
        const detail = verificationResult.error?.message || 'Unknown error';
        this.logger.error('❌ Ed25519 signature verification failed:', detail || verificationResult.error?.message || 'Unknown error');
        return false;
      }
    } catch (error: any) {
      this.logger.error('💥 Ed25519 verification error:', error.message);
      return false;
    }
  }

  /**
   * RSA SIGNATURE VERIFICATION (Placeholder)
   * 
   * RSA is an older but widely-used signature algorithm.
   * Currently not implemented due to missing packages.
   */
  private async verifyRsaProof(vcObject: any, proof: any): Promise<boolean> {
    this.logger.warn('⚠️ RSA signature verification not implemented - missing package');
    // TODO: Implement when @digitalbazaar/rsa-signature-2018 is available
    return false;
  }

  /**
   * ECDSA SIGNATURE VERIFICATION (Placeholder)
   * 
   * ECDSA with secp256k1 curve (same as Bitcoin) signature algorithm.
   * Currently not implemented due to missing packages.
   */
  private async verifyEcdsaProof(vcObject: any, proof: any): Promise<boolean> {
    this.logger.warn('⚠️ ECDSA secp256k1 signature verification not implemented - missing package');
    // TODO: Implement when @digitalbazaar/ecdsa-secp256k1-signature-2019 is available
    return false;
  }

  /**
   * PUBLIC KEY RESOLUTION
   * 
   * This is the CRITICAL method that needs proper implementation for production.
   * It takes a verification method ID and returns the corresponding public key.
   * 
   * @param verificationMethod - A URI that identifies a public key
   * @returns Promise<any> - Public key object or null if not found
   * 
   * CURRENT STATUS: Returns mock data for testing
   * PRODUCTION NEEDED: Implement actual key resolution logic
   * 
   * VERIFICATION METHOD EXAMPLES:
   * - "did:web:issuer.com#key-1"  -> Resolve via DID document
   * - "https://issuer.com/keys/1" -> HTTP GET request
   * - "did:key:z6Mk..."          -> Extract key from the DID itself
   */
  private async getPublicKey(verificationMethod: string): Promise<any> {
    this.logger.info(`🔑 Resolving public key from cache for: ${verificationMethod}`);
    return this.publicKeyService.getPublicKey(verificationMethod);
  }

  /**
   * DOCUMENT LOADER - JSON-LD CONTEXT RESOLUTION
   * 
   * PURPOSE: Resolves @context URLs in JSON-LD documents
   * 
   * WHAT IS @context?
   * JSON-LD uses @context to define what terms mean. For example:
   * "@context": "https://www.w3.org/2018/credentials/v1"
   * This URL contains definitions like: "issuer" means "https://www.w3.org/2018/credentials#issuer"
   * 
   * NETWORK CALLS: Yes, potentially makes HTTP requests to fetch context definitions
   * OPTIMIZATION: We cache common contexts locally to avoid network calls
   * 
   * @returns Function that resolves context URLs to their definitions
   */
/**
 * DOCUMENT LOADER - OFFLINE JSON-LD CONTEXT RESOLUTION
 * 
 * Uses OfflineDocumentLoader utility to resolve @context URLs from local cache.
 * No network calls are made during verification - everything is offline.
 */
  private getConfigurableDocumentLoader(): any {
    return OfflineDocumentLoader.getDocumentLoader();
  }
}