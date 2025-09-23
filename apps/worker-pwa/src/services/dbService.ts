// IndexedDB Configuration and Setup
const DB_NAME = 'VCVerifierDB';
const DB_VERSION = 1;
const STORE_NAME = 'verifications';

// This promise will ensure we only try to open the DB once.
let dbPromise: Promise<IDBDatabase> | null = null;

// This function gets the database connection, creating it only if it doesn't exist.
function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        dbPromise = null; // Reset on error
        reject(request.error);
      };

      request.onsuccess = (event: any) => {
        const db = event.target.result as IDBDatabase;
        // If the connection closes unexpectedly, reset the promise
        db.onclose = () => {
          console.warn('Database connection closed.');
          dbPromise = null;
        };
        console.log('IndexedDB initialized successfully');
        resolve(db);
      };

      request.onupgradeneeded = (event: any) => {
        const db = event.target.result as IDBDatabase;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, {
            keyPath: 'sno',
            autoIncrement: true,
          });
          objectStore.createIndex('uuid', 'uuid', { unique: true });
          objectStore.createIndex('verified_at', 'verified_at', { unique: false });
          objectStore.createIndex('synced', 'synced', { unique: false });
          objectStore.createIndex('verification_status', 'verification_status', { unique: false });
          objectStore.createIndex('vc_hash', 'vc_hash', { unique: false });
          console.log('Object store created with sno and uuid index');
        }
      };
    });
  }
  return dbPromise;
}

export type VerificationRecord = {
  sno?: number; // The auto-incrementing serial number for display
  uuid: string; // The universally unique ID for syncing
  verified_at: string;
  synced: boolean;
  verification_status: 'SUCCESS' | 'FAILED';
  vc_hash: string | null;
  credential_subject: any | null;
  error_message: string | null;
};

// Store verification result
export async function storeVerificationResult(jsonData: Omit<VerificationRecord, 'sno'>): Promise<number> {
  const db = await getDb(); // Get the stable connection
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.add(jsonData);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      console.log('Data stored successfully with Sno:', request.result);
      resolve(request.result as number);
    };
    request.onerror = () => {
      console.error('Failed to store data:', request.error);
      reject(request.error);
    };
  });
}

// Get all stored verifications
export async function getAllVerifications(): Promise<VerificationRecord[]> {
  const db = await getDb(); // Get the stable connection
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve((request as any).result as VerificationRecord[]);
    request.onerror = () => reject(request.error);
  });
}

// Get only unsynced verifications
export async function getUnsyncedVerifications(): Promise<VerificationRecord[]> {
  const db = await getDb(); // Get the stable connection
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const all = ((request as any).result || []) as VerificationRecord[];
      resolve(all.filter((item) => !item.synced));
    };
    request.onerror = () => reject(request.error);
  });
}

// Mark items as synced
export async function markAsSynced(uuids: string[]): Promise<void> {
  const db = await getDb(); // Get the stable connection
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const uuidIndex = store.index('uuid');

  for (const uuid of uuids) {
    const request = uuidIndex.get(uuid);
    request.onsuccess = () => {
      const data = (request as any).result as VerificationRecord | undefined;
      if (data) {
        data.synced = true;
        store.put(data);
      }
    };
  }

  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => {
      console.log('Marked as synced:', uuids);
      resolve();
    };
    transaction.onerror = () => reject(transaction.error);
  });
}

// Clear all data
export async function clearAllData(): Promise<void> {
  const db = await getDb(); // Get the stable connection
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.clear();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Helper functions
// function generateHash(data: string): string {
//   // Simple hash function for demo (replace with crypto.subtle.digest in production)
//   let hash = 0;
//   for (let i = 0; i < data.length; i++) {
//     const char = data.charCodeAt(i);
//     hash = (hash << 5) - hash + char;
//     hash = hash & hash;
//   }
//   return Math.abs(hash).toString(16);
// }

export function getDeviceId(): string {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

// Note: IDBDatabase is a global DOM type; no need to re-export
