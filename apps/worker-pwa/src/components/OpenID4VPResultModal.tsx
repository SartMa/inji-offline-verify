import React from 'react';
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Button,
  Chip,
  Divider,
  useTheme,
  alpha,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Close,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  Shield,
  Verified,
  AccessTime,
  Person,
  Badge,
  Info,
} from '@mui/icons-material';
import { OpenID4VPStatusResponse } from '@mosip/react-inji-verify-sdk/src/utils/openid4vp-api';

interface OpenID4VPResultModalProps {
  open: boolean;
  onClose: () => void;
  result: OpenID4VPStatusResponse | null;
  onRetry?: () => void;
}

// Helper to format credential type for display
const formatCredentialType = (types: string[]): string => {
  const mainType = types.find(type => type !== 'VerifiableCredential') || types[0];
  return mainType
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

// Helper to get status colors and icons
const getStatusDisplay = (result: OpenID4VPStatusResponse) => {
  if (result.status === 'error') {
    return {
      color: '#EF4444',
      backgroundColor: '#FEF2F2',
      borderColor: '#FECACA',
      icon: <ErrorIcon sx={{ fontSize: 24, color: '#EF4444' }} />,
      statusText: 'VERIFICATION FAILED',
      chipColor: 'error' as const,
      title: 'Verification Failed',
      subtitle: result.error_message || 'The credential verification failed',
    };
  }

  if (result.status === 'expired') {
    return {
      color: '#D97706',
      backgroundColor: '#FFFBEB',
      borderColor: '#FED7AA',
      icon: <AccessTime sx={{ fontSize: 24, color: '#D97706' }} />,
      statusText: 'SESSION EXPIRED',
      chipColor: 'warning' as const,
      title: 'Session Expired',
      subtitle: 'The verification session has expired',
    };
  }

  if (result.status === 'completed' && result.verification_summary) {
    const { verified } = result.verification_summary;
    
    if (verified) {
      return {
        color: '#10B981',
        backgroundColor: '#F0FDF4',
        borderColor: '#BBF7D0',
        icon: <CheckCircle sx={{ fontSize: 24, color: '#10B981' }} />,
        statusText: 'VERIFICATION SUCCESSFUL',
        chipColor: 'success' as const,
        title: 'Verification Successful',
        subtitle: `Successfully verified ${result.verification_summary.credential_count} credential(s)`,
      };
    } else {
      return {
        color: '#EF4444',
        backgroundColor: '#FEF2F2',
        borderColor: '#FECACA',
        icon: <ErrorIcon sx={{ fontSize: 24, color: '#EF4444' }} />,
        statusText: 'VERIFICATION FAILED',
        chipColor: 'error' as const,
        title: 'Verification Failed',
        subtitle: 'One or more credentials could not be verified',
      };
    }
  }

  // Default pending state (shouldn't normally be shown in results)
  return {
    color: '#6B7280',
    backgroundColor: '#F9FAFB',
    borderColor: '#E5E7EB',
    icon: <Info sx={{ fontSize: 24, color: '#6B7280' }} />,
    statusText: 'PENDING',
    chipColor: 'default' as const,
    title: 'Verification Pending',
    subtitle: 'Waiting for verification to complete',
  };
};

const OpenID4VPResultModal: React.FC<OpenID4VPResultModalProps> = ({
  open,
  onClose,
  result,
  onRetry,
}) => {
  const theme = useTheme();

  if (!result) return null;

  const statusDisplay = getStatusDisplay(result);
  const hasCredentials = result.verification_summary?.credentials_summary?.length > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '16px !important',
          overflow: 'visible',
          backgroundColor: '#f1f5f9',
          maxHeight: '90vh',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
          '[data-mui-color-scheme="dark"] &': {
            backgroundColor: '#0f172a',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          },
        },
      }}
    >
      {/* Header Section */}
      <Box
        sx={{
          backgroundColor: '#f8fafc',
          color: 'var(--template-palette-text-primary)',
          p: { xs: 2, sm: 2.5 },
          textAlign: 'center',
          position: 'relative',
          borderRadius: '16px 16px 0 0',
          borderBottom: `3px solid ${statusDisplay.color}`,
          '[data-mui-color-scheme="dark"] &': {
            backgroundColor: '#1e293b',
          },
        }}
      >
        <IconButton
          onClick={onClose}
          size="small"
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            color: 'var(--template-palette-text-secondary)',
            backgroundColor: 'var(--template-palette-action-hover)',
            width: 28,
            height: 28,
            '&:hover': {
              backgroundColor: 'var(--template-palette-action-selected)',
              transform: 'scale(1.05)',
            },
            transition: 'all 0.2s ease',
          }}
        >
          <Close sx={{ fontSize: 16 }} />
        </IconButton>

        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              backgroundColor: alpha(statusDisplay.color, 0.1),
              border: `2px solid ${statusDisplay.color}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 0.5,
            }}
          >
            {statusDisplay.icon}
          </Box>

          <Typography
            variant="h6"
            sx={{
              fontWeight: 600,
              fontSize: { xs: '1.25rem', sm: '1.4rem' },
              color: 'var(--template-palette-text-primary)',
              lineHeight: 1.2,
            }}
          >
            {statusDisplay.title}
          </Typography>

          <Typography
            variant="body2"
            sx={{
              color: 'var(--template-palette-text-secondary)',
              fontSize: { xs: '0.95rem', sm: '1rem' },
              maxWidth: '90%',
              lineHeight: 1.3,
            }}
          >
            {statusDisplay.subtitle}
          </Typography>
        </Box>
      </Box>

      <DialogContent
        sx={{
          p: 0,
          maxHeight: { xs: '70vh', sm: '75vh', md: '80vh' },
          overflowY: 'auto',
          overflowX: 'hidden',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {/* Status Badge */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            p: 1.5,
            backgroundColor: '#f1f5f9',
            '[data-mui-color-scheme="dark"] &': {
              backgroundColor: '#0f172a',
            },
          }}
        >
          <Chip
            icon={statusDisplay.icon}
            label={statusDisplay.statusText}
            color={statusDisplay.chipColor}
            size="small"
            sx={{
              fontWeight: 600,
              px: 2,
              py: 0,
              fontSize: '0.75rem',
              height: 24,
              borderRadius: '12px',
              boxShadow: `0 2px 6px ${alpha(statusDisplay.color, 0.2)}`,
              '& .MuiChip-icon': {
                fontSize: 14,
              },
            }}
          />
        </Box>

        {/* Content Container */}
        <Box
          sx={{
            px: 2.5,
            pb: 2.5,
            backgroundColor: '#f1f5f9',
            '[data-mui-color-scheme="dark"] &': {
              backgroundColor: '#0f172a',
            },
          }}
        >
          {/* Verification Summary */}
          {result.verification_summary && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 600,
                  color: 'var(--template-palette-text-primary)',
                  fontSize: { xs: '1.1rem', sm: '1.25rem' },
                  mb: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                }}
              >
                <Shield sx={{ color: 'var(--template-palette-primary-main)', fontSize: { xs: 20, sm: 22 } }} />
                Verification Summary
              </Typography>

              <Card
                sx={{
                  backgroundColor: statusDisplay.backgroundColor,
                  border: `1px solid ${statusDisplay.borderColor}`,
                  borderRadius: '12px',
                  boxShadow: 'none',
                }}
              >
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ flex: 1, minWidth: '200px' }}>
                      <Typography variant="caption" sx={{ color: statusDisplay.color, fontWeight: 600 }}>
                        Status
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: statusDisplay.color }}>
                        {result.verification_summary.verified ? 'All credentials verified' : 'Verification failed'}
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: '150px' }}>
                      <Typography variant="caption" sx={{ color: 'var(--template-palette-text-secondary)', fontWeight: 600 }}>
                        Credentials
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--template-palette-text-primary)' }}>
                        {result.verification_summary.credential_count} credential(s)
                      </Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: '150px' }}>
                      <Typography variant="caption" sx={{ color: 'var(--template-palette-text-secondary)', fontWeight: 600 }}>
                        Verified At
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, color: 'var(--template-palette-text-primary)' }}>
                        {new Date(result.verification_summary.verified_at).toLocaleString()}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}

          {/* Credential Details */}
          {hasCredentials && (
            <>
              <Divider sx={{ my: 2, borderColor: 'rgba(100, 116, 139, 0.15)', opacity: 1 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    color: 'var(--template-palette-text-primary)',
                    fontSize: { xs: '1.1rem', sm: '1.25rem' },
                    mb: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Verified sx={{ color: 'var(--template-palette-primary-main)', fontSize: { xs: 20, sm: 22 } }} />
                  Credential Details
                </Typography>

                <List sx={{ p: 0 }}>
                  {result.verification_summary!.credentials_summary.map((credential, index) => (
                    <ListItem
                      key={index}
                      sx={{
                        backgroundColor: credential.verified
                          ? alpha(theme.palette.success.main, 0.05)
                          : alpha(theme.palette.error.main, 0.05),
                        border: `1px solid ${
                          credential.verified
                            ? alpha(theme.palette.success.main, 0.2)
                            : alpha(theme.palette.error.main, 0.2)
                        }`,
                        borderRadius: '8px',
                        mb: 1,
                        p: 2,
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        {credential.verified ? (
                          <CheckCircle sx={{ color: theme.palette.success.main, fontSize: 20 }} />
                        ) : (
                          <ErrorIcon sx={{ color: theme.palette.error.main, fontSize: 20 }} />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                            {formatCredentialType(credential.type)}
                          </Typography>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" sx={{ color: 'var(--template-palette-text-secondary)' }}>
                              <Person sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                              Issuer: {credential.issuer}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{
                                color: credential.verified ? theme.palette.success.main : theme.palette.error.main,
                                fontWeight: 600,
                                mt: 0.5,
                              }}
                            >
                              <Badge sx={{ fontSize: 14, mr: 0.5, verticalAlign: 'middle' }} />
                              {credential.verified ? 'Verified Successfully' : 'Verification Failed'}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Box>
            </>
          )}

          {/* Error Message */}
          {result.error_message && (
            <>
              <Divider sx={{ my: 2, borderColor: 'rgba(100, 116, 139, 0.15)', opacity: 1 }} />
              
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    color: 'var(--template-palette-text-primary)',
                    fontSize: { xs: '1.1rem', sm: '1.25rem' },
                    mb: 1.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <ErrorIcon sx={{ color: theme.palette.error.main, fontSize: { xs: 20, sm: 22 } }} />
                  Error Details
                </Typography>

                <Card
                  sx={{
                    backgroundColor: alpha(theme.palette.error.main, 0.05),
                    border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                    borderRadius: '8px',
                    boxShadow: 'none',
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography
                      variant="body2"
                      sx={{
                        color: 'var(--template-palette-text-primary)',
                        lineHeight: 1.4,
                      }}
                    >
                      {result.error_message}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            </>
          )}

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, pt: 1 }}>
            {onRetry && (result.status === 'error' || result.status === 'expired') && (
              <Button
                variant="outlined"
                onClick={onRetry}
                size="small"
                sx={{
                  borderRadius: '16px',
                  minWidth: 120,
                  py: 0.75,
                  px: 2.5,
                  fontWeight: 600,
                  fontSize: { xs: '0.9rem', sm: '0.95rem' },
                  textTransform: 'none',
                  borderColor: 'var(--template-palette-primary-main)',
                  color: 'var(--template-palette-primary-main)',
                  '&:hover': {
                    backgroundColor: alpha(theme.palette.primary.main, 0.05),
                    borderColor: 'var(--template-palette-primary-dark)',
                    transform: 'translateY(-1px)',
                  },
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                Try Again
              </Button>
            )}
            
            <Button
              variant="contained"
              onClick={onClose}
              size="small"
              sx={{
                borderRadius: '16px',
                minWidth: 160,
                py: 0.75,
                px: 2.5,
                fontWeight: 600,
                fontSize: { xs: '0.9rem', sm: '0.95rem' },
                textTransform: 'none',
                backgroundColor: '#000000',
                color: '#ffffff',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                '[data-mui-color-scheme="dark"] &': {
                  backgroundColor: '#ffffff',
                  color: '#000000',
                  boxShadow: '0 2px 8px rgba(255, 255, 255, 0.1)',
                },
                '&:hover': {
                  backgroundColor: '#000000',
                  color: '#ffffff',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                  transform: 'translateY(-1px)',
                  '[data-mui-color-scheme="dark"] &': {
                    backgroundColor: '#ffffff',
                    color: '#000000',
                    boxShadow: '0 4px 12px rgba(255, 255, 255, 0.2)',
                  },
                },
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              Verify Another Credential
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default OpenID4VPResultModal;