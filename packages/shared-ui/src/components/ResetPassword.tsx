import * as React from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { getSharedApiUrl } from '@inji-offline-verify/shared-auth';

export interface ResetPasswordProps {
  /**
   * UID extracted from the password reset link.
   * When omitted, the component attempts to read it from the current location's query string.
   */
  uid?: string | null;
  /**
   * Token extracted from the password reset link.
   * When omitted, the component attempts to read it from the current location's query string.
   */
  token?: string | null;
  /**
   * Optional callback invoked when the password reset succeeds.
   */
  onSuccess?: (message: string) => void;
  /**
   * Optional callback invoked when an error occurs.
   */
  onError?: (message: string) => void;
  /**
   * Optional callback invoked after a successful reset, ideal for triggering navigation.
   */
  onComplete?: () => void;
  /**
   * Override for the default success message displayed by the component.
   */
  successMessage?: string;
  /**
   * Override for the default error message displayed by the component.
   */
  errorMessage?: string;
  /**
   * Optional heading displayed above the form.
   */
  title?: string;
  /**
   * Optional description displayed below the title.
   */
  description?: string;
}

const DEFAULT_SUCCESS_MESSAGE = 'Your password has been updated. You can now sign in with your new credentials.';
const DEFAULT_ERROR_MESSAGE = 'We were unable to reset your password. Please request a new link and try again.';

function readQueryParam(key: string): string {
  if (typeof window === 'undefined' || !window.location?.search) {
    return '';
  }
  const params = new URLSearchParams(window.location.search);
  return params.get(key) ?? '';
}

export function ResetPassword({
  uid,
  token,
  onSuccess,
  onError,
  onComplete,
  successMessage = DEFAULT_SUCCESS_MESSAGE,
  errorMessage = DEFAULT_ERROR_MESSAGE,
  title = 'Set a new password',
  description = 'Choose a strong password to secure your account. After submitting, you will be redirected to sign in.',
}: ResetPasswordProps) {
  const resolvedUid = React.useMemo(() => (uid ?? readQueryParam('uid')).trim(), [uid]);
  const resolvedToken = React.useMemo(() => (token ?? readQueryParam('token')).trim(), [token]);

  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [serverMessage, setServerMessage] = React.useState<string | null>(null);
  const [serverSeverity, setServerSeverity] = React.useState<'success' | 'error' | null>(null);

  const passwordMismatchError = React.useMemo(() => formError?.toLowerCase().includes('match') ?? false, [formError]);

  const missingParams = !resolvedUid || !resolvedToken;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (missingParams) {
      const message = 'This reset link is invalid or has expired. Please request a new one.';
      setFormError(message);
      setServerSeverity('error');
      setServerMessage(message);
      onError?.(message);
      return;
    }

    if (!newPassword.trim()) {
      const message = 'New password is required.';
      setFormError(message);
      return;
    }

    if (newPassword.trim().length < 8) {
      const message = 'Password must be at least 8 characters long.';
      setFormError(message);
      return;
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      const message = 'Passwords do not match.';
      setFormError(message);
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    setServerMessage(null);
    setServerSeverity(null);

    try {
      const response = await fetch(getSharedApiUrl('/auth/password-reset/confirm/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: resolvedUid,
          token: resolvedToken,
          new_password: newPassword.trim(),
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const apiMessage =
          payload?.new_password?.[0] ||
          payload?.detail ||
          payload?.error ||
          payload?.message;
        const message = apiMessage || errorMessage;
        setServerSeverity('error');
        setServerMessage(message);
        onError?.(message);
        return;
      }

      setServerSeverity('success');
      setServerMessage(successMessage);
      setNewPassword('');
      setConfirmPassword('');
      onSuccess?.(successMessage);
      onComplete?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : errorMessage;
      setServerSeverity('error');
      setServerMessage(message);
      onError?.(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        py: 6,
        px: 2,
      }}
    >
      <Paper
        elevation={8}
        sx={{
          width: '100%',
          maxWidth: 440,
          p: 4,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
        component="form"
        onSubmit={handleSubmit}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography component="h1" variant="h5" fontWeight={600}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {description}
          </Typography>
        </Box>

        {missingParams && (
          <Alert severity="error">
            This reset link is invalid or missing required information. Please request a new password reset email.
          </Alert>
        )}

        {serverMessage && serverSeverity && (
          <Alert severity={serverSeverity}>{serverMessage}</Alert>
        )}

        <TextField
          id="new-password"
          name="new-password"
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          fullWidth
          value={newPassword}
          onChange={(event) => {
            setNewPassword(event.target.value);
            if (formError) setFormError(null);
            if (serverMessage && serverSeverity === 'error') {
              setServerMessage(null);
              setServerSeverity(null);
            }
          }}
          error={Boolean(formError)}
          helperText={formError ?? ' '}
          disabled={isSubmitting || missingParams}
        />

        <TextField
          id="confirm-password"
          name="confirm-password"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          fullWidth
          value={confirmPassword}
          onChange={(event) => {
            setConfirmPassword(event.target.value);
            if (passwordMismatchError) {
              setFormError(null);
            }
            if (serverMessage && serverSeverity === 'error') {
              setServerMessage(null);
              setServerSeverity(null);
            }
          }}
          error={passwordMismatchError}
          helperText={passwordMismatchError && formError ? formError : ' '}
          disabled={isSubmitting || missingParams}
        />

        <Button
          type="submit"
          variant="contained"
          disabled={isSubmitting || missingParams}
          startIcon={isSubmitting ? <CircularProgress size={16} /> : undefined}
        >
          {isSubmitting ? 'Updating…' : 'Update password'}
        </Button>
      </Paper>
    </Box>
  );
}

export default ResetPassword;
