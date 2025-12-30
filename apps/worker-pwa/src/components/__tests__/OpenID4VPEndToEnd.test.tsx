/**
 * End-to-end tests for OpenID4VP integration in Worker PWA.
 * Tests the complete flow from QR generation to result display.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import OpenID4VPVerificationComponent from '../OpenID4VPVerificationComponent';
import VPVerification from '../../pages/VPVerification/VPVerification';
import { AuthContext } from '../../context/AuthContext';

// Mock the API utilities
vi.mock('@mosip/react-inji-verify-sdk', () => ({
  createOpenID4VPSession: vi.fn(),
  getOpenID4VPSessionStatus: vi.fn(),
}));

// Mock QR code generation
vi.mock('qrcode', () => ({
  toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,mock-qr-code'),
}));

const mockCreateSession = vi.mocked(await import('@mosip/react-inji-verify-sdk')).createOpenID4VPSession as MockedFunction<any>;
const mockGetSessionStatus = vi.mocked(await import('@mosip/react-inji-verify-sdk')).getOpenID4VPSessionStatus as MockedFunction<any>;

// Mock auth context
const mockAuthContext = {
  user: {
    id: 'user-1',
    username: 'testworker',
    organizationId: 'org-1',
    organizationName: 'Test Organization',
  },
  isAuthenticated: true,
  login: vi.fn(),
  logout: vi.fn(),
  loading: false,
};

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <AuthContext.Provider value={mockAuthContext}>
        {component}
      </AuthContext.Provider>
    </BrowserRouter>
  );
};

describe('OpenID4VP End-to-End Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful session creation
    mockCreateSession.mockResolvedValue({
      session_id: 'test-session-123',
      authorization_request_uri: 'openid4vp://verify?session_id=test-session-123&presentation_definition_uri=http://localhost:8000/api/openid4vp/presentation-definition/test-session-123',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes from now
      status: 'pending',
      presentation_definition_id: 'MOSIP_ID',
    });
  });

  describe('Complete Successful Verification Flow', () => {
    it('should complete the full OpenID4VP verification flow successfully', async () => {
      // Mock polling responses - first pending, then completed
      mockGetSessionStatus
        .mockResolvedValueOnce({
          session_id: 'test-session-123',
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          presentation_definition_id: 'MOSIP_ID',
          is_expired: false,
          time_remaining_seconds: 600,
        })
        .mockResolvedValueOnce({
          session_id: 'test-session-123',
          status: 'completed',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          presentation_definition_id: 'MOSIP_ID',
          is_expired: false,
          time_remaining_seconds: 580,
          verification_result: {
            valid: true,
            credentials: [
              {
                type: 'MOSIPIdentityCredential',
                issuer: 'did:web:mosip.io',
                subject: {
                  fullName: 'John Doe',
                  dateOfBirth: '1990-01-01',
                  nationalId: '123456789',
                },
                verification_status: 'valid',
              },
            ],
            presentation_verification: {
              signature_valid: true,
              matches_definition: true,
            },
          },
        });

      const mockOnComplete = vi.fn();
      const mockOnError = vi.fn();

      renderWithProviders(
        <OpenID4VPVerificationComponent
          presentationDefinitionId="MOSIP_ID"
          onVerificationComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      // Step 1: Initiate verification (QR generation)
      const startButton = screen.getByRole('button', { name: /start openid4vp verification/i });
      fireEvent.click(startButton);

      // Wait for session creation and QR code generation
      await waitFor(() => {
        expect(mockCreateSession).toHaveBeenCalledWith(
          expect.any(String), // API URL
          {
            presentation_definition_id: 'MOSIP_ID',
            expires_in_minutes: 10,
          },
          expect.any(String) // auth token
        );
      });

      // Verify QR code is displayed
      await waitFor(() => {
        expect(screen.getByText(/scan this qr code/i)).toBeInTheDocument();
        expect(screen.getByAltText(/openid4vp qr code/i)).toBeInTheDocument();
      });

      // Verify session info is displayed
      expect(screen.getByText(/session id: test-session-123/i)).toBeInTheDocument();
      expect(screen.getByText(/waiting for wallet response/i)).toBeInTheDocument();

      // Step 2: Polling starts automatically
      await waitFor(() => {
        expect(mockGetSessionStatus).toHaveBeenCalledWith(
          expect.any(String), // API URL
          'test-session-123',
          expect.any(String) // auth token
        );
      }, { timeout: 3000 });

      // Step 3: Wait for verification completion
      await waitFor(() => {
        expect(screen.getByText(/verification completed/i)).toBeInTheDocument();
        expect(screen.getByText(/verification successful/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify credential details are displayed
      expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      expect(screen.getByText(/1990-01-01/i)).toBeInTheDocument();
      expect(screen.getByText(/123456789/i)).toBeInTheDocument();

      // Verify completion callback was called
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledWith(
          expect.objectContaining({
            valid: true,
            credentials: expect.arrayContaining([
              expect.objectContaining({
                type: 'MOSIPIdentityCredential',
                subject: expect.objectContaining({
                  fullName: 'John Doe',
                }),
              }),
            ]),
          })
        );
      });

      // Verify error callback was not called
      expect(mockOnError).not.toHaveBeenCalled();
    });

    it('should handle verification failure gracefully', async () => {
      // Mock polling responses - first pending, then failed
      mockGetSessionStatus
        .mockResolvedValueOnce({
          session_id: 'test-session-123',
          status: 'pending',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          presentation_definition_id: 'MOSIP_ID',
          is_expired: false,
          time_remaining_seconds: 600,
        })
        .mockResolvedValueOnce({
          session_id: 'test-session-123',
          status: 'error',
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          presentation_definition_id: 'MOSIP_ID',
          is_expired: false,
          time_remaining_seconds: 580,
          error_message: 'Invalid signature',
          verification_result: {
            valid: false,
            error: 'Invalid signature',
            details: 'Credential signature verification failed',
            credentials: [],
          },
        });

      const mockOnComplete = vi.fn();
      const mockOnError = vi.fn();

      renderWithProviders(
        <OpenID4VPVerificationComponent
          presentationDefinitionId="MOSIP_ID"
          onVerificationComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      // Start verification
      const startButton = screen.getByRole('button', { name: /start openid4vp verification/i });
      fireEvent.click(startButton);

      // Wait for QR code
      await waitFor(() => {
        expect(screen.getByText(/scan this qr code/i)).toBeInTheDocument();
      });

      // Wait for verification failure
      await waitFor(() => {
        expect(screen.getByText(/verification failed/i)).toBeInTheDocument();
        expect(screen.getByText(/invalid signature/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify error callback was called
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Invalid signature',
          })
        );
      });

      // Verify completion callback was not called
      expect(mockOnComplete).not.toHaveBeenCalled();
    });

    it('should handle session expiration', async () => {
      // Mock session creation with short expiration
      mockCreateSession.mockResolvedValue({
        session_id: 'test-session-123',
        authorization_request_uri: 'openid4vp://verify?session_id=test-session-123',
        expires_at: new Date(Date.now() + 1000).toISOString(), // 1 second from now
        status: 'pending',
        presentation_definition_id: 'MOSIP_ID',
      });

      // Mock polling response showing expiration
      mockGetSessionStatus.mockResolvedValue({
        session_id: 'test-session-123',
        status: 'expired',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() - 1000).toISOString(), // Already expired
        presentation_definition_id: 'MOSIP_ID',
        is_expired: true,
        time_remaining_seconds: 0,
      });

      const mockOnComplete = vi.fn();
      const mockOnError = vi.fn();

      renderWithProviders(
        <OpenID4VPVerificationComponent
          presentationDefinitionId="MOSIP_ID"
          onVerificationComplete={mockOnComplete}
          onError={mockOnError}
        />
      );

      // Start verification
      const startButton = screen.getByRole('button', { name: /start openid4vp verification/i });
      fireEvent.click(startButton);

      // Wait for expiration message
      await waitFor(() => {
        expect(screen.getByText(/session expired/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify restart option is available
      expect(screen.getByRole('button', { name: /start new verification/i })).toBeInTheDocument();

      // Verify error callback was called
      await waitFor(() => {
        expect(mockOnError).toHaveBeenCalledWith(
          expect.objectContaining({
            code: 'expired_session',
          })
        );
      });
    });
  });

  describe('Cross-Device Simulation', () => {
    it('should handle cross-device verification flow', async () => {
      // Mock successful cross-device flow
      mockGetSessionStatus
        .mockResolvedValueOnce({
          session_id: 'test-session-123',
          status: 'pending',
          is_expired: false,
          time_remaining_seconds: 600,
        })
        .mockResolvedValueOnce({
          session_id: 'test-session-123',
          status: 'presentation_received',
          is_expired: false,
          time_remaining_seconds: 580,
        })
        .mockResolvedValueOnce({
          session_id: 'test-session-123',
          status: 'completed',
          is_expired: false,
          time_remaining_seconds: 560,
          verification_result: {
            valid: true,
            credentials: [
              {
                type: 'MOSIPIdentityCredential',
                subject: { fullName: 'Jane Smith' },
              },
            ],
          },
        });

      const mockOnComplete = vi.fn();

      renderWithProviders(
        <OpenID4VPVerificationComponent
          presentationDefinitionId="MOSIP_ID"
          onVerificationComplete={mockOnComplete}
        />
      );

      // Start verification
      const startButton = screen.getByRole('button', { name: /start openid4vp verification/i });
      fireEvent.click(startButton);

      // Wait for QR code
      await waitFor(() => {
        expect(screen.getByText(/scan this qr code/i)).toBeInTheDocument();
      });

      // Wait for presentation received status
      await waitFor(() => {
        expect(screen.getByText(/presentation received/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Wait for final completion
      await waitFor(() => {
        expect(screen.getByText(/verification completed/i)).toBeInTheDocument();
        expect(screen.getByText(/jane smith/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(mockOnComplete).toHaveBeenCalled();
    });
  });

  describe('Integration with VPVerification Page', () => {
    it('should integrate properly with the main VPVerification page', async () => {
      renderWithProviders(<VPVerification />);

      // Verify both verification options are available
      expect(screen.getByText(/offline qr verification/i)).toBeInTheDocument();
      expect(screen.getByText(/openid4vp verification/i)).toBeInTheDocument();

      // Switch to OpenID4VP mode
      const openid4vpTab = screen.getByRole('tab', { name: /openid4vp/i });
      fireEvent.click(openid4vpTab);

      // Verify OpenID4VP component is rendered
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /start openid4vp verification/i })).toBeInTheDocument();
      });

      // Start OpenID4VP verification
      const startButton = screen.getByRole('button', { name: /start openid4vp verification/i });
      fireEvent.click(startButton);

      // Verify QR code generation
      await waitFor(() => {
        expect(mockCreateSession).toHaveBeenCalled();
        expect(screen.getByText(/scan this qr code/i)).toBeInTheDocument();
      });
    });

    it('should maintain offline QR functionality alongside OpenID4VP', async () => {
      renderWithProviders(<VPVerification />);

      // Start with offline QR (default)
      expect(screen.getByText(/offline qr verification/i)).toBeInTheDocument();

      // Switch to OpenID4VP
      const openid4vpTab = screen.getByRole('tab', { name: /openid4vp/i });
      fireEvent.click(openid4vpTab);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /start openid4vp verification/i })).toBeInTheDocument();
      });

      // Switch back to offline QR
      const offlineTab = screen.getByRole('tab', { name: /offline qr/i });
      fireEvent.click(offlineTab);

      // Verify offline QR functionality is still available
      await waitFor(() => {
        expect(screen.getByText(/scan qr code from credential/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network errors gracefully', async () => {
      // Mock network error
      mockCreateSession.mockRejectedValue(new Error('Network error'));

      const mockOnError = vi.fn();

      renderWithProviders(
        <OpenID4VPVerificationComponent
          presentationDefinitionId="MOSIP_ID"
          onVerificationComplete={vi.fn()}
          onError={mockOnError}
        />
      );

      // Try to start verification
      const startButton = screen.getByRole('button', { name: /start openid4vp verification/i });
      fireEvent.click(startButton);

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });

      // Verify retry option is available
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();

      // Verify error callback was called
      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Network error'),
        })
      );
    });

    it('should handle polling errors and provide retry options', async () => {
      // Mock successful session creation but failed polling
      mockGetSessionStatus.mockRejectedValue(new Error('Polling failed'));

      const mockOnError = vi.fn();

      renderWithProviders(
        <OpenID4VPVerificationComponent
          presentationDefinitionId="MOSIP_ID"
          onVerificationComplete={vi.fn()}
          onError={mockOnError}
        />
      );

      // Start verification
      const startButton = screen.getByRole('button', { name: /start openid4vp verification/i });
      fireEvent.click(startButton);

      // Wait for QR code
      await waitFor(() => {
        expect(screen.getByText(/scan this qr code/i)).toBeInTheDocument();
      });

      // Wait for polling error
      await waitFor(() => {
        expect(screen.getByText(/connection error/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      // Verify retry option is available
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe('Session Management', () => {
    it('should prevent multiple concurrent sessions', async () => {
      const mockOnComplete = vi.fn();

      renderWithProviders(
        <OpenID4VPVerificationComponent
          presentationDefinitionId="MOSIP_ID"
          onVerificationComplete={mockOnComplete}
          onError={vi.fn()}
        />
      );

      // Start first verification
      const startButton = screen.getByRole('button', { name: /start openid4vp verification/i });
      fireEvent.click(startButton);

      // Wait for QR code
      await waitFor(() => {
        expect(screen.getByText(/scan this qr code/i)).toBeInTheDocument();
      });

      // Verify start button is disabled during active session
      expect(startButton).toBeDisabled();

      // Verify session info is displayed
      expect(screen.getByText(/session active/i)).toBeInTheDocument();
    });

    it('should clean up resources when component unmounts', async () => {
      const { unmount } = renderWithProviders(
        <OpenID4VPVerificationComponent
          presentationDefinitionId="MOSIP_ID"
          onVerificationComplete={vi.fn()}
          onError={vi.fn()}
        />
      );

      // Start verification
      const startButton = screen.getByRole('button', { name: /start openid4vp verification/i });
      fireEvent.click(startButton);

      // Wait for QR code
      await waitFor(() => {
        expect(screen.getByText(/scan this qr code/i)).toBeInTheDocument();
      });

      // Unmount component
      unmount();

      // Verify polling stops (no more API calls after unmount)
      const initialCallCount = mockGetSessionStatus.mock.calls.length;
      
      // Wait a bit and verify no new calls
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 3000));
      });

      expect(mockGetSessionStatus.mock.calls.length).toBe(initialCallCount);
    });
  });
});