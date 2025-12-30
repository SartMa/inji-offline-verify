// Using automatic JSX runtime
import { useMemo, useState } from 'react';
import { alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Radio from '@mui/material/Radio';
import Alert from '@mui/material/Alert';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import CloudIcon from '@mui/icons-material/Cloud';

// Dashboard template wrappers
import AppNavbar from '../../components/dash_comp/AppNavbar';
import Header from '../../components/dash_comp/Header';
import SideMenu from '../../components/dash_comp/SideMenu';
import { SidebarProvider } from '../../components/dash_comp/SidebarContext';
import AppTheme from '@inji-offline-verify/shared-ui/src/theme/AppTheme';
import OfflineIndicator from '../../components/OfflineIndicator';

// Verification components
import { OpenID4VPVerification } from '@mosip/react-inji-verify-sdk';
import OpenID4VPVerificationComponent from '../../components/OpenID4VPVerificationComponent';
import QRScannerModal from '../../components/QRScannerModal';
import VerificationResultModal from '../../components/VerificationResultModal';
import { VerificationResult } from '@mosip/react-inji-verify-sdk';

type VerificationStatus = 'valid' | 'invalid' | 'expired';
type VerificationResults = Array<{ vc: Record<string, unknown>; vcStatus: VerificationStatus }>;
type VerificationMethod = 'offline' | 'openid4vp'; 

// Page component
export default function VPVerificationPage(props: { disableCustomTheme?: boolean }) {
  const [selectOpen, setSelectOpen] = useState(false);
  const [selectedPdId, setSelectedPdId] = useState<string>('MOSIP_ID');
  const [verificationMethod, setVerificationMethod] = useState<VerificationMethod>('openid4vp');
  const [qrVisible, setQrVisible] = useState(false);
  const [vpResults, setVpResults] = useState<VerificationResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState<boolean>(false);
  
  // Offline QR scanner state
  const [showOfflineScanner, setShowOfflineScanner] = useState(false);
  const [offlineResult, setOfflineResult] = useState<VerificationResult | null>(null);
  const [showOfflineResult, setShowOfflineResult] = useState(false);

  // Configure from env with sensible default (proxied by Vite to backend)
  const verifyServiceUrl = useMemo(() => {
    return (import.meta as any)?.env?.VITE_VERIFY_SERVICE_URL || '/api';
  }, []);

  const credentialsCatalog = useMemo(() => (
    [
      { id: 'MOSIP_ID', label: 'MOSIP ID', description: 'Core identity credential' },
      { id: 'HEALTH_INSURANCE', label: 'Health Insurance', description: 'Insurance coverage credential' },
      { id: 'LAND_REGISTRY', label: 'Land Registry', description: 'Property ownership credential' },
    ]
  ), []);

  // const selectedLabel = credentialsCatalog.find(c => c.id === selectedPdId)?.label || 'Select Credential';

  const handleOpenSelection = () => {
    setVpResults(null);
    setError(null);
    setExpired(false);
    setOfflineResult(null);
    setShowOfflineResult(false);
    setSelectOpen(true);
  };

  const handleConfirmSelection = () => {
    setSelectOpen(false);
    if (verificationMethod === 'offline') {
      setShowOfflineScanner(true);
    } else {
      setQrVisible(true);
    }
  };

  const handleReset = () => {
    setQrVisible(false);
    setVpResults(null);
    setError(null);
    setExpired(false);
    setOfflineResult(null);
    setShowOfflineResult(false);
    setShowOfflineScanner(false);
  };

  const handleOfflineResult = (result: VerificationResult) => {
    setOfflineResult(result);
    setShowOfflineResult(true);
    setShowOfflineScanner(false);
  };

  const handleCloseOfflineResult = () => {
    setShowOfflineResult(false);
    setOfflineResult(null);
  };

  const handleMethodChange = (_event: React.SyntheticEvent, newValue: VerificationMethod) => {
    setVerificationMethod(newValue);
    // Reset any existing state when switching methods
    handleReset();
  };

  return (
    <AppTheme {...props}>
      <SidebarProvider>
        <CssBaseline enableColorScheme />
        <OfflineIndicator />
        <Box sx={{ display: 'flex' }}>
          <SideMenu />
          <AppNavbar />
          <Box
            component="main"
            sx={(theme) => ({
              flexGrow: 1,
              backgroundColor: theme.vars
                ? `rgba(${theme.vars.palette.background.defaultChannel} / 1)`
                : alpha(theme.palette.background.default, 1),
              overflow: 'auto',
            })}
          >
            <Stack spacing={3} sx={{ alignItems: 'center', mx: 3, pb: 5, mt: { xs: 8, md: 0 } }}>
              <Header />

              <Box sx={{ width: '100%', maxWidth: { sm: '100%', md: '1700px' } }}>
                {/* Verification Method Selection */}
                <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                    Choose Verification Method
                  </Typography>
                  <Tabs 
                    value={verificationMethod} 
                    onChange={handleMethodChange}
                    sx={{ mb: 2 }}
                  >
                    <Tab 
                      value="openid4vp" 
                      label="OpenID4VP (Online)" 
                      icon={<CloudIcon />}
                      iconPosition="start"
                      sx={{ textTransform: 'none', fontWeight: 600 }}
                    />
                    <Tab 
                      value="offline" 
                      label="Offline QR Scanner" 
                      icon={<QrCodeScannerIcon />}
                      iconPosition="start"
                      sx={{ textTransform: 'none', fontWeight: 600 }}
                    />
                  </Tabs>
                  <Typography variant="body2" color="text.secondary">
                    {verificationMethod === 'openid4vp' 
                      ? 'Generate a QR code for wallet holders to scan and submit credentials using the OpenID4VP protocol.'
                      : 'Scan QR codes directly from credential holders for offline verification.'
                    }
                  </Typography>
                </Paper>

                <Grid container spacing={3}>
                  {/* Steps column */}
                  <Grid size={{ xs: 12, md: 5, lg: 5 }}>
                    <Paper elevation={2} sx={{ p: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                        {verificationMethod === 'openid4vp' ? 'OpenID4VP Verification' : 'Offline QR Verification'}
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      
                      {verificationMethod === 'openid4vp' ? (
                        // OpenID4VP Steps
                        <List>
                          <ListItem>
                            <ListItemIcon>
                              <Box sx={{
                                width: 28, height: 28, borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                bgcolor: (theme) => alpha(theme.palette.warning.main, 0.2),
                                color: 'warning.main', fontWeight: 700
                              }}>1</Box>
                            </ListItemIcon>
                            <ListItemText
                              primary="Initiate VP Request Process"
                              secondary="Click 'Request Verifiable Credentials' to begin the process."
                              primaryTypographyProps={{ fontWeight: 600 }}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon>
                              <Box sx={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: (t) => alpha(t.palette.warning.main, 0.2), color: 'warning.main', fontWeight: 700 }}>2</Box>
                            </ListItemIcon>
                            <ListItemText
                              primary="Select Credentials & Generate QR Code"
                              secondary="Choose the required verifiable credentials and click 'Generate QR Code'."
                              primaryTypographyProps={{ fontWeight: 600 }}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon>
                              <Box sx={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: (t) => alpha(t.palette.warning.main, 0.2), color: 'warning.main', fontWeight: 700 }}>3</Box>
                            </ListItemIcon>
                            <ListItemText
                              primary="Scan QR Code (Use a Different Device)"
                              secondary="Use a wallet to scan and share the VP using the QR."
                              primaryTypographyProps={{ fontWeight: 600 }}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon>
                              <Box sx={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: (t) => alpha(t.palette.warning.main, 0.2), color: 'warning.main', fontWeight: 700 }}>4</Box>
                            </ListItemIcon>
                            <ListItemText
                              primary="View Verification Results"
                              secondary="Results will appear automatically after the wallet returns."
                              primaryTypographyProps={{ fontWeight: 600 }}
                            />
                          </ListItem>
                        </List>
                      ) : (
                        // Offline QR Steps
                        <List>
                          <ListItem>
                            <ListItemIcon>
                              <Box sx={{
                                width: 28, height: 28, borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
                                color: 'primary.main', fontWeight: 700
                              }}>1</Box>
                            </ListItemIcon>
                            <ListItemText
                              primary="Start QR Scanner"
                              secondary="Click 'Start Scanning' to open the camera scanner."
                              primaryTypographyProps={{ fontWeight: 600 }}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon>
                              <Box sx={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: (t) => alpha(t.palette.primary.main, 0.2), color: 'primary.main', fontWeight: 700 }}>2</Box>
                            </ListItemIcon>
                            <ListItemText
                              primary="Scan QR Codes"
                              secondary="Point the camera at QR codes from credential holders."
                              primaryTypographyProps={{ fontWeight: 600 }}
                            />
                          </ListItem>
                          <ListItem>
                            <ListItemIcon>
                              <Box sx={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: (t) => alpha(t.palette.primary.main, 0.2), color: 'primary.main', fontWeight: 700 }}>3</Box>
                            </ListItemIcon>
                            <ListItemText
                              primary="View Results"
                              secondary="Verification results appear immediately after scanning."
                              primaryTypographyProps={{ fontWeight: 600 }}
                            />
                          </ListItem>
                        </List>
                      )}

                      <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
                        {verificationMethod === 'openid4vp' ? (
                          <Button variant="outlined" color="warning" onClick={handleOpenSelection}>
                            Request Verifiable Credentials
                          </Button>
                        ) : (
                          <Button variant="outlined" color="primary" onClick={() => setShowOfflineScanner(true)}>
                            Start Scanning
                          </Button>
                        )}
                        {(qrVisible || showOfflineScanner) && (
                          <Button variant="text" onClick={handleReset}>Reset</Button>
                        )}
                      </Box>

                      {/* Results and Error Messages */}
                      {vpResults && (
                        <Box sx={{ mt: 2 }}>
                          <Alert severity="success" icon={<CheckCircleRoundedIcon fontSize="inherit" />}>
                            OpenID4VP verification complete. {vpResults.length} credential(s) processed.
                          </Alert>
                        </Box>
                      )}
                      {offlineResult && (
                        <Box sx={{ mt: 2 }}>
                          <Alert 
                            severity={offlineResult.verificationStatus ? "success" : "error"} 
                            icon={<CheckCircleRoundedIcon fontSize="inherit" />}
                          >
                            Offline verification {offlineResult.verificationStatus ? 'successful' : 'failed'}.
                          </Alert>
                        </Box>
                      )}
                      {error && (
                        <Box sx={{ mt: 2 }}>
                          <Alert severity="error">{error}</Alert>
                        </Box>
                      )}
                      {expired && (
                        <Box sx={{ mt: 2 }}>
                          <Alert severity="warning">QR code expired. Please request again.</Alert>
                        </Box>
                      )}
                    </Paper>
                  </Grid>

                  {/* QR column */}
                  <Grid size={{ xs: 12, md: 7, lg: 7 }}>
                    <Paper elevation={2} sx={{ p: 2, minHeight: 420, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                      {!qrVisible && verificationMethod === 'openid4vp' ? (
                        <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                          <CloudIcon sx={{ fontSize: 64, mb: 2, opacity: 0.6 }} />
                          <Typography variant="subtitle1">OpenID4VP QR code will appear here</Typography>
                          <Typography variant="body2">Select credentials and generate the QR to start verification.</Typography>
                        </Box>
                      ) : verificationMethod === 'offline' ? (
                        <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                          <QrCodeScannerIcon sx={{ fontSize: 64, mb: 2, opacity: 0.6 }} />
                          <Typography variant="subtitle1">Offline QR Scanner</Typography>
                          <Typography variant="body2">Click 'Start Scanning' to open the camera and scan QR codes directly.</Typography>
                        </Box>
                      ) : (
                        <OpenID4VPVerificationComponent
                          triggerElement={<Button variant="contained" color="warning">Generate QR Code</Button>}
                          verifyServiceUrl={verifyServiceUrl}
                          presentationDefinitionId={selectedPdId}
                          onVPProcessed={(res) => {
                            setVpResults(res);
                          }}
                          onQrCodeExpired={() => setExpired(true)}
                          onError={(e) => setError(e.message)}
                          expiresInMinutes={10}
                        />
                      )}
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            </Stack>
          </Box>
        </Box>

        {/* Selection dialog - only for OpenID4VP */}
        {verificationMethod === 'openid4vp' && (
          <Dialog open={selectOpen} onClose={() => setSelectOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>Select Verifiable Credential</DialogTitle>
            <DialogContent dividers>
              <List>
                {credentialsCatalog.map((c) => (
                  <ListItem key={c.id} disableGutters secondaryAction={<Radio checked={selectedPdId === c.id} onChange={() => setSelectedPdId(c.id)} /> }>
                    <ListItemButton onClick={() => setSelectedPdId(c.id)}>
                      <ListItemIcon><VerifiedUserIcon color={selectedPdId === c.id ? 'warning' : 'disabled'} /></ListItemIcon>
                      <ListItemText primary={c.label} secondary={c.description} />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectOpen(false)}>Cancel</Button>
              <Button variant="contained" color="warning" onClick={handleConfirmSelection}>Generate QR</Button>
            </DialogActions>
          </Dialog>
        )}

        {/* Offline QR Scanner Modal */}
        <QRScannerModal
          open={showOfflineScanner}
          onClose={() => setShowOfflineScanner(false)}
          onResult={handleOfflineResult}
        />

        {/* Offline Verification Result Modal */}
        <VerificationResultModal
          open={showOfflineResult}
          onClose={handleCloseOfflineResult}
          result={offlineResult}
        />
      </SidebarProvider>
    </AppTheme>
  );
}
