# Technology Stack & Build System

## Build System
- **Monorepo Management**: Nx workspace with pnpm package manager
- **Package Manager**: pnpm@10.15.1 (required for workspace dependencies)
- **Node.js**: Version 18+ required
- **Python**: Version 3.11+ with uv package manager for backend

## Frontend Stack
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Library**: Material-UI (MUI) v7+ with emotion styling
- **PWA**: Vite PWA plugin with Workbox for service worker management
- **State Management**: React Context API for auth and cache synchronization
- **Routing**: React Router DOM v7+

## Backend Stack
- **Framework**: Django 5.2+ with Django REST Framework
- **Database**: PostgreSQL with psycopg3 driver
- **Authentication**: JWT tokens via djangorestframework-simplejwt
- **Email**: SendGrid integration via django-anymail
- **CORS**: django-cors-headers for cross-origin requests
- **Deployment**: Gunicorn WSGI server with WhiteNoise for static files

## Core SDK Dependencies
- **Cryptography**: Digital Bazaar libraries for signature verification
  - `@digitalbazaar/ed25519-signature-2018/2020`
  - `@digitalbazaar/vc` for credential verification
  - `@digitalbazaar/data-integrity` for proof verification
- **Noble Crypto**: `@noble/ed25519`, `@noble/secp256k1`, `@noble/hashes`
- **QR Processing**: `@zxing/browser` and `@zxing/library`
- **Storage**: IndexedDB via `idb` library for offline data persistence
- **JSON-LD**: `jsonld` and `jsonld-signatures` for linked data processing

## Development Commands

### Root Level Commands
```bash
# Install dependencies
pnpm install

# Start worker PWA development
pnpm dev:worker

# Start organization portal development  
pnpm dev:admin

# Build all applications
pnpm build
# or
nx run-many --target=build --all
```

### Docker Development (Recommended)
```bash
# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Build and start all services
docker compose build
docker compose up -d

# View logs
docker compose logs -f api
docker compose logs -f worker-pwa

# Database operations
docker compose exec api python manage.py migrate
docker compose exec api python manage.py createsuperuser
```

### Individual App Commands
```bash
# Worker PWA
cd apps/worker-pwa
pnpm dev          # Development server
pnpm build        # Production build
pnpm preview      # Preview build

# Organization Portal
cd apps/organization-portal  
pnpm dev          # Development server
pnpm build        # Production build
pnpm preview      # Preview build

# Backend
cd server
uv run python manage.py runserver    # Development server
uv run python manage.py migrate      # Run migrations
uv run python manage.py test         # Run tests
```

### Testing Commands
```bash
# Frontend tests (Vitest)
pnpm test

# SDK tests (Jest)
cd packages/inji-verify-sdk
pnpm test

# Backend tests
cd server
uv run python manage.py test
```

## Environment Configuration
- **Frontend**: Vite environment variables (VITE_* prefix)
- **Backend**: Django settings with python-decouple for .env support
- **Docker**: Environment variables defined in .env file
- **Required Variables**: 
  - `DJANGO_SECRET_KEY`, `JWT_SECRET_KEY`
  - `SENDGRID_API_KEY` for email functionality
  - Database connection strings for production

## Performance Considerations
- **SDK Optimization**: Average verification time of 74ms for offline operations
- **Caching Strategy**: IndexedDB for offline credential and key storage
- **Bundle Optimization**: Vite code splitting and tree shaking
- **PWA Features**: Service worker caching for offline functionality