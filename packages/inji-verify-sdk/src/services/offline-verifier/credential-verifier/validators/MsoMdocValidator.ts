import { decode } from 'cbor-x';
import { CredentialValidatorConstants } from '../../constants/CredentialValidatorConstants.js';
import { ValidationException, UnknownException } from '../../exception/index.js';
import { DateUtils } from '../../utils/DateUtils.js';
import { createSdkLogger } from '../../../../utils/logger.js';

/**
 * MSO mDoc Validator - EXACT equivalent of Kotlin implementation
 * This matches the Kotlin logic exactly, line by line
 */
export class MsoMdocValidator {
  private readonly logger = createSdkLogger('MsoMdocValidator');

  /**
   * Validate MSO mDoc credential - matches Kotlin signature exactly
   * @param credential - JSON string of the credential
   * @returns boolean indicating if validation passed
   */
  validate(credential: string): boolean {
    try {
      // Parse the credential using MsoMdocVerifiableCredential equivalent
      const parsedCredential = this.parseCredential(credential);
      const issuerSigned = parsedCredential.issuerSigned;

      /**
       * a) The elements in the 'ValidityInfo' structure are verified against the current time stamp
       * (Exact Kotlin comment)
       */
      const mso = this.extractMso(issuerSigned.issuerAuth);
      const validityInfo = mso['validityInfo'];
      
      if (!validityInfo) {
        this.logger.debug?.("validityInfo is not available in the credential's MSO");
        throw new ValidationException(
          CredentialValidatorConstants.ERROR_MESSAGE_INVALID_DATE_MSO,
          CredentialValidatorConstants.ERROR_CODE_INVALID_DATE_MSO
        );
      }

      const validFrom = validityInfo['validFrom'];
      const validUntil = validityInfo['validUntil'];

      if (!validUntil || !validFrom) {
        this.logger.debug?.("validUntil / validFrom is not available in the credential's MSO");
        throw new ValidationException(
          CredentialValidatorConstants.ERROR_MESSAGE_INVALID_DATE_MSO,
          CredentialValidatorConstants.ERROR_CODE_INVALID_DATE_MSO
        );
      }

      // Convert to string (equivalent to Kotlin's toString())
      const validFromStr = validFrom.toString();
      const validUntilStr = validUntil.toString();

      const isValidFromIsFutureDate = DateUtils.isFutureDateWithTolerance(validFromStr);
      const isValidUntilIsPastDate = !DateUtils.isFutureDateWithTolerance(validUntilStr);
      
      const validFromDate = DateUtils.parseDate(validFromStr);
      const validUntilDate = DateUtils.parseDate(validUntilStr);
      
      if (!validFromDate || !validUntilDate) {
        return false;
      }

      // Equivalent to Kotlin's parseDate(validUntil.toString())?.after(parseDate(validFrom.toString()) ?: return false) ?: false
      const isValidUntilGreaterThanValidFrom = validUntilDate.getTime() > validFromDate.getTime();

      if (isValidFromIsFutureDate) {
        this.logger.debug?.("Error while doing validity verification - invalid validFrom in the MSO of the credential");
        throw new ValidationException(
          CredentialValidatorConstants.ERROR_MESSAGE_INVALID_VALID_FROM_MSO,
          CredentialValidatorConstants.ERROR_CODE_INVALID_VALID_FROM_MSO
        );
      }

      if (isValidUntilIsPastDate) {
        this.logger.debug?.("Error while doing validity verification - invalid validUntil in the MSO of the credential");
        throw new ValidationException(
          CredentialValidatorConstants.ERROR_MESSAGE_INVALID_VALID_UNTIL_MSO,
          CredentialValidatorConstants.ERROR_CODE_INVALID_VALID_UNTIL_MSO
        );
      }

      if (!isValidUntilGreaterThanValidFrom) {
        this.logger.debug?.("Error while doing validity verification - invalid validFrom / validUntil in the MSO of the credential");
        throw new ValidationException(
          CredentialValidatorConstants.ERROR_MESSAGE_INVALID_DATE_MSO,
          CredentialValidatorConstants.ERROR_CODE_INVALID_DATE_MSO
        );
      }

      return true;

    } catch (exception: any) {
      // Exact Kotlin exception handling logic
      if (exception instanceof ValidationException) {
        throw exception;
      }
      throw new UnknownException(`Error while doing validation of credential - ${exception.message}`);
    }
  }

  /**
   * Parse credential string to extract issuerSigned structure
   * Equivalent to MsoMdocVerifiableCredential().parse(credential)
   */
  private parseCredential(credential: string): { deviceSigned?: any; issuerSigned: { issuerAuth: Uint8Array } } {
    try {
      let credentialData: any;
      
      if (credential.startsWith('{')) {
        // JSON format
        credentialData = JSON.parse(credential);
      } else {
        // Assume base64 encoded CBOR
        const binaryData = this.base64ToUint8Array(credential);
        credentialData = decode(binaryData);
      }

      // Extract the structure based on your credential format
      if (credentialData.documents && Array.isArray(credentialData.documents)) {
        // Standard mDoc format - return first document
        return {
          issuerSigned: credentialData.documents[0].issuerSigned
        };
      } else if (credentialData.issuerSigned) {
        // Direct format
        return credentialData;
      } else {
        throw new Error('Invalid credential format');
      }

    } catch (error: any) {
      throw new UnknownException(`Failed to parse credential: ${error.message}`);
    }
  }

  /**
   * Extract MSO from issuerAuth
   * Equivalent to issuerAuth.extractMso()
   */
  private extractMso(issuerAuth: Uint8Array): Record<string, any> {
    try {
      // issuerAuth is a COSE structure
      const coseStructure = decode(issuerAuth);
      
      if (!Array.isArray(coseStructure) || coseStructure.length < 3) {
        throw new Error('Invalid COSE structure');
      }

      // COSE structure: [protected headers, unprotected headers, payload, signature]
      // MSO is in the payload (index 2)
      const msoPayload = coseStructure[2];
      
      if (!(msoPayload instanceof Uint8Array)) {
        throw new Error('Invalid MSO payload format');
      }

      // Decode the MSO from the payload
      const mso = decode(msoPayload);
      
      return mso;

    } catch (error: any) {
      throw new UnknownException(`Failed to extract MSO: ${error.message}`);
    }
  }

  /**
   * Convert base64 string to Uint8Array
   */
  private base64ToUint8Array(base64: string): Uint8Array {
    // Remove any whitespace and decode
    const cleanBase64 = base64.replace(/\s/g, '');
    const binaryString = atob(cleanBase64);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    return bytes;
  }
}

/**
 * CBOR Map access helper - equivalent to Kotlin's operator fun DataItem.get(name: String)
 * This replicates the Kotlin extension function behavior
 */
export function getCborMapValue(cborMap: Record<string, any>, name: string): any {
  return cborMap[name] || null;
}

/**
 * Type guard to check if object is a CBOR Map equivalent
 */
export function isCborMap(obj: any): obj is Record<string, any> {
  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
}