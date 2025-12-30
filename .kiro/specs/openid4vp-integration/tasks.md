# Implementation Plan: OpenID4VP Integration

## Overview

This implementation plan breaks down the OpenID4VP integration into discrete coding tasks that build incrementally. The implementation spans both the Django backend (Python) and React frontend (TypeScript), integrating with the existing Inji Offline Verify Platform architecture.

## Tasks

- [x] 1. Set up OpenID4VP backend foundation
  - Create Django app structure for OpenID4VP endpoints
  - Set up database models for session management
  - Configure URL routing for OpenID4VP endpoints
  - _Requirements: 6.1, 6.2_

- [ ]* 1.1 Write property test for session ID generation
  - **Property 1: Session Generation and Security**
  - **Validates: Requirements 1.1, 1.4, 6.1**

- [x] 2. Implement session management service
  - [x] 2.1 Create OpenID4VPSession model and migrations
    - Implement session model with UUID primary key, organization FK, and status tracking
    - Create database migration for the new model
    - _Requirements: 6.1, 6.2_

  - [x] 2.2 Implement OpenID4VPSessionService class
    - Write session creation, retrieval, and status update methods
    - Implement session expiration and cleanup logic
    - _Requirements: 6.1, 6.2, 6.3, 6.5_

  - [ ]* 2.3 Write property test for session expiration
    - **Property 3: Configurable Session Expiration**
    - **Validates: Requirements 1.5, 6.3, 6.5**

- [x] 3. Implement presentation definition management
  - [x] 3.1 Create PresentationDefinitionService class
    - Implement presentation definition generation based on credential types
    - Add support for input descriptors and credential format specifications
    - Include issuer constraints when configured
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Create presentation definition configuration
    - Define presentation definitions for MOSIP_ID, HEALTH_INSURANCE, LAND_REGISTRY
    - Configure JSON structure with input descriptors and constraints
    - _Requirements: 3.1, 3.2, 3.3_

  - [ ]* 3.3 Write property test for presentation definition generation
    - **Property 5: Presentation Definition Generation**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [x] 4. Implement OpenID4VP API endpoints
  - [x] 4.1 Create session creation endpoint
    - Implement POST /api/openid4vp/sessions/ endpoint
    - Generate session and return authorization request URI
    - _Requirements: 2.1, 6.1_

  - [x] 4.2 Create presentation definition endpoint
    - Implement GET /api/openid4vp/presentation-definition/{session_id}/ endpoint
    - Return presentation definition for valid sessions
    - _Requirements: 2.1, 3.5_

  - [x] 4.3 Create presentation submission endpoint
    - Implement POST /api/openid4vp/presentation/{session_id}/ endpoint
    - Accept and queue presentations for verification
    - _Requirements: 2.2_

  - [x] 4.4 Create status polling endpoint
    - Implement GET /api/openid4vp/status/{session_id}/ endpoint
    - Return current verification status and results
    - _Requirements: 2.3_

  - [ ]* 4.5 Write property test for endpoint validation
    - **Property 4: OpenID4VP Endpoint Validation**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

- [ ] 5. Integrate presentation verification logic
  - [ ] 5.1 Create OpenID4VPVerificationService class
    - Integrate with existing PresentationVerifier from SDK
    - Implement signature validation for presentations and credentials
    - Add revocation status checking
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 5.2 Implement presentation-definition matching validation
    - Validate submitted presentations against requested definitions
    - Ensure all required credentials and fields are present
    - _Requirements: 4.4_

  - [ ]* 5.3 Write property test for presentation verification
    - **Property 6: Comprehensive Presentation Verification**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

- [ ] 6. Implement verification logging integration
  - [ ] 6.1 Extend VerificationLog model
    - Add verification_method field with choices for offline_qr and openid4vp
    - Add openid4vp_session foreign key relationship
    - Create database migration for model changes
    - _Requirements: 8.3_

  - [ ] 6.2 Create VerificationLogService integration
    - Implement method to create verification logs for OpenID4VP results
    - Ensure same data structure as offline verification logs
    - _Requirements: 8.3, 7.4_

  - [ ]* 6.3 Write property test for unified logging
    - **Property 10: Integration Compatibility and Unified Logging**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5**

- [ ] 7. Checkpoint - Backend API complete
  - Ensure all backend tests pass, ask the user if questions arise.

- [ ] 8. Implement Worker PWA OpenID4VP component
  - [ ] 8.1 Create OpenID4VPVerificationComponent
    - Build React component for OpenID4VP verification flow
    - Implement QR code generation using authorization request URI
    - Add session management and state tracking
    - _Requirements: 1.2, 1.3_

  - [ ] 8.2 Implement session polling mechanism
    - Add polling logic to check verification status every 2 seconds
    - Handle result display and polling termination
    - _Requirements: 5.1, 5.2, 5.5_

  - [ ]* 8.3 Write property test for QR code structure
    - **Property 2: QR Code Authorization Request Structure**
    - **Validates: Requirements 1.2, 1.3**

- [ ] 9. Implement result display and error handling
  - [ ] 9.1 Create verification result display component
    - Show verification status (valid/invalid/error)
    - Display detailed credential information
    - _Requirements: 5.3, 5.4_

  - [ ] 9.2 Implement comprehensive error handling
    - Add error messages for communication failures
    - Provide specific failure reasons for verification errors
    - Add offline status indication and retry options
    - _Requirements: 7.1, 7.2, 7.3, 7.5_

  - [ ]* 9.3 Write property test for error handling
    - **Property 9: Comprehensive Error Handling**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

- [ ] 10. Integrate with existing Worker PWA
  - [ ] 10.1 Add OpenID4VP option to VPVerification page
    - Modify existing VPVerification page to include OpenID4VP option
    - Maintain existing offline QR verification functionality
    - _Requirements: 8.1_

  - [ ] 10.2 Update navigation and routing
    - Ensure OpenID4VP verification is accessible from existing navigation
    - Maintain compatibility with existing worker authentication
    - _Requirements: 8.2, 8.4_

  - [ ]* 10.3 Write property test for polling and result display
    - **Property 7: Real-time Polling and Result Display**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.5**

- [ ] 11. Verify organization dashboard integration
  - [ ] 11.1 Test verification log display
    - Verify OpenID4VP logs appear in existing VerificationLogsTable
    - Ensure proper filtering and organization isolation
    - _Requirements: 8.3_

  - [ ] 11.2 Validate dashboard compatibility
    - Ensure existing organization portal features work unchanged
    - Verify statistics and reporting include OpenID4VP verifications
    - _Requirements: 8.4_

- [ ]* 11.3 Write property test for session state management
  - **Property 8: Session State Management**
  - **Validates: Requirements 6.2, 6.4**

- [ ] 12. Implement session cleanup and maintenance
  - [ ] 12.1 Create session cleanup management command
    - Implement Django management command for expired session cleanup
    - Add scheduling configuration for automatic cleanup
    - _Requirements: 6.5_

  - [ ] 12.2 Add session reuse prevention
    - Implement logic to prevent session reuse after successful verification
    - Update session status appropriately after completion
    - _Requirements: 6.4_

- [ ]* 12.3 Write property test for presentation definition round trip
  - **Property 11: Presentation Definition Round Trip**
  - **Validates: Requirements 2.1, 3.5**

- [ ] 13. Final integration testing and validation
  - [ ] 13.1 End-to-end flow testing
    - Test complete OpenID4VP flow from QR generation to result display
    - Verify cross-device functionality with wallet simulation
    - _Requirements: All requirements_

  - [ ] 13.2 Backward compatibility validation
    - Ensure existing offline verification functionality is unchanged
    - Verify organization and worker management features work normally
    - _Requirements: 8.5_

- [ ] 14. Final checkpoint - Complete integration
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation reuses existing authentication, verification, and logging infrastructure