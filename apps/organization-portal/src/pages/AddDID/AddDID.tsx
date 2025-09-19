import React, { useState } from 'react';
import {
  Box,
  Button,
  Paper,
  TextField,
  Typography,
  Stack,
  IconButton,
  InputAdornment,
  useTheme,
  Snackbar,
  Alert,
} from '@mui/material';
import { alpha, styled, useColorScheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Grid from '@mui/material/Grid';
import AppNavbar from '../../components/dash_comp/AppNavbar';
import SideMenu from '../../components/dash_comp/SideMenu';
import Header from '../../components/dash_comp/Header';
import AppTheme from '../../theme/dash_theme/AppTheme';
import { SidebarProvider } from '../../components/dash_comp/SidebarContext';
import FingerprintIcon from '@mui/icons-material/Fingerprint';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';

// Styled Components - Theme Aware with CSS Variables
const StyledTextField = styled(TextField)(({ theme, error }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '16px',
    backgroundColor: 'var(--template-palette-background-paper)',
    border: `2px solid ${error ? 'var(--template-palette-error-main)' : 'var(--template-palette-grey-300)'}`,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    color: 'var(--template-palette-text-primary)',
    
    // Dark mode overrides
    '[data-mui-color-scheme="dark"] &': {
      backgroundColor: '#2d3748',
      border: `2px solid ${error ? '#e53e3e' : '#4a5568'}`,
      color: '#ffffff',
    },
    
    '& input, & textarea': {
      color: 'var(--template-palette-text-primary)',
      fontSize: '1rem',
      padding: '16px 14px',
      
      '[data-mui-color-scheme="dark"] &': {
        color: '#ffffff',
      },
      
      // Comprehensive autocomplete styling - removes all boxes
      '&:-webkit-autofill': {
        WebkitTextFillColor: 'var(--template-palette-text-primary) !important',
        WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        '-webkit-box-shadow': '0 0 0 1000px transparent inset !important',
        transition: 'background-color 5000s ease-in-out 0s !important',
        backgroundColor: 'transparent !important',
        backgroundImage: 'none !important',
        border: 'none !important',
        outline: 'none !important',
        boxShadow: 'none !important',
        filter: 'none !important',
        '-webkit-filter': 'none !important',
        '[data-mui-color-scheme="dark"] &': {
          WebkitTextFillColor: '#ffffff !important',
          WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
          '-webkit-box-shadow': '0 0 0 1000px transparent inset !important',
        },
      },
      '&:-webkit-autofill:hover': {
        WebkitTextFillColor: 'var(--template-palette-text-primary) !important',
        WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        '-webkit-box-shadow': '0 0 0 1000px transparent inset !important',
        backgroundColor: 'transparent !important',
        backgroundImage: 'none !important',
        border: 'none !important',
        outline: 'none !important',
        boxShadow: 'none !important',
        filter: 'none !important',
        '-webkit-filter': 'none !important',
        '[data-mui-color-scheme="dark"] &': {
          WebkitTextFillColor: '#ffffff !important',
          WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
          '-webkit-box-shadow': '0 0 0 1000px transparent inset !important',
        },
      },
      '&:-webkit-autofill:focus': {
        WebkitTextFillColor: 'var(--template-palette-text-primary) !important',
        WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        '-webkit-box-shadow': '0 0 0 1000px transparent inset !important',
        backgroundColor: 'transparent !important',
        backgroundImage: 'none !important',
        border: 'none !important',
        outline: 'none !important',
        boxShadow: 'none !important',
        filter: 'none !important',
        '-webkit-filter': 'none !important',
        '[data-mui-color-scheme="dark"] &': {
          WebkitTextFillColor: '#ffffff !important',
          WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
          '-webkit-box-shadow': '0 0 0 1000px transparent inset !important',
        },
      },
      '&:-webkit-autofill:active': {
        WebkitTextFillColor: 'var(--template-palette-text-primary) !important',
        WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
        '-webkit-box-shadow': '0 0 0 1000px transparent inset !important',
        backgroundColor: 'transparent !important',
        backgroundImage: 'none !important',
        border: 'none !important',
        outline: 'none !important',
        boxShadow: 'none !important',
        filter: 'none !important',
        '-webkit-filter': 'none !important',
        '[data-mui-color-scheme="dark"] &': {
          WebkitTextFillColor: '#ffffff !important',
          WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
          '-webkit-box-shadow': '0 0 0 1000px transparent inset !important',
        },
      },
    },
    
    '& input::placeholder, & textarea::placeholder': {
      color: 'var(--template-palette-text-secondary)',
      opacity: 1,
      '[data-mui-color-scheme="dark"] &': {
        color: '#a0aec0',
      },
    },
    
    '&:hover': {
      border: `2px solid ${error ? 'var(--template-palette-error-main)' : 'var(--template-palette-primary-main)'}`,
      backgroundColor: 'var(--template-palette-grey-50)',
      transform: 'translateY(-2px)',
      boxShadow: `0 8px 25px ${alpha(theme.palette.primary.main, 0.15)}`,
      '[data-mui-color-scheme="dark"] &': {
        border: `2px solid ${error ? '#e53e3e' : '#4299e1'}`,
        backgroundColor: '#4a5568',
        boxShadow: `0 8px 25px ${alpha('#4299e1', 0.15)}`,
      },
    },
    
    '&.Mui-focused': {
      border: `2px solid ${error ? 'var(--template-palette-error-main)' : 'var(--template-palette-primary-main)'}`,
      backgroundColor: 'var(--template-palette-grey-50)',
      transform: 'translateY(-2px)',
      boxShadow: `0 8px 25px ${alpha(theme.palette.primary.main, 0.25)}`,
      '[data-mui-color-scheme="dark"] &': {
        border: `2px solid ${error ? '#e53e3e' : '#4299e1'}`,
        backgroundColor: '#4a5568',
        boxShadow: `0 8px 25px ${alpha('#4299e1', 0.25)}`,
      },
    },
    
    '& .MuiOutlinedInput-notchedOutline': {
      border: 'none',
    },
  },
  
  '& .MuiInputLabel-root': {
    display: 'none',
  },
  
  '& .MuiInputAdornment-root svg': {
    color: error ? 'var(--template-palette-error-main)' : 'var(--template-palette-primary-main)',
    fontSize: '1.25rem',
    '[data-mui-color-scheme="dark"] &': {
      color: error ? '#e53e3e' : '#4299e1',
    },
  },
  
  '& .MuiFormHelperText-root': {
    color: 'var(--template-palette-error-main)',
    fontWeight: 500,
    marginLeft: '8px',
    marginTop: '8px',
    '[data-mui-color-scheme="dark"] &': {
      color: '#e53e3e',
    },
  },
}));

const FormCard = styled(Box)(({ theme }) => ({
  borderRadius: '24px',
  padding: '40px',
  background: 'var(--template-palette-background-paper)',
  border: '1px solid var(--template-palette-divider)',
  boxShadow: 'var(--template-shadows-1)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  
  // Explicit dark mode styling
  '[data-mui-color-scheme="dark"] &': {
    background: '#2d3748',
    backgroundColor: '#2d3748',
    borderColor: '#4a5568',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8), 0 0 20px rgba(66, 153, 225, 0.1)',
    border: '1px solid rgba(66, 153, 225, 0.2)',
  },
}));

const FeatureCard = styled(Paper)(({ theme }) => ({
  padding: '24px',
  borderRadius: '16px',
  backgroundColor: 'var(--template-palette-background-paper)',
  border: '1px solid var(--template-palette-divider)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  
  '[data-mui-color-scheme="dark"] &': {
    backgroundColor: '#2d3748',
    borderColor: '#4a5568',
  },
  
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: `0 12px 30px ${alpha(theme.palette.primary.main, 0.1)}`,
    '[data-mui-color-scheme="dark"] &': {
      boxShadow: '0 12px 30px rgba(66, 153, 225, 0.2)',
    },
  },
}));

export default function AddDID() {
  const theme = useTheme();
  const { mode } = useColorScheme();
  const isDark = mode === 'dark';
  const [didValue, setDidValue] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDidValue(e.target.value);
    if (fieldError) {
      setFieldError('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleToastClose = () => {
    setToast(prev => ({ ...prev, open: false }));
  };

  const showToast = (message: string, severity: 'success' | 'error') => {
    setToast({
      open: true,
      message,
      severity
    });
  };

  const handleCopyDid = async () => {
    if (didValue) {
      try {
        await navigator.clipboard.writeText(didValue);
        showToast('DID copied to clipboard!', 'success');
      } catch (err) {
        showToast('Failed to copy DID', 'error');
      }
    }
  };

  const validateInput = () => {
    if (!didValue.trim()) {
      setFieldError('DID value is required');
      return false;
    }
    
    // Basic DID format validation (you can customize this)
    if (!didValue.startsWith('did:')) {
      setFieldError('DID must start with "did:"');
      return false;
    }
    
    if (didValue.length < 10) {
      setFieldError('DID appears to be too short');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async () => {
    if (!validateInput()) {
      return;
    }
    
    setSubmitting(true);
    try {
      // Simulate API call - replace with actual implementation when ready
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      showToast('DID added successfully!', 'success');
      setDidValue('');
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to add DID. Please try again.';
      showToast(errorMessage, 'error');
      console.error('Failed to add DID:', err?.message || err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppTheme>
      <SidebarProvider>
        <CssBaseline enableColorScheme />
        <Box sx={{ display: 'flex' }}>
          <SideMenu />
          <AppNavbar />
          {/* Main content */}
          <Box
            component="main"
            sx={(theme) => ({
              flexGrow: 1,
              backgroundColor: theme.vars
                ? `rgba(${theme.vars.palette.background.defaultChannel} / 1)`
                : alpha(theme.palette.background.default, 1),
              overflow: 'auto',
              minHeight: '100vh',
            })}
          >
            <Stack
              spacing={2}
              sx={{
                alignItems: 'center',
                mx: 3,
                pb: 5,
                mt: { xs: 8, md: 0 },
              }}
            >
              <Header />
              
              {/* Page Content */}
              <Box sx={{ width: '100%', maxWidth: 900 }}>
                <Stack spacing={4}>
                  {/* Page Header */}
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <Box sx={{ mb: 2 }}>
                      <FingerprintIcon sx={{ 
                        fontSize: 64, 
                        color: isDark ? '#4299e1' : 'primary.main', 
                        mb: 2,
                        animation: 'pulse 2s infinite',
                        '@keyframes pulse': {
                          '0%, 100%': {
                            opacity: 1,
                          },
                          '50%': {
                            opacity: 0.7,
                          },
                        },
                      }} />
                      <Typography variant="h3" sx={{ fontWeight: 800, color: isDark ? '#ffffff' : 'text.primary', mb: 1 }}>
                        Add DID
                      </Typography>
                      <Typography variant="h6" sx={{ color: isDark ? '#a0aec0' : 'text.secondary', fontWeight: 400 }}>
                        Register a new Decentralized Identifier (DID) to the system
                      </Typography>
                    </Box>
                  </Box>

                  {/* Info Cards */}
                  <Grid container spacing={3} sx={{ mb: 4 }}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FeatureCard>
                        <Box sx={{ textAlign: 'center' }}>
                          <FingerprintIcon sx={{ fontSize: 40, color: isDark ? '#4299e1' : 'primary.main', mb: 2 }} />
                          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: isDark ? '#ffffff' : 'text.primary' }}>
                            Secure Identity
                          </Typography>
                          <Typography variant="body2" sx={{ color: isDark ? '#a0aec0' : 'text.secondary' }}>
                            Decentralized identifiers provide cryptographically verifiable identity
                          </Typography>
                        </Box>
                      </FeatureCard>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FeatureCard>
                        <Box sx={{ textAlign: 'center' }}>
                          <CheckCircleIcon sx={{ fontSize: 40, color: isDark ? '#48bb78' : 'success.main', mb: 2 }} />
                          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: isDark ? '#ffffff' : 'text.primary' }}>
                            Interoperable
                          </Typography>
                          <Typography variant="body2" sx={{ color: isDark ? '#a0aec0' : 'text.secondary' }}>
                            Works across different platforms and blockchain networks
                          </Typography>
                        </Box>
                      </FeatureCard>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FeatureCard>
                        <Box sx={{ textAlign: 'center' }}>
                          <ContentCopyIcon sx={{ fontSize: 40, color: isDark ? '#ed8936' : 'warning.main', mb: 2 }} />
                          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, color: isDark ? '#ffffff' : 'text.primary' }}>
                            Persistent
                          </Typography>
                          <Typography variant="body2" sx={{ color: isDark ? '#a0aec0' : 'text.secondary' }}>
                            DIDs remain valid and resolvable over long periods of time
                          </Typography>
                        </Box>
                      </FeatureCard>
                    </Grid>
                  </Grid>

                  {/* Form Container */}
                  <FormCard>
                    <Stack spacing={4}>
                      <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: isDark ? '#ffffff' : 'text.primary' }}>
                          Enter DID Information
                        </Typography>
                        <Typography variant="body1" sx={{ color: isDark ? '#a0aec0' : 'text.secondary' }}>
                          Provide the DID string to register it in the system
                        </Typography>
                      </Box>

                      <Grid container spacing={3}>
                        <Grid size={{ xs: 12 }}>
                          <StyledTextField
                            required
                            fullWidth
                            multiline
                            rows={6}
                            value={didValue}
                            onChange={onChange}
                            onKeyDown={handleKeyDown}
                            placeholder="Enter DID (e.g., did:example:123456789abcdefghi) *"
                            error={!!fieldError}
                            helperText={fieldError || "Enter a valid DID string. DIDs typically start with 'did:' followed by the method and identifier."}
                            FormHelperTextProps={{
                              sx: {
                                color: fieldError 
                                  ? (isDark ? '#fc8181' : 'error.main')
                                  : (isDark ? '#a0aec0' : 'text.secondary'),
                                fontSize: '0.875rem',
                                fontWeight: 500,
                                mt: 1,
                              }
                            }}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 2 }}>
                                  <FingerprintIcon />
                                </InputAdornment>
                              ),
                              endAdornment: didValue && (
                                <InputAdornment position="end" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                                  <Stack direction="row" spacing={1}>
                                    <IconButton
                                      onClick={handleCopyDid}
                                      edge="end"
                                      size="small"
                                      sx={{ 
                                        color: isDark ? '#90cdf4' : 'text.secondary',
                                        backgroundColor: isDark ? 'rgba(66, 153, 225, 0.1)' : 'rgba(0, 0, 0, 0.04)',
                                        border: isDark ? '1px solid rgba(66, 153, 225, 0.3)' : '1px solid rgba(0, 0, 0, 0.1)',
                                        borderRadius: '6px',
                                        '&:hover': { 
                                          color: isDark ? '#4299e1' : 'primary.main',
                                          backgroundColor: isDark ? 'rgba(66, 153, 225, 0.2)' : 'rgba(25, 118, 210, 0.1)',
                                          transform: 'scale(1.1)',
                                        },
                                        '&:active': {
                                          transform: 'scale(0.95)',
                                        }
                                      }}
                                    >
                                      <ContentCopyIcon />
                                    </IconButton>
                                  </Stack>
                                </InputAdornment>
                              ),
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                minHeight: '160px',
                                '& textarea': {
                                  fontFamily: 'monospace',
                                  fontSize: '1rem',
                                  lineHeight: 1.6,
                                  color: isDark ? '#ffffff !important' : 'inherit',
                                  resize: 'none',
                                  '&::placeholder': {
                                    color: isDark ? '#a0aec0 !important' : 'inherit',
                                    opacity: 1,
                                  },
                                },
                              },
                            }}
                          />
                        </Grid>
                      </Grid>

                      {/* DID Format Examples */}
                      {/* <Paper sx={{ 
                        p: 3, 
                        borderRadius: 3, 
                        bgcolor: isDark ? '#2d3748' : '#f7fafc',
                        border: `1px solid ${isDark ? '#4a5568' : '#e2e8f0'}`,
                      }}> */}
                        {/* <Typography variant="h6" sx={{ 
                          fontWeight: 600, 
                          mb: 2, 
                          color: isDark ? '#4299e1' : 'primary.main',
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 1,
                        }}>
                          <FingerprintIcon />
                          DID Format Examples
                        </Typography> */}
                        {/* <Stack spacing={2}>
                          <Box>
                            <Typography variant="body2" sx={{ 
                              color: isDark ? '#a0aec0' : 'text.secondary',
                              mb: 0.5
                            }}>
                              Web DID:
                            </Typography>
                            <Typography variant="body2" sx={{ 
                              fontFamily: 'monospace',
                              color: isDark ? '#90cdf4' : 'primary.main',
                              backgroundColor: isDark ? '#1a202c' : '#edf2f7',
                              p: 1,
                              borderRadius: 1,
                            }}>
                              did:web:example.com:users:alice
                            </Typography>
                          </Box>
                          <Box>
                            <Typography variant="body2" sx={{ 
                              color: isDark ? '#a0aec0' : 'text.secondary',
                              mb: 0.5
                            }}>
                              Key DID:
                            </Typography>
                            <Typography variant="body2" sx={{ 
                              fontFamily: 'monospace',
                              color: isDark ? '#90cdf4' : 'primary.main',
                              backgroundColor: isDark ? '#1a202c' : '#edf2f7',
                              p: 1,
                              borderRadius: 1,
                            }}>
                              did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK
                            </Typography>
                          </Box>
                        </Stack> */}
                      {/* </Paper> */}

                      {/* Submit Button */}
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'center',
                        pt: 4, 
                        borderTop: `2px solid ${isDark ? '#4a5568' : theme.palette.divider}`,
                        background: isDark 
                          ? 'linear-gradient(to bottom, transparent, rgba(66, 153, 225, 0.05))'
                          : 'linear-gradient(to bottom, transparent, rgba(25, 118, 210, 0.02))',
                        borderRadius: '0 0 24px 24px',
                        mx: -5,
                        px: 5,
                        pb: 2,
                      }}>
                        <Button
                          onClick={handleSubmit}
                          variant="contained"
                          disabled={submitting || !didValue.trim()}
                          startIcon={<CheckCircleIcon />}
                          sx={{
                            borderRadius: '12px',
                            px: 6,
                            py: 1.5,
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '1.1rem',
                            minWidth: '200px',
                            background: isDark ? '#ffffff' : theme.palette.primary.main,
                            color: isDark ? '#1a202c' : '#ffffff',
                            boxShadow: `0 4px 12px ${alpha(isDark ? '#ffffff' : theme.palette.primary.main, 0.25)}`,
                            outline: 'none',
                            border: 'none',
                            '&:hover': {
                              background: isDark ? '#90cdf4' : theme.palette.primary.dark,
                              color: isDark ? '#1a202c' : '#ffffff',
                              transform: 'translateY(-1px)',
                              boxShadow: `0 6px 20px ${alpha(isDark ? '#90cdf4' : theme.palette.primary.main, 0.3)}`,
                              outline: 'none',
                              border: 'none',
                            },
                            '&:focus': {
                              outline: 'none',
                              border: 'none',
                              boxShadow: `0 6px 20px ${alpha(isDark ? '#90cdf4' : theme.palette.primary.main, 0.3)}`,
                            },
                            '&:active': {
                              outline: 'none',
                              border: 'none',
                            },
                            '&.Mui-disabled': {
                              background: isDark ? '#4a5568' : theme.palette.action.disabled,
                              color: isDark ? '#718096' : theme.palette.action.disabled,
                              boxShadow: 'none',
                              outline: 'none',
                              border: 'none',
                            }
                          }}
                        >
                          {submitting ? 'Adding DID...' : 'Add DID'}
                        </Button>
                      </Box>
                    </Stack>
                  </FormCard>
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Box>

        {/* Toast Notifications */}
        <Snackbar
          open={toast.open}
          autoHideDuration={6000}
          onClose={handleToastClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert
            onClose={handleToastClose}
            severity={toast.severity}
            variant="filled"
            sx={{
              width: '100%',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '1rem',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
            }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      </SidebarProvider>
    </AppTheme>
  );
}