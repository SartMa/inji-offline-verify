import type { PublicKeyGetter } from '../PublicKeyGetter.js';
import type { PublicKeyData } from '../Types.js';
import { ED25519_KEY_TYPE_2020, getPublicKeyFromMultibaseEd25519 } from '../Utils.js';

export class DidKeyPublicKeyGetter implements PublicKeyGetter {
  async get(verificationMethod: string): Promise<PublicKeyData> {
    // Take portion before optional #fragment
    const base = verificationMethod.split('#')[0];
    const mb = base.split('did:key:')[1];
    if (!mb) throw new Error('Unsupported jws signature algorithm');
    return getPublicKeyFromMultibaseEd25519(mb, ED25519_KEY_TYPE_2020, verificationMethod);
  }
}
