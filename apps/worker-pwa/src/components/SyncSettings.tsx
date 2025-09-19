import { useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { LoadingButton } from '@mui/lab';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import DialogContentText from '@mui/material/DialogContentText';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import SyncIcon from '@mui/icons-material/Sync';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import ClearIcon from '@mui/icons-material/Clear';
import WifiIcon from '@mui/icons-material/Wifi';
import WifiOffIcon from '@mui/icons-material/WifiOff';

type NotificationState = { open: boolean; message: string; severity: 'success' | 'info' | 'warning' | 'error' };
type ConfirmDialogState = { open: boolean; action: 'clearPending' | 'clearAll' | null; title: string; message: string };

const SyncSettings: React.FC = () => {
  // Mock data and functions for now
  const stats = { pendingSyncCount: 2, totalStored: 12, syncedCount: 9 };
  const isOnline = useOnlineStatus();

  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({ open: false, action: null, title: '', message: '' });
  const [notification, setNotification] = useState<NotificationState>({ open: false, message: '', severity: 'success' });

  const setLoadingState = (action: string, state: boolean) => {
    setIsLoading((prev) => ({ ...prev, [action]: state }));
  };

  const showNotification = (message: string, severity: NotificationState['severity'] = 'success') => {
    setNotification({ open: true, message, severity });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false, action: null, title: '', message: '' });
  };

  const handleConfirmedAction = async () => {
    const { action } = confirmDialog;
    closeConfirmDialog();

    if (action === 'clearPending') {
      setLoadingState('clearPending', true);
      setTimeout(() => {
        setLoadingState('clearPending', false);
        showNotification('Cleared pending sync queue', 'success');
      }, 1000);
    } else if (action === 'clearAll') {
      setLoadingState('clearAll', true);
      setTimeout(() => {
        setLoadingState('clearAll', false);
        showNotification('All data cleared successfully', 'success');
      }, 1500);
    }
  };

  const handleForceSyncNow = async () => {
    setLoadingState('sync', true);
    setTimeout(() => {
      setLoadingState('sync', false);
      showNotification('Sync completed successfully!', 'success');
    }, 2000);
  };

  const handleClearPendingSync = () => {
    setConfirmDialog({
      open: true,
      action: 'clearPending',
      title: 'Clear Pending Sync Queue',
      message: 'This will mark all pending items as synced without actually syncing them. Are you sure?',
    });
  };

  const handleClearAllData = () => {
    setConfirmDialog({
      open: true,
      action: 'clearAll',
      title: 'Clear All Data',
      message: '⚠️ This will permanently delete ALL stored verification data. This action cannot be undone. Are you absolutely sure?',
    });
  };

  const syncActions = [
    {
      id: 'sync',
      title: 'Force Sync Now',
      description: 'Immediately sync all pending data to server',
      icon: <SyncIcon />,
      action: handleForceSyncNow,
  variant: 'outlined' as const,
      color: 'primary' as const,
      disabled: !isOnline || stats.pendingSyncCount === 0,
      tooltip: !isOnline ? 'Cannot sync while offline' : stats.pendingSyncCount === 0 ? 'No items to sync' : '',
    },
    {
      id: 'clearPending',
      title: 'Clear Pending Queue',
      description: 'Mark pending items as synced without syncing',
      icon: <ClearIcon />,
      action: handleClearPendingSync,
      variant: 'outlined' as const,
      color: 'warning' as const,
      disabled: stats.pendingSyncCount === 0,
      tooltip: stats.pendingSyncCount === 0 ? 'No pending items' : '',
    },
  ];

  const dataActions = [
    {
      id: 'clearAll',
      title: 'Clear All Data',
      description: 'Permanently delete all stored data',
      icon: <DeleteIcon />,
      action: handleClearAllData,
      variant: 'outlined' as const,
      color: 'error' as const,
      disabled: stats.totalStored === 0,
      tooltip: stats.totalStored === 0 ? 'No data to clear' : '',
    },
  ];

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header Card */}
      <Card elevation={2} sx={{ mb: 3, borderRadius: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CloudUploadIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Sync Configuration
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                icon={isOnline ? <WifiIcon /> : <WifiOffIcon />}
                label={isOnline ? 'Online' : 'Offline'}
                color={isOnline ? 'success' : 'error'}
                variant="filled"
                size="small"
              />
              <Chip
                label={`${stats.pendingSyncCount} pending`}
                color={stats.pendingSyncCount > 0 ? 'warning' : 'success'}
                variant="outlined"
                size="small"
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Sync Actions */}
      <Card elevation={2} sx={{ mb: 3, borderRadius: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Sync Actions
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Manage data synchronization with the server
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {syncActions.map((action) => (
              <LoadingButton
                key={action.id}
                variant={action.variant}
                color={action.color}
                startIcon={action.icon}
                loading={isLoading[action.id]}
                disabled={action.disabled}
                onClick={action.action}
                sx={{
                  flex: 1,
                  py: 1.5,
                  '&.Mui-disabled': {
                    color: 'text.disabled',
                    borderColor: 'divider',
                    backgroundColor: 'transparent',
                  },
                }}
                title={action.tooltip}
              >
                {action.title}
              </LoadingButton>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card elevation={2} sx={{ mb: 3, borderRadius: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Data Management
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Manage your verification data
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            {dataActions.map((action) => (
              <LoadingButton
                key={action.id}
                variant={action.variant}
                color={action.color}
                startIcon={action.icon}
                loading={isLoading[action.id]}
                disabled={action.disabled}
                onClick={action.action}
                sx={{
                  flex: 1,
                  py: 1.5,
                  '&.Mui-disabled': {
                    color: 'text.disabled',
                    borderColor: 'divider',
                    backgroundColor: 'transparent',
                  },
                }}
                title={action.tooltip}
              >
                {action.title}
              </LoadingButton>
            ))}
          </Stack>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Card elevation={1} sx={{ borderRadius: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom sx={{ mb: 2 }}>
            Sync Statistics
          </Typography>
          <Stack direction="row" justifyContent="space-around" divider={<Divider orientation="vertical" flexItem />}>
            <Box textAlign="center">
              <Typography variant="h6" fontWeight={600} color="primary.main">
                {stats.totalStored}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total Stored
              </Typography>
            </Box>
            <Box textAlign="center">
              <Typography variant="h6" fontWeight={600} color="success.main">
                {stats.syncedCount}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Synced
              </Typography>
            </Box>
            <Box textAlign="center">
              <Typography variant="h6" fontWeight={600} color="warning.main">
                {stats.pendingSyncCount}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Pending
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={closeConfirmDialog}>
        <DialogTitle>{confirmDialog.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>{confirmDialog.message}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeConfirmDialog} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleConfirmedAction} color="error" variant="contained">
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={notification.open}
        autoHideDuration={4000}
        onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setNotification((prev) => ({ ...prev, open: false }))}
          severity={notification.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SyncSettings;
