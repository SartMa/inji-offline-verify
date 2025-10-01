# StatusList Credential Implementation

This document outlines the changes made to implement BitstringStatusList credential support, replacing the previous individual revoked VC approach.

## Changes Made

### Backend Changes

#### 1. Models (`server/backend/organization/models.py`)
- **Replaced** `RevokedVC` model with `StatusListCredential` model
- **New fields**:
  - `status_list_id`: The credential ID of the StatusList credential
  - `issuer`: The DID of the credential issuer
  - `status_purpose`: Purpose of the status (e.g., "revocation", "suspension")
  - `encoded_list`: Base64 encoded compressed bitstring
  - `status_list_url`: URL where the status list can be fetched
  - `credential_subject_id`: ID of the credentialSubject
  - `issuance_date`: When the status list credential was issued
  - `expiration_date`: When the credential expires (optional)
  - `full_credential`: Complete StatusList credential JSON
  - `proof`: Proof section of the credential

#### 2. Serializers (`server/backend/organization/serializers.py`)
- **Replaced** `RevokedVCSerializer` with `StatusListCredentialSerializer`
- **Replaced** `RevokedVCUpsertSerializer` with `StatusListCredentialUpsertSerializer`
- **Enhanced validation** to ensure proper BitstringStatusListCredential format
- **Added support** for upsert operations (create or update existing credentials)

#### 3. Views (`server/backend/organization/views.py`)
- **Replaced** `OrganizationRevokedVCsView` with `OrganizationStatusListCredentialsView`
- **Replaced** `OrganizationRevokedVCUpsertView` with `OrganizationStatusListCredentialUpsertView`
- **Replaced** `OrganizationRevokedVCDetailView` with `OrganizationStatusListCredentialDetailView`
- **Updated** API endpoints to handle StatusList credentials

#### 4. URLs (`server/backend/organization/urls.py`)
- **Updated** endpoints:
  - `/api/status-list-credentials/` - List all StatusList credentials for an organization
  - `/api/status-list-credentials/upsert/` - Create or update a StatusList credential
  - `/api/status-list-credentials/<status_list_id>/` - Delete a specific StatusList credential

#### 5. Database Migration
- **Created** migration `0004_statuslistcredential_replace_revokedvc.py`
- **Removes** old `RevokedVC` table
- **Creates** new `StatusListCredential` table with proper indexes and constraints

### Frontend Changes

#### 1. Component Updates (`apps/organization-portal/src/pages/AddRevokedVC/AddRevokedVC.tsx`)
- **Renamed** component to `AddStatusListCredential`
- **Updated** form to accept BitstringStatusList credentials
- **Enhanced validation** for StatusList credential format
- **Updated** UI text and messaging
- **Removed** reason field (not applicable for StatusList credentials)
- **Updated** API endpoint calls

## StatusList Credential Format

The system now expects credentials in the following format:

```json
{
  "@context": [
    "https://www.w3.org/2018/credentials/v1",
    "https://w3id.org/security/suites/ed25519-2020/v1",
    "https://www.w3.org/ns/credentials/status/v1"
  ],
  "id": "https://example.com/status/status-list-credential.json",
  "type": [
    "VerifiableCredential",
    "BitstringStatusListCredential"
  ],
  "issuer": "did:web:example.com",
  "issuanceDate": "2025-09-30T10:03:22.575Z",
  "credentialSubject": {
    "id": "https://example.com/status/status-list-credential.json#list",
    "type": "BitstringStatusList",
    "statusPurpose": "revocation",
    "encodedList": "uH4sIAAAAAAAACu3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAIC3AYbSVKsAQAAA"
  },
  "proof": {
    "type": "Ed25519Signature2020",
    "created": "2025-09-30T10:03:22Z",
    "verificationMethod": "did:web:example.com#key-ed25519-1",
    "proofPurpose": "assertionMethod",
    "proofValue": "..."
  }
}
```

## Validation Rules

1. **Required fields**:
   - `id`: StatusList credential ID
   - `type`: Must include "BitstringStatusListCredential"
   - `issuer`: Issuer DID
   - `issuanceDate`: ISO 8601 date format
   - `credentialSubject.id`: Subject ID
   - `credentialSubject.encodedList`: Base64 encoded bitstring

2. **Optional fields**:
   - `expirationDate`: ISO 8601 date format
   - `proof`: Credential proof

## Migration Instructions

1. **Run the migration**:
   ```bash
   cd server/backend
   python manage.py migrate organization
   ```

2. **Update any existing code** that references `RevokedVC` to use `StatusListCredential`

3. **Test the new API endpoints** with StatusList credentials

## Benefits of StatusList Implementation

1. **Efficiency**: Single credential can represent revocation status for many credentials
2. **Standards Compliance**: Follows W3C BitstringStatusList specification
3. **Scalability**: More efficient than storing individual revoked credentials
4. **Compression**: Bitstring encoding provides compact representation
5. **Privacy**: Status checking doesn't reveal which specific credential is being checked

## API Changes Summary

| Old Endpoint | New Endpoint | Purpose |
|-------------|-------------|---------|
| `/api/revoked-vcs/` | `/api/status-list-credentials/` | List credentials |
| `/api/revoked-vcs/upsert/` | `/api/status-list-credentials/upsert/` | Create/Update |
| `/api/revoked-vcs/<vc_id>/` | `/api/status-list-credentials/<status_list_id>/` | Delete |

## Breaking Changes

- **API endpoints** have changed
- **Database schema** has changed (migration required)
- **Frontend component** expects different data format
- **Validation logic** has been updated for StatusList format