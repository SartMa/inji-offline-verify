export { default as OpenID4VPVerification } from '././components/openid4vp-verification/OpenID4VPVerification';
export { default as QRCodeVerification } from '././components/qrcode-verification/QRCodeVerification';

// Export offline verification services
export { CredentialsVerifier } from './services/offline-verifier/CredentialsVerifier';
export { CredentialFormat } from './services/offline-verifier/constants/CredentialFormat';
export { VerificationResult } from './services/offline-verifier/data/data';
export { PublicKeyService } from './services/offline-verifier/publicKey/PublicKeyService';
// ...existing code...
export { SDKCacheManager } from './services/offline-verifier/cache/SDKCacheManager';
export { OrgResolver } from './services/offline-verifier/cache/utils/OrgResolver';
export type { CacheBundle } from './services/offline-verifier/cache/utils/OrgResolver';
// ...existing code...