import { openDB, IDBPDatabase } from 'idb'      ;
import { DB_NAME, DB_VERSION, CONTEXT_STORE, KEY_STORE, REVOKED_VC_STORE, KEY_INDEX_CONTROLLER } from './constants/CacheConstants';
import type { CachedRevokedVC } from './utils/CacheHelper';

class DBService {
  private static instance: DBService;
  private dbPromise: Promise<IDBPDatabase<any>>;

  private constructor() {
    console.log("DBService singleton initializing...");
    this.dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion, tx) {
        if (!db.objectStoreNames.contains(CONTEXT_STORE)) {
          const ctx = db.createObjectStore(CONTEXT_STORE, { keyPath: 'url' });
          try { ctx.createIndex('organization_id', 'organization_id', { unique: false }); } catch {}
        } else {
          // Ensure index exists on upgrade
          const ctx = tx.objectStore(CONTEXT_STORE);
          try { ctx.createIndex('organization_id', 'organization_id', { unique: false }); } catch {}
        }
        if (!db.objectStoreNames.contains(KEY_STORE)) {
          db.createObjectStore(KEY_STORE, { keyPath: 'key_id' });
          // Note: Index creation must happen within the same transaction as store creation.
          // This block is for initial creation.
        }
        if (!db.objectStoreNames.contains(REVOKED_VC_STORE)) {
          const revokedStore = db.createObjectStore(REVOKED_VC_STORE, { keyPath: 'vc_id' });
          revokedStore.createIndex('issuer', 'issuer', { unique: false });
          revokedStore.createIndex('organization_id', 'organization_id', { unique: false });
        }
      },
    });
  }

  public static getInstance(): DBService {
    if (!DBService.instance) {
      DBService.instance = new DBService();
    }
    return DBService.instance;
  }

  public getDB(): Promise<IDBPDatabase<any>> {
    return this.dbPromise;
  }
}

// Export a single instance for the entire SDK to use.
export const dbService = DBService.getInstance();