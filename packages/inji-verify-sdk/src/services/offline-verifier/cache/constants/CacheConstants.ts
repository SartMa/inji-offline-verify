/**
 * IndexedDB schema used by the SDK-managed cache.
 */
export const DB_NAME = 'VCVerifierCache';
export const DB_VERSION = 4; // bump on schema change - added revoked VCs
export const CONTEXT_STORE = 'contexts';
export const KEY_STORE = 'public_keys';
export const REVOKED_VC_STORE = 'revoked_vcs';
export const KEY_INDEX_CONTROLLER = 'controller'; // DID (no fragment)