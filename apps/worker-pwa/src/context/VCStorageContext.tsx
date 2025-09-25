import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { syncToServer as syncToServerService } from '../services/syncService';
import { 
  fetchHistoricalLogsWithCache, 
  convertHistoricalLogToVerificationRecord,
  clearHistoricalLogsCache 
} from '../services/historicalLogsService';
// Import the dbService functions
import {
  storeVerificationResult as storeInDb,
  getAllVerifications as getAllFromDb,
  getUnsyncedVerifications as getUnsyncedFromDb,
  markAsSynced as markAsSyncedInDb,
  clearAllData as clearAllFromDb,
  storeHistoricalVerifications as storeHistoricalInDb
} from '../services/dbService';
import type { VerificationRecord } from '../services/dbService';

type Stats = { totalStored: number; pendingSyncCount: number; syncedCount: number; failedCount: number };
type HistoricalStats = {
    timestamp: number;
    totalStored: number;
    syncedCount: number;
    failedCount: number;
    pendingSyncCount: number;
};
type LogItem = {
    id: number;
    status: 'success' | 'failure';
    synced: boolean;
    timestamp: number;
    hash: string;
};

type VCStorageContextValue = {
    isOnline: boolean;
    serviceWorkerActive: boolean;
    stats: Stats;
    historicalStats: HistoricalStats[];
    logs: LogItem[];
    isLoadingHistoricalLogs: boolean;
    historicalLogsDays: number;
    setHistoricalLogsDays: (days: number) => void;
    storeVerificationResult: (jsonData: any) => Promise<number | undefined>;
    getAllVerifications: () => Promise<any[]>;
    getUnsyncedVerifications: () => Promise<any[]>;
    syncToServer: () => Promise<any>;
    clearAllData: () => Promise<void>;
    exportData: () => Promise<void>;
    clearPendingSync: () => Promise<void>;
    refreshHistoricalLogs: () => Promise<void>;
};

const defaultContextValue: VCStorageContextValue = {
  isOnline: false,
  serviceWorkerActive: false,
  stats: { totalStored: 0, pendingSyncCount: 0, syncedCount: 0, failedCount: 0 },
  historicalStats: [],
  logs: [],
  isLoadingHistoricalLogs: false,
  historicalLogsDays: 3,
  setHistoricalLogsDays: () => {},
    storeVerificationResult: async (_json: any) => undefined,
    getAllVerifications: async () => [],
    getUnsyncedVerifications: async () => [],
    syncToServer: async () => ({}),
    clearAllData: async () => {},
    exportData: async () => {},
    clearPendingSync: async () => {},
    refreshHistoricalLogs: async () => {}
};
const VCStorageContext = createContext<VCStorageContextValue>(defaultContextValue);

// Small uuid generator (no extra deps)
function genUuid(): string {
  // RFC4122 v4-ish using crypto.getRandomValues
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // Set version and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  const hex = Array.from(bytes, toHex).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

export const VCStorageProvider = (props: { children?: ReactNode | null }) => {
    const { children = null } = props || {};
    // REMOVED: const [db, setDb] = useState<IDBDatabase | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [stats, setStats] = useState<Stats>({
        totalStored: 0,
        pendingSyncCount: 0,
        syncedCount: 0,
        failedCount: 0
    });
    const [historicalStats, setHistoricalStats] = useState<HistoricalStats[]>([]);
    const [logs, setLogs] = useState<LogItem[]>([]);
    const [serviceWorkerActive, setServiceWorkerActive] = useState(false);
    
    // New state for historical logs
    const [isLoadingHistoricalLogs, setIsLoadingHistoricalLogs] = useState(false);
    const [historicalLogsDays, setHistoricalLogsDaysState] = useState(() => {
        try {
            const saved = localStorage.getItem('historicalLogsDays');
            return saved ? parseInt(saved, 10) : 3;
        } catch {
            return 3;
        }
    });

    // Function to update historical logs days setting
    const setHistoricalLogsDays = (days: number) => {
        const validDays = Math.max(1, Math.min(14, days)); // Ensure between 1-14 days
        setHistoricalLogsDaysState(validDays);
        try {
            localStorage.setItem('historicalLogsDays', validDays.toString());
        } catch (error) {
            console.warn('Failed to save historical logs days setting:', error);
        }
        // Clear cache when days change and refresh logs
        clearHistoricalLogsCache();
        
        // If online, immediately refresh with new setting
        if (navigator.onLine) {
            refreshHistoricalLogs();
        } else {
            // If offline, just refresh from IndexedDB with current data
            loadHybridLogs();
        }
    };

    // Fetch and merge historical logs with local logs
    const loadHybridLogs = async () => {
        try {
            // Get local logs first (these are the most recent)
            const localLogs = await getAllFromDb();
            
            const localLogItems: LogItem[] = localLogs
                .slice(-50) // Keep reasonable recent window
                .reverse()
                .map((rec: any, idx: number) => ({
                    id: typeof rec.sno === 'number' ? rec.sno : idx + 1,
                    status: rec.verification_status === 'SUCCESS' ? 'success' : 'failure',
                    synced: !!rec.synced,
                    timestamp: rec.verified_at ? Date.parse(rec.verified_at) : Date.now(),
                    hash: rec.vc_hash || '-',
                }));
            
            // If offline, use only local logs from IndexedDB (includes previously cached historical logs)
            if (!navigator.onLine) {
                console.log('Offline: Using IndexedDB logs only (includes cached historical data)');
                setLogs(localLogItems);
                return;
            }
            
            // Fetch historical logs from server
            setIsLoadingHistoricalLogs(true);
            const historicalResponse = await fetchHistoricalLogsWithCache({
                days: historicalLogsDays,
                pageSize: 200 // Fetch more historical data
            });
            
            if (historicalResponse.success && historicalResponse.logs.length > 0) {
                // Convert historical logs to VerificationRecord format and store in IndexedDB
                const historicalRecords = historicalResponse.logs.map(log => 
                    convertHistoricalLogToVerificationRecord(log)
                );
                
                // Store historical logs in IndexedDB for offline access
                try {
                    console.log('Storing historical logs in IndexedDB:', historicalRecords.length, 'records');
                    await storeHistoricalInDb(historicalRecords);
                    console.log('Historical logs successfully cached in IndexedDB for offline access');
                } catch (error) {
                    console.warn('Failed to cache historical logs in IndexedDB:', error);
                }
                
                // Refresh local logs after storing historical data
                const updatedLocalLogs = await getAllFromDb();
                const updatedLogItems: LogItem[] = updatedLocalLogs
                    .slice(-200) // Increase window to include historical logs
                    .reverse()
                    .map((rec: any, idx: number) => ({
                        id: typeof rec.sno === 'number' ? rec.sno : idx + 1,
                        status: rec.verification_status === 'SUCCESS' ? 'success' : 'failure',
                        synced: !!rec.synced,
                        timestamp: rec.verified_at ? Date.parse(rec.verified_at) : Date.now(),
                        hash: rec.vc_hash || '-',
                    }));
                
                setLogs(updatedLogItems);
            } else {
                console.warn('Failed to fetch historical logs:', historicalResponse.error);
                // Fall back to local logs only
                setLogs(localLogItems);
            }
        } catch (error) {
            console.error('Error loading hybrid logs:', error);
            // Fall back to local logs
            const localLogs = await getAllFromDb();
            const localLogItems: LogItem[] = localLogs
                .slice(-50)
                .reverse()
                .map((rec: any, idx: number) => ({
                    id: typeof rec.sno === 'number' ? rec.sno : idx + 1,
                    status: rec.verification_status === 'SUCCESS' ? 'success' : 'failure',
                    synced: !!rec.synced,
                    timestamp: rec.verified_at ? Date.parse(rec.verified_at) : Date.now(),
                    hash: rec.vc_hash || '-',
                }));
            setLogs(localLogItems);
        } finally {
            setIsLoadingHistoricalLogs(false);
        }
    };
    
    // Helper function to merge and deduplicate logs
    // Note: This function is no longer used as we store historical logs directly in IndexedDB
    // const mergeLogs = (localLogs: LogItem[], historicalLogs: LogItem[]): LogItem[] => {
    //     // Implementation moved to IndexedDB storage approach
    // };
    
    // Public function to refresh historical logs
    const refreshHistoricalLogs = async () => {
        await loadHybridLogs();
    };

    // Initialize (no explicit initDB needed; dbService opens lazily)
    useEffect(() => {
        const loadData = async () => {
            await updateStats(); // Initial stats load
            await loadHybridLogs(); // Load hybrid logs
        };
        loadData();

        // Load historical stats from localStorage
        const loadHistoricalStats = () => {
            try {
                const stored = localStorage.getItem('historicalStats');
                if (stored) {
                    const parsed = JSON.parse(stored) as HistoricalStats[];
                    setHistoricalStats(parsed);
                }
            } catch (error) {
                console.warn('Failed to load historical stats:', error);
                setHistoricalStats([]);
            }
        };

        loadHistoricalStats();
    }, []);

    // Track service worker state and listen for sync triggers
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', event => {
                if (event.data && event.data.type === 'SYNC_REQUESTED') {
                    syncToServer();
                }
            });
            setServiceWorkerActive(true);
        }
    }, []);

    // Online/offline detection
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            console.log('Connection restored');
            syncToServer();
        };

        const handleOffline = () => {
            setIsOnline(false);
            console.log('Connection lost');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Set up periodic sync (every 30 seconds if online)
        const syncInterval = setInterval(() => {
            if (navigator.onLine) {
                syncToServer();
            }
        }, 30000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(syncInterval);
        };
    }, []); // REMOVED: db from dependency array

    // Update UI data periodically
    const updateStats = async () => {
        const all = await getAllFromDb();
        const unsynced = await getUnsyncedFromDb();

        const newStats = {
            totalStored: all.length,
            pendingSyncCount: unsynced.length,
            // Use verification_status from dbService schema
            syncedCount: all.filter((v: any) => v.synced && v.verification_status === 'SUCCESS').length,
            failedCount: all.filter((v: any) => v.verification_status === 'FAILED').length
        };

        setStats(newStats);

        // Update historical stats (keep last 30 data points)
        const now = Date.now();
        const existingHistorical = JSON.parse(localStorage.getItem('historicalStats') || '[]') as HistoricalStats[];

        const lastEntry = existingHistorical[existingHistorical.length - 1];
        const shouldAddPoint = !lastEntry ||
            (now - lastEntry.timestamp > 3600000) ||
            (JSON.stringify(newStats) !== JSON.stringify({
                totalStored: lastEntry.totalStored,
                syncedCount: lastEntry.syncedCount,
                failedCount: lastEntry.failedCount,
                pendingSyncCount: lastEntry.pendingSyncCount
            }));

        if (shouldAddPoint) {
            const newHistoricalPoint: HistoricalStats = {
                timestamp: now,
                ...newStats
            };

            const updatedHistorical = [...existingHistorical, newHistoricalPoint].slice(-30);
            localStorage.setItem('historicalStats', JSON.stringify(updatedHistorical));
            setHistoricalStats(updatedHistorical);
        } else {
            setHistoricalStats(existingHistorical);
        }

        // Note: Logs are now handled by loadHybridLogs function
        // This function only updates stats, not logs
    };

    useEffect(() => {
        const interval = setInterval(() => {
            updateStats(); // Update stats every 5 seconds
        }, 5000);
        
        // Refresh hybrid logs every 30 seconds when online
        const logsInterval = setInterval(() => {
            if (navigator.onLine && !isLoadingHistoricalLogs) {
                loadHybridLogs();
            }
        }, 30000);
        
        return () => {
            clearInterval(interval);
            clearInterval(logsInterval);
        };
    }, [isLoadingHistoricalLogs, historicalLogsDays]); // Re-setup intervals when loading state or days change

    // Core storage functions now use dbService
    const storeVerificationResult = async (jsonData: any): Promise<number | undefined> => {
        // Normalize to dbService schema
        const rec: Omit<VerificationRecord, 'sno'> = {
            uuid: jsonData.uuid || jsonData.id || genUuid(),
            verified_at: jsonData.verified_at || new Date().toISOString(),
            synced: jsonData.synced ?? false,
            verification_status: jsonData.verification_status || (jsonData.verificationStatus === true ? 'SUCCESS' : 'FAILED'),
            vc_hash: jsonData.vc_hash ?? null,
            credential_subject: jsonData.credential_subject ?? null,
            error_message: jsonData.error_message ?? null
        };

        const storedId = await storeInDb(rec);

        // Refresh stats and logs quickly after write
        updateStats().catch(() => {});
        loadHybridLogs().catch(() => {}); // Refresh hybrid logs to show new entry

        // If online, trigger an immediate sync (fire-and-forget)
        if (navigator.onLine) {
            try { void syncToServer(); } catch {}
            registerBackgroundSync();
        }

        return storedId;
    };

    // Get all stored verifications
    const getAllVerifications = async (): Promise<any[]> => {
        return getAllFromDb();
    };

    // Get only unsynced verifications
    const getUnsyncedVerifications = async (): Promise<any[]> => {
        return getUnsyncedFromDb();
    };

    // Mark items as synced (expects uuids per dbService)
    const markAsSynced = async (uuids: string[]) => {
        await markAsSyncedInDb(uuids);
        console.log('Marked as synced:', uuids);
        updateStats().catch(() => {});
    };

    // Sync functionality
    const syncToServer = async () => {
        const result = await syncToServerService();
        // After sync attempt, refresh stats
        await updateStats();
        return result;
    };

    // Register background sync
    const registerBackgroundSync = async () => {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
            try {
        const registration = await navigator.serviceWorker.ready;
        await (registration as any).sync.register('sync-verifications');
                console.log('Background sync registered');
            } catch (error) {
                console.error('Background sync registration failed:', error);
            }
        }
    };

    // Clear all data
    const clearAllData = async () => {
        await clearAllFromDb();
        console.log('All data cleared');
        localStorage.removeItem('historicalStats');
        setHistoricalStats([]);
        clearHistoricalLogsCache(); // Clear historical logs cache
        setLogs([]); // Clear current logs display
    };

    // Export data
    const exportData = async () => {
        const all = await getAllVerifications();
        const dataStr = JSON.stringify(all, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `vc-data-${new Date().toISOString()}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    };

    // Clear pending sync
    const clearPendingSync = async () => {
        const unsynced = await getUnsyncedVerifications();
        await markAsSynced(unsynced.map((item: any) => item.uuid));
    };

    // (removed unused helpers generateHash/getDeviceId)

    // Provide value to context consumers
    const contextValue = {
        isOnline,
        serviceWorkerActive,
        stats,
        historicalStats,
        logs,
        isLoadingHistoricalLogs,
        historicalLogsDays,
        setHistoricalLogsDays,
        storeVerificationResult,
        getAllVerifications,
        getUnsyncedVerifications,
        syncToServer,
        clearAllData,
        exportData,
        clearPendingSync,
        refreshHistoricalLogs
    };

    // Guard: if no children passed, avoid runtime crash and still mount provider
    if (!children) {
        return (
            <VCStorageContext.Provider value={contextValue}>
                {null}
            </VCStorageContext.Provider>
        );
    }

    return (
        <VCStorageContext.Provider value={contextValue}>
            {children}
        </VCStorageContext.Provider>
    );
};

export const useVCStorage = () => useContext(VCStorageContext);
export { VCStorageContext };
export default VCStorageProvider;