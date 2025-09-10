import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CssBaseline from '@mui/material/CssBaseline';
import FormControlLabel from '@mui/material/FormControlLabel';
import Divider from '@mui/material/Divider';
import FormLabel from '@mui/material/FormLabel';
import FormControl from '@mui/material/FormControl';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import MuiCard from '@mui/material/Card';
import { styled } from '@mui/material/styles';
import ForgotPassword from './components/ForgotPassword';
import AppTheme from './theme/AppTheme';
import ColorModeSelect from './theme/ColorModeSelect';
import { GoogleIcon, FacebookIcon, SitemarkIcon } from './components/CustomIcons';
import { useAuth } from './context/AuthContext.tsx';
import { login, setApiBaseUrl } from './services/authService';
import { PublicKeyService } from './services/PublicKeyService';
import { ContextService } from './services/ContextService';
import { ContextCache } from './cache/KeyCacheManager';
import { KeyCacheManager } from './cache/KeyCacheManager';

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

interface OrgSignInProps {
  disableCustomTheme?: boolean;
  onSwitchToSignUp?: () => void;
  onSwitchToWorkerSignIn?: () => void;
}

export default function OrgSignIn({ disableCustomTheme, onSwitchToSignUp, onSwitchToWorkerSignIn }: OrgSignInProps) {
  const navigate = useNavigate();
  const [baseUrl] = React.useState('http://127.0.0.1:8000'); // Hidden - always the same
  const [orgName, setOrgName] = React.useState('Acme Corp1');
  const [username, setUsername] = React.useState('alice1');
  const [password, setPassword] = React.useState('admin123');
  const [orgError, setOrgError] = React.useState(false);
  const [orgErrorMessage, setOrgErrorMessage] = React.useState('');
  const [usernameError, setUsernameError] = React.useState(false);
  const [usernameErrorMessage, setUsernameErrorMessage] = React.useState('');
  const [passwordError, setPasswordError] = React.useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const { signIn } = useAuth();

  const handleClickOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateInputs()) {
      return;
    }

    setIsLoading(true);
    try {
      setApiBaseUrl(baseUrl);
      
      // Use the exact organization login format from Postman collection
      const loginData = {
        "username": username.trim(),
        "password": password,
        "org_name": orgName.trim()
      };

      console.log('Organization login request:', loginData);
      const res = await login(baseUrl, loginData);
      console.log('Organization login successful:', res);

      // Fetch and cache active public keys for this org after login
      // Also fetch and cache required JSON-LD contexts for offline usage
      try {
        const isStaff = !!res?.is_staff;
        const count = isStaff
          ? await ContextService.refreshOnServerAndCache()
          : await ContextService.fetchAndCacheDefaults();
        console.log(`Contexts cached: ${count}`);
      } catch (e) {
        console.warn('Context fetch/cache failed:', e);
      }

      const orgId = res?.organization?.id;
      if (orgId) {
        try {
          await PublicKeyService.fetchAndCacheKeys({ organization_id: orgId });
          const keys = await KeyCacheManager.getKeysByOrg(orgId);
          console.log(`Keys cached: ${(keys || []).length}`);
        } catch (e) {
          console.warn('Key fetch/cache failed:', e);
        }
      }

      // Use the auth context signIn method to update the global state
      await signIn(username, password);
      
      // Redirect to dashboard after successful login
      navigate('/dashboard');
    } catch (error) {
      console.error('Organization sign in failed:', error);
      setPasswordError(true);
      setPasswordErrorMessage(`Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      setUsernameError(true);
      setUsernameErrorMessage('Username must be at least 3 characters long.');
      isValid = false;
    } else {
      setUsernameError(false);
      setUsernameErrorMessage('');
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
    <AppTheme disableCustomTheme={disableCustomTheme}>
      <CssBaseline enableColorScheme />
      <SignInContainer direction="column" justifyContent="space-between">
        <ColorModeSelect sx={{ position: 'fixed', top: '1rem', right: '1rem' }} />
        <Card variant="outlined">
          <SitemarkIcon />
          <Typography
            component="h1"
            variant="h4"
            sx={{ width: '100%', fontSize: 'clamp(2rem, 10vw, 2.15rem)' }}
          >
            Organization Sign in
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
              <FormLabel htmlFor="organization">Organization Name</FormLabel>
              <TextField
                error={orgError}
                helperText={orgErrorMessage}
                id="organization"
                type="text"
                name="organization"
                placeholder="Acme Corp1"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                autoComplete="organization"
                required
                fullWidth
                variant="outlined"
                color={orgError ? 'error' : 'primary'}
              />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="username">Admin Username</FormLabel>
              <TextField
                error={usernameError}
                helperText={usernameErrorMessage}
                id="username"
                type="text"
                name="username"
                placeholder="alice1"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                fullWidth
                variant="outlined"
                color={usernameError ? 'error' : 'primary'}
              />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="password">Password</FormLabel>
              <TextField
                error={passwordError}
                helperText={passwordErrorMessage}
                name="password"
                placeholder="••••••"
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                fullWidth
                variant="outlined"
                color={passwordError ? 'error' : 'primary'}
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
            >
              {isLoading ? 'Signing in...' : 'Sign in as Organization'}
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
          <Divider>or</Divider>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => alert('Sign in with Google')}
              startIcon={<GoogleIcon />}
            >
              Sign in with Google
            </Button>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => alert('Sign in with Facebook')}
              startIcon={<FacebookIcon />}
            >
              Sign in with Facebook
            </Button>
            <Typography sx={{ textAlign: 'center' }}>
              Don&apos;t have an organization?{' '}
              <Link
                component="button"
                type="button"
                onClick={onSwitchToSignUp}
                variant="body2"
                sx={{ alignSelf: 'center' }}
              >
                Register Organization
              </Link>
            </Typography>
            <Typography sx={{ textAlign: 'center', mt: 1 }}>
              Are you a worker?{' '}
              <Link
                component="button"
                type="button"
                onClick={onSwitchToWorkerSignIn}
                variant="body2"
                sx={{ alignSelf: 'center' }}
              >
                Worker Sign in
              </Link>
            </Typography>
          </Box>
        </Card>
      </SignInContainer>
    </AppTheme>
  );
}
