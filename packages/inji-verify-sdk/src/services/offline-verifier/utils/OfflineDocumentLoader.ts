import { getContext, putContexts } from '../cache/utils/CacheHelper';
import { CredentialVerifierConstants } from '../constants/CredentialVerifierConstants';
import { createSdkLogger } from '../../../utils/logger.js';

const logger = createSdkLogger('OfflineDocumentLoader');

/**
 * A secure, offline-first document loader for jsonld-signatures.
 * It prioritizes fetching from a local cache and falls back to network requests
 * only for unknown documents.
 */

// NOTE: This loader is strictly for JSON-LD @context resolution.
// DID and verification method resolution are handled by PublicKeyService.

export class OfflineDocumentLoader {
  static getDocumentLoader(): (url: string) => Promise<{ document: any; documentUrl: string; contextUrl?: string }> {
    const loader = new OfflineDocumentLoader();
    return loader.documentLoader.bind(loader);
  }

  async documentLoader(url: string) {
  logger.debug?.(`📄 [OfflineDocumentLoader] Resolving: ${url}`);

    // 1. DID/VM resolution is explicitly NOT handled here
    if (url.startsWith('did:')) {
      throw new Error('[OfflineDocumentLoader] DID/VM resolution is handled by PublicKeyService. Loader supports @context only.');
    }

    // 2. Contexts from cache
    // The helper function no longer needs the 'db' object
    const ctx = await getContext(url);
    if (ctx) {
  logger.debug?.(`💾 [OfflineDocumentLoader] Using cached context: ${url}`);
      return { contextUrl: undefined, document: ctx, documentUrl: url };
    }

    // Determine if we are allowed to hit the network. In browsers honor navigator.onLine,
    // while in Node (navigator undefined) fall back to checking global fetch availability.
    const canFetch = typeof fetch === 'function' && (typeof navigator === 'undefined' || navigator.onLine);

    // 3. If online (or running in an environment that supports fetch), fetch and cache once
    if (canFetch) {
  logger.debug?.(`🌐 [OfflineDocumentLoader] Fetching exact context: ${url}`);
      try {
        const resp = await fetch(url, { headers: { Accept: 'application/ld+json, application/json' }, cache: 'no-store' as RequestCache });
        if (!resp.ok) throw new Error(`Failed to fetch context: ${url} (${resp.status})`);
        const document = await resp.json();
        // Use the helper to cache the newly fetched context
        await putContexts([{ url, document }]);
        return { contextUrl: undefined, document, documentUrl: url };
      } catch (e: any) {
  logger.debug?.(`[OfflineDocumentLoader] Network fetch failed for ${url}:`, e.message);
        // Treat any fetch failure (when not already cached) as missing offline dependency
        // so upstream can show a clear message and guide the user to seed the cache.
        throw new Error(CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING);
      }
    }

    // 4. If offline and not in cache, fail
    throw new Error(CredentialVerifierConstants.ERROR_CODE_OFFLINE_DEPENDENCIES_MISSING);
  }
}