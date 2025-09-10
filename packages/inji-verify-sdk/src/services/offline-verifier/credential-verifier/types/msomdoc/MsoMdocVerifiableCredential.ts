import { Decoder } from 'cbor-x';
import { Base64Utils } from '../../../utils/Base64Utils.js';
import { ValidationException } from '../../../exception/index.js';
import { CredentialValidatorConstants } from '../../../constants/CredentialValidatorConstants.js';
import type { MsoMdocCredentialData} from './MsoMdocCredentialData.js';
import { ValidationStatus } from '../../../data/data.js';
import { getProperty, getElement } from './MsoMdocCredentialData.js';
import { MsoMdocValidator } from '../../validators/MsoMdocValidator.js';
import { VerifiableCredential } from '../../verifiableCredential.js';

const cborDecoder = new Decoder();



export class MsoMdocVerifiableCredential extends VerifiableCredential {

  /**
   * Validate credential
   * Equivalent to Kotlin's validate() method
   */
    validate(credential: string): ValidationStatus {
        try {
        // Use the MsoMdocValidator to perform validation
        new MsoMdocValidator().validate(credential);
        // Return an instance of the ValidationStatus class
        return new ValidationStatus("", "");
        } catch (exception: any) {
        if (exception instanceof ValidationException) {
            // Return an instance of the ValidationStatus class
            return new ValidationStatus(
            exception.message,
            exception.errorCode || CredentialValidatorConstants.ERROR_CODE_GENERIC
            );
        } else {
            // Return an instance of the ValidationStatus class
            return new ValidationStatus(
            `${CredentialValidatorConstants.EXCEPTION_DURING_VALIDATION}${exception.message}`,
            CredentialValidatorConstants.ERROR_CODE_GENERIC
            );
        }
        }
    }
  /**
   * Verify credential
   * Equivalent to Kotlin's verify() method
   */
  async verify(credential: string): Promise<boolean> {
    // Import will be handled at runtime to avoid circular dependency
    const { MsoMdocVerifier } = require('../../verifiers/msoMdocVerifier.js');
    // Await the result from the async MsoMdocVerifier.verify() method
    return await new MsoMdocVerifier().verify(credential);
  }

  /**
   * Parse credential from base64 string
   * Equivalent to Kotlin's parse() method
   */
  parse(credential: string): MsoMdocCredentialData {
    // STEP 1: Base64 decode (equivalent to Kotlin's Base64Decoder.decodeFromBase64UrlFormatEncoded)
    let decodedData: Uint8Array;
    try {
      decodedData = Base64Utils.base64UrlDecodeToBytes(credential);
    } catch (exception: any) {
      console.error("Error occurred while base64Url decoding the credential: " + exception.message);
      throw new Error("Error on decoding base64Url encoded data: " + exception.message);
    }

    // STEP 2: CBOR decode (equivalent to Kotlin's CborDecoder)
    let cbors: any[];
    try {
      const decoded = cborDecoder.decode(decodedData);
      cbors = Array.isArray(decoded) ? decoded : [decoded];
    } catch (exception: any) {
      console.error("Error occurred while CBOR decoding the credential: " + exception.message);
      throw new Error("Error on decoding CBOR encoded data: " + exception.message);
    }

    // STEP 3: Extract structure (equivalent to Kotlin logic)
    let issuerSigned: any;
    let documents: any;
    let docType: any = null;

    const rootMap = cbors[0];
    
    // Check if has "documents" structure (equivalent to Kotlin's keys.toString().contains("documents"))
    if (this.containsKey(rootMap, "documents")) {
      documents = getElement(getProperty(rootMap, "documents"), 0);
      issuerSigned = getProperty(documents, "issuerSigned");
    } else {
      documents = rootMap;
      issuerSigned = getProperty(documents, "issuerSigned");
    }

    // Extract issuerAuth and namespaces (equivalent to Kotlin's property access)
    const issuerAuth = getProperty(issuerSigned, "issuerAuth");
    const issuerSignedNamespaces = getProperty(issuerSigned, "nameSpaces");
    
    // Extract docType if present (equivalent to Kotlin's keys.toString().contains("docType"))
    if (this.containsKey(documents, "docType")) {
      docType = getProperty(documents, "docType");
    }

    return {
      docType,
      issuerSigned: {
        issuerAuth,
        namespaces: issuerSignedNamespaces
      }
    };
  }

  /**
   * Helper to check if object contains key (equivalent to Kotlin's contains check)
   */
  private containsKey(obj: any, key: string): boolean {
    return obj && typeof obj === 'object' && key in obj;
  }
}