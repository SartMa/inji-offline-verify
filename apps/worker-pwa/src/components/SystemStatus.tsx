import {
  Box,
  Typography,
  Chip,
  Card,
  CardContent,
  useTheme,
  alpha,
} from '@mui/material';
import {
  CheckCircle,
  Warning,
  Error,
  Wifi,
  WifiOff,
  Sync,
  SyncDisabled,
  Schedule,
} from '@mui/icons-material';
import { useVCStorage } from '../context/VCStorageContext';

interface SystemStatusProps {
  compact?: boolean; // Optional for backward compatibility, not used in current implementation
}

const SystemStatus: React.FC<SystemStatusProps> = () => {
  const { isOnline, serviceWorkerActive, stats } = useVCStorage();
  const theme = useTheme();

  // Calculate overall health status
  const getOverallStatus = () => {
    if (isOnline && serviceWorkerActive && stats.pendingSyncCount === 0) {
      return { label: 'Excellent', color: 'success', icon: CheckCircle };
    } else if (isOnline && serviceWorkerActive) {
      return { label: 'Good', color: 'warning', icon: Warning };
    } else {
      return { label: 'Needs Attention', color: 'error', icon: Error };
    }
  };

  const overallStatus = getOverallStatus();

  const statusItems = [
    {
      label: 'Connection',
      value: isOnline ? 'Online' : 'Offline',
      status: isOnline ? 'success' : 'error',
      icon: isOnline ? Wifi : WifiOff,
      description: isOnline ? 'Connected to internet' : 'No internet connection',
    },
    {
      label: 'Service Worker',
      value: serviceWorkerActive ? 'Active' : 'Inactive',
      status: serviceWorkerActive ? 'success' : 'error',
      icon: serviceWorkerActive ? Sync : SyncDisabled,
      description: serviceWorkerActive ? 'Background sync enabled' : 'Background sync disabled',
    },
    {
      label: 'Pending Sync',
      value: `${stats.pendingSyncCount} Items`,
      status: stats.pendingSyncCount > 0 ? 'warning' : 'success',
      icon: stats.pendingSyncCount > 0 ? Schedule : CheckCircle,
      description:
        stats.pendingSyncCount > 0 
          ? `${stats.pendingSyncCount} items waiting to sync` 
          : 'All items synced',
    },
  ];

  return (
    <Card
      elevation={0}
      sx={{
        width: '100%',
        backgroundColor: 'transparent',
        border: 'none',
        borderRadius: 2,
      }}
    >
      <CardContent sx={{ p: 0 }}>
        {/* Header with Overall Status */}
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          mb: 3
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h6" fontWeight={600} color="text.primary">
              System Status
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Last updated: {new Date().toLocaleTimeString()}
            </Typography>
          </Box>
          <Chip
            label={overallStatus.label}
            color={overallStatus.color as any}
            variant="filled"
            sx={{ 
              fontWeight: 600,
              fontSize: '0.875rem',
              px: 1,
            }}
          />
        </Box>

        {/* Status Items in Horizontal Layout */}
        <Box sx={{ 
          display: 'flex', 
          gap: 2,
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          [theme.breakpoints.down('md')]: {
            flexDirection: 'column',
            gap: 1.5,
          }
        }}>
          {statusItems.map((item) => {
            const ItemIcon = item.icon;
            return (
              <Box
                key={item.label}
                sx={{
                  flex: '1 1 200px',
                  minWidth: 200,
                  p: 2.5,
                  borderRadius: 2,
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                  transition: 'all 0.2s ease-in-out',
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
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  mb: 1
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ItemIcon
                      color={item.status as any}
                      sx={{ fontSize: 20 }}
                    />
                    <Typography variant="body2" fontWeight={600} color="text.primary">
                      {item.label}
                    </Typography>
                  </Box>
                  <Chip
                    label={item.value}
                    color={item.status as any}
                    size="small"
                    variant="outlined"
                    sx={{ 
                      fontWeight: 500,
                      fontSize: '0.75rem',
                    }}
                  />
                </Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ 
                    display: 'block',
                    lineHeight: 1.3,
                  }}
                >
                  {item.description}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </CardContent>
    </Card>
  );
};

export default SystemStatus;