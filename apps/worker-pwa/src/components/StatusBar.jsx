import React from 'react';
import { useVCStorage } from '../context/VCStorageContext.jsx';
import { useAuth } from '../context/AuthContext.tsx';
import './styles/StatusBar.css';

const StatusBar = () => {
    const { isOnline, serviceWorkerActive, stats } = useVCStorage();
    const { signOut, user } = useAuth();

    const handleLogout = () => {
        if (confirm('Are you sure you want to sign out?')) {
            signOut();
        }
    };

    const statusItems = [
        {
            label: 'Connection',
            value: isOnline ? 'Online' : 'Offline',
            status: isOnline ? 'online' : 'offline',
            icon: isOnline ? '🌐' : '📡',
            description: isOnline ? 'Connected to internet' : 'No internet connection',
            pulse: isOnline
        },
        {
            label: 'Service Worker',
            value: serviceWorkerActive ? 'Active' : 'Inactive',
            status: serviceWorkerActive ? 'online' : 'offline',
            icon: serviceWorkerActive ? '⚡' : '🔧',
            description: serviceWorkerActive ? 'Background sync enabled' : 'Background sync disabled',
            pulse: serviceWorkerActive
        },
        {
            label: 'Pending Sync',
            value: stats.pendingSyncCount,
            status: stats.pendingSyncCount > 0 ? 'warning' : 'success',
            icon: stats.pendingSyncCount > 0 ? '⏳' : '✅',
            description: stats.pendingSyncCount > 0 
                ? `${stats.pendingSyncCount} items waiting to sync` 
                : 'All items synced',
            pulse: stats.pendingSyncCount > 0
        }
    ];

    return (
        <div className="status-bar-container">
            <div className="status-bar-header">
                <h3 className="status-title">
                    <span className="status-title-icon">📊</span>
                    System Status
                </h3>
                <div className="status-user-info">
                    <span>Welcome, {user?.email}</span>
                    <button 
                        onClick={handleLogout} 
                        className="logout-btn"
                        title="Sign out"
                    >
                        🚪 Logout
                    </button>
                </div>
                <div className="status-timestamp">
                    Last updated: {new Date().toLocaleTimeString()}
                </div>
            </div>
            
            <div className="status-grid">
                {statusItems.map((item, index) => (
                    <div 
                        key={item.label}
                        className={`status-card status-${item.status}`}
                        style={{ animationDelay: `${index * 0.1}s` }}
                    >
                        <div className="status-card-header">
                            <div className="status-icon">
                                {item.icon}
                                {item.pulse && <div className="pulse-ring"></div>}
                            </div>
                            <div className="status-info">
                                <div className="status-label">{item.label}</div>
                                <div className="status-description">{item.description}</div>
                            </div>
                        </div>
                        
                        <div className="status-value-container">
                            <div className={`status-value status-value-${item.status}`}>
                                {item.value}
                            </div>
                            <div className={`status-indicator-dot status-dot-${item.status}`}>
                                <div className="dot-inner"></div>
                            </div>
                        </div>
                        
                        <div className="status-progress-line"></div>
                    </div>
                ))}
            </div>

            {/* Overall Health Indicator */}
            <div className="health-indicator">
                <div className="health-label">System Health</div>
                <div className={`health-status ${
                    isOnline && serviceWorkerActive && stats.pendingSyncCount === 0 
                        ? 'health-excellent' 
                        : isOnline && serviceWorkerActive 
                        ? 'health-good' 
                        : 'health-warning'
                }`}>
                    {isOnline && serviceWorkerActive && stats.pendingSyncCount === 0 
                        ? '🟢 Excellent' 
                        : isOnline && serviceWorkerActive 
                        ? '🟡 Good' 
                        : '🔴 Needs Attention'}
                </div>
            </div>
        </div>
    );
};

export default StatusBar;