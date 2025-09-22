/**
 * SyncStatusComponent - Shows cache synchronization status and controls
 */

import { useState, useEffect } from 'react';
import { useCacheSync } from '../context/CacheSyncContext';

interface SyncStatusComponentProps {
  showDetails?: boolean;
  className?: string;
}

export function SyncStatusComponent({ showDetails = true, className = '' }: SyncStatusComponentProps) {
  const { isOnline, isSyncing, lastSyncTime, syncError, forceSyncNow } = useCacheSync();
  const [lastSyncText, setLastSyncText] = useState<string>('Never');

  // Update last sync text
  useEffect(() => {
    const updateLastSyncText = () => {
      if (!lastSyncTime) {
        setLastSyncText('Never');
        return;
      }

      const now = Date.now();
      const diffMs = now - lastSyncTime;
      const diffMins = Math.floor(diffMs / (1000 * 60));

      if (diffMins < 1) {
        setLastSyncText('Just now');
      } else if (diffMins < 60) {
        setLastSyncText(`${diffMins}m ago`);
      } else {
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) {
          setLastSyncText(`${diffHours}h ago`);
        } else {
          const diffDays = Math.floor(diffHours / 24);
          setLastSyncText(`${diffDays}d ago`);
        }
      }
    };

    updateLastSyncText();
    const interval = setInterval(updateLastSyncText, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [lastSyncTime]);

  const getStatusColor = () => {
    if (!isOnline) return '#ff9800'; // Orange for offline
    if (isSyncing) return '#2196f3'; // Blue for syncing
    if (syncError) return '#f44336'; // Red for error
    return '#4caf50'; // Green for online and synced
  };

  const getStatusText = () => {
    if (!isOnline) return 'Offline';
    if (isSyncing) return 'Syncing...';
    if (syncError) return 'Sync Error';
    return 'Online';
  };

  const getStatusIcon = () => {
    if (!isOnline) return '📴';
    if (isSyncing) return '🔄';
    if (syncError) return '⚠️';
    return '✅';
  };

  const handleForceSync = async () => {
    if (!isOnline || isSyncing) return;
    await forceSyncNow();
  };

  return (
    <div className={`sync-status ${className}`} style={{
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 12px',
      borderRadius: '8px',
      backgroundColor: '#f5f5f5',
      border: `2px solid ${getStatusColor()}`,
      fontSize: '14px'
    }}>
      {/* Status indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontSize: '16px' }}>{getStatusIcon()}</span>
        <span style={{ 
          fontWeight: '500',
          color: getStatusColor()
        }}>
          {getStatusText()}
        </span>
      </div>

      {showDetails && (
        <>
          {/* Last sync time */}
          <div style={{ 
            fontSize: '12px', 
            color: '#666',
            borderLeft: '1px solid #ddd',
            paddingLeft: '12px'
          }}>
            Last sync: {lastSyncText}
          </div>

          {/* Error message */}
          {syncError && (
            <div style={{ 
              fontSize: '12px', 
              color: '#f44336',
              borderLeft: '1px solid #ddd',
              paddingLeft: '12px',
              maxWidth: '200px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {syncError}
            </div>
          )}

          {/* Force sync button */}
          {isOnline && !isSyncing && (
            <button
              onClick={handleForceSync}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                backgroundColor: 'white',
                cursor: 'pointer',
                marginLeft: 'auto'
              }}
              title="Force sync now"
            >
              🔄 Sync
            </button>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Compact version for toolbar/header use
 */
export function SyncStatusIndicator({ className = '' }: { className?: string }) {
  return (
    <SyncStatusComponent 
      showDetails={false} 
      className={`sync-indicator ${className}`}
    />
  );
}

export default SyncStatusComponent;