import * as React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import { styled } from '@mui/material/styles';

const OTPContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(0.5),
  justifyContent: 'center',
  margin: theme.spacing(2, 0),
  [theme.breakpoints.up('sm')]: {
    gap: theme.spacing(1),
  },
}));

const OTPInput = styled(TextField)(({ theme }) => ({
  '& .MuiInputBase-input': {
    textAlign: 'center',
    fontSize: '1.2rem',
    fontWeight: 'bold',
    width: '32px',
    padding: theme.spacing(0.5),
    [theme.breakpoints.up('sm')]: {
      fontSize: '1.5rem',
      width: '40px',
      padding: theme.spacing(1),
    },
  },
}));

interface OTPVerificationDialogProps {
  open: boolean;
  onClose: () => void;
  onVerify: (otp: string) => Promise<void>;
  email: string;
  isLoading: boolean;
  error?: string;
  onResend?: () => Promise<void>;
}

export default function OTPVerificationDialog({
  open,
  onClose,
  onVerify,
  email,
  isLoading,
  error,
  onResend
}: OTPVerificationDialogProps) {
  const [otp, setOtp] = React.useState(['', '', '', '', '', '']);
  const [resendLoading, setResendLoading] = React.useState(false);
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const handleOTPChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste operation
      const digits = value.slice(0, 6).split('');
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (index + i < 6 && /^\d$/.test(digit)) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);
      
      // Focus the next empty input or the last one
      const nextIndex = Math.min(index + digits.length, 5);
      inputRefs.current[nextIndex]?.focus();
    } else if (/^\d$/.test(value) || value === '') {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      // Move to next input if value is entered
      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyDown = (index: number, event: React.KeyboardEvent) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const otpString = otp.join('');
    if (otpString.length === 6) {
      await onVerify(otpString);
    }
  };

  const handleResend = async () => {
    if (onResend) {
      setResendLoading(true);
      try {
        await onResend();
      } finally {
        setResendLoading(false);
      }
    }
  };

  const isOTPComplete = otp.every(digit => digit !== '');

  // Reset OTP when dialog opens
  React.useEffect(() => {
    if (open) {
      setOtp(['', '', '', '', '', '']);
      // Focus first input after a short delay
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [open]);

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          padding: 2,
        }
      }}
    >
      <DialogTitle sx={{ textAlign: 'center', pb: 1 }}>
        <Typography variant="h5" component="div" gutterBottom>
          Verify Your Email
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <DialogContentText sx={{ textAlign: 'center', mb: 3 }}>
          We've sent a 6-digit verification code to
          <Typography component="span" sx={{ fontWeight: 'bold', display: 'block', mt: 1 }}>
            {email}
          </Typography>
        </DialogContentText>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <OTPContainer>
            {otp.map((digit, index) => (
              <OTPInput
                key={index}
                inputRef={(ref) => (inputRefs.current[index] = ref)}
                value={digit}
                onChange={(e) => handleOTPChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                variant="outlined"
                inputProps={{
                  maxLength: 6,
                  'aria-label': `OTP digit ${index + 1}`,
                }}
                disabled={isLoading}
              />
            ))}
          </OTPContainer>

          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
            Didn't receive the code?{' '}
            <Button
              variant="text"
              onClick={handleResend}
              disabled={resendLoading || isLoading}
              sx={{ textTransform: 'none', p: 0, minWidth: 'auto' }}
            >
              {resendLoading ? 'Sending...' : 'Resend'}
            </Button>
          </Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ justifyContent: 'center', pb: 2 }}>
        <Button 
          onClick={onClose} 
          disabled={isLoading}
          sx={{ minWidth: 100 }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!isOTPComplete || isLoading}
          sx={(theme) => ({
            minWidth: 100,
            position: 'relative',
            '&:disabled': {
              color: '#fff',
            },
            ...theme.applyStyles('dark', {
              '&:disabled': {
                color: '#000',
              },
            }),
          })}
        >
          {isLoading && (
            <CircularProgress
              size={20}
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                marginTop: '-10px',
                marginLeft: '-10px',
              }}
            />
          )}
          {isLoading ? 'Verifying...' : 'Verify'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
