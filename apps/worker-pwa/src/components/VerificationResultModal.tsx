import { 
  Dialog, 
  DialogContent, 
  Box, 
  Typography, 
  IconButton, 
  Button, 
  Chip, 
  Divider, 
  Tooltip, 
  useTheme,
  alpha
} from '@mui/material';
import { 
  Close, 
  CheckCircle, 
  Error as ErrorIcon, 
  Warning, 
  Launch,
  Shield,
  AccessTime,
  Verified
} from '@mui/icons-material';
import { VerificationResult } from '@mosip/react-inji-verify-sdk';

interface Props {
  open: boolean;
  onClose: () => void;
  result: VerificationResult | null;
}

// Helper to format keys (e.g., 'childFullName' -> 'Child Full Name')
const formatLabel = (key: string) => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase());
};

// Helper to check if a value is a URL
const isURL = (value: any) => {
  return typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));
};

const formatErrorCodeForDisplay = (code?: string | null) => {
  if (!code) {
    return [];
  }

  // Return the full error code as a single line
  return [code];
};

const CredentialField = ({ label, value }: { label: string; value: any }) => {
  return (
    <Box 
      sx={{ 
        py: 1.5,
        px: 0,
        transition: 'all 0.2s ease',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'var(--template-palette-text-secondary)',
            fontWeight: 700,
            fontSize: { xs: '0.85rem', sm: '0.9rem' },
            minWidth: 'fit-content',
            textTransform: 'capitalize',
            lineHeight: 1.4,
            letterSpacing: '0.2px'
          }}
        >
          {label}:
        </Typography>
        <Typography 
          variant="body2" 
          sx={{ 
            fontWeight: 600,
            wordBreak: 'break-word',
            color: 'var(--template-palette-text-primary)',
            lineHeight: 1.4,
            fontSize: { xs: '0.9rem', sm: '0.95rem' },
            flex: 1,
            letterSpacing: '0.1px'
          }}
        >
          {isURL(value) ? (
            <Box 
              component="a" 
              href={value} 
              target="_blank" 
              rel="noopener noreferrer" 
              sx={{ 
                color: 'var(--template-palette-primary-main)',
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                '&:hover': { 
                  textDecoration: 'underline',
                  '& .launch-icon': {
                    transform: 'translate(2px, -2px)'
                  }
                },
              }}
            >
              {String(value)}
              <Launch 
                className="launch-icon"
                sx={{ 
                  fontSize: 12,
                  transition: 'transform 0.2s ease'
                }} 
              />
            </Box>
          ) : (
            String(value)
          )}
        </Typography>
      </Box>
    </Box>
  );
};

const StatusIcon = ({ isVerified, isExpired, isRevoked }: { isVerified: boolean; isExpired: boolean; isRevoked: boolean }) => {
  if (isVerified) {
    return isExpired ? (
      <Warning sx={{ fontSize: 24, color: '#D98C00' }} />
    ) : (
      <CheckCircle sx={{ fontSize: 24, color: '#10B981' }} />
    );
  }
  if (isRevoked) {
    return <ErrorIcon sx={{ fontSize: 24, color: '#DC2626' }} />;
  }
  return <ErrorIcon sx={{ fontSize: 24, color: '#EF4444' }} />;
};

export default function VerificationResultModal({ open, onClose, result }: Props) {
  const theme = useTheme();
  
  if (!result) return null;

  // Treat both VC_EXPIRED and EXPIRED as "valid but expired" - only if verification status is true
  const isExpired: boolean =
    !!result.verificationStatus &&
    (result.verificationErrorCode === 'VC_EXPIRED' || 
     result.verificationErrorCode === 'EXPIRED' ||
     result.verificationErrorCode === 'ERR_VC_EXPIRED');

  // A VC is considered "verified" if it has a valid status
  const isVerified: boolean = !!result.verificationStatus;

  const isRevoked = result.verificationErrorCode === 'VC_REVOKED';

  const isOfflineDepsMissing = result.verificationErrorCode === 'ERR_OFFLINE_DEPENDENCIES_MISSING';

  // Updated color scheme
  const getStatusColors = () => {
    if (isVerified) {
      if (isExpired) {
        return {
          primary: '#D98C00',
          secondary: '#F5B800',
          background: 'linear-gradient(135deg, #D98C00 0%, #F5B800 100%)',
          chip: 'warning' as const,
          statusText: 'EXPIRED'
        };
      }
      return {
        primary: '#10B981',
        secondary: '#ef0ee8ff',
        background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
        chip: 'success' as const,
        statusText: 'VERIFIED'
      };
    }
    if (isRevoked) {
      return {
        primary: '#DC2626',
        secondary: '#7F1D1D',
        background: 'linear-gradient(135deg, #DC2626 0%, #7F1D1D 100%)',
        chip: 'error' as const,
        statusText: 'REVOKED'
      };
    }
    return {
      primary: '#EF4444',
      secondary: '#DC2626',
      background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
      chip: 'error' as const,
      statusText: 'INVALID'
    };
  };

  const statusColors = getStatusColors();

  const titleText = isVerified
    ? isExpired
      ? 'The given credential is valid but expired!'
      : 'Verification Successful!'
    : isOfflineDepsMissing
      ? 'Offline data required to verify'
      : isRevoked
        ? 'Credential has been revoked'
        : 'Verification Failed!';

  const credential = (result as any).payload as any | undefined;
  const credentialType: string | undefined = Array.isArray(credential?.type)
    ? credential.type.find((t: string) => t !== 'VerifiableCredential')
    : credential?.type;
  const subject: Record<string, any> | undefined = credential?.credentialSubject;

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
        } 
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
          borderBottom: `3px solid ${statusColors.primary}`,
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
              transform: 'scale(1.05)'
            },
            transition: 'all 0.2s ease'
          }}
        >
          <Close sx={{ fontSize: 16 }} />
        </IconButton>
        
        <Box sx={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          gap: 1
        }}>
          <Box sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            backgroundColor: alpha(statusColors.primary, 0.1),
            border: `2px solid ${statusColors.primary}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 0.5
          }}>
            <StatusIcon isVerified={isVerified} isExpired={isExpired} isRevoked={isRevoked} />
          </Box>
          
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 600,
              fontSize: { xs: '1.25rem', sm: '1.4rem' },
              color: 'var(--template-palette-text-primary)',
              lineHeight: 1.2
            }}
          >
            {titleText}
          </Typography>
          
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'var(--template-palette-text-secondary)',
              fontSize: { xs: '0.95rem', sm: '1rem' },
              maxWidth: '90%',
              lineHeight: 1.3
            }}
          >
            {isVerified 
              ? isExpired 
                ? 'Valid signature but expired'
                : 'Successfully verified'
              : isRevoked
                ? (result.verificationMessage || 'Credential revoked by issuer')
                : 'Could not be verified'
            }
          </Typography>
        </Box>
      </Box>

      <DialogContent sx={{ 
        p: 0, 
        maxHeight: { xs: '70vh', sm: '75vh', md: '80vh' },
        overflowY: 'auto',
        overflowX: 'hidden',
        '&::-webkit-scrollbar': {
          display: 'none',
        },
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {/* Status Badge */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          p: 1.5, 
          backgroundColor: '#f1f5f9',
          '[data-mui-color-scheme="dark"] &': {
            backgroundColor: '#0f172a',
          },
        }}>
          <Chip 
            icon={isVerified 
              ? (isExpired ? <AccessTime /> : <Verified />)
              : isRevoked
                ? <ErrorIcon sx={{ fontSize: 16 }} />
                : <Shield />}
            label={statusColors.statusText}
            color={statusColors.chip}
            size="small"
            sx={{ 
              fontWeight: 600,
              px: 2,
              py: 0,
              fontSize: '0.75rem',
              height: 24,
              borderRadius: '12px',
              boxShadow: `0 2px 6px ${alpha(statusColors.primary, 0.2)}`,
              '& .MuiChip-icon': {
                fontSize: 14
              }
            }}
          />
        </Box>

        {/* Content Container */}
        <Box sx={{ 
          px: 2.5, 
          pb: 2.5,
          backgroundColor: '#f1f5f9',
          '[data-mui-color-scheme="dark"] &': {
            backgroundColor: '#0f172a',
          },
        }}>
          {/* Verification Status Section */}
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
                gap: 1
              }}
            >
              <Shield sx={{ color: 'var(--template-palette-primary-main)', fontSize: { xs: 20, sm: 22 } }} />
              Verification Details
            </Typography>
            
            <Box sx={{ 
              display: 'flex',
              gap: 1.5,
              flexWrap: { xs: 'wrap', md: 'nowrap' },
              justifyContent: { xs: 'stretch', md: 'flex-start' }
            }}>
              <Box sx={{ 
                flex: { xs: '1 1 100%', md: 'none' },
                minWidth: { xs: 'auto', md: '200px' },
                maxWidth: { xs: 'none', md: '250px' }
              }}>
                <Box sx={{ 
                  p: 1.5,
                  backgroundColor: alpha(statusColors.primary, 0.08),
                  border: `1px solid ${alpha(statusColors.primary, 0.2)}`,
                  borderRadius: '8px',
                  transition: 'all 0.2s ease',
                  height: '100%',
                  '&:hover': {
                    borderColor: statusColors.primary,
                    boxShadow: `0 2px 8px ${alpha(statusColors.primary, 0.15)}`,
                  }
                }}>
                  <Typography variant="caption" sx={{ 
                    color: statusColors.primary,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    fontSize: { xs: '0.7rem', sm: '0.75rem' }
                  }}>
                    Status
                  </Typography>
                  <Typography variant="body2" sx={{ 
                    fontWeight: 600,
                    color: statusColors.primary,
                    mt: 0.5,
                    fontSize: { xs: '0.85rem', sm: '0.9rem' },
                    lineHeight: 1.2
                  }}>
                    {isVerified
                      ? 'Valid signature'
                      : isOfflineDepsMissing
                        ? 'Cannot verify offline'
                        : isRevoked
                          ? 'Credential revoked'
                          : 'Invalid signature'}
                  </Typography>
                </Box>
              </Box>

              {result.verificationMessage && (
                <Box sx={{ 
                  flex: { xs: '1 1 100%', md: '1.3' },
                  minWidth: 0
                }}>
                  <Box sx={{ 
                    p: 1.5,
                    backgroundColor: 'rgba(100, 116, 139, 0.06)',
                    border: '1px solid rgba(100, 116, 139, 0.15)',
                    borderRadius: '8px',
                    transition: 'all 0.2s ease',
                    height: '100%',
                    '&:hover': {
                      borderColor: 'rgba(100, 116, 139, 0.3)',
                      boxShadow: '0 2px 8px rgba(100, 116, 139, 0.1)',
                    },
                    '[data-mui-color-scheme="dark"] &': {
                      backgroundColor: 'rgba(71, 85, 105, 0.08)',
                      borderColor: 'rgba(71, 85, 105, 0.2)',
                    },
                  }}>
                    <Typography variant="caption" sx={{ 
                      color: 'var(--template-palette-text-secondary)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontSize: { xs: '0.7rem', sm: '0.75rem' }
                    }}>
                      Message
                    </Typography>
                    <Typography variant="body2" sx={{ 
                      fontWeight: 500,
                      color: 'var(--template-palette-text-primary)',
                      mt: 0.5,
                      fontSize: { xs: '0.8rem', sm: '0.85rem' },
                      lineHeight: 1.3
                    }}>
                      {isOfflineDepsMissing ? 'Required contexts or public keys are not in local cache' : result.verificationMessage}
                    </Typography>
                  </Box>
                </Box>
              )}

              {result.verificationErrorCode && (
                <Box sx={{ 
                  flex: { xs: '1 1 100%', md: '1.5' },
                  minWidth: 0
                }}>
                  <Box sx={{ 
                    p: 1.5,
                    backgroundColor: alpha(theme.palette.error.main, 0.06),
                    border: `1px solid ${alpha(theme.palette.error.main, 0.15)}`,
                    borderRadius: '8px',
                    transition: 'all 0.2s ease',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    '&:hover': {
                      borderColor: theme.palette.error.main,
                      boxShadow: `0 2px 8px ${alpha(theme.palette.error.main, 0.15)}`,
                    }
                  }}>
                    <Typography variant="caption" sx={{ 
                      color: theme.palette.error.main,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      fontSize: { xs: '0.7rem', sm: '0.75rem' },
                      textAlign: 'left'
                    }}>
                      Error Code
                    </Typography>
                    <Box
                      sx={{
                        mt: 0.75,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        flexWrap: 'wrap'
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{
                          color: alpha(theme.palette.error.main, 0.8),
                          fontWeight: 600,
                          textTransform: 'uppercase'
                        }}
                      >
                        Code
                      </Typography>
                      <Chip
                        label={result.verificationErrorCode}
                        size="small"
                        color="error"
                        variant="outlined"
                        sx={{
                          fontWeight: 700,
                          fontFamily: 'monospace',
                          letterSpacing: '0.4px',
                          backgroundColor: alpha(theme.palette.error.main, 0.12),
                          color: theme.palette.error.main
                        }}
                      />
                    </Box>
                  </Box>
                </Box>
              )}
            </Box>
          </Box>

          {/* Credential Details Section */}
          {subject && (
            <>
              <Divider sx={{ 
                my: 2,
                borderColor: 'rgba(100, 116, 139, 0.15)',
                opacity: 1
              }} />
              
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography 
                    variant="subtitle1" 
                    sx={{ 
                      fontWeight: 600,
                      color: 'var(--template-palette-text-primary)',
                      fontSize: { xs: '1.1rem', sm: '1.25rem' },
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1
                    }}
                  >
                    <Verified sx={{ color: 'var(--template-palette-primary-main)', fontSize: { xs: 20, sm: 22 } }} />
                    {formatLabel(credentialType || 'Credential')} Details
                  </Typography>
                  {credential?.id && isURL(credential.id) && (
                    <Tooltip title="View Raw Credential" arrow>
                      <IconButton 
                        size="small" 
                        href={credential.id} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        sx={{
                          backgroundColor: 'var(--template-palette-primary-main)',
                          color: 'white',
                          width: 28,
                          height: 28,
                          '&:hover': {
                            backgroundColor: 'var(--template-palette-primary-dark)',
                            transform: 'scale(1.05)'
                          },
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Launch sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>

                <Box sx={{ 
                  display: 'grid', 
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, 
                  gap: 1.5 
                }}>
                  {Object.entries(subject)
                    .filter(([key]) => key.toLowerCase() !== 'id')
                    .map(([key, value], index) => (
                      <Box 
                        key={key} 
                        sx={{ 
                          pl: { xs: 0, sm: index % 2 === 0 ? 4.5 : 0 }
                        }}
                      >
                        <CredentialField label={formatLabel(key)} value={value} />
                      </Box>
                    ))}
                </Box>
              </Box>
            </>
          )}

          {/* Action Button */}
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
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
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              Verify Another Credential
            </Button>
          </Box>
        </Box>
      </DialogContent>
    </Dialog>
  );
}