declare module 'cose-js' {
  export function verify(coseMessage: Uint8Array, verifier: any, payload?: Uint8Array): boolean;
  export function sign(payload: Uint8Array, privateKey: any): Uint8Array;
  // Add other exports as needed
}