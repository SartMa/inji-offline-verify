import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Chip from '@mui/material/Chip';
import SearchIcon from '@mui/icons-material/Search';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { useVCStorage } from '../context/VCStorageContext';

type Status = 'success' | 'failure';
type Log = {
    id: number;
    status: Status;
    synced: boolean;
    timestamp: number;
    hash: string;
};

// Status chip renderer
const renderStatus = (status: Status | undefined, synced: boolean | undefined) => {
    if (status === undefined || synced === undefined) {
        return <Chip label="-" size="small" variant="outlined" />;
    }
    let color: 'success' | 'error' | 'warning' | 'default', label: string;
    if (synced && status === 'success') {
        color = 'success';
        label = 'Success';
    } else if (synced && status === 'failure') {
        color = 'error';
        label = 'Failed';
    } else if (!synced && status === 'failure') {
        color = 'error';
        label = 'Failed';
    } else if (!synced) {
        color = 'warning';
        label = 'Pending';
    } else {
        color = 'default';
        label = 'Unknown';
    }
    return <Chip label={label} color={color} size="small" />;
};

// Sync status chip renderer
const renderSyncStatus = (synced: boolean | undefined) => {
    if (synced === undefined) {
        return <Chip label="-" size="small" variant="outlined" />;
    }
    return (
        <Chip 
            label={synced ? 'Synced' : 'Pending'} 
            color={synced ? 'success' : 'default'} 
            size="small"
            variant={synced ? 'filled' : 'outlined'}
        />
    );
};

// Time formatter
const formatTimestamp = (timestamp: number | undefined) => {
    if (timestamp === undefined) return '-';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '-';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
};

// Hash cell renderer
const renderHash = (hash: string | undefined) => {
    if (!hash) return '';
    const shortHash = hash.length > 8 ? `${hash.substring(0, 8)}...` : hash;
    return (
        <Typography 
            variant="body2" 
            sx={{ 
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                color: 'text.secondary'
            }}
        >
            {shortHash}
        </Typography>
    );
};

const StorageLogs = () => {
    const ctx = useVCStorage();
    const logs = ctx?.logs || [];
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Define compact columns for horizontal layout
    const columns: GridColDef[] = [
        {
            field: 'id',
            headerName: 'ID',
            width: 60,
            renderCell: (params: GridRenderCellParams<any, number | undefined>) => (
                <Typography variant="body2" fontWeight="medium" sx={{ fontSize: '0.75rem' }}>
                    #{params.value ?? '-'}
                </Typography>
            ),
        },
        {
            field: 'status',
            headerName: 'Status',
            width: 90,
            renderCell: (params: GridRenderCellParams<any, Status | undefined>) => renderStatus(params.value, (params.row as Log).synced),
        },
        {
            field: 'synced',
            headerName: 'Sync',
            width: 90,
            renderCell: (params: GridRenderCellParams<any, boolean | undefined>) => renderSyncStatus(params.value),
        },
        {
            field: 'timestamp',
            headerName: 'Time',
            width: 100,
            renderCell: (params: GridRenderCellParams<any, number | undefined>) => (
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                    {formatTimestamp(params.value)}
                </Typography>
            ),
        },
        {
            field: 'hash',
            headerName: 'Hash',
            flex: 1,
            minWidth: 120,
            renderCell: (params: GridRenderCellParams<any, string | undefined>) => renderHash(params.value),
        },
    ];

    // Filter and search logs
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            const matchesFilter = filter === 'all' || 
                (filter === 'success' && log.status === 'success' && log.synced) ||
                (filter === 'pending' && !log.synced) ||
                (filter === 'failed' && log.status === 'failure');
            
            const matchesSearch = searchTerm === '' || 
                log.hash?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.id.toString().includes(searchTerm);
            
            return matchesFilter && matchesSearch;
        });
    }, [logs, filter, searchTerm]);

    // Calculate statistics
    const statsCount = useMemo(() => {
        const total = logs.length;
        const success = logs.filter(log => log.status === 'success' && log.synced).length;
        const pending = logs.filter(log => !log.synced).length;
        const failure = logs.filter(log => log.status === 'failure').length;
        return { total, success, pending, failure };
    }, [logs]);

    return (
        <Stack spacing={1.5} sx={{ height: '100%' }}>
            {/* Compact header with stats and controls */}
            <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1
            }}>
                {/* Statistics chips - more compact */}
                <Stack direction="row" spacing={0.5} flexWrap="wrap">
                    <Chip 
                        label={`${statsCount.total} Total`} 
                        color="default" 
                        size="small" 
                        sx={{ height: 24, fontSize: '0.7rem' }}
                    />
                    <Chip 
                        label={`${statsCount.success} Success`} 
                        color="success" 
                        size="small" 
                        sx={{ height: 24, fontSize: '0.7rem' }}
                    />
                    {statsCount.pending > 0 && (
                        <Chip 
                            label={`${statsCount.pending} Pending`} 
                            color="warning" 
                            size="small" 
                            sx={{ height: 24, fontSize: '0.7rem' }}
                        />
                    )}
                    {statsCount.failure > 0 && (
                        <Chip 
                            label={`${statsCount.failure} Failed`} 
                            color="error" 
                            size="small" 
                            sx={{ height: 24, fontSize: '0.7rem' }}
                        />
                    )}
                    <Chip 
                        label={`${filteredLogs.length} Showing`} 
                        variant="outlined" 
                        size="small" 
                        sx={{ height: 24, fontSize: '0.7rem' }}
                    />
                </Stack>
                
                {/* Compact search and filter */}
                <Stack direction="row" spacing={1} alignItems="center">
                    <TextField
                        size="small"
                        placeholder="Search..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ 
                            minWidth: 150,
                            '& .MuiOutlinedInput-root': {
                                height: 32,
                            }
                        }}
                    />
                    
                    <FormControl size="small" sx={{ minWidth: 100 }}>
                        <Select
                            value={filter}
                            onChange={(e) => setFilter(e.target.value)}
                            displayEmpty
                            sx={{ height: 32 }}
                        >
                            <MenuItem value="all">All Logs</MenuItem>
                            <MenuItem value="success">Success</MenuItem>
                            <MenuItem value="pending">Pending</MenuItem>
                            <MenuItem value="failed">Failed</MenuItem>
                        </Select>
                    </FormControl>
                </Stack>
            </Box>

            {/* Compact DataGrid */}
            <Box sx={{ flexGrow: 1, minHeight: 200 }}>
                <DataGrid
                    rows={filteredLogs}
                    columns={columns}
                    initialState={{
                        pagination: {
                            paginationModel: {
                                page: 0,
                                pageSize: 5,
                            },
                        },
                    }}
                    pageSizeOptions={[5, 10]}
                    disableRowSelectionOnClick
                    density="compact"
                    sx={{
                        border: 'none',
                        '& .MuiDataGrid-main': {
                            border: `1px solid`,
                            borderColor: 'divider',
                            borderRadius: 1,
                        },
                        '& .MuiDataGrid-columnHeaders': {
                            backgroundColor: 'action.hover',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            minHeight: '32px !important',
                            maxHeight: '32px !important',
                        },
                        '& .MuiDataGrid-row': {
                            minHeight: '32px !important',
                            maxHeight: '32px !important',
                        },
                        '& .MuiDataGrid-cell': {
                            fontSize: '0.75rem',
                            padding: '4px 8px',
                        },
                        '& .MuiDataGrid-footerContainer': {
                            minHeight: '36px',
                            backgroundColor: 'action.hover',
                        },
                        '& .MuiDataGrid-selectedRowCount': {
                            fontSize: '0.75rem',
                        },
                        '[data-mui-color-scheme="dark"] &': {
                            '& .MuiDataGrid-main': {
                                borderColor: 'rgba(255, 255, 255, 0.12)',
                            },
                            '& .MuiDataGrid-columnHeaders': {
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            },
                            '& .MuiDataGrid-footerContainer': {
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            },
                        },
                    }}
                />
            </Box>
        </Stack>
    );
};

export default StorageLogs;