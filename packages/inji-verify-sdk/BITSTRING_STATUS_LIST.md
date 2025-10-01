# Bitstring Status List Credential – End-to-End Guide

[![W3C Specification](https://img.shields.io/badge/W3C-BitstringStatusList-blue.svg)](https://www.w3.org/TR/vc-bitstring-status-list/)
[![Backend](https://img.shields.io/badge/Backend-Django%20REST-informational.svg)]()
[![SDK](https://img.shields.io/badge/Client-Inji%20Verify%20SDK-success.svg)]()

This document explains how the **organization portal**, **backend services**, and the **Inji Verify SDK** work together to issue, version, distribute, and verify [Bitstring Status List Credentials](https://www.w3.org/TR/vc-bitstring-status-list/). It is written as a workflow-first narrative so you can trace every moving part before diving into components.

---

## 1. Workflow: from Organization Update to Offline Verification

### 1.1 Organization pushes a new status list version

1. **Admin submits** a complete status list credential through the portal UI (typically a JSON-LD BitstringStatusList VC).
2. The UI issues a `POST /organization/api/status-list-credentials/upsert/` request containing:
   - target `organization_id`
   - full credential payload (id, issuer, `credentialSubject.statusPurpose`, `encodedList`, proof, etc.)
3. The backend serializer validates the payload:
   - ensures `type` contains `BitstringStatusListCredential`
   - requires immutable `id` (our stable status list identifier)
   - normalizes `statusPurpose` into an array of strings
   - computes `encoded_list_hash = SHA256(credentialSubject.encodedList)`
4. The `StatusListCredential` model either:
   - **creates** a new record (`version = 1`) if none exists, or
   - **detects changes** (hash mismatch) and increments the existing row by calling `bump_version()`.

### 1.2 Automatic version history capture

When `bump_version()` runs, we take a snapshot of the previous version into `StatusListCredentialHistory`. Each historical row stores:

| Field | Purpose |
| ----- | ------- |
| `status_list_current` | Foreign key back to the active record |
| `version` | The archived version number |
| `issuer`, `purposes`, `encoded_list_hash`, `full_credential` | Immutable copy of what was active |
| `archived_at` | When the snapshot was taken |

This design gives us a complete audit trail and unlocks “time travel” queries (e.g., check the list as of a certain timestamp) without complicating the current record.

### 1.3 Organization retrieves current versions & manifest

The portal (or any internal service) can:

| Endpoint | What it returns | When it’s used |
| -------- | ---------------- | --------------- |
| `GET /organization/api/status-list-credentials/?organization_id=…` | Full `StatusListCredential` objects, including `full_credential` | Admin inspection, debugging |
| `GET /organization/api/status-list-credentials/manifest/?organization_id=…` | Lightweight manifest with `{status_list_id, purposes, version, encoded_list_hash, updated_at}` | Worker sync jobs or SDK bootstrap |

Because the manifest carries version + hash, clients can cheaply determine if they need to download a new copy of the encoded list.

### 1.4 Worker / SDK synchronization

1. The Worker App asks the organization backend for a **cache bundle** (keys, contexts, status lists).
2. The bundle feeds into `SDKCacheManager` which writes everything into IndexedDB:
   - `contexts` → JSON-LD cache
   - `publicKeys` → DID key cache
   - `statusListCredentials` → new store keyed by `status_list_id`
3. The SDK keeps normalized metadata per status list:
   ```ts
   {
     status_list_id: string,
     issuer: string,
     purposes: string[],
     version?: number,
     encoded_list_hash?: string,
     updated_at?: string,
     full_credential: any,
     organization_id: string | null,
     cachedAt: number
   }
   ```
4. Future syncs call `replaceStatusListCredentialsForOrganization` which compares manifest entries and replaces stale rows atomically.

### 1.5 Offline verification on the Worker

1. When a VC is scanned, `CredentialsVerifier` orchestrates validation.
2. After signature + schema checks, it calls `RevocationChecker`.
3. `RevocationChecker` extracts the appropriate status entry, identifies the status list URL and index, then asks `StatusListLoader.load(id)`.
4. `StatusListLoader`:
   - first tries IndexedDB (offline path)
   - if absent, fetches from network and persists it for future offline use
   - returns a rich `LoadedStatusListCredential` containing `purposes`, `version`, `encodedListHash`, etc.
5. The checker expands the compressed bitstring, reads the relevant bit, and decides if the credential is revoked/suspended/valid.
6. The result is surfaced in the Worker UI via `VerificationResultModal` with distinct messaging per purpose.


---

## 2. Data Model & Storage Semantics

### 2.1 Current record (`StatusListCredential`)

```python
class StatusListCredential(models.Model):
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    status_list_id = models.CharField(max_length=1000)
    issuer = models.CharField(max_length=500)
    purposes = models.JSONField(default=list)
    version = models.PositiveIntegerField(default=1)
    issuance_date = models.DateTimeField(null=True, blank=True)
    encoded_list_hash = models.CharField(max_length=128, blank=True)
    full_credential = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("organization", "status_list_id")
        indexes = [
            models.Index(fields=["organization"]),
            models.Index(fields=["status_list_id"]),
            models.Index(fields=["issuer"]),
            models.Index(fields=["updated_at"]),
        ]
```

Key points:

- **Stable ID** (`status_list_id`): matches the credential’s `id` so every version shares the same identifier.
- **Purposes array**: stored as JSON to allow multiple values (`revocation`, `suspension`, `refresh`, `message`).
- **Hash**: SHA-256 of the encoded bitstring; prevents redundant version bumps.
- **Version bumping**: only increments when the hash changes.

### 2.2 History record (`StatusListCredentialHistory`)

```python
class StatusListCredentialHistory(models.Model):
    status_list_current = models.ForeignKey(StatusListCredential, related_name="history_entries", on_delete=models.CASCADE)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE)
    status_list_id = models.CharField(max_length=1000)
    issuer = models.CharField(max_length=500, blank=True, default="")
    purposes = models.JSONField(default=list)
    version = models.PositiveIntegerField()
    issuance_date = models.DateTimeField(null=True, blank=True)
    encoded_list_hash = models.CharField(max_length=128, blank=True)
    full_credential = models.JSONField()
    archived_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = (("status_list_current", "version"),)
```

This table ensures every upgrade is traceable. Because we normalise issuer and purposes before insert, the historical copy survives schema changes.


---

## 3. API Surface Area (Organization Service)

| Endpoint | Method | Core payload | Notes |
| -------- | ------ | ------------ | ----- |
| `/organization/api/status-list-credentials/upsert/` | `POST` | `{organization_id, status_list_credential}` | Validates credential, bumps version, returns updated record (*201* if newly created, *200* if updated). |
| `/organization/api/status-list-credentials/` | `GET` | query `organization_id` | Returns full credentials for inspection/backup. |
| `/organization/api/status-list-credentials/manifest/` | `GET` | query `organization_id` | Returns minimal sync manifest for Worker/SDK.

All endpoints require organization admin authentication.


---

## 4. Inji Verify SDK Components

### 4.1 IndexedDB Cache Helpers

- **`CacheHelper.ts`**: exposes `put*` and `replace*` helpers for contexts, public keys, and status lists.
- Adds normalization for purposes, issuer, version, hash so cached data mirrors backend schema.
- Ensures all writes carry a `cachedAt` timestamp for troubleshooting.

### 4.2 `SDKCacheManager`

- `primeFromServer(bundle)` seeds the cache when the Worker installs or refreshes the bundle.
- `syncFromServer(bundle, organizationId)` replaces organization-scoped entries using the latest manifest.
- Both methods now coerce multiple purpose formats into clean arrays and persist `version`, `encoded_list_hash`, `updated_at` fields.

### 4.3 `StatusListLoader`

- Acts as the gateway for status lists during verification.
- Checks IndexedDB first (offline friendly); falls back to network request and stores the downloaded credential.
- Returns a `LoadedStatusListCredential` containing:
  ```ts
  {
    id: string,
    statusPurpose: string | string[],
    purposes: string[],
    encodedList: string,
    raw: any,
    version?: number,
    encodedListHash?: string,
    updatedAt?: string
  }
  ```
- This enrichment lets `RevocationChecker` (and future UI) show which version was used.

### 4.4 `RevocationChecker`

- Locates Bitstring status entries (works with array or single object forms).
- Enforces purpose overlap between the credential entry and the status list credential.
- Converts the compressed bitstring into raw bits and checks the index provided by the VC.
- Emits `RevocationCheckResult` combining validity, chosen purpose, and any advisory messages.


---

## 5. Purpose Semantics & UI Behaviour

| Purpose | Worker interpretation | UI outcome |
| ------- | -------------------- | ---------- |
| `revocation` | Bit = 1 → credential revoked | Red “Revoked” banner with error icon |
| `suspension` | Bit = 1 → temporarily invalid | Red banner with suspension messaging |
| `refresh` | Bit = 1 → advisory only | Green “Verified” status + call-to-action |
| `message` | Bit = 1 → display status message | Green/amber info surface |

When multiple purposes exist, `RevocationChecker` picks the first overlapping purpose between the VC entry and the list. This value is surfaced through the SDK payload so the Worker can tailor copy accordingly.


---

## 6. Sample Artifacts (from `Testcases/Revocation`)

### 6.1 Status List Credential (v1)

> Source: `Testcases/Revocation/StatusList/status-list-credential.json`

```json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://w3id.org/security/suites/ed25519-2020/v1",
    "https://www.w3.org/ns/credentials/status/v1"
  ],
  "id": "https://chandrahas121.github.io/status/status-list-credential.json",
  "type": [
    "VerifiableCredential",
    "BitstringStatusListCredential"
  ],
  "issuer": "did:web:chandrahas121.github.io",
  "issuanceDate": "2025-10-01T12:31:45.639Z",
  "credentialSubject": {
    "id": "https://chandrahas121.github.io/status/status-list-credential.json#list",
    "type": "BitstringStatusList",
    "statusPurpose": "revocation",
    "encodedList": "uH4sIAAAAAAAACu3BIQEAAAACIP-vcKozLEADAAAAAAAAAAAAAAAAAAAAvA0cOP65AEAAAA"
  },
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "2025-10-01T12:31:45Z",
    "verificationMethod": "did:web:chandrahas121.github.io#key-ed25519-1",
    "proofPurpose": "assertionMethod",
    "proofValue": "z3h7gUyXSKusEaFma9gjP9EGyAAU1v2V8FLvXZcuNW7y2MrjQHfP9DrUt6CNPkpvLzVxo1iK8H3jTBUBpNqqbGcU7"
  }
}
```

### 6.2 Revoked Credential Sample

> Source: `Testcases/Revocation/alice-revoked.json`

```json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://w3id.org/security/suites/ed25519-2020/v1",
    "https://www.w3.org/ns/credentials/status/v1"
  ],
  "type": [
    "VerifiableCredential",
    "UniversityDegreeCredential"
  ],
  "issuer": "did:web:chandrahas121.github.io",
  "credentialSubject": {
    "id": "did:example:alice",
    "givenName": "Alice",
    "familyName": "Anderson",
    "credentialStatus": {
      "id": "https://chandrahas121.github.io/status/status-list-credential.json#125",
      "type": "BitstringStatusListEntry",
      "statusPurpose": "revocation",
      "statusListIndex": "125",
      "statusListCredential": "https://chandrahas121.github.io/status/status-list-credential.json"
    }
  },
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "2025-10-01T13:00:00Z",
    "verificationMethod": "did:web:chandrahas121.github.io#key-ed25519-1",
    "proofPurpose": "assertionMethod",
    "proofValue": "26L7pwqR1XgJHVdw2fAqN0xsoE9wXJYfMzxJqp1mYvESzL8d2T0cQbQw7GwC3F59gZyhn2y4RpfsGd7bq3dyJ5yx"
  }
}
```

When this credential is scanned, the Worker resolves `statusListCredential`, pulls the cached encoded list, checks bit 125, and marks it revoked because the bit is set to 1 in the status list VC above.


---

## 8. Operations & Maintenance Checklist

- [ ] Run `python manage.py migrate` whenever the status list schema changes.
- [ ] Populate Worker caches through the admin “Sync Offline Data” action (invokes `SDKCacheManager.syncFromServer`).
- [ ] Monitor the manifest endpoint—`version` and `encoded_list_hash` should change whenever the encoded list changes.
- [ ] Use history records to audit who/when a revocation list changed.
- [ ] Keep DID documents and public keys in sync; status verification depends on valid issuer proofs.


---

## 9. Reference & Further Reading

- [W3C Verifiable Credentials Data Model](https://www.w3.org/TR/vc-data-model/)
- [W3C Bitstring Status List](https://www.w3.org/TR/vc-bitstring-status-list/)
- [MOSIP Inji Verify SDK](https://github.com/mosip/inji-verify)
- [JSON-LD 1.1](https://www.w3.org/TR/json-ld11/)
- [RFC 7515 – JSON Web Signature (JWS)](https://www.rfc-editor.org/rfc/rfc7515)

---
