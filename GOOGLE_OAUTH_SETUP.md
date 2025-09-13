# Google OAuth Setup for Worker Login

This document explains how to set up Google OAuth for worker authentication in the INJI Offline Verify project.

## Backend Setup

### 1. Google Cloud Console Configuration

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API or Identity and Access Management (IAM) API
4. Go to "Credentials" and create an OAuth 2.0 Client ID
5. Configure the OAuth consent screen
6. Add authorized origins:
   - `http://localhost:5174` (for development)
   - `http://127.0.0.1:5174`
   - Your production domain
7. Copy the Client ID

### 2. Environment Configuration

Add the Google Client ID to your environment variables:

```bash
export GOOGLE_OAUTH2_CLIENT_ID="your-google-client-id-here.apps.googleusercontent.com"
```

Or add it to your `.env` file in the server directory:

```
GOOGLE_OAUTH2_CLIENT_ID=your-google-client-id-here.apps.googleusercontent.com
```

### 3. Frontend Configuration

Update the `useGoogleSignIn.ts` hook with your actual Client ID:

```typescript
clientId = 'your-google-client-id-here.apps.googleusercontent.com'
```

## How it Works

### Worker Registration Process

1. **Admin registers worker**: Organization admin must first register the worker with their email address through the regular registration process
2. **Worker uses Google Sign-In**: The worker can then use "Sign in with Google" with the same email address that was registered

### Authentication Flow

1. Worker clicks "Sign in with Google"
2. Google OAuth popup appears
3. Worker authorizes the application
4. Frontend receives access token from Google
5. Frontend sends access token + organization name to `/worker/api/google-login/`
6. Backend verifies the token with Google's API
7. Backend checks if a user with that email exists and is a member of the specified organization
8. If valid, backend returns JWT tokens for authentication

### Security Features

- Email verification through Google's API
- Organization membership validation
- Only pre-registered workers can sign in
- Access tokens are verified against Google's servers

## Testing

### 1. Create Test User

First, create a test user through the admin interface or Django shell:

```python
from django.contrib.auth.models import User
from organization.models import Organization
from worker.models import OrganizationMember

# Create organization
org = Organization.objects.get_or_create(name='Acme Corp1')[0]

# Create user with Google email
user = User.objects.create_user(
    username='testuser',
    email='your-google-account@gmail.com',  # Use your actual Google email
    first_name='Test',
    last_name='User'
)

# Create organization membership
OrganizationMember.objects.create(
    user=user,
    organization=org,
    role='USER',
    full_name='Test User',
    phone_number='+1234567890',
    gender='M'
)
```

### 2. Test Google Sign-In

1. Go to http://localhost:5174
2. Enter the organization name: "Acme Corp1"
3. Click "Sign in with Google"
4. Sign in with the same Google account you used for the test user
5. You should be redirected to the dashboard

## Error Handling

Common error messages:

- `"No worker account found with this email address"`: The email is not registered as a worker
- `"This email is not registered as a worker for this organization"`: The user exists but is not a member of the specified organization
- `"Organization not found"`: The organization name doesn't exist
- `"Invalid Google access token"`: The token verification failed

## Production Considerations

1. **Client ID**: Update the Google Client ID in production
2. **HTTPS**: Ensure your production site uses HTTPS
3. **Domain verification**: Add your production domain to Google Console
4. **Rate limiting**: Consider implementing rate limiting for the OAuth endpoint
5. **Monitoring**: Monitor failed authentication attempts
