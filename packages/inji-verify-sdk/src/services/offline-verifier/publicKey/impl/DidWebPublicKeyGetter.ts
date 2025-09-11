import type { PublicKeyGetter } from '../PublicKeyGetter.js';
import type { PublicKeyData } from '../Types.js';
import { NetworkManager } from '../../../../../../../apps/worker-pwa/src/network/NetworkManager.js';
import { getPublicKeyFromPem, getPublicKeyFromJwk, getPublicKeyFromHex, getPublicKeyFromMultibaseEd25519 } from '../Utils.js';

const didWebRegex = /^did:web:([a-zA-Z0-9.-]+)(?::(.+))?$/;

export class DidWebPublicKeyGetter implements PublicKeyGetter {
  async get(verificationMethod: string): Promise<PublicKeyData> {
    // vm string may contain a fragment referring to a specific key id; we need the base DID to fetch doc
    const baseDid = verificationMethod.split('#')[0];
    const m = didWebRegex.exec(baseDid);
    if (!m) throw new Error('Invalid did:web');
    const [, domain, path] = m;
    const url = path ? `https://${domain}/${path.replace(/:/g, '/')}/did.json` : `https://${domain}/.well-known/did.json`;
    const res = await NetworkManager.fetch(url, { auth: false });
    const doc = await res.json();

    const vms: any[] = doc.verificationMethod || [];
    const vm = vms.find((x: any) => x && x.id === verificationMethod);
    if (!vm) throw new Error('Verification method not found in DID document');

    // Priority: PEM -> multibase -> JWK -> hex (to match Kotlin order in DidWebPublicKeyGetter)
    if (vm.publicKeyPem) {
      return getPublicKeyFromPem(vm.publicKeyPem, vm.type, verificationMethod);
    }
    if (vm.publicKeyMultibase) {
      return getPublicKeyFromMultibaseEd25519(vm.publicKeyMultibase, vm.type, verificationMethod);
    }
    if (vm.publicKeyJwk) {
      return getPublicKeyFromJwk(vm.publicKeyJwk, vm.type, verificationMethod);
    }
    if (vm.publicKeyHex) {
      return getPublicKeyFromHex(vm.publicKeyHex, vm.type, verificationMethod);
    }

    throw new Error('Public Key type is not supported');
  }
}
