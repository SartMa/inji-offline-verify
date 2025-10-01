import * as React from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import CircularProgress from '@mui/material/CircularProgress';
import { getSharedApiUrl } from '@inji-offline-verify/shared-auth';

interface ForgotPasswordProps {
  open: boolean;
  handleClose: () => void;
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
  /**
   * Optional override for the base URL used in the password reset email.
   * Defaults to window.location.origin when available.
   */
  redirectBase?: string;
  /**
   * Optional relative path appended to the base URL. Defaults to `/reset-password`.
   */
  resetPath?: string;
}

const DEFAULT_SUCCESS_MESSAGE = 'Password reset email sent. Check your inbox for further instructions.';
const DEFAULT_ERROR_MESSAGE = 'Unable to send password reset email. Please try again.';

export default function ForgotPassword({
  open,
  handleClose,
  onSuccess,
  onError,
  redirectBase,
  resetPath,
}: ForgotPasswordProps) {
  const [email, setEmail] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const resolvedRedirectBase = React.useMemo(() => {
    if (redirectBase) return redirectBase;
    if (typeof window !== 'undefined' && window.location) {
      return window.location.origin;
    }
    return '';
  }, [redirectBase]);

  const resolvedResetPath = React.useMemo(() => {
    const trimmed = (resetPath ?? '').trim();
    if (!trimmed) return '/reset-password';
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }, [resetPath]);

  React.useEffect(() => {
    if (!open) {
      setEmail('');
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      const message = 'Email address is required.';
      setErrorMessage(message);
      onError?.(message);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const requestBody: Record<string, unknown> = { email: trimmedEmail, reset_path: resolvedResetPath };
      if (resolvedRedirectBase) {
        requestBody.redirect_base = resolvedRedirectBase;
      }

      const response = await fetch(getSharedApiUrl('/auth/password-reset/request/'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const responseBody = await response.json().catch(() => ({}));

      if (!response.ok) {
        const apiMessage =
          responseBody?.email?.[0] ||
          responseBody?.detail ||
          responseBody?.error ||
          responseBody?.message;
        const message = apiMessage || DEFAULT_ERROR_MESSAGE;
        setErrorMessage(message);
        onError?.(message);
        return;
      }

    onSuccess?.(DEFAULT_SUCCESS_MESSAGE);
    setEmail('');
    handleClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE;
      setErrorMessage(message);
      onError?.(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      slotProps={{
        paper: {
          component: 'form',
          onSubmit: handleSubmit,
          sx: { backgroundImage: 'none' },
        },
      }}
    >
      <DialogTitle>Reset password</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
        <DialogContentText>
          Enter your account&apos;s email address, and we&apos;ll send you a link to reset your password.
        </DialogContentText>
        <TextField
          autoFocus
          required
          id="forgot-password-email"
          name="email"
          label="Email address"
          placeholder="Email address"
          type="email"
          fullWidth
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={Boolean(errorMessage)}
          helperText=" "
        />
        {errorMessage && (
          <Alert severity="error" sx={{ mt: -1 }}>
            {errorMessage}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ pb: 3, px: 3 }}>
        <Button onClick={handleClose} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button variant="contained" type="submit" disabled={isSubmitting} startIcon={isSubmitting ? <CircularProgress size={16} /> : undefined}>
          {isSubmitting ? 'Sending…' : 'Continue'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
