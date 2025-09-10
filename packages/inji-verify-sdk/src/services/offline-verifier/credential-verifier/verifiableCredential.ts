import { ValidationStatus } from '../data/data.js';

abstract class VerifiableCredential {
    abstract validate(credential: string): ValidationStatus;
    abstract verify(credential: string): Promise<boolean>;
}

export { VerifiableCredential };