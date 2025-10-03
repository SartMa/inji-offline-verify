# Organization Data Isolation Fix - MyAccount Page

## Problem
When Organization A added a DID/public key through the Add DID page, it was showing up in Organization B's MyAccount page as well. Each organization should only see their own public keys and status list credentials.

## Root Cause

### 1. **Stale Organization ID in localStorage**
When users switched between organizations, the `organizationId` in localStorage wasn't being properly cleared on logout, causing the next user to potentially use the previous organization's ID.

### 2. **Not Using Centralized Organization Context**
The MyAccount page had its own `getOrganizationId()` function that read from localStorage directly, instead of using the centralized `useCurrentUser()` hook which properly fetches and validates the current user's organization.

## Solution

### 1. Enhanced Logout Cleanup (`packages/shared-auth/src/authService.ts`)

Added organization portal specific items to the logout cleanup:

```typescript
export async function clearAllUserData() {
  // Clear localStorage tokens
  clearTokens();
  
  // Clear additional localStorage items
  try {
    // Worker app specific
    localStorage.removeItem('deviceId');
    localStorage.removeItem('historicalStats');
    localStorage.removeItem('historicalLogsDays');
    localStorage.removeItem('historicalLogs.cache');
    localStorage.removeItem('vcMetrics:verificationMs');
    localStorage.removeItem('vcMetrics:storageMs');
    
    // Organization portal specific
    localStorage.removeItem('organizationId');      // ✅ Added
    localStorage.removeItem('organizationName');    // ✅ Added
    localStorage.removeItem('userRole');            // ✅ Added
    
    // Common organization items
    localStorage.removeItem('organization');
    localStorage.removeItem('org_id');
    localStorage.removeItem('current_org_id');
  } catch {}
  
  // Clear IndexedDB databases...
}
```

### 2. Use Centralized Organization Context (`MyAccount.tsx`)

**Before (❌ Problem):**
```tsx
export default function MyAccount() {
  const { organizationName } = useCurrentUser();  // Only used name, not ID!
  
  const getOrganizationId = () => {
    // Reading directly from localStorage - could be stale!
    const orgId = localStorage.getItem('organizationId');
    return orgId || null;
  };
  
  const fetchPublicKeys = async () => {
    const organizationId = getOrganizationId();  // Using stale ID
    const response = await getOrganizationPublicKeys(organizationId || undefined);
    setPublicKeys(response.keys || []);
  };
}
```

**After (✅ Fixed):**
```tsx
export default function MyAccount() {
  const { organizationName, organizationId } = useCurrentUser();  // ✅ Get from hook
  
  const fetchPublicKeys = async () => {
    if (!organizationId) {
      showToast('Organization ID not found. Please log in again.', 'error');
      return;
    }
    const response = await getOrganizationPublicKeys(organizationId);  // ✅ Use from hook
    setPublicKeys(response.keys || []);
  };
  
  useEffect(() => {
    if (organizationId) {  // ✅ Only fetch when org context is ready
      fetchPublicKeys();
      fetchStatusListCredentials();
    }
  }, [organizationId]);  // ✅ Re-fetch if organization changes
}
```

## How It Works Now

### Login Flow:
1. User from **Org A** logs in
2. `useCurrentUser()` hook calls API: `/organization/api/me/`
3. Backend returns user data with `organization: { id: 'org-a-uuid', name: 'Org A' }`
4. Hook stores `organizationId` in localStorage
5. MyAccount page uses `organizationId` from hook
6. API call: `/organization/api/public-keys/?organization_id=org-a-uuid`
7. Backend filters: `PublicKey.objects.filter(organization=org_a)`
8. **Only Org A's keys are returned** ✅

### Logout → Switch Organization Flow:
1. User from **Org A** logs out
2. `clearAllUserData()` removes `organizationId`, `organizationName`, `userRole`
3. LocalStorage is clean ✅
4. User from **Org B** logs in
5. `useCurrentUser()` fetches fresh data from API
6. New `organizationId` = `'org-b-uuid'` stored
7. MyAccount page uses new `organizationId`
8. API call: `/organization/api/public-keys/?organization_id=org-b-uuid`
9. Backend filters: `PublicKey.objects.filter(organization=org_b)`
10. **Only Org B's keys are returned** ✅
11. **Org B does NOT see Org A's data** ✅

## Backend Verification

The backend was already correctly filtering by organization:

```python
# server/backend/organization/views.py
class OrganizationPublicKeysView(APIView):
    def get(self, request, *args, **kwargs):
        requested_org_id = request.query_params.get('organization_id')
        
        # Get user's organization memberships
        members = OrganizationMember.objects.filter(user=request.user)
        member_org_ids = {str(m.organization_id) for m in members}
        
        # Verify user has access to requested organization
        if requested_org_id not in member_org_ids:
            return Response({'detail': 'No access'}, status=403)
        
        # Filter keys by organization
        qs = PublicKey.objects.filter(
            organization=org,      # ✅ Filters by organization
            is_active=True
        )
        
        return Response({'keys': qs.values(...)})
```

## Testing

### Test 1: Single Organization
1. Log in as Org A admin
2. Add a DID/public key
3. Go to MyAccount → should see the added key ✅
4. Refresh page → key should still be visible ✅

### Test 2: Multiple Organizations
1. Log in as Org A admin
2. Add public keys for Org A
3. Note the key IDs/controllers
4. **Log out** ← Important!
5. Log in as Org B admin
6. Go to MyAccount → should see **NO keys** (or only Org B's keys) ✅
7. Add public keys for Org B
8. Should see only Org B's keys ✅
9. **Log out**
10. Log back in as Org A admin
11. Should see only Org A's keys ✅

### Test 3: Browser DevTools Check
```javascript
// Before logout (as Org A):
localStorage.getItem('organizationId')  // "org-a-uuid"

// After logout:
localStorage.getItem('organizationId')  // null ✅

// After login (as Org B):
localStorage.getItem('organizationId')  // "org-b-uuid" ✅
```

## Security Benefits

1. **✅ Data Isolation**: Each organization only sees their own data
2. **✅ No Data Leakage**: Previous organization's data is cleared on logout
3. **✅ Proper Authorization**: Backend validates user has access to requested organization
4. **✅ Fresh Context**: Always fetches current user's organization from API
5. **✅ Clean Sessions**: No stale data across user sessions

## Files Changed

1. **`packages/shared-auth/src/authService.ts`**
   - Enhanced `clearAllUserData()` to clear organization portal localStorage items

2. **`apps/organization-portal/src/pages/MyAccount/MyAccount.tsx`**
   - Use `organizationId` from `useCurrentUser()` hook
   - Removed local `getOrganizationId()` function
   - Added dependency on `organizationId` in useEffect
   - Added null check before fetching data

## Additional Notes

- The same pattern should be applied to other pages that fetch organization-specific data
- Pages like `AddDID.tsx` already have the `getOrganizationId()` function that reads from localStorage
- Consider creating a shared utility in `useCurrentUser()` hook or a context provider for consistency
