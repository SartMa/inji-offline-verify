# Product Overview

## Inji Offline Verify Platform

The Inji Offline Verify Platform is a comprehensive verifiable credential verification solution designed for organizations with field operations where network connectivity is unreliable. Built in alignment with the MOSIP Inji Verify problem statement, it enables cryptographically-assured credential verification both online and offline.

### Core Mission
Enable trusted, cryptographically-assured credential verification anywhere, anytime—even when the network disappears.

### Key Components
- **Organization Portal**: Administrative web interface for supervisors and organization managers
- **Worker PWA**: Field worker Progressive Web App for credential verification with offline capabilities
- **Django Backend**: REST API providing authentication, data persistence, and multi-tenant support
- **Inji Verify SDK**: Core cryptographic verification engine supporting multiple signature suites

### Supported Credential Formats
- **LDP VCs** (Linked Data Proof Verifiable Credentials) with full offline verification
- **Verifiable Presentations** with Ed25519Signature2020 proof verification
- **Multiple Signature Suites**: Ed25519, RSA, ECDSA (Secp256k1, P-256, P-384)

### Architecture Principles
- **Offline-First**: Complete verification capability without internet after initial sync
- **Multi-Tenant**: Secure organization isolation with role-based access control
- **PWA-First Design**: Installable on any device with native app-like experience
- **Cryptographic Assurance**: Industry-standard signature verification and tamper detection
- **Smart Synchronization**: Intelligent background sync when connectivity returns

### Target Users
- **Field Workers**: Use PWA to scan and verify credentials in remote locations
- **Organization Supervisors**: Manage workers, view verification logs, configure trust settings
- **System Administrators**: Deploy and maintain the platform infrastructure