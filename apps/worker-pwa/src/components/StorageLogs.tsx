import { useState, useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Button from '@mui/material/Button';
import SearchIcon from '@mui/icons-material/Search';
import { useVCStorage } from '../context/VCStorageContext';
import './styles/StorageLogs.css';

type Status = 'success' | 'failure';
type Log = {
    id: number;
    status: Status;
    synced: boolean;
    timestamp: number;
    hash: string;
};

// Status badge renderer
const renderStatus = (status: Status | undefined, synced: boolean | undefined) => {
    if (status === undefined || synced === undefined) {
        return <span className="status-badge neutral">-</span>;
    }
    
    let className = 'status-badge ';
    let label = '';
    
    if (synced && status === 'success') {
        className += 'success';
        label = 'Success';
    } else if (status === 'failure') {
        className += 'error';
        label = 'Failed';
    } else if (!synced) {
        className += 'pending';
        label = 'Pending';
    } else {
        className += 'neutral';
        label = 'Unknown';
    }
    
    return <span className={className}>{label}</span>;
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

const StorageLogs = () => {
    const ctx = useVCStorage();
    const logs = ctx?.logs || [];
    
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(5);

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

    // Pagination logic
    const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedLogs = filteredLogs.slice(startIndex, startIndex + itemsPerPage);

    // Reset to first page when filters change
    useMemo(() => {
        setCurrentPage(1);
    }, [filter, searchTerm]);

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
        setCurrentPage(1);
    };

    const handlePageChange = (page: number) => {
        setCurrentPage(page);
    };

    return (
        <Box className="storage-logs-container">
            {/* Statistics chips and controls in one row */}
            <div className="stats-row">
                <div className="stats-chips">
                    <span className="stat-chip total">{statsCount.total} Total</span>
                    <span className="stat-chip success">{statsCount.success} Success</span>
                    {statsCount.failure > 0 && (
                        <span className="stat-chip failure">{statsCount.failure} Failed</span>
                    )}
                    <span className="stat-chip pending">{statsCount.pending} Pending</span>
                    <span className="stat-chip showing">
                        {filteredLogs.length} Showing
                    </span>
                </div>

                {/* Search and filter controls on the right */}
                <div className="controls-section">
                    <TextField
                        className="search-input"
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
                        sx={{
                            width: 250,
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: 'var(--hash-bg)',
                                '& fieldset': {
                                    borderColor: 'var(--table-border)',
                                },
                                '&:hover fieldset': {
                                    borderColor: 'var(--chip-color)',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: 'var(--chip-color)',
                                },
                            },
                            '& .MuiInputBase-input': {
                                color: 'var(--text-primary)',
                            },
                            '& .MuiInputBase-input::placeholder': {
                                color: 'var(--text-secondary)',
                            },
                        }}
                    />
                    
                    <FormControl size="small" className="filter-control" sx={{ minWidth: 120 }}>
                        <InputLabel sx={{ 
                            color: 'var(--text-secondary)',
                            '&.Mui-focused': {
                                color: 'var(--chip-color)',
                            }
                        }}>
                            Filter
                        </InputLabel>
                        <Select
                            value={filter}
                            label="Filter"
                            onChange={(e) => setFilter(e.target.value)}
                            displayEmpty
                            sx={{
                                backgroundColor: 'var(--hash-bg)',
                                '& .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'var(--table-border)',
                                },
                                '&:hover .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'var(--chip-color)',
                                },
                                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                    borderColor: 'var(--chip-color)',
                                },
                                '& .MuiSelect-select': {
                                    color: 'var(--text-primary)',
                                    fontSize: '0.875rem',
                                    fontWeight: 500,
                                },
                                '& .MuiSelect-icon': {
                                    color: 'var(--text-secondary)',
                                },
                            }}
                            MenuProps={{
                                PaperProps: {
                                    sx: {
                                        backgroundColor: 'var(--table-background)',
                                        border: '1px solid var(--table-border)',
                                        '& .MuiMenuItem-root': {
                                            color: 'var(--text-primary)',
                                            fontSize: '0.875rem',
                                            '&:hover': {
                                                backgroundColor: 'var(--table-hover)',
                                            },
                                            '&.Mui-selected': {
                                                backgroundColor: 'var(--chip-hover-bg)',
                                                color: 'var(--chip-color)',
                                            },
                                        },
                                    },
                                },
                            }}
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="synced">Synced</MenuItem>
                            <MenuItem value="pending">Pending</MenuItem>
                            <MenuItem value="success">Success</MenuItem>
                            <MenuItem value="failure">Failed</MenuItem>
                        </Select>
                    </FormControl>

                    {(searchTerm || filter !== 'all') && (
                        <Button 
                            onClick={clearFilters}
                            variant="outlined"
                            size="small"
                            sx={{
                                borderColor: 'var(--table-border)',
                                color: 'var(--text-secondary)',
                                backgroundColor: 'var(--table-background)',
                                '&:hover': {
                                    borderColor: 'var(--chip-color)',
                                    backgroundColor: 'var(--chip-hover-bg)',
                                    color: 'var(--chip-color)',
                                },
                            }}
                        >
                            Clear
                        </Button>
                    )}
                </div>
            </div>

            {/* Table or Empty State */}
            {filteredLogs.length > 0 ? (
                <>
                    <div className="table-container">
                        <table className="minimal-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Status</th>
                                    <th>Time</th>
                                    <th>Hash</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedLogs.map((log) => (
                                    <tr key={log.id}>
                                        <td>
                                            <Typography 
                                                variant="body2" 
                                                sx={{ 
                                                    fontWeight: 600, 
                                                    color: 'var(--text-primary)',
                                                    fontSize: '0.875rem'
                                                }}
                                            >
                                                #{log.id}
                                            </Typography>
                                        </td>
                                        <td>
                                            {renderStatus(log.status, log.synced)}
                                        </td>
                                        <td>
                                            <Typography 
                                                variant="body2" 
                                                sx={{ 
                                                    color: 'var(--text-secondary)',
                                                    fontSize: '0.875rem'
                                                }}
                                            >
                                                {formatTimestamp(log.timestamp)}
                                            </Typography>
                                        </td>
                                        <td>
                                            <span className="hash-text">
                                                {log.hash ? (log.hash.length > 12 ? `${log.hash.substring(0, 12)}...` : log.hash) : '-'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    
                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="pagination-container">
                            <div className="pagination-info">
                                Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredLogs.length)} of {filteredLogs.length} entries
                            </div>
                            <div className="pagination-controls">
                                <button 
                                    className="page-button" 
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                >
                                    Previous
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        className={`page-button ${currentPage === page ? 'active' : ''}`}
                                        onClick={() => handlePageChange(page)}
                                    >
                                        {page}
                                    </button>
                                ))}
                                <button 
                                    className="page-button" 
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="empty-state">
                    {logs.length === 0 ? (
                        <>
                            <div className="empty-state-icon">📭</div>
                            <Typography 
                                variant="h6" 
                                gutterBottom
                                sx={{ color: 'var(--text-primary)' }}
                            >
                                No logs yet
                            </Typography>
                            <Typography 
                                variant="body2"
                                sx={{ color: 'var(--text-secondary)' }}
                            >
                                Start by testing the verification interface to generate logs
                            </Typography>
                        </>
                    ) : (
                        <>
                            <div className="empty-state-icon">🔍</div>
                            <Typography 
                                variant="h6" 
                                gutterBottom
                                sx={{ color: 'var(--text-primary)' }}
                            >
                                No matching logs
                            </Typography>
                            <Typography 
                                variant="body2" 
                                sx={{ 
                                    mb: 2,
                                    color: 'var(--text-secondary)'
                                }}
                            >
                                Try adjusting your search or filter criteria
                            </Typography>
                            <Button 
                                onClick={clearFilters}
                                variant="outlined"
                                size="small"
                                sx={{
                                    borderColor: 'var(--table-border)',
                                    color: 'var(--text-secondary)',
                                    backgroundColor: 'var(--table-background)',
                                    '&:hover': {
                                        borderColor: 'var(--chip-color)',
                                        backgroundColor: 'var(--chip-hover-bg)',
                                        color: 'var(--chip-color)',
                                    },
                                }}
                            >
                                Clear Filters
                            </Button>
                        </>
                    )}
                </div>
            )}
        </Box>
    );
};

export default StorageLogs;