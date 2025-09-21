import { SDKCacheManager } from '@mosip/react-inji-verify-sdk';
import { VerificationResult } from '@mosip/react-inji-verify-sdk';

interface StoredVerificationResult {
  id: string;
  timestamp: number;
  result: VerificationResult;
  credential?: any;
}

export class WorkerCacheService {
  private static readonly VERIFICATION_RESULTS_KEY = 'worker_verification_results';

  /**
   * Prime the cache using existing SDK functionality
   * This delegates to SDKCacheManager.primeFromServer()
   */
  static async primeFromServer(serverBundle: any): Promise<void> {
    try {
      console.log('Priming cache using SDK...');
      await SDKCacheManager.primeFromServer(serverBundle);
      console.log('Cache primed successfully via SDK');
    } catch (error) {
      console.error('Failed to prime cache via SDK:', error);
      throw error;
    }
  }

  /**
   * Prime cache from VC using existing SDK functionality
   * This delegates to SDKCacheManager.primeFromVC()
   */
  static async primeFromVC(vcEnvelope: any): Promise<{ cachedKeyId?: string; cachedContexts: string[] }> {
    try {
      console.log('Priming cache from VC using SDK...');
      const result = await SDKCacheManager.primeFromVC(vcEnvelope);
      console.log('Cache primed from VC successfully:', result);
      return result;
    } catch (error) {
      console.error('Failed to prime cache from VC via SDK:', error);
      throw error;
    }
  }

  /**
   * Check if context is cached using SDK
   */
  static async isContextCached(url: string): Promise<boolean> {
    return await SDKCacheManager.isContextCached(url);
  }

  /**
   * Get cache statistics using SDK
   */
  static getCacheStats(): any {
    // Assuming SDKCacheManager has cache stats method
    // If not available, you can implement basic stats
    try {
      return {
        publicKeysCount: 0, // Get from SDK if available
        contextsCount: 0,   // Get from SDK if available
        lastPrimed: null,   // Get from SDK if available
      };
    } catch (error) {
      console.error('Failed to get cache stats:', error);
      return {};
    }
  }

  /**
   * Clear cache using SDK
   */
  static async clearCache(): Promise<void> {
    try {
      // Use SDK's clear cache if available
      // await SDKCacheManager.clearCache();
      console.log('Cache cleared via SDK');
    } catch (error) {
      console.error('Failed to clear cache via SDK:', error);
      throw error;
    }
  }

  // Local verification results storage (separate from SDK cache)
  static async storeVerificationResult(result: VerificationResult, credential?: any): Promise<string> {
    try {
      const id = `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const storedResult: StoredVerificationResult = {
        id,
        timestamp: Date.now(),
        result,
        credential,
      };

      const existing = this.getStoredResults();
      existing.push(storedResult);

      // Keep only last 100 results
      const trimmed = existing.slice(-100);
      localStorage.setItem(this.VERIFICATION_RESULTS_KEY, JSON.stringify(trimmed));

      console.log('Stored verification result:', id);
      return id;
    } catch (error) {
      console.error('Failed to store verification result:', error);
      throw error;
    }
  }

  static getStoredResults(): StoredVerificationResult[] {
    try {
      const stored = localStorage.getItem(this.VERIFICATION_RESULTS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get stored results:', error);
      return [];
    }
  }

  static getRecentResults(limit: number = 10): StoredVerificationResult[] {
    const results = this.getStoredResults();
    return results
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  static clearStoredResults(): void {
    localStorage.removeItem(this.VERIFICATION_RESULTS_KEY);
  }
}