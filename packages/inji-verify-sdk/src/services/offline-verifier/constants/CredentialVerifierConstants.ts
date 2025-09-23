// filepath: c:\Users\HARSH MOHTA\OneDrive - iiit-b\Desktop\Mosip\inji-offline-verifier\offline-verifier\constants\CredentialVerifierConstants.js
const CredentialVerifierConstants = {
    PUBLIC_KEY_PEM: "publicKeyPem",
    PUBLIC_KEY_MULTIBASE: "publicKeyMultibase",
    PUBLIC_KEY_JWK: "publicKeyJwk",
    PUBLIC_KEY_HEX: "publicKeyHex",
    VERIFICATION_METHOD: "verificationMethod",
    KEY_TYPE: "type",

    PSS_PARAM_SHA_256: "SHA-256",
    PSS_PARAM_MGF1: "MGF1",
    PSS_PARAM_SALT_LEN: 32,
    PSS_PARAM_TF: 1,

    PS256_ALGORITHM: "SHA256withRSA/PSS",
    RS256_ALGORITHM: "SHA256withRSA",
    EC_ALGORITHM: "SHA256withECDSA",
    ED25519_ALGORITHM: "Ed25519",
    RSA_ALGORITHM: "RSA",
    SECP256K1: "secp256k1",

    JWS_PS256_SIGN_ALGO_CONST: "PS256",
    JWS_RS256_SIGN_ALGO_CONST: "RS256",
    JWS_EDDSA_SIGN_ALGO_CONST: "EdDSA",
    JWS_ES256K_SIGN_ALGO_CONST: "ES256K",

    RSA_KEY_TYPE: "RsaVerificationKey2018",
    ED25519_KEY_TYPE_2018: "Ed25519VerificationKey2018",
    ED25519_PROOF_TYPE_2018: "Ed25519Signature2018",
    ED25519_PROOF_TYPE_2020: "Ed25519Signature2020",
    JSON_WEB_PROOF_TYPE_2020: "JsonWebSignature2020",
    ED25519_KEY_TYPE_2020: "Ed25519VerificationKey2020",
    ES256K_KEY_TYPE_2019: "EcdsaSecp256k1VerificationKey2019",

    JWK_KEY_TYPE_EC: "EC",

    EXCEPTION_DURING_VERIFICATION: "Exception during Verification: ",
    ERROR_MESSAGE_VERIFICATION_FAILED: "Verification Failed",
    ERROR_CODE_VERIFICATION_FAILED: "ERR_SIGNATURE_VERIFICATION_FAILED",

    // Offline dependency errors (contexts/keys not available in cache while offline)
    ERROR_MESSAGE_OFFLINE_DEPENDENCIES_MISSING: "Required verification data not available offline. Connect to the internet to seed the cache and try again.",
    ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING: "ERR_OFFLINE_DEPENDENCIES_MISSING",

    // This is used to turn public key bytes into a buffer in DER format
    DER_PUBLIC_KEY_PREFIX: "302a300506032b6570032100",

    COMPRESSED_HEX_KEY_LENGTH: 33
};

Object.freeze(CredentialVerifierConstants);

export { CredentialVerifierConstants };