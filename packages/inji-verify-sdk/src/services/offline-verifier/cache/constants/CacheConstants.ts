/**
 * IndexedDB schema used by the SDK-managed cache.
 */
export const DB_NAME = 'VCVerifierCache';
export const DB_VERSION = 3; // bump on schema change
export const CONTEXT_STORE = 'contexts';
export const KEY_STORE = 'public_keys';
export const KEY_INDEX_CONTROLLER = 'controller'; // DID (no fragment)