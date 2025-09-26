/**
 * NetworkService - Monitors network connectivity and triggers cache synchronization
 */
import { getWorkerApiUrl } from "@inji-offline-verify/shared-auth"; 

export interface NetworkStatusListener {
  onOnline: () => void;
  onOffline: () => void;
}

export class NetworkService {
  private static instance: NetworkService;
  private listeners: Set<NetworkStatusListener> = new Set();
  private isOnline: boolean;
  private lastOnlineTime: number = 0;

  private constructor() {
    this.isOnline = navigator.onLine;
    this.setupEventListeners();
  }

  public static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService();
    }
    return NetworkService.instance;
  }

  private setupEventListeners(): void {
    window.addEventListener('online', this.handleOnline.bind(this));
    window.addEventListener('offline', this.handleOffline.bind(this));
    
    // Also check connectivity periodically to catch cases where
    // navigator.onLine might not update properly
    setInterval(() => {
      this.checkConnectivity();
    }, 30000); // Check every 30 seconds
  }

  private async checkConnectivity(): Promise<void> {
    // Only check connectivity if navigator.onLine suggests we might be online
    // This prevents unnecessary API calls when we're definitely offline
    if (!navigator.onLine) {
      const wasOnline = this.isOnline;
      this.isOnline = false;
      
      if (wasOnline) {
        this.handleOffline();
      }
      return;
    }

    try {
      // Try to fetch a small resource to verify actual connectivity
      const response = await fetch(getWorkerApiUrl('/health/'), {
        method: 'GET',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });
      
      const wasOnline = this.isOnline;
      this.isOnline = response.ok;
      
      if (!wasOnline && this.isOnline) {
        this.handleOnline();
      } else if (wasOnline && !this.isOnline) {
        this.handleOffline();
      }
    } catch (error) {
      const wasOnline = this.isOnline;
      this.isOnline = false;
      
      if (wasOnline) {
        this.handleOffline();
      }
    }
  }

  private handleOnline(): void {
    const previouslyOffline = !this.isOnline;
    this.isOnline = true;
    this.lastOnlineTime = Date.now();
    
    console.log('[NetworkService] Network connection detected');
    
    if (previouslyOffline) {
      // Notify all listeners about the online status
      this.listeners.forEach(listener => {
        try {
          listener.onOnline();
        } catch (error) {
          console.error('[NetworkService] Error in onOnline listener:', error);
        }
      });
    }
  }

  private handleOffline(): void {
    const previouslyOnline = this.isOnline;
    this.isOnline = false;
    
    console.log('[NetworkService] Network connection lost');
    
    if (previouslyOnline) {
      // Notify all listeners about the offline status
      this.listeners.forEach(listener => {
        try {
          listener.onOffline();
        } catch (error) {
          console.error('[NetworkService] Error in onOffline listener:', error);
        }
      });
    }
  }

  public addListener(listener: NetworkStatusListener): void {
    this.listeners.add(listener);
  }

  public removeListener(listener: NetworkStatusListener): void {
    this.listeners.delete(listener);
  }

  public getIsOnline(): boolean {
    return this.isOnline;
  }

  public getLastOnlineTime(): number {
    return this.lastOnlineTime;
  }

  /**
   * Check if enough time has passed since last sync to warrant a new one
   */
  public shouldSync(lastSyncTime: number, minIntervalMs: number = 5 * 60 * 1000): boolean {
    const now = Date.now();
    return (now - lastSyncTime) > minIntervalMs;
  }
}