# Testing Guide - Inji Offline Verify Platform

This guide provides comprehensive instructions for testing both the frontend and backend components of the Inji Offline Verify Platform.

---

## Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start - Running the Full Application](#quick-start---running-the-full-application)
- [Backend Testing (Python/Django)](#backend-testing-pythondjango)
- [Frontend Testing](#frontend-testing)

---

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- **Docker Desktop** (version 20.10 or later)
- **Docker Compose** (version 2.0 or later)
- **Git** (for cloning the repository)

> **Note:** You don't need Node.js, Python, or any other dependencies installed locally. Docker will handle everything!

---

## Quick Start - Running the Full Application

> **Note:** To run the complete application with frontend and backend services and see the feature and implementation details, please refer to the main [README.md](./README.md) file.
> 
> Full application setup requires building all services (frontend + backend) which takes significantly longer. This guide focuses on **backend testing only** for faster setup.

---

## Backend Testing (Python/Django)

### Prerequisites Setup

Before running tests, clone the repository and configure environment variables:

```bash
# Step 1: Clone the repository
git clone https://github.com/SartMa/inji-offline-verify.git
cd inji-offline-verify
git switch SE_project


# Step 2: Configure environment variables
# On Windows (PowerShell)
Copy-Item .env.example .env

# On macOS/Linux
cp .env.example .env
```

Edit the `.env` file with your configuration:

```env
POSTGRES_DB=inji_verify
POSTGRES_USER=inji_user
POSTGRES_PASSWORD=secure_database_password_here
POSTGRES_PORT=5432

DJANGO_SECRET_KEY=your-super-secret-django-key-minimum-50-characters-long
JWT_SECRET_KEY=your-jwt-secret-key-for-token-signing-minimum-32-chars

# Application settings
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,your-domain.com,backend
BACKEND_PORT=8012

# CORS and CSRF settings for frontend communication
# CORS_ALLOW_ALL_ORIGINS=True
CORS_ALLOWED_ORIGINS=http://localhost:3017,http://localhost:3011
CSRF_TRUSTED_ORIGINS=http://localhost:3017,http://localhost:3011

VITE_API_HOST=http://localhost:8012
VITE_ORGANIZATION_PREFIX=/organization/api
VITE_WORKER_PREFIX=/worker/api
# Optional shared prefix (rarely used)
VITE_SHARED_PREFIX=/api

# Back-compat: some legacy code may still read this; will be ignored by new config
VITE_API_BASE_URL=http://localhost:8000/api

# Port configuration
ORGANIZATION_PORTAL_PORT=3011
WORKER_PWA_PORT=3017

SECURE_SSL_REDIRECT=False

EMAIL_BACKEND=anymail.backends.sendgrid.EmailBackend
DEFAULT_FROM_EMAIL=injiverify@gmail.com
EMAIL_TIMEOUT=30

SENDGRID_API_KEY=your-sendgrid-api-key-here

```

> **Important:** Replace `your-sendgrid-api-key-here` with your actual SendGrid API key. You can get a free API key at [SendGrid](https://sendgrid.com/).

---

### Test Coverage

We use **pytest** for comprehensive backend testing with Django REST Framework integration.

Our backend test suite includes:

- **Authentication Tests** (23 total tests)
  - Email OTP login flow (request code, verify code, expired/consumed codes)
  - Password reset flow (request, confirm, invalid tokens)
  - Worker authentication (login, registration with role checks)
  - Organization registration and login
  - Log synchronization

### Running Backend Tests Only

To run only the backend tests without building the frontend services:
(Make sure Docker Desktop is running)

```bash
# Step 1: Build and start only database and backend services
# This will build the backend Docker image (first time: ~2-3 minutes, subsequent: faster with cache)
docker compose up -d --build database backend

# Step 2: Once backend shows "Application startup complete", run tests
docker compose exec backend pytest

# or run with verbose output
docker compose exec backend pytest -v

# Run with coverage report
docker compose exec backend pytest --cov=backend --cov-report=term-missing

# Run specific test file
docker compose exec backend pytest backend/api/tests/test_auth.py

# Run specific test module
docker compose exec backend pytest backend/worker/tests/

# Run specific test function
docker compose exec backend pytest backend/api/tests/test_auth.py::test_request_email_login_code_success

# Step 4: Stop services when done
docker compose down
```

> **Note:** 
> - First build takes 2-3 minutes. Subsequent builds are faster due to Docker layer caching.
> - Only builds the backend service (PostgreSQL image is pre-built, no frontend builds needed).
> - The backend container automatically runs database migrations on startup.

### Test Structure

```
server/backend/
├── api/tests/
│   ├── test_auth.py           # Email OTP & password reset tests
│   └── test_auth_edges.py     # Edge cases (expired codes, invalid UIDs)
├── worker/tests/
│   ├── test_worker_auth.py    # Worker login & registration tests
│   └── test_sync_logs.py      # Verification log sync tests
└── organization/tests/
    └── test_org_registration.py  # Organization registration flow tests
```

### Understanding Test Results

When you run the tests, you'll see output like this:

![Backend Test Results](docs/images/pytest-results.png)

**Test Results:**
- **23 passed** = All tests successful
- **23 warnings** = Non-critical deprecation notices from dependencies (safe to ignore)

## Frontend Testing

### Test Cases

We provide a comprehensive collection of test cases with sample Verifiable Credentials in various formats and signature types.

**📁 [Testcases Folder](./Testcases/)**

| Category | Description | Path |
|----------|-------------|------|
| **ECDSA** | ES256, ES384, ES256K signatures | [`Testcases/ecdsa/`](./Testcases/ecdsa/) |
| **Ed25519-2018** | Ed25519Signature2018 | [`Testcases/ed25519-2018/`](./Testcases/ed25519-2018/) |
| **Ed25519-2020** | Ed25519Signature2020 (valid/expired/invalid) | [`Testcases/ed25519-2020/`](./Testcases/ed25519-2020/) |
| **RSA 2018** | RsaSignature2018 | [`Testcases/Rsa2018/`](./Testcases/Rsa2018/) |
| **Revocation** | Revoked credentials + StatusList | [`Testcases/Revocation/`](./Testcases/Revocation/) |
| **Verifiable Presentations** | Valid VP examples | [`Testcases/VP/`](./Testcases/VP/) |

### Video Demonstration

Watch our comprehensive video demonstration showing the complete platform functionality including credential verification, online/offline mode, and revocation checking.

**📺 [Watch Demo on YouTube →](https://youtu.be/HOshQ8VpuR8)**

---

## Testing Checklist
### Backend Tests ✅
- [ ] All 23 pytest tests pass
- [ ] No critical errors in logs
- [ ] Database migrations applied successfully

### Frontend Manual Tests ✅
- [ ] Organization registration with email OTP
- [ ] Worker registration by admin
- [ ] QR code scanning (online mode)
- [ ] QR code scanning (offline mode)
- [ ] Valid credential verification
- [ ] Expired credential detection
- [ ] Invalid signature detection
- [ ] Revoked credential detection (with StatusList)
- [ ] Verification log sync to server
- [ ] Dashboard displays logs correctly

### System Integration ✅
- [ ] All Docker services start successfully
- [ ] Frontend can communicate with backend API
- [ ] Database connections work
- [ ] Email sending works (OTP received)

---

## Team Members

- **Bojja Sunhith Reddy** - IMT2023113
- **Harsh Mohta** - IMT2023106
- **C Chandrahas Reddy** - IMT2023037
- **Sartak Maheshwari** - IMT2023014

