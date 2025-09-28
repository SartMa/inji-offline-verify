// Minimal ambient module declarations for '@digitalbazaar/vc'.
// The package currently has no TypeScript types in this project; this shim
// allows compilation. Extend with stricter typing as needed.
declare module '@digitalbazaar/vc' {
  // Generic verification result shape
  interface VCVerifyResult { verified: boolean; error?: any; [k: string]: any }
  interface VerifyOptions {
    presentation?: any;
    credential?: any;
    suite: any;
    documentLoader: (url: string) => Promise<any>;
    challenge?: string;
    unsignedPresentation?: boolean;
    [k: string]: any;
  }
  export function verify(opts: VerifyOptions): Promise<VCVerifyResult>;
  export const defaultDocumentLoader: (url: string) => Promise<any>;
}