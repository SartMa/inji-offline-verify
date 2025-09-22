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
      scroll="body"
      PaperProps={{ 
        sx: { 
          borderRadius: 3, 
          overflow: 'hidden',
          backgroundColor: (theme) => 
            theme.palette.mode === 'dark' 
              ? '#1a1a1a' 
              : '#ffffff',
          backgroundImage: 'none',
          maxHeight: '95vh',
          margin: 1,
          '&::-webkit-scrollbar': {
            display: 'none'
          },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        } 
      }}
      sx={{
        '& .MuiDialog-container': {
          '&::-webkit-scrollbar': {
            display: 'none'
          },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }
      }}
    >
      <Box sx={{ 
        background: headerBg, 
        color: 'white', 
        p: 3, 
        textAlign: 'center', 
        position: 'relative',
        boxShadow: (theme) => 
          theme.palette.mode === 'dark' 
            ? '0 4px 12px rgba(0,0,0,0.6)' 
            : '0 2px 8px rgba(0,0,0,0.15)',
      }}>
        <IconButton 
          onClick={onClose} 
          size="small" 
          sx={{ 
            position: 'absolute', 
            top: 8, 
            right: 8, 
            color: 'white',
            backgroundColor: 'rgba(0,0,0,0.2)',
            '&:hover': {
              backgroundColor: 'rgba(0,0,0,0.3)',
            }
          }}
        >
          <Close />
        </IconButton>
        {isVerified ? (isExpired ? <Warning sx={{ fontSize: 48 }} /> : <CheckCircle sx={{ fontSize: 48 }} />) : <ErrorIcon sx={{ fontSize: 48 }} />}
        <Typography variant="h5" sx={{ mt: 2, fontWeight: 600, color: 'white' }}>
          {titleText}
        </Typography>
      </Box>

      <DialogContent sx={{ 
        p: 3, 
        backgroundColor: (theme) => 
          theme.palette.mode === 'dark' 
            ? '#1a1a1a' 
            : '#ffffff',
        overflow: 'hidden',
        overflowY: 'visible',
        '&::-webkit-scrollbar': {
          display: 'none'
        },
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        maxHeight: 'none',
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <Chip 
            label={isVerified ? 'VERIFIED' : 'INVALID'} 
            sx={{
              fontWeight: 600,
              fontSize: '0.875rem',
              backgroundColor: isVerified 
                ? (theme: any) => theme.palette.mode === 'dark' ? '#2e7d32' : '#4caf50'
                : (theme: any) => theme.palette.mode === 'dark' ? '#d32f2f' : '#f44336',
              color: 'white',
              boxShadow: (theme) => 
                theme.palette.mode === 'dark' 
                  ? '0 2px 4px rgba(0,0,0,0.4)' 
                  : '0 1px 3px rgba(0,0,0,0.2)',
            }}
          />
        </Box>

        <Paper sx={{ 
          p: 3, 
          backgroundColor: (theme) => 
            theme.palette.mode === 'dark' 
              ? '#252525' 
              : '#f5f5f5',
          borderRadius: 2,
          border: (theme) => 
            theme.palette.mode === 'dark' 
              ? '1px solid #404040' 
              : '1px solid #e0e0e0',
          boxShadow: (theme) => 
            theme.palette.mode === 'dark' 
              ? '0 2px 8px rgba(0,0,0,0.6)' 
              : '0 1px 3px rgba(0,0,0,0.1)',
        }}>
          <Typography variant="h6" gutterBottom sx={{ 
            fontWeight: 600,
            color: (theme) => 
              theme.palette.mode === 'dark' 
                ? '#ffffff' 
                : '#212121',
            mb: 2,
          }}>
            Verification Details
          </Typography>
          <Divider sx={{ 
            my: 2,
            borderColor: (theme) => 
              theme.palette.mode === 'dark' 
                ? '#404040' 
                : '#e0e0e0',
          }} />

          {result.verificationMessage && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{
                color: (theme) => 
                  theme.palette.mode === 'dark' 
                    ? '#b0b0b0' 
                    : '#666666',
                fontWeight: 600,
                mb: 0.5,
              }}>
                Message
              </Typography>
              <Typography variant="body2" sx={{
                color: (theme) => 
                  theme.palette.mode === 'dark' 
                    ? '#ffffff' 
                    : '#212121',
                lineHeight: 1.6,
              }}>
                {result.verificationMessage || 'No message available'}
              </Typography>
            </Box>
          )}

          {result.verificationErrorCode && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" sx={{
                color: (theme) => 
                  theme.palette.mode === 'dark' 
                    ? '#b0b0b0' 
                    : '#666666',
                fontWeight: 600,
                mb: 0.5,
              }}>
                Code
              </Typography>
              <Typography variant="body2" fontFamily="monospace" sx={{
                color: (theme) => 
                  theme.palette.mode === 'dark' 
                    ? '#ffffff' 
                    : '#212121',
                backgroundColor: (theme) => 
                  theme.palette.mode === 'dark' 
                    ? '#333333' 
                    : '#f0f0f0',
                p: 1.5,
                borderRadius: 1,
                border: (theme) => 
                  theme.palette.mode === 'dark' 
                    ? '1px solid #505050' 
                    : '1px solid #e0e0e0',
                fontSize: '0.875rem',
              }}>
                {result.verificationErrorCode || 'No error code'}
              </Typography>
            </Box>
          )}

          <Box>
            <Typography variant="subtitle2" sx={{
              color: (theme) => 
                theme.palette.mode === 'dark' 
                  ? '#b0b0b0' 
                  : '#666666',
              fontWeight: 600,
              mb: 0.5,
            }}>
              Verification Status
            </Typography>
            <Typography variant="body2" sx={{
              color: (theme) => 
                theme.palette.mode === 'dark' 
                  ? '#ffffff' 
                  : '#212121',
              lineHeight: 1.6,
            }}>
              {isVerified ? 'Valid signature' : 'Invalid signature'}
            </Typography>
          </Box>
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
          <Button 
            variant="contained"
            onClick={onClose} 
            sx={{ 
              borderRadius: '25px', 
              minWidth: 180,
              fontWeight: 600,
              py: 1.5,
              px: 4,
              backgroundColor: (theme) => 
                theme.palette.mode === 'dark' 
                  ? '#1976d2' 
                  : '#1976d2',
              color: 'white',
              boxShadow: (theme) => 
                theme.palette.mode === 'dark' 
                  ? '0 4px 12px rgba(25, 118, 210, 0.3)' 
                  : '0 4px 12px rgba(25, 118, 210, 0.2)',
              '&:hover': {
                backgroundColor: (theme) => 
                  theme.palette.mode === 'dark' 
                    ? '#1565c0' 
                    : '#1565c0',
                boxShadow: (theme) => 
                  theme.palette.mode === 'dark' 
                    ? '0 6px 16px rgba(25, 118, 210, 0.4)' 
                    : '0 6px 16px rgba(25, 118, 210, 0.3)',
                transform: 'translateY(-1px)',
              }
            }}
          >
            Continue Scanning
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}