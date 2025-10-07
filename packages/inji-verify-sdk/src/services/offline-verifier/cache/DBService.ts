import { openDB, IDBPDatabase } from 'idb'      ;
import { DB_NAME, DB_VERSION, CONTEXT_STORE, KEY_STORE, STATUS_LIST_STORE } from './constants/CacheConstants';
import { createSdkLogger } from '../../../utils/logger.js';

const logger = createSdkLogger('DBService');

class DBService {
  private static instance: DBService;
  private dbPromise: Promise<IDBPDatabase<any>>;

  private constructor() {
  logger.debug?.("DBService singleton initializing...");
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
        }

        // New store for Status List Credentials (BitstringStatusListCredential)
        if (!db.objectStoreNames.contains(STATUS_LIST_STORE)) {
          const sl = db.createObjectStore(STATUS_LIST_STORE, { keyPath: 'status_list_id' });
          try { sl.createIndex('organization_id', 'organization_id', { unique: false }); } catch {}
        } else {
          const sl = tx.objectStore(STATUS_LIST_STORE);
          try { sl.createIndex('organization_id', 'organization_id', { unique: false }); } catch {}
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