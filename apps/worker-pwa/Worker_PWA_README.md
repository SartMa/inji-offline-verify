# Worker PWA

An installable offline-first web app that lets field workers verify credentials, collect evidence, and synchronize results the moment connectivity returns.

---

## Table of contents

1. [Overview](#overview)
2. [Key capabilities](#key-capabilities)
3. [System architecture](#system-architecture)
4. [Offline data & caching](#offline-data--caching)
5. [Background services & PWA behavior](#background-services--pwa-behavior)
6. [Day-to-day commands](#day-to-day-commands)
7. [Directory tour](#directory-tour)
8. [Performance benchmarking](#performance-benchmarking)
9. [Additional resources](#additional-resources)

---

## Overview

The Worker PWA is the primary companion for on-the-ground verifiers. Built with **React 19**, **MUI**, and the `@mosip/react-inji-verify-sdk`, it is engineered to operate without network access after a single authenticated session. Public keys, JSON-LD contexts, and organizational metadata are pre-fetched and stored locally, so verifications, audit logging, and insights stay available in the field.

The application lives inside the `pnpm` + `nx` monorepo alongside the shared SDKs and backend services. It can be launched in a browser or installed to a device home screen for a native-like experience.

---

## Key capabilities

- **Secure login & session bootstrap** – Organization-scoped credentials bring down all cryptographic material in one go (`SignIn.tsx`, `authService.ts`, `AuthContext.tsx`).
- **Offline credential verification** – Scan QR codes, upload credential files, or verify from cached envelopes with the inji verify SDK (`QRScannerModal.tsx`, `FileUploadModal.tsx`, `@mosip/react-inji-verify-sdk`).
- **Fast history & analytics** – IndexedDB-backed storage surfaces verification history, sync status, and daily breakdowns even while offline (`VCStorageContext.tsx`, `Statistics.tsx`).
- **Sync automation** – Background jobs upload pending verification logs as soon as service workers detect network recovery (`SyncControls.tsx`, `syncService.ts`).
- **System status awareness** – Real-time tiles track network reachability, service worker health, cache status, and pending payloads (`SystemStatus.tsx`, `StatusBar.tsx`).
- **Field-ready UX** – Responsive layout, touch-friendly modals, and dark mode support via shared UI components.

---

## System architecture

### 1. Authentication & cache priming

- `SignIn.tsx` collects org, username, and password, then invokes `login()` from the shared auth package.
- On success, the backend responds with organization metadata; `buildServerCacheBundle()` gathers public keys, JSON-LD contexts, and revoked VCs from server endpoints.
- `WorkerCacheService` acts as a bridge to the SDK's cache management system:
  - Calls `SDKCacheManager.primeFromServer()` from `@mosip/react-inji-verify-sdk` to populate the SDK's IndexedDB stores
  - Manages SDK cache operations including `public_keys`, `contexts`, and `revoked_vcs` stores
  - The SDK maintains its own IndexedDB database separate from worker application data
- `AuthContext` persists the session token and exposes `isAuthenticated`, `isLoading`, and `signIn/signOut` hooks across the app.

### 2. Offline verification flow

- `VerificationActions.tsx` provides the main verification entry points with scan and upload cards.
- User interactions launch `QRScannerModal` or `FileUploadModal`, which internally use the `QRCodeVerification` component from `@mosip/react-inji-verify-sdk`.
- The SDK's verification engine uses the primed **document loader** and **DID resolver** to resolve contexts and keys from its IndexedDB stores before attempting network fallback.
- Verification results (success/failure plus metadata) are returned to the UI and pushed to worker application's local persistence via `VCStorageContext`.

### 3. Automatic cache synchronization

- `CacheSyncService` runs continuous background synchronization every **90 seconds** when online:
  - Fetches updated organization data (public keys, JSON-LD contexts, revoked VCs) from server endpoints
  - Detects changes and updates the SDK cache automatically via `WorkerCacheService.primeFromServer()`
  - Ensures offline verification always uses the latest cryptographic material and revocation lists
  - Triggers on network recovery, periodic intervals, and manual sync requests
- This keeps the SDK's IndexedDB stores fresh with organizational updates without user intervention.

### 4. Local logging & synchronization

- `VCStorageContext` is the source of truth for verification logs. It writes to worker's IndexedDB through `dbService.ts` and exposes helpers like `storeVerificationResult`, `syncToServer`, and `getUnsyncedVerifications`.
- Metrics for verification and storage duration are tracked on-device for performance trendlines and displayed in the dashboard.
- Sync triggers fire on three channels:
  - browser `online` event,
  - a 30-second polling interval while online,
  - a manual **Sync Now** control in the UI.
- After successful server upload, `markAsSynced()` updates local records to prevent double sends.

### 5. Observability & diagnostics

- Hybrid log refresh keeps a rolling window of recent results by merging locally captured data with server-side history (`historicalLogsService.ts`).
- Performance logs labeled `[Performance]` surface verification, storage, and hybrid refresh timings, feeding the benchmarking harness.

---

## IndexedDB architecture

The Worker PWA uses two separate IndexedDB databases for different concerns:

```
📁 IndexedDB Storage
├── 🗃️ SDKCache (managed by @mosip/react-inji-verify-sdk)
│   ├── 📋 public_keys
│   │   ├── key_id, key_type, public_key_multibase
│   │   ├── public_key_hex, public_key_jwk, controller
│   │   └── purpose, is_active, organization_id
│   ├── 📋 contexts
│   │   ├── url (JSON-LD context URL)
│   │   └── document (cached context document)
│   └── 📋 revoked_vcs
│       ├── vc_id, issuer, subject
│       ├── reason, revoked_at
│       └── organization_id
│
└── 🗃️ WorkerCache (managed by worker PWA dbService.ts)
    └── 📋 verifications
        ├── sno (auto-increment primary key)
        ├── uuid (unique sync identifier)
        ├── verified_at, verification_status
        ├── vc_hash, credential_subject
        ├── error_message, synced (boolean)
        └── indexes: uuid, verified_at, synced
```

**SDK Cache Management:**
- Controlled entirely by `SDKCacheManager` from `@mosip/react-inji-verify-sdk`
- `WorkerCacheService` acts as a bridge, calling SDK methods like `primeFromServer()`
- Auto-synced every 90 seconds via `CacheSyncService` when online
- Used for offline verification: key resolution, context loading, revocation checks

**Worker Cache Management:**
- Managed locally by `dbService.ts` with direct IndexedDB operations
- Stores verification attempt logs with sync status tracking
- Used for verification history, analytics, and server synchronization

**Additional Storage:**
- `localStorage`: Performance metrics, sync metadata, device ID
- Service Worker caches: App shell, API responses, static assets (via Workbox)

For manual maintenance, debug panes inside the dashboard expose cache priming status, pending sync counts, and allow clearing local and historical data.

---

## Background services & PWA behavior

- **Service worker** (generated via `vite-plugin-pwa`) precaches the app shell and sets up runtime rules:
  - API calls use `NetworkFirst` with a short timeout to fall back to offline cache.
  - Static assets and fonts leverage `CacheFirst` strategies with long retention.
- **Background sync** registers `sync-verifications` so the browser retries log uploads when connectivity stabilizes, even if the PWA is closed.
- **Installability** is enabled through the web manifest (`public/manifest.webmanifest`) with maskable icons and standalone display, making it easy to pin to Android/iOS home screens or desktop.

---

## Day-to-day commands

Run these from the **repository root** so Nx picks up the project graph:

```bash
# Install all workspace dependencies
pnpm install

# Start the Django backend (required for authentication & sync)
pnpm nx serve server

# In a second terminal: launch the Worker PWA in dev mode
pnpm nx dev worker-pwa

# Production build / preview
pnpm nx build worker-pwa
```

The PWA is served at [http://localhost:4201](http://localhost:4201) in dev mode. Install prompts will appear once you interact with the app for a few minutes.

---

## Directory tour

| Path | Purpose |
| --- | --- |
| `src/App.tsx` | Shell layout, router, and providers |
| `src/context/` | React contexts for auth, cache sync, and verification storage |
| `src/services/` | API clients, cache managers, IndexedDB helpers, background sync utilities |
| `src/components/` | Reusable UI pieces (login modal, sync controls, system status, verification widgets) |
| `src/pages/` | Dashboard, Verification, and Settings routes |
| `src/layout/` | Responsive scaffolding and navigation |
| `src/cache/KeyCacheManager.ts` | Thin wrapper around SDK key storage |
| `public/` | Manifest, icons, and fallback assets used by the service worker |
| `performance_benchmarking/` | Scripts, configs, and run artifacts for automated benchmarking |
| `vite.config.ts` | PWA build, proxy, and caching strategies |

---


## Performance benchmarking

Automated Playwright harnesses stress-test verification, storage, and hybrid refresh flows.

```bash
# Install browsers once
pnpm --filter worker-pwa exec playwright install chromium

# Collect a benchmark run (uses scripts/benchmark-config.json)
pnpm --filter worker-pwa exec node performance_benchmarking/scripts/collect-benchmark.js performance_benchmarking/scripts/benchmark-config.json
```

- Outputs land in `performance_benchmarking/docs/run-snapshots/` with timestamps and summary JSON.
- Recent campaign analysis and ASCII charts live in [`performance_benchmarking/docs/performance-benchmark-2025-09-27.md`](./performance_benchmarking/docs/performance-benchmark-2025-09-27.md).
- Override workload via environment variables, for example `ITERATIONS=2000` to replay the full soak test.

---

## Additional resources

- [`packages/inji-verify-sdk`](../../packages/inji-verify-sdk/README-OFFLINE.md) – deeper dive into the verification SDK powering this app.
- [`server/README.md`](../../server/README.md) – backend APIs consumed during login and sync.
- [`apps/organization-portal`](../organization-portal/README.md) – companion portal used by supervisors and administrators.



