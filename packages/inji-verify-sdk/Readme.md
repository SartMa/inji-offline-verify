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
- **Offline verifier core** – Validates LDP VCs, MSO mDocs, and verifiable presentations with Ed25519, RSA, ES256K, and COSE signature suites.
- **Revocation & cache services** – Seed and synchronise issuer keys, JSON-LD contexts, and revoked credential lists with a consistent bundle contract.
- **Extensible public key resolution** – `did:web`, `did:key`, `did:jwk`, and HTTPS key endpoints are supported out of the box.
- **Developer ergonomics** – Typed APIs, isolated services, Jest + Testing Library harnesses, and webpack + TypeScript build pipeline.


## Supported credential formats

| Credential format | Signature suites implemented | Offline support | Testing status |
| --- | --- | --- | --- |
| `ldp_vc` | `Ed25519Signature2018`, `Ed25519Signature2020`, `EcdsaSecp256k1Signature2019`, `RsaSignature2018*` | Fully offline once JSON-LD contexts and verification methods are cached. | Actively exercised in worker/PWA flows. |
| `mso_mdoc` | COSE `ES256` (COSE_Sign1) validity window checks | Works offline when COSE payload is provided; signature verification parity still under review. | Ported from Kotlin; **manual production testing pending**. |
| Verifiable Presentation | `Ed25519Signature2020` | Requires cached contexts and keys. Fails gracefully with `ERR_OFFLINE_DEPENDENCIES_MISSING` when prerequisites are absent. | Used in wallet integration smoke tests. |

*Detached JWS (`b64=false`, `crit:["b64"]`); supports `RS256` / `PS256` and offline canonicalisation via `https://w3id.org/security/v2`.

The TypeScript implementation mirrors MOSIP's Kotlin verifier while adding IndexedDB caching, granular error mapping, and optional online fallbacks for missing artefacts.

## SDK surface

### QRCodeVerification component

`QRCodeVerification` handles camera capture, file uploads (`png`, `jpeg`, `jpg`, `pdf`), and throttled decoding via `zxing-wasm`. The component routes decoded payloads to the offline verifier and exposes a single `onVerificationResult` callback to keep consuming applications simple.

### Offline verification engine

Direct imports from `src/index.ts` expose the same primitives used internally:

- `CredentialsVerifier` – validates a single verifiable credential for a given `CredentialFormat`.
- `PresentationVerifier` – verifies a VP's proof and delegates each embedded VC to `CredentialsVerifier`.
- `CredentialFormat` helpers – narrows string inputs to supported formats.
- `VerificationResult`, `PresentationVerificationResult`, `VCResult` – strongly typed result objects.
- `PublicKeyService` – resolves keys via cached bundles or live DID/HTTPS lookups.

### Cache and revocation helpers

- `SDKCacheManager` – hydrates IndexedDB with keys, JSON-LD contexts, and revoked credential entries from a backend-supplied bundle.
- `OrgResolver` – builds cache bundles from a VC or issuer DID on the server side.
- `CacheHelper` utilities – read/write helpers for contexts, keys, and revocation entries, including `replaceRevokedVCsForOrganization` and `isVCRevoked`.

Use these utilities to guarantee that kiosks, PWAs, or service workers have everything they need for offline validation before a presentation begins.


## Installation

```bash
# with pnpm (recommended when working inside the monorepo)
pnpm add @mosip/react-inji-verify-sdk

# or via npm
npm install @mosip/react-inji-verify-sdk

# or via yarn
yarn add @mosip/react-inji-verify-sdk
```

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

## Architecture overview

1. **Decode intake** – `QRCodeVerification` uses `zxing-wasm` to decode camera frames or uploaded files. The component throttles frames and automatically falls back to upload when camera access fails.
2. **Format detection** – Decoded payloads are inspected to distinguish stand-alone VCs from Verifiable Presentations. Presentations are delegated to `PresentationVerifier` which, in turn, invokes `CredentialsVerifier` for each embedded VC.
3. **Signature validation** – The verifier selects an algorithm-specific verifier (`Ed25519`, `noble-secp256k1`, or `RsaSignatureVerifier`). JSON-LD canonicalisation is handled by `jsonld-signatures` with an offline document loader.
4. **Cache interaction** – `PublicKeyService` and `OfflineDocumentLoader` retrieve data from IndexedDB. Cache misses while offline trigger explicit error codes so the UI can prompt a sync.
5. **Result modelling** – Verification outcomes are wrapped in `VerificationResult` objects (with payload echoing the credential) to simplify UI rendering and auditing.



## Local development

```bash
# install workspace dependencies
pnpm install

# build the SDK (emits dist/ via webpack + tsc declarations)
pnpm --filter @mosip/react-inji-verify-sdk run build

# run unit tests (Jest + Testing Library)
pnpm --filter @mosip/react-inji-verify-sdk run test
```

The webpack config targets `es2017` modules with CSS extraction enabled, while TypeScript emits declaration files (`dist/**/*.d.ts`) for consumers.

## Publishing to an internal registry

`npm link` / `yarn link` do not work because the package relies on peer dependencies. For local testing we recommend [Verdaccio](https://verdaccio.org/docs/what-is-verdaccio/):

```bash
# bump patch version, build artifacts, and publish to Verdaccio
pnpm --filter @mosip/react-inji-verify-sdk run localPublish
# defaults to http://localhost:4873 – update the script or command to match your registry port
```

## Compatibility

- ✅ React 19 (matching peer dependency)
- ✅ Modern evergreen browsers (Chromium, Firefox, Safari)
- ⚠️ Server-side rendering (Next.js, Remix) requires client-only guards around scanner components
- ❌ React Native and other non-DOM runtimes are not supported out of the box

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

