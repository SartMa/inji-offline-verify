import { getStatusListCredentialById, putStatusListCredentials } from '../cache/utils/CacheHelper';
import { RevocationErrorCodes, RevocationMessages } from './RevocationConstants';

export interface LoadedStatusListCredential {
  id: string;
  statusPurpose: string;
  encodedList: string; // base58btc+gzip compressed bitstring
  raw: any; // full credential document
}

export class StatusListLoader {
  private logger = console;

  async load(statusListId: string): Promise<LoadedStatusListCredential> {
    // 1. Try cache
    const cached = await getStatusListCredentialById(statusListId);
    if (cached?.full_credential) {
      this.logger.info('[StatusListLoader] Loaded status list from cache', {
        statusListId,
        cachedAt: cached.cachedAt,
        issuer: cached.issuer
      });
      const cred = cached.full_credential;
      return this.normalize(cred);
    }

    // 2. Fetch network as fallback
    this.logger.warn('[StatusListLoader] Cache miss, fetching status list from network', statusListId);
    try {
      const resp = await fetch(statusListId, { headers: { Accept: 'application/ld+json, application/json' } });
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}`);
      }
      const json = await resp.json();
      // opportunistically cache if we can extract minimal fields
      try {
        const statusListIdExtracted = json.id || statusListId;
        await putStatusListCredentials([{
          status_list_id: statusListIdExtracted,
          issuer: json.issuer,
          status_purpose: json.credentialSubject?.statusPurpose || 'revocation',
          full_credential: json,
          organization_id: ''
        }]);
        this.logger.info('[StatusListLoader] Cached status list credential', statusListIdExtracted);
      } catch {}
      return this.normalize(json);
    } catch (e) {
      this.logger.error('[StatusListLoader] Retrieval failed:', e);
      const err: any = new Error(RevocationMessages[RevocationErrorCodes.STATUS_RETRIEVAL_ERROR]);
      err.code = RevocationErrorCodes.STATUS_RETRIEVAL_ERROR;
      throw err;
    }
  }

  private normalize(raw: any): LoadedStatusListCredential {
    const cs = raw?.credentialSubject || {};
    return {
      id: raw?.id,
      statusPurpose: cs.statusPurpose || cs.status_purpose || 'revocation',
      encodedList: cs.encodedList || cs.encoded_list || raw?.encodedList,
      raw
    };
  }
}
