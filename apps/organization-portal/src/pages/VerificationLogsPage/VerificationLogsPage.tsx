import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { alpha } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import AppNavbar from '../../components/dash_comp/AppNavbar';
import SideMenu from '../../components/dash_comp/SideMenu';
import AppTheme from '../../theme/dash_theme/AppTheme';
import { SidebarProvider } from '../../components/dash_comp/SidebarContext';
import VerificationLogsTable from '../../components/VerificationLogsTable';
import { VerificationLog } from '../../services/logsService';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import { useOrganizationUsers } from '../../hooks/useOrganizationUsers';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PersonIcon from '@mui/icons-material/Person';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

interface LogDetailDialogProps {
  log: VerificationLog | null;
  open: boolean;
  onClose: () => void;
}

function LogDetailDialog({ log, open, onClose }: LogDetailDialogProps) {
  if (!log) return null;

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return 'success';
      case 'FAILED':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCESS':
        return <CheckCircleIcon fontSize="small" />;
      case 'FAILED':
        return <ErrorIcon fontSize="small" />;
      default:
        return undefined;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="h6">Verification Log Details</Typography>
          <Chip
            icon={getStatusIcon(log.verification_status)}
            label={log.verification_status}
            color={getStatusColor(log.verification_status) as any}
            size="small"
          />
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Log ID
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {log.id}
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Verification Time
            </Typography>
            <Typography variant="body2">
              {formatDate(log.verified_at)}
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Sync Time
            </Typography>
            <Typography variant="body2">
              {formatDate(log.synced_at)}
            </Typography>
          </Box>

          {log.vc_hash && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                VC Hash
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {log.vc_hash}
              </Typography>
            </Box>
          )}

          {log.credential_subject && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Credential Subject
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                <pre style={{ 
                  margin: 0, 
                  fontSize: '0.875rem', 
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace'
                }}>
                  {JSON.stringify(log.credential_subject, null, 2)}
                </pre>
              </Paper>
            </Box>
          )}

          {log.error_message && (
            <Box>
              <Typography variant="subtitle2" color="error" gutterBottom>
                Error Message
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'error.50', borderColor: 'error.200' }}>
                <Typography variant="body2" color="error.main">
                  {log.error_message}
                </Typography>
              </Paper>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function VerificationLogsPage() {
  const { userId } = useParams<{ userId?: string }>();
  const navigate = useNavigate();
  const { organizationId, organizationName } = useCurrentUser();
  const [selectedLog, setSelectedLog] = React.useState<VerificationLog | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // Get user info if userId is provided
  const { data: usersData } = useOrganizationUsers({
    orgId: organizationId || '',
    page: 1,
    pageSize: 100, // Get enough to find the user
  });

  const currentUser = userId && usersData?.members.find(member => member.id === userId);

  const handleViewLog = (log: VerificationLog) => {
    setSelectedLog(log);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedLog(null);
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  return (
    <AppTheme>
      <SidebarProvider>
        <CssBaseline enableColorScheme />
        <Box sx={{ display: 'flex' }}>
          <SideMenu />
          <AppNavbar />
          {/* Main content */}
          <Box
            component="main"
            sx={(theme) => ({
              flexGrow: 1,
              backgroundColor: theme.vars
                ? `rgba(${theme.vars.palette.background.defaultChannel} / 1)`
                : alpha(theme.palette.background.default, 1),
              overflow: 'auto',
              minHeight: '100vh',
            })}
          >
            <Stack
              spacing={2}
              sx={{
                alignItems: 'flex-start',
                mx: 3,
                pb: 5,
                mt: { xs: 8, md: 0 },
              }}
            >
              {/* Header */}
              <Box sx={{ width: '100%', pt: 3 }}>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
                  <Button
                    startIcon={<ArrowBackIcon />}
                    onClick={handleBack}
                    color="primary"
                  >
                    Back to Dashboard
                  </Button>
                </Stack>

                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                  <Typography variant="h4" component="h1">
                    Verification Logs
                  </Typography>
                  {currentUser && (
                    <Chip
                      icon={<PersonIcon />}
                      label={`${currentUser.full_name || currentUser.username}'s logs`}
                      color="primary"
                      variant="outlined"
                    />
                  )}
                </Stack>

                {organizationName && (
                  <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
                    {organizationName}
                    {currentUser && ` • User: ${currentUser.full_name || currentUser.username}`}
                  </Typography>
                )}

                <Divider sx={{ mb: 3 }} />
              </Box>

              {/* Logs Table */}
              <Box sx={{ width: '100%' }}>
                {organizationId ? (
                  <VerificationLogsTable
                    orgId={organizationId}
                    userId={userId}
                    onViewLog={handleViewLog}
                    showUserColumn={!userId} // Hide user column when viewing specific user's logs
                  />
                ) : (
                  <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography variant="h6" color="error" gutterBottom>
                      Organization Not Found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Unable to load organization information. Please ensure you're logged in.
                    </Typography>
                  </Paper>
                )}
              </Box>
            </Stack>
          </Box>
        </Box>

        {/* Log Detail Dialog */}
        <LogDetailDialog
          log={selectedLog}
          open={dialogOpen}
          onClose={handleCloseDialog}
        />
      </SidebarProvider>
    </AppTheme>
  );
}