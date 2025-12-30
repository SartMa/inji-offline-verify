export { default as OpenID4VPVerification } from '././components/openid4vp-verification/OpenID4VPVerification';
export { default as QRCodeVerification } from '././components/qrcode-verification/QRCodeVerification';

// Export OpenID4VP API utilities
export {
  createOpenID4VPSession,
  getOpenID4VPSessionStatus,
  getPresentationDefinition,
} from './utils/openid4vp-api';
export type {
  OpenID4VPSessionRequest,
  OpenID4VPSessionResponse,
  OpenID4VPStatusResponse,
  VerificationResult as OpenID4VPVerificationResult,
} from './utils/openid4vp-api';

// Export offline verification services
export { CredentialsVerifier } from './services/offline-verifier/CredentialsVerifier';
export { CredentialFormat } from './services/offline-verifier/constants/CredentialFormat';
export { VerificationResult } from './services/offline-verifier/data/data';
export { PresentationVerifier } from './services/offline-verifier/PresentationVerifier';
export { PublicKeyService } from './services/offline-verifier/publicKey/PublicKeyService';
// ...existing code...
export { SDKCacheManager } from './services/offline-verifier/cache/SDKCacheManager';
export { OrgResolver } from './services/offline-verifier/cache/utils/OrgResolver';
export type { CacheBundle } from './services/offline-verifier/cache/utils/OrgResolver';
export { replacePublicKeysForOrganization } from './services/offline-verifier/cache/utils/CacheHelper';
export { warmUpZXingModule } from './utils/zxingModuleLoader';
// ...existing code...