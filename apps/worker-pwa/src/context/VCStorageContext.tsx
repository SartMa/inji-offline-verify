import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
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

type DailyStat = {
    date: string;
    totalStored: number;
    syncedCount: number;
    failedCount: number;
};

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

const MAX_METRIC_SAMPLES = 50;
const VERIFICATION_METRICS_KEY = 'vcMetrics:verificationMs';
const STORAGE_METRICS_KEY = 'vcMetrics:storageMs';

const sanitizeDurations = (values: unknown[]): number[] =>
    values
        .map((value) => (typeof value === 'number' ? value : Number(value)))
        .filter((value) => Number.isFinite(value) && value > 0)
        .slice(-MAX_METRIC_SAMPLES);

const loadDurations = (key: string): number[] => {
    if (typeof localStorage === 'undefined') {
        return [];
    }

    try {
        const raw = localStorage.getItem(key);
        if (!raw) {
            return [];
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return sanitizeDurations(parsed);
    } catch (error) {
        console.warn('Failed to load stored performance durations', { key, error });
        return [];
    }
};

const persistDurations = (key: string, values: number[]) => {
    if (typeof localStorage === 'undefined') {
        return;
    }

    try {
        localStorage.setItem(key, JSON.stringify(values.slice(-MAX_METRIC_SAMPLES)));
    } catch (error) {
        console.warn('Failed to persist performance durations', { key, error });
    }
};

type VCStorageContextValue = {
    isOnline: boolean;
    serviceWorkerActive: boolean;
    stats: Stats;
    historicalStats: HistoricalStats[];
    dailyStats: DailyStat[];
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
    avgVerificationMs: number | null;
    avgStorageWriteMs: number | null;
    recordVerificationDuration: (durationMs: number) => void;
};

const EMPTY_STATS: Stats = { totalStored: 0, pendingSyncCount: 0, syncedCount: 0, failedCount: 0 };

const defaultContextValue: VCStorageContextValue = {
  isOnline: false,
  serviceWorkerActive: false,
    stats: EMPTY_STATS,
  historicalStats: [],
    dailyStats: [],
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
        refreshHistoricalLogs: async () => {},
        avgVerificationMs: null,
        avgStorageWriteMs: null,
        recordVerificationDuration: () => {}
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
    const { isAuthenticated, isLoading } = useAuth();
    const [isOnline, setIsOnline] = useState(false); // Start with false, will be updated by connectivity check
    const [stats, setStats] = useState<Stats>(() => ({ ...EMPTY_STATS }));
    const [historicalStats, setHistoricalStats] = useState<HistoricalStats[]>([]);
    const [logs, setLogs] = useState<LogItem[]>([]);
    const [dailyStats, setDailyStats] = useState<DailyStat[]>([]);
    const [serviceWorkerActive, setServiceWorkerActive] = useState(false);
    const [verificationDurations, setVerificationDurations] = useState<number[]>(() => loadDurations(VERIFICATION_METRICS_KEY));
    const [storageDurations, setStorageDurations] = useState<number[]>(() => loadDurations(STORAGE_METRICS_KEY));

    const recordVerificationDuration = useCallback((durationMs: number) => {
        if (!Number.isFinite(durationMs) || durationMs <= 0) {
            return;
        }

        setVerificationDurations(prev => {
            const next = [...prev, durationMs].slice(-MAX_METRIC_SAMPLES);
            persistDurations(VERIFICATION_METRICS_KEY, next);
            return next;
        });
    }, []);

    const recordStorageDuration = useCallback((durationMs: number) => {
        if (!Number.isFinite(durationMs) || durationMs <= 0) {
            return;
        }

        setStorageDurations(prev => {
            const next = [...prev, durationMs].slice(-MAX_METRIC_SAMPLES);
            persistDurations(STORAGE_METRICS_KEY, next);
            return next;
        });
    }, []);

    const avgVerificationMs = useMemo(() => {
        if (verificationDurations.length === 0) {
            return null;
        }
        const total = verificationDurations.reduce((sum, value) => sum + value, 0);
        return total / verificationDurations.length;
    }, [verificationDurations]);

    const avgStorageWriteMs = useMemo(() => {
        if (storageDurations.length === 0) {
            return null;
        }
        const total = storageDurations.reduce((sum, value) => sum + value, 0);
        return total / storageDurations.length;
    }, [storageDurations]);
    
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

    const convertRecordsToLogItems = (records: any[]): LogItem[] =>
        records.map((rec: any, idx: number) => ({
            id: typeof rec.sno === 'number' ? rec.sno : idx + 1,
            status: rec.verification_status === 'SUCCESS' ? 'success' : 'failure',
            synced: !!rec.synced,
            timestamp: rec.verified_at ? Date.parse(rec.verified_at) : Date.now(),
            hash: rec.vc_hash || '-',
        }));

    const processLogsForDailyStats = (logItems: LogItem[], days: number): DailyStat[] => {
        if (!days || days < 1) {
            return [];
        }

        const dailyData = new Map<string, { totalStored: number; syncedCount: number; failedCount: number }>();

        logItems.forEach(log => {
            const timestamp = Number.isFinite(log.timestamp) ? log.timestamp : Date.now();
            const date = new Date(timestamp);
            const dateString = date.toISOString().split('T')[0];

            if (!dailyData.has(dateString)) {
                dailyData.set(dateString, { totalStored: 0, syncedCount: 0, failedCount: 0 });
            }

            const day = dailyData.get(dateString)!;
            day.totalStored += 1;
            if (log.status === 'success') {
                day.syncedCount += 1;
            } else {
                day.failedCount += 1;
            }
        });

        const result: DailyStat[] = [];
        const today = new Date();
        for (let i = 0; i < days; i += 1) {
            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() - i);
            const dateString = targetDate.toISOString().split('T')[0];

            if (dailyData.has(dateString)) {
                const day = dailyData.get(dateString)!;
                result.push({ date: dateString, ...day });
            } else {
                result.push({ date: dateString, totalStored: 0, syncedCount: 0, failedCount: 0 });
            }
        }

        return result.reverse();
    };

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

        if (!isAuthenticated) {
            return;
        }

        // If online, immediately refresh with new setting
        if (navigator.onLine) {
            refreshHistoricalLogs();
        } else {
            // If offline, just refresh from IndexedDB with current data
            loadHybridLogs('historical-days-change-offline');
        }
    };

    // Fetch and merge historical logs with local logs
    const loadHybridLogs = async (reason: string = 'load-hybrid-logs') => {
        if (!isAuthenticated) {
            setLogs([]);
            setDailyStats([]);
            return;
        }
        const startTime = performance.now();
        const logPrefix = `[Performance] Hybrid logs refresh (${reason})`;
        console.log(`${logPrefix} started at`, new Date().toISOString());
        let finished = false;
        const finish = (detail: string) => {
            if (finished) return;
            finished = true;
            const durationMs = performance.now() - startTime;
            console.log(`${logPrefix} ${detail} in ${durationMs.toFixed(2)}ms`);
        };
        try {
            const localRecords = await getAllFromDb();
            const allLocalLogItems = convertRecordsToLogItems(localRecords);
            const latestLocalLogItems = allLocalLogItems.slice(-50).reverse();

            if (!navigator.onLine) {
                console.log('Offline: Using IndexedDB logs only (includes cached historical data)');
                setLogs(latestLocalLogItems);
                setDailyStats(processLogsForDailyStats(allLocalLogItems, historicalLogsDays));
                finish('completed using offline cache');
                return;
            }

            setIsLoadingHistoricalLogs(true);
            const historicalResponse = await fetchHistoricalLogsWithCache({
                days: historicalLogsDays,
                pageSize: 500,
            });

            if (historicalResponse.success && historicalResponse.logs.length > 0) {
                const historicalRecords = historicalResponse.logs.map(log => convertHistoricalLogToVerificationRecord(log));

                try {
                    console.log('Storing historical logs in IndexedDB:', historicalRecords.length, 'records');
                    await storeHistoricalInDb(historicalRecords);
                    console.log('Historical logs successfully cached in IndexedDB for offline access');
                } catch (error) {
                    console.warn('Failed to cache historical logs in IndexedDB:', error);
                }

                const updatedLocalRecords = await getAllFromDb();
                const updatedAllLogItems = convertRecordsToLogItems(updatedLocalRecords);
                const displayLogItems = updatedAllLogItems.slice(-200).reverse();
                setLogs(displayLogItems);
                setDailyStats(processLogsForDailyStats(updatedAllLogItems, historicalLogsDays));
                finish('completed with remote fetch');
            } else {
                console.warn('Failed to fetch historical logs:', historicalResponse.error);
                setLogs(latestLocalLogItems);
                setDailyStats(processLogsForDailyStats(allLocalLogItems, historicalLogsDays));
                finish('completed with local fallback after remote error');
            }
        } catch (error) {
            console.error('Error loading hybrid logs:', error);
            const fallbackRecords = await getAllFromDb();
            const fallbackAllLogItems = convertRecordsToLogItems(fallbackRecords);
            const fallbackDisplayItems = fallbackAllLogItems.slice(-50).reverse();
            setLogs(fallbackDisplayItems);
            setDailyStats(processLogsForDailyStats(fallbackAllLogItems, historicalLogsDays));
            finish('completed after error using fallback');
        } finally {
            setIsLoadingHistoricalLogs(false);
            finish('finalized');
        }
    };
    
    // Helper function to merge and deduplicate logs
    // Note: This function is no longer used as we store historical logs directly in IndexedDB
    // const mergeLogs = (localLogs: LogItem[], historicalLogs: LogItem[]): LogItem[] => {
    //     // Implementation moved to IndexedDB storage approach
    // };
    
    // Public function to refresh historical logs
    const refreshHistoricalLogs = async () => {
        if (!isAuthenticated) {
            return;
        }
        await loadHybridLogs('manual-refresh');
    };

    // Initialize (no explicit initDB needed; dbService opens lazily)
    useEffect(() => {
        if (isLoading) {
            return;
        }

        if (!isAuthenticated) {
            setStats({ ...EMPTY_STATS });
            setLogs([]);
            setDailyStats([]);
            setHistoricalStats([]);
            return;
        }

        const loadData = async () => {
            await updateStats(); // Initial stats load
            await loadHybridLogs('initial-load'); // Load hybrid logs
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
    }, [isAuthenticated, isLoading]);

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

    // Enhanced network connectivity detection
    const checkNetworkConnectivity = async (): Promise<boolean> => {
        try {
            // First check navigator.onLine for basic network interface status
            if (!navigator.onLine) {
                return false;
            }

            // Then do an actual network request to verify internet connectivity
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

            const response = await fetch('/healthz', {
                method: 'HEAD',
                cache: 'no-store',
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            return response.ok;
        } catch (error) {
            // Network request failed - we're offline or have connectivity issues
            return false;
        }
    };

    // Online/offline detection with enhanced network checking
    useEffect(() => {
        let connectivityCheckInterval: NodeJS.Timeout;

        const updateConnectionStatus = async () => {
            const isConnected = await checkNetworkConnectivity();
            const wasOnline = isOnline;

            setIsOnline(isConnected);

            if (isConnected && !wasOnline) {
                console.log('Connection restored');
                syncToServer();
            } else if (!isConnected && wasOnline) {
                console.log('Connection lost');
            }
        };

        const handleOnline = () => {
            console.log('Network interface online');
            // Verify actual connectivity
            updateConnectionStatus();
        };

        const handleOffline = () => {
            console.log('Network interface offline');
            setIsOnline(false);
        };

        // Initial connectivity check
        updateConnectionStatus();

        // Listen to browser network events
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Periodic connectivity verification (every 30 seconds)
        connectivityCheckInterval = setInterval(() => {
            updateConnectionStatus();
            
            // Also sync if we're online
            if (isOnline) {
                syncToServer();
            }
        }, 30000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (connectivityCheckInterval) {
                clearInterval(connectivityCheckInterval);
            }
        };
    }, []); // REMOVED: db from dependency array

    // Update UI data periodically
    const updateStats = async () => {
        if (!isAuthenticated) {
            setStats({ ...EMPTY_STATS });
            return;
        }
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
        if (!isAuthenticated) {
            return;
        }

        const interval = setInterval(() => {
            updateStats();
        }, 60000);
        
        // Refresh hybrid logs periodically when online to keep aggregates in sync
        const logsInterval = setInterval(() => {
            if (navigator.onLine && !isLoadingHistoricalLogs) {
                loadHybridLogs('periodic-refresh');
            }
        }, 300000);
        
        return () => {
            clearInterval(interval);
            clearInterval(logsInterval);
        };
    }, [isAuthenticated, isLoadingHistoricalLogs, historicalLogsDays]); // Re-setup intervals when loading state or days change

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

        const storeStart = performance.now();
        console.log('[Performance] Storing verification result started at', new Date().toISOString(), {
            uuid: rec.uuid,
            status: rec.verification_status
        });

        const storedId = await storeInDb(rec);

        const storeDuration = performance.now() - storeStart;
        console.log('[Performance] Verification result stored', `${storeDuration.toFixed(2)}ms`, {
            uuid: rec.uuid,
            storedId
        });
        recordStorageDuration(storeDuration);

        // Refresh stats and logs quickly after write
        updateStats().catch(() => {});
        loadHybridLogs('post-store-refresh').catch(() => {}); // Refresh hybrid logs to show new entry

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
        setDailyStats([]);
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
        dailyStats,
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
        refreshHistoricalLogs,
        avgVerificationMs,
        avgStorageWriteMs,
        recordVerificationDuration
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