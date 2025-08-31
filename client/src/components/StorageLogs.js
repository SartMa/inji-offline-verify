import React, { useContext } from 'react';
import { VCStorageContext } from '../context/VCStorageContext';

const StorageLogs = () => {
    const { allVerifications } = useContext(VCStorageContext);

    // Take the last 10 items and reverse them
    const recentLogs = [...allVerifications].slice(-10).reverse();

    return (
        <div className="card">
            <h2>📝 Storage Logs</h2>
            <div id="logs">
                {recentLogs.map((item) => (
                    <div 
                        key={item.id} 
                        className={`log-item ${item.synced ? 'sync-success' : 'sync-pending'}`}
                    >
                        <strong>ID: {item.id}</strong> | 
                        Status: {item.status || 'unknown'} | 
                        Synced: {item.synced ? '✓' : 'Pending'} |
                        Time: {new Date(item.timestamp).toLocaleString()}
                        {item.hash ? <br /> : ''}{item.hash ? `Hash: ${item.hash}` : ''}
                    </div>
                ))}
                {recentLogs.length === 0 && (
                    <p>No logs available.</p>
                )}
            </div>
        </div>
    );
};

export default StorageLogs;