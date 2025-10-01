import { getStatusListCredentialById, putStatusListCredentials } from '../cache/utils/CacheHelper';
import { RevocationErrorCodes, RevocationMessages } from './RevocationConstants';

export interface LoadedStatusListCredential {
  id: string;
  statusPurpose: string | string[];
  purposes: string[];
  encodedList: string; // base58btc+gzip compressed bitstring
  raw: any; // full credential document
  version?: number;
  encodedListHash?: string;
  updatedAt?: string;
}

export class StatusListLoader {
  private logger = console;

  private normalizePurposes(value: any): string[] {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value
        .map((v) => (typeof v === 'string' ? v : v?.toString?.() ?? ''))
        .filter((v): v is string => Boolean(v?.trim()))
        .map((v) => v.trim());
    }
    if (typeof value === 'string') {
      return value.trim() ? [value.trim()] : [];
    }
    const serialized = value?.toString?.();
    return serialized ? [serialized] : [];
  }

  private normalizeIssuer(value: any): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      return value.id || value.did || value.url || '';
    }
    return String(value ?? '');
  }

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
      return this.normalize(cred, {
        purposes: cached.purposes,
        version: cached.version,
        encoded_list_hash: cached.encoded_list_hash,
        updated_at: cached.updated_at,
      });
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
        const purposes = this.normalizePurposes(json.credentialSubject?.statusPurpose ?? json.credentialSubject?.status_purpose);
        await putStatusListCredentials([{
          status_list_id: statusListIdExtracted,
          issuer: this.normalizeIssuer(json.issuer),
          purposes,
          version: typeof json.version === 'number' ? json.version : undefined,
          encoded_list_hash: json.encoded_list_hash ?? json.encodedListHash,
          full_credential: json,
          organization_id: '',
          updated_at: json.updatedAt ?? json.updated_at ?? json.issuanceDate ?? json.issuance_date,
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

  private normalize(raw: any, metadata?: { purposes?: string[]; version?: number; encoded_list_hash?: string; updated_at?: string }): LoadedStatusListCredential {
    const cs = raw?.credentialSubject || {};
    const purposes = this.normalizePurposes(metadata?.purposes ?? cs.statusPurpose ?? cs.status_purpose);
    return {
      id: raw?.id,
      statusPurpose: purposes.length === 1 ? purposes[0] : purposes,
      purposes,
      encodedList: cs.encodedList || cs.encoded_list || raw?.encodedList,
      raw,
      version: metadata?.version ?? (typeof raw?.version === 'number' ? raw.version : undefined),
      encodedListHash: metadata?.encoded_list_hash ?? raw?.encoded_list_hash ?? raw?.encodedListHash,
      updatedAt: metadata?.updated_at ?? raw?.updatedAt ?? raw?.updated_at ?? raw?.issuanceDate ?? raw?.issuance_date,
    };
  }
}
