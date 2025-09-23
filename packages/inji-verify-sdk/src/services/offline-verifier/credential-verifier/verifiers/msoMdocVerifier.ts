import { Decoder, Encoder } from 'cbor-x';
import { pki as forgePki, asn1 } from 'node-forge';
import { verify } from 'cose-js';


// Import our MSO mDoc types
import { MsoMdocVerifiableCredential } from '../types/msomdoc/MsoMdocVerifiableCredential.js';
import { extractFieldValue, extractMso } from '../types/msomdoc/MsoMdocCredentialData.js';

// Import exceptions
import { UnknownException } from '../../exception/index.js';


// Import utils
import { Util } from '../../utils/Util.js';

const cborDecoder = new Decoder();
const cborEncoder = new Encoder();

const ISSUING_COUNTRY = "issuing_country";

export class MsoMdocVerifier {
  private readonly logger = console;
  private util = new Util();

  /**
   * Main verify method - matches Kotlin exactly
   */
  async verify(base64EncodedMdoc: string):Promise<boolean>{
    try {
      this.logger.info("🔍 [MsoMdocVerifier] Received Credentials Verification - Start");

      // Parse credential (equivalent to MsoMdocVerifiableCredential().parse())
      const { docType, issuerSigned } = new MsoMdocVerifiableCredential().parse(base64EncodedMdoc);

      // Extract MSO (equivalent to issuerSigned.issuerAuth.extractMso())
      const mobileSecurityObject = extractMso(issuerSigned.issuerAuth);

      // Perform all verifications (same order as Kotlin)
      const certificateChainValid = this.verifyCertificateChain(issuerSigned.issuerAuth);
      const countryNameValid = this.verifyCountryName(issuerSigned.issuerAuth, issuerSigned.namespaces);
      const coseSignatureValid = this.verificationOfCoseSignature(issuerSigned.issuerAuth);
      const valueDigestsValid = await this.verifyValueDigests(issuerSigned.namespaces, mobileSecurityObject);
      const docTypeValid = this.verifyDocType(mobileSecurityObject, docType);

      const result = certificateChainValid && countryNameValid && coseSignatureValid && valueDigestsValid && docTypeValid;
      
      this.logger.info(`✅ [MsoMdocVerifier] Verification result: ${result}`);
      return result;

    } catch (exception: any) {
      this.logger.error(`💥 [MsoMdocVerifier] Verification error:`, exception.message);
      
      // Match Kotlin exception handling
      if (exception.name === 'SignatureVerificationException' ||
          exception.name === 'LikelyTamperedException' ||
          exception.name === 'InvalidPropertyException') {
        throw exception;
      }
      throw new UnknownException(`Error while doing verification of credential - ${exception.message}`);
    }
  }

  /**
   * Certificate chain verification - matches Kotlin (TODO implementation)
   */
  private verifyCertificateChain(issuerAuth: any): boolean {
    // TODO: Validate the certificate chain by getting the trusted root IACA certificate of the Issuing Authority
    return true;
  }

  /**
   * Country name verification - matches Kotlin exactly
   */
  private verifyCountryName(issuerAuth: any, issuerSignedNamespaces: any): boolean {
    try {
      const issuerCertificate = this.extractCertificate(issuerAuth);
      if (!issuerCertificate) {
        throw new Error("certificate chain is empty");
      }

      // Extract country from certificate subject DN (equivalent to Kotlin's regex)
      const subjectDN = issuerCertificate.subject.attributes
        .map(attr => `${attr.shortName}=${attr.value}`)
        .join(',');
      
      const countryNamePattern = /C=([^,]+)/;
      const match = subjectDN.match(countryNamePattern);
      
      if (!match) {
        throw new Error("CN not found in Subject DN of DS certificate");
      }
      
      const countryName = match[1];

      // Extract issuing country from namespaces (equivalent to Kotlin's extractFieldValue)
      const issuingCountry = extractFieldValue(issuerSignedNamespaces, ISSUING_COUNTRY);
      
      if (!countryName || issuingCountry !== countryName) {
        throw new Error("Issuing country is not valid in the credential - Mismatch in credential data and DS certificate country name found");
      }

      return true;

    } catch (error: any) {
      this.logger.error(`❌ [MsoMdocVerifier] Country name verification failed:`, error.message);
      throw error;
    }
  }

  /**
   * DocType verification - matches Kotlin exactly
   */
  private verifyDocType(mso: any, docTypeInDocuments: any): boolean {
    try {
      const docTypeInMso = mso.docType;
      
      if (docTypeInDocuments === null || docTypeInDocuments === undefined) {
        this.logger.error("Error while doing docType property verification - docType property not found in the credential");
        throw new Error("Property docType not found in the credential");
      }

      if (docTypeInMso !== docTypeInDocuments) {
        this.logger.error("Error while doing docType property verification - Property mismatch with docType in the credential");
        throw new Error("Property mismatch with docType in the credential");
      }

      return true;

    } catch (error: any) {
      this.logger.error(`❌ [MsoMdocVerifier] DocType verification failed:`, error.message);
      throw error;
    }
  }

  /**
   * COSE signature verification - matches Kotlin
   */
  private verificationOfCoseSignature(issuerAuth: any): boolean {
    try {
      const issuerCertificate = this.extractCertificate(issuerAuth);
      if (!issuerCertificate) {
        throw new Error("Error while doing COSE signature verification - certificate chain is empty");
      }

      // Convert to byte array and verify (equivalent to CborDataItemUtils.toByteArray)
      const issuerAuthBytes = this.toByteArray(issuerAuth);
      return this.verifyCoseSignature(issuerAuthBytes, issuerCertificate.publicKey);

    } catch (error: any) {
      this.logger.error(`❌ [MsoMdocVerifier] COSE signature verification failed:`, error.message);
      throw error;
    }
  }

// Update the verifyValueDigests method in your msoMdocVerifier.ts:

/**
 * Value digests verification - matches Kotlin exactly
 */
private async verifyValueDigests(issuerSignedNamespaces: any, mso: any): Promise<boolean> {
  try {
    // Iterate through namespaces (equivalent to Kotlin's forEach)
    for (const namespace of Object.keys(issuerSignedNamespaces)) {
      const namespaceData = issuerSignedNamespaces[namespace];
      const calculatedDigests = new Map<number, Uint8Array>();
      const actualDigests = new Map<number, Uint8Array>();

      // Calculate digests for each item (equivalent to Kotlin's logic)
      for (const issuerSignedItem of namespaceData) {
        try {
          // Encode item (equivalent to CborEncoder.encode())
          const encodedData = cborEncoder.encode(issuerSignedItem);
          
          // FIX: Explicitly convert Buffer to Uint8Array to satisfy BufferSource type
          const dataToDigest = new Uint8Array(encodedData);
          
          // Calculate digest (equivalent to util.calculateDigest())
          const digestAlgorithm = mso.digestAlgorithm.toString();
          const digest = await this.util.calculateDigest(digestAlgorithm, dataToDigest);
          
          // Decode item to get digestID (equivalent to CborDecoder)
          const decodedIssuerSignedItem = cborDecoder.decode(issuerSignedItem.bytes);
          const digestId = decodedIssuerSignedItem.digestID;

          calculatedDigests.set(digestId, digest);
        } catch (error) {
          this.logger.warn(`Failed to process item in namespace ${namespace}:`, error);
        }
      }

      // Get actual digests from MSO (equivalent to Kotlin's valueDigests logic)
      let valueDigests;
      if (mso.valueDigests.nameSpaces) {
        valueDigests = mso.valueDigests.nameSpaces[namespace];
      } else {
        valueDigests = mso.valueDigests[namespace];
      }

      // Extract actual digests
      for (const digestIdStr of Object.keys(valueDigests)) {
        const digestId = parseInt(digestIdStr);
        const digest = valueDigests[digestIdStr];
        // Ensure digest is Uint8Array
        const digestBytes = digest instanceof Uint8Array ? digest : new Uint8Array(digest);
        actualDigests.set(digestId, digestBytes);
      }

      // Compare digests (equivalent to Kotlin's contentEquals)
      for (const [actualDigestId, actualDigest] of Array.from(actualDigests.entries())) {
        const calculatedDigest = calculatedDigests.get(actualDigestId);
        if (!calculatedDigest || !this.arraysEqual(actualDigest, calculatedDigest)) {
          this.logger.error("Error while doing valueDigests verification - mismatch in digests found");
          throw new Error(`valueDigests verification failed - mismatch in digests with ${actualDigestId}`);
        }
      }
    }

    return true;

  } catch (error: any) {
    this.logger.error(`❌ [MsoMdocVerifier] Value digests verification failed:`, error.message);
    throw error;
  }
}

  /**
   * UTILITY METHODS - Equivalent to Kotlin helper methods
   */

  private extractCertificate(coseSignature: any): forgePki.Certificate | null {
    try {
      // Equivalent to Kotlin's certificate extraction logic
      const certificateChain = this.getCertificateChain(coseSignature);
      
      if (!certificateChain || certificateChain.length === 0) {
        return null;
      }

      let issuerCertificateBytes;
      if (certificateChain.length > 1) {
        issuerCertificateBytes = certificateChain[0][1];
      } else if (certificateChain.length === 1) {
        if (Array.isArray(certificateChain[0])) {
          issuerCertificateBytes = certificateChain[0][1];
        } else {
          issuerCertificateBytes = certificateChain[0];
        }
      } else {
        return null;
      }

      return this.toX509Certificate(issuerCertificateBytes);

    } catch (error) {
      this.logger.error('Failed to extract certificate:', error);
      return null;
    }
  }

  private getCertificateChain(coseSignature: any): any[] | null {
    try {
      // Extract certificate chain from COSE structure
      const header = coseSignature[1];
      return header ? Object.values(header) : null;
    } catch (error) {
      return null;
    }
  }

  private toX509Certificate(certificateBytes: any): forgePki.Certificate {
    try {
      // Convert to X509 certificate (equivalent to Kotlin's CertificateFactory)
      const bytes = certificateBytes instanceof Uint8Array ? certificateBytes : new Uint8Array(certificateBytes);
      const certDer = Buffer.from(bytes).toString('binary');
      return forgePki.certificateFromAsn1(asn1.fromDer(certDer));
    } catch (error) {
      throw new Error(`Failed to parse X509 certificate: ${error}`);
    }
  }

  // Update the toByteArray method in your msoMdocVerifier.ts:

  private toByteArray(dataItem: any): Uint8Array {
    try {
      // Equivalent to Kotlin's CborDataItemUtils.toByteArray()
      const encoded = cborEncoder.encode(dataItem);
      
      // Convert Buffer to Uint8Array if necessary
      return new Uint8Array(encoded);
    } catch (error) {
      throw new Error(`Failed to convert CBOR item to bytes: ${error}`);
    }
  }

  private verifyCoseSignature(coseAuth: Uint8Array, publicKey: forgePki.PublicKey): boolean {
    try {
      // COSE signature verification (equivalent to CoseSignatureVerifierImpl)
      if (!('n' in publicKey && 'e' in publicKey)) {
        this.logger.error('Invalid RSA public key');
        return false;
      }

      const rsaPublicKey = publicKey as forgePki.rsa.PublicKey;
      const modulus = Buffer.from(rsaPublicKey.n.toByteArray()).toString('base64url');
      const exponent = Buffer.from(rsaPublicKey.e.toByteArray()).toString('base64url');

      const verifier = {
        key: {
          kty: 'RSA',
          n: modulus,
          e: exponent,
        },
      };

      verify(coseAuth, verifier, undefined);
      return true;

    } catch (error) {
      this.logger.error('COSE signature verification failed:', error);
      return false;
    }
  }

  private arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
    // Equivalent to Kotlin's ByteArray.contentEquals()
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
}