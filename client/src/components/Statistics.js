import React, { useContext } from 'react';
import { VCStorageContext } from '../context/VCStorageContext';

const Statistics = () => {
    const { stats } = useContext(VCStorageContext);
    
    return (
        <div className="card">
            <h2>📊 Statistics</h2>
            <div className="stats">
                <div className="stat-card">
                    <div className="stat-value">{stats.totalStored}</div>
                    <div className="stat-label">Total Stored</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.pendingSyncCount}</div>
                    <div className="stat-label">Pending Sync</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.syncedCount}</div>
                    <div className="stat-label">Synced</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats.failedCount}</div>
                    <div className="stat-label">Failed</div>
                </div>
            </div>
        </div>
    );
};

export default Statistics;