import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { syncToServer as syncToServerService } from '../services/syncService';

type Stats = { totalStored: number; pendingSyncCount: number; syncedCount: number; failedCount: number };
type LogItem = any;

type VCStorageContextValue = {
    isOnline: boolean;
    serviceWorkerActive: boolean;
    stats: Stats;
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

export const VCStorageProvider = (props: { children?: ReactNode | null }) => {
    const { children = null } = props || {};
    const [db, setDb] = useState<IDBDatabase | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [stats, setStats] = useState<Stats>({
        totalStored: 0,
        pendingSyncCount: 0,
        syncedCount: 0,
        failedCount: 0
    });
    const [logs, setLogs] = useState<LogItem[]>([]);
    const [serviceWorkerActive, setServiceWorkerActive] = useState(false);

    // Constants
    const DB_NAME = 'VCVerifierDB';
    const DB_VERSION = 1;
    const STORE_NAME = 'verifications';
    // Sync endpoint is resolved in syncService via saved base URL and includes auth headers

    // Initialize IndexedDB
    useEffect(() => {
        const initDB = async () => {
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onerror = () => {
                    console.error('IndexedDB error:', request.error);
                    reject(request.error);
                };

                request.onsuccess = (event) => {
                    const database = (event.target as IDBOpenDBRequest).result as IDBDatabase;
                    setDb(database);
                    console.log('IndexedDB initialized successfully');
                    resolve(database);
                };

                request.onupgradeneeded = (event) => {
                    const database = (event.target as IDBOpenDBRequest).result as IDBDatabase;
                    
                    // Create object store if it doesn't exist
                    if (!database.objectStoreNames.contains(STORE_NAME)) {
                        const objectStore = database.createObjectStore(STORE_NAME, {
                            keyPath: 'id',
                            autoIncrement: true
                        });
                        
                        // Create indexes for querying
                        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                        objectStore.createIndex('synced', 'synced', { unique: false });
                        objectStore.createIndex('status', 'status', { unique: false });
                        objectStore.createIndex('hash', 'hash', { unique: false });
                        
                        console.log('Object store created with indexes');
                    }
                };
            });
        };

        initDB();
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
    }, []);

    // Update UI data periodically
    useEffect(() => {
        const updateStats = async () => {
            if (db) {
                const all = await getAllVerifications();
                const unsynced = await getUnsyncedVerifications();
                
                setStats({
                    totalStored: all.length,
                    pendingSyncCount: unsynced.length,
                    syncedCount: all.filter(v => v.synced).length,
                    failedCount: all.filter(v => v.status === 'failure').length
                });

                setLogs(all.slice(-10).reverse());
            }
        };

        updateStats();
        const interval = setInterval(updateStats, 5000);
        
        return () => clearInterval(interval);
    }, [db]);

    // Core storage functions
    const storeVerificationResult = async (jsonData: any): Promise<number | undefined> => {
        if (!db) return;

        return new Promise<number>((resolve, reject) => {
            const transaction = db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            // Prepare data for storage
            const dataToStore = {
                ...jsonData,
                timestamp: new Date().toISOString(),
                synced: false,
                syncAttempts: 0,
                hash: generateHash(JSON.stringify(jsonData)),
                deviceId: getDeviceId()
            };
            
            const request = store.add(dataToStore);
            
            request.onsuccess = () => {
                console.log('Data stored successfully with ID:', (request as any).result);
                
                // If online, trigger an immediate sync (fire-and-forget) to avoid delays
                if (navigator.onLine) {
                    // Try immediate sync; background sync stays as a fallback
                    try { void syncToServer(); } catch {}
                    registerBackgroundSync();
                }
                resolve((request as any).result as number);
            };
            
            request.onerror = () => {
                console.error('Failed to store data:', (request as any).error);
                reject((request as any).error);
            };
        });
    };

    // Get all stored verifications
    const getAllVerifications = async (): Promise<any[]> => {
        if (!db) return [];
        
        return new Promise<any[]>((resolve, reject) => {
            const transaction = db!.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            
            request.onsuccess = () => resolve((request as any).result);
            request.onerror = () => reject((request as any).error);
        });
    };

    // Get only unsynced verifications
    const getUnsyncedVerifications = async (): Promise<any[]> => {
        if (!db) return [];
        
        return new Promise<any[]>((resolve, reject) => {
            const transaction = db!.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            
            request.onsuccess = () => {
                const allItems = (request as any).result as any[];
                const unsyncedItems = allItems.filter((item: any) => !item.synced);
                resolve(unsyncedItems);
            };
            request.onerror = () => reject((request as any).error);
        });
    };

    // Mark items as synced
    const markAsSynced = async (ids: number[]) => {
        if (!db) return;
        
    const transaction = db!.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        for (const id of ids) {
            const request = store.get(id);
            
            request.onsuccess = () => {
                const data = request.result;
                if (data) {
                    data.synced = true;
                    data.syncedAt = new Date().toISOString();
                    store.put(data);
                }
            };
        }
        
    return new Promise<void>((resolve) => {
            transaction.oncomplete = () => {
                console.log('Marked as synced:', ids);
                resolve();
            };
        });
    };

    // Sync functionality
    const syncToServer = async () => {
        // Delegate to shared sync service which handles auth, payload shape, and retries
        const result = await syncToServerService();
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
        if (!db) return;
        
        return new Promise<void>((resolve, reject) => {
            const transaction = db!.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();
            
            request.onsuccess = () => {
                console.log('All data cleared');
                resolve();
            };
            
            request.onerror = () => reject((request as any).error);
        });
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
        await markAsSynced(unsynced.map(item => item.id));
    };

    // Utility function for generating hash
    const generateHash = (data: string) => {
        // Simple hash function for demo (replace with crypto.subtle.digest in production)
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    };

    // Utility function for getting device ID
    const getDeviceId = () => {
        let deviceId = localStorage.getItem('deviceId');
        if (!deviceId) {
            deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('deviceId', deviceId);
        }
        return deviceId;
    };

    // Provide value to context consumers
    const contextValue = {
        isOnline,
        serviceWorkerActive,
        stats,
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