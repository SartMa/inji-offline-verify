# Offline Verification with QRCodeVerification Component

## Unified API for Online and Offline Verification

The `QRCodeVerification` component now supports both online and offline verification modes through a unified API. Use the `mode` prop to specify which verification method to use.

## Offline Mode Usage

```tsx
import { QRCodeVerification, VerificationResult, CredentialFormat } from '@inji-offline-verify/sdk';

function MyVerifierComponent() {
  const handleVerificationResult = (result: VerificationResult) => {
    if (result.verificationStatus) {
      console.log('✅ Credential is valid!');
      console.log('Message:', result.verificationMessage);
    } else {
      console.log('❌ Credential verification failed');
      console.log('Error:', result.verificationMessage);
      console.log('Error Code:', result.verificationErrorCode);
    }
  };

  const handleError = (error: Error) => {
    console.error('QR scanning error:', error.message);
  };

  return (
    <QRCodeVerification
  // offline-style verification (single mode)
      onVerificationResult={handleVerificationResult}      // Required for offline mode
      onError={handleError}                                // Required for both modes
      credentialFormat={CredentialFormat.LDP_VC}          // Optional, defaults to LDP_VC
      triggerElement={<button>Scan QR Code</button>}       // Optional trigger element
      isEnableUpload={true}                                // Enable file upload
      isEnableScan={true}                                  // Enable camera scanning
      isEnableZoom={true}                                  // Enable zoom controls
    />
  );
}
```

## Online Mode Usage (unchanged)

```tsx
<QRCodeVerification
  mode="online"                                    // Enable online verification
  verifyServiceUrl="https://api.example.com/verify"  // Required for online mode
  onVCReceived={(id) => console.log('VC ID:', id)}    // OR onVCProcessed
  onError={handleError}                               // Required for both modes
  // ... other props
/>
```

### Supported Credential Formats

- `CredentialFormat.LDP_VC` - Linked Data Proofs Verifiable Credentials (default)
- `CredentialFormat.MSO_MDOC` - Mobile Security Object (mDOC) format

### Key Changes from Previous API

1. **Removed Dependencies**: No longer need to provide:
   - `getDidDocumentFromCache` 
   - `getDocumentLoader`
   
2. **Simplified Props**: The offline verifier now handles:
   - Public key resolution from local cache
   - JSON-LD context resolution
   - Credential validation and signature verification

3. **Built-in Services**: The component uses:
   - `CredentialsVerifier` - Main verification service
   - `PublicKeyService` - Handles cached public keys
   - `OfflineDocumentLoader` - Resolves JSON-LD contexts locally

### Verification Result

The `VerificationResult` object contains:

```typescript
{
  verificationStatus: boolean;     // true if valid, false if invalid
  verificationMessage: string;     // Success/error message  
  verificationErrorCode: string;   // Error code for debugging
}
```

### Error Handling

Errors during QR scanning (camera access, file upload) are handled via the `onError` callback.
Verification failures are reported through `onVerificationResult` with `verificationStatus: false`.

### Prerequisites

Ensure that public keys for credential issuers are cached locally using the `PublicKeyService` before attempting offline verification.
