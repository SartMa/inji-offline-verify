import { CredentialFormat } from './constants/CredentialFormat.js';
import { CredentialValidatorConstants } from './constants/CredentialValidatorConstants.js';
import { CredentialVerifierConstants } from './constants/CredentialVerifierConstants.js';
import { CredentialVerifierFactory } from './credential-verifier/credentialVerifierFactory.js';
import { VerificationResult } from './data/data.js';
import { RevocationChecker } from './revocation/RevocationChecker';
import { RevocationErrorCodes } from './revocation/RevocationConstants';
import { createSdkLogger } from '../../utils/logger.js';

class CredentialsVerifier {
    private logger: Console;

    constructor(logger: Console = createSdkLogger('CredentialsVerifier')) {
        this.logger = logger;
    }

    /**
     * @deprecated This method has been deprecated because it is not extensible for future use cases of supporting different VC format's verification
     * Please use verify(credentials, format) instead, which is designed for supporting different VC formats.
     * This method only supports LDP VC format
     */
    async verifyCredentials(credentials: string | null | undefined): Promise<boolean> {
        if (credentials === null || credentials === undefined) {
            this.logger.debug?.("Error - Input credential is null");
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
        
        let parsedCredential: any = null;
        try {
            parsedCredential = JSON.parse(credential);
        } catch (parseError) {
            this.logger.debug?.('Failed to parse credential JSON for payload attachment:', parseError);
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
            // After cryptographic verification, perform revocation check if credentialStatus present
            let revocationPayload: any = null;
            try {
                const revChecker = new RevocationChecker();
                const revResult = await revChecker.check(parsedCredential ?? JSON.parse(credential));
                if (revResult) {
                    revocationPayload = revResult;
                    // Classification vs verification failure: only treat as error if errorCode present
                    if (revResult.errorCode) {
                        const payload = parsedCredential
                            ? { ...parsedCredential, revocation: revResult }
                            : { revocation: revResult };
                        return new VerificationResult(
                            false,
                            revResult.errorMessage || 'Status list verification failed',
                            revResult.errorCode,
                            payload
                        );
                    }
                    // No errorCode: interpret classification
                    if (!revResult.valid) {
                        // Map based on purpose
                        const purpose = revResult.purpose;
                        let message = revResult.message || CredentialVerifierConstants.ERROR_MESSAGE_VC_REVOKED;
                        let code = CredentialVerifierConstants.ERROR_CODE_VC_REVOKED;
                        if (purpose === 'suspension') {
                            message = revResult.message || CredentialVerifierConstants.ERROR_MESSAGE_VC_SUSPENDED;
                            code = CredentialVerifierConstants.ERROR_CODE_VC_SUSPENDED;
                        }
                        // For refresh/message purposes we do not fail overall verification
                        if (purpose === 'refresh') {
                            // Optionally surface advisory code in payload only (do not fail)
                            revocationPayload = { ...revResult, infoCode: CredentialVerifierConstants.INFO_CODE_VC_REFRESH_AVAILABLE, infoMessage: CredentialVerifierConstants.INFO_MESSAGE_VC_REFRESH_AVAILABLE };
                        } else if (purpose === 'message') {
                            revocationPayload = { ...revResult, infoCode: CredentialVerifierConstants.INFO_CODE_VC_STATUS_MESSAGE, infoMessage: CredentialVerifierConstants.INFO_MESSAGE_VC_STATUS_MESSAGE };
                        } else {
                            const payload = parsedCredential
                                ? { ...parsedCredential, revocation: revResult }
                                : { revocation: revResult };
                            return new VerificationResult(
                                false,
                                message,
                                code,
                                payload
                            );
                        }
                    }
                }
            } catch (revErr: any) {
                // If revocation check itself throws known error, surface as verification failure
                if (revErr?.code && Object.values(RevocationErrorCodes).includes(revErr.code as any)) {
                    const payload = parsedCredential
                        ? { ...parsedCredential, revocation: { error: true, message: revErr.message, code: revErr.code } }
                        : { revocation: { error: true, message: revErr.message, code: revErr.code } };
                    return new VerificationResult(false, revErr.message, revErr.code, payload);
                }
                // Otherwise log and continue as success (best-effort revocation)
                this.logger.debug?.('Revocation check error (non-fatal):', revErr?.message || revErr);
            }

            const successPayload = parsedCredential
                ? (revocationPayload ? { ...parsedCredential, revocation: revocationPayload } : parsedCredential)
                : (revocationPayload ? { revocation: revocationPayload } : null);
            return new VerificationResult(
                true,
                validationStatus.validationMessage,
                validationStatus.validationErrorCode,
                successPayload
            );
        } catch (error: any) {
            // Map offline-missing-dependencies to a clear, user-friendly error result
            const msg = (error?.message ?? '').toString();
            if (msg === CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING ||
                msg.includes(CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING)) {
                return new VerificationResult(
                    false,
                    CredentialVerifierConstants.ERROR_MESSAGE_OFFLINE_DEPENDENCIES_MISSING,
                    CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING
                );
            }
            return new VerificationResult(
                false, 
                `${CredentialVerifierConstants.EXCEPTION_DURING_VERIFICATION}${error.message}`, 
                validationStatus.validationErrorCode
            );
        }
    }
}

export { CredentialsVerifier };