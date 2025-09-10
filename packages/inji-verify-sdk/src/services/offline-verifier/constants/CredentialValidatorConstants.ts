const CredentialValidatorConstants = {
    CREDENTIALS_CONTEXT_V1_URL: "https://www.w3.org/2018/credentials/v1",
    CREDENTIALS_CONTEXT_V2_URL: "https://www.w3.org/ns/credentials/v2",
    VERIFIABLE_CREDENTIAL: "VerifiableCredential",

    ISSUER: "issuer",
    CREDENTIAL_SUBJECT: "credentialSubject",
    PROOF: "proof",
    TYPE: "type",
    CONTEXT: "@context",
    ISSUANCE_DATE: "issuanceDate",
    EXPIRATION_DATE: "expirationDate",
    ID: "id",
    JWS: "jws",
    VALID_FROM: "validFrom",
    VALID_UNTIL: "validUntil",
    CREDENTIAL_STATUS: "credentialStatus",
    EVIDENCE: "evidence",
    TERMS_OF_USE: "termsOfUse",
    REFRESH_SERVICE: "refreshService",
    CREDENTIAL_SCHEMA: "credentialSchema",
    NAME: "name",
    DESCRIPTION: "description",
    LANGUAGE: "language",
    VALUE: "value",

    ALGORITHM: "Algorithm",

    get VALIDATION_ERROR() { return "Validation Error: "; },
    get ERROR_MISSING_REQUIRED_FIELDS() { return `${this.VALIDATION_ERROR}Missing required field: `; },

    get ERROR_MESSAGE_EMPTY_VC_JSON() { return `${this.VALIDATION_ERROR}Input VC JSON string is null or empty.`; },
    ERROR_CODE_EMPTY_VC_JSON: "ERR_EMPTY_VC",
    ERROR_CODE_MISSING: "ERR_MISSING_",
    ERROR_CODE_INVALID: "ERR_INVALID_",
    ERROR_CODE_CURRENT_DATE_BEFORE_ISSUANCE_DATE: "ERR_ISSUANCE_DATE_IS_FUTURE_DATE",
    ERROR_CODE_CURRENT_DATE_BEFORE_VALID_FROM: "ERR_VALID_FROM_IS_FUTURE_DATE",
    ERROR_CODE_VC_EXPIRED: "ERR_VC_EXPIRED",
    ERROR_CODE_GENERIC: "ERR_GENERIC",

    get ERROR_MESSAGE_CONTEXT_FIRST_LINE() { 
        return `${this.VALIDATION_ERROR}${this.CREDENTIALS_CONTEXT_V1_URL} or ${this.CREDENTIALS_CONTEXT_V2_URL} needs to be first in the list of contexts.`; 
    },
    get ERROR_MESSAGE_VC_EXPIRED() { return "VC is expired"; },

    get ERROR_ISSUANCE_DATE_INVALID() { return `${this.VALIDATION_ERROR}issuanceDate is not valid.`; },
    get ERROR_EXPIRATION_DATE_INVALID() { return `${this.VALIDATION_ERROR}expirationDate is not valid.`; },
    get ERROR_VALID_FROM_INVALID() { return `${this.VALIDATION_ERROR}validFrom is not valid.`; },
    get ERROR_VALID_UNTIL_INVALID() { return `${this.VALIDATION_ERROR}validUntil is not valid.`; },

    get ERROR_MESSAGE_TYPE_VERIFIABLE_CREDENTIAL() { return `${this.VALIDATION_ERROR}type must include \`VerifiableCredential\`.`; },
    get ERROR_INVALID_URI() { return `${this.VALIDATION_ERROR}Invalid URI: `; },
    get ERROR_INVALID_FIELD() { return `${this.VALIDATION_ERROR}Invalid Field: `; },
    EXCEPTION_DURING_VALIDATION: "Exception during Validation: ",

    get ERROR_MESSAGE_ALGORITHM_NOT_SUPPORTED() { return `${this.VALIDATION_ERROR}Algorithm used in the proof is not matching with supported algorithms`; },
    get ERROR_MESSAGE_PROOF_TYPE_NOT_SUPPORTED() { return `${this.VALIDATION_ERROR}Proof Type is not matching with supported types`; },

    get ERROR_CURRENT_DATE_BEFORE_ISSUANCE_DATE() { return `${this.VALIDATION_ERROR}The current date time is before the issuanceDate`; },
    get ERROR_CURRENT_DATE_BEFORE_VALID_FROM() { return `${this.VALIDATION_ERROR}The current date time is before the issuanceDate`; },
    get ERROR_CREDENTIAL_SUBJECT_NON_NULL_OBJECT() { return `${this.CREDENTIAL_SUBJECT} must be a non-null object or array of objects.`; },

    get ERROR_MESSAGE_NAME() { return `${this.VALIDATION_ERROR}name should be string or array of Language Object`; },
    get ERROR_MESSAGE_DESCRIPTION() { return `${this.VALIDATION_ERROR}description should be string or array of Language Object`; },

    ERROR_MESSAGE_INVALID_VALID_FROM_MSO: "invalid validFrom in the MSO of the credential",
    get ERROR_CODE_INVALID_VALID_FROM_MSO() { return `${this.ERROR_CODE_INVALID}VALID_FROM_MSO`; },
    ERROR_MESSAGE_INVALID_VALID_UNTIL_MSO: "invalid validUntil in the MSO of the credential",
    get ERROR_CODE_INVALID_VALID_UNTIL_MSO() { return `${this.ERROR_CODE_INVALID}VALID_UNTIL_MSO`; },
    ERROR_MESSAGE_INVALID_DATE_MSO: "invalid validUntil / validFrom in the MSO of the credential",
    get ERROR_CODE_INVALID_DATE_MSO() { return `${this.ERROR_CODE_INVALID}DATE_MSO`; },

    // Regex for date validation
    DATE_REGEX: /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T([01][0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9]|60)(\.[0-9]+)?(Z|(\+|-)([01][0-9]|2[0-3]):([0-5][0-9]))$/i,

    ALGORITHMS_SUPPORTED: [
        "PS256",
        "RS256",
        "EdDSA",
        "ES256K"
    ],

    PROOF_TYPES_SUPPORTED: [
        "RsaSignature2018",
        "Ed25519Signature2018",
        "Ed25519Signature2020",
        "EcdsaSecp256k1Signature2019"
    ]
};

Object.freeze(CredentialValidatorConstants);

export { CredentialValidatorConstants };