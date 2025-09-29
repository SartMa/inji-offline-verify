declare module '@digitalbazaar/data-integrity' {
  export interface DataIntegrityProofOptions {
    cryptosuite: unknown;
  }

  export class DataIntegrityProof {
    constructor(options: DataIntegrityProofOptions);
  }
}

declare module '@digitalbazaar/ecdsa-rdfc-2019-cryptosuite' {
  export const cryptosuite: unknown;
}
