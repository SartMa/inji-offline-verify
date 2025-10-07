# Inji Verify SDK (internal distribution)

> ⚠️ This package is vendored inside the `inji-offline-verify` workspace and is **not** published to npm. Consume it via the workspace tooling or by building local artifacts.

React-first verifier experiences powered by MOSIP's offline credential validation engine. The SDK is inspired by the core [`vc-verifier`](https://github.com/mosip/vc-verifier) project and has been extended for TypeScript, browser, and offline-first use cases inside this repository.

## Table of contents

- [Overview](#overview)
- [Feature highlights](#feature-highlights)
- [Supported credential formats](#supported-credential-formats)
- [SDK surface](#sdk-surface)
  - [QRCodeVerification component](#qrcodeverification-component)
  - [Offline verification engine](#offline-verification-engine)
  - [Cache and revocation helpers](#cache-and-revocation-helpers)
- [Installation](#installation)
- [Getting started](#getting-started)
- [Offline toolkit recipes](#offline-toolkit-recipes)
- [Error codes](#error-codes)
- [Backend & cache preparation](#backend--cache-preparation)
- [Local development](#local-development)
- [Publishing to an internal registry](#publishing-to-an-internal-registry)
- [Compatibility](#compatibility)
- [Project structure](#project-structure)
- [References & further reading](#references--further-reading)

## Overview

`@mosip/react-inji-verify-sdk` delivers the building blocks needed to integrate MOSIP's verifier flows into a React application:

- a production-ready React component for offline QR/passive document verification;
- an offline-first verification engine (ported from the MOSIP [`vc-verifier`](https://github.com/mosip/vc-verifier) Java/Kotlin library) implemented in TypeScript;
- IndexedDB-backed caching for JSON-LD contexts, issuer public keys, and revocation lists so that verifications succeed even without network access.

Whether you are scanning credentials inside a kiosk or embedding the verifier in another relying party application, the SDK exposes the same validation primitives that power Inji's worker applications.

## Feature highlights

- **Unified QR scanner** – Camera + upload workflows, WASM-based decoding via `zxing-wasm`, mobile-friendly zoom controls, and fail-safe timers.
- **Verifiable Credential (VC) verifier** – Validates individual LDP VCs with comprehensive signature suite support:
  - **Ed25519Signature2020** (Ed25519 algorithm with 2020 context)
  - **Ed25519Signature2018** (Ed25519 algorithm with 2018 context)  
  - **EcdsaSecp256k1Signature2019** (ECDSA secp256k1 with noble-secp256k1 library)
  - **RsaSignature2018** (RSA PKCS#1 v1.5 with SHA-256)
  - **JsonWebSignature2020** (JWS-based signatures)
  - **DataIntegrityProof** with `ecdsa-rdfc-2019` cryptosuite (ECDSA with RDF canonicalization)
- **Verifiable Presentation (VP) verifier** – Validates presentation proofs and embedded credentials:
  - **Ed25519Signature2020** for presentation-level proof verification using `@digitalbazaar/vc`
  - Challenge-based authentication with configurable domain validation
  - Automatic delegation to VC verifier for embedded credential validation
  - Support for both signed and unsigned presentations
- **Revocation & cache services** – Seed and synchronise issuer keys, JSON-LD contexts, and revoked credential lists with a consistent bundle contract.
- **Extensible public key resolution** – `did:web`, `did:key`, `did:jwk`, and HTTPS key endpoints are supported out of the box.
- **Developer ergonomics** – Typed APIs, isolated services, Jest + Testing Library harnesses, and webpack + TypeScript build pipeline.


## Supported credential formats

| Credential format | Signature suites implemented | Cryptographic algorithms | Libraries used | Offline support | Testing status |
| --- | --- | --- | --- | --- | --- |
| `ldp_vc` | `Ed25519Signature2018`<br/>`Ed25519Signature2020` | Ed25519 elliptic curve digital signatures | `@digitalbazaar/ed25519-signature-2018`<br/>`@digitalbazaar/ed25519-signature-2020`<br/>`jsonld-signatures` | Fully offline once JSON-LD contexts and verification methods are cached. | ✅ Actively exercised in worker/PWA flows. |
| `ldp_vc` | `EcdsaSecp256k1Signature2019` | ECDSA with secp256k1 curve (Bitcoin/Ethereum compatible) | `@noble/secp256k1`<br/>`@noble/hashes`<br/>`jsonld-signatures` | Fully offline with noble-secp256k1 library | ✅ Production ready with noble cryptography. |
| `ldp_vc` | `RsaSignature2018*` | RSA PKCS#1 v1.5 with SHA-256| `jsonld-signatures`<br/> Browser `Web Crypto` API Custom RSA verifier | Requires PEM/JWK material. Relies on online fetch, offline verification not available. | Verified |
| `ldp_vc` | `DataIntegrityProof`<br/>(cryptosuite: `ecdsa-rdfc-2019`) | ECDSA with P-256/P-384 curves + RDF Dataset Canonicalization | `@digitalbazaar/vc`<br/>`@digitalbazaar/data-integrity`<br/>`@digitalbazaar/ecdsa-rdfc-2019-cryptosuite` | Fully offline once verification methods are cached | ✅ Active implementation with ECDSA cryptosuite support. |
| `mso_mdoc` | COSE `ES256` (COSE_Sign1) | ECDSA with P-256 curve in COSE format | Custom COSE implementation<br/>Browser Web Crypto API | Works offline when COSE payload is provided; signature verification parity still under review. | ⚠️ Ported from Kotlin; **manual production testing pending**. |
| Verifiable Presentation | `Ed25519Signature2020` | Ed25519 elliptic curve digital signatures | `@digitalbazaar/vc`<br/>`@digitalbazaar/ed25519-signature-2020`<br/>`@digitalbazaar/ed25519-verification-key-2020` | Requires cached contexts and keys. Fails gracefully with `ERR_OFFLINE_DEPENDENCIES_MISSING` when prerequisites are absent. | ⚠️ **Limited testing** - Only Ed25519Signature2020 VP examples verified.|

*Detached JWS (`b64=false`, `crit:["b64"]`); supports `RS256` / `PS256` and offline canonicalisation via `https://w3id.org/security/v2`.

The TypeScript implementation mirrors MOSIP's Kotlin verifier while adding IndexedDB caching, granular error mapping, and optional online fallbacks for missing artefacts.

## SDK surface

### QRCodeVerification component

`QRCodeVerification` handles camera capture, file uploads (`png`, `jpeg`, `jpg`, `pdf`), and throttled decoding via `zxing-wasm`. The component routes decoded payloads to the offline verifier and exposes a single `onVerificationResult` callback to keep consuming applications simple.

### Offline verification engine

Direct imports from `src/index.ts` expose the same primitives used internally:

#### Core verification entry points
- **`CredentialsVerifier`** – Primary entry point for individual VC verification called by `QRCodeVerification` component:
  - Orchestrates the complete verification pipeline for single verifiable credentials
  - Uses `LdpValidator` for structural validation (schema compliance, required fields, expiration dates)
  - Delegates cryptographic verification to `LdpVerifier` for signature validation
  - Supports all `CredentialFormat` types (LDP_VC, mDOC, etc.)
  - Returns structured `VerificationResult` with detailed error codes and status

- **`PresentationVerifier`** – Primary entry point for VP verification called by `QRCodeVerification` component:
  - Handles presentation-level proof verification using `@digitalbazaar/vc` library
  - Validates presentation signatures with challenge-based authentication
  - Automatically delegates embedded credential verification to `CredentialsVerifier`
  - Supports both signed and unsigned presentations with configurable domain validation
  - Returns `PresentationVerificationResult` with aggregated VC verification status

#### Verification layer components
- **`LdpValidator`** – Structural validation engine (ported from Kotlin):
  - Validates credential schema compliance for Data Model 1.1 and 2.0
  - Checks mandatory fields, date formats, and credential structure
  - Handles expiration validation (`expirationDate` for v1.1, `validUntil` for v2.0)
  - Returns `ValidationStatus` with specific error codes for structural issues
  
- **`LdpVerifier`** – Cryptographic verification engine:
  - Contains the core signature verification logic for all supported proof types
  - Routes to appropriate signature suites (Ed25519, ECDSA, RSA, DataIntegrity)
  - Uses `jsonld-signatures` with custom `OfflineDocumentLoader` for context resolution
  - Integrates with `PublicKeyService` for verification method resolution
  - Performs canonicalization and cryptographic proof validation

#### Helper types and utilities
- `CredentialFormat` helpers – narrows string inputs to supported formats.
- `VerificationResult`, `PresentationVerificationResult`, `VCResult` – strongly typed result objects.

### Key resolution and document loading

- **`PublicKeyService`** – Primary key resolver with cache-first strategy:
  - Queries IndexedDB cache for verification methods and public keys
  - Falls back to `PublicKeyGetterFactory` for online DID resolution when cache misses
  - Supports `did:web`, `did:key`, `did:jwk` and HTTPS endpoints
  - Automatically caches resolved keys for future offline use
  
- **`OfflineDocumentLoader`** – JSON-LD context resolver for `jsonld-signatures`:
  - Prioritizes cached contexts from IndexedDB for offline-first operation
  - Fetches missing contexts from network when online and caches them via `SDKCacheManager`
  - Provides security boundary - handles only @context URLs, not DID resolution
  - Throws `ERR_OFFLINE_DEPENDENCIES_MISSING` when required contexts are unavailable offline

- **`PublicKeyGetterFactory`** – Multi-protocol DID resolver (ported from Kotlin):
  - Resolves `did:web` by fetching DID documents from web endpoints
  - Extracts keys from `did:key` using multibase decoding
  - Handles `did:jwk` and HTTPS key endpoints
  - Returns normalized key material in multiple formats (multibase, JWK, hex, PEM)

### Cache management and organization utilities

- **`SDKCacheManager`** – Central cache orchestrator managing IndexedDB storage:
  - Hydrates IndexedDB with keys, JSON-LD contexts, and revoked credential entries
  - Provides `primeFromServer()` and `syncFromServer()` methods for cache seeding
  - Manages database schema with constants defined in `CacheConstants`
  - Coordinates with `CacheHelper` utilities for low-level database operations

- **`OrgResolver`** – Server-side bundle builder for organizations:
  - Generates `CacheBundle` objects from VCs or issuer DIDs using `PublicKeyGetterFactory`
  - Fetches and packages JSON-LD contexts for offline distribution
  - Builds comprehensive bundles that organizations store in backend databases
  - Enables pre-seeding of verification dependencies before credentials are issued

- **`CacheHelper`** utilities – Low-level IndexedDB operations:
  - `putPublicKeys()`, `getAnyKeyForDid()` - Key storage and retrieval
  - `putContexts()`, `getContext()` - JSON-LD context management  
  - `replaceRevokedVCsForOrganization()`, `isVCRevoked()` - Revocation list handling
  - Direct IndexedDB access with transaction management and error handling

Use these utilities to guarantee that kiosks, PWAs, or service workers have everything they need for offline validation before a presentation begins.


## Installation

Since this package is part of the monorepo and not published to npm, you consume it directly via workspace dependencies:

```bash
# Add to your worker-pwa/package.json dependencies (recommended)
# This is automatically resolved by pnpm workspace protocol
"@mosip/react-inji-verify-sdk": "workspace:*"

# Or install it explicitly from the monorepo root
pnpm --filter your-app-name add @mosip/react-inji-verify-sdk@workspace:*

# Final installation from root directory
pnpm install
```

**Note**: This package is **not available on npm, yarn, or any public registry**. It exists only as a local workspace package within this monorepo.

The package declares React 19 as a peer dependency. Ensure your application already provides a matching `react` and `react-dom` runtime.

## Getting started

```tsx
import {
  QRCodeVerification,
  CredentialFormat,
  VerificationResult
} from "@mosip/react-inji-verify-sdk";

export function KioskScanner() {
  const handleVerificationResult = (result: VerificationResult) => {
    if (result.verificationStatus) {
      console.info("✅ Credential valid", result);
    } else {
      console.warn("❌ Credential rejected", result.verificationErrorCode, result.verificationMessage);
    }
  };

  return (
    <QRCodeVerification
      triggerElement={<button>Scan credential</button>}
      onVerificationResult={handleVerificationResult}
      onError={(error) => console.error("Scanner error", error)}
      credentialFormat={CredentialFormat.LDP_VC}
      isEnableUpload
      isEnableScan
      isEnableZoom
    />
  );
}
```

What happens under the hood:

- `readBarcodes` (WASM) powers the camera workflow and performs throttled frame sampling to keep CPU under control.
- Uploads accept PNG, JPEG, JPG, and PDF files; PDF pages are rasterised before QR detection.
- After decoding, the payload is passed to `CredentialsVerifier` or `PresentationVerifier` depending on whether a VP or a VC was scanned.
- The verifier automatically checks revocation status via `isVCRevoked` when the credential includes an `id`.

### Preloading the ZXing WASM module

The first call to `readBarcodes` downloads and instantiates the `zxing_full.wasm` binary. To keep the scanner responsive, you can prefetch the module as soon as your session becomes authenticated (for example, directly after login):

```ts
import { warmUpZXingModule } from '@mosip/react-inji-verify-sdk';

await warmUpZXingModule(); // resolves once the WASM runtime is ready
```

If you host the `.wasm` asset yourself, supply a base URL so the loader can rewrite `locateFile` for you:

```ts
warmUpZXingModule({ baseUrl: `${window.location.origin}/wasm` });
```

Subsequent calls return the same in-flight promise, so it is safe to invoke this helper from both your login flow and the scanner component. On failure the cached promise resets, allowing retries.

## Offline toolkit recipes

### Programmatic credential verification

```ts
import {
  CredentialsVerifier,
  CredentialFormat,
  VerificationResult
} from "@mosip/react-inji-verify-sdk";

async function verifyCredential(vcJson: string): Promise<VerificationResult> {
  const verifier = new CredentialsVerifier();
  return verifier.verify(vcJson, CredentialFormat.LDP_VC);
}
```

`VerificationResult.verificationErrorCode` maps directly to the constants exported by the offline verifier. The verifier returns structured error codes such as:

| Code | Raised when |
| --- | --- |
| `ERR_SIGNATURE_VERIFICATION_FAILED` | The cryptographic proof on the VC/VP failed, or the signature suite is unsupported. |
| `ERR_OFFLINE_DEPENDENCIES_MISSING` | Required JSON-LD contexts, issuer keys, or revocation entries were not seeded before going offline. |
| `ERR_PUBLIC_KEY_RESOLUTION_FAILED` | The verifier couldn't resolve the referenced verification method (e.g., DID document fetch returns 404). |
| `ERR_EMPTY_VC` | Input string was null/empty or not valid JSON. |
| `ERR_VC_EXPIRED` | `expirationDate`/`validUntil` window is in the past. |
| `VC_REVOKED` | The credential ID matched an entry in the cached revocation list. |


### Seeding caches from a backend service

```ts
import { OrgResolver, SDKCacheManager } from "@mosip/react-inji-verify-sdk";

// Server: generate a bundle once (e.g. during organisation onboarding)
const bundle = await OrgResolver.buildBundleFromId("did:web:issuer.example.com#key-1", [
  "https://www.w3.org/ns/credentials/v2",
  "https://w3id.org/security/v2"
]);

// Client / Worker: prime caches before going offline
await SDKCacheManager.primeFromServer(bundle);
```

Use `SDKCacheManager.syncFromServer(bundle, organizationId)` when you need to replace data atomically (for example after rotating issuer keys). Cached contexts live in IndexedDB, so subsequent verifications never hit the network.

### Revocation management helpers

```ts
import {
  replaceRevokedVCsForOrganization,
  replacePublicKeysForOrganization,
  isVCRevoked
} from "@mosip/react-inji-verify-sdk";

await replacePublicKeysForOrganization("org-123", keyList);
await replaceRevokedVCsForOrganization("org-123", revokedEntries);

if (await isVCRevoked("urn:uuid:credential-id")) {
  // surface a domain-specific message to the operator
}
```


```

## Compatibility

- ✅ React 19 (matching peer dependency)
- ✅ Modern evergreen browsers (Chromium, Firefox, Safari)
- ⚠️ Server-side rendering (Next.js, Remix) requires client-only guards around scanner components


## Project structure

```
src/
├── components/
│   └── qrcode-verification/         # Camera + upload scanner UI
├── services/
│   └── offline-verifier/            # Core verification logic, caches, public key resolvers
├── utils/                           # QR decoding, offline document loader, constants
└── index.ts                         # Barrel exports for components + services
```

Unit tests live under `__tests__/` and mirror the component/service layout.

## References & further reading

- MOSIP [`vc-verifier`](https://github.com/mosip/vc-verifier) – original Kotlin implementation
- MOSIP [`inji-verify-sdk`](https://github.com/mosip/inji-verify/tree/master/inji-verify-sdk)
- [W3C Verifiable Credentials Data Model 1.1](https://www.w3.org/TR/vc-data-model-1.1/)
- [W3C Verifiable Credentials Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/)

