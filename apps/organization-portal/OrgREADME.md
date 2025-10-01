# Organization Portal

This README provides a comprehensive overview of the `organization-portal` application, which is the central administrative interface for the Inji Offline Verify platform.

**Deployed Website:** [Organization Portal](https://inji-offline-verify-org-portal.onrender.com)

## Table of Contents

- [Overview](#overview)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Core Features](#core-features)
- [Component Architecture](#component-architecture)
- [Design System](#design-system)
- [API Integration](#api-integration)
- [Development & Deployment](#development--deployment)
- [Key Metrics & Analytics](#key-metrics--analytics)

---

## Overview

The Organization Portal is a sophisticated React-based web application that serves as the control center for Organization Administrators. It provides a comprehensive dashboard for managing organizational profiles, field workers, verifiable credential configurations, and monitoring verification activities across the entire organization.

Built with modern technologies including React 19, TypeScript, Material-UI (MUI), and a custom theming system, the portal communicates securely with the Django backend to deliver enterprise-grade functionality.

---

## Architecture & Tech Stack

### Frontend Technologies
- **React 19** - Latest React with concurrent features
- **TypeScript** - Type-safe development
- **Material-UI (MUI)** - Component library with custom theming
- **Vite** - Fast build tool and development server
- **React Router** - Client-side routing
- **@mui/x-charts** - Advanced charting components
- **@mui/x-data-grid** - Data tables with advanced features

### Build & Development
- **pnpm** - Package manager (monorepo support)
- **ESLint** - Code linting
- **TypeScript Compiler** - Type checking
- **Vite** - Hot module replacement for development

---

## Core Features

### 1. Authentication & Security
- **Two-Factor Registration**: Complete organization registration with email OTP verification
- **Secure Login System**: JWT-based authentication with automatic token refresh
- **Role-Based Access Control**: Admin-level permissions with secure session management
- **Password Security**: Secure password handling with validation

### 2. Dashboard & Analytics
- **Real-Time Statistics**: Live metrics for organization users and verified VCs
- **Interactive Charts**: Visual representation of verification trends and statistics
- **Organization Overview**: Quick access to key organizational metrics
- **Performance Monitoring**: Track verification activity across all workers

### 3. Worker Management
- **Add Workers**: Simple form-based worker registration system
  - Full name, email, username, password
  - Automatic role assignment and organization association
  - Email validation and duplicate checking
- **Worker Directory**: Comprehensive table displaying all registered workers
  - View worker details, roles, and status
  - Filter and search capabilities
  - User activity tracking (last login, registration date)
  - Active/inactive status management

### 4. Verifiable Credential Onboarding (`Add DID`)
This is one of the most powerful features, simplifying complex cryptographic material registration:

**Functionality:**
- **Intelligent VC Parsing**: Paste any complete Verifiable Credential JSON
- **Automatic Key Extraction**: System identifies and extracts issuer public keys from proof sections
- **Context Resolution**: Automatically fetches and caches all JSON-LD contexts from @context URLs
- **Multi-Format Support**: Handles various VC formats and signature types
- **Batch Processing**: Efficiently processes multiple keys and contexts in a single operation

**Technical Process:**
1. Admin pastes VC JSON into the interface
2. `OrgResolver.buildBundleFromVC()` from the SDK processes the credential
3. System extracts public keys and identifies context URLs
4. Fetches context documents from web sources
5. Stores keys via `POST /organization/api/public-keys/upsert/`
6. Caches contexts via `POST /organization/api/contexts/upsert/`
7. Provides comprehensive feedback on success/failure

### 5. Revocation Management (`Add Revoked VC`)
This critical security feature allows administrators to maintain comprehensive revocation lists for compromised or invalid credentials.

**Core Functionality:**
- **VC Revocation Interface**: Clean, intuitive form for adding revoked credentials
- **JSON VC Processing**: Paste complete VC JSON for automatic parsing and validation
- **Reason Documentation**: Optional field for documenting revocation reasons (compromise, expiration, policy violation)
- **Validation Engine**: Comprehensive validation ensuring proper VC format and required fields (id, issuer)
- **Nested VC Support**: Intelligent handling of VCs embedded under credential keys
- **Duplicate Prevention**: Prevents duplicate entries in revocation lists

**Revocation List Management:**
- **View Revoked VCs**: Complete table view of all revoked credentials in organization
- **Search & Filter**: Advanced filtering by credential ID, issuer, revocation date, or reason
- **Bulk Operations**: Ability to manage multiple revoked credentials simultaneously
- **Export Capabilities**: Export revocation lists for external systems or compliance
- **Audit Trail**: Complete logging of all revocation activities with timestamps and admin attribution

**Security Features:**
- **Access Control**: Only authorized administrators can manage revocation lists
- **Validation Pipeline**: Multi-layer validation before adding to revocation database
- **Secure Storage**: Encrypted storage via `POST /organization/api/revoked-vcs/upsert/`
- **Real-Time Sync**: Immediate propagation to all organization workers for offline verification
- **Backup & Recovery**: Automated backup of revocation lists for disaster recovery

**Integration Points:**
- **Worker Sync**: Automatic synchronization with worker PWA applications
- **Verification Engine**: Real-time checking during credential verification processes
- **Compliance Reporting**: Integration with audit and compliance reporting systems

### 6. Verification Logs & Audit Trail
- **Comprehensive Logging**: Detailed view of all verification activities from field workers
- **Advanced Filtering**: Search and filter logs by date, worker, status, credential type
- **Audit Compliance**: Complete audit trail for organizational compliance
- **Export Capabilities**: Export logs for external analysis and reporting
- **Real-Time Updates**: Live updates as workers sync their verification logs

### 7. Account Management (`My Account`)
The My Account section provides comprehensive administrative tools for managing organizational resources and security settings.

**Profile & Organization Management:**
- **Admin Profile**: View and edit personal administrator details
- **Organization Settings**: Configure organizational preferences and policies
- **Account Security**: Manage password, authentication preferences, and security settings
- **Session Management**: View active sessions and security logs

**Public Key Administration:**
- **Key Registry**: Complete view of all cached public keys in the organization
- **Key Details**: View key metadata, usage statistics, and verification history
- **Key Management**: 
  - Delete unused or compromised public keys
  - Bulk key operations for maintenance
  - Key status tracking (active, deprecated, compromised)
  - Key source tracking (from which VCs they were extracted)
- **Key Validation**: Verify key integrity and cryptographic validity
- **Export Functions**: Export key lists for backup or external system integration

**Revoked VC Administration:**
- **Revocation Registry**: Comprehensive table view of all revoked credentials
- **Advanced Filtering**: Filter by date range, issuer, credential type, revocation reason
- **Revocation Details**: View complete revocation information including:
  - Original credential ID and issuer
  - Revocation timestamp and administrator
  - Revocation reason and additional notes
  - Impact assessment and affected systems
- **List Management**:
  - Remove credentials from revocation lists (if reinstated)
  - Edit revocation reasons and documentation
  - Bulk operations for managing multiple revoked VCs
- **History Tracking**: Complete audit trail of all revocation list changes
- **Export & Reporting**: Export revocation data for compliance and external systems

**Advanced Administrative Tools:**
- **System Diagnostics**: View system health and performance metrics
- **Data Management**: Tools for data cleanup, archival, and maintenance
- **Integration Status**: Monitor connections to backend services and external systems
- **Backup Management**: Configure and monitor organizational data backups

---

## Component Architecture

### 1. Layout System
- **SideMenu**: Collapsible navigation with intelligent menu items
- **AppNavbar**: Top navigation with user context and actions
- **MainGrid**: Dashboard layout with responsive grid system
- **SidebarProvider**: Context-based sidebar state management

### 2. Page Components

#### Dashboard (`Dashboard.tsx`)
- Central hub with statistics and quick actions
- Integration with MUI X components for advanced features
- Custom theme integration with charts and data grids
- Responsive layout for all screen sizes

#### Worker Management
- **AddWorker.tsx**: Worker registration form with validation
- **OrganizationUsersTable.tsx**: Advanced data table with filtering
- **OrganizationUsersTableSimple.tsx**: Simplified view for dashboard

#### VC Management
- **AddDID.tsx**: Sophisticated VC processing interface
- **AddRevokedVC.tsx**: Revocation management with validation

#### Logging
- **VerificationLogsTable.tsx**: Advanced log viewing with search and filter

#### Authentication
- **SignUp.tsx**: Complete organization registration flow
- **SignInPage**: Secure login with JWT handling
- **OTPVerificationDialog.tsx**: Two-factor authentication component

### 3. Service Layer

#### API Services
- **organizationService.ts**: Organization and member management
- **workerService.ts**: Worker registration and management
- **publicKeyService.ts**: Cryptographic key management
- **revokedVCService.ts**: Revocation list management
- **logsService.ts**: Verification log retrieval
- **registrationService.ts**: Organization registration flow
- **profileService.ts**: User profile management

#### Authentication Integration
- **@inji-offline-verify/shared-auth**: Shared authentication package
  - `AuthContext`: Global authentication state
  - `useAuth()`: Authentication hook
  - `authenticatedFetch()`: Secure API requests with automatic token handling

### 4. State Management
- **useCurrentUser**: Current user and organization context
- **useOrganizationUsers**: Worker management state
- **useLogsStats**: Verification statistics
- **SidebarContext**: Navigation state management

---

## Design System

### Theme Integration
- **Custom Material-UI Theme**: Professionally designed theme system
- **Dark/Light Mode**: Automatic theme switching based on system preferences
- **Responsive Design**: Works on various devices without any issue

### Component Customizations
- **Charts**: Custom chart styling with organizational branding
- **Data Grids**: Enhanced table components with sorting and filtering
- **Date Pickers**: Consistent date/time input across the application
- **Tree Views**: Hierarchical data display for complex structures

---

## API Integration

### Backend Endpoints
- **Authentication**: `/api/auth/login/`, `/api/auth/register/`, `/api/auth/register/confirm/`
- **Organization**: `/organization/api/members/`, `/organization/api/public-keys/`, `/organization/api/contexts/`
- **Workers**: `/worker/api/register/`
- **Revocation**: `/organization/api/revoked-vcs/upsert/`
- **Logs**: `/api/logs/` (with pagination and filtering)

### Security Features
- **JWT Authentication**: Secure token-based authentication
- **Automatic Token Refresh**: Seamless session management
- **CORS Handling**: Proper cross-origin request handling
- **Request Validation**: Input validation and sanitization

---

## Development & Deployment

### Development Setup
```bash
# From the root directory of the monorepo
pnpm install
pnpm nx dev organization-portal
```

### Build for Production
```bash
pnpm nx build organization-portal
```

### Development Server
- **URL**: http://localhost:3011
- **Hot Reload**: Automatic refresh on code changes
- **TypeScript**: Real-time type checking
- **ESLint**: Code quality enforcement

### Environment Configuration
- **API Base URL**: Configurable backend endpoint
- **Authentication**: JWT token configuration
- **Theme**: Custom theme and branding options

---

## Key Metrics & Analytics

### Dashboard Statistics
- **Organization Users**: Total member count with trend analysis
- **Total Verified VCs**: Cumulative verification statistics
- **Activity Trends**: 7-day verification trends and patterns
- **Worker Performance**: Individual worker verification metrics

### Operational Insights
- **Real-Time Monitoring**: Live verification activity
- **Audit Compliance**: Complete audit trail maintenance
- **Performance Metrics**: System performance and response times
- **Usage Analytics**: Feature usage and adoption tracking

---



This Organization Portal represents a comprehensive solution for managing verifiable credential verification operations at enterprise scale, providing administrators with all the tools necessary to efficiently manage their organization's verification ecosystem.