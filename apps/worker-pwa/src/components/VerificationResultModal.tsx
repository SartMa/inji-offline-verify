import { 
  Dialog, 
  DialogContent, 
  Box, 
  Typography, 
  IconButton, 
  Paper, 
  Button, 
  Chip, 
  Divider, 
  Tooltip, 
  Stack,
  Card,
  CardContent,
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

const CredentialField = ({ label, value }: { label: string; value: any }) => {
  return (
    <Card 
      elevation={0}
      sx={{ 
        backgroundColor: 'var(--template-palette-background-paper)',
        border: '1px solid var(--template-palette-divider)',
        borderRadius: '16px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          borderColor: 'var(--template-palette-primary-main)',
          boxShadow: 'var(--template-shadows-4)',
          transform: 'translateY(-2px)',
        },
        '[data-mui-color-scheme="dark"] &': {
          backgroundColor: '#1a202c',
          borderColor: 'rgba(45, 55, 72, 0.8)',
          '&:hover': {
            borderColor: '#3182ce',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          },
        },
      }}
    >
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'var(--template-palette-text-secondary)',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            mb: 1,
            display: 'block'
          }}
        >
          {label}
        </Typography>
        <Typography 
          variant="body1" 
          sx={{ 
            fontWeight: 500,
            wordBreak: 'break-word',
            color: 'var(--template-palette-text-primary)',
            lineHeight: 1.4
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
                display: 'flex',
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
                  fontSize: 16,
                  transition: 'transform 0.2s ease'
                }} 
              />
            </Box>
          ) : (
            String(value)
          )}
        </Typography>
      </CardContent>
    </Card>
  );
};

const StatusIcon = ({ isVerified, isExpired }: { isVerified: boolean; isExpired: boolean }) => {
  if (isVerified) {
    return isExpired ? (
      <Warning sx={{ fontSize: 64, filter: 'drop-shadow(0 4px 8px rgba(217, 140, 0, 0.3))' }} />
    ) : (
      <CheckCircle sx={{ fontSize: 64, filter: 'drop-shadow(0 4px 8px rgba(16, 185, 129, 0.3))' }} />
    );
  }
  return <ErrorIcon sx={{ fontSize: 64, filter: 'drop-shadow(0 4px 8px rgba(239, 68, 68, 0.3))' }} />;
};

export default function VerificationResultModal({ open, onClose, result }: Props) {
  const theme = useTheme();
  
  if (!result) return null;

  // Check if VC is expired based on error codes or message
  const isExpired: boolean = 
    result.verificationErrorCode === 'VC_EXPIRED' || 
    result.verificationErrorCode === 'EXPIRED' ||
    result.verificationErrorCode === 'ERR_VC_EXPIRED' ||
    !!(result.verificationMessage && result.verificationMessage.toLowerCase().includes('expired'));

  // A VC is considered "verified" if it has a valid status OR if it's expired (valid signature but expired)
  const isVerified: boolean = !!result.verificationStatus || isExpired;

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
      maxWidth="lg"
      fullWidth
      PaperProps={{ 
        sx: { 
          borderRadius: '24px !important',
          overflow: 'visible',
          backgroundColor: 'var(--template-palette-background-default)',
          '[data-mui-color-scheme="dark"] &': {
            backgroundColor: '#0f172a',
          },
        } 
      }}
    >
      {/* Header Section */}
      <Box 
        sx={{ 
          background: statusColors.background,
          color: 'white', 
          p: { xs: 3, sm: 4 },
          textAlign: 'center', 
          position: 'relative',
          borderRadius: '24px 24px 0 0'
        }}
      >
        <IconButton 
          onClick={onClose} 
          size="small" 
          sx={{ 
            position: 'absolute', 
            top: 16, 
            right: 16, 
            color: 'white',
            backgroundColor: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(10px)',
            '&:hover': { 
              backgroundColor: 'rgba(255,255,255,0.25)',
              transform: 'scale(1.1)'
            },
            transition: 'all 0.2s ease'
          }}
        >
          <Close />
        </IconButton>
        
        <StatusIcon isVerified={isVerified} isExpired={isExpired} />
        
        <Typography 
          variant="h4" 
          sx={{ 
            mt: 2, 
            fontWeight: 700,
            fontSize: { xs: '1.5rem', sm: '2rem' },
            textShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          {titleText}
        </Typography>
        
        <Typography 
          variant="body1" 
          sx={{ 
            mt: 1, 
            opacity: 0.9,
            fontSize: '1.1rem'
          }}
        >
          {isVerified 
            ? isExpired 
              ? 'The credential signature is valid but has expired'
              : 'The credential has been successfully verified'
            : 'The credential could not be verified'
          }
        </Typography>
      </Box>

      <DialogContent sx={{ p: { xs: 2, sm: 4 }, mt: '-20px' }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 4 },
            borderRadius: '20px',
            backgroundColor: 'var(--template-palette-background-paper)',
            border: '1px solid var(--template-palette-divider)',
            position: 'relative',
            boxShadow: 'var(--template-shadows-8)',
            '[data-mui-color-scheme="dark"] &': {
              backgroundColor: '#1a202c',
              borderColor: 'rgba(45, 55, 72, 0.8)',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.8)',
            },
          }}
        >
          {/* Status Badge */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 4 }}>
            <Chip 
              icon={isVerified ? (isExpired ? <AccessTime /> : <Verified />) : <Shield />}
              label={statusColors.statusText}
              color={statusColors.chip}
              size="medium"
              sx={{ 
                fontWeight: 700,
                px: 3,
                py: 1,
                fontSize: '0.9rem',
                height: 40,
                borderRadius: '20px',
                boxShadow: `0 4px 12px ${alpha(statusColors.primary, 0.3)}`,
                '& .MuiChip-icon': {
                  fontSize: 20
                }
              }}
            />
          </Box>

          {/* Verification Status Section */}
          <Stack spacing={3} sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Shield sx={{ color: 'var(--template-palette-primary-main)' }} />
              <Typography 
                variant="h6" 
                sx={{ 
                  fontWeight: 700,
                  color: 'var(--template-palette-text-primary)',
                  fontSize: '1.25rem'
                }}
              >
                Verification Details
              </Typography>
            </Box>
            
            <Box sx={{ 
              display: 'grid', 
              gap: 2, 
              gridTemplateColumns: { 
                xs: '1fr', 
                sm: 'repeat(auto-fit, minmax(280px, 1fr))' 
              } 
            }}>
              <Card elevation={0} sx={{ 
                backgroundColor: alpha(statusColors.primary, 0.1),
                border: `1px solid ${alpha(statusColors.primary, 0.2)}`,
                borderRadius: '12px'
              }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Typography variant="caption" sx={{ 
                    color: statusColors.primary,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Verification Status
                  </Typography>
                  <Typography variant="h6" sx={{ 
                    fontWeight: 600,
                    color: statusColors.primary,
                    mt: 0.5
                  }}>
                    {isVerified ? 'Valid Signature' : 'Invalid Signature'}
                  </Typography>
                </CardContent>
              </Card>

              {result.verificationMessage && (
                <Card elevation={0} sx={{ 
                  backgroundColor: 'var(--template-palette-grey-50)',
                  border: '1px solid var(--template-palette-divider)',
                  borderRadius: '12px',
                  '[data-mui-color-scheme="dark"] &': {
                    backgroundColor: 'rgba(45, 55, 72, 0.5)',
                  },
                }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Typography variant="caption" sx={{ 
                      color: 'var(--template-palette-text-secondary)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Message
                    </Typography>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 500,
                      color: 'var(--template-palette-text-primary)',
                      mt: 0.5
                    }}>
                      {result.verificationMessage}
                    </Typography>
                  </CardContent>
                </Card>
              )}

              {result.verificationErrorCode && (
                <Card elevation={0} sx={{ 
                  backgroundColor: alpha(theme.palette.error.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`,
                  borderRadius: '12px'
                }}>
                  <CardContent sx={{ p: 2.5 }}>
                    <Typography variant="caption" sx={{ 
                      color: theme.palette.error.main,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Error Code
                    </Typography>
                    <Typography variant="body1" sx={{ 
                      fontWeight: 600,
                      fontFamily: 'monospace',
                      color: theme.palette.error.main,
                      mt: 0.5,
                      // backgroundColor: alpha(theme.palette.error.main, 0.1),
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      fontSize: '0.9rem'
                    }}>
                      {result.verificationErrorCode}
                    </Typography>
                  </CardContent>
                </Card>
              )}
            </Box>
          </Stack>

          {/* Credential Details Section */}
          {subject && (
            <>
              <Divider sx={{ 
                my: 4,
                borderColor: 'var(--template-palette-divider)',
                opacity: 0.6
              }} />
              <Stack spacing={3}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Verified sx={{ color: 'var(--template-palette-primary-main)' }} />
                    <Typography 
                      variant="h6" 
                      sx={{ 
                        fontWeight: 700,
                        color: 'var(--template-palette-text-primary)',
                        fontSize: '1.25rem'
                      }}
                    >
                      {formatLabel(credentialType || 'Credential')} Details
                    </Typography>
                  </Box>
                  {credential?.id && isURL(credential.id) && (
                    <Tooltip title="View Raw Credential" arrow>
                      <IconButton 
                        size="medium" 
                        href={credential.id} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        sx={{
                          backgroundColor: 'var(--template-palette-primary-main)',
                          color: 'white',
                          '&:hover': {
                            backgroundColor: 'var(--template-palette-primary-dark)',
                            transform: 'scale(1.1)'
                          },
                          transition: 'all 0.2s ease'
                        }}
                      >
                        <Launch fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>

                <Box sx={{ 
                  display: 'grid', 
                  gap: 3, 
                  gridTemplateColumns: { 
                    xs: '1fr', 
                    sm: 'repeat(2, minmax(0,1fr))', 
                    lg: 'repeat(3, minmax(0,1fr))' 
                  } 
                }}>
                  {Object.entries(subject)
                    .filter(([key]) => key.toLowerCase() !== 'id')
                    .map(([key, value]) => (
                      <CredentialField key={key} label={formatLabel(key)} value={value} />
                    ))}
                </Box>
              </Stack>
            </>
          )}
        </Paper>

        {/* Action Button */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Button 
            variant="contained"
            onClick={onClose}
            size="large"
            sx={{ 
              borderRadius: '24px',
              minWidth: 240,
              py: 1.5,
              px: 4,
              fontWeight: 700,
              fontSize: '1rem',
              textTransform: 'none',
              backgroundColor: 'var(--template-palette-primary-main)',
              boxShadow: 'var(--template-shadows-4)',
              '&:hover': {
                backgroundColor: 'var(--template-palette-primary-dark)',
                boxShadow: 'var(--template-shadows-8)',
                transform: 'translateY(-2px)'
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            Verify Another Credential
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}