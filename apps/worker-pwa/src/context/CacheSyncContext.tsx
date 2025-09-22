/**
 * CacheSyncContext - React context for managing cache synchronization
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { CacheSyncService } from '../services/CacheSyncService';
import { BackgroundSyncService } from '../services/BackgroundSyncService';
import { useAuth } from './AuthContext';

interface CacheSyncContextType {
  isOnline: boolean;
  isSyncing: boolean;
  lastSyncTime: number | null;
  syncError: string | null;
  forceSyncNow: () => Promise<void>;
  getSyncStatus: () => any;
}

const CacheSyncContext = createContext<CacheSyncContextType | null>(null);

interface CacheSyncProviderProps {
  children: ReactNode;
}

export function CacheSyncProvider({ children }: CacheSyncProviderProps) {
  const { isAuthenticated, organization } = useAuth();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const cacheSyncService = CacheSyncService.getInstance();
  const backgroundSyncService = BackgroundSyncService.getInstance();

  // Initialize services when authenticated
  useEffect(() => {
    if (isAuthenticated && organization?.id) {
      console.log('[CacheSyncProvider] Initializing cache sync for organization:', organization.id);
      
      // Initialize cache sync service
      cacheSyncService.initialize();
      
      // Queue initial sync
      cacheSyncService.queueSync(organization.id);
      
      // Configure and start background sync if supported
      if (backgroundSyncService.isAvailable()) {
        backgroundSyncService.configure({
          enabled: true,
          intervalMinutes: 10,
          maxRetries: 3,
          organizationId: organization.id
        });
        
        backgroundSyncService.startBackgroundSync(organization.id);
        
        // Request periodic sync permission
        backgroundSyncService.requestPeriodicSync().then(granted => {
          console.log('[CacheSyncProvider] Periodic background sync permission:', granted);
        });
      }
    }

    return () => {
      if (isAuthenticated) {
        backgroundSyncService.stopBackgroundSync();
      }
    };
  }, [isAuthenticated, organization?.id]);

  // Listen for network status changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncError(null);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Listen for background sync events
  useEffect(() => {
    const handleBackgroundSync = (event: CustomEvent) => {
      const { type, payload } = event.detail;
      
      switch (type) {
        case 'cache_updated':
          setLastSyncTime(Date.now());
          setIsSyncing(false);
          setSyncError(null);
          console.log('[CacheSyncProvider] Cache updated via background sync:', payload);
          break;
        
        case 'sync_error':
          setIsSyncing(false);
          setSyncError(payload.error || 'Sync failed');
          console.error('[CacheSyncProvider] Background sync error:', payload);
          break;
      }
    };

    backgroundSyncService.addEventListener(handleBackgroundSync);

    return () => {
      backgroundSyncService.removeEventListener(handleBackgroundSync);
    };
  }, []);

  // Load last sync time from storage
  useEffect(() => {
    if (organization?.id) {
      const syncStatus = cacheSyncService.getSyncStatus(organization.id);
      if (syncStatus) {
        setLastSyncTime(syncStatus.lastSyncTime);
      }
    }
  }, [organization?.id]);

  const forceSyncNow = useCallback(async () => {
    if (!organization?.id || isSyncing) return;

    setIsSyncing(true);
    setSyncError(null);

    try {
      const result = await cacheSyncService.forceSyncCurrent();
      
      if (result.success) {
        setLastSyncTime(Date.now());
        console.log('[CacheSyncProvider] Force sync completed:', result.itemsUpdated);
      } else {
        setSyncError(result.error || 'Sync failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setSyncError(errorMessage);
      console.error('[CacheSyncProvider] Force sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [organization?.id, isSyncing]);

  const getSyncStatus = useCallback(() => {
    if (!organization?.id) return null;
    return cacheSyncService.getSyncStatus(organization.id);
  }, [organization?.id]);

  const contextValue: CacheSyncContextType = {
    isOnline,
    isSyncing,
    lastSyncTime,
    syncError,
    forceSyncNow,
    getSyncStatus
  };

  return (
    <CacheSyncContext.Provider value={contextValue}>
      {children}
    </CacheSyncContext.Provider>
  );
}

export function useCacheSync(): CacheSyncContextType {
  const context = useContext(CacheSyncContext);
  if (!context) {
    throw new Error('useCacheSync must be used within a CacheSyncProvider');
  }
  return context;
}

export default CacheSyncProvider;