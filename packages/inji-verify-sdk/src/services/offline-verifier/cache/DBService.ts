import { openDB, IDBPDatabase } from 'idb'      ;
import { DB_NAME, DB_VERSION, CONTEXT_STORE, KEY_STORE, KEY_INDEX_CONTROLLER } from './constants/CacheConstants';

class DBService {
  private static instance: DBService;
  private dbPromise: Promise<IDBPDatabase<any>>;

  private constructor() {
    console.log("DBService singleton initializing...");
    this.dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(CONTEXT_STORE)) {
          db.createObjectStore(CONTEXT_STORE, { keyPath: 'url' });
        }
        if (!db.objectStoreNames.contains(KEY_STORE)) {
          db.createObjectStore(KEY_STORE, { keyPath: 'key_id' });
          // Note: Index creation must happen within the same transaction as store creation.
          // This block is for initial creation.
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