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
   * Encode bytes to multibase string
   * @param bytes - raw bytes to encode
   * @param encoding - encoding type (defaults to 'base58btc' for Ed25519 keys)
   * @returns multibase encoded string with prefix
   */
  static encode(bytes: Uint8Array, encoding: 'base58btc' | 'base64' | 'base16' = 'base58btc'): string {
    let prefix: string;
    let encodedData: string;

    switch (encoding) {
      case 'base58btc':
        prefix = 'z';
        encodedData = this.encodeBase58(bytes);
        break;
      case 'base64':
        prefix = 'm';
        encodedData = this.encodeBase64(bytes);
        break;
      case 'base16':
        prefix = 'f';
        encodedData = this.encodeHex(bytes);
        break;
      default:
        throw new Error(`Encoding not implemented: ${encoding}`);
    }

    return prefix + encodedData;
  }

  /**
   * Simple Base58 decoder (for Bitcoin alphabet)
   */
  private static decodeBase58(encoded: string): Uint8Array {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const base = alphabet.length;
    
    let num = BigInt(0);
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
   * Simple Base58 encoder (for Bitcoin alphabet)
   */
  private static encodeBase58(bytes: Uint8Array): string {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const base = BigInt(alphabet.length);
    
    // Convert bytes to hex, then to BigInt
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    let num = BigInt('0x' + hex);
    
    if (num === BigInt(0)) return alphabet[0];
    
    let result = '';
    while (num > BigInt(0)) {
      const remainder = Number(num % base);
      result = alphabet[remainder] + result;
      num = num / base;
    }
    
    // Handle leading zeros
    for (let i = 0; i < bytes.length && bytes[i] === 0; i++) {
      result = alphabet[0] + result;
    }
    
    return result;
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

  /**
   * Encode bytes to standard base64
   */
  private static encodeBase64(bytes: Uint8Array): string {
    if (typeof btoa !== 'undefined') {
      const binary = String.fromCharCode.apply(null, Array.from(bytes));
      return btoa(binary);
    } else {
      return Buffer.from(bytes).toString('base64');
    }
  }

  /**
   * Encode bytes to hexadecimal string
   */
  private static encodeHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Extract raw Ed25519 public key bytes from SPKI format
   * Ed25519 SPKI has a fixed 12-byte header followed by 32-byte raw key
   */
  static extractEd25519RawFromSpki(spkiBytes: Uint8Array): Uint8Array {
    // Ed25519 SPKI format: 12 bytes header + 32 bytes raw key = 44 bytes total
    if (spkiBytes.length === 44) {
      return spkiBytes.slice(12); // Skip the 12-byte header
    }
    // If it's already raw (32 bytes), return as-is
    if (spkiBytes.length === 32) {
      return spkiBytes;
    }
    throw new Error(`Unexpected key length: ${spkiBytes.length}. Expected 32 (raw) or 44 (SPKI) bytes for Ed25519`);
  }
}