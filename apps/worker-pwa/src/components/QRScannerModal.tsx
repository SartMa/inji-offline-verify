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

  const handleError = (error: Error) => {
    console.error('QR Scanner error:', error);
    const errorResult = new VerificationResult(false, error.message, 'SCAN_ERROR');
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
            backgroundImage: 'none', // Remove default MUI background gradient in dark mode
          },
        }}
      >
        <DialogTitle sx={{ p: 2, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <QrCodeScanner sx={{ color: 'primary.main' }} />
              <Typography variant="h6" component="span">
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
                    fontWeight: 600,
                    color: 'white',
                    background: (theme) => 
                      theme.palette.mode === 'dark' 
                        ? 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)'
                        : 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                    '&:hover': {
                      opacity: 0.9,
                      transform: 'translateY(-1px)',
                      background: (theme) => 
                        theme.palette.mode === 'dark' 
                          ? 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)'
                          : 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                    },
                    '&:active': {
                      background: (theme) => 
                        theme.palette.mode === 'dark' 
                          ? 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)'
                          : 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                    },
                    '&:focus': {
                      background: (theme) => 
                        theme.palette.mode === 'dark' 
                          ? 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)'
                          : 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                    },
                    boxShadow: (theme) => 
                      theme.palette.mode === 'dark' 
                        ? '0 4px 12px rgba(25, 118, 210, 0.3)'
                        : '0 4px 12px rgba(55, 65, 81, 0.3)',
                  }}
                >
                  Start Scanning
                </Button>
              </Box>
            </Box>
          ) : (
            // Actual QR Scanner using SDK with Gallery
            <Box sx={{ position: 'relative' }}>
              {/* Scanner Area */}
              <Box sx={{ minHeight: '400px', mb: 2, position: 'relative' }}>
                <QRCodeVerification
                  key={`scanner-${scannerKey}`} // Fresh instance each time
                  mode="offline"  // Use offline mode to leverage SDK cache
                  onVerificationResult={handleVerificationResult}
                  onError={handleError}
                  credentialFormat={CredentialFormat.LDP_VC}
                  isEnableUpload={false}
                  isEnableScan={true}
                  isEnableZoom={true}
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