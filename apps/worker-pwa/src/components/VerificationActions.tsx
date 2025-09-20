import { useState, useRef } from 'react';
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
  useTheme,
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

export default function VerificationActions({ 
  onScanComplete, 
  onUploadComplete 
}: VerificationActionsProps) {
  const [scanDialogOpen, setScanDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const theme = useTheme();
  
  // Placeholder read to avoid TS6133 until scan integration is added
  void onScanComplete;

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
      {/* Action Buttons Container - matching SystemStatus style */}
      <Box sx={{ 
        display: 'flex', 
        gap: 2,
        flexWrap: 'wrap',
        justifyContent: 'center',
        [theme.breakpoints.down('md')]: {
          flexDirection: 'column',
          gap: 1.5,
        }
      }}>
        {/* Scan QR Code Button */}
        <Box
          sx={{
            flex: '1 1 250px',
            minWidth: 250,
            maxWidth: 400,
            p: 2.5,
            borderRadius: 2,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
            transition: 'all 0.2s ease-in-out',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            '[data-mui-color-scheme="dark"] &': {
              backgroundColor: alpha(theme.palette.grey[800], 0.8),
              border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
            },
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.05),
              transform: 'translateY(-1px)',
              boxShadow: theme.shadows[2],
              border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
              '[data-mui-color-scheme="dark"] &': {
                backgroundColor: alpha(theme.palette.grey[700], 0.9),
                boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.4)}`,
                border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
              },
            },
            [theme.breakpoints.down('md')]: {
              minWidth: 'unset',
              flex: 'unset',
            }
          }}
        >
          <QrCodeScanner 
            sx={{ 
              fontSize: 40, 
              color: 'primary.main',
              mb: 1.5
            }} 
          />
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 600,
              color: 'text.primary',
              mb: 1
            }}
          >
            Scan QR Code
          </Typography>
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{ mb: 2 }}
          >
            Scan verifiable credentials using camera
          </Typography>
          <Button
            variant="contained"
            onClick={handleScanClick}
            size="medium"
            sx={{
              px: 3,
              py: 1,
              fontSize: '0.875rem',
              fontWeight: 600,
              minWidth: '120px',
            }}
          >
            Start Scan
          </Button>
        </Box>

        {/* Upload File Button */}
        <Box
          sx={{
            flex: '1 1 250px',
            minWidth: 250,
            maxWidth: 400,
            p: 2.5,
            borderRadius: 2,
            backgroundColor: theme.palette.background.paper,
            border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
            transition: 'all 0.2s ease-in-out',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            '[data-mui-color-scheme="dark"] &': {
              backgroundColor: alpha(theme.palette.grey[800], 0.8),
              border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
            },
            '&:hover': {
              backgroundColor: alpha(theme.palette.secondary.main, 0.05),
              transform: 'translateY(-1px)',
              boxShadow: theme.shadows[2],
              border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
              '[data-mui-color-scheme="dark"] &': {
                backgroundColor: alpha(theme.palette.grey[700], 0.9),
                boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.4)}`,
                border: `1px solid ${alpha(theme.palette.divider, 0.4)}`,
              },
            },
            [theme.breakpoints.down('md')]: {
              minWidth: 'unset',
              flex: 'unset',
            }
          }}
        >
          <CloudUpload 
            sx={{ 
              fontSize: 40, 
              color: 'secondary.main',
              mb: 1.5
            }} 
          />
          <Typography 
            variant="h6" 
            sx={{ 
              fontWeight: 600,
              color: 'text.primary',
              mb: 1
            }}
          >
            Upload File
          </Typography>
          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{ mb: 2 }}
          >
            Upload credential files for verification
          </Typography>
          <Button
            variant="outlined"
            onClick={handleUploadClick}
            size="medium"
            sx={{
              px: 3,
              py: 1,
              fontSize: '0.875rem',
              fontWeight: 600,
              minWidth: '120px',
              borderColor: alpha(theme.palette.secondary.main, 0.5),
              color: 'secondary.main',
              '&:hover': {
                borderColor: 'secondary.main',
                backgroundColor: alpha(theme.palette.secondary.main, 0.08),
              },
            }}
          >
            Choose File
          </Button>
        </Box>
      </Box>

      {/* Scan Dialog */}
      <Dialog
        open={scanDialogOpen}
        onClose={handleScanClose}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.paper,
            '[data-mui-color-scheme="dark"] &': {
              backgroundColor: theme.palette.grey[900],
            },
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 1,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
        }}>
          <Typography variant="h6" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CameraAlt color="primary" />
            Scan QR Code
          </Typography>
          <IconButton onClick={handleScanClose} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          <Paper
            sx={{
              minHeight: 350,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(theme.palette.primary.main, 0.05),
              border: `2px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              '[data-mui-color-scheme="dark"] &': {
                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                border: `2px dashed ${alpha(theme.palette.primary.main, 0.4)}`,
              },
            }}
          >
            <QrCodeScanner 
              sx={{ 
                fontSize: 64, 
                color: 'primary.main',
                mb: 2
              }} 
            />
            <Typography variant="h6" gutterBottom color="primary" sx={{ fontWeight: 600 }}>
              Camera Scanner
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              QR code scanner will be integrated here using Inji Verify SDK
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Position the QR code within the camera frame
            </Typography>
          </Paper>
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleScanClose} color="inherit">
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleScanClose}
            disabled
            sx={{ 
              opacity: 0.6,
              '&.Mui-disabled': {
                backgroundColor: alpha(theme.palette.primary.main, 0.3),
                color: alpha(theme.palette.primary.contrastText, 0.6),
              }
            }}
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
        PaperProps={{
          sx: {
            backgroundColor: theme.palette.background.paper,
            '[data-mui-color-scheme="dark"] &': {
              backgroundColor: theme.palette.grey[900],
            },
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 1,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
        }}>
          <Typography variant="h6" component="div" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CloudUpload color="primary" />
            Upload Verification File
          </Typography>
          <IconButton onClick={handleUploadClose} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          <Paper 
            onClick={() => fileInputRef.current?.click()} 
            role="button" 
            aria-label="Choose file to upload"
            sx={{
              minHeight: 250,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: alpha(theme.palette.secondary.main, 0.05),
              border: `2px dashed ${alpha(theme.palette.secondary.main, 0.3)}`,
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              '[data-mui-color-scheme="dark"] &': {
                backgroundColor: alpha(theme.palette.secondary.main, 0.1),
                border: `2px dashed ${alpha(theme.palette.secondary.main, 0.4)}`,
              },
              '&:hover': {
                backgroundColor: alpha(theme.palette.secondary.main, 0.08),
                borderColor: alpha(theme.palette.secondary.main, 0.5),
                transform: 'translateY(-1px)',
                '[data-mui-color-scheme="dark"] &': {
                  backgroundColor: alpha(theme.palette.secondary.main, 0.15),
                },
              },
            }}
          >
            <input
              ref={fileInputRef}
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
            <Typography variant="h6" gutterBottom color="secondary" sx={{ fontWeight: 600 }}>
              Choose File to Upload
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Click here to select a verification file
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Supported formats: JSON, PDF, PNG, JPG, JPEG
            </Typography>
          </Paper>
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