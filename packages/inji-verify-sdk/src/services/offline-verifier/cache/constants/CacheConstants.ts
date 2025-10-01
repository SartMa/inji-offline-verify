/**
 * IndexedDB schema used by the SDK-managed cache.
 */
export const DB_NAME = 'SDKCache';
export const DB_VERSION = 7; // bump on schema change - added status list credential store
export const CONTEXT_STORE = 'contexts';
export const KEY_STORE = 'public_keys';
export const KEY_INDEX_CONTROLLER = 'controller'; // DID (no fragment)
export const STATUS_LIST_STORE = 'status_list_credentials';