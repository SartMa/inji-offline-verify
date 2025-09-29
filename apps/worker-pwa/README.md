# Worker PWA

An installable offline-first web app that lets field workers verify credentials, collect evidence, and synchronize results the moment connectivity returns.

---

## Table of contents

1. [Overview](#overview)
2. [Key capabilities](#key-capabilities)
3. [System architecture](#system-architecture)
4. [Offline data & caching](#offline-data--caching)
5. [Background services & PWA behavior](#background-services--pwa-behavior)
6. [Getting started](#getting-started)
7. [Day-to-day commands](#day-to-day-commands)
8. [Performance benchmarking](#performance-benchmarking)
9. [Directory tour](#directory-tour)
10. [Troubleshooting & tips](#troubleshooting--tips)
11. [Additional resources](#additional-resources)

---

## Overview

The Worker PWA is the primary companion for on-the-ground verifiers. Built with **React 19**, **MUI**, and the `@mosip/react-inji-verify-sdk`, it is engineered to operate without network access after a single authenticated session. Public keys, JSON-LD contexts, and organizational metadata are pre-fetched and stored locally, so verifications, audit logging, and insights stay available in the field.

The application lives inside the `pnpm` + `nx` monorepo alongside the shared SDKs and backend services. It can be launched in a browser or installed to a device home screen for a native-like experience.

---

## Key capabilities

- **Secure login & session bootstrap** – Organization-scoped credentials bring down all cryptographic material in one go (`SignIn.tsx`, `authService.ts`, `AuthContext.tsx`).
- **Offline credential verification** – Scan QR codes, upload credential files, or verify from cached envelopes with the inji verify SDK (`VerificationActions.tsx`, `OfflineVCTester.tsx`).
- **Fast history & analytics** – IndexedDB-backed storage surfaces verification history, sync status, and daily breakdowns even while offline (`VCStorageContext.tsx`, `Statistics.tsx`).
- **Sync automation** – Background jobs upload pending verification logs as soon as service workers detect network recovery (`SyncControls.tsx`, `syncService.ts`).
- **System status awareness** – Real-time tiles track network reachability, service worker health, cache status, and pending payloads (`SystemStatus.tsx`, `StatusBar.tsx`).
- **Field-ready UX** – Responsive layout, touch-friendly modals, and dark mode support via shared UI components.

---

## System architecture

### 1. Authentication & cache priming

- `SignIn.tsx` collects org, username, and password, then invokes `login()` from the shared auth package.
- On success, the backend responds with organization metadata; `buildServerCacheBundle()` gathers public keys and JSON-LD contexts.
- `WorkerCacheService.primeFromServer()` writes keys into the SDK-managed IndexedDB stores (`public_keys`, `contexts`) to unlock offline verification.
- `AuthContext` persists the session token and exposes `isAuthenticated`, `isLoading`, and `signIn/signOut` hooks across the app.

### 2. Offline verification flow

- Dashboard entry points (`VerificationActions.tsx`, `QRVerificationWrapper.tsx`) call into the `@mosip/react-inji-verify-sdk`.
- The SDK uses the primed **document loader** and **DID resolver** to resolve contexts and keys from IndexedDB before attempting the network.
- Verification results (success/failure plus metadata) are returned to the UI and pushed to local persistence.

### 3. Local logging & synchronization

- `VCStorageContext` is the source of truth for verification logs. It writes to IndexedDB through `dbService.ts` and exposes helpers like `storeVerificationResult`, `syncToServer`, and `getUnsyncedVerifications`.
- Metrics for verification and storage duration are tracked on-device for performance trendlines and displayed in the dashboard.
- Sync triggers fire on three channels:
  - browser `online` event,
  - a 30-second polling interval while online,
  - a manual **Sync Now** control in the UI.
- After successful server upload, `markAsSynced()` updates local records to prevent double sends.

### 4. Observability & diagnostics

- Hybrid log refresh keeps a rolling window of recent results by merging locally captured data with server-side history (`historicalLogsService.ts`).
- Performance logs labeled `[Performance]` surface verification, storage, and hybrid refresh timings, feeding the benchmarking harness.

---

## Offline data & caching

| Store / cache | Backing tech | Contents | Populated by |
| --- | --- | --- | --- |
| `public_keys` | IndexedDB (SDK) | Issuer verification keys per controller | `WorkerCacheService.primeFromServer` |
| `contexts` | IndexedDB (SDK) | JSON-LD contexts required by credentials | `WorkerCacheService` & SDK document loader |
| `verification_logs` | IndexedDB (`dbService.ts`) | Per-attempt record with status, hash, timestamps | `VCStorageContext.storeVerificationResult` |
| `historicalStats` & duration caches | `localStorage` | Aggregated metrics for charts and benchmarking | `VCStorageContext` utilities |
| Static assets & API responses | Service worker caches | App shell, Google fonts, `/organization/api`, `/worker/api`, `/api` payloads | Workbox runtime caching (see `vite.config.ts`) |

For manual maintenance, debug panes inside the dashboard expose cache priming status, pending sync counts, and allow clearing local and historical data.

---

## Background services & PWA behavior

- **Service worker** (generated via `vite-plugin-pwa`) precaches the app shell and sets up runtime rules:
  - API calls use `NetworkFirst` with a short timeout to fall back to offline cache.
  - Static assets and fonts leverage `CacheFirst` strategies with long retention.
- **Background sync** registers `sync-verifications` so the browser retries log uploads when connectivity stabilizes, even if the PWA is closed.
- **Installability** is enabled through the web manifest (`public/manifest.webmanifest`) with maskable icons and standalone display, making it easy to pin to Android/iOS home screens or desktop.

---

## Getting started

### Prerequisites

- Node.js 20+
- `pnpm` (workspace uses the [pnpm-lock.yaml](../../pnpm-lock.yaml))
- Access to the backend server (default is `http://localhost:8000`)

### Environment configuration

Common overrides for local development can be placed in a root-level `.env` file:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_HOST` | `http://localhost:8000` | Base URL for backend endpoints |
| `VITE_ORGANIZATION_PREFIX` | `/organization/api` | Proxy prefix for organization endpoints |
| `VITE_WORKER_PREFIX` | `/worker/api` | Proxy prefix for worker endpoints |
| `VITE_SHARED_PREFIX` | `/api` | Shared API prefix |
| `WORKER_PWA_PORT` | `3000` | Dev server port (proxy points back to backend) |

Credentials for a seeded development org: `sunsun / 12345678` under **AcmeCorp**.

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
pnpm nx preview worker-pwa

# ESLint / type checks
pnpm nx lint worker-pwa

# Optional: run only the worker-pwa scripts via filters
pnpm --filter worker-pwa run build
pnpm --filter worker-pwa run lint
```

The PWA is served at [http://localhost:4201](http://localhost:4201) in dev mode. Install prompts will appear once you interact with the app for a few minutes.

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

## Troubleshooting & tips

- **Cannot log in?** Ensure the backend is running and reachable at the URL defined by `VITE_API_HOST`. Browser devtools will show proxied requests hitting `/worker/api/login/`.
- **Priming failures** surface as console warnings from `WorkerCacheService`. Re-run login once connectivity is stable; the SDK will retry the downloads.
- **No offline history** usually means IndexedDB was cleared or blocked. Check browser privacy settings and the storage quota in `chrome://inspect/#service-workers`.
- **Background sync unavailable** on Safari/iOS older than 17.4 – the app still works, but manual sync is required.
- **Need a clean slate?** Use the dashboard controls or DevTools > Application > Storage to clear local caches before re-authenticating.

---

## Additional resources

- [`packages/inji-verify-sdk`](../../packages/inji-verify-sdk/README-OFFLINE.md) – deeper dive into the verification SDK powering this app.
- [`server/README.md`](../../server/README.md) – backend APIs consumed during login and sync.
- [`apps/organization-portal`](../organization-portal/README.md) – companion portal used by supervisors and administrators.
- [OPENID4VP Offline Implementation notes](../../OPENID4VP_OFFLINE_IMPLEMENTATION.md) – design rationale for the offline verification stack.

For questions or improvements, open an issue or ping the `#inji-offline` channel.
