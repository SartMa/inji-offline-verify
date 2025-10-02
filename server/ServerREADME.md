# Django Backend Server

This README provides comprehensive documentation for the Django REST API backend that powers the Inji Offline Verify platform. The backend serves as the central data management and authentication system for organizations and workers.

## Table of Contents

- [Overview](#overview)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Database Models](#database-models)
- [API Structure](#api-structure)
- [Authentication & Authorization](#authentication--authorization)
- [Core Applications](#core-applications)
- [Management Commands](#management-commands)
- [Development Setup](#development-setup)
- [Security Features](#security-features)

---

## Overview

The Django backend is a multi-tenant REST API system designed to support verifiable credential verification operations at enterprise scale. It provides secure data management, user authentication, organizational structure, and synchronization capabilities for both web portals and PWA applications.

**Key Capabilities:**
- Multi-tenant organization management
- JWT-based authentication with refresh tokens
- Verifiable credential metadata storage
- Public key and cryptographic material management
- Revocation list management for offline verification
- Audit logging and verification history
- Email-based authentication for workers

---

## Architecture & Tech Stack

### Project Structure
```
server/
├── .env                           # Environment variables (development)
├── .python-version               # Python version specification
├── .venv/                        # Virtual environment (created by uv/pip)
├── pyproject.toml               # Project dependencies and metadata
├── uv.lock                      # Dependency lock file
├── project.json                 # NX project configuration
├── package-lock.json            # npm lock file (if any JS tooling)
├── README.md                    # Basic server README
└── backend/                     # Django project root
		├── manage.py                # Django management script
		├── db.sqlite3              # SQLite database (development)
		├── backend/                 # Django settings package
		│   ├── __init__.py
		│   ├── settings.py          # Main Django settings
		│   ├── urls.py              # Root URL configuration
		│   ├── wsgi.py              # WSGI application entry point
		│   └── asgi.py              # ASGI application entry point
		├── api/                     # Core API app
		│   ├── __init__.py
		│   ├── admin.py             # Django admin configuration
		│   ├── apps.py              # App configuration
		│   ├── models.py            # VerificationLog model
		│   ├── serializers.py       # DRF serializers
		│   ├── views.py             # API views and endpoints
		│   ├── urls.py              # API URL patterns
		│   ├── tests.py             # Unit tests
		│   ├── migrations/          # Database migrations
		│   │   ├── __init__.py
		│   │   └── 0001_initial.py
		│   └── management/          # Django management commands
		│       ├── __init__.py
		│       └── commands/
		│           ├── __init__.py
		│           └── fetch_jsonld_contexts.py
		├── organization/            # Organization management app
		│   ├── __init__.py
		│   ├── admin.py             # Organization admin interface
		│   ├── apps.py              # App configuration
		│   ├── models.py            # Organization, PublicKey, RevokedVC models
		│   ├── serializers.py       # Organization-specific serializers
		│   ├── views.py             # Organization API views
		│   ├── urls.py              # Organization URL patterns
		│   ├── permissions.py       # Custom permission classes
		│   ├── tests.py             # Organization unit tests
		│   └── migrations/          # Organization migrations
		│       ├── __init__.py
		│       └── 0001_initial.py
		└── worker/                  # Worker management app
				├── __init__.py
				├── admin.py             # Worker admin interface
				├── apps.py              # App configuration
				├── models.py            # OrganizationMember, EmailLoginCode models
				├── serializers.py       # Worker-specific serializers
				├── views.py             # Worker API views
				├── urls.py              # Worker URL patterns
				├── tests.py             # Worker unit tests
				└── migrations/          # Worker migrations
						├── __init__.py
						└── 0001_initial.py
```

### App Responsibilities
- **backend/**: Django project configuration and settings
- **api/**: Core authentication, verification logging, and shared utilities
- **organization/**: Multi-tenant organization management and admin features
- **worker/**: Field worker operations and PWA synchronization

---

### Core Technologies
- **Django 5.2.5** - Modern Python web framework
- **Django REST Framework 3.16.1** - Powerful REST API toolkit
- **PostgreSQL/SQLite** - Database (configurable via DATABASE_URL)
- **Django Allauth 64.1.0** - Authentication and social login
- **SimpleJWT 5.3.1** - JWT token authentication
- **CORS Headers 4.4.0** - Cross-origin resource sharing

### Additional Dependencies
- **python-decouple** - Environment configuration management
- **dj-database-url** - Database URL parsing
- **gunicorn** - WSGI HTTP server for production
- **psycopg** - PostgreSQL adapter
- **requests** - HTTP library for external API calls
- **cryptography** - Cryptographic operations
- **whitenoise** - Static file serving

### Architecture Pattern
- **Multi-App Structure**: Organized into specialized Django apps
- **Multi-Tenant**: Organization-scoped data isolation
- **REST API**: Comprehensive API endpoints for all operations
- **JWT Authentication**: Stateless authentication with refresh tokens
- **Database Abstraction**: PostgreSQL for production, SQLite for development

---

## Database Models

### Core Organization Models (`organization/models.py`)

#### Organization
```python
class Organization(models.Model):
		id = models.UUIDField(primary_key=True)  # UUID primary key
		name = models.CharField(max_length=255, unique=True)
		created_at = models.DateTimeField(auto_now_add=True)
		updated_at = models.DateTimeField(auto_now=True)
```
**Purpose:** Tenant/organization entity that owns all verification data and users.

#### PublicKey
```python
class PublicKey(models.Model):
		id = models.UUIDField(primary_key=True)
		organization = models.ForeignKey(Organization)
		key_id = models.CharField(max_length=500, unique=True)
		key_type = models.CharField(max_length=100)
		public_key_multibase = models.TextField()
		public_key_hex = models.TextField()
		public_key_jwk = models.JSONField()
		controller = models.CharField(max_length=500)
		purpose = models.CharField(default="assertion")
		expires_at = models.DateTimeField()
		revoked_at = models.DateTimeField()
		is_active = models.BooleanField(default=True)
```
**Purpose:** Stores resolved public keys from verifiable credentials for offline verification.

#### RevokedVC
```python
class RevokedVC(models.Model):
		id = models.UUIDField(primary_key=True)
		organization = models.ForeignKey(Organization)
		vc_id = models.CharField(max_length=1000)
		issuer = models.CharField(max_length=500)
		subject = models.CharField(max_length=500)
		reason = models.CharField(max_length=255)
		metadata = models.JSONField()
		revoked_at = models.DateTimeField(auto_now_add=True)
```
**Purpose:** Maintains revocation lists for compromised or invalid credentials.

#### JsonLdContext
```python
class JsonLdContext(models.Model):
		id = models.UUIDField(primary_key=True)
		organization = models.ForeignKey(Organization)
		url = models.URLField(max_length=500)
		document = models.JSONField()
		created_at = models.DateTimeField(auto_now_add=True)
```
**Purpose:** Caches JSON-LD context documents for offline credential processing.

#### PendingOrganizationRegistration
```python
class PendingOrganizationRegistration(models.Model):
		id = models.UUIDField(primary_key=True)
		org_name = models.CharField(max_length=255)
		admin_username = models.CharField(max_length=150)
		admin_email = models.EmailField()
		password_hash = models.CharField(max_length=256)
		otp_code = models.CharField(max_length=12)
		expires_at = models.DateTimeField()
		consumed_at = models.DateTimeField()
```
**Purpose:** Manages two-factor organization registration with email OTP verification.

### Worker Management Models (`worker/models.py`)

#### OrganizationMember
```python
class OrganizationMember(models.Model):
		id = models.UUIDField(primary_key=True)
		user = models.ForeignKey(User)
		organization = models.ForeignKey(Organization)
		role = models.CharField(choices=[("ADMIN", "Admin"), ("USER", "User")])
		full_name = models.CharField(max_length=255)
		phone_number = models.CharField(max_length=32)
		gender = models.CharField(choices=[("M", "Male"), ("F", "Female"), ("O", "Other")])
		dob = models.DateField()
```
**Purpose:** Links Django users to organizations with roles and profile information.

#### EmailLoginCode
```python
class EmailLoginCode(models.Model):
		id = models.UUIDField(primary_key=True)
		user = models.ForeignKey(User)
		code = models.CharField(max_length=12)
		expires_at = models.DateTimeField()
		consumed_at = models.DateTimeField()
```
**Purpose:** Manages one-time email-based login codes for passwordless worker authentication.

### Verification Logging Models (`api/models.py`)

#### VerificationLog
```python
class VerificationLog(models.Model):
		id = models.UUIDField(primary_key=True)
		verification_status = models.CharField(choices=[("SUCCESS", "Success"), ("FAILED", "Failed")])
		verified_at = models.DateTimeField()
		vc_hash = models.CharField(max_length=256)
		credential_subject = models.JSONField()
		error_message = models.TextField()
		organization = models.ForeignKey(Organization)
		verified_by = models.ForeignKey(User)
		synced_at = models.DateTimeField(auto_now_add=True)
```
**Purpose:** Stores verification events synchronized from worker PWA applications.

---

## API Structure

### Authentication Endpoints (`/api/auth/`)
- `POST /api/auth/email/request-code/` - Request email-based login code
- `POST /api/auth/email/verify-code/` - Verify email login code and get JWT
- `POST /api/auth/password-reset/request/` - Request password reset
- `POST /api/auth/password-reset/confirm/` - Confirm password reset
- `POST /api/auth/token/refresh/` - Refresh JWT access token
- `POST /auth/login/` - Standard DRF auth login
- `POST /auth/registration/` - Standard DRF auth registration

### Organization Management (`/organization/api/`)
- `POST /organization/api/register/` - Register new organization
- `POST /organization/api/confirm/` - Confirm organization registration with OTP
- `POST /organization/api/login/` - Organization admin login
- `GET /organization/api/contexts/` - List cached JSON-LD contexts
- `POST /organization/api/contexts/upsert/` - Add/update JSON-LD contexts
- `GET /organization/api/public-keys/` - List organization public keys
- `POST /organization/api/public-keys/upsert/` - Add/update public keys
- `DELETE /organization/api/public-keys/<key_id>/` - Delete specific public key
- `GET /organization/api/revoked-vcs/` - List revoked credentials
- `POST /organization/api/revoked-vcs/upsert/` - Add revoked credential
- `DELETE /organization/api/revoked-vcs/<vc_id>/` - Remove from revocation list

### Worker Management (`/worker/api/`)
- `POST /worker/api/register/` - Register new worker
- `POST /worker/api/login/` - Worker login
- `POST /worker/api/google-login/` - Google OAuth worker login
- `POST /worker/api/sync/` - Sync verification logs from PWA
- `GET /worker/api/me/` - Get current user information
- `GET /worker/api/organizations/<org_id>/users/` - List organization members
- `GET /worker/api/organizations/<org_id>/users/<member_id>/` - Get member details
- `PUT /worker/api/organizations/<org_id>/users/<member_id>/update/` - Update member
- `DELETE /worker/api/organizations/<org_id>/users/<member_id>/delete/` - Delete member
- `GET /worker/api/organizations/<org_id>/logs/` - Get organization verification logs
- `GET /worker/api/organizations/<org_id>/logs/stats/` - Get verification statistics
- `GET /worker/api/logs/<log_id>/` - Get specific log details
- `GET /worker/api/historical-logs/` - Get worker's historical logs

---

## Authentication & Authorization

### JWT Configuration
```python
SIMPLE_JWT = {
		'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),    # 1 hour access
		'REFRESH_TOKEN_LIFETIME': timedelta(days=2),       # 2 days refresh
		'ROTATE_REFRESH_TOKENS': True,                     # Generate new refresh tokens
		'BLACKLIST_AFTER_ROTATION': True,                 # Blacklist old tokens
		'ALGORITHM': 'HS256',
		'AUTH_HEADER_TYPES': ('Bearer',),
}
```

### Permission Classes
- **IsOrganizationAdmin**: Ensures user is admin of their organization
- **IsOrganizationAdminFromMembership**: Validates admin role via membership
- **IsAuthenticated**: Standard Django REST framework authentication

### Multi-Factor Authentication
- **Email OTP**: Organization registration requires email verification
- **Password Reset**: Secure password reset flow with email confirmation

---

## Core Applications

### 1. API App (`api/`)
**Purpose:** Core authentication, logging, and shared functionality
**Key Features:**
- Email-based authentication for workers
- Password reset functionality
- JWT token management
- Verification log storage and retrieval
- Management commands for system maintenance

### 2. Organization App (`organization/`)
**Purpose:** Organization management and admin functionality
**Key Features:**
- Organization registration with OTP verification
- Public key management from VCs
- JSON-LD context caching
- Revocation list management
- Admin-specific API endpoints

### 3. Worker App (`worker/`)
**Purpose:** Field worker management and operations
**Key Features:**
- Worker registration and profile management
- Organization membership management
- Verification log synchronization
- Worker-specific API endpoints

---

## Management Commands

### fetch_jsonld_contexts
```bash
python manage.py fetch_jsonld_contexts --urls <url1> <url2> --timeout 15
```
**Purpose:** Fetches and caches official JSON-LD context documents from web sources.
**Default URLs:**
- `https://www.w3.org/2018/credentials/v1`
- `https://w3id.org/security/v1`
- `https://w3id.org/security/v2`

---

## Development Setup

### Prerequisites
- Python 3.12+
- PostgreSQL (optional, SQLite works for development)
- uv or pip for package management

### Installation
```bash
# Clone and navigate to server directory
cd server

# Install dependencies with uv
uv sync

# Or with pip
pip install -r requirements.txt

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Run migrations
python backend/manage.py migrate

# Create superuser
python backend/manage.py createsuperuser

# Fetch JSON-LD contexts
python backend/manage.py fetch_jsonld_contexts

# Start development server
python backend/manage.py runserver
```

### Environment Configuration (.env)
```env
SECRET_KEY=your-secret-key-here
DEBUG=True
DATABASE_URL=sqlite:///db.sqlite3
# For PostgreSQL: DATABASE_URL=postgresql://user:pass@localhost/dbname

# Email configuration (optional for development)
EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
EMAIL_USE_TLS=True

# Context upsert permission (development only)
ALLOW_CONTEXT_UPSERT_FOR_AUTHENTICATED=True
```

---


## Security Features

### Data Protection
- **UUID Primary Keys**: Prevents ID enumeration attacks
- **Organization Scoping**: All data isolated per organization
- **JWT Blacklisting**: Old tokens invalidated on refresh
- **CORS Configuration**: Controlled cross-origin access
- **CSRF Protection**: Enabled for state-changing operations

### Input Validation
- **Serializer Validation**: Comprehensive input validation via DRF serializers
- **Model Validation**: Database-level constraints and validation
- **Permission Classes**: Role-based access control
- **Rate Limiting**: Protection against brute force attacks (configurable)

### Cryptographic Security
- **Password Hashing**: Django's built-in PBKDF2 password hashing
- **JWT Signing**: HS256 algorithm with secret key
- **Public Key Storage**: Multiple formats (JWK, PEM, multibase, hex)
- **Secure Random**: Cryptographically secure random generation for OTP codes

### Audit & Compliance
- **Verification Logging**: Complete audit trail of all verification activities
- **Timestamp Tracking**: Created/updated timestamps on all models
- **User Attribution**: All actions linked to authenticated users
- **Data Retention**: Configurable data retention policies

### Production Security
- **HTTPS Only**: SSL/TLS encryption for all communications
- **Database Encryption**: Encrypted database connections
- **Environment Secrets**: Sensitive data in environment variables
- **Static File Security**: Secure static file serving with WhiteNoise

This Django backend provides a robust, secure, and scalable foundation for the Inji Offline Verify platform, supporting both web portal administration and PWA worker synchronization with enterprise-grade security and compliance features.