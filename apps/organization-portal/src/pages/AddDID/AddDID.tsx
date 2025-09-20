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
import { OrgResolver } from '@mosip/react-inji-verify-sdk';
import { getApiBaseUrl, getAccessToken, authenticatedFetch } from '@inji-offline-verify/shared-auth';

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
  const [didValue, setDidValue] = useState(''); // kept for backward compatibility (unused for VC)
  const [fieldError, setFieldError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error'
  });
  const [vcJson, setVcJson] = useState('');

  const onChangeVc = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVcJson(e.target.value);
    if (fieldError) setFieldError('');
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

  const handleCopyVc = async () => {
    if (!vcJson) return;
    try {
      await navigator.clipboard.writeText(vcJson);
      showToast('VC JSON copied to clipboard!', 'success');
    } catch {
      showToast('Failed to copy', 'error');
    }
  };

const getOrganizationId = () => {
  // 1. Primary: check 'organizationId' (your current key)
  try {
    const orgId = localStorage.getItem('organizationId');
    if (orgId) return orgId;
  } catch {/* ignore */}

  // 2. Fallback: check 'organization' (JSON object)
  try {
    const raw = localStorage.getItem('organization');
    if (raw) {
      const obj = JSON.parse(raw);
      if (obj?.id) return obj.id;
    }
  } catch {/* ignore */}

  // 3. Other fallbacks
  const fallbacks = ['org_id', 'current_org_id'];
  for (const key of fallbacks) {
    const val = localStorage.getItem(key);
    if (val) return val;
  }

  return null;
};

  const validateInput = () => {
    if (!vcJson.trim()) {
      setFieldError('Paste full VC JSON (from QR payload)');
      return false;
    }
    try {
      JSON.parse(vcJson);
    } catch {
      setFieldError('Invalid JSON');
      return false;
    }
    setFieldError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validateInput()) return;
    setSubmitting(true);

    let parsed: any;
    try {
      parsed = JSON.parse(vcJson);
    } catch {
      showToast('Invalid JSON', 'error');
      return;
    }

    const organization_id = getOrganizationId();
    if (!organization_id) {
      showToast('No organization selected in session', 'error');
      setSubmitting(false); // Make sure to stop submitting
      return;
    }

    try {
      // Build bundle (issuer key + exact contexts) using SDK
      const bundle = await OrgResolver.buildBundleFromVC(parsed, true);
      const keys = bundle.publicKeys || [];
      const contexts = bundle.contexts || [];

      // Upsert contexts under organization
      for (const c of contexts) {
        if (!c.document) continue; // Skip contexts that couldn't be fetched
        const res = await authenticatedFetch(`/organization/api/contexts/upsert/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ organization_id, url: c.url, document: c.document })
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.detail || j?.error || `Failed to upsert context: ${c.url}`);
        }
      }

      // Upsert issuer public key(s) under organization
      for (const k of keys) {
        const payload = {
          organization_id,
          key_id: k.key_id,
          key_type: k.key_type || 'Ed25519VerificationKey2020',
          controller: k.controller,
          public_key_multibase: k.public_key_multibase || '',
          public_key_hex: k.public_key_hex || undefined,
          public_key_jwk: k.public_key_jwk || undefined,
          purpose: k.purpose || 'assertion',
          is_active: k.is_active !== false,
        };
        const res = await authenticatedFetch(`/organization/api/public-keys/upsert/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j?.detail || j?.error || 'Failed to upsert public key');
        }
      }

      showToast(`Stored keys: ${keys.length}, contexts: ${contexts.length}`, 'success');
      setVcJson('');
    } catch (e: any) {
      console.error('AddDID submission error:', e);
      showToast(e?.message || 'Failed to add VC data', 'error');
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
                        ADD SAMPLE VC DATA
                      </Typography>
                      <Typography variant="h6" sx={{ color: isDark ? '#a0aec0' : 'text.secondary', fontWeight: 400 }}>
                        Register a new Verifiable Credential (VC) to the system
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
                          Enter VC Information
                        </Typography>
                        <Typography variant="body1" sx={{ color: isDark ? '#a0aec0' : 'text.secondary' }}>
                          Paste the complete VC JSON to extract issuer keys and contexts
                        </Typography>
                      </Box>

                      <Grid container spacing={3}>
                        <Grid size={{ xs: 12 }}>
                          <StyledTextField
                            required
                            fullWidth
                            multiline
                            rows={10}
                            value={vcJson}
                            onChange={onChangeVc}
                            onKeyDown={handleKeyDown}
                            placeholder='Paste complete VC JSON starting with {"credential": {...}} *'
                            error={!!fieldError}
                            helperText={fieldError || 'Paste the entire VC JSON object. Must include credential, @context, issuer, and proof fields.'}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 2 }}>
                                  <FingerprintIcon />
                                </InputAdornment>
                              ),
                              endAdornment: vcJson && (
                                <InputAdornment position="end" sx={{ alignSelf: 'flex-start', mt: 1 }}>
                                  <Stack direction="row" spacing={1}>
                                    <IconButton
                                      onClick={handleCopyVc}
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
                                minHeight: '300px',
                                '& textarea': {
                                  fontFamily: 'monospace',
                                  fontSize: '0.875rem',
                                  lineHeight: 1.6,
                                  color: isDark ? '#ffffff !important' : 'inherit',
                                  resize: 'none',
                                  padding: '16px',
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
                          disabled={submitting || !vcJson.trim()}
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