import { MultibaseUtils } from './MultibaseUtils.js';
import { decodeDidKeyMultibaseEd25519 } from '../publicKey/Utils.js';

/**
 * Normalize a verification method document for the expected proof/suite.
 * - For Ed25519Signature2018, ensure type is Ed25519VerificationKey2018 and publicKeyBase58 is set.
 * - For Ed25519Signature2020, ensure type is Ed25519VerificationKey2020 and publicKeyMultibase is set.
 */
export function normalizeVerificationMethodForProof(publicKeyData: any, proofType: string, vmId: string) {
  const id = publicKeyData?.id || vmId;
  const controller = publicKeyData?.controller || (vmId?.includes('#') ? vmId.split('#')[0] : undefined);

  if (proofType === 'Ed25519Signature2018') {
    let publicKeyBase58 = publicKeyData?.publicKeyBase58;
    if (!publicKeyBase58 && typeof publicKeyData?.publicKeyMultibase === 'string') {
      try {
        // Remove Ed25519 multicodec header if present and get raw 32-byte key
        const raw = decodeDidKeyMultibaseEd25519(publicKeyData.publicKeyMultibase);
        const encoded = MultibaseUtils.encode(raw, 'base58btc');
        publicKeyBase58 = encoded.startsWith('z') ? encoded.slice(1) : encoded;
      } catch {
        const mb = publicKeyData.publicKeyMultibase;
        publicKeyBase58 = mb.startsWith('z') ? mb.slice(1) : mb;
      }
    }
    return { id, controller, type: 'Ed25519VerificationKey2018', publicKeyBase58 };
  }

  if (proofType === 'Ed25519Signature2020') {
    let publicKeyMultibase = publicKeyData?.publicKeyMultibase;
    if (!publicKeyMultibase && typeof publicKeyData?.publicKeyBase58 === 'string') {
      // Construct multibase (z + base58btc)
      publicKeyMultibase = `z${publicKeyData.publicKeyBase58}`;
    }
    return { id, controller, type: 'Ed25519VerificationKey2020', publicKeyMultibase };
  }

  // Default passthrough
  return { id, controller, ...publicKeyData };
}
