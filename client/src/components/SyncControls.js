import React, { useContext } from 'react';
import { VCStorageContext } from '../context/VCStorageContext';
import { markAsSynced, clearAllData } from '../services/dbService';
import { getUnsyncedVerifications, getAllVerifications } from '../services/dbService';

const SyncControls = () => {
    const { forceSyncNow, updateData } = useContext(VCStorageContext);

    const handleForceSyncNow = async () => {
        const result = await forceSyncNow();
        if (result.success) {
            alert(`Sync successful! ${result.synced || 0} items synced.`);
        } else {
            alert(`Sync failed: ${result.reason || result.error}`);
        }
    };

    const handleClearPendingSync = async () => {
        if (window.confirm('Clear all pending sync items?')) {
            const unsynced = await getUnsyncedVerifications();
            await markAsSynced(unsynced.map(item => item.id));
            updateData();
            alert('Cleared pending sync queue');
        }
    };

    const handleExportData = async () => {
        const all = await getAllVerifications();
        const dataStr = JSON.stringify(all, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `vc-data-${new Date().toISOString()}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    const handleClearAllData = async () => {
        if (window.confirm('This will delete all stored data. Are you sure?')) {
            await clearAllData();
            updateData();
            alert('All data cleared');
        }
    };

    return (
        <div className="card">
            <h2>🔄 Sync Controls</h2>
            <button className="btn btn-primary" onClick={handleForceSyncNow}>Force Sync Now</button>
            <button className="btn btn-secondary" onClick={handleClearPendingSync}>Clear Pending Queue</button>
            <button className="btn btn-secondary" onClick={handleExportData}>Export All Data</button>
            <button className="btn btn-secondary" onClick={handleClearAllData}>Clear All Data</button>
        </div>
    );
};

export default SyncControls;