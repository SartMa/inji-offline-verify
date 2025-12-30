# Project Structure & Organization

## Monorepo Layout

```
inji-offline-verify/
├── apps/                           # Frontend applications
│   ├── organization-portal/        # Admin web interface (React + MUI)
│   └── worker-pwa/                 # Field worker PWA (React + PWA)
├── packages/                       # Shared packages
│   ├── inji-verify-sdk/           # Core verification engine
│   ├── shared-auth/               # Authentication utilities
│   ├── shared-types/              # TypeScript definitions
│   └── shared-ui/                 # Common UI components
├── server/                        # Backend services
│   └── backend/                   # Django REST API
├── docs/                          # Documentation and diagrams
├── Testcases/                     # Verification test samples
└── docker-compose.yml             # Container orchestration
```

## Application Structure

### Organization Portal (`apps/organization-portal/`)
- **Purpose**: Administrative interface for organization management
- **Key Directories**:
  - `src/components/` - Reusable UI components
  - `src/pages/` - Route-based page components
  - `src/services/` - API service layers
  - `src/hooks/` - Custom React hooks
  - `src/context/` - React context providers

### Worker PWA (`apps/worker-pwa/`)
- **Purpose**: Field worker credential verification interface
- **Key Directories**:
  - `src/components/` - UI components including QR scanner
  - `src/pages/` - Main application pages (Dashboard, Settings, VPVerification)
  - `src/services/` - Offline sync, cache, and network services
  - `src/context/` - Auth, cache sync, and VC storage contexts
  - `src/cache/` - Key cache management for offline operations
  - `src/utils/` - Helper utilities and verification status handlers

### Shared Packages (`packages/`)

#### Inji Verify SDK (`packages/inji-verify-sdk/`)
- **Core verification engine with offline capabilities**
- `src/services/offline-verifier/` - Main verification logic
- `src/components/` - React components for QR scanning and OpenID4VP
- `src/utils/` - API utilities, constants, and data processing
- `__tests__/` - Comprehensive test suites

#### Shared Packages
- **shared-auth**: JWT authentication, Google Sign-In integration
- **shared-ui**: Common Material-UI components and theming
- **shared-types**: TypeScript type definitions across apps

### Backend Structure (`server/backend/`)
- **Django project with multiple apps**:
  - `api/` - Core API endpoints and verification log models
  - `organization/` - Organization management, public keys, revocation
  - `worker/` - Worker authentication and health endpoints
  - `backend/` - Django settings and configuration

## Naming Conventions

### Files and Directories
- **React Components**: PascalCase (e.g., `QRScannerModal.tsx`)
- **Services**: camelCase with Service suffix (e.g., `authService.ts`)
- **Hooks**: camelCase with use prefix (e.g., `useCurrentUser.ts`)
- **Pages**: PascalCase in dedicated folders (e.g., `Dashboard/Dashboard.tsx`)
- **Utilities**: camelCase (e.g., `verificationStatus.ts`)

### Package Naming
- **Workspace packages**: `@inji-offline-verify/package-name`
- **SDK package**: `@mosip/react-inji-verify-sdk`

## Import Patterns

### Workspace Dependencies
```typescript
// Shared packages
import { AuthContext } from '@inji-offline-verify/shared-auth';
import { CustomButton } from '@inji-offline-verify/shared-ui';

// SDK components
import { QRCodeVerification } from '@mosip/react-inji-verify-sdk';
```

### Internal Imports
```typescript
// Relative imports for same package
import { useCurrentUser } from '../hooks/useCurrentUser';
import { authService } from '../services/authService';

// Absolute imports from src root
import { AuthContext } from 'src/context/AuthContext';
```

## Configuration Files

### Root Level
- `nx.json` - Nx workspace configuration
- `package.json` - Root package with workspace scripts
- `tsconfig.base.json` - Base TypeScript configuration
- `docker-compose.yml` - Multi-service container setup

### Application Level
- Each app has its own `package.json`, `tsconfig.json`, `vite.config.ts`
- Environment configuration via `.env` files
- PWA configuration in `vite.config.ts` with workbox

## Development Workflow

### Adding New Features
1. **Shared functionality** → Add to appropriate package in `packages/`
2. **App-specific features** → Add to respective app in `apps/`
3. **API endpoints** → Add to appropriate Django app in `server/backend/`

### Component Organization
- **Reusable components** → `shared-ui` package
- **App-specific components** → App's `src/components/` directory
- **Page components** → App's `src/pages/` with index files for clean imports

### Service Layer Pattern
- **API services** → Dedicated service files with consistent naming
- **Business logic** → Custom hooks for component logic
- **State management** → React Context for global state