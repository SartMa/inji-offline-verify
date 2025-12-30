import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  createOpenID4VPSession,
  getOpenID4VPSessionStatus,
} from "@mosip/react-inji-verify-sdk";
import type {
  OpenID4VPSessionRequest,
  OpenID4VPSessionResponse,
  OpenID4VPStatusResponse,
  OpenID4VPVerificationResult,
} from "@mosip/react-inji-verify-sdk";
import { Box, Typography, Alert, Button } from "@mui/material";
import { Refresh, WifiOff } from "@mui/icons-material";
import OpenID4VPResultModal from "./OpenID4VPResultModal";
import OpenID4VPErrorHandler from "./OpenID4VPErrorHandler";
import type { OpenID4VPError } from "./OpenID4VPErrorHandler";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

export interface OpenID4VPVerificationProps {
  triggerElement?: React.ReactNode;
  verifyServiceUrl: string;
  presentationDefinitionId: string;
  onVPReceived?: (sessionId: string) => void;
  onVPProcessed?: (results: OpenID4VPVerificationResult[]) => void;
  qrCodeStyles?: {
    size?: number;
    level?: "L" | "M" | "Q" | "H";
    bgColor?: string;
    fgColor?: string;
    margin?: number;
    borderRadius?: number;
  };
  onQrCodeExpired: () => void;
  onError: (error: Error) => void;
  expiresInMinutes?: number;
  showResultModal?: boolean;
  showErrorAsSnackbar?: boolean;
}

const OpenID4VPVerificationComponent: React.FC<OpenID4VPVerificationProps> = ({
  triggerElement,
  verifyServiceUrl,
  presentationDefinitionId,
  onVPReceived,
  onVPProcessed,
  qrCodeStyles,
  onQrCodeExpired,
  onError,
  expiresInMinutes = 10,
  showResultModal = true,
  showErrorAsSnackbar = false,
}) => {
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [sessionData, setSessionData] = useState<OpenID4VPSessionResponse | null>(null);
  const [verificationResult, setVerificationResult] = useState<OpenID4VPStatusResponse | null>(null);
  const [currentError, setCurrentError] = useState<OpenID4VPError | null>(null);
  const [showResultModalState, setShowResultModalState] = useState<boolean>(false);
  const hasInitializedRef = useRef(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const expirationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isOnline = useOnlineStatus();

  // Helper to create standardized error objects
  const createError = useCallback((code: string, message: string, details?: any): OpenID4VPError => {
    return {
      code,
      message,
      details,
      timestamp: new Date(),
    };
  }, []);

  // Helper to handle errors consistently
  const handleError = useCallback((error: Error | OpenID4VPError, errorCode?: string) => {
    let openid4vpError: OpenID4VPError;
    
    if ('code' in error && 'timestamp' in error) {
      // Already an OpenID4VPError
      openid4vpError = error as OpenID4VPError;
    } else {
      // Convert Error to OpenID4VPError
      const message = error.message || 'An unknown error occurred';
      let code = errorCode || 'UNKNOWN_ERROR';
      
      // Classify error based on message content
      if (message.includes('fetch') || message.includes('network') || message.includes('Failed to fetch')) {
        code = 'NETWORK_ERROR';
      } else if (message.includes('token') || message.includes('Authentication') || message.includes('Unauthorized')) {
        code = 'AUTH_ERROR';
      } else if (message.includes('session') || message.includes('expired')) {
        code = 'SESSION_ERROR';
      } else if (message.includes('verification') || message.includes('invalid')) {
        code = 'VERIFICATION_ERROR';
      }
      
      openid4vpError = createError(code, message, error);
    }
    
    setCurrentError(openid4vpError);
    onError(new Error(openid4vpError.message));
  }, [createError, onError]);

  const shouldShowQRCode = !loading && qrCodeData && !currentError;

  // Get auth token from localStorage
  const getAuthToken = useCallback(() => {
    return localStorage.getItem('authToken');
  }, []);

  const createVPRequest = useCallback(async () => {
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    setLoading(true);
    setCurrentError(null);

    // Check online status first
    if (!isOnline) {
      const offlineError = createError(
        'NETWORK_ERROR',
        'You need an internet connection to use OpenID4VP verification. Please check your connection and try again.'
      );
      handleError(offlineError);
      setLoading(false);
      resetState();
      return;
    }

    try {
      const authToken = getAuthToken();
      if (!authToken) {
        const authError = createError(
          'AUTH_ERROR',
          'Authentication token not found. Please log in again.'
        );
        handleError(authError);
        setLoading(false);
        resetState();
        return;
      }

      const sessionRequest: OpenID4VPSessionRequest = {
        presentation_definition_id: presentationDefinitionId,
        expires_in_minutes: expiresInMinutes,
      };

      const data = await createOpenID4VPSession(
        verifyServiceUrl,
        sessionRequest,
        authToken
      );

      setSessionData(data);
      setQrCodeData(data.authorization_request_uri);
      setLoading(false);

      // Start polling for status
      startPolling(data.session_id);

      // Set expiration timeout
      const expiresAt = new Date(data.expires_at);
      const timeUntilExpiration = expiresAt.getTime() - Date.now();
      
      if (timeUntilExpiration > 0) {
        expirationTimeoutRef.current = setTimeout(() => {
          stopPolling();
          const expiredResult: OpenID4VPStatusResponse = {
            session_id: data.session_id,
            status: 'expired',
            created_at: data.expires_at,
            expires_at: data.expires_at,
            presentation_definition_id: data.presentation_definition_id,
            is_expired: true,
            error_message: 'Verification session has expired',
          };
          setVerificationResult(expiredResult);
          if (showResultModal) {
            setShowResultModalState(true);
          }
          resetState();
          onQrCodeExpired();
        }, timeUntilExpiration);
      }

      return data;
    } catch (error) {
      setLoading(false);
      resetState();
      handleError(error as Error, 'SESSION_CREATION_ERROR');
    }
  }, [
    verifyServiceUrl,
    presentationDefinitionId,
    expiresInMinutes,
    getAuthToken,
    isOnline,
    createError,
    handleError,
    onQrCodeExpired,
    showResultModal,
  ]);

  const fetchVPStatus = useCallback(async (currentSessionId: string) => {
    try {
      const authToken = getAuthToken();
      if (!authToken) {
        const authError = createError(
          'AUTH_ERROR',
          'Authentication token not found. Please log in again.'
        );
        handleError(authError);
        stopPolling();
        resetState();
        return;
      }

      const response = await getOpenID4VPSessionStatus(
        verifyServiceUrl,
        currentSessionId,
        authToken
      );

      if (response.status === 'completed') {
        stopPolling();
        setVerificationResult(response);
        
        if (showResultModal) {
          setShowResultModalState(true);
        }
        
        if (onVPProcessed && response.verification_summary) {
          // Convert verification summary to VerificationResult format
          const results: OpenID4VPVerificationResult[] = response.verification_summary.credentials_summary.map(cred => ({
            vc: { type: cred.type, issuer: cred.issuer },
            vcStatus: cred.verified ? 'valid' : 'invalid'
          }));
          onVPProcessed(results);
        } else if (onVPReceived) {
          onVPReceived(currentSessionId);
        }
        
        resetState();
      } else if (response.status === 'expired') {
        stopPolling();
        setVerificationResult(response);
        if (showResultModal) {
          setShowResultModalState(true);
        }
        resetState();
        onQrCodeExpired();
      } else if (response.status === 'error') {
        stopPolling();
        setVerificationResult(response);
        if (showResultModal) {
          setShowResultModalState(true);
        } else {
          const verificationError = createError(
            'VERIFICATION_ERROR',
            response.error_message || 'Verification failed'
          );
          handleError(verificationError);
        }
        resetState();
      }
      // If status is 'pending', continue polling
    } catch (error) {
      stopPolling();
      resetState();
      handleError(error as Error, 'STATUS_POLLING_ERROR');
    }
  }, [
    verifyServiceUrl, 
    getAuthToken, 
    onVPProcessed, 
    onVPReceived, 
    onQrCodeExpired, 
    showResultModal,
    createError,
    handleError
  ]);

  const startPolling = useCallback((currentSessionId: string) => {
    // Poll every 2 seconds as per requirements
    pollingIntervalRef.current = setInterval(() => {
      fetchVPStatus(currentSessionId);
    }, 2000);
  }, [fetchVPStatus]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const resetState = useCallback(() => {
    setQrCodeData(null);
    setSessionData(null);
    setCurrentError(null);
    setLoading(false);
    hasInitializedRef.current = false;
    stopPolling();
    
    if (expirationTimeoutRef.current) {
      clearTimeout(expirationTimeoutRef.current);
      expirationTimeoutRef.current = null;
    }
  }, [stopPolling]);

  // Handle retry functionality
  const handleRetry = useCallback(() => {
    resetState();
    setCurrentError(null);
    handleGenerateQRCode();
  }, [resetState]);

  // Handle error dismissal
  const handleErrorDismiss = useCallback(() => {
    setCurrentError(null);
  }, []);

  // Handle result modal close
  const handleResultModalClose = useCallback(() => {
    setShowResultModalState(false);
    setVerificationResult(null);
  }, []);

  useEffect(() => {
    // Validation checks
    if (!presentationDefinitionId) {
      throw new Error("presentationDefinitionId is required");
    }
    if (!onVPReceived && !onVPProcessed) {
      throw new Error(
        "Either onVPReceived or onVPProcessed must be provided"
      );
    }
    if (onVPReceived && onVPProcessed) {
      throw new Error(
        "Both onVPReceived and onVPProcessed cannot be provided simultaneously"
      );
    }
    if (!onQrCodeExpired) {
      throw new Error("onQrCodeExpired callback is required");
    }
    if (!onError) {
      throw new Error("onError callback is required");
    }
  }, [
    presentationDefinitionId,
    onVPReceived,
    onVPProcessed,
    onQrCodeExpired,
    onError,
  ]);

  useEffect(() => {
    // Auto-start if no trigger element
    if (!triggerElement) {
      handleGenerateQRCode();
    }
  }, [triggerElement]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPolling();
      if (expirationTimeoutRef.current) {
        clearTimeout(expirationTimeoutRef.current);
      }
    };
  }, [stopPolling]);

  const handleTriggerClick = () => {
    handleGenerateQRCode();
  };

  const handleGenerateQRCode = async () => {
    await createVPRequest();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minWidth: "100%",
      }}
    >
      {/* Loading State */}
      {loading && (
        <div
          style={{
            width: "40px",
            height: "40px",
            border: "4px solid #ccc",
            borderTop: "4px solid #333",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "20px auto",
          }}
        />
      )}
      
      {/* Trigger Element */}
      {!loading && triggerElement && !qrCodeData && !currentError && (
        <div onClick={handleTriggerClick} style={{ cursor: "pointer" }}>
          {triggerElement}
        </div>
      )}
      
      {/* Offline Status Warning */}
      {!isOnline && !currentError && (
        <Box sx={{ mb: 2, width: '100%', maxWidth: 400 }}>
          <Alert 
            severity="warning" 
            icon={<WifiOff />}
            action={
              <Button
                color="inherit"
                size="small"
                onClick={() => window.location.reload()}
                startIcon={<Refresh />}
              >
                Retry
              </Button>
            }
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              You're offline. OpenID4VP verification requires an internet connection.
            </Typography>
          </Alert>
        </Box>
      )}
      
      {/* QR Code Display */}
      {shouldShowQRCode && (
        <Box sx={{ textAlign: 'center' }}>
          <div data-testid="openid4vp-qr-code">
            <QRCodeSVG
              value={qrCodeData}
              size={qrCodeStyles?.size || 200}
              level={qrCodeStyles?.level || "L"}
              bgColor={qrCodeStyles?.bgColor || "#ffffff"}
              fgColor={qrCodeStyles?.fgColor || "#000000"}
              marginSize={qrCodeStyles?.margin || 10}
              style={{ borderRadius: qrCodeStyles?.borderRadius || 10 }}
            />
          </div>
          
          {/* QR Code Instructions */}
          <Typography 
            variant="body2" 
            sx={{ 
              mt: 2, 
              color: 'var(--template-palette-text-secondary)',
              maxWidth: 300,
              textAlign: 'center'
            }}
          >
            Scan this QR code with your digital wallet to share your credentials
          </Typography>
          
          {/* Session Info */}
          {sessionData && (
            <Typography 
              variant="caption" 
              sx={{ 
                display: 'block',
                mt: 1, 
                color: 'var(--template-palette-text-secondary)',
                fontSize: '0.7rem'
              }}
            >
              Session expires at {new Date(sessionData.expires_at).toLocaleTimeString()}
            </Typography>
          )}
        </Box>
      )}
      
      {/* Error Display */}
      {currentError && (
        <OpenID4VPErrorHandler
          error={currentError}
          onRetry={handleRetry}
          onDismiss={handleErrorDismiss}
          showAsSnackbar={showErrorAsSnackbar}
        />
      )}
      
      {/* Result Modal */}
      {showResultModal && (
        <OpenID4VPResultModal
          open={showResultModalState}
          onClose={handleResultModalClose}
          result={verificationResult}
          onRetry={handleRetry}
        />
      )}
    </div>
  );
};

// Add CSS for spinner animation (only in browser environment)
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}

export default OpenID4VPVerificationComponent;