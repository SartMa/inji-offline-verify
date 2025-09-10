import type { PublicKeyData } from './Types';
import type { PublicKeyGetter } from './PublicKeyGetter';
import { DidWebPublicKeyGetter } from './impl/DidWebPublicKeyGetter.ts';
import { DidKeyPublicKeyGetter } from './impl/DidKeyPublicKeyGetter.ts';
import { DidJwkPublicKeyGetter } from './impl/DidJwkPublicKeyGetter.ts';
import { HttpsPublicKeyGetter } from './impl/HttpsPublicKeyGetter.ts';

export class PublicKeyGetterFactory {
  async get(verificationMethod: string): Promise<PublicKeyData> {
    const vm = verificationMethod;
    let getter: PublicKeyGetter | null = null;
    if (vm.startsWith('did:web')) getter = new DidWebPublicKeyGetter();
    else if (vm.startsWith('did:key')) getter = new DidKeyPublicKeyGetter();
    else if (vm.startsWith('did:jwk')) getter = new DidJwkPublicKeyGetter();
    else if (vm.startsWith('http')) getter = new HttpsPublicKeyGetter();
    if (!getter) throw new Error('Public Key type is not supported');
    return getter.get(verificationMethod);
  }
}
