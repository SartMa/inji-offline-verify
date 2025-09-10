import { CredentialFormat } from '../constants/CredentialFormat.js';
import { VerifiableCredential } from './verifiableCredential.js';
import { LdpVerifiableCredential } from './types/LdpVerifiableCredential.js';
import { MsoMdocVerifiableCredential } from './types/msomdoc/MsoMdocVerifiableCredential.js';

class CredentialVerifierFactory {
    get(credentialFormat: CredentialFormat): VerifiableCredential {
        switch (credentialFormat) {
            case CredentialFormat.LDP_VC:
                return new LdpVerifiableCredential();
            case CredentialFormat.MSO_MDOC:
                return new MsoMdocVerifiableCredential();
            default:
                throw new Error(`Unsupported credential format: ${credentialFormat}`);
        }
    }
}

export { CredentialVerifierFactory };