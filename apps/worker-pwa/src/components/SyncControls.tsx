import { useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { LoadingButton } from '@mui/lab';
import Stack from '@mui/material/Stack';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import DownloadIcon from '@mui/icons-material/Download';

type NotificationState = { open: boolean; message: string; severity: 'success' | 'info' | 'warning' | 'error' };

const SyncControls: React.FC = () => {
  // Mock data and functions for now
  const stats = { totalStored: 12 };

  const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});
  const [notification, setNotification] = useState<NotificationState>({ open: false, message: '', severity: 'success' });

  const setLoadingState = (action: string, state: boolean) => {
    setIsLoading((prev) => ({ ...prev, [action]: state }));
  };

  const showNotification = (message: string, severity: NotificationState['severity'] = 'success') => {
    setNotification({ open: true, message, severity });
  };

  const handleExportData = async () => {
    setLoadingState('export', true);
    setTimeout(() => {
      setLoadingState('export', false);
      showNotification('Data exported successfully!', 'success');
    }, 1000);
  };

  return (
    <Box sx={{ width: '100%' }}>
      {/* Data Export */}
      <Card elevation={2} sx={{ borderRadius: 3, bgcolor: 'background.paper' }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            Data Export
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Download all your verification data
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <LoadingButton
              variant="outlined"
              color="secondary"
              startIcon={<DownloadIcon />}
              loading={isLoading['export']}
              disabled={stats.totalStored === 0}
              onClick={handleExportData}
              sx={{ flex: 1, py: 1.5 }}
              title={stats.totalStored === 0 ? 'No data to export' : ''}
            >
              Export All Data
            </LoadingButton>
          </Stack>
        </CardContent>
      </Card>

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

export default SyncControls;
