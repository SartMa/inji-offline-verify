import { NetworkManager } from '../network/NetworkManager';

const didWebRegex = /^did:web:([a-zA-Z0-9.-]+)(?::(.+))?$/;

export interface ResolvedKey {
  key_id: string;
  key_type: string;
  public_key_multibase?: string;
  public_key_hex?: string;
  public_key_jwk?: any;
  controller: string;
  purpose?: string;
}

export class DidResolver {
  static async resolve(did: string): Promise<ResolvedKey[]> {
    if (did.startsWith('did:web:')) return this.resolveDidWeb(did);
    if (did.startsWith('did:key:')) return [{ key_id: `${did}#key-1`, key_type: 'Ed25519VerificationKey2020', public_key_multibase: did.split('did:key:')[1], controller: did, purpose: 'assertion' }];
    throw new Error('Unsupported DID method');
  }

  private static async resolveDidWeb(did: string): Promise<ResolvedKey[]> {
    const m = didWebRegex.exec(did);
    if (!m) throw new Error('Invalid did:web');
    const [, domain, path] = m;
    const url = path ? `https://${domain}/${path.replace(/:/g, '/')}/did.json` : `https://${domain}/.well-known/did.json`;
    const res = await NetworkManager.fetch(url, { auth: false });
    const doc = await res.json();
    const vm = doc.verificationMethod || [];
    const assertion = new Set((doc.assertionMethod || []).map((x: any) => typeof x === 'string' ? x : x.id));
    return vm.map((m: any) => ({
      key_id: m.id,
      key_type: m.type,
      public_key_multibase: m.publicKeyMultibase,
      public_key_hex: m.publicKeyHex,
      public_key_jwk: m.publicKeyJwk,
      controller: m.controller || did,
      purpose: assertion.has(m.id) ? 'assertion' : 'authentication',
    }));
  }
}
