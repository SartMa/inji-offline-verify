import React, { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, Box, Typography, IconButton, Paper, Button } from '@mui/material';
import { Close, CloudUpload } from '@mui/icons-material';
import { CredentialsVerifier, VerificationResult, CredentialFormat } from '@mosip/react-inji-verify-sdk';
import VerificationResultModal from './VerificationResultModal';
import { WorkerCacheService } from '../services/WorkerCacheService';

interface Props {
  open: boolean;
  onClose: () => void;
  onResult: (file: File) => void;
}

export default function FileUploadModal({ open, onClose, onResult }: Props) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleVerifyFile = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    try {
      const content = await selectedFile.text();
      const verifier = new CredentialsVerifier();
      const result = await verifier.verify(content, CredentialFormat.LDP_VC); // SDK verifies using its cache
      await WorkerCacheService.storeVerificationResult(result);
      setVerificationResult(result);
      setShowResult(true);
      onResult(selectedFile);
    } catch (e: any) {
      setVerificationResult(new VerificationResult(false, e?.message || 'File verification failed', 'FILE_ERROR'));
      setShowResult(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const closeAll = () => {
    setSelectedFile(null);
    setVerificationResult(null);
    setShowResult(false);
    setIsProcessing(false);
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={closeAll} maxWidth="sm" fullWidth PaperProps={{ 
        sx: { 
          borderRadius: 3, 
          minHeight: '400px',
          backgroundColor: 'background.paper',
          backgroundImage: 'none', // Remove default MUI background gradient in dark mode
        } 
      }}>
        <DialogTitle sx={{ p: 2, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CloudUpload sx={{ color: 'primary.main' }} />
              <Typography variant="h6">Upload File</Typography>
            </Box>
            <IconButton onClick={closeAll} size="small"><Close /></IconButton>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 3 }}>
          <Box sx={{ textAlign: 'center' }}>
            <Paper
              sx={{
                border: '2px dashed',
                borderColor: selectedFile ? 'success.main' : 'primary.main',
                borderRadius: 3,
                p: 6,
                mb: 3,
                backgroundColor: selectedFile 
                  ? (theme) => 
                      theme.palette.mode === 'dark' 
                        ? 'rgba(16, 185, 129, 0.08)' 
                        : 'rgba(16, 185, 129, 0.04)'
                  : (theme) => 
                      theme.palette.mode === 'dark' 
                        ? 'rgba(139, 92, 246, 0.08)' 
                        : 'rgba(139, 92, 246, 0.04)',
                cursor: 'pointer',
              }}
              onClick={() => fileInputRef.current?.click()}
            >
              <Box sx={{
                width: 80, height: 80, borderRadius: 3,
                background: selectedFile
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', m: '0 auto 24px',
              }}>
                <CloudUpload sx={{ fontSize: 32, color: 'white' }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {selectedFile ? selectedFile.name : 'Choose File'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedFile ? 'Click to select a different file' : 'Select a credential file to verify'}
              </Typography>
              <input ref={fileInputRef} type="file" accept=".json,.txt" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} style={{ display: 'none' }} />
            </Paper>

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button 
                variant="outlined" 
                onClick={closeAll} 
                disabled={isProcessing}
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
                    opacity: 0.8,
                    backgroundColor: (theme) => 
                      theme.palette.mode === 'dark' 
                        ? 'rgba(255, 255, 255, 0.03)' 
                        : 'rgba(0, 0, 0, 0.03)',
                  }
                }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleVerifyFile}
                disabled={!selectedFile || isProcessing}
                sx={{
                  borderRadius: '20px',
                  minWidth: 120,
                  fontWeight: 600,
                  color: 'white',
                  background: (theme) => 
                    theme.palette.mode === 'dark' 
                      ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                      : 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  '&:hover': {
                    opacity: 0.9,
                    transform: 'translateY(-1px)',
                  },
                  '&:disabled': {
                    background: (theme) => 
                      theme.palette.mode === 'dark' 
                        ? 'rgba(139, 92, 246, 0.3)'
                        : 'rgba(139, 92, 246, 0.3)',
                    color: (theme) => 
                      theme.palette.mode === 'dark' 
                        ? 'rgba(255, 255, 255, 0.5)'
                        : 'rgba(255, 255, 255, 0.7)',
                  },
                  boxShadow: (theme) => 
                    theme.palette.mode === 'dark' 
                      ? '0 4px 12px rgba(139, 92, 246, 0.3)'
                      : '0 4px 12px rgba(139, 92, 246, 0.3)',
                }}
              >
                {isProcessing ? 'Verifying...' : 'Verify File'}
              </Button>
            </Box>
          </Box>
        </DialogContent>
      </Dialog>

      <VerificationResultModal open={showResult} onClose={() => { setShowResult(false); setVerificationResult(null); }} result={verificationResult} />
    </>
  );
}