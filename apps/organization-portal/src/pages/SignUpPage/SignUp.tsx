import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CssBaseline from '@mui/material/CssBaseline';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import FormControl from '@mui/material/FormControl';
import Link from '@mui/material/Link';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import MuiCard from '@mui/material/Card';
import { styled } from '@mui/material/styles';
import { AppTheme, ColorModeSelect } from '@inji-offline-verify/shared-ui/src/theme';
import { GoogleIcon, FacebookIcon, SitemarkIcon } from '@inji-offline-verify/shared-ui/src/components/CustomIcons';
import { registerOrganization, confirmRegistration } from '../../services/registrationService';
import OTPVerificationDialog from '../../components/OTPVerificationDialog';

const Card = styled(MuiCard)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignSelf: 'center',
  width: '100%',
  padding: theme.spacing(4),
  gap: theme.spacing(2),
  margin: 'auto',
  boxShadow:
    'hsla(220, 30%, 5%, 0.05) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.05) 0px 15px 35px -5px',
  [theme.breakpoints.up('sm')]: {
    maxWidth: '450px',
  },
  ...theme.applyStyles('dark', {
    boxShadow:
      'hsla(220, 30%, 5%, 0.5) 0px 5px 15px 0px, hsla(220, 25%, 10%, 0.08) 0px 15px 35px -5px',
  }),
}));

const SignUpContainer = styled(Stack)(({ theme }) => ({
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

interface SignUpProps {
  disableCustomTheme?: boolean;
  onSwitchToSignIn?: () => void;
}

export default function SignUp({ disableCustomTheme, onSwitchToSignIn }: SignUpProps) {
  const navigate = useNavigate();
  const [baseUrl] = React.useState('http://127.0.0.1:8000'); // Hidden - always the same
  const [orgName, setOrgName] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  
  const [orgError, setOrgError] = React.useState(false);
  const [orgErrorMessage, setOrgErrorMessage] = React.useState('');
  const [usernameError, setUsernameError] = React.useState(false);
  const [usernameErrorMessage, setUsernameErrorMessage] = React.useState('');
  const [emailError, setEmailError] = React.useState(false);
  const [emailErrorMessage, setEmailErrorMessage] = React.useState('');
  const [passwordError, setPasswordError] = React.useState(false);
  const [passwordErrorMessage, setPasswordErrorMessage] = React.useState('');
  const [confirmPasswordError, setConfirmPasswordError] = React.useState(false);
  const [confirmPasswordErrorMessage, setConfirmPasswordErrorMessage] = React.useState('');
  
  const [isLoading, setIsLoading] = React.useState(false);
  
  // OTP verification state
  const [showOTPDialog, setShowOTPDialog] = React.useState(false);
  const [pendingId, setPendingId] = React.useState('');
  const [otpLoading, setOtpLoading] = React.useState(false);
  const [otpError, setOtpError] = React.useState('');

  const validateInputs = () => {
    const orgInput = document.getElementById('organization') as HTMLInputElement;
    const usernameInput = document.getElementById('username') as HTMLInputElement;
    const emailInput = document.getElementById('email') as HTMLInputElement;
    const passwordInput = document.getElementById('password') as HTMLInputElement;
    const confirmPasswordInput = document.getElementById('confirmPassword') as HTMLInputElement;

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

    // Validate Email
    if (!emailInput.value || !/\S+@\S+\.\S+/.test(emailInput.value)) {
      setEmailError(true);
      setEmailErrorMessage('Please enter a valid email address.');
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

    // Validate Confirm Password
    if (!confirmPasswordInput.value || confirmPasswordInput.value !== passwordInput.value) {
      setConfirmPasswordError(true);
      setConfirmPasswordErrorMessage('Passwords do not match.');
      isValid = false;
    } else {
      setConfirmPasswordError(false);
      setConfirmPasswordErrorMessage('');
    }

    return isValid;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateInputs()) {
      return;
    }

    setIsLoading(true);
    try {
      // Register the organization - this will return pending registration data
      const registrationData = {
        org_name: orgName.trim(),
        admin_username: username.trim(), 
        admin_password: password,
        admin_email: email.trim(),
      };

      console.log('Registration request:', registrationData);
      const response = await registerOrganization(baseUrl, registrationData);
      console.log('Registration response:', response);

      // Store the pending ID and show OTP dialog
      if (response.pending_id) {
        setPendingId(response.pending_id);
        setShowOTPDialog(true);
        setOtpError('');
      } else {
        throw new Error('Registration failed: No pending ID received');
      }
      
    } catch (error) {
      console.error('Registration failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Check if the error is about an existing OTP
      if (errorMessage.includes('An OTP has already been sent') || errorMessage.includes('already been sent')) {
        // Show a dialog asking if they want to use the existing OTP
        const useExistingOTP = window.confirm(
          'An OTP has already been sent for this registration. Would you like to enter the existing OTP code? (Check your email or use the debug OTP from server logs)'
        );
        
        if (useExistingOTP) {
          // We don't have the pending_id from this error, so we'll need to create a mock one
          // or ask the user to wait. For now, let's show the OTP dialog and let them try.
          setShowOTPDialog(true);
          setOtpError('Please enter the OTP that was previously sent to your email. If you don\'t see it, check the server console for debug_otp.');
        } else {
          setPasswordError(true);
          setPasswordErrorMessage('Please wait for the current OTP to expire (usually 10-15 minutes) or check your email for the existing OTP.');
        }
      } else {
        setPasswordError(true);
        setPasswordErrorMessage(`Registration failed: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOTPVerification = async (otp: string) => {
    setOtpLoading(true);
    setOtpError('');
    
    try {
      // If we don't have a pending_id (e.g., from "OTP already sent" error),
      // we'll try to get it by making another registration request
      let currentPendingId = pendingId;
      
      if (!currentPendingId) {
        console.log('No pending ID, attempting to get it...');
        try {
          const registrationData = {
            org_name: orgName.trim(),
            admin_username: username.trim(), 
            admin_password: password,
            admin_email: email.trim(),
          };
          const response = await registerOrganization(baseUrl, registrationData);
          if (response.pending_id) {
            currentPendingId = response.pending_id;
            setPendingId(currentPendingId);
          }
        } catch (regError) {
          // If registration fails again, we might still be able to proceed if the user has the right OTP
          console.log('Registration for pending_id failed, trying with empty pending_id');
        }
      }

      const confirmationData = {
        pending_id: currentPendingId || 'unknown', // Fallback value
        otp_code: otp,
      };

      console.log('OTP confirmation request:', confirmationData);
      const response = await confirmRegistration(baseUrl, confirmationData);
      console.log('OTP confirmation successful:', response);

      // Close OTP dialog and show success message
      setShowOTPDialog(false);
      alert('Organization registered successfully! You can now sign in with your credentials.');
      
      // Redirect to organization sign-in page
      navigate('/org-signin');
      
    } catch (error) {
      console.error('OTP verification failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'OTP verification failed';
      
      // Provide more helpful error messages
      if (errorMessage.includes('404')) {
        setOtpError('Invalid OTP or expired session. Please try registering again.');
      } else if (errorMessage.includes('400')) {
        setOtpError('Invalid OTP code. Please check the code and try again.');
      } else {
        setOtpError(errorMessage);
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handleOTPDialogClose = () => {
    setShowOTPDialog(false);
    setOtpError('');
    setPendingId('');
  };

  const handleResendOTP = async () => {
    // Resend OTP by making the registration request again
    if (!email || !orgName || !username || !password) return;
    
    try {
      const registrationData = {
        org_name: orgName.trim(),
        admin_username: username.trim(), 
        admin_password: password,
        admin_email: email.trim(),
      };

      const response = await registerOrganization(baseUrl, registrationData);
      if (response.pending_id) {
        setPendingId(response.pending_id);
        setOtpError('');
      }
    } catch (error) {
      setOtpError('Failed to resend OTP. Please try again.');
    }
  };

  const handleSwitchToSignIn = () => {
    if (onSwitchToSignIn) {
      onSwitchToSignIn();
    } else {
      // Fallback to direct navigation
      navigate('/signin');
    }
  };

  return (
    <AppTheme disableCustomTheme={disableCustomTheme}>
      <CssBaseline enableColorScheme />
      <SignUpContainer direction="column" justifyContent="space-between">
        <ColorModeSelect sx={{ position: 'fixed', top: '1rem', right: '1rem' }} />
        <Card variant="outlined">
          <SitemarkIcon />
          <Typography
            component="h1"
            variant="h4"
            sx={{ width: '100%', fontSize: 'clamp(2rem, 10vw, 2.15rem)' }}
          >
            Sign up
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
                placeholder="Acme Corp"
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
              <FormLabel htmlFor="username">Username</FormLabel>
              <TextField
                error={usernameError}
                helperText={usernameErrorMessage}
                id="username"
                type="text"
                name="username"
                placeholder="johndoe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                fullWidth
                variant="outlined"
                color={usernameError ? 'error' : 'primary'}
              />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="email">Admin Email</FormLabel>
              <TextField
                error={emailError}
                helperText={emailErrorMessage}
                id="email"
                type="email"
                name="email"
                placeholder="admin@acme.example"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                required
                fullWidth
                variant="outlined"
                color={emailError ? 'error' : 'primary'}
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
                autoComplete="new-password"
                required
                fullWidth
                variant="outlined"
                color={passwordError ? 'error' : 'primary'}
              />
            </FormControl>
            <FormControl>
              <FormLabel htmlFor="confirmPassword">Confirm Password</FormLabel>
              <TextField
                error={confirmPasswordError}
                helperText={confirmPasswordErrorMessage}
                name="confirmPassword"
                placeholder="••••••"
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                fullWidth
                variant="outlined"
                color={confirmPasswordError ? 'error' : 'primary'}
              />
            </FormControl>
            <FormControlLabel
              control={<Checkbox value="allowExtraEmails" color="primary" />}
              label="I want to receive updates via email."
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              disabled={isLoading}
              onClick={validateInputs}
            >
              {isLoading ? 'Creating account...' : 'Sign up'}
            </Button>
          </Box>
          <Divider>
            <Typography sx={{ color: 'text.secondary' }}>or</Typography>
          </Divider>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => alert('Sign up with Google')}
              startIcon={<GoogleIcon />}
            >
              Sign up with Google
            </Button>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => alert('Sign up with Facebook')}
              startIcon={<FacebookIcon />}
            >
              Sign up with Facebook
            </Button>
            <Typography sx={{ textAlign: 'center' }}>
              Already have an account?{' '}
              <Link
                component="button"
                type="button"
                onClick={handleSwitchToSignIn}
                variant="body2"
                sx={{ alignSelf: 'center' }}
              >
                Sign in
              </Link>
            </Typography>
          </Box>
        </Card>

        {/* OTP Verification Dialog */}
        <OTPVerificationDialog
          open={showOTPDialog}
          onClose={handleOTPDialogClose}
          onVerify={handleOTPVerification}
          email={email}
          isLoading={otpLoading}
          error={otpError}
          onResend={handleResendOTP}
        />
      </SignUpContainer>
    </AppTheme>
  );
}
