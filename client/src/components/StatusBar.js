import React, { useContext } from 'react';
import { VCStorageContext } from '../context/VCStorageContext';

const StatusBar = () => {
    const { isOnline, serviceWorkerStatus, stats } = useContext(VCStorageContext);

    return (
        <div className="status-bar">
            <div className="status-indicator">
                <span>Connection:</span>
                <strong className={isOnline ? 'online' : 'offline'}>
                    {isOnline ? 'Online' : 'Offline'}
                </strong>
            </div>
            <div className="status-indicator">
                <span>Service Worker:</span>
                <strong className={serviceWorkerStatus === 'Active' ? 'online' : 'offline'}>
                    {serviceWorkerStatus}
                </strong>
            </div>
            <div className="status-indicator">
                <span>Pending Sync:</span>
                <strong>{stats.pendingSyncCount}</strong>
            </div>
        </div>
    );
};

export default StatusBar;