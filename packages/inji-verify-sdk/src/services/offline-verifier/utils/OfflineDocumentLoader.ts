/**
 * OFFLINE DOCUMENT LOADER
 * 
 * This utility extracts JSON-LD contexts from IndexedDB cache for offline verification.
 * No network calls are made - everything is resolved from local cache.
 */
export class OfflineDocumentLoader {
  private static readonly DB_NAME = 'ContextCache';
  private static readonly DB_VERSION = 1;
  private static readonly STORE_NAME = 'contexts';
  
  // Built-in fallback contexts (embedded in code for critical contexts)
  private static readonly BUILTIN_CONTEXTS: Record<string, any> = {
    'https://www.w3.org/2018/credentials/v1': {
      '@context': {
        '@version': 1.1,
        '@protected': true,
        
        // Core VC vocabulary
        'VerifiableCredential': {
          '@id': 'https://www.w3.org/2018/credentials#VerifiableCredential',
          '@context': {
            '@version': 1.1,
            '@protected': true,
            'id': '@id',
            'type': '@type',
            'credentialSubject': {
              '@id': 'https://www.w3.org/2018/credentials#credentialSubject',
              '@type': '@id'
            },
            'issuer': {
              '@id': 'https://www.w3.org/2018/credentials#issuer', 
              '@type': '@id'
            },
            'issuanceDate': {
              '@id': 'https://www.w3.org/2018/credentials#issuanceDate',
              '@type': 'http://www.w3.org/2001/XMLSchema#dateTime'
            },
            'expirationDate': {
              '@id': 'https://www.w3.org/2018/credentials#expirationDate',
              '@type': 'http://www.w3.org/2001/XMLSchema#dateTime'
            }
          }
        },
        
        // Individual terms
        'credentialSubject': 'https://www.w3.org/2018/credentials#credentialSubject',
        'issuer': 'https://www.w3.org/2018/credentials#issuer',
        'issuanceDate': 'https://www.w3.org/2018/credentials#issuanceDate',
        'expirationDate': 'https://www.w3.org/2018/credentials#expirationDate',
        'credentialStatus': 'https://www.w3.org/2018/credentials#credentialStatus'
      }
    },

    'https://w3id.org/security/v1': {
      '@context': {
        '@version': 1.1,
        '@protected': true,
        
        // Security/Proof vocabulary  
        'proof': {
          '@id': 'https://w3id.org/security#proof',
          '@type': '@id',
          '@container': '@graph'
        },
        'Ed25519Signature2020': 'https://w3id.org/security#Ed25519Signature2020',
        'Ed25519VerificationKey2020': 'https://w3id.org/security#Ed25519VerificationKey2020',
        'verificationMethod': {
          '@id': 'https://w3id.org/security#verificationMethod',
          '@type': '@id'
        },
        'proofPurpose': {
          '@id': 'https://w3id.org/security#proofPurpose',
          '@type': '@vocab'
        },
        'proofValue': {
          '@id': 'https://w3id.org/security#proofValue',
          '@type': 'https://w3id.org/security#multibase'
        },
        'jws': 'https://w3id.org/security#jws',
        'created': {
          '@id': 'http://purl.org/dc/terms/created',
          '@type': 'http://www.w3.org/2001/XMLSchema#dateTime'
        }
      }
    },

    'https://w3id.org/security/v2': {
      '@context': {
        '@version': 1.1,
        '@protected': true,
        
        // Same as v1 but version 2
        'proof': {
          '@id': 'https://w3id.org/security#proof',
          '@type': '@id',
          '@container': '@graph'
        },
        'Ed25519Signature2020': 'https://w3id.org/security#Ed25519Signature2020',
        'Ed25519VerificationKey2020': 'https://w3id.org/security#Ed25519VerificationKey2020',
        'verificationMethod': {
          '@id': 'https://w3id.org/security#verificationMethod',
          '@type': '@id'
        },
        'proofPurpose': {
          '@id': 'https://w3id.org/security#proofPurpose',
          '@type': '@vocab'
        },
        'proofValue': {
          '@id': 'https://w3id.org/security#proofValue',
          '@type': 'https://w3id.org/security#multibase'
        },
        'jws': 'https://w3id.org/security#jws',
        'created': {
          '@id': 'http://purl.org/dc/terms/created',
          '@type': 'http://www.w3.org/2001/XMLSchema#dateTime'
        }
      }
    }
  };

  /**
   * Get document loader function for jsonld-signatures library
   * This is the main method called by the crypto library
   */
  static getDocumentLoader(): (url: string) => Promise<{ document: any; documentUrl: string; contextUrl?: string }> {
    return async (url: string) => {
      console.log(`📄 [OfflineDocumentLoader] Resolving context: ${url}`);
      
      try {
        // STEP 1: Try IndexedDB cache first (contexts downloaded during login)
        const cachedContext = await this.getFromCache(url);
        if (cachedContext) {
          console.log(`📋 [OfflineDocumentLoader] Using cached context: ${url}`);
          return {
            document: cachedContext.document,
            documentUrl: url,
            contextUrl: undefined
          };
        }

        // STEP 2: Try built-in contexts (embedded in code)
        const builtinContext = this.BUILTIN_CONTEXTS[url];
        if (builtinContext) {
          console.log(`📚 [OfflineDocumentLoader] Using built-in context: ${url}`);
          return {
            document: builtinContext,
            documentUrl: url,
            contextUrl: undefined
          };
        }

        // STEP 3: Context not available offline - this is an error
        console.error(`❌ [OfflineDocumentLoader] Context not available offline: ${url}`);
        throw new Error(`Context not available offline: ${url}. Ensure it's cached during login.`);

      } catch (error: any) {
        console.error(`💥 [OfflineDocumentLoader] Error loading context: ${url}`, error);
        throw error;
      }
    };
  }

  /**
   * Get context from IndexedDB cache
   */
  private static async getFromCache(url: string): Promise<{ document: any } | null> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
      
      request.onerror = () => {
        console.warn(`⚠️ [OfflineDocumentLoader] IndexedDB error: ${request.error}`);
        resolve(null); // Don't fail, try built-in contexts
      };
      
      request.onsuccess = () => {
        const db = request.result;
        
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          console.warn(`⚠️ [OfflineDocumentLoader] Context store not found`);
          resolve(null);
          return;
        }
        
        const transaction = db.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const getRequest = store.get(url);
        
        getRequest.onsuccess = () => {
          const result = getRequest.result;
          if (result && this.isValidCachedContext(result)) {
            resolve(result);
          } else {
            resolve(null);
          }
        };
        
        getRequest.onerror = () => {
          console.warn(`⚠️ [OfflineDocumentLoader] Error reading from cache: ${getRequest.error}`);
          resolve(null);
        };
      };
    });
  }

  /**
   * Validate cached context structure
   */
  private static isValidCachedContext(context: any): boolean {
    return (
      context &&
      typeof context === 'object' &&
      context.document &&
      typeof context.document === 'object' &&
      !this.isCacheExpired(context)
    );
  }

  /**
   * Check if cached context is expired
   */
  private static isCacheExpired(context: any): boolean {
    if (!context.cachedAt) return false; // No expiration info
    
    const cacheAge = Date.now() - context.cachedAt;
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (cacheAge > maxAge) {
      console.warn(`⚠️ [OfflineDocumentLoader] Cached context expired`);
      return true;
    }
    
    return false;
  }

  /**
   * Get all required contexts for offline operation
   * Used to validate cache completeness
   */
  static getRequiredContexts(): string[] {
    return [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/security/v1',
      'https://w3id.org/security/v2'
    ];
  }

  /**
   * Check if all required contexts are available offline
   */
  static async validateOfflineReadiness(): Promise<{ ready: boolean; missing: string[] }> {
    const required = this.getRequiredContexts();
    const missing: string[] = [];
    
    for (const contextUrl of required) {
      try {
        const loader = this.getDocumentLoader();
        await loader(contextUrl);
        console.log(`✅ [OfflineDocumentLoader] Context available: ${contextUrl}`);
      } catch (error) {
        console.error(`❌ [OfflineDocumentLoader] Context missing: ${contextUrl}`);
        missing.push(contextUrl);
      }
    }
    
    return {
      ready: missing.length === 0,
      missing
    };
  }
}