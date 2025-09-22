import React, { useState } from 'react';
import { Box, Card, CardContent, Typography, Button } from '@mui/material';
import { QrCodeScanner, CloudUpload } from '@mui/icons-material';
import QRScannerModal from './QRScannerModal';
import FileUploadModal from './FileUploadModal';

interface VerificationActionsProps {
  onScanComplete?: (data: any) => void;
  onUploadComplete?: (file: File) => void;
}

export default function VerificationActions({ onScanComplete, onUploadComplete }: VerificationActionsProps) {
  const [showScanner, setShowScanner] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  return (
    <>
      <Box sx={{ display: 'flex', gap: 3 }}>
        {/* Scan QR Code Card */}
        <Card
          sx={{
            flex: 1,
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: (t) => t.shadows[8] },
          }}
          onClick={() => setShowScanner(true)}
        >
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Box sx={{
              width: 64, height: 64, borderRadius: '12px',
              background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', m: '0 auto 16px',
            }}>
              <QrCodeScanner sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Scan QR Code
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Scan verifiable credentials using camera
            </Typography>
            <Button
              variant="contained"
              sx={{
                mt: 2, 
                borderRadius: '20px',
                color: 'white',
                background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                boxShadow: 'none',
                '&:hover': { 
                  opacity: 0.9,
                  transform: 'translateY(-1px)',
                  background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                  boxShadow: 'none',
                },
                '&:active': {
                  background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                  boxShadow: 'none',
                },
                '&:focus': {
                  background: 'linear-gradient(135deg, #374151 0%, #1f2937 100%)',
                  boxShadow: 'none',
                },
              }}
            >
              Start Scan
            </Button>
          </CardContent>
        </Card>

        {/* Upload File Card */}
        <Card
          sx={{
            flex: 1,
            cursor: 'pointer',
            transition: 'all 0.2s ease-in-out',
            '&:hover': { transform: 'translateY(-2px)', boxShadow: (t) => t.shadows[8] },
          }}
          onClick={() => setShowUpload(true)}
        >
          <CardContent sx={{ textAlign: 'center', py: 4 }}>
            <Box sx={{
              width: 64, height: 64, borderRadius: '12px',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', m: '0 auto 16px',
            }}>
              <CloudUpload sx={{ fontSize: 32, color: 'white' }} />
            </Box>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Upload File
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Upload credential files for verification
            </Typography>
            <Button
              variant="outlined"
              sx={{
                mt: 2, borderRadius: '20px', borderColor: '#8b5cf6', color: '#8b5cf6',
                '&:hover': { borderColor: '#7c3aed', backgroundColor: 'rgba(139, 92, 246, 0.04)' },
              }}
            >
              Choose File
            </Button>
          </CardContent>
        </Card>
      </Box>

      {/* Scanner Modal */}
      <QRScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onResult={(r) => onScanComplete?.(r)}
      />

      {/* Upload Modal */}
      <FileUploadModal
        open={showUpload}
        onClose={() => setShowUpload(false)}
        onResult={(f) => onUploadComplete?.(f)}
      />
    </>
  );
}