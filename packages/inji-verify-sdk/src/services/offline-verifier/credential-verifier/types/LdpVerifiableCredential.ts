import { VerifiableCredential } from '../verifiableCredential.js';
import { LdpValidator } from '../validators/LdpValidator.js';
import { LdpVerifier } from '../verifiers/LdpVerifier.js';
import { ValidationStatus } from '../../data/data.js';

class LdpVerifiableCredential extends VerifiableCredential {
    validate(credential: string): ValidationStatus {
        return new LdpValidator().validate(credential);
    }

    async verify(credential: string): Promise<boolean> {
        return await new LdpVerifier().verify(credential);
    }
}

export { LdpVerifiableCredential };