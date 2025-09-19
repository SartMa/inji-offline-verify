// IndexedDB Configuration and Setup
const DB_NAME = 'VCVerifierDB';
const DB_VERSION = 1;
const STORE_NAME = 'verifications';

let db: IDBDatabase | null = null;

// Initialize IndexedDB
export async function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = (event: any) => {
      db = event.target.result as IDBDatabase;
      console.log('IndexedDB initialized successfully');
      resolve(db!);
    };

    request.onupgradeneeded = (event: any) => {
      db = event.target.result as IDBDatabase;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, {
          keyPath: 'id',
          autoIncrement: true,
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
}

export type VerificationRecord = {
  id?: number;
  timestamp: string;
  synced: boolean;
  syncAttempts: number;
  hash: string;
  deviceId: string;
  status?: string;
  error?: string | null;
  [key: string]: any;
};

// Store verification result
export async function storeVerificationResult(jsonData: Record<string, any>): Promise<number> {
  if (!db) {
    await initDB();
  }

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    // Prepare data for storage
    const dataToStore: VerificationRecord = {
      ...jsonData,
      timestamp: new Date().toISOString(),
      synced: false,
      syncAttempts: 0,
      hash: generateHash(JSON.stringify(jsonData)),
      deviceId: getDeviceId(),
    };

    const request = store.add(dataToStore);

    request.onsuccess = () => {
      console.log('Data stored successfully with ID:', request.result);
      resolve(request.result as number);
    };

    request.onerror = () => {
      console.error('Failed to store data:', (request as any).error);
      reject((request as any).error);
    };
  });
}

// Get all stored verifications
export async function getAllVerifications(): Promise<VerificationRecord[]> {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve((request as any).result as VerificationRecord[]);
    request.onerror = () => reject((request as any).error);
  });
}

// Get only unsynced verifications
export async function getUnsyncedVerifications(): Promise<VerificationRecord[]> {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    // Avoid querying by boolean index key (not a valid IDB key in all browsers)
    const request = store.getAll();

    request.onsuccess = () => {
      const all = ((request as any).result || []) as VerificationRecord[];
      resolve(all.filter((item) => !item.synced));
    };
    request.onerror = () => reject((request as any).error);
  });
}

// Mark items as synced
export async function markAsSynced(ids: number[]): Promise<void> {
  if (!db) await initDB();

  const transaction = db!.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  for (const id of ids) {
    const request = store.get(id);

    request.onsuccess = () => {
      const data = (request as any).result as VerificationRecord | undefined;
      if (data) {
        data.synced = true;
        (data as any).syncedAt = new Date().toISOString();
        store.put(data);
      }
    };
  }

  await new Promise<void>((resolve) => {
    transaction.oncomplete = () => {
      console.log('Marked as synced:', ids);
      resolve();
    };
  });
}

// Clear all data
export async function clearAllData(): Promise<void> {
  if (!db) await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db!.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject((request as any).error);
  });
}

// Helper functions
function generateHash(data: string): string {
  // Simple hash function for demo (replace with crypto.subtle.digest in production)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

export function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

// Note: IDBDatabase is a global DOM type; no need to re-export
