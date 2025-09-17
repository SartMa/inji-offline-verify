import { CredentialFormat } from './constants/CredentialFormat.js';
import { CredentialValidatorConstants } from './constants/CredentialValidatorConstants.js';
import { CredentialVerifierConstants } from './constants/CredentialVerifierConstants.js';
import { CredentialVerifierFactory } from './credential-verifier/credentialVerifierFactory.js';
import { VerificationResult } from './data/data.js';

class CredentialsVerifier {
    private logger: Console;

    constructor() {
        this.logger = console; // Using console for logging in browser environment
    }

    /**
     * @deprecated This method has been deprecated because it is not extensible for future use cases of supporting different VC format's verification
     * Please use verify(credentials, format) instead, which is designed for supporting different VC formats.
     * This method only supports LDP VC format
     */
    async verifyCredentials(credentials: string | null | undefined): Promise<boolean> {
        if (credentials === null || credentials === undefined) {
            this.logger.error("Error - Input credential is null");
            throw new Error("Input credential is null");
        }
        
        const credentialVerifier = new CredentialVerifierFactory().get(CredentialFormat.LDP_VC);
        return await credentialVerifier.verify(credentials);
    }

    // Make this async and RETURN a Promise<VerificationResult>
    async verify(credential: string, credentialFormat: CredentialFormat): Promise<VerificationResult> {
        const credentialVerifier = new CredentialVerifierFactory().get(credentialFormat);
        const validationStatus = credentialVerifier.validate(credential);
        
        if (validationStatus.validationMessage.length > 0 && 
            validationStatus.validationErrorCode !== CredentialValidatorConstants.ERROR_CODE_VC_EXPIRED) {
            return new VerificationResult(
                false, 
                validationStatus.validationMessage, 
                validationStatus.validationErrorCode
            );
        }
        
        try {
            // Await the async verifier (bug fix)
            const verifySignatureStatus = await credentialVerifier.verify(credential);
            if (!verifySignatureStatus) {
                return new VerificationResult(
                    false, 
                    CredentialVerifierConstants.ERROR_MESSAGE_VERIFICATION_FAILED, 
                    CredentialVerifierConstants.ERROR_CODE_VERIFICATION_FAILED
                );
            }

            // Only report "expired" info if signature verification succeeded
            return new VerificationResult(
                true, 
                validationStatus.validationMessage, 
                validationStatus.validationErrorCode
            );
        } catch (error: any) {
            return new VerificationResult(
                false, 
                `${CredentialVerifierConstants.EXCEPTION_DURING_VERIFICATION}${error.message}`, 
                validationStatus.validationErrorCode
            );
        }
    }
}

export { CredentialsVerifier };