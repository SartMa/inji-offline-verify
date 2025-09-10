// Multibase decoding utilities
import { Base64Utils } from './Base64Utils.js';

export class MultibaseUtils {
  // Multibase encoding mappings
  private static readonly ENCODINGS = {
    'z': 'base58btc',
    'u': 'base64url',
    'f': 'base16',
    'm': 'base64',
    'k': 'base36',
    'Z': 'base58flickr'
  };

  /**
   * Decode multibase encoded string
   * @param encoded - multibase encoded string
   * @returns decoded bytes
   */
  static decode(encoded: string): Uint8Array {
    if (!encoded || encoded.length === 0) {
      throw new Error('Invalid multibase string: empty');
    }

    const prefix = encoded[0];
    const data = encoded.slice(1);
    const encoding = this.ENCODINGS[prefix as keyof typeof this.ENCODINGS];

    if (!encoding) {
      throw new Error(`Unsupported multibase encoding: ${prefix}`);
    }

    switch (encoding) {
      case 'base58btc':
        return this.decodeBase58(data);
      case 'base64url':
        return Base64Utils.base64UrlDecodeToBytes(data);
      case 'base16':
        return this.decodeHex(data);
      case 'base64':
        return this.decodeBase64(data);
      default:
        throw new Error(`Multibase encoding not implemented: ${encoding}`);
    }
  }

  /**
   * Simple Base58 decoder (for Bitcoin alphabet)
   */
  private static decodeBase58(encoded: string): Uint8Array {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const base = alphabet.length;
    
    let num = 0n;
    for (let i = 0; i < encoded.length; i++) {
      const char = encoded[i];
      const index = alphabet.indexOf(char);
      if (index === -1) {
        throw new Error(`Invalid base58 character: ${char}`);
      }
      num = num * BigInt(base) + BigInt(index);
    }

    // Convert BigInt to bytes
    const hex = num.toString(16);
    const paddedHex = hex.length % 2 === 0 ? hex : '0' + hex;
    return this.decodeHex(paddedHex);
  }

  /**
   * Decode hexadecimal string to bytes
   */
  private static decodeHex(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  /**
   * Decode standard base64 to bytes
   */
  private static decodeBase64(base64: string): Uint8Array {
    if (typeof atob !== 'undefined') {
      const binary = atob(base64);
      return new Uint8Array(binary.split('').map(c => c.charCodeAt(0)));
    } else {
      return new Uint8Array(Buffer.from(base64, 'base64'));
    }
  }
}