import { Dialog, DialogContent, Box, Typography, IconButton, Paper, Button, Chip, Divider, Tooltip, Stack } from '@mui/material';
import { Close, CheckCircle, Error as ErrorIcon, Warning, Launch } from '@mui/icons-material';
import { VerificationResult } from '@mosip/react-inji-verify-sdk';

interface Props {
  open: boolean;
  onClose: () => void;
  result: VerificationResult | null;
}

// Helper to format keys (e.g., 'childFullName' -> 'Child Full Name')
const formatLabel = (key: string) => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase());
};

// Helper to check if a value is a URL
const isURL = (value: any) => {
  return typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));
};

const CredentialField = ({ label, value }: { label: string; value: any }) => (
  <Box sx={{ 
    p: 2, 
    backgroundColor: 'background.paper', 
    borderRadius: 1.5,
    border: '1px solid',
    borderColor: 'divider',
    transition: 'all 0.2s',
    '&:hover': {
      borderColor: 'primary.main',
      boxShadow: 1
    }
  }}>
    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 500 }}>
      {label}
    </Typography>
    <Typography variant="body1" sx={{ fontWeight: 600, wordBreak: 'break-word', color: 'text.primary' }}>
      {isURL(value) ? (
        <Box component="a" href={value} target="_blank" rel="noopener noreferrer" sx={{ 
          color: 'primary.main', 
          textDecoration: 'none',
          '&:hover': { textDecoration: 'underline' },
          display: 'flex',
          alignItems: 'center',
          gap: 0.5
        }}>
          {String(value)}
          <Launch sx={{ fontSize: 16 }} />
        </Box>
      ) : (
        String(value)
      )}
    </Typography>
  </Box>
);

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

  const credential = (result as any).payload as any | undefined;
  const credentialType: string | undefined = Array.isArray(credential?.type)
    ? credential.type.find((t: string) => t !== 'VerifiableCredential')
    : credential?.type;
  const subject: Record<string, any> | undefined = credential?.credentialSubject;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 4, overflow: 'visible' } }}
    >
      <Box sx={{ background: headerBg, color: 'white', p: 3, textAlign: 'center', position: 'relative' }}>
        <IconButton 
          onClick={onClose} 
          size="small" 
          sx={{ 
            position: 'absolute', 
            top: 12, 
            right: 12, 
            color: 'white',
            backgroundColor: 'rgba(255,255,255,0.1)',
            '&:hover': { backgroundColor: 'rgba(255,255,255,0.2)' }
          }}
        >
          <Close />
        </IconButton>
        {isVerified ? (isExpired ? <Warning sx={{ fontSize: 56 }} /> : <CheckCircle sx={{ fontSize: 56 }} />) : <ErrorIcon sx={{ fontSize: 56 }} />}
        <Typography variant="h5" sx={{ mt: 2, fontWeight: 600 }}>
          {titleText}
        </Typography>
      </Box>

      <DialogContent sx={{ p: { xs: 2, sm: 4 }, mt: '-16px' }}>
        <Paper
          elevation={3}
          sx={{
            p: { xs: 2, sm: 3 },
            borderRadius: 3,
            backgroundColor: 'background.paper',
            position: 'relative',
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
            <Chip 
              label={isVerified ? 'VERIFIED' : 'INVALID'} 
              color={isVerified ? 'success' : 'error'} 
              size="medium"
              sx={{ fontWeight: 600, px: 2 }}
            />
          </Box>

          {/* Verification Status Section */}
          <Stack spacing={2} sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
              Verification Details
            </Typography>
            
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fit, minmax(250px, 1fr))' } }}>
              <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Status
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {isVerified ? 'Valid signature' : 'Invalid signature'}
                </Typography>
              </Box>

              {result.verificationMessage && (
                <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Message
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {result.verificationMessage}
                  </Typography>
                </Box>
              )}

              {result.verificationErrorCode && (
                <Box sx={{ p: 2, backgroundColor: 'grey.50', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Error Code
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600, fontFamily: 'monospace' }}>
                    {result.verificationErrorCode}
                  </Typography>
                </Box>
              )}
            </Box>
          </Stack>

          {/* Credential Details Section */}
          {subject && (
            <>
              <Divider sx={{ my: 3 }} />
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.primary' }}>
                    {formatLabel(credentialType || 'Credential')}
                  </Typography>
                  {credential?.id && isURL(credential.id) && (
                    <Tooltip title="View Raw Credential">
                      <IconButton size="small" href={credential.id} target="_blank" rel="noopener noreferrer">
                        <Launch fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>

                <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0,1fr))', md: 'repeat(3, minmax(0,1fr))' } }}>
                  {Object.entries(subject).map(([key, value]) => (
                    <Box key={key}>
                      <CredentialField label={formatLabel(key)} value={value} />
                    </Box>
                  ))}
                </Box>
              </Stack>
            </>
          )}
        </Paper>

        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Button 
            variant="outlined" 
            onClick={onClose} 
            sx={{ 
              borderRadius: '24px', 
              minWidth: 200,
              py: 1.5,
              fontWeight: 600,
              borderWidth: 2,
              '&:hover': { borderWidth: 2 }
            }}
          >
            Verify Another Credential
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  );
}