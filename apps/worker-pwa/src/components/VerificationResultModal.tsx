import React from 'react';
import { Dialog, DialogContent, Box, Typography, IconButton, Paper, Button, Chip, Divider } from '@mui/material';
import { Close, CheckCircle, Error as ErrorIcon, Warning } from '@mui/icons-material';
import { VerificationResult } from '@mosip/react-inji-verify-sdk';

interface Props {
  open: boolean;
  onClose: () => void;
  result: VerificationResult | null;
}

export default function VerificationResultModal({ open, onClose, result }: Props) {
  if (!result) return null;

  // Treat both VC_EXPIRED and EXPIRED as "valid but expired"
  const isExpired =
    !!result.verificationStatus &&
    (result.verificationErrorCode === 'VC_EXPIRED' || result.verificationErrorCode === 'EXPIRED');

  const isVerified = !!result.verificationStatus;

  const headerBg = isVerified
    ? isExpired
      ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
      : 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
    : 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';

  const titleText = isVerified
    ? isExpired
      ? 'The given credential is valid but expired!'
      : 'Verification Successful!'
    : 'Verification Failed!';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}
    >
      <Box sx={{ background: headerBg, color: 'white', p: 3, textAlign: 'center', position: 'relative' }}>
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', top: 8, right: 8, color: 'white' }}>
          <Close />
        </IconButton>
        {isVerified ? (isExpired ? <Warning sx={{ fontSize: 48 }} /> : <CheckCircle sx={{ fontSize: 48 }} />) : <ErrorIcon sx={{ fontSize: 48 }} />}
        <Typography variant="h5" sx={{ mt: 2, fontWeight: 600 }}>
          {titleText}
        </Typography>
      </Box>

      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Chip label={isVerified ? 'VERIFIED' : 'INVALID'} color={isVerified ? 'success' : 'error'} />
        </Box>

        <Paper sx={{ p: 3, backgroundColor: 'grey.50', borderRadius: 2 }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
            Verification Details
          </Typography>
          <Divider sx={{ my: 2 }} />

          {result.verificationMessage && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Message
              </Typography>
              <Typography variant="body2">{result.verificationMessage}</Typography>
            </Box>
          )}

          {result.verificationErrorCode && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Code
              </Typography>
              <Typography variant="body2" fontFamily="monospace">
                {result.verificationErrorCode}
              </Typography>
            </Box>
          )}

          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Verification Status
            </Typography>
            <Typography variant="body2">{isVerified ? 'Valid signature' : 'Invalid signature'}</Typography>
          </Box>
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Button variant="outlined" onClick={onClose} sx={{ borderRadius: '20px', minWidth: 160 }}>
            Verify Another QR code
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}