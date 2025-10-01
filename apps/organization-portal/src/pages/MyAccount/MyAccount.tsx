import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Stack,
  IconButton,
  useTheme,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tooltip,
} from '@mui/material';
import { alpha, styled, useColorScheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Grid from '@mui/material/Grid';
import AppNavbar from '../../components/dash_comp/AppNavbar';
import SideMenu from '../../components/dash_comp/SideMenu';
import Header from '../../components/dash_comp/Header';
import AppTheme from '@inji-offline-verify/shared-ui/src/theme/AppTheme';
import { SidebarProvider } from '../../components/dash_comp/SidebarContext';
import { useCurrentUser } from '../../hooks/useCurrentUser';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { getOrganizationPublicKeys, deletePublicKey } from '../../services/publicKeyService';
import { getOrganizationStatusListCredentials, deleteStatusListCredential, OrganizationStatusListCredential } from '../../services/statusListCredentialService';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ListAltIcon from '@mui/icons-material/ListAlt';

// Styled Components - Theme Aware with consistent styling
const ContentCard = styled(Box)(({ theme }) => ({
  borderRadius: '24px',
  padding: '40px',
  background: 'var(--template-palette-background-paper)',
  border: '1px solid var(--template-palette-divider)',
  boxShadow: 'var(--template-shadows-1)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  
  // Explicit dark mode styling
  '[data-mui-color-scheme="dark"] &': {
    background: '#1a202c',
    backgroundColor: '#1a202c',
    borderColor: 'rgba(45, 55, 72, 0.8)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.8)',
  },
}));

const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  borderRadius: '16px',
  backgroundColor: 'var(--template-palette-background-paper)',
  border: '1px solid var(--template-palette-divider)',
  overflowX: 'auto',
  overflowY: 'hidden',
  
  // Enable horizontal scrolling on all screen sizes
  '&::-webkit-scrollbar': {
    height: '8px',
  },
  '&::-webkit-scrollbar-track': {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: '4px',
  },
  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '4px',
    '&:hover': {
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
  },
  
  '[data-mui-color-scheme="dark"] &': {
    backgroundColor: '#2d3748',
    borderColor: '#4a5568',
    '&::-webkit-scrollbar-track': {
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    '&::-webkit-scrollbar-thumb': {
      backgroundColor: 'rgba(255, 255, 255, 0.3)',
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
      },
    },
  },
}));

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  padding: '12px 16px',
  borderBottom: '1px solid var(--template-palette-divider)',
  color: 'var(--template-palette-text-primary)',
  fontSize: '0.875rem',
  whiteSpace: 'nowrap',
  minWidth: 'fit-content',
  
  // Responsive padding with tighter spacing on smaller screens
  [theme.breakpoints.down('md')]: {
    padding: '8px 8px',
    fontSize: '0.8rem',
  },
  
  [theme.breakpoints.down('sm')]: {
    padding: '6px 4px',
    fontSize: '0.75rem',
  },
  
  [theme.breakpoints.down(480)]: {
    padding: '4px 2px',
    fontSize: '0.7rem',
  },
  
  '[data-mui-color-scheme="dark"] &': {
    borderColor: '#4a5568',
    color: '#ffffff',
  },
  
    '&.MuiTableCell-head': {
      backgroundColor: 'var(--template-palette-grey-50)',
      fontWeight: 600,
      fontSize: '0.8rem',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      color: 'var(--template-palette-text-secondary)',
      position: 'sticky',
      top: 0,
      zIndex: 1,
      
      [theme.breakpoints.down('md')]: {
        fontSize: '0.75rem',
        letterSpacing: '0.3px',
        padding: '8px 8px',
      },
      
      [theme.breakpoints.down('sm')]: {
        fontSize: '0.7rem',
        letterSpacing: '0.2px',
        padding: '6px 4px',
      },
      
      [theme.breakpoints.down(480)]: {
        fontSize: '0.65rem',
        letterSpacing: '0.1px',
        padding: '4px 2px',
      },    '[data-mui-color-scheme="dark"] &': {
      backgroundColor: '#1a202c',
      color: '#a0aec0',
    },
  },
}));

const ActionButton = styled(IconButton)(({ theme }) => ({
  borderRadius: '8px',
  padding: '8px',
  transition: 'all 0.2s ease-in-out',
  
  '&.delete': {
    color: 'var(--template-palette-error-main)',
    '&:hover': {
      backgroundColor: alpha(theme.palette.error.main, 0.1),
      color: 'var(--template-palette-error-dark)',
      transform: 'scale(1.1)',
      '[data-mui-color-scheme="dark"] &': {
        backgroundColor: alpha('#e53e3e', 0.2),
        color: '#fc8181',
      },
    },
  },
}));

interface OrganizationPublicKey {
  id: string;
  key_id: string;
  key_type: string;
  public_key_multibase: string;
  public_key_hex: string | null;
  public_key_jwk: any | null;
  controller: string;
  purpose: string;
  created_at: string;
  expires_at: string | null;
  revoked_at: string | null;
  revocation_reason: string | null;
  is_active: boolean;
}

interface KeyDetailDialogProps {
  publicKey: OrganizationPublicKey | null;
  open: boolean;
  onClose: () => void;
}

function KeyDetailDialog({ publicKey, open, onClose }: KeyDetailDialogProps) {
  if (!publicKey) return null;

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'success' : 'error';
  };

  const getStatusIcon = (isActive: boolean) => {
    return isActive ? <CheckCircleIcon fontSize="small" /> : <ErrorIcon fontSize="small" />;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <Typography variant="h6">Public Key Details</Typography>
          <Chip
            icon={getStatusIcon(publicKey.is_active)}
            label={publicKey.is_active ? 'ACTIVE' : 'INACTIVE'}
            color={getStatusColor(publicKey.is_active) as any}
            size="small"
          />
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Key ID
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {publicKey.key_id}
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Controller
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {publicKey.controller}
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Key Type
            </Typography>
            <Typography variant="body2">
              {publicKey.key_type}
            </Typography>
          </Box>

          {publicKey.public_key_multibase && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Public Key (Multibase)
              </Typography>
              <Paper variant="outlined" sx={{ 
                p: 2, 
                bgcolor: 'grey.50',
                '[data-mui-color-scheme="dark"] &': {
                  bgcolor: 'background.paper',
                }
              }}>
                <Typography variant="body2" sx={{ 
                  fontFamily: 'monospace', 
                  wordBreak: 'break-all',
                  fontSize: '0.875rem'
                }}>
                  {publicKey.public_key_multibase}
                </Typography>
              </Paper>
            </Box>
          )}

          {publicKey.public_key_hex && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Public Key (Hex)
              </Typography>
              <Paper variant="outlined" sx={{ 
                p: 2, 
                bgcolor: 'grey.50',
                '[data-mui-color-scheme="dark"] &': {
                  bgcolor: 'background.paper',
                }
              }}>
                <Typography variant="body2" sx={{ 
                  fontFamily: 'monospace', 
                  wordBreak: 'break-all',
                  fontSize: '0.875rem'
                }}>
                  {publicKey.public_key_hex}
                </Typography>
              </Paper>
            </Box>
          )}

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Created At
            </Typography>
            <Typography variant="body2">
              {formatDate(publicKey.created_at)}
            </Typography>
          </Box>

          {publicKey.expires_at && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Expires At
              </Typography>
              <Typography variant="body2">
                {formatDate(publicKey.expires_at)}
              </Typography>
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

interface StatusListDetailDialogProps {
  statusList: OrganizationStatusListCredential | null;
  open: boolean;
  onClose: () => void;
}

function StatusListDetailDialog({ statusList, open, onClose }: StatusListDetailDialogProps) {
  if (!statusList) return null;

  const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  };

  const formatCredential = (credential: any) => {
    try {
      return JSON.stringify(credential, null, 2);
    } catch {
      return String(credential);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={2}>
          <ListAltIcon color="primary" />
          <Typography variant="h6">Status List Credential</Typography>
          <Chip
            label={`Version ${statusList.version}`}
            color="primary"
            size="small"
          />
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Status List ID
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {statusList.status_list_id}
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Issuer
            </Typography>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
              {statusList.issuer}
            </Typography>
          </Box>

          {statusList.purposes?.length ? (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Purposes
              </Typography>
              <Stack direction="row" flexWrap="wrap" gap={1}>
                {statusList.purposes.map((purpose) => (
                  <Chip key={purpose} label={purpose} size="small" color="secondary" />
                ))}
              </Stack>
            </Box>
          ) : null}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Issuance Date
              </Typography>
              <Typography variant="body2">{formatDateTime(statusList.issuance_date)}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Last Updated
              </Typography>
              <Typography variant="body2">{formatDateTime(statusList.updated_at)}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Created At
              </Typography>
              <Typography variant="body2">{formatDateTime(statusList.created_at)}</Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Encoded List Hash
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {statusList.encoded_list_hash}
              </Typography>
            </Grid>
          </Grid>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Full Credential
            </Typography>
            <Box
              sx={{
                backgroundColor: 'var(--template-palette-grey-100)',
                p: 2,
                borderRadius: '8px',
                maxHeight: '320px',
                overflow: 'auto',
                '[data-mui-color-scheme="dark"] &': {
                  backgroundColor: '#2d3748',
                },
              }}
            >
              <Typography
                variant="body2"
                component="pre"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {formatCredential(statusList.full_credential)}
              </Typography>
            </Box>
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function MyAccount() {
  const theme = useTheme();
  const { mode } = useColorScheme();
  const isDark = mode === 'dark';
  const { organizationName } = useCurrentUser();
  
  const [publicKeys, setPublicKeys] = useState<OrganizationPublicKey[]>([]);
  const [statusListCredentials, setStatusListCredentials] = useState<OrganizationStatusListCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingStatusLists, setLoadingStatusLists] = useState(true);
  const [selectedKey, setSelectedKey] = useState<OrganizationPublicKey | null>(null);
  const [selectedStatusList, setSelectedStatusList] = useState<OrganizationStatusListCredential | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [statusListDetailDialogOpen, setStatusListDetailDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState({
    open: false,
    publicKey: null as OrganizationPublicKey | null,
  });
  const [deleteStatusListDialog, setDeleteStatusListDialog] = useState({
    open: false,
    statusList: null as OrganizationStatusListCredential | null,
  });
  const [toast, setToast] = useState({
    open: false,
    message: '',
    severity: 'success' as 'success' | 'error',
  });

  const showToast = (message: string, severity: 'success' | 'error') => {
    setToast({ open: true, message, severity });
  };

  const handleToastClose = () => {
    setToast(prev => ({ ...prev, open: false }));
  };

  const fetchPublicKeys = async () => {
    try {
      setLoading(true);
      const response = await getOrganizationPublicKeys();
      setPublicKeys(response.keys || []);
    } catch (error: any) {
      console.error('Failed to fetch public keys:', error);
      showToast('Failed to load public keys. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getOrganizationId = () => {
    try {
      const orgId = localStorage.getItem('organizationId');
      if (orgId) return orgId;
    } catch {/* ignore */}

    try {
      const raw = localStorage.getItem('organization');
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj?.id) return obj.id;
      }
    } catch {/* ignore */}

    return null;
  };

  const fetchStatusListCredentials = async () => {
    try {
      setLoadingStatusLists(true);
      const organizationId = getOrganizationId();
      const response = await getOrganizationStatusListCredentials(organizationId || undefined);
      setStatusListCredentials(response.status_list_credentials || []);
    } catch (error: any) {
      console.error('Failed to fetch status list credentials:', error);
      showToast('Failed to load status list credentials. Please try again.', 'error');
    } finally {
      setLoadingStatusLists(false);
    }
  };

  useEffect(() => {
    fetchPublicKeys();
    fetchStatusListCredentials();
  }, []);

  const handleDeleteClick = (publicKey: OrganizationPublicKey) => {
    setDeleteDialog({ open: true, publicKey });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteDialog.publicKey) return;
    
    try {
      await deletePublicKey(deleteDialog.publicKey.key_id);
      setPublicKeys(prev => prev.filter(pk => pk.key_id !== deleteDialog.publicKey!.key_id));
      showToast('Public key deleted successfully', 'success');
    } catch (error: any) {
      console.error('Failed to delete public key:', error);
      showToast('Failed to delete public key. Please try again.', 'error');
    } finally {
      setDeleteDialog({ open: false, publicKey: null });
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ open: false, publicKey: null });
  };

  const handleViewKey = (publicKey: OrganizationPublicKey) => {
    setSelectedKey(publicKey);
    setDetailDialogOpen(true);
  };

  const handleCloseDetail = () => {
    setDetailDialogOpen(false);
    setSelectedKey(null);
  };

  // Status list handlers
  const handleDeleteStatusListClick = (statusList: OrganizationStatusListCredential) => {
    setDeleteStatusListDialog({ open: true, statusList });
  };

  const handleDeleteStatusListConfirm = async () => {
    if (!deleteStatusListDialog.statusList) return;

    try {
      await deleteStatusListCredential(deleteStatusListDialog.statusList.status_list_id);
      setStatusListCredentials((prev) => prev.filter((item) => item.status_list_id !== deleteStatusListDialog.statusList!.status_list_id));
      showToast('Status list credential removed successfully', 'success');
    } catch (error: any) {
      console.error('Failed to delete status list credential:', error);
      showToast('Failed to remove status list credential. Please try again.', 'error');
    } finally {
      setDeleteStatusListDialog({ open: false, statusList: null });
    }
  };

  const handleDeleteStatusListCancel = () => {
    setDeleteStatusListDialog({ open: false, statusList: null });
  };

  const handleViewStatusList = (statusList: OrganizationStatusListCredential) => {
    setSelectedStatusList(statusList);
    setStatusListDetailDialogOpen(true);
  };

  const handleCloseStatusListDetail = () => {
    setStatusListDetailDialogOpen(false);
    setSelectedStatusList(null);
  };

  const getStatusIcon = (isActive: boolean) => {
    return isActive ? 
      <CheckCircleIcon sx={{ color: 'success.main' }} /> : 
      <ErrorIcon sx={{ color: 'error.main' }} />;
  };

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'success' : 'error';
  };

  const getStatusLabel = (isActive: boolean) => {
    return isActive ? 'ACTIVE' : 'INACTIVE';
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString) {
      return '—';
    }

    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const truncateKey = (key: string, maxLength: number = 50) => {
    if (key.length <= maxLength) return key;
    return `${key.substring(0, maxLength)}...`;
  };

  const statusListStats = useMemo(() => {
    const total = statusListCredentials.length;
    const purposes = new Set<string>();
    let latestUpdatedAt: string | null = null;

    statusListCredentials.forEach((item) => {
      (item.purposes || []).forEach((purpose) => {
        if (purpose) purposes.add(purpose);
      });

      if (item.updated_at) {
        if (!latestUpdatedAt || new Date(item.updated_at).getTime() > new Date(latestUpdatedAt).getTime()) {
          latestUpdatedAt = item.updated_at;
        }
      }
    });

    return {
      total,
      purposeCount: purposes.size,
      latestUpdatedAt,
    };
  }, [statusListCredentials]);

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
                alignItems: 'center',
                mx: 3,
                pb: 5,
                mt: { xs: 8, md: 0 },
              }}
            >
              <Header />
              
              {/* Page Content */}
              <Box sx={{ width: '100%', maxWidth: 1200 }}>
                <Stack spacing={4}>
                  {/* Page Header */}
                  <Box sx={{ textAlign: 'center', py: 2 }}>
                    <Box sx={{ mb: 2 }}>
                      <AccountCircleIcon sx={{ 
                        fontSize: 64, 
                        color: isDark ? '#4299e1' : 'primary.main', 
                        mb: 2 
                      }} />
                      <Typography variant="h3" sx={{ 
                        fontWeight: 800, 
                        color: isDark ? '#ffffff' : 'text.primary', 
                        mb: 1 
                      }}>
                        My Account
                      </Typography>
                      <Typography variant="h6" sx={{ 
                        color: isDark ? '#a0aec0' : 'text.secondary', 
                        fontWeight: 400 
                      }}>
                        Manage your organization's public keys and status list credentials
                      </Typography>
                    </Box>
                  </Box>

                  {/* Organization Info */}
                  <ContentCard>
                    <Typography variant="h5" sx={{ 
                      fontWeight: 600, 
                      mb: 2, 
                      color: isDark ? '#ffffff' : 'text.primary' 
                    }}>
                      Organization Information
                    </Typography>
                    <Grid container spacing={3}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="body2" sx={{ 
                          color: isDark ? '#a0aec0' : 'text.secondary',
                          mb: 1 
                        }}>
                          Organization Name
                        </Typography>
                        <Typography variant="h6" sx={{ 
                          fontWeight: 600, 
                          color: isDark ? '#ffffff' : 'text.primary' 
                        }}>
                          {organizationName || 'Loading...'}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="body2" sx={{ 
                          color: isDark ? '#a0aec0' : 'text.secondary',
                          mb: 1 
                        }}>
                          Total Public Keys
                        </Typography>
                        <Typography variant="h6" sx={{ 
                          fontWeight: 600, 
                          color: isDark ? '#ffffff' : 'text.primary' 
                        }}>
                          {publicKeys.length}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="body2" sx={{ 
                          color: isDark ? '#a0aec0' : 'text.secondary',
                          mb: 1 
                        }}>
                          Active Keys
                        </Typography>
                        <Typography variant="h6" sx={{ 
                          fontWeight: 600, 
                          color: 'success.main' 
                        }}>
                          {publicKeys.filter(key => key.is_active).length}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="body2" sx={{ 
                          color: isDark ? '#a0aec0' : 'text.secondary',
                          mb: 1 
                        }}>
                          Inactive Keys
                        </Typography>
                        <Typography variant="h6" sx={{ 
                          fontWeight: 600, 
                          color: 'error.main' 
                        }}>
                          {publicKeys.filter(key => !key.is_active).length}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="body2" sx={{ 
                          color: isDark ? '#a0aec0' : 'text.secondary',
                          mb: 1 
                        }}>
                          Status List Credentials
                        </Typography>
                        <Typography variant="h6" sx={{ 
                          fontWeight: 600, 
                          color: 'warning.main' 
                        }}>
                          {statusListStats.total}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="body2" sx={{ 
                          color: isDark ? '#a0aec0' : 'text.secondary',
                          mb: 1 
                        }}>
                          Unique Purposes
                        </Typography>
                        <Typography variant="h6" sx={{ 
                          fontWeight: 600, 
                          color: 'secondary.main' 
                        }}>
                          {statusListStats.purposeCount}
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography variant="body2" sx={{ 
                          color: isDark ? '#a0aec0' : 'text.secondary',
                          mb: 1 
                        }}>
                          Latest Status List Update
                        </Typography>
                        <Typography variant="h6" sx={{ 
                          fontWeight: 600, 
                          color: isDark ? '#ffffff' : 'text.primary' 
                        }}>
                          {formatDate(statusListStats.latestUpdatedAt)}
                        </Typography>
                      </Grid>
                    </Grid>
                  </ContentCard>

                  {/* Public Keys Table */}
                  <ContentCard>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                      <Typography variant="h5" sx={{ 
                        fontWeight: 600, 
                        color: isDark ? '#ffffff' : 'text.primary' 
                      }}>
                        Organization Public Keys
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={fetchPublicKeys}
                        disabled={loading}
                        sx={{
                          borderRadius: '12px',
                          px: 3,
                          py: 1,
                          textTransform: 'none',
                          fontWeight: 600,
                          border: `2px solid ${isDark ? '#4a5568' : theme.palette.divider}`,
                          color: isDark ? '#a0aec0' : 'text.secondary',
                          '&:hover': {
                            border: `2px solid ${isDark ? '#4299e1' : theme.palette.primary.main}`,
                            color: isDark ? '#4299e1' : 'primary.main',
                            backgroundColor: alpha(isDark ? '#4299e1' : theme.palette.primary.main, 0.1),
                          },
                        }}
                      >
                        Refresh
                      </Button>
                    </Stack>

                    {loading ? (
                      <Box sx={{ 
                        textAlign: 'center', 
                        py: 8,
                        color: isDark ? '#a0aec0' : 'text.secondary' 
                      }}>
                        <Typography variant="h6">Loading public keys...</Typography>
                      </Box>
                    ) : publicKeys.length === 0 ? (
                      <Box sx={{ 
                        textAlign: 'center', 
                        py: 8,
                        color: isDark ? '#a0aec0' : 'text.secondary' 
                      }}>
                        <Typography variant="h6" sx={{ mb: 1 }}>No public keys found</Typography>
                        <Typography variant="body2">
                          You haven't added any public keys yet.
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ width: '100%', overflowX: 'auto' }}>
                        <StyledTableContainer>
                          <Table sx={{ 
                            minWidth: { xs: 600, sm: 700, md: 800 }
                          }}>
                          <TableHead>
                            <TableRow>
                              <StyledTableCell sx={{ 
                                minWidth: { xs: 120, sm: 150, md: 200 }
                              }}>Key ID</StyledTableCell>
                              <StyledTableCell sx={{ 
                                minWidth: { xs: 100, sm: 130, md: 180 }
                              }}>Public Key</StyledTableCell>
                              <StyledTableCell sx={{ 
                                minWidth: { xs: 80, sm: 100, md: 120 }
                              }}>Key Type</StyledTableCell>
                              <StyledTableCell sx={{ 
                                minWidth: { xs: 70, sm: 80, md: 100 }
                              }}>Status</StyledTableCell>
                              <StyledTableCell sx={{ 
                                minWidth: { xs: 90, sm: 100, md: 120 }
                              }}>Created</StyledTableCell>
                              <StyledTableCell align="center" sx={{ 
                                minWidth: { xs: 70, sm: 80, md: 100 }
                              }}>Actions</StyledTableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {publicKeys.map((publicKey) => (
                              <TableRow 
                                key={publicKey.id}
                                onClick={() => handleViewKey(publicKey)}
                                sx={{
                                  cursor: 'pointer',
                                  '&:hover': {
                                    backgroundColor: isDark ? 'rgba(45, 55, 72, 0.5)' : 'rgba(0, 0, 0, 0.04)',
                                  },
                                }}
                              >
                                <StyledTableCell>
                                  <Box sx={{ 
                                    fontFamily: 'monospace', 
                                    fontSize: { xs: '0.7rem', sm: '0.75rem', md: '0.85rem' },
                                    color: isDark ? '#90cdf4' : 'primary.main',
                                    fontWeight: 600,
                                    maxWidth: { xs: '120px', sm: '150px', md: '200px' },
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {truncateKey(publicKey.key_id, window.innerWidth < 600 ? 15 : window.innerWidth < 900 ? 20 : 30)}
                                  </Box>
                                </StyledTableCell>
                                <StyledTableCell>
                                  <Box sx={{ 
                                    fontFamily: 'monospace', 
                                    fontSize: { xs: '0.65rem', sm: '0.7rem', md: '0.75rem' },
                                    color: isDark ? '#a0aec0' : 'text.secondary',
                                    maxWidth: { xs: '100px', sm: '130px', md: '180px' },
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {truncateKey(publicKey.public_key_multibase || publicKey.public_key_hex || 'N/A', window.innerWidth < 600 ? 12 : window.innerWidth < 900 ? 18 : 25)}
                                  </Box>
                                </StyledTableCell>
                                <StyledTableCell>
                                  <Chip
                                    label={publicKey.key_type}
                                    variant="outlined"
                                    size="small"
                                    color="primary"
                                    sx={{
                                      fontSize: { xs: '0.6rem', sm: '0.65rem', md: '0.7rem' },
                                      height: { xs: '18px', sm: '20px', md: '24px' },
                                      '& .MuiChip-label': {
                                        px: { xs: 0.25, sm: 0.5, md: 1 }
                                      }
                                    }}
                                  />
                                </StyledTableCell>
                                <StyledTableCell>
                                  <Chip
                                    icon={getStatusIcon(publicKey.is_active)}
                                    label={getStatusLabel(publicKey.is_active)}
                                    color={getStatusColor(publicKey.is_active) as any}
                                    variant="outlined"
                                    size="small"
                                    sx={{ 
                                      fontWeight: 600,
                                      fontSize: { xs: '0.6rem', sm: '0.65rem', md: '0.7rem' },
                                      height: { xs: '18px', sm: '20px', md: '24px' },
                                      '& .MuiChip-label': {
                                        px: { xs: 0.25, sm: 0.5, md: 1 }
                                      },
                                      '& .MuiChip-icon': {
                                        fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.9rem' }
                                      }
                                    }}
                                  />
                                </StyledTableCell>
                                <StyledTableCell>
                                  <Typography 
                                    variant="body2" 
                                    sx={{ 
                                      fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.875rem' },
                                      whiteSpace: 'nowrap'
                                    }}
                                  >
                                    {formatDate(publicKey.created_at)}
                                  </Typography>
                                </StyledTableCell>
                                <StyledTableCell align="center">
                                  <Stack direction="row" spacing={{ xs: 0.25, sm: 0.5, md: 1 }} justifyContent="center">
                                    <Tooltip title="View Details" placement="top">
                                      <IconButton
                                        size="small"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleViewKey(publicKey);
                                        }}
                                        sx={{
                                          color: isDark ? '#4299e1' : 'primary.main',
                                          p: { xs: 0.25, sm: 0.5, md: 1 },
                                          minWidth: 'auto',
                                          '&:hover': {
                                            backgroundColor: alpha(isDark ? '#4299e1' : theme.palette.primary.main, 0.1),
                                          },
                                        }}
                                      >
                                        <VisibilityIcon sx={{ fontSize: { xs: '14px', sm: '16px', md: '18px' } }} />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete Public Key" placement="top">
                                      <ActionButton
                                        className="delete"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteClick(publicKey);
                                        }}
                                        size="small"
                                        sx={{
                                          p: { xs: 0.25, sm: 0.5, md: 1 },
                                          minWidth: 'auto',
                                        }}
                                      >
                                        <DeleteIcon sx={{ fontSize: { xs: '14px', sm: '16px', md: '18px' } }} />
                                      </ActionButton>
                                    </Tooltip>
                                  </Stack>
                                </StyledTableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </StyledTableContainer>
                      </Box>
                    )}
                  </ContentCard>

                  {/* Status List Credentials Section */}
                  <ContentCard>
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                      sx={{ mb: 3 }}
                    >
                      <Stack direction="row" alignItems="center" spacing={2}>
                        <ListAltIcon sx={{ color: 'primary.main', fontSize: 28 }} />
                        <Typography variant="h5" sx={{ 
                          fontWeight: 600, 
                          color: isDark ? '#ffffff' : 'text.primary' 
                        }}>
                          Status List Credentials
                        </Typography>
                      </Stack>
                      <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={fetchStatusListCredentials}
                        disabled={loadingStatusLists}
                        sx={{
                          borderRadius: '12px',
                          textTransform: 'none',
                          fontWeight: 600,
                        }}
                      >
                        Refresh
                      </Button>
                    </Stack>

                    {loadingStatusLists ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                        <Typography variant="h6">Loading status list credentials...</Typography>
                      </Box>
                    ) : statusListCredentials.length === 0 ? (
                      <Box
                        sx={{
                          textAlign: 'center',
                          py: 8,
                          color: 'text.secondary',
                        }}
                      >
                        <ListAltIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5 }} />
                        <Typography variant="h6" gutterBottom>
                          No Status List Credentials Found
                        </Typography>
                        <Typography variant="body2">
                          Upload or synchronize a status list credential to see it here.
                        </Typography>
                      </Box>
                    ) : (
                      <Box sx={{ width: '100%' }}>
                        <StyledTableContainer>
                          <Table stickyHeader>
                            <TableHead>
                              <TableRow>
                                <StyledTableCell>Status List ID</StyledTableCell>
                                <StyledTableCell>Issuer</StyledTableCell>
                                <StyledTableCell>Purposes</StyledTableCell>
                                <StyledTableCell>Version</StyledTableCell>
                                <StyledTableCell>Issued</StyledTableCell>
                                <StyledTableCell>Updated</StyledTableCell>
                                <StyledTableCell>Encoded Hash</StyledTableCell>
                                <StyledTableCell align="center">Actions</StyledTableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {statusListCredentials.map((statusList) => (
                                <TableRow key={statusList.id} hover>
                                  <StyledTableCell>
                                    <Tooltip title={statusList.status_list_id} arrow>
                                      <Typography
                                        sx={{
                                          fontFamily: 'monospace',
                                          fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.8rem' },
                                          maxWidth: { xs: 120, sm: 180, md: 220 },
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                        }}
                                      >
                                        {truncateKey(statusList.status_list_id)}
                                      </Typography>
                                    </Tooltip>
                                  </StyledTableCell>
                                  <StyledTableCell>
                                    <Tooltip title={statusList.issuer} arrow>
                                      <Typography
                                        sx={{
                                          fontFamily: 'monospace',
                                          fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.8rem' },
                                          maxWidth: { xs: 120, sm: 180, md: 220 },
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                        }}
                                      >
                                        {truncateKey(statusList.issuer)}
                                      </Typography>
                                    </Tooltip>
                                  </StyledTableCell>
                                  <StyledTableCell>
                                    {statusList.purposes?.length ? (
                                      <Stack direction="row" spacing={0.5} flexWrap="wrap" rowGap={0.5}>
                                        {statusList.purposes.map((purpose) => (
                                          <Chip
                                            key={`${statusList.status_list_id}-${purpose}`}
                                            label={purpose}
                                            size="small"
                                            color="secondary"
                                            sx={{
                                              fontSize: { xs: '0.6rem', sm: '0.65rem', md: '0.7rem' },
                                              height: { xs: '18px', sm: '20px', md: '22px' },
                                              '& .MuiChip-label': {
                                                px: { xs: 0.5, sm: 0.75, md: 1 },
                                              },
                                            }}
                                          />
                                        ))}
                                      </Stack>
                                    ) : (
                                      <Typography color="text.secondary">—</Typography>
                                    )}
                                  </StyledTableCell>
                                  <StyledTableCell>
                                    <Chip
                                      label={`v${statusList.version}`}
                                      size="small"
                                      color="primary"
                                      sx={{
                                        fontWeight: 600,
                                        fontSize: { xs: '0.6rem', sm: '0.65rem', md: '0.7rem' },
                                        height: { xs: '18px', sm: '20px', md: '22px' },
                                      }}
                                    />
                                  </StyledTableCell>
                                  <StyledTableCell>
                                    <Typography
                                      sx={{
                                        fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.875rem' },
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {formatDate(statusList.issuance_date)}
                                    </Typography>
                                  </StyledTableCell>
                                  <StyledTableCell>
                                    <Typography
                                      sx={{
                                        fontSize: { xs: '0.65rem', sm: '0.75rem', md: '0.875rem' },
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      {formatDate(statusList.updated_at)}
                                    </Typography>
                                  </StyledTableCell>
                                  <StyledTableCell>
                                    <Tooltip title={statusList.encoded_list_hash} arrow>
                                      <Typography
                                        sx={{
                                          fontFamily: 'monospace',
                                          fontSize: { xs: '0.6rem', sm: '0.7rem', md: '0.75rem' },
                                          maxWidth: { xs: 120, sm: 180, md: 220 },
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                        }}
                                      >
                                        {truncateKey(statusList.encoded_list_hash, window.innerWidth < 600 ? 16 : 28)}
                                      </Typography>
                                    </Tooltip>
                                  </StyledTableCell>
                                  <StyledTableCell align="center">
                                    <Stack direction="row" spacing={{ xs: 0.25, sm: 0.5, md: 1 }} justifyContent="center">
                                      <Tooltip title="View Details" placement="top">
                                        <IconButton
                                          size="small"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleViewStatusList(statusList);
                                          }}
                                          sx={{
                                            color: isDark ? '#4299e1' : 'primary.main',
                                            '&:hover': {
                                              backgroundColor: isDark ? 'rgba(66, 153, 225, 0.1)' : 'rgba(25, 118, 210, 0.04)',
                                              transform: 'scale(1.1)',
                                            },
                                            transition: 'all 0.2s ease-in-out',
                                            p: { xs: '4px', sm: '6px', md: '8px' },
                                          }}
                                        >
                                          <VisibilityIcon sx={{ fontSize: { xs: '14px', sm: '16px', md: '18px' } }} />
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Remove" placement="top">
                                        <ActionButton
                                          className="delete"
                                          size="small"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteStatusListClick(statusList);
                                          }}
                                          sx={{
                                            p: { xs: '4px', sm: '6px', md: '8px' },
                                          }}
                                        >
                                          <DeleteIcon sx={{ fontSize: { xs: '14px', sm: '16px', md: '18px' } }} />
                                        </ActionButton>
                                      </Tooltip>
                                    </Stack>
                                  </StyledTableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </StyledTableContainer>
                      </Box>
                    )}
                  </ContentCard>
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Box>

        {/* Key Detail Dialog */}
        <KeyDetailDialog
          publicKey={selectedKey}
          open={detailDialogOpen}
          onClose={handleCloseDetail}
        />

        {/* Status List Detail Dialog */}
        <StatusListDetailDialog
          statusList={selectedStatusList}
          open={statusListDetailDialogOpen}
          onClose={handleCloseStatusListDetail}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog
          open={deleteDialog.open}
          onClose={handleDeleteCancel}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '16px',
              bgcolor: isDark ? '#1a202c' : 'background.paper',
              color: isDark ? '#ffffff' : 'text.primary',
            }
          }}
        >
          <DialogTitle sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            color: 'error.main',
            fontWeight: 600
          }}>
            <WarningIcon />
            Confirm Delete
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Are you sure you want to delete this public key?
            </Typography>
            {deleteDialog.publicKey && (
              <Box sx={{ 
                p: 2, 
                bgcolor: isDark ? '#2d3748' : 'grey.100', 
                borderRadius: '8px',
                mb: 2
              }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Key ID:
                </Typography>
                <Typography sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  color: isDark ? '#90cdf4' : 'primary.main',
                  fontWeight: 600,
                  mb: 2,
                  wordBreak: 'break-all'
                }}>
                  {deleteDialog.publicKey.key_id}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Key Type: {deleteDialog.publicKey.key_type}
                </Typography>
              </Box>
            )}
            <Typography variant="body2" sx={{ 
              mt: 2, 
              color: 'error.main',
              fontWeight: 500 
            }}>
              This action cannot be undone.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 3, gap: 2 }}>
            <Button
              onClick={handleDeleteCancel}
              variant="outlined"
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                border: `2px solid ${isDark ? '#4a5568' : theme.palette.divider}`,
                color: isDark ? '#a0aec0' : 'text.secondary',
                '&:hover': {
                  border: `2px solid ${isDark ? '#4299e1' : theme.palette.primary.main}`,
                  color: isDark ? '#4299e1' : 'primary.main',
                },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteConfirm}
              variant="contained"
              color="error"
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': {
                  backgroundColor: 'error.dark',
                },
              }}
            >
              Delete Public Key
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Status List Confirmation Dialog */}
        <Dialog
          open={deleteStatusListDialog.open}
          onClose={handleDeleteStatusListCancel}
          maxWidth="sm"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: '16px',
              bgcolor: isDark ? '#1a202c' : 'background.paper',
              color: isDark ? '#ffffff' : 'text.primary',
            }
          }}
        >
          <DialogTitle sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1,
            color: 'error.main',
            fontWeight: 600
          }}>
            <WarningIcon />
            Remove Status List Credential
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" sx={{ mb: 2 }}>
              Are you sure you want to delete this status list credential from your organization?
            </Typography>
            {deleteStatusListDialog.statusList && (
              <Box sx={{ 
                p: 2, 
                bgcolor: isDark ? '#2d3748' : 'grey.100', 
                borderRadius: '8px',
                mb: 2
              }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Status List ID:
                </Typography>
                <Typography sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  color: isDark ? '#63b3ed' : 'primary.main',
                  fontWeight: 600,
                  mb: 2,
                  wordBreak: 'break-all'
                }}>
                  {deleteStatusListDialog.statusList.status_list_id}
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Purposes: {deleteStatusListDialog.statusList.purposes?.join(', ') || '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Current Version: {deleteStatusListDialog.statusList.version}
                </Typography>
              </Box>
            )}
            <Typography variant="body2" color="warning.main" sx={{ fontStyle: 'italic' }}>
              This doesn't revoke any credential; it only removes the cached status list from your organization portal.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ p: 3, gap: 2 }}>
            <Button
              onClick={handleDeleteStatusListCancel}
              variant="outlined"
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                border: `2px solid ${isDark ? '#4a5568' : theme.palette.divider}`,
                color: isDark ? '#a0aec0' : 'text.secondary',
                '&:hover': {
                  border: `2px solid ${isDark ? '#4299e1' : theme.palette.primary.main}`,
                  color: isDark ? '#4299e1' : 'primary.main',
                },
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteStatusListConfirm}
              variant="contained"
              color="error"
              sx={{
                borderRadius: '8px',
                textTransform: 'none',
                fontWeight: 600,
                '&:hover': {
                  backgroundColor: 'error.dark',
                },
              }}
            >
              Delete Status List
            </Button>
          </DialogActions>
        </Dialog>

        {/* Toast Notifications */}
        <Snackbar
          open={toast.open}
          autoHideDuration={6000}
          onClose={handleToastClose}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Alert
            onClose={handleToastClose}
            severity={toast.severity}
            variant="filled"
            sx={{
              width: '100%',
              borderRadius: '12px',
              fontWeight: 600,
              fontSize: '1rem',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)',
            }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      </SidebarProvider>
    </AppTheme>
  );
}