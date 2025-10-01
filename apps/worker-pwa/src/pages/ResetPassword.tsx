import * as React from 'react';
import { useNavigate, useSearchParams, Link as RouterLink } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AppTheme } from '@inji-offline-verify/shared-ui/src/theme';
import ResetPassword from '@inji-offline-verify/shared-ui/src/components/ResetPassword';
import { clearAllUserData } from '@inji-offline-verify/shared-auth';

export default function WorkerResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const uid = searchParams.get('uid');
  const token = searchParams.get('token');

  const [toastOpen, setToastOpen] = React.useState(false);
  const [toastMessage, setToastMessage] = React.useState('');
  const [toastSeverity, setToastSeverity] = React.useState<'success' | 'error'>('success');

  const redirectTimeoutRef = React.useRef<number | null>(null);

  const handleToastClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setToastOpen(false);
  };

  const handleSuccess = (message: string) => {
    setToastSeverity('success');
    setToastMessage(message);
    setToastOpen(true);
    if (redirectTimeoutRef.current) {
      window.clearTimeout(redirectTimeoutRef.current);
    }
    redirectTimeoutRef.current = window.setTimeout(() => {
      navigate('/signin');
    }, 2000);
  };

  const handleError = (message: string) => {
    setToastSeverity('error');
    setToastMessage(message);
    setToastOpen(true);
  };

  React.useEffect(() => {
    void clearAllUserData();
    return () => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  return (
    <AppTheme>
      <Stack sx={{ minHeight: '100vh' }} justifyContent="center">
        <ResetPassword
          uid={uid}
          token={token}
          onSuccess={handleSuccess}
          onError={handleError}
        />
        <Typography variant="body2" align="center" sx={{ mt: 2 }}>
          Remembered your password?{' '}
          <Link component={RouterLink} to="/signin">
            Back to sign in
          </Link>
        </Typography>
        <Snackbar
          open={toastOpen}
          autoHideDuration={5000}
          onClose={handleToastClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert onClose={handleToastClose} severity={toastSeverity} variant="filled" sx={{ width: '100%' }}>
            {toastMessage}
          </Alert>
        </Snackbar>
      </Stack>
    </AppTheme>
  );
}
