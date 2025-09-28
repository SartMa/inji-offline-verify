import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CssBaseline from '@mui/material/CssBaseline';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import FormControl from '@mui/material/FormControl';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import MuiCard from '@mui/material/Card';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import { styled } from '@mui/material/styles';
import ForgotPassword from '@inji-offline-verify/shared-ui/src/components/ForgotPassword';
import { AppTheme, ColorModeSelect } from '@inji-offline-verify/shared-ui/src/theme';
import { useAuth } from './context/AuthContext.tsx';
import { login } from './services/authService';
import { WorkerCacheService } from './services/WorkerCacheService';
import { NetworkManager } from './network/NetworkManager';

const Card = styled(MuiCard)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignSelf: 'center',
  width: '100%',
  padding: theme.spacing(4),
  gap: theme.spacing(2),
  margin: 'auto',
  [theme.breakpoints.up('sm')]: {
    maxWidth: '450px',
  },
  boxShadow:
    'hsla(220, 30%, 5%, 0.05) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.05) 0px 15px 35px -5px',
  ...theme.applyStyles('dark', {
    boxShadow:
      'hsla(220, 30%, 5%, 0.5) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.08) 0px 15px 35px -5px',
  }),
}));

const SignInContainer = styled(Stack)(({ theme }) => ({
  minHeight: '100vh',
  padding: theme.spacing(2),
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(4),
  },
  '&::before': {
    content: '""',
    display: 'block',
    position: 'absolute',
    zIndex: -1,
    inset: 0,
    minHeight: '100vh',
    backgroundImage:
      'radial-gradient(ellipse at 50% 50%, hsl(210, 100%, 97%), hsl(0, 0%, 100%))',
    backgroundRepeat: 'no-repeat',
    ...theme.applyStyles('dark', {
      backgroundImage:
        'radial-gradient(at 50% 50%, hsla(210, 100%, 16%, 0.5), hsl(220, 30%, 5%))',
    }),
  },
}));

export default function SignIn(props: { 
  disableCustomTheme?: boolean; 
  onSwitchToSignUp?: () => void;
  onSwitchToOrgSignIn?: () => void;
}) {
  const navigate = useNavigate();
  // Base URL now resolved internally by shared-auth login helpers
  const [orgName, setOrgName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [emailError, setEmailError] = React.useState(false);
  const [emailErrorMessage, setEmailErrorMessage] = React.useState('');
  const [passwordError, setPasswordError] = React.useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = React.useState('');
  const [orgError, setOrgError] = React.useState(false);
  const [orgErrorMessage, setOrgErrorMessage] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [toastOpen, setToastOpen] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState('');
  const [toastSeverity, setToastSeverity] = React.useState<'error' | 'success' | 'info' | 'warning'>('error');
  const { signIn } = useAuth();

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleToastClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setToastOpen(false);
  };

  const showToast = (message: string, severity: 'error' | 'success' | 'info' | 'warning' = 'error') => {
    setToastMessage(message);
    setToastSeverity(severity);
    setToastOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateInputs()) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await login({ 
        username, 
        password, 
        org_name: orgName 
      });
      // Prime SDK cache directly from server for this organization
      const orgId = res?.organization?.id;
      if (orgId) {
        try {
          const bundle = await buildServerCacheBundle(orgId);
          await WorkerCacheService.primeFromServer(bundle);
          console.log('SDK cache primed for organization:', orgId);
        } catch (e) {
          console.warn('Priming SDK cache failed:', e);
        }
      }

      // Use the auth context signIn method to update the global state
      await signIn(username, password);
      
      // Redirect to dashboard after successful login
      navigate('/dashboard');
      showToast('Successfully signed in!', 'success');
    } catch (error: any) {
      console.error('Sign in failed:', error);
      
      // The auth service now properly extracts and throws the server error message
      const errorMessage = error?.message || 'Invalid credentials';
      showToast(`Login failed: ${errorMessage}`, 'error');
      // Don't set field errors since we're using toast notifications
    } finally {
      setIsLoading(false);
    }
  };

  const validateInputs = () => {
    const orgInput = document.getElementById('organization') as HTMLInputElement;
    const usernameInput = document.getElementById('username') as HTMLInputElement;
    const passwordInput = document.getElementById('password') as HTMLInputElement;

    let isValid = true;

    // Validate Organization
    if (!orgInput.value || orgInput.value.trim().length < 2) {
      setOrgError(true);
      setOrgErrorMessage('Organization name must be at least 2 characters long.');
      isValid = false;
    } else {
      setOrgError(false);
      setOrgErrorMessage('');
    }

    // Validate Username
    if (!usernameInput.value || usernameInput.value.trim().length < 3) {
      setEmailError(true);
      setEmailErrorMessage('Username must be at least 3 characters long.');
      isValid = false;
    } else {
      setEmailError(false);
      setEmailErrorMessage('');
    }

    // Validate Password
    if (!passwordInput.value || passwordInput.value.length < 6) {
      setPasswordError(true);
      setPasswordErrorMessage('Password must be at least 6 characters long.');
      isValid = false;
    } else {
      setPasswordError(false);
      setPasswordErrorMessage('');
    }

    return isValid;
  };

  return (
    <AppTheme {...props}>
      <CssBaseline enableColorScheme />
      <SignInContainer direction="column" justifyContent="space-between">
        <ColorModeSelect sx={{ position: 'fixed', top: '1rem', right: '1rem' }} />
        <Card variant="outlined">
          <Typography
            component="h1"
            variant="h4"
            sx={{ width: '100%', fontSize: 'clamp(2rem, 10vw, 2.15rem)' }}
          >
            Sign in
          </Typography>
          <Box
            component="form"
            onSubmit={handleSubmit}
            noValidate
            sx={{
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              gap: 2,
            }}
          >
            <FormControl>
              <FormLabel htmlFor="organization">Organization</FormLabel>
              <TextField
                error={orgError}
                helperText={orgErrorMessage}
                id="organization"
                type="text"
                name="organization"
                placeholder="Organization Name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                autoComplete="organization"
                required
                fullWidth
                variant="outlined"
                color={orgError ? 'error' : 'primary'}
                sx={() => ({
                  '& input:-webkit-autofill': {
                    WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
                    WebkitTextFillColor: 'inherit !important',
                    transition: 'background-color 5000s ease-in-out 0s !important',
                    backgroundColor: 'transparent !important',
                  },
                  '& input:-webkit-autofill:hover': {
                    WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
                    WebkitTextFillColor: 'inherit !important',
                    backgroundColor: 'transparent !important',
                  },
                  '& input:-webkit-autofill:focus': {
                    WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
                    WebkitTextFillColor: 'inherit !important',
                    backgroundColor: 'transparent !important',
                  },
                  '& input:-webkit-autofill:active': {
                    WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
                    WebkitTextFillColor: 'inherit !important',
                    backgroundColor: 'transparent !important',
                  }
                })}
              />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="username">Username</FormLabel>
              <TextField
                error={emailError}
                helperText={emailErrorMessage}
                id="username"
                type="text"
                name="username"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                fullWidth
                variant="outlined"
                color={emailError ? 'error' : 'primary'}
                sx={() => ({
                  '& input:-webkit-autofill': {
                    WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
                    WebkitTextFillColor: 'inherit !important',
                    transition: 'background-color 5000s ease-in-out 0s !important',
                    backgroundColor: 'transparent !important',
                  },
                  '& input:-webkit-autofill:hover': {
                    WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
                    WebkitTextFillColor: 'inherit !important',
                    backgroundColor: 'transparent !important',
                  },
                  '& input:-webkit-autofill:focus': {
                    WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
                    WebkitTextFillColor: 'inherit !important',
                    backgroundColor: 'transparent !important',
                  },
                  '& input:-webkit-autofill:active': {
                    WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
                    WebkitTextFillColor: 'inherit !important',
                    backgroundColor: 'transparent !important',
                  }
                })}
              />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="password">Password</FormLabel>
              <TextField
                error={passwordError}
                helperText={passwordErrorMessage}
                name="password"
                placeholder="Password"
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                fullWidth
                variant="outlined"
                color={passwordError ? 'error' : 'primary'}
                sx={() => ({
                  '& input:-webkit-autofill': {
                    WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
                    WebkitTextFillColor: 'inherit !important',
                    transition: 'background-color 5000s ease-in-out 0s !important',
                    backgroundColor: 'transparent !important',
                  },
                  '& input:-webkit-autofill:hover': {
                    WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
                    WebkitTextFillColor: 'inherit !important',
                    backgroundColor: 'transparent !important',
                  },
                  '& input:-webkit-autofill:focus': {
                    WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
                    WebkitTextFillColor: 'inherit !important',
                    backgroundColor: 'transparent !important',
                  },
                  '& input:-webkit-autofill:active': {
                    WebkitBoxShadow: '0 0 0 1000px transparent inset !important',
                    WebkitTextFillColor: 'inherit !important',
                    backgroundColor: 'transparent !important',
                  }
                })}
              />
            </FormControl>
            <FormControlLabel
              control={<Checkbox value="remember" color="primary" />}
              label="Remember me"
            />
            <ForgotPassword open={open} handleClose={handleClose} />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading}
              onClick={validateInputs}
              sx={(theme) => ({
                // Default styles (for light mode)
                '&:disabled': {
                  color: '#fff', // White text for light mode
                },
                // Use the theme's custom helper for dark mode styles
                ...theme.applyStyles('dark', {
                  '&:disabled': {
                    color: '#000', // Black text for dark mode
                  },
                }),
              })}
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
            <Link
              component="button"
              type="button"
              onClick={handleClickOpen}
              variant="body2"
              sx={{ alignSelf: 'center' }}
            >
              Forgot your password?
            </Link>
          </Box>
        </Card>
        
        {/* Toast Notification */}
        <Snackbar
          open={toastOpen}
          autoHideDuration={6000}
          onClose={handleToastClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          sx={{ mt: 8 }}
        >
          <Alert
            onClose={handleToastClose}
            severity={toastSeverity}
            variant="filled"
            sx={{ width: '100%' }}
          >
            {toastMessage}
          </Alert>
        </Snackbar>
      </SignInContainer>
    </AppTheme>
  );
}

// Build a CacheBundle for SDK from backend endpoints
async function buildServerCacheBundle(organizationId: string) {
  // Fetch contexts
  const ctxRes = await NetworkManager.fetch(`/organization/api/contexts/?organization_id=${encodeURIComponent(organizationId)}`, { method: 'GET' });
  if (!ctxRes.ok) throw new Error(`Failed to fetch contexts (${ctxRes.status})`);
  const ctxJson = await ctxRes.json();
  const contexts = Array.isArray(ctxJson?.contexts)
    ? ctxJson.contexts.map((c: any) => ({ url: c.url, document: c.document }))
    : [];

  // Fetch public keys
  const pkRes = await NetworkManager.fetch(`/organization/api/public-keys/?organization_id=${encodeURIComponent(organizationId)}`, { method: 'GET' });
  if (!pkRes.ok) throw new Error(`Failed to fetch public keys (${pkRes.status})`);
  const pkJson = await pkRes.json();
  const publicKeys = Array.isArray(pkJson?.keys)
    ? pkJson.keys.map((k: any) => ({
        key_id: k.key_id,
        key_type: k.key_type,
        public_key_multibase: k.public_key_multibase,
        public_key_hex: k.public_key_hex,
        public_key_jwk: k.public_key_jwk,
        controller: k.controller,
        purpose: k.purpose,
        is_active: k.is_active,
        organization_id: organizationId,
      }))
    : [];

  // Fetch revoked VCs
  const rvcRes = await NetworkManager.fetch(`/organization/api/revoked-vcs/?organization_id=${encodeURIComponent(organizationId)}`, { method: 'GET' });
  if (!rvcRes.ok) throw new Error(`Failed to fetch revoked VCs (${rvcRes.status})`);
  const rvcJson = await rvcRes.json();
  const revokedVCs = Array.isArray(rvcJson?.revoked_vcs)
    ? rvcJson.revoked_vcs.map((vc: any) => ({
        vc_id: vc.vc_id,
        issuer: vc.issuer,
        subject: vc.subject,
        reason: vc.reason,
        revoked_at: vc.revoked_at,
        organization_id: organizationId,
      }))
    : [];

  return { publicKeys, contexts, revokedVCs } as any;
}
