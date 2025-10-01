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
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';

// Dashboard template wrappers
import AppNavbar from '../../components/dash_comp/AppNavbar';
import Header from '../../components/dash_comp/Header';
import SideMenu from '../../components/dash_comp/SideMenu';
import { SidebarProvider } from '../../components/dash_comp/SidebarContext';
import AppTheme from '@inji-offline-verify/shared-ui/src/theme/AppTheme';
import OfflineIndicator from '../../components/OfflineIndicator';

// SDK component
import { OpenID4VPVerification } from '@mosip/react-inji-verify-sdk';
type VerificationStatus = 'valid' | 'invalid' | 'expired';
type VerificationResults = Array<{ vc: Record<string, unknown>; vcStatus: VerificationStatus }>; 

// Page component
export default function VPVerificationPage(props: { disableCustomTheme?: boolean }) {
  const [selectOpen, setSelectOpen] = useState(false);
  const [selectedPdId, setSelectedPdId] = useState<string>('MOSIP_ID');
  const [qrVisible, setQrVisible] = useState(false);
  const [vpResults, setVpResults] = useState<VerificationResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState<boolean>(false);

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
    setSelectOpen(true);
  };

  const handleConfirmSelection = () => {
    setSelectOpen(false);
    setQrVisible(true);
  };

  const handleReset = () => {
    setQrVisible(false);
    setVpResults(null);
    setError(null);
    setExpired(false);
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
                <Grid container spacing={3}>
                  {/* Steps column */}
                  <Grid size={{ xs: 12, md: 5, lg: 5 }}>
                    <Paper elevation={2} sx={{ p: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                        VP Verification
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
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

                      <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
                        <Button variant="outlined" color="warning" onClick={handleOpenSelection}>
                          Request Verifiable Credentials
                        </Button>
                        {qrVisible && (
                          <Button variant="text" onClick={handleReset}>Reset</Button>
                        )}
                      </Box>

                      {vpResults && (
                        <Box sx={{ mt: 2 }}>
                          <Alert severity="success" icon={<CheckCircleRoundedIcon fontSize="inherit" />}>
                            Verification complete. {vpResults.length} credential(s) processed.
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
                      {!qrVisible ? (
                        <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                          <VerifiedUserIcon sx={{ fontSize: 64, mb: 2, opacity: 0.6 }} />
                          <Typography variant="subtitle1">QR code will appear here</Typography>
                          <Typography variant="body2">Select credentials and generate the QR to start verification.</Typography>
                        </Box>
                      ) : (
                        <OpenID4VPVerification
                          triggerElement={<Button variant="contained" color="warning">Generate QR Code</Button>}
                          verifyServiceUrl={verifyServiceUrl}
                          protocol={"openid4vp://"}
                          presentationDefinitionId={selectedPdId}
                          onVPProcessed={(res) => {
                            setVpResults(res);
                          }}
                          onQrCodeExpired={() => setExpired(true)}
                          onError={(e) => setError(e.message)}
                        />
                      )}
                    </Paper>
                  </Grid>
                </Grid>
              </Box>
            </Stack>
          </Box>
        </Box>

        {/* Selection dialog */}
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
      </SidebarProvider>
    </AppTheme>
  );
}
