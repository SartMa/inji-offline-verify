# Decode_Mosip_Verify
# Install 
pnpm install

# Run Frontend
## Dev Mode
npx nx dev worker-pwa   
## Prod Mode
pnpm nx build worker-pwa
pnpm nx preview worker-pwa


# Backend

pnpm nx serve server
## Organization Registration with Email OTP (Backend)
The organization admin registration is now a 2-step OTP flow:

1. Request Registration (send OTP)
	 POST /api/auth/register/
	 Body:
	 {
		 "org_name": "AcmeOrg",
		 "admin_username": "acmeadmin",
		 "admin_password": "StrongPass123",
		 "admin_email": "admin@example.com"
	 }
	 Response:
	 {
		 "pending_id": "<uuid>",
		 "org_name": "AcmeOrg",
		 "admin_username": "acmeadmin",
		 "admin_email": "admin@example.com",
		 "expires_at": "...",
		 "debug_otp": "123456"   # only shown in DEBUG/console email
	 }

2. Confirm OTP
	 POST /api/auth/register/confirm/
	 Body:
	 {
		 "pending_id": "<uuid from step 1>",
		 "otp_code": "123456"
	 }
	 Response:
	 {
		 "organization": {"id": "...", "name": "AcmeOrg"},
		 "user": {"username": "acmeadmin", "email": "admin@example.com"},
		 "token": "<auth token>"
	 }

If OTP is wrong you can retry (max 5 attempts) before needing a new registration request. OTP expires in 10 minutes.

To apply these changes run (inside server/backend directory):
	uv run python manage.py makemigrations api
	uv run python manage.py migrate

Configure a real email backend in production by setting EMAIL_BACKEND and related SMTP settings in environment variables / settings.

### Email Setup
Copy `server/backend/.env.example` to `server/backend/.env` and fill in SMTP values:
```
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.yourprovider.com
EMAIL_PORT=587
EMAIL_HOST_USER=your_user
EMAIL_HOST_PASSWORD=your_password
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=Your App <no-reply@yourdomain.com>
```
If not set, the console backend is used (OTP appears in server logs). Ensure DEBUG=False in production.