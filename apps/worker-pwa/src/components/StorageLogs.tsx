import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
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
    const [isExpanded, setIsExpanded] = useState(false);

    // Define columns for DataGrid
    const columns: GridColDef[] = [
        {
            field: 'id',
            headerName: 'ID',
            width: 80,
            renderCell: (params: GridRenderCellParams<any, number | undefined>) => (
                <Typography variant="body2" fontWeight="medium">
                    #{params.value ?? '-'}
                </Typography>
            ),
        },
        {
            field: 'status',
            headerName: 'Status',
            width: 100,
            renderCell: (params: GridRenderCellParams<any, Status | undefined>) => renderStatus(params.value, (params.row as Log).synced),
        },
        {
            field: 'synced',
            headerName: 'Sync Status',
            width: 120,
            renderCell: (params: GridRenderCellParams<any, boolean | undefined>) => renderSyncStatus(params.value),
        },
        {
            field: 'timestamp',
            headerName: 'Time',
            width: 120,
            renderCell: (params: GridRenderCellParams<any, number | undefined>) => (
                <Typography variant="body2" color="text.secondary">
                    {formatTimestamp(params.value)}
                </Typography>
            ),
        },
        {
            field: 'hash',
            headerName: 'Hash',
            flex: 1,
            minWidth: 150,
            renderCell: (params: GridRenderCellParams<any, string | undefined>) => renderHash(params.value),
        },
    ];

    // Filter and search logs
    const filteredLogs = useMemo(() => {
        let filtered: Log[] = logs;
        
        // Apply status filter
        if (filter !== 'all') {
            filtered = filtered.filter((log: Log) => {
                if (filter === 'synced') return log.synced;
                if (filter === 'pending') return !log.synced;
                if (filter === 'success') return log.status === 'success';
                if (filter === 'failure') return log.status === 'failure';
                return true;
            });
        }
        
        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter((log: Log) => 
                log.id?.toString().includes(searchTerm) ||
                log.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.hash?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        return filtered;
    }, [logs, filter, searchTerm]);

    // Calculate statistics
    const statsCount = {
        total: logs.length,
        synced: logs.filter((log: Log) => log.synced).length,
        pending: logs.filter((log: Log) => !log.synced).length,
        success: logs.filter((log: Log) => log.status === 'success').length,
        failure: logs.filter((log: Log) => log.status === 'failure').length
    };

    const clearFilters = () => {
        setSearchTerm('');
        setFilter('all');
    };

    return (
        <Box sx={{ width: '100%', height: '100%' }}>
            {/* Header with stats and controls */}
            <Stack spacing={2} sx={{ mb: 2 }}>
                {/* Statistics chips */}
                <Stack direction="row" spacing={1} flexWrap="wrap">
                    <Chip 
                        label={`${statsCount.total} Total`} 
                        color="default" 
                        size="small" 
                    />
                    <Chip 
                        label={`${statsCount.success} Success`} 
                        color="success" 
                        size="small" 
                    />
                    <Chip 
                        label={`${statsCount.pending} Pending`} 
                        color="warning" 
                        size="small" 
                    />
                    {statsCount.failure > 0 && (
                        <Chip 
                            label={`${statsCount.failure} Failed`} 
                            color="error" 
                            size="small" 
                        />
                    )}
                    <Chip 
                        label={`${filteredLogs.length} Showing`} 
                        variant="outlined" 
                        size="small" 
                    />
                </Stack>
                
                {/* Search and filter controls */}
                <Stack direction="row" spacing={2} alignItems="center">
                    <TextField
                        size="small"
                        placeholder="Search logs..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                        }}
                        sx={{ minWidth: 200 }}
                    />
                    
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Filter</InputLabel>
                        <Select
                            value={filter}
                            label="Filter"
                            onChange={(e) => setFilter(e.target.value)}
                        >
                            <MenuItem value="all">All Logs</MenuItem>
                            <MenuItem value="synced">Synced</MenuItem>
                            <MenuItem value="pending">Pending</MenuItem>
                            <MenuItem value="success">Success</MenuItem>
                            <MenuItem value="failure">Failed</MenuItem>
                        </Select>
                    </FormControl>
                    
                    <IconButton
                        onClick={() => setIsExpanded(!isExpanded)}
                        size="small"
                        title={isExpanded ? "Collapse view" : "Expand view"}
                    >
                        {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                </Stack>
            </Stack>

            {/* Data Grid */}
            <Box sx={{ height: isExpanded ? 500 : 300, width: '100%' }}>
                {filteredLogs.length > 0 ? (
                    <DataGrid
                        rows={filteredLogs}
                        columns={columns}
                        getRowClassName={(params) =>
                            params.indexRelativeToCurrentPage % 2 === 0 ? 'even' : 'odd'
                        }
                        initialState={{
                            pagination: { paginationModel: { pageSize: isExpanded ? 10 : 5 } },
                        }}
                        pageSizeOptions={[5, 10, 20]}
                        disableColumnResize
                        density="compact"
                        slotProps={{
                            filterPanel: {
                                filterFormProps: {
                                    logicOperatorInputProps: {
                                        variant: 'outlined',
                                        size: 'small',
                                    },
                                    columnInputProps: {
                                        variant: 'outlined',
                                        size: 'small',
                                        sx: { mt: 'auto' },
                                    },
                                    operatorInputProps: {
                                        variant: 'outlined',
                                        size: 'small',
                                        sx: { mt: 'auto' },
                                    },
                                    valueInputProps: {
                                        InputComponentProps: {
                                            variant: 'outlined',
                                            size: 'small',
                                        },
                                    },
                                },
                            },
                        }}
                    />
                ) : (
                    /* Empty State */
                    <Box 
                        sx={{ 
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            textAlign: 'center',
                            color: 'text.secondary',
                            py: 4
                        }}
                    >
                        {logs.length === 0 ? (
                            <>
                                <Typography variant="h3" sx={{ fontSize: '3rem', mb: 1 }}>
                                    📭
                                </Typography>
                                <Typography variant="h6" gutterBottom>
                                    No logs yet
                                </Typography>
                                <Typography variant="body2">
                                    Start by testing the verification interface to generate logs
                                </Typography>
                            </>
                        ) : (
                            <>
                                <Typography variant="h3" sx={{ fontSize: '3rem', mb: 1 }}>
                                    🔍
                                </Typography>
                                <Typography variant="h6" gutterBottom>
                                    No matching logs
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 2 }}>
                                    Try adjusting your search or filter criteria
                                </Typography>
                                <Button 
                                    onClick={clearFilters}
                                    variant="outlined"
                                    size="small"
                                >
                                    Clear Filters
                                </Button>
                            </>
                        )}
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default StorageLogs;