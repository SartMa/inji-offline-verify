import { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  IconButton,
  Paper,
  styled,
  alpha,
} from '@mui/material';
import {
  QrCodeScanner,
  CloudUpload,
  Close,
  CameraAlt,
} from '@mui/icons-material';

interface VerificationActionsProps {
  onScanComplete?: (data: any) => void;
  onUploadComplete?: (file: File) => void;
}

const StyledPaper = styled(Paper)(({ theme }) => ({
  minHeight: 350,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: alpha(theme.palette.primary.main, 0.05),
  border: `2px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
  borderRadius: theme.spacing(1),
  padding: theme.spacing(3),
  textAlign: 'center',
}));

const UploadPaper = styled(Paper)(({ theme }) => ({
  minHeight: 250,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: alpha(theme.palette.secondary.main, 0.05),
  border: `2px dashed ${alpha(theme.palette.secondary.main, 0.3)}`,
  borderRadius: theme.spacing(1),
  padding: theme.spacing(3),
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    backgroundColor: alpha(theme.palette.secondary.main, 0.08),
    borderColor: alpha(theme.palette.secondary.main, 0.5),
  },
}));

export default function VerificationActions({ 
  onScanComplete, 
  onUploadComplete 
}: VerificationActionsProps) {
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const handleScanClick = () => {
    setScanDialogOpen(true);
  };

  const handleUploadClick = () => {
    setUploadDialogOpen(true);
  };

  const handleScanClose = () => {
    setScanDialogOpen(false);
  };

  const handleUploadClose = () => {
    setUploadDialogOpen(false);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && onUploadComplete) {
      onUploadComplete(file);
    }
    handleUploadClose();
  };

  return (
    <Box>
      {/* Action Buttons */}
      <Box 
        sx={{ 
          display: 'flex', 
          gap: 2, 
          flexDirection: { xs: 'column', sm: 'row' },
          mb: 1,
          justifyContent: 'center',
          maxWidth: '600px',
          mx: 'auto'
        }}
      >
        <Button
          variant="contained"
          startIcon={<QrCodeScanner />}
          onClick={handleScanClick}
          size="large"
          sx={{
            flex: 1,
            py: 1.5,
            px: 3,
            fontSize: '1rem',
            minHeight: '50px',
          }}
        >
          Scan QR Code
        </Button>
        
        <Button
          variant="outlined"
          startIcon={<CloudUpload />}
          onClick={handleUploadClick}
          size="large"
          sx={{
            flex: 1,
            py: 1.5,
            px: 3,
            fontSize: '1rem',
            minHeight: '50px',
          }}
        >
          Upload File
        </Button>
      </Box>

      {/* Scan Dialog */}
      <Dialog
        open={scanDialogOpen}
        onClose={handleScanClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 1
        }}>
          <Typography variant="h6" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CameraAlt color="primary" />
            Scan QR Code
          </Typography>
          <IconButton onClick={handleScanClose} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          <StyledPaper>
            <QrCodeScanner 
              sx={{ 
                fontSize: 64, 
                color: 'primary.main',
                mb: 2
              }} 
            />
            <Typography variant="h6" gutterBottom color="primary">
              Camera Scanner
            </Typography>
            <Typography variant="body2" color="text.secondary">
              QR code scanner will be integrated here using Inji Verify SDK
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              Position the QR code within the camera frame
            </Typography>
          </StyledPaper>
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleScanClose} color="inherit">
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleScanClose}
            disabled
            sx={{ opacity: 0.6 }}
          >
            Start Scanning
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog
        open={uploadDialogOpen}
        onClose={handleUploadClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 1
        }}>
          <Typography variant="h6" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudUpload color="primary" />
            Upload Verification File
          </Typography>
          <IconButton onClick={handleUploadClose} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          <UploadPaper component="label">
            <input
              type="file"
              hidden
              onChange={handleFileSelect}
              accept=".json,.pdf,.png,.jpg,.jpeg"
            />
            <CloudUpload 
              sx={{ 
                fontSize: 64, 
                color: 'secondary.main',
                mb: 2
              }} 
            />
            <Typography variant="h6" gutterBottom color="secondary">
              Choose File to Upload
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Click here to select a verification file
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
              Supported formats: JSON, PDF, PNG, JPG, JPEG
            </Typography>
          </UploadPaper>
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleUploadClose} color="inherit">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
