// IndexedDB Configuration and Setup
const DB_NAME = 'VCVerifierDB';
const DB_VERSION = 1;
const STORE_NAME = 'verifications';

let db = null;

// Initialize IndexedDB
export async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('IndexedDB error:', request.error);
            reject(request.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('IndexedDB initialized successfully');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            db = event.target.result;
            
            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = db.createObjectStore(STORE_NAME, {
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
}

// Store verification result
export async function storeVerificationResult(jsonData) {
    if (!db) {
        await initDB();
    }

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
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
            console.log('Data stored successfully with ID:', request.result);
            resolve(request.result);
        };
        
        request.onerror = () => {
            console.error('Failed to store data:', request.error);
            reject(request.error);
        };
    });
}

// Get all stored verifications
export async function getAllVerifications() {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Get only unsynced verifications
export async function getUnsyncedVerifications() {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('synced');
        const request = index.getAll(false);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// Mark items as synced
export async function markAsSynced(ids) {
    if (!db) await initDB();
    
    const transaction = db.transaction([STORE_NAME], 'readwrite');
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
    
    return new Promise((resolve) => {
        transaction.oncomplete = () => {
            console.log('Marked as synced:', ids);
            resolve();
        };
    });
}

// Clear all data
export async function clearAllData() {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// Helper functions
function generateHash(data) {
    // Simple hash function for demo (replace with crypto.subtle.digest in production)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
        const char = data.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
}

export function getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
}