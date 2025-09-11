/**
 * Type declarations for DigitalBazaar packages
 * This resolves TypeScript compilation issues for packages without built-in types
 */

declare module '@digitalbazaar/ed25519-signature-2020' {
  export class Ed25519Signature2020 {
    constructor(options?: { key?: any; [key: string]: any });
    static from(keyPair: any): Promise<Ed25519Signature2020>;
  }
}

declare module '@digitalbazaar/ed25519-verification-key-2020' {
  export class Ed25519VerificationKey2020 {
    constructor(options?: any);
    static from(options: any): Promise<Ed25519VerificationKey2020>;
    static generate(): Promise<Ed25519VerificationKey2020>;
    id: string;
    type: string;
    controller: string;
    publicKeyMultibase?: string;
    privateKeyMultibase?: string;
  }
}

declare module 'jsonld-signatures' {
  export function verify(document: any, options: any): Promise<{ verified: boolean; error?: any }>;
  export function sign(document: any, options: any): Promise<any>;
  
  export namespace purposes {
    export class AssertionProofPurpose {
      constructor(options?: any);
    }
    export class AuthenticationProofPurpose {
      constructor(options?: any);
    }
  }
}

declare module 'jsonld' {
  export function compact(input: any, context: any, options?: any): Promise<any>;
  export function expand(input: any, options?: any): Promise<any>;
  export function canonize(input: any, options?: any): Promise<string>;
  
  export const documentLoaders: {
    node(): (url: string) => Promise<{ contextUrl?: string; documentUrl: string; document: any }>;
    xhr(): (url: string) => Promise<{ contextUrl?: string; documentUrl: string; document: any }>;
  };
}