import { Base64Utils } from './Base64Utils.js';

/**
 * JSON Web Signature (JWS) utilities
 */
export class JWSUtils {
  /**
   * Parse JWS string into components
   * @param jws - JWS string in format "header.payload.signature"
   * @returns parsed JWS components
   */
  static parseJWS(jws: string): { header: any; payload: string; signature: Uint8Array; signingInput: string } {
    const parts = jws.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWS format: must have 3 parts separated by dots');
    }

    const [headerPart, payloadPart, signaturePart] = parts;

    // Decode header
    const headerJson = Base64Utils.base64UrlDecode(headerPart);
    const header = JSON.parse(headerJson);

    // Create signing input (header.payload)
    const signingInput = `${headerPart}.${payloadPart}`;

    // Decode signature
    const signature = Base64Utils.base64UrlDecodeToBytes(signaturePart);

    return {
      header,
      payload: payloadPart,
      signature,
      signingInput
    };
  }

  /**
   * Create JWS signing input from header and payload
   * @param header - JWS header object
   * @param payload - payload bytes
   * @returns signing input bytes
   */
  static createSigningInput(header: any, payload: Uint8Array): Uint8Array {
    const headerJson = JSON.stringify(header);
    const headerB64 = Base64Utils.stringToBase64Url(headerJson);
    const payloadB64 = Base64Utils.base64UrlEncode(payload);
    const signingInput = `${headerB64}.${payloadB64}`;
    
    return new TextEncoder().encode(signingInput);
  }

  /**
   * Verify JWS signature algorithm is supported
   * @param algorithm - JWS algorithm from header
   * @returns true if supported
   */
  static isSupportedAlgorithm(algorithm: string): boolean {
    const supportedAlgorithms = ['PS256', 'RS256', 'EdDSA', 'ES256K'];
    return supportedAlgorithms.includes(algorithm);
  }
}