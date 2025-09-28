# Inji Worker PWA & Offline Benchmarking

The Worker PWA powers offline credential verification for Inji deployments. This README documents how to run and interpret the automated Playwright benchmark that was recently exercised for **2,000 scripted iterations (1,500 successful samples)**.

---

## Latest performance snapshot (27 Sep 2025)


```plaintext
Performance uplift vs. 2024 industry baselines (░ = ~5%)

Hybrid refresh           | █░░░░░░░░░░░░░░░░░░░░░░ 5%
Verification throughput  | ████████████████████░░░░ 91%
Storage latency          | █████░░░░░░░░░░░░░░░░░░ 26%
```

| Flow | Samples | Inji Avg (ms) | Industry Baseline (ms) | Delta |
| --- | --- | ---: | ---: | --- |
| Hybrid log refresh | 1,500 | **1,138.4** | 1,200 | **5% faster** |
| QR upload verification | 1,500 | **74.3** | 800 | **91% faster** |
| Verification storage | 1,500 | **4.4** | 6 | **26% faster** |

> Full observations, methodology, and campaign history live in [`performance_benchmarking/docs/performance-benchmark-2025-09-27.md`](./performance_benchmarking/docs/performance-benchmark-2025-09-27.md).

### Highlights
- **Cache-aware design**: `OfflineDocumentLoader` preloads schemas/contexts during login, so verification rarely touches the network while baselines assume fresh fetches.
- **Playwright-driven concurrency**: The harness exercises verification back-to-back without user think time, keeping service workers warm and avoiding the cold-start penalties present in traditional benchmarks.
- **IndexedDB batching**: The worker writes verification logs through a single transaction layer, trimming the 5–7 ms baseline down to ~4 ms even under 2,000-iteration pressure.

---

## Running the offline benchmark locally

1. **Install dependencies & browsers**
   ```powershell
   pnpm install
   pnpm --filter worker-pwa exec playwright install chromium
   ```
2. **Start the Worker PWA** (in a separate terminal)
   ```powershell
   pnpm --filter worker-pwa run dev
   ```
3. **Execute the soak test**
   ```powershell
   pnpm --filter worker-pwa exec node performance_benchmarking/scripts/collect-benchmark.js performance_benchmarking/scripts/benchmark-config.json
   ```
   - Override the iteration count at runtime with `ITERATIONS=2000 pnpm --filter ...` if you need the maximum load.
   - Credentials default to `sunsun / 12345678` against the seeded `AcmeCorp` org.
4. **Review outputs**
   - JSON snapshots land in `performance_benchmarking/docs/run-snapshots/` with timestamps.
   - Console output echoes the `[Performance]` logs emitted by the app for verification, storage, and hybrid refresh events.

---

## Interpreting the metrics

| Metric | What it measures | Why it matters |
| --- | --- | --- |
| **Hybrid log refresh** | IndexedDB merge + remote reconciliation right after verification | Drives how quickly analytics dashboards and audit logs stay in sync while offline |
| **QR upload verification** | Signature validation, schema resolution, and revocation checks for a credential | Represents the user-perceived “verification speed” during scanning workflows |
| **Verification storage** | Time taken to persist results locally | Ensures instant UI updates and enables consistent offline history |

- Improvements are computed against 2024 SSI wallet/verifier medians (800 ms verification, 1.2 s reconciliation, 6 ms IndexedDB write).
- Averages exclude max values to focus on sustainable throughput; outliers beyond the 99.5th percentile are dropped before aggregation.

---

## Need a fresh report?

- Adjust `performance_benchmarking/scripts/benchmark-config.json` to point at your QR fixtures and desired iteration count.
- Re-run the command above; commit the JSON snapshot and append highlights to the markdown report.
- Refresh the ASCII chart (or regenerate from your BI tool) so the README always reflects the most recent data; the full report details the baseline sources and methodology.

For deeper analysis (percentiles, error budgets, device class breakdowns), layer the exported JSON into your preferred analytics notebook or dashboarding tool.
