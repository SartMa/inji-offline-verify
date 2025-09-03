import React, { useState, useMemo } from 'react';
import { useVCStorage } from '../context/VCStorageContext.jsx';
import './styles/StorageLogs.css';

const StorageLogs = () => {
    const { logs } = useVCStorage();
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [isExpanded, setIsExpanded] = useState(false);

    // Filter and search logs
    const filteredLogs = useMemo(() => {
        let filtered = logs;
        
        // Apply status filter
        if (filter !== 'all') {
            filtered = filtered.filter(log => {
                if (filter === 'synced') return log.synced;
                if (filter === 'pending') return !log.synced;
                if (filter === 'success') return log.status === 'success';
                if (filter === 'failure') return log.status === 'failure';
                return true;
            });
        }
        
        // Apply search filter
        if (searchTerm) {
            filtered = filtered.filter(log => 
                log.id?.toString().includes(searchTerm) ||
                log.status?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.hash?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        
        return filtered;
    }, [logs, filter, searchTerm]);

    const getLogIcon = (log) => {
        if (log.synced) {
            return log.status === 'success' ? '✅' : '🔄';
        }
        return log.status === 'failure' ? '❌' : '⏳';
    };

    const getLogTypeClass = (log) => {
        if (log.synced && log.status === 'success') return 'success';
        if (log.synced && log.status === 'failure') return 'error';
        if (!log.synced && log.status === 'failure') return 'error';
        return 'pending';
    };

    const formatTimestamp = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const statsCount = {
        total: logs.length,
        synced: logs.filter(log => log.synced).length,
        pending: logs.filter(log => !log.synced).length,
        success: logs.filter(log => log.status === 'success').length,
        failure: logs.filter(log => log.status === 'failure').length
    };

    return (
        <div className="storage-logs-container">
            <div className="logs-header">
                <div className="logs-title-section">
                    <h2 className="logs-title">
                        <span className="logs-icon">📝</span>
                        Storage Logs
                        <span className="logs-count">({filteredLogs.length})</span>
                    </h2>
                    <div className="logs-stats">
                        <span className="stat-badge stat-total">{statsCount.total} Total</span>
                        <span className="stat-badge stat-success">{statsCount.success} Success</span>
                        <span className="stat-badge stat-pending">{statsCount.pending} Pending</span>
                        {statsCount.failure > 0 && (
                            <span className="stat-badge stat-error">{statsCount.failure} Failed</span>
                        )}
                    </div>
                </div>
                
                <div className="logs-controls">
                    <div className="search-container">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Search logs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                    
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">All Logs</option>
                        <option value="synced">Synced</option>
                        <option value="pending">Pending</option>
                        <option value="success">Success</option>
                        <option value="failure">Failed</option>
                    </select>
                    
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="expand-button"
                        title={isExpanded ? "Collapse view" : "Expand view"}
                    >
                        {isExpanded ? '📉' : '📈'}
                    </button>
                </div>
            </div>

            <div className={`logs-container ${isExpanded ? 'expanded' : ''}`}>
                {filteredLogs.length > 0 ? (
                    <div className="logs-list">
                        {filteredLogs.map((log, index) => (
                            <div 
                                key={log.id || index}
                                className={`log-entry log-${getLogTypeClass(log)}`}
                                style={{ animationDelay: `${index * 0.05}s` }}
                            >
                                <div className="log-header">
                                    <div className="log-icon-section">
                                        <span className="log-icon">{getLogIcon(log)}</span>
                                        <div className="log-pulse"></div>
                                    </div>
                                    
                                    <div className="log-main-info">
                                        <div className="log-id-status">
                                            <span className="log-id">#{log.id}</span>
                                            <span className={`log-status log-status-${getLogTypeClass(log)}`}>
                                                {log.status || 'unknown'}
                                            </span>
                                        </div>
                                        <div className="log-timestamp">
                                            {formatTimestamp(log.timestamp)}
                                        </div>
                                    </div>
                                    
                                    <div className="log-sync-status">
                                        <span className={`sync-badge sync-${log.synced ? 'done' : 'pending'}`}>
                                            {log.synced ? 'Synced' : 'Pending'}
                                        </span>
                                    </div>
                                </div>
                                
                                {log.hash && (
                                    <div className="log-details">
                                        <div className="log-hash">
                                            <span className="hash-label">Hash:</span>
                                            <code className="hash-value">{log.hash}</code>
                                        </div>
                                    </div>
                                )}
                                
                                <div className="log-progress-bar">
                                    <div className={`progress-fill progress-${getLogTypeClass(log)}`}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="empty-logs-state">
                        {logs.length === 0 ? (
                            <>
                                <div className="empty-icon">📭</div>
                                <div className="empty-title">No logs yet</div>
                                <div className="empty-description">
                                    Start by testing the verification interface to generate logs
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="empty-icon">🔍</div>
                                <div className="empty-title">No matching logs</div>
                                <div className="empty-description">
                                    Try adjusting your search or filter criteria
                                </div>
                                <button 
                                    onClick={() => { setSearchTerm(''); setFilter('all'); }}
                                    className="clear-filters-btn"
                                >
                                    Clear Filters
                                </button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default StorageLogs;