import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { syncToServer as syncToServerService } from '../services/syncService';
// Import the dbService functions
import {
  storeVerificationResult as storeInDb,
  getAllVerifications as getAllFromDb,
  getUnsyncedVerifications as getUnsyncedFromDb,
  markAsSynced as markAsSyncedInDb,
  clearAllData as clearAllFromDb
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
    storeVerificationResult: (jsonData: any) => Promise<number | undefined>;
    getAllVerifications: () => Promise<any[]>;
    getUnsyncedVerifications: () => Promise<any[]>;
    syncToServer: () => Promise<any>;
    clearAllData: () => Promise<void>;
    exportData: () => Promise<void>;
    clearPendingSync: () => Promise<void>;
};

const defaultContextValue: VCStorageContextValue = {
  isOnline: false,
  serviceWorkerActive: false,
  stats: { totalStored: 0, pendingSyncCount: 0, syncedCount: 0, failedCount: 0 },
  historicalStats: [],
  logs: [],
    storeVerificationResult: async (_json: any) => undefined,
    getAllVerifications: async () => [],
    getUnsyncedVerifications: async () => [],
    syncToServer: async () => ({}),
    clearAllData: async () => {},
    exportData: async () => {},
    clearPendingSync: async () => {}
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

    // Initialize (no explicit initDB needed; dbService opens lazily)
    useEffect(() => {
        const loadData = async () => {
            await updateStats(); // Initial stats load
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

        // Map recent entries to the UI LogItem shape used by StorageLogs
        const recentLogs: LogItem[] = all
            .slice(-50) // keep a larger recent window; pagination will handle display
            .reverse()
            .map((rec: any, idx: number) => ({
                id: typeof rec.sno === 'number' ? rec.sno : idx + 1,
                status: rec.verification_status === 'SUCCESS' ? 'success' : 'failure',
                synced: !!rec.synced,
                timestamp: rec.verified_at ? Date.parse(rec.verified_at) : Date.now(),
                hash: rec.vc_hash || '-',
            }));

        setLogs(recentLogs);
    };

    useEffect(() => {
        const interval = setInterval(updateStats, 5000);
        return () => clearInterval(interval);
    }, []); // REMOVED: db from dependency array

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

        // Refresh stats quickly after write
        updateStats().catch(() => {});

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
        storeVerificationResult,
        getAllVerifications,
        getUnsyncedVerifications,
        syncToServer,
        clearAllData,
        exportData,
        clearPendingSync
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