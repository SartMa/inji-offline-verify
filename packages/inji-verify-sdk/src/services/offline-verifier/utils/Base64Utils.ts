// Base64 encoding/decoding utilities for browser and Node.js compatibility
export class Base64Utils {
  /**
   * Decode base64url string to regular string
   * @param input - base64url encoded string
   * @returns decoded string
   */
  static base64UrlDecode(input: string): string {
    // Add padding if needed
    let padded = input;
    const remainder = padded.length % 4;
    if (remainder > 0) {
      padded += '='.repeat(4 - remainder);
    }
    
    // Replace base64url characters with standard base64
    const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
    
    // Use browser's atob or Node.js Buffer
    if (typeof atob !== 'undefined') {
      return atob(base64);
    } else {
      // Node.js environment
      return Buffer.from(base64, 'base64').toString('utf-8');
    }
  }

  /**
   * Decode base64url string to Uint8Array
   * @param input - base64url encoded string
   * @returns decoded bytes
   */
  static base64UrlDecodeToBytes(input: string): Uint8Array {
    const decoded = this.base64UrlDecode(input);
    if (typeof TextEncoder !== 'undefined') {
      // Browser environment
      return new Uint8Array(decoded.split('').map(c => c.charCodeAt(0)));
    } else {
      // Node.js environment
      return new Uint8Array(Buffer.from(decoded, 'binary'));
    }
  }

  /**
   * Encode Uint8Array to base64url string
   * @param bytes - bytes to encode
   * @returns base64url encoded string
   */
  static base64UrlEncode(bytes: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    
    let base64: string;
    if (typeof btoa !== 'undefined') {
      base64 = btoa(binary);
    } else {
      // Node.js environment
      base64 = Buffer.from(binary, 'binary').toString('base64');
    }
    
    // Convert to base64url
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Encode string to base64url
   * @param input - string to encode
   * @returns base64url encoded string
   */
  static stringToBase64Url(input: string): string {
    let base64: string;
    if (typeof btoa !== 'undefined') {
      base64 = btoa(input);
    } else {
      base64 = Buffer.from(input, 'utf-8').toString('base64');
    }
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }
}