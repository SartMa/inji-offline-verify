import { useState, useEffect } from 'react';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import WifiIcon from '@mui/icons-material/Wifi';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export default function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  const [showOnlineAlert, setShowOnlineAlert] = useState(false);
  const [hasBeenOffline, setHasBeenOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setHasBeenOffline(true);
    } else {
      // Only show "back online" if we were previously offline
      if (hasBeenOffline) {
        setShowOnlineAlert(true);
        setTimeout(() => setShowOnlineAlert(false), 3000);
        setHasBeenOffline(false); // Reset so we don't show it again unless they go offline again
      }
    }
  }, [isOnline, hasBeenOffline]);

  return (
    <>
      {/* Temporary back online indicator */}
      <Snackbar
        open={showOnlineAlert}
        autoHideDuration={3000}
        onClose={() => setShowOnlineAlert(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: 8 }}
      >
        <Alert 
          severity="success" 
          icon={<WifiIcon />}
          sx={{ width: '100%' }}
        >
          You're back online! Data will sync automatically.
        </Alert>
      </Snackbar>
    </>
  );
}
