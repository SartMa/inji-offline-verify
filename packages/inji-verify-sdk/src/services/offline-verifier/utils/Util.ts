import { CredentialValidatorConstants } from '../constants/CredentialValidatorConstants.js';

/**
 * Data model versions enum
 */
export const DATA_MODEL = {
  DATA_MODEL_1_1: 'V1_1',
  DATA_MODEL_2_0: 'V2_0',
  UNSUPPORTED: 'UNSUPPORTED'
} as const;
export type DATA_MODEL = typeof DATA_MODEL[keyof typeof DATA_MODEL];

/**
 * Verification Status enum
 */
export const VerificationStatus = {
  SUCCESS: 'SUCCESS',
  EXPIRED: 'EXPIRED',
  INVALID: 'INVALID'
} as const;
export type VerificationStatus = typeof VerificationStatus[keyof typeof VerificationStatus];

/**
 * Verification Result interface
 */
export interface VerificationResult {
  verificationStatus: boolean;
  verificationErrorCode?: string;
}

/**
 * Utility class - matches Kotlin Util functionality
 */
export class Util {
  
  /**
   * Check if running in Android environment
   * @returns true if Android (always false in browser)
   */
  static isAndroid(): boolean {
    // In browser environment, this will always be false
    // You could check user agent if needed
    return false;
  }

  /**
   * Get verification status based on verification result
   * @param verificationResult - Result of verification
   * @returns VerificationStatus enum value
   */
  static getVerificationStatus(verificationResult: VerificationResult): VerificationStatus {
    if (verificationResult.verificationStatus) {
      if (verificationResult.verificationErrorCode === CredentialValidatorConstants.ERROR_CODE_VC_EXPIRED) {
        return VerificationStatus.EXPIRED;
      }
      return VerificationStatus.SUCCESS;
    }
    return VerificationStatus.INVALID;
  }

  /**
   * Extract ID from object (string or object with id property)
   * @param obj - Object to extract ID from
   * @returns ID string or null
   */
  getId(obj: any): string | null {
    if (typeof obj === 'string') {
      return obj;
    }
    if (typeof obj === 'object' && obj !== null && obj.hasOwnProperty('id')) {
      return obj.id;
    }
    return null;
  }

  /**
   * Validate if string is a valid URI
   * @param value - String to validate
   * @returns true if valid URI
   */
  isValidUri(value: string): boolean {
    try {
      // Handle DID URIs
      if (value.startsWith('did:')) {
        return true;
      }

      // Handle HTTP/HTTPS URIs
      const url = new URL(value);
      return url.protocol !== null && url.hostname !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Convert JSON array to JavaScript array
   * @param jsonArray - Array to convert
   * @returns JavaScript array
   */
  jsonArrayToList(jsonArray: any[]): any[] {
    return Array.from(jsonArray);
  }

  /**
   * Get context version from credential object
   * @param vcJsonObject - Credential object
   * @returns DATA_MODEL enum value or null
   */
  static getContextVersion(vcJsonObject: any): DATA_MODEL | null {
    if (vcJsonObject.hasOwnProperty(CredentialValidatorConstants.CONTEXT)) {
      const context = vcJsonObject[CredentialValidatorConstants.CONTEXT];
      const contexts = Array.isArray(context) ? context : [context];
      
      const firstContext = contexts[0];
      
      switch (firstContext) {
        case CredentialValidatorConstants.CREDENTIALS_CONTEXT_V1_URL:
          return DATA_MODEL.DATA_MODEL_1_1;
        case CredentialValidatorConstants.CREDENTIALS_CONTEXT_V2_URL:
          return DATA_MODEL.DATA_MODEL_2_0;
        default:
          return DATA_MODEL.UNSUPPORTED;
      }
    }
    return null;
  }

  /**
   * Calculate digest using Web Crypto API
   * @param algorithm - Hash algorithm (e.g., 'SHA-256')
   * @param data - Data to hash (ArrayBuffer or ArrayBufferView)
   * @returns Promise with hash bytes
   */
  async calculateDigest(algorithm: string, data: BufferSource): Promise<Uint8Array> {
    try {
      const hashBuffer = await crypto.subtle.digest(algorithm, data);
      return new Uint8Array(hashBuffer);
    } catch (error) {
      throw new Error(`Failed to calculate digest: ${error}`);
    }
  }

  /**
   * Convert JSON string to Map/Object
   * @param jsonString - JSON string to parse
   * @returns Parsed object
   */
  convertJsonToMap(jsonString: string): Record<string, any> {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error(`Failed to parse JSON: ${error}`);
    }
  }

  /**
   * Get configurable document loader (browser equivalent)
   * For offline verification, this would return cached documents
   * @returns Document loader function
   */
  getConfigurableDocumentLoader(): (url: string) => Promise<{ document: any; documentUrl: string }> {
    return async (url: string) => {
      // In offline mode, return cached contexts
      const cachedContexts: Record<string, any> = {
        [CredentialValidatorConstants.CREDENTIALS_CONTEXT_V1_URL]: {
          '@context': {
            '@version': 1.1,
            '@protected': true,
            'VerifiableCredential': 'https://www.w3.org/2018/credentials#VerifiableCredential',
            'credentialSubject': 'https://www.w3.org/2018/credentials#credentialSubject',
            'issuer': 'https://www.w3.org/2018/credentials#issuer',
            'issuanceDate': 'https://www.w3.org/2018/credentials#issuanceDate',
            'expirationDate': 'https://www.w3.org/2018/credentials#expirationDate',
            'proof': 'https://w3id.org/security#proof'
          }
        },
        [CredentialValidatorConstants.CREDENTIALS_CONTEXT_V2_URL]: {
          '@context': {
            '@version': 1.1,
            '@protected': true,
            'VerifiableCredential': 'https://www.w3.org/ns/credentials#VerifiableCredential',
            'credentialSubject': 'https://www.w3.org/ns/credentials#credentialSubject',
            'issuer': 'https://www.w3.org/ns/credentials#issuer',
            'validUntil': 'https://www.w3.org/ns/credentials#validUntil',
            'proof': 'https://w3id.org/security#proof'
          }
        }
      };

      const document = cachedContexts[url];
      if (document) {
        return { document, documentUrl: url };
      }

      throw new Error(`Document not found in cache for offline operation: ${url}`);
    };
  }
}