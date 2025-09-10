import type { PublicKeyData } from './Types';

export interface PublicKeyGetter {
  get(verificationMethod: string): Promise<PublicKeyData>;
}
