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
import { QRCodeVerification } from '@mosip/react-inji-verify-sdk';
import { VerificationResult } from '@mosip/react-inji-verify-sdk';
import { CredentialFormat } from '@mosip/react-inji-verify-sdk';
import VerificationResultModal from './VerificationResultModal';
import { WorkerCacheService } from '../services/WorkerCacheService';
import { useVCStorage } from '../context/VCStorageContext';
import { v4 as uuidv4 } from 'uuid';

// Helper to create a simple hash
async function createHash(data: string) {
  const buffer = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

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
  const { storeVerificationResult } = useVCStorage();

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
      setCacheReady(true); // Assuming if stats are retrieved, cache is usable
      console.log('Cache status:', stats);
    } catch (error) {
      console.error('Failed to check cache status:', error);
      setCacheReady(false);
    }
  };

  const handleStartScanning = async () => {
    // Use a short timeout to allow the dialog's layout to stabilize
    // before mounting the scanner component. This prevents the negative width error.
    setTimeout(() => {
      setScannerStarted(true);
    }, 50);
  };

  const handleVerificationResult = async (result: VerificationResult) => {
    console.log('Verification result received:', result);
    
    const payload = (result as any).payload || {};
    const vc_hash = await createHash(JSON.stringify(payload));

    // Create an object that matches the VerificationLog model for storage
    const verificationData = {
      uuid: uuidv4(),
      verification_status: result.verificationStatus ? "SUCCESS" : "FAILED",
      verified_at: new Date().toISOString(),
      vc_hash: vc_hash,
      credential_subject: payload.credentialSubject || null,
      error_message: result.verificationStatus ? null : result.verificationMessage,
      synced: false
    };

    // Store in VCStorageContext (which uses our dbService)
    try {
      await storeVerificationResult(verificationData);
      console.log('✅ Stored in VCStorageContext successfully', verificationData);
    } catch (e) {
      console.error('❌ Failed to store in VCStorage:', e);
    }
    
    setVerificationResult(result);
    setShowResult(true);
    setScannerStarted(false);
    onResult(result);
  };

  const handleError = async (error: Error) => {
    console.error('QR Scanner error:', error);
    const errorResult = new VerificationResult(false, error.message, 'SCAN_ERROR');
    
    // Create an error object for storage
    const errorData = {
      uuid: uuidv4(),
      verification_status: "FAILED",
      verified_at: new Date().toISOString(),
      vc_hash: null,
      credential_subject: null,
      error_message: error.message,
      synced: false
    };

    // Store error result in VCStorageContext
    try {
      await storeVerificationResult(errorData);
      console.log('✅ Stored error in VCStorageContext', errorData);
    } catch (e) {
      console.error('❌ Failed to store error in VCStorage:', e);
    }
    
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

        <DialogContent sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {!scannerStarted ? (
            // Scanner Preview UI
            <Box sx={{ textAlign: 'center', width: '100%' }}>
              <Paper
                sx={{
                  border: '2px dashed',
                  borderColor: 'primary.main',
                  borderRadius: 3,
                  p: { xs: 3, sm: 6 },
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
            <Box sx={{position: 'relative', minHeight: '400px' }}>
              <QRCodeVerification
                mode="offline"
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