class VerificationResult {
    verificationStatus: boolean;
    verificationMessage: string;
    verificationErrorCode: string;
    payload: any; // Add payload to carry credential data

    constructor(verificationStatus: boolean, verificationMessage: string = "", verificationErrorCode: string, payload: any = null) {
        this.verificationStatus = verificationStatus;
        this.verificationMessage = verificationMessage;
        this.verificationErrorCode = verificationErrorCode;
        this.payload = payload; // Set payload
    }
}

class PresentationVerificationResult {
    proofVerificationStatus: VPVerificationStatus;
    vcResults: VCResult[];

    constructor(proofVerificationStatus: VPVerificationStatus, vcResults: VCResult[]) {
        this.proofVerificationStatus = proofVerificationStatus;
        this.vcResults = vcResults;
    }
}

class VCResult {
    vc: string;
    status: VerificationStatus;

    constructor(vc: string, status: VerificationStatus) {
        this.vc = vc;
        this.status = status;
    }
}

// FIX: Replaced enum with const object and type alias
export const VerificationStatus = {
    SUCCESS: "SUCCESS",
    EXPIRED: "EXPIRED",
    INVALID: "INVALID"
} as const;
export type VerificationStatus = typeof VerificationStatus[keyof typeof VerificationStatus];

// FIX: Replaced enum with const object and type alias
export const VPVerificationStatus = {
    VALID: "VALID",
    EXPIRED: "EXPIRED",
    INVALID: "INVALID"
} as const;
export type VPVerificationStatus = typeof VPVerificationStatus[keyof typeof VPVerificationStatus];

// FIX: Replaced enum with const object and type alias
export const DATA_MODEL = {
    DATA_MODEL_1_1: "DATA_MODEL_1_1",
    DATA_MODEL_2_0: "DATA_MODEL_2_0",
    UNSUPPORTED: "UNSUPPORTED"
} as const;
export type DATA_MODEL = typeof DATA_MODEL[keyof typeof DATA_MODEL];

class ValidationStatus {
    validationMessage: string;
    validationErrorCode: string;

    constructor(validationMessage: string, validationErrorCode: string) {
        this.validationMessage = validationMessage;
        this.validationErrorCode = validationErrorCode;
    }
}

export { 
    VerificationResult, 
    PresentationVerificationResult, 
    VCResult, 
    ValidationStatus 
};