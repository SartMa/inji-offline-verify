import React from 'react';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Typography,
  Snackbar,
  IconButton,
  Chip,
} from '@mui/material';
import {
  Close,
  Refresh,
  WifiOff,
  Error as ErrorIcon,
  AccessTime,
} from '@mui/icons-material';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export interface OpenID4VPError {
  code: string;
  message: string;
  details?: any;
  timestamp?: Date;
}

interface OpenID4VPErrorHandlerProps {
  error: OpenID4VPError | null;
  onRetry?: () => void;
  onDismiss?: () => void;
  showAsSnackbar?: boolean;
  autoHideDuration?: number;
}

// Error type classification
const getErrorType = (code: string) => {
  const normalizedCode = code.toUpperCase();
  
  if (normalizedCode.includes('NETWORK') || normalizedCode.includes('FETCH') || normalizedCode.includes('CONNECTION')) {
    return 'network';
  }
  if (normalizedCode.includes('SESSION') || normalizedCode.includes('EXPIRED')) {
    return 'session';
  }
  if (normalizedCode.includes('AUTH') || normalizedCode.includes('TOKEN') || normalizedCode.includes('UNAUTHORIZED')) {
    return 'auth';
  }
  if (normalizedCode.includes('VERIFICATION') || normalizedCode.includes('INVALID')) {
    return 'verification';
  }
  return 'general';
};

// Get error display properties
const getErrorDisplay = (error: OpenID4VPError, isOnline: boolean) => {
  const errorType = getErrorType(error.code);
  
  switch (errorType) {
    case 'network':
      return {
        severity: 'error' as const,
        icon: <WifiOff />,
        title: isOnline ? 'Connection Error' : 'You\'re Offline',
        message: isOnline 
          ? 'Unable to connect to the verification service. Please check your connection and try again.'
          : 'You need an internet connection to use OpenID4VP verification. Please check your connection and try again.',
        showRetry: true,
        color: '#EF4444',
      };
    
    case 'session':
      return {
        severity: 'warning' as const,
        icon: <AccessTime />,
        title: 'Session Issue',
        message: error.message.includes('expired') 
          ? 'Your verification session has expired. Please start a new verification.'
          : 'There was an issue with your verification session. Please try again.',
        showRetry: true,
        color: '#D97706',
      };
    
    case 'auth':
      return {
        severity: 'error' as const,
        icon: <ErrorIcon />,
        title: 'Authentication Error',
        message: 'Your session has expired. Please log in again to continue.',
        showRetry: false,
        color: '#EF4444',
      };
    
    case 'verification':
      return {
        severity: 'error' as const,
        icon: <ErrorIcon />,
        title: 'Verification Error',
        message: error.message || 'The credential verification failed. Please try again with a different credential.',
        showRetry: true,
        color: '#EF4444',
      };
    
    default:
      return {
        severity: 'error' as const,
        icon: <ErrorIcon />,
        title: 'Error',
        message: error.message || 'An unexpected error occurred. Please try again.',
        showRetry: true,
        color: '#EF4444',
      };
  }
};

// Format error code for display
const formatErrorCode = (code: string): string => {
  return code
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toUpperCase();
};

const OpenID4VPErrorHandler: React.FC<OpenID4VPErrorHandlerProps> = ({
  error,
  onRetry,
  onDismiss,
  showAsSnackbar = false,
  autoHideDuration = 6000,
}) => {
  const isOnline = useOnlineStatus();

  if (!error) return null;

  const errorDisplay = getErrorDisplay(error, isOnline);

  // Snackbar version for non-critical errors
  if (showAsSnackbar) {
    return (
      <Snackbar
        open={!!error}
        autoHideDuration={autoHideDuration}
        onClose={onDismiss}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: 8 }}
      >
        <Alert
          severity={errorDisplay.severity}
          icon={errorDisplay.icon}
          action={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {errorDisplay.showRetry && onRetry && (
                <Button
                  color="inherit"
                  size="small"
                  onClick={onRetry}
                  startIcon={<Refresh />}
                  sx={{ fontSize: '0.75rem' }}
                >
                  Retry
                </Button>
              )}
              <IconButton
                size="small"
                aria-label="close"
                color="inherit"
                onClick={onDismiss}
              >
                <Close fontSize="small" />
              </IconButton>
            </Box>
          }
          sx={{ width: '100%', alignItems: 'center' }}
        >
          <AlertTitle sx={{ fontSize: '0.9rem', fontWeight: 600 }}>
            {errorDisplay.title}
          </AlertTitle>
          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
            {errorDisplay.message}
          </Typography>
        </Alert>
      </Snackbar>
    );
  }

  // Full error display for critical errors
  return (
    <Box
      sx={{
        p: 3,
        backgroundColor: '#f1f5f9',
        '[data-mui-color-scheme="dark"] &': {
          backgroundColor: '#0f172a',
        },
      }}
    >
      <Alert
        severity={errorDisplay.severity}
        icon={errorDisplay.icon}
        sx={{
          borderRadius: '12px',
          border: `1px solid ${errorDisplay.color}20`,
          backgroundColor: `${errorDisplay.color}08`,
          '& .MuiAlert-icon': {
            fontSize: 24,
          },
        }}
      >
        <AlertTitle sx={{ fontSize: '1.1rem', fontWeight: 600, mb: 1 }}>
          {errorDisplay.title}
        </AlertTitle>
        
        <Typography variant="body2" sx={{ mb: 2, lineHeight: 1.5 }}>
          {errorDisplay.message}
        </Typography>

        {/* Error Code Display */}
        <Box sx={{ mb: 2 }}>
          <Chip
            label={`Error: ${formatErrorCode(error.code)}`}
            size="small"
            variant="outlined"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.7rem',
              fontWeight: 600,
              borderColor: errorDisplay.color,
              color: errorDisplay.color,
              backgroundColor: `${errorDisplay.color}10`,
            }}
          />
        </Box>

        {/* Offline Status Indicator */}
        {!isOnline && (
          <Box sx={{ mb: 2 }}>
            <Alert
              severity="warning"
              icon={<WifiOff />}
              sx={{
                fontSize: '0.8rem',
                py: 0.5,
                '& .MuiAlert-icon': {
                  fontSize: 16,
                },
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                You're currently offline. OpenID4VP verification requires an internet connection.
              </Typography>
            </Alert>
          </Box>
        )}

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          {errorDisplay.showRetry && onRetry && (
            <Button
              variant="contained"
              size="small"
              onClick={onRetry}
              startIcon={<Refresh />}
              disabled={!isOnline && getErrorType(error.code) === 'network'}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                backgroundColor: errorDisplay.color,
                '&:hover': {
                  backgroundColor: errorDisplay.color,
                  filter: 'brightness(0.9)',
                },
                '&:disabled': {
                  backgroundColor: '#9CA3AF',
                  color: '#ffffff',
                },
              }}
            >
              {!isOnline && getErrorType(error.code) === 'network' ? 'Waiting for Connection' : 'Try Again'}
            </Button>
          )}
          
          {onDismiss && (
            <Button
              variant="outlined"
              size="small"
              onClick={onDismiss}
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.8rem',
                borderColor: errorDisplay.color,
                color: errorDisplay.color,
                '&:hover': {
                  borderColor: errorDisplay.color,
                  backgroundColor: `${errorDisplay.color}10`,
                },
              }}
            >
              Dismiss
            </Button>
          )}
        </Box>

        {/* Additional Help Text */}
        {error.timestamp && (
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 2,
              color: 'var(--template-palette-text-secondary)',
              fontSize: '0.7rem',
            }}
          >
            Error occurred at {error.timestamp.toLocaleString()}
          </Typography>
        )}
      </Alert>
    </Box>
  );
};

export default OpenID4VPErrorHandler;