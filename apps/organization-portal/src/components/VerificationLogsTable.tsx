import React, { useState, useCallback } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Chip,
  Typography,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Skeleton,
  IconButton,
  Tooltip,
  Stack,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useLogs } from '../hooks/useVerificationLogs';
import { VerificationLog } from '../services/logsService';


interface VerificationLogsTableProps {
  orgId: string;
  userId?: string;
  onViewLog?: (log: VerificationLog) => void;
  showUserColumn?: boolean;
}

export default function VerificationLogsTable({ 
  orgId, 
  userId, 
  onViewLog,
  showUserColumn = true 
}: VerificationLogsTableProps) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'SUCCESS' | 'FAILED' | ''>('');
  const [showFilters, setShowFilters] = useState(false);

  const { data, loading, error } = useLogs({
    orgId,
    userId,
    status: statusFilter || undefined,
    search: search || undefined,
    page: page + 1, // Backend uses 1-based pagination
    pageSize,
  });

  const handleChangePage = useCallback((event: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handleChangePageSize = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setPageSize(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(0); // Reset to first page on search
  }, []);

  const handleStatusFilterChange = useCallback((event: any) => {
    setStatusFilter(event.target.value);
    setPage(0); // Reset to first page on filter change
  }, []);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const formatCredentialSubject = (subject: Record<string, any> | null | undefined) => {
    if (!subject) return 'N/A';
    
    // Try to extract meaningful display information
    const name = subject.name || subject.fullName || subject.credentialSubject?.name;
    const type = subject.type || subject['@type'];
    
    if (name) return name;
    if (type) return type;
    
    // Fallback to first available field
    const keys = Object.keys(subject);
    if (keys.length > 0) {
      const firstKey = keys[0];
      const value = subject[firstKey];
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    }
    
    return 'N/A';
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

  if (error) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography variant="h6" color="error" gutterBottom>
          Error Loading Logs
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {error}
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      {/* Header with Search and Filters */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Verification Logs
            {data && (
              <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
                ({data.pagination.total_count} total)
              </Typography>
            )}
          </Typography>
          
          <Tooltip title="Toggle Filters">
            <IconButton 
              onClick={() => setShowFilters(!showFilters)}
              color={showFilters ? 'primary' : 'default'}
            >
              <FilterListIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        {/* Search and Filters */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            size="small"
            placeholder="Search logs..."
            value={search}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 250 }}
          />
          
          {showFilters && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={handleStatusFilterChange}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="SUCCESS">Success</MenuItem>
                <MenuItem value="FAILED">Failed</MenuItem>
              </Select>
            </FormControl>
          )}
        </Stack>

        {/* Stats */}
        {data?.stats && (
          <Stack direction="row" spacing={3} sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Total: {data.stats.total_logs}
            </Typography>
            <Typography variant="body2" color="success.main">
              Success: {data.stats.success_count}
            </Typography>
            <Typography variant="body2" color="error.main">
              Failed: {data.stats.failed_count}
            </Typography>
          </Stack>
        )}
      </Box>

      {/* Table */}
      <TableContainer>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Status</TableCell>
              <TableCell>Verified At</TableCell>
              <TableCell>Credential Subject</TableCell>
              <TableCell>VC Hash</TableCell>
              {showUserColumn && <TableCell>User</TableCell>}
              <TableCell>Synced At</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              // Loading skeleton
              Array.from({ length: pageSize }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton width={80} /></TableCell>
                  <TableCell><Skeleton width={150} /></TableCell>
                  <TableCell><Skeleton width={200} /></TableCell>
                  <TableCell><Skeleton width={100} /></TableCell>
                  {showUserColumn && <TableCell><Skeleton width={120} /></TableCell>}
                  <TableCell><Skeleton width={150} /></TableCell>
                  <TableCell><Skeleton width={60} /></TableCell>
                </TableRow>
              ))
            ) : data?.logs?.length ? (
              data.logs.map((log: VerificationLog) => (
                <TableRow key={log.id} hover>
                  <TableCell>
                    <Chip
                      icon={getStatusIcon(log.verification_status)}
                      label={log.verification_status}
                      color={getStatusColor(log.verification_status) as any}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(log.verified_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ maxWidth: 200 }} noWrap>
                      {formatCredentialSubject(log.credential_subject)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="body2"
                      sx={{ 
                        fontFamily: 'monospace',
                        maxWidth: 120,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={log.vc_hash}
                    >
                      {log.vc_hash ? `${log.vc_hash.substring(0, 12)}...` : 'N/A'}
                    </Typography>
                  </TableCell>
                  {showUserColumn && (
                    <TableCell>
                      <Typography variant="body2" color="text.secondary" component="div">
                        {log.verified_by_info ? (
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {log.verified_by_info.full_name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              @{log.verified_by_info.username}
                            </Typography>
                          </Box>
                        ) : (
                          'Unknown'
                        )}
                      </Typography>
                    </TableCell>
                  )}
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(log.synced_at)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => onViewLog?.(log)}
                        color="primary"
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={showUserColumn ? 7 : 6} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    No verification logs found
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {data && (
        <TablePagination
          rowsPerPageOptions={[10, 20, 50, 100]}
          component="div"
          count={data.pagination.total_count}
          rowsPerPage={pageSize}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangePageSize}
        />
      )}
    </Paper>
  );
}