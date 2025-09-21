import { useState, useEffect } from 'react';
import { SDKCacheManager } from '@mosip/react-inji-verify-sdk';
import { WorkerCacheService } from '../services/WorkerCacheService';

interface CacheStatus {
  isReady: boolean;
  publicKeysCount: number;
  contextsCount: number;
  lastPrimed?: string;
  error?: string;
}

export function useSDKCache() {
  const [cacheStatus, setCacheStatus] = useState<CacheStatus>({
    isReady: false,
    publicKeysCount: 0,
    contextsCount: 0,
  });

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkCacheStatus();
  }, []);

  const checkCacheStatus = async () => {
    try {
      const stats = WorkerCacheService.getCacheStats();
      setCacheStatus({
        isReady: true, // Determine based on actual cache content
        publicKeysCount: stats.publicKeysCount || 0,
        contextsCount: stats.contextsCount || 0,
        lastPrimed: stats.lastPrimed,
      });
    } catch (error) {
      setCacheStatus(prev => ({
        ...prev,
        isReady: false,
        error: error instanceof Error ? error.message : 'Cache check failed',
      }));
    }
  };

  const primeFromServer = async (serverBundle: any) => {
    setIsLoading(true);
    try {
      await WorkerCacheService.primeFromServer(serverBundle);
      await checkCacheStatus();
    } catch (error) {
      setCacheStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to prime cache',
      }));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const primeFromVC = async (vcEnvelope: any) => {
    setIsLoading(true);
    try {
      const result = await WorkerCacheService.primeFromVC(vcEnvelope);
      await checkCacheStatus();
      return result;
    } catch (error) {
      setCacheStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to prime from VC',
      }));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const clearCache = async () => {
    setIsLoading(true);
    try {
      await WorkerCacheService.clearCache();
      await checkCacheStatus();
    } catch (error) {
      setCacheStatus(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to clear cache',
      }));
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    cacheStatus,
    isLoading,
    primeFromServer,
    primeFromVC,
    clearCache,
    refreshStatus: checkCacheStatus,
  };
}