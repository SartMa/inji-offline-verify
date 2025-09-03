import React, { useState } from 'react';
import { useVCStorage } from '../context/VCStorageContext.jsx';
import './styles/SyncControls.css';

const SyncControls = () => {
    const { syncToServer, clearAllData, exportData, clearPendingSync, stats, isOnline } = useVCStorage();
    const [isLoading, setIsLoading] = useState({});

    const setLoadingState = (action, state) => {
        setIsLoading(prev => ({ ...prev, [action]: state }));
    };

    const handleForceSyncNow = async () => {
        setLoadingState('sync', true);
        try {
            const result = await syncToServer();
            if (result.success) {
                showNotification(`Sync successful! ${result.synced || 0} items synced.`, 'success');
            } else {
                showNotification(`Sync failed: ${result.reason || result.error}`, 'error');
            }
        } catch (error) {
            showNotification(`Sync error: ${error.message}`, 'error');
        } finally {
            setLoadingState('sync', false);
        }
    };

    const handleClearPendingSync = async () => {
        if (window.confirm('Clear all pending sync items? This will mark them as synced without actually syncing.')) {
            setLoadingState('clearPending', true);
            try {
                await clearPendingSync();
                showNotification('Cleared pending sync queue', 'success');
            } catch (error) {
                showNotification(`Error clearing queue: ${error.message}`, 'error');
            } finally {
                setLoadingState('clearPending', false);
            }
        }
    };

    const handleExportData = async () => {
        setLoadingState('export', true);
        try {
            await exportData();
            showNotification('Data exported successfully!', 'success');
        } catch (error) {
            showNotification(`Export failed: ${error.message}`, 'error');
        } finally {
            setLoadingState('export', false);
        }
    };

    const handleClearAllData = async () => {
        if (window.confirm('⚠️ This will permanently delete ALL stored verification data. This action cannot be undone. Are you absolutely sure?')) {
            setLoadingState('clearAll', true);
            try {
                await clearAllData();
                showNotification('All data cleared successfully', 'success');
            } catch (error) {
                showNotification(`Error clearing data: ${error.message}`, 'error');
            } finally {
                setLoadingState('clearAll', false);
            }
        }
    };

    const showNotification = (message, type) => {
        // Simple notification - you could replace this with a toast library
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    };

    const syncActions = [
        {
            id: 'sync',
            title: 'Force Sync Now',
            description: 'Immediately sync all pending data to server',
            icon: '🔄',
            action: handleForceSyncNow,
            variant: 'primary',
            disabled: !isOnline || stats.pendingSyncCount === 0,
            tooltip: !isOnline ? 'Cannot sync while offline' : stats.pendingSyncCount === 0 ? 'No items to sync' : ''
        },
        {
            id: 'clearPending',
            title: 'Clear Pending Queue',
            description: 'Mark pending items as synced without syncing',
            icon: '🗑️',
            action: handleClearPendingSync,
            variant: 'warning',
            disabled: stats.pendingSyncCount === 0,
            tooltip: stats.pendingSyncCount === 0 ? 'No pending items' : ''
        }
    ];

    const dataActions = [
        {
            id: 'export',
            title: 'Export All Data',
            description: 'Download all verification data as JSON',
            icon: '📥',
            action: handleExportData,
            variant: 'secondary',
            disabled: stats.totalStored === 0,
            tooltip: stats.totalStored === 0 ? 'No data to export' : ''
        },
        {
            id: 'clearAll',
            title: 'Clear All Data',
            description: 'Permanently delete all stored data',
            icon: '🗑️',
            action: handleClearAllData,
            variant: 'danger',
            disabled: stats.totalStored === 0,
            tooltip: stats.totalStored === 0 ? 'No data to clear' : ''
        }
    ];

    return (
        <div className="sync-controls-container">
            <div className="sync-header">
                <h2 className="sync-title">
                    <span className="sync-icon">🔄</span>
                    Sync Controls
                </h2>
                <div className="sync-status">
                    <div className={`connection-indicator ${isOnline ? 'online' : 'offline'}`}>
                        <span className="indicator-dot"></span>
                        {isOnline ? 'Online' : 'Offline'}
                    </div>
                    <div className="pending-count">
                        {stats.pendingSyncCount} pending
                    </div>
                </div>
            </div>

            <div className="controls-section">
                <div className="section-header">
                    <h3 className="section-title">
                        <span className="section-icon">⚡</span>
                        Sync Actions
                    </h3>
                    <p className="section-description">
                        Manage data synchronization with the server
                    </p>
                </div>
                <div className="controls-grid">
                    {syncActions.map(action => (
                        <div key={action.id} className="control-card">
                            <div className="control-header">
                                <div className="control-icon">{action.icon}</div>
                                <div className="control-info">
                                    <h4 className="control-title">{action.title}</h4>
                                    <p className="control-description">{action.description}</p>
                                </div>
                            </div>
                            <button
                                onClick={action.action}
                                disabled={action.disabled || isLoading[action.id]}
                                className={`control-button control-${action.variant}`}
                                title={action.tooltip}
                            >
                                {isLoading[action.id] ? (
                                    <span className="loading-spinner"></span>
                                ) : (
                                    action.title
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            <div className="controls-section">
                <div className="section-header">
                    <h3 className="section-title">
                        <span className="section-icon">💾</span>
                        Data Management
                    </h3>
                    <p className="section-description">
                        Export or clear your verification data
                    </p>
                </div>
                <div className="controls-grid">
                    {dataActions.map(action => (
                        <div key={action.id} className="control-card">
                            <div className="control-header">
                                <div className="control-icon">{action.icon}</div>
                                <div className="control-info">
                                    <h4 className="control-title">{action.title}</h4>
                                    <p className="control-description">{action.description}</p>
                                </div>
                            </div>
                            <button
                                onClick={action.action}
                                disabled={action.disabled || isLoading[action.id]}
                                className={`control-button control-${action.variant}`}
                                title={action.tooltip}
                            >
                                {isLoading[action.id] ? (
                                    <span className="loading-spinner"></span>
                                ) : (
                                    action.title
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Quick Stats */}
            <div className="quick-stats">
                <div className="stat-item">
                    <span className="stat-label">Total Stored:</span>
                    <span className="stat-value">{stats.totalStored}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Synced:</span>
                    <span className="stat-value">{stats.syncedCount}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Pending:</span>
                    <span className="stat-value">{stats.pendingSyncCount}</span>
                </div>
            </div>
        </div>
    );
};

export default SyncControls;