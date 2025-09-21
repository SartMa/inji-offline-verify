import { getContext, getKeyById, getAnyKeyForDid, putContexts } from '../cache/utils/CacheHelper';

/**
 * A secure, offline-first document loader for jsonld-signatures.
 * It prioritizes fetching from a local cache and falls back to network requests
 * only for unknown documents.
 */

function vmFromKey(key: any) {
  return {
    '@context': ['https://w3id.org/security/suites/ed25519-2020/v1'],
    id: key.key_id,
    type: key.key_type ?? 'Ed25519VerificationKey2020',
    controller: key.controller,
    publicKeyMultibase: key.public_key_multibase
  };
}

function didDocFromKey(did: string, key: any) {
  return {
    '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/suites/ed25519-2020/v1'],
    id: did,
    verificationMethod: [vmFromKey(key)],
    assertionMethod: [key.key_id]
  };
}

export class OfflineDocumentLoader {
  static getDocumentLoader(): (url: string) => Promise<{ document: any; documentUrl: string; contextUrl?: string }> {
    const loader = new OfflineDocumentLoader();
    return loader.documentLoader.bind(loader);
  }

  async documentLoader(url: string) {
    console.log(`📄 [OfflineDocumentLoader] Resolving: ${url}`);

    // 1. DID resolution from cache
    if (url.startsWith('did:')) {
      console.log(`🔐 [OfflineDocumentLoader] Resolving DID from cache: ${url}`);
      if (url.includes('#')) {
        // The helper function no longer needs the 'db' object
        const key = await getKeyById(url);
        if (!key) throw new Error(`DID verification method not available offline: ${url}`);
        return { contextUrl: undefined, document: vmFromKey(key), documentUrl: url };
      } else {
        // The helper function no longer needs the 'db' object
        const key = await getAnyKeyForDid(url);
        if (!key) throw new Error(`DID document not available offline: ${url}`);
        return { contextUrl: undefined, document: didDocFromKey(url, key), documentUrl: url };
      }
    }

    // 2. Contexts from cache
    // The helper function no longer needs the 'db' object
    const ctx = await getContext(url);
    if (ctx) {
      console.log(`💾 [OfflineDocumentLoader] Using cached context: ${url}`);
      return { contextUrl: undefined, document: ctx, documentUrl: url };
    }

    // 3. If online, fetch and cache once
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      console.log(`🌐 [OfflineDocumentLoader] Fetching exact context: ${url}`);
      try {
        const resp = await fetch(url, { headers: { Accept: 'application/ld+json, application/json' } });
        if (!resp.ok) throw new Error(`Failed to fetch context: ${url} (${resp.status})`);
        const document = await resp.json();
        // Use the helper to cache the newly fetched context
        await putContexts([{ url, document }]);
        return { contextUrl: undefined, document, documentUrl: url };
      } catch (e: any) {
        console.error(`[OfflineDocumentLoader] Network fetch failed for ${url}:`, e.message);
        throw new Error(`Failed to retrieve document for ${url}.`);
      }
    }

    // 4. If offline and not in cache, fail
    throw new Error(
      `The document for "${url}" is not in the cache and the application is offline.`
    );
  }
}