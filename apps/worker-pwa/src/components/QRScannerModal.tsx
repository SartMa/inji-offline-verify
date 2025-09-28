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
  Badge,
  Avatar,
  Chip,
} from '@mui/material';
import { Close, QrCodeScanner, CheckCircle, Error as ErrorIcon, Warning } from '@mui/icons-material';
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

interface ScannedVC {
  id: string;
  timestamp: number;
  result: VerificationResult;
  credential?: any;
}

export default function QRScannerModal({ open, onClose, onResult }: QRScannerModalProps) {
  const [scannerStarted, setScannerStarted] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [cacheReady, setCacheReady] = useState(false);
  const { storeVerificationResult } = useVCStorage();
  const [scannedVCs, setScannedVCs] = useState<ScannedVC[]>([]);
  const [selectedVCForView, setSelectedVCForView] = useState<VerificationResult | null>(null);
  const [scannerKey, setScannerKey] = useState(0); // For forcing fresh scanner instances

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
    
    // Store verification result locally (not in SDK cache)
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
    
    // Add to scanned VCs list
    const newScannedVC: ScannedVC = {
      id: `vc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      result,
      credential: null // Could store credential data if needed
    };
    
    setScannedVCs(prev => [...prev, newScannedVC]);
    setVerificationResult(result);
    setShowResult(true);
    // Keep scanner running - don't set setScannerStarted(false)
    onResult(result);
  };

  const handleError = async (error: Error) => {
    console.error('QR Scanner error:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    
    // Don't stop scanner for certain recoverable errors
    const recoverableErrors = ['scanSessionExpired', 'Permission denied', 'NotAllowedError'];
    const isRecoverable = recoverableErrors.some(err => error.message.includes(err) || error.name.includes(err));
    
    if (isRecoverable) {
      console.log('Recoverable error detected, keeping scanner active for retry...');
      // Don't create error result for recoverable errors, just log them
      return;
    }
    
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
    // Keep scanner running even on error - don't stop scanning
  };

  const handleCloseResult = () => {
    setShowResult(false);
    setVerificationResult(null);
    setSelectedVCForView(null);
    
    // Silently restart scanner with new instance
    setTimeout(() => {
      setScannerKey(prev => prev + 1);
    }, 100); // Small delay to ensure popup fully closes
    
    console.log('Result popup closed, scanner will restart...');
  };

  const handleClose = () => {
    setScannerStarted(false);
    setVerificationResult(null);
    setShowResult(false);
    setScannedVCs([]); // Clear scanned VCs when modal closes
    setSelectedVCForView(null);
    setScannerKey(0); // Reset scanner key
    onClose();
  };

  const handleVCThumbnailClick = (vc: ScannedVC) => {
    setSelectedVCForView(vc.result);
    setShowResult(true);
  };

  const getVCIcon = (result: VerificationResult) => {
    if (!result.verificationStatus) return <ErrorIcon />;
    
    const isExpired = result.verificationErrorCode === 'VC_EXPIRED' || result.verificationErrorCode === 'EXPIRED';
    return isExpired ? <Warning /> : <CheckCircle />;
  };

  const getVCColor = (result: VerificationResult) => {
    if (!result.verificationStatus) return '#ef4444';
    
    const isExpired = result.verificationErrorCode === 'VC_EXPIRED' || result.verificationErrorCode === 'EXPIRED';
    return isExpired ? '#f59e0b' : '#10b981';
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
            backgroundColor: 'background.paper',
            backgroundImage: 'none',
            // Mobile specific adjustments without changing desktop
            '@media (max-width: 600px)': {
              borderRadius: 2,
              m: 1,
              maxHeight: 'calc(100vh - 16px)',
            },
          },
        }}
        sx={{
          // Prevent heavy black overlay on mobile while keeping desktop behavior
          '& .MuiBackdrop-root': {
            backgroundColor: { xs: 'rgba(0, 0, 0, 0.3)', sm: 'rgba(0, 0, 0, 0.5)' },
          },
        }}
      >
        <DialogTitle sx={{ p: { xs: 1, sm: 2 }, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <QrCodeScanner sx={{ color: 'primary.main', fontSize: { xs: 20, sm: 24 } }} />
              <Typography variant="h6" component="span" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                Scan QR Codes
              </Typography>
              {scannedVCs.length > 0 && (
                <Badge badgeContent={scannedVCs.length} color="primary" sx={{ ml: 1 }} />
              )}
            </Box>
            <IconButton onClick={handleClose} size="small">
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ 
          p: { xs: 2, sm: 3 }, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          overflow: 'auto',
        }}>
          {!scannerStarted ? (
            // Scanner Preview UI
            <Box sx={{ textAlign: 'center', width: '100%' }}>
              <Paper
                sx={{
                  border: '2px dashed',
                  borderColor: 'primary.main',
                  borderRadius: 3,
                  p: { xs: 2, sm: 4, md: 6 },
                  mb: { xs: 2, sm: 3 },
                  backgroundColor: (theme) => 
                    theme.palette.mode === 'dark' 
                      ? 'rgba(59, 130, 246, 0.08)' 
                      : 'rgba(59, 130, 246, 0.04)',
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
                  Scan multiple QR codes in sequence using Inji Verify SDK
                </Typography>
                
                <Typography variant="body2" color="text.secondary">
                  Position each QR code within the camera frame. Results will appear as thumbnails below.
                </Typography>

                {/* Cache status indicator */}
                {!cacheReady && (
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      display: 'block', 
                      mt: 2,
                      color: (theme) => 
                        theme.palette.mode === 'dark' 
                          ? '#ffb74d' 
                          : 'warning.main',
                      backgroundColor: (theme) => 
                        theme.palette.mode === 'dark' 
                          ? 'rgba(255, 183, 77, 0.1)' 
                          : 'rgba(255, 152, 0, 0.1)',
                      p: 1,
                      borderRadius: 1,
                      border: (theme) => 
                        theme.palette.mode === 'dark' 
                          ? '1px solid rgba(255, 183, 77, 0.3)' 
                          : '1px solid rgba(255, 152, 0, 0.3)',
                    }}
                  >
                    ⚠️ Cache not ready - verification may require network
                  </Typography>
                )}
              </Paper>

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                <Button 
                  variant="outlined" 
                  onClick={handleClose}
                  sx={{ 
                    borderRadius: '20px', 
                    minWidth: 100,
                    fontWeight: 600,
                    borderColor: (theme) => 
                      theme.palette.mode === 'dark' 
                        ? 'rgba(255, 255, 255, 0.3)' 
                        : undefined,
                    color: (theme) => 
                      theme.palette.mode === 'dark' 
                        ? 'rgba(255, 255, 255, 0.9)' 
                        : undefined,
                    '&:hover': {
                      borderColor: (theme) => 
                        theme.palette.mode === 'dark' 
                          ? 'rgba(255, 255, 255, 0.5)' 
                          : undefined,
                      backgroundColor: (theme) => 
                        theme.palette.mode === 'dark' 
                          ? 'rgba(255, 255, 255, 0.05)' 
                          : undefined,
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  variant="contained" 
                  onClick={handleStartScanning}
                  sx={{ 
                    borderRadius: '20px', 
                    minWidth: 120,
                    py: 0.75,
                    px: 2.5,
                    fontWeight: 600,
                    textTransform: 'none',
                    backgroundColor: '#000000',
                    color: '#ffffff',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                    '[data-mui-color-scheme="dark"] &': {
                      backgroundColor: '#ffffff',
                      color: '#000000',
                      boxShadow: '0 2px 8px rgba(255, 255, 255, 0.1)',
                    },
                    '&:hover': {
                      backgroundColor: '#000000',
                      color: '#ffffff',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                      transform: 'translateY(-1px)',
                      '[data-mui-color-scheme="dark"] &': {
                        backgroundColor: '#ffffff',
                        color: '#000000',
                        boxShadow: '0 4px 12px rgba(255, 255, 255, 0.2)',
                      },
                    },
                    '&:active': {
                      transform: 'translateY(0px)',
                    },
                    '&:focus': {
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                      '[data-mui-color-scheme="dark"] &': {
                        boxShadow: '0 2px 8px rgba(255, 255, 255, 0.1)',
                      },
                    },
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  Start Scanning
                </Button>
              </Box>
            </Box>
          ) : (
            // Actual QR Scanner using SDK with Gallery
            <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
              {/* Scanner Area */}
              <Box sx={{ 
                minHeight: { xs: '300px', sm: '400px' }, 
                minWidth: { xs: '280px', sm: '400px' },
                width: '100%',
                height: { xs: '300px', sm: '400px' },
                mb: 2, 
                position: 'relative',
                border: '1px solid #ddd',
                borderRadius: 2,
                overflow: 'hidden'
              }}>
                <QRCodeVerification
                  key={`scanner-${scannerKey}`} // Fresh instance each time
                  onVerificationResult={handleVerificationResult}
                  onError={handleError}
                  credentialFormat={CredentialFormat.LDP_VC}
                  isEnableUpload={false}
                  isEnableScan={true}
                  isEnableZoom={false}
                />
              </Box>

              {/* Scanned VCs Counter and Actions */}
              {scannedVCs.length > 0 && (
                <Box sx={{ 
                  mb: 2, 
                  p: 2,
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  backgroundColor: (theme) => 
                    theme.palette.mode === 'dark' 
                      ? 'rgba(255, 255, 255, 0.02)' 
                      : 'rgba(0, 0, 0, 0.02)',
                  borderRadius: 2,
                  border: (theme) => 
                    theme.palette.mode === 'dark' 
                      ? '1px solid rgba(255, 255, 255, 0.08)' 
                      : '1px solid rgba(0, 0, 0, 0.08)',
                }}>
                  <Badge badgeContent={scannedVCs.length} color="primary">
                    <Chip 
                      label={`${scannedVCs.length} VC${scannedVCs.length > 1 ? 's' : ''} Scanned`}
                      color="primary"
                      variant="outlined"
                      sx={{
                        backgroundColor: (theme) => 
                          theme.palette.mode === 'dark' 
                            ? 'rgba(59, 130, 246, 0.1)' 
                            : 'rgba(59, 130, 246, 0.05)',
                        fontWeight: 600,
                      }}
                    />
                  </Badge>
                  <Button 
                    variant="outlined" 
                    size="small" 
                    onClick={handleClose}
                    sx={{ 
                      borderRadius: '20px',
                      borderColor: (theme) => 
                        theme.palette.mode === 'dark' 
                          ? 'rgba(255, 255, 255, 0.3)' 
                          : undefined,
                      color: (theme) => 
                        theme.palette.mode === 'dark' 
                          ? 'rgba(255, 255, 255, 0.9)' 
                          : undefined,
                      '&:hover': {
                        borderColor: (theme) => 
                          theme.palette.mode === 'dark' 
                            ? 'rgba(255, 255, 255, 0.5)' 
                            : undefined,
                        backgroundColor: (theme) => 
                          theme.palette.mode === 'dark' 
                            ? 'rgba(255, 255, 255, 0.05)' 
                            : undefined,
                      }
                    }}
                  >
                    Done
                  </Button>
                </Box>
              )}

              {/* Scanned VCs Gallery - Photo App Style - FIXED FOR DARK MODE */}
              {scannedVCs.length > 0 && (
                <Box
                  sx={{
                    p: 2,
                    backgroundColor: '#f8fafc', // Default light mode
                    borderRadius: 2,
                    maxHeight: '120px',
                    overflowY: 'auto',
                    border: '1px solid rgba(0, 0, 0, 0.08)',
                    scrollbarWidth: 'none',
                    '&::-webkit-scrollbar': { display: 'none' },
                    '[data-mui-color-scheme="dark"] &': {
                      backgroundColor: '#1a1a1a !important',
                      color: '#ffffff !important',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                    },
                  }}
                >
                  <Typography 
                    variant="subtitle2" 
                    gutterBottom 
                    sx={{ 
                      fontWeight: 600, 
                      mb: 1.5,
                      color: '#1f2937', // Default light mode
                      '[data-mui-color-scheme="dark"] &': {
                        color: '#ffffff !important',
                      },
                    }}
                  >
                    Scanned Credentials
                  </Typography>
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 1.5, 
                    flexWrap: 'wrap',
                    justifyContent: 'flex-start',
                  }}>
                    {scannedVCs.map((vc, index) => (
                      <Box key={vc.id}>
                        <Box
                          onClick={() => handleVCThumbnailClick(vc)}
                          sx={{
                            position: 'relative',
                            cursor: 'pointer',
                            borderRadius: 1,
                            overflow: 'hidden',
                            border: '2px solid',
                            borderColor: getVCColor(vc.result),
                            transition: 'all 0.2s ease',
                            boxShadow: (theme) => 
                              theme.palette.mode === 'dark' 
                                ? '0 4px 12px rgba(0,0,0,0.5)' // Stronger shadow for dark mode
                                : '0 2px 8px rgba(0,0,0,0.12)',
                            '&:hover': {
                              transform: 'scale(1.05)',
                              boxShadow: (theme) => 
                                theme.palette.mode === 'dark' 
                                  ? '0 8px 24px rgba(0,0,0,0.6)' // Even stronger shadow on hover in dark mode
                                  : '0 4px 16px rgba(0,0,0,0.2)',
                            }
                          }}
                        >
                          {/* Thumbnail Avatar */}
                          <Avatar
                            sx={{
                              width: 60,
                              height: 60,
                              backgroundColor: getVCColor(vc.result),
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              color: 'white',
                              boxShadow: (theme) => 
                                theme.palette.mode === 'dark' 
                                  ? '0 2px 8px rgba(0,0,0,0.4)' 
                                  : '0 2px 8px rgba(0,0,0,0.1)',
                            }}
                          >
                            {index + 1}
                          </Avatar>
                          
                          {/* Status Icon Overlay */}
                          <Box
                            sx={{
                              position: 'absolute',
                              top: -2,
                              right: -2,
                              backgroundColor: (theme) => 
                                theme.palette.mode === 'dark' 
                                  ? 'rgba(20, 20, 20, 0.95)' // Dark background for icon in dark mode
                                  : 'rgba(255, 255, 255, 0.95)',
                              borderRadius: '50%',
                              p: 0.25,
                              boxShadow: (theme) => 
                                theme.palette.mode === 'dark' 
                                  ? '0 2px 6px rgba(0,0,0,0.6)' 
                                  : '0 2px 4px rgba(0,0,0,0.1)',
                              border: (theme) => 
                                theme.palette.mode === 'dark' 
                                  ? '1px solid rgba(255, 255, 255, 0.1)' // Subtle border in dark mode
                                  : 'none',
                            }}
                          >
                            {React.cloneElement(getVCIcon(vc.result), {
                              sx: { fontSize: 16, color: getVCColor(vc.result) }
                            })}
                          </Box>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
      </Dialog>

      {/* Verification Result Modal */}
      <VerificationResultModal
        open={showResult}
        onClose={handleCloseResult}
        result={selectedVCForView || verificationResult}
      />
    </>
  );
}