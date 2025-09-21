import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  Box,
  Typography,
  IconButton,
  Paper,
  Button,
} from '@mui/material';
import { Close, QrCodeScanner } from '@mui/icons-material';
import { QRCodeVerification, SDKCacheManager } from '@mosip/react-inji-verify-sdk';
import { VerificationResult } from '@mosip/react-inji-verify-sdk';
import { CredentialFormat } from '@mosip/react-inji-verify-sdk';
import VerificationResultModal from './VerificationResultModal';
import { WorkerCacheService } from '../services/WorkerCacheService';

interface QRScannerModalProps {
  open: boolean;
  onClose: () => void;
  onResult: (result: any) => void;
}

export default function QRScannerModal({ open, onClose, onResult }: QRScannerModalProps) {
  const [scannerStarted, setScannerStarted] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);

  // Check cache status when modal opens
  useEffect(() => {
    if (open) {
      checkCacheStatus();
    }
  }, [open]);

  const checkCacheStatus = async () => {
    try {
      // Check if cache has any data using SDK
      const stats = WorkerCacheService.getCacheStats();
      setCacheReady(true); // Set based on actual cache content
      console.log('Cache status:', stats);
    } catch (error) {
      console.error('Failed to check cache status:', error);
      setCacheReady(false);
    }
  };

  const handleStartScanning = async () => {
    try {
      // Ensure cache is ready before starting scan
      if (!cacheReady) {
        console.warn('Cache not ready, attempting to prime...');
        // You might want to show a loading state here
      }
      setScannerStarted(true);
    } catch (error) {
      console.error('Failed to start scanning:', error);
    }
  };

  const handleVerificationResult = async (result: VerificationResult) => {
    console.log('Verification result received:', result);
    
    // Store verification result locally (not in SDK cache)
    await WorkerCacheService.storeVerificationResult(result);
    
    setVerificationResult(result);
    setShowResult(true);
    setScannerStarted(false);
    onResult(result);
  };

  const handleError = (error: Error) => {
    console.error('QR Scanner error:', error);
    const errorResult = new VerificationResult(false, error.message, 'SCAN_ERROR');
    setVerificationResult(errorResult);
    setShowResult(true);
    setScannerStarted(false);
  };

  const handleCloseResult = () => {
    setShowResult(false);
    setVerificationResult(null);
  };

  const handleClose = () => {
    setScannerStarted(false);
    setVerificationResult(null);
    setShowResult(false);
    onClose();
  };

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            minHeight: '500px',
          },
        }}
      >
        <DialogTitle sx={{ p: 2, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <QrCodeScanner sx={{ color: 'primary.main' }} />
              <Typography variant="h6" component="span">
                Scan QR Code
              </Typography>
            </Box>
            <IconButton onClick={handleClose} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          {!scannerStarted ? (
            // Scanner Preview UI (matches your screenshot)
            <Box sx={{ textAlign: 'center' }}>
              <Paper
                sx={{
                  border: '2px dashed',
                  borderColor: 'primary.main',
                  borderRadius: 3,
                  p: 6,
                  mb: 3,
                  backgroundColor: 'rgba(59, 130, 246, 0.04)',
                }}
              >
                <Box
                  sx={{
                    width: 80,
                    height: 80,
                    borderRadius: 2,
                    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 24px',
                  }}
                >
                  <QrCodeScanner sx={{ fontSize: 40, color: 'white' }} />
                </Box>
                
                <Typography variant="h5" gutterBottom sx={{ color: 'primary.main', fontWeight: 600 }}>
                  Camera Scanner
                </Typography>
                
                <Typography variant="body1" color="text.secondary" gutterBottom>
                  QR code scanner will be integrated here using Inji Verify SDK
                </Typography>
                
                <Typography variant="body2" color="text.secondary">
                  Position the QR code within the camera frame
                </Typography>

                {/* Cache status indicator */}
                {!cacheReady && (
                  <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 2 }}>
                    ⚠️ Cache not ready - verification may require network
                  </Typography>
                )}
              </Paper>

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button 
                  variant="outlined" 
                  onClick={handleClose}
                  sx={{ borderRadius: '20px', minWidth: 100 }}
                >
                  Cancel
                </Button>
                <Button 
                  variant="contained" 
                  onClick={handleStartScanning}
                  sx={{ 
                    borderRadius: '20px', 
                    minWidth: 120,
                    background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #4b5563 0%, #374151 100%)',
                    }
                  }}
                >
                  Start Scanning
                </Button>
              </Box>
            </Box>
          ) : (
            // Actual QR Scanner using SDK
            <Box sx={{ position: 'relative', minHeight: '400px' }}>
              <QRCodeVerification
                mode="offline"  // Use offline mode to leverage SDK cache
                onVerificationResult={handleVerificationResult}
                onError={handleError}
                credentialFormat={CredentialFormat.LDP_VC}
                isEnableUpload={false}
                isEnableScan={true}
                isEnableZoom={true}
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Verification Result Modal */}
      <VerificationResultModal
        open={showResult}
        onClose={handleCloseResult}
        result={verificationResult}
      />
    </>
  );
}