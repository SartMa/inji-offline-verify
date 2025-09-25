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
import SecurityIcon from '@mui/icons-material/Security';
import LinkIcon from '@mui/icons-material/Link';
import VerifiedIcon from '@mui/icons-material/Verified';
import { OrgResolver } from '@mosip/react-inji-verify-sdk';
import { getApiBaseUrl, getAccessToken, authenticatedFetch } from '@inji-offline-verify/shared-auth';

// Styled Components - Matching AddWorker.tsx exactly
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
      boxShadow: `0 8px 25px ${alpha(theme.palette.primary.main, 0.08)}`,
      '[data-mui-color-scheme="dark"] &': {
        border: `2px solid ${error ? '#e53e3e' : '#4299e1'}`,
        backgroundColor: '#3c4758',
        boxShadow: `0 8px 25px ${alpha('#4299e1', 0.08)}`,
      },
    },
    
    '&.Mui-focused': {
      border: `2px solid ${error ? 'var(--template-palette-error-main)' : 'var(--template-palette-primary-main)'}`,
      backgroundColor: 'var(--template-palette-grey-50)',
      transform: 'translateY(-2px)',
      boxShadow: `0 8px 25px ${alpha(theme.palette.primary.main, 0.12)}`,
      '[data-mui-color-scheme="dark"] &': {
        border: `2px solid ${error ? '#e53e3e' : '#4299e1'}`,
        backgroundColor: '#3c4758',
        boxShadow: `0 8px 25px ${alpha('#4299e1', 0.12)}`,
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

// Main card matching AddWorker exactly
const StepCard = styled(Box)(({ theme }) => ({
  borderRadius: '24px',
  padding: '40px',
  background: 'var(--template-palette-background-paper)',
  border: '1px solid var(--template-palette-divider)',
  boxShadow: 'var(--template-shadows-1)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  
  // Explicit dark mode styling
  '[data-mui-color-scheme="dark"] &': {
    background: '#1a202c',
    backgroundColor: '#1a202c',
    borderColor: 'rgba(45, 55, 72, 0.8)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
  },
}));

// Feature cards matching AddWorker pattern
const FeatureCard = styled(Paper)(({ theme }) => ({
  padding: '20px 16px',
  borderRadius: '16px',
  backgroundColor: 'var(--template-palette-background-paper)',
  border: '1px solid var(--template-palette-divider)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  height: '100%',
  
  '[data-mui-color-scheme="dark"] &': {
    backgroundColor: '#1a202c',
    borderColor: 'rgba(45, 55, 72, 0.8)',
  },
  
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: `0 12px 30px ${alpha(theme.palette.primary.main, 0.08)}`,
    borderColor: 'var(--template-palette-primary-main)',
    '[data-mui-color-scheme="dark"] &': {
      boxShadow: '0 12px 30px rgba(66, 153, 225, 0.15)',
      borderColor: '#4299e1',
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

      showToast(`Successfully stored ${keys.length} keys and ${contexts.length} contexts`, 'success');
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
                maxWidth: '100%',
                overflow: 'hidden',
              }}
            >
              <Header />
              
              {/* Page Content */}
              <Box sx={{ width: '100%', maxWidth: 900, overflow: 'hidden' }}>
                <Stack spacing={4}>
                  {/* Page Header - Matching AddWorker exactly */}
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="h3" sx={{ fontWeight: 800, color: isDark ? '#ffffff' : 'text.primary', mb: 1 }}>
                        Add Sample VC Data
                      </Typography>
                      <Typography variant="h6" sx={{ color: isDark ? '#a0aec0' : 'text.secondary', fontWeight: 400 }}>
                        Register verifiable credential data to enable verification services
                      </Typography>
                    </Box>
                  </Box>

                  {/* Feature Cards - Improved layout matching AddWorker */}
                  <Grid container spacing={3} sx={{ mb: 2 }}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FeatureCard>
                        <Box sx={{ textAlign: 'center' }}>
                          <Box sx={{ 
                            width: 48, 
                            height: 48, 
                            borderRadius: '12px',
                            backgroundColor: isDark ? 'rgba(66, 153, 225, 0.1)' : alpha(theme.palette.primary.main, 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 12px auto',
                          }}>
                            <SecurityIcon sx={{ fontSize: 28, color: isDark ? '#4299e1' : 'primary.main' }} />
                          </Box>
                          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5, color: isDark ? '#ffffff' : 'text.primary' }}>
                            Secure Verification
                          </Typography>
                          <Typography variant="body2" sx={{ color: isDark ? '#a0aec0' : 'text.secondary', lineHeight: 1.6 }}>
                            Cryptographically secure verification using decentralized identifiers and digital signatures
                          </Typography>
                        </Box>
                      </FeatureCard>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FeatureCard>
                        <Box sx={{ textAlign: 'center' }}>
                          <Box sx={{ 
                            width: 64, 
                            height: 64, 
                            borderRadius: '16px',
                            backgroundColor: isDark ? 'rgba(72, 187, 120, 0.1)' : alpha(theme.palette.success.main, 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px auto',
                          }}>
                            <LinkIcon sx={{ fontSize: 32, color: isDark ? '#48bb78' : 'success.main' }} />
                          </Box>
                          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5, color: isDark ? '#ffffff' : 'text.primary' }}>
                            Interoperable
                          </Typography>
                          <Typography variant="body2" sx={{ color: isDark ? '#a0aec0' : 'text.secondary', lineHeight: 1.6 }}>
                            Standards-compliant implementation that works across different platforms and ecosystems
                          </Typography>
                        </Box>
                      </FeatureCard>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <FeatureCard>
                        <Box sx={{ textAlign: 'center' }}>
                          <Box sx={{ 
                            width: 64, 
                            height: 64, 
                            borderRadius: '16px',
                            backgroundColor: isDark ? 'rgba(237, 137, 54, 0.1)' : alpha(theme.palette.warning.main, 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px auto',
                          }}>
                            <VerifiedIcon sx={{ fontSize: 32, color: isDark ? '#ed8936' : 'warning.main' }} />
                          </Box>
                          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5, color: isDark ? '#ffffff' : 'text.primary' }}>
                            Persistent Identity
                          </Typography>
                          <Typography variant="body2" sx={{ color: isDark ? '#a0aec0' : 'text.secondary', lineHeight: 1.6 }}>
                            Long-lasting digital identities that remain valid and resolvable over extended periods
                          </Typography>
                        </Box>
                      </FeatureCard>
                    </Grid>
                  </Grid>

                  {/* Form Container - Matching AddWorker exactly */}
                  <StepCard>
                    <Stack spacing={4}>
                      <Box sx={{ textAlign: 'center', mb: 3 }}>
                        <FingerprintIcon sx={{ fontSize: 48, color: isDark ? '#4299e1' : 'primary.main', mb: 2 }} />
                        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1, color: isDark ? '#ffffff' : 'text.primary' }}>
                          Verifiable Credential Data
                        </Typography>
                        <Typography variant="body1" sx={{ color: isDark ? '#a0aec0' : 'text.secondary' }}>
                          Paste the complete VC JSON to extract and register issuer keys and contexts
                        </Typography>
                      </Box>

                      <Grid container spacing={3}>
                        <Grid size={{ xs: 12 }}>
                          <StyledTextField
                            required
                            fullWidth
                            multiline
                            rows={1}
                            value={vcJson}
                            onChange={onChangeVc}
                            onKeyDown={handleKeyDown}
                            placeholder='Paste complete VC JSON starting with {"credential": {...}} *'
                            error={!!fieldError}
                            // helperText={fieldError || 'Enter the entire VC JSON object including credential, @context, issuer, and proof fields for automatic key and context extraction.'}
                            InputProps={{
                              startAdornment: (
                                <InputAdornment position="start">
                                  <IconButton
                                    edge="end"
                                    sx={{ 
                                      color: isDark ? '#a0aec0' : 'text.secondary',
                                      backgroundColor: 'transparent !important',
                                      border: 'none !important',
                                      boxShadow: 'none !important',
                                      padding: '8px',
                                      margin: 0,
                                      '&:hover': { 
                                        color: isDark ? '#4299e1' : 'primary.main',
                                        backgroundColor: 'transparent !important',
                                        boxShadow: 'none !important',
                                      },
                                      '&:focus': {
                                        backgroundColor: 'transparent !important',
                                        boxShadow: 'none !important',
                                        outline: 'none',
                                      },
                                      '&:active': {
                                        backgroundColor: 'transparent !important',
                                        boxShadow: 'none !important',
                                      },
                                      '& .MuiTouchRipple-root': {
                                        display: 'none',
                                      }
                                    }}
                                  >
                                    <FingerprintIcon />
                                  </IconButton>
                                </InputAdornment>
                              ),
                              endAdornment: vcJson && (
                                <InputAdornment position="end">
                                  <IconButton
                                    onClick={handleCopyVc}
                                    edge="end"
                                    sx={{ 
                                      color: isDark ? '#a0aec0' : 'text.secondary',
                                      backgroundColor: 'transparent !important',
                                      border: 'none !important',
                                      boxShadow: 'none !important',
                                      padding: '8px',
                                      margin: 0,
                                      '&:hover': { 
                                        color: isDark ? '#4299e1' : 'primary.main',
                                        backgroundColor: 'transparent !important',
                                        boxShadow: 'none !important',
                                      },
                                      '&:focus': {
                                        backgroundColor: 'transparent !important',
                                        boxShadow: 'none !important',
                                        outline: 'none',
                                      },
                                      '&:active': {
                                        backgroundColor: 'transparent !important',
                                        boxShadow: 'none !important',
                                      },
                                      '& .MuiTouchRipple-root': {
                                        display: 'none',
                                      }
                                    }}
                                  >
                                    <ContentCopyIcon />
                                  </IconButton>
                                </InputAdornment>
                              ),
                            }}
                            sx={{
                              '& .MuiOutlinedInput-root': {
                                minHeight: '260px',
                                maxHeight: '400px',
                                alignItems: 'flex-start',
                                position: 'relative',
                                
                                // Better adornment positioning
                                '& .MuiInputAdornment-positionStart': {
                                  position: 'absolute',
                                  top: '16px',
                                  left: '14px',
                                  zIndex: 1,
                                  margin: 0,
                                },
                                '& .MuiInputAdornment-positionEnd': {
                                  position: 'absolute',
                                  top: '16px',
                                  right: '14px',
                                  zIndex: 1,
                                  margin: 0,
                                },
                                
                                '& textarea': {
                                  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                  fontSize: '0.875rem',
                                  lineHeight: 1.6,
                                  color: isDark ? '#e2e8f0 !important' : 'inherit',
                                  resize: 'vertical',
                                  minHeight: '220px',
                                  maxHeight: '360px',
                                  width: '100% !important',
                                  maxWidth: '100% !important',
                                  boxSizing: 'border-box !important',
                                  padding: '12px 50px 12px 50px !important', // Reserve space for icons
                                  // marginBottom: '3px !important',
                                  border: 'none',
                                  outline: 'none',
                                  overflowY: 'auto',
                                  overflowX: 'hidden',
                                  wordWrap: 'break-word',
                                  wordBreak: 'break-word',
                                  whiteSpace: 'pre-wrap',
                                  
                                  // Hide scrollbar completely but keep scroll functionality
                                  scrollbarWidth: 'none', // Firefox
                                  msOverflowStyle: 'none', // IE and Edge
                                  
                                  '&::-webkit-scrollbar': {
                                    display: 'none', // Chrome, Safari, Opera
                                  },
                                  
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

                      {/* Summary Card - Matching AddWorker pattern */}
                      { /* {vcJson && (
                        <Paper sx={{ 
                          p: 3, 
                          borderRadius: 3, 
                          bgcolor: '#f8fdf8',
                          border: `1px solid var(--template-palette-success-main)`,
                          boxShadow: `0 0 20px ${alpha(theme.palette.success.main, 0.1)}`,
                          '[data-mui-color-scheme="dark"] &': {
                            bgcolor: '#1a202c',
                            backgroundColor: '#1a202c',
                            border: '1px solid #48bb78',
                            boxShadow: '0 0 20px rgba(72, 187, 120, 0.2)',
                          }
                        }}>
                          <Typography variant="h6" sx={{ 
                            fontWeight: 600, 
                            mb: 2, 
                            color: 'var(--template-palette-success-main)',
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 1,
                            '[data-mui-color-scheme="dark"] &': {
                              color: '#48bb78',
                            }
                          }}>
                            <CheckCircleIcon />
                            Ready for Processing
                          </Typography>
                          <Typography variant="body2" sx={{ 
                            color: 'var(--template-palette-text-secondary)',
                            lineHeight: 1.6,
                            '[data-mui-color-scheme="dark"] &': {
                              color: '#a0aec0',
                            }
                          }}>
                            Your VC JSON will be processed to extract issuer public keys and JSON-LD contexts. 
                            These will be stored securely in your organization's registry for verification purposes.
                          </Typography>
                        </Paper>
                      )} */}

                      {/* Submit Button - Matching AddWorker exactly */}
                      <Box sx={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        mt: 4, 
                        pt: 3, 
                        borderTop: `1px solid ${isDark ? '#4a5568' : theme.palette.divider}` 
                      }}>
                        <Button
                          onClick={handleSubmit}
                          variant="contained"
                          disabled={submitting || !vcJson.trim()}
                          endIcon={<CheckCircleIcon />}
                          sx={{
                            borderRadius: '12px',
                            px: 4,
                            py: 1.5,
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '1rem',
                            background: isDark 
                              ? 'linear-gradient(135deg, #4299e1 0%, #3182ce 100%)'
                              : `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                            color: '#ffffff',
                            boxShadow: `0 8px 25px ${alpha(isDark ? '#4299e1' : theme.palette.primary.main, 0.25)}`,
                            outline: 'none',
                            border: 'none',
                            '&:hover': {
                              background: isDark
                                ? 'linear-gradient(135deg, #3182ce 0%, #2c5282 100%)'
                                : `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                              transform: 'translateY(-2px)',
                              boxShadow: `0 12px 35px ${alpha(isDark ? '#4299e1' : theme.palette.primary.main, 0.35)}`,
                              borderColor: isDark ? '#4299e1' : theme.palette.primary.dark,
                            },
                            '&:disabled': {
                              background: isDark ? '#4a5568' : theme.palette.grey[300],
                              color: isDark ? '#a0aec0' : theme.palette.grey[500],
                              boxShadow: 'none',
                              transform: 'none',
                            },
                          }}
                        >
                          {submitting ? 'Processing VC...' : 'Add VC Data'}
                        </Button>
                      </Box>
                    </Stack>
                  </StepCard>
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Box>

        {/* Toast Notification - Matching AddWorker exactly */}
        <Snackbar
          open={toast.open}
          autoHideDuration={6000}
          onClose={handleToastClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          sx={{ mt: 8 }}
        >
          <Alert
            onClose={handleToastClose}
            severity={toast.severity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      </SidebarProvider>
    </AppTheme>
  );
}