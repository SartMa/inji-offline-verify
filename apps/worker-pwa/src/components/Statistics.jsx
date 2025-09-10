import React from 'react';
import { useVCStorage } from '../context/VCStorageContext.jsx';
import './styles/Statistics.css';

const Statistics = () => {
    const { stats } = useVCStorage();
    
    // Calculate sync percentage
    const syncPercentage = stats.totalStored > 0 
        ? Math.round((stats.syncedCount / stats.totalStored) * 100) 
        : 0;
    
    const statisticsData = [
        {
            label: 'Total Stored',
            value: stats.totalStored,
            icon: '📦',
            color: 'blue',
            description: 'Total verifications stored'
        },
        {
            label: 'Pending Sync',
            value: stats.pendingSyncCount,
            icon: '⏳',
            color: 'orange',
            description: 'Waiting to sync'
        },
        {
            label: 'Synced',
            value: stats.syncedCount,
            icon: '✅',
            color: 'green',
            description: 'Successfully synced'
        },
        {
            label: 'Failed',
            value: stats.failedCount,
            icon: '❌',
            color: 'red',
            description: 'Failed verifications'
        }
    ];
    
    return (
        <div className="statistics-container">
            <div className="statistics-header">
                <h2 className="statistics-title">
                    <span className="title-icon">📊</span>
                    Statistics Overview
                </h2>
                <div className="sync-progress">
                    <div className="progress-label">Sync Progress</div>
                    <div className="progress-bar">
                        <div 
                            className="progress-fill" 
                            style={{ width: `${syncPercentage}%` }}
                        />
                    </div>
                    <div className="progress-text">{syncPercentage}%</div>
                </div>
            </div>
            
            <div className="statistics-grid">
                {statisticsData.map((stat, index) => (
                    <div 
                        key={stat.label} 
                        className={`stat-card stat-card-${stat.color}`}
                        style={{ animationDelay: `${index * 0.1}s` }}
                    >
                        <div className="stat-icon">{stat.icon}</div>
                        <div className="stat-content">
                            <div className="stat-value">
                                {stat.value.toLocaleString()}
                            </div>
                            <div className="stat-label">{stat.label}</div>
                            <div className="stat-description">{stat.description}</div>
                        </div>
                        <div className="stat-pulse"></div>
                    </div>
                ))}
            </div>
            
            {stats.totalStored === 0 && (
                <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <div className="empty-text">No data yet</div>
                    <div className="empty-description">
                        Start by testing the verification interface to see statistics
                    </div>
                </div>
            )}
        </div>
    );
};

export default Statistics;