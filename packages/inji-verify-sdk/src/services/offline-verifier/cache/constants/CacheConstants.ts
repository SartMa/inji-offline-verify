/**
 * IndexedDB schema used by the SDK-managed cache.
 */
export const DB_NAME = 'VCVerifierCache';
export const DB_VERSION = 5; // bump on schema change - add context organization index
export const CONTEXT_STORE = 'contexts';
export const KEY_STORE = 'public_keys';
export const REVOKED_VC_STORE = 'revoked_vcs';
export const KEY_INDEX_CONTROLLER = 'controller'; // DID (no fragment)