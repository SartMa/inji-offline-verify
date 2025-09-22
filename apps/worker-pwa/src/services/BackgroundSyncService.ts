/**
 * BackgroundSyncService - Handles background synchronization using Service Worker
 * for efficient cache updates even when the app is in background
 */

export interface BackgroundSyncOptions {
  enabled: boolean;
  intervalMinutes: number;
  maxRetries: number;
  organizationId: string;
}

export class BackgroundSyncService {
  private static instance: BackgroundSyncService;
  private serviceWorker: ServiceWorker | null = null;
  private options: BackgroundSyncOptions = {
    enabled: true,
    intervalMinutes: 10,
    maxRetries: 3,
    organizationId: ''
  };

  private constructor() {
    this.initializeServiceWorker();
  }

  public static getInstance(): BackgroundSyncService {
    if (!BackgroundSyncService.instance) {
      BackgroundSyncService.instance = new BackgroundSyncService();
    }
    return BackgroundSyncService.instance;
  }

  private async initializeServiceWorker(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      console.warn('[BackgroundSyncService] Service Worker not supported');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      this.serviceWorker = registration.active;
      
      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
      
      console.log('[BackgroundSyncService] Service Worker initialized');
    } catch (error) {
      console.error('[BackgroundSyncService] Failed to initialize Service Worker:', error);
    }
  }

  private handleServiceWorkerMessage(event: MessageEvent): void {
    const { type, payload } = event.data;
    
    switch (type) {
      case 'SYNC_COMPLETE':
        console.log('[BackgroundSyncService] Background sync completed:', payload);
        // Notify main app that cache has been updated
        this.notifyMainApp('cache_updated', payload);
        break;
      
      case 'SYNC_ERROR':
        console.error('[BackgroundSyncService] Background sync failed:', payload);
        break;
      
      default:
        break;
    }
  }

  private notifyMainApp(type: string, payload: any): void {
    // Dispatch custom event to notify the main app
    window.dispatchEvent(new CustomEvent('background-sync', {
      detail: { type, payload }
    }));
  }

  /**
   * Configure background sync options
   */
  public configure(options: Partial<BackgroundSyncOptions>): void {
    this.options = { ...this.options, ...options };
    
    if (this.serviceWorker) {
      this.serviceWorker.postMessage({
        type: 'CONFIGURE_SYNC',
        payload: this.options
      });
    }
  }

  /**
   * Start background synchronization
   */
  public async startBackgroundSync(organizationId: string): Promise<void> {
    if (!this.serviceWorker) {
      console.warn('[BackgroundSyncService] Service Worker not available');
      return;
    }

    this.options.organizationId = organizationId;

    try {
      this.serviceWorker.postMessage({
        type: 'START_SYNC',
        payload: {
          organizationId,
          intervalMinutes: this.options.intervalMinutes
        }
      });
      
      console.log(`[BackgroundSyncService] Started background sync for organization ${organizationId}`);
    } catch (error) {
      console.error('[BackgroundSyncService] Failed to start background sync:', error);
    }
  }

  /**
   * Stop background synchronization
   */
  public async stopBackgroundSync(): Promise<void> {
    if (!this.serviceWorker) return;

    try {
      this.serviceWorker.postMessage({
        type: 'STOP_SYNC'
      });
      
      console.log('[BackgroundSyncService] Stopped background sync');
    } catch (error) {
      console.error('[BackgroundSyncService] Failed to stop background sync:', error);
    }
  }

  /**
   * Trigger immediate background sync
   */
  public async triggerSync(organizationId: string): Promise<void> {
    if (!this.serviceWorker) {
      console.warn('[BackgroundSyncService] Service Worker not available');
      return;
    }

    try {
      this.serviceWorker.postMessage({
        type: 'TRIGGER_SYNC',
        payload: { organizationId }
      });
      
      console.log(`[BackgroundSyncService] Triggered immediate sync for organization ${organizationId}`);
    } catch (error) {
      console.error('[BackgroundSyncService] Failed to trigger sync:', error);
    }
  }

  /**
   * Check if background sync is supported and enabled
   */
  public isAvailable(): boolean {
    return !!(
      'serviceWorker' in navigator &&
      'sync' in window.ServiceWorkerRegistration.prototype &&
      this.options.enabled
    );
  }

  /**
   * Get current sync status
   */
  public async getSyncStatus(): Promise<any> {
    if (!this.serviceWorker) return null;

    return new Promise((resolve) => {
      const channel = new MessageChannel();
      
      channel.port1.onmessage = (event) => {
        resolve(event.data.payload);
      };

      this.serviceWorker!.postMessage({
        type: 'GET_SYNC_STATUS'
      }, [channel.port2]);
    });
  }

  /**
   * Register for periodic background sync (requires user permission)
   */
  public async requestPeriodicSync(): Promise<boolean> {
    if (!('serviceWorker' in navigator) || !('periodicSync' in window.ServiceWorkerRegistration.prototype)) {
      console.warn('[BackgroundSyncService] Periodic Background Sync not supported');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' as any });
      
      if (status.state !== 'granted') {
        console.warn('[BackgroundSyncService] Periodic Background Sync permission not granted');
        return false;
      }

      // Register periodic sync
      await (registration as any).periodicSync.register('cache-sync', {
        minInterval: this.options.intervalMinutes * 60 * 1000 // Convert to milliseconds
      });

      console.log('[BackgroundSyncService] Registered periodic background sync');
      return true;
    } catch (error) {
      console.error('[BackgroundSyncService] Failed to register periodic sync:', error);
      return false;
    }
  }

  /**
   * Add event listener for background sync events
   */
  public addEventListener(callback: (event: CustomEvent) => void): void {
    window.addEventListener('background-sync', callback as EventListener);
  }

  /**
   * Remove event listener for background sync events
   */
  public removeEventListener(callback: (event: CustomEvent) => void): void {
    window.removeEventListener('background-sync', callback as EventListener);
  }
}